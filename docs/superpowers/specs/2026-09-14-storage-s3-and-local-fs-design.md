# Storage S3 & Local Filesystem Architecture Design

## 1. Context & Motivation
Nibleaf currently uses an S3-compatible object storage layer (`@aws-sdk/client-s3`) configured against MinIO/MaxIO in local development and AWS S3/Cloudflare R2/Backblaze B2 in production.
To support offline development, lightweight single-container self-hosting, and reduced infrastructure complexity without requiring Docker MinIO/MaxIO containers, this design adapts `@nibleaf/storage` to support a local filesystem storage backend (`LocalStorage`) alongside `S3Storage`, directly modeled after Outline's file storage architecture (`outline/server/storage/files`).

---

## 2. Architecture & Class Structure

### 2.1 Directory Structure
```
packages/storage/
├── package.json          # Add "hono" dependency, export "./router"
├── tsconfig.json
└── src/
    ├── base.ts           # BaseStorage abstract class, common interfaces, MIME/disposition utilities
    ├── s3.ts             # S3Storage implementation (AWS S3, MinIO, MaxIO, Cloudflare R2, Backblaze B2)
    ├── local.ts          # LocalStorage implementation (Node fs, range streaming, empty directory pruning)
    ├── signature.ts      # HMAC-SHA256 URL signing and constant-time verification
    ├── client.ts         # (Existing) S3 client cache and target resolver
    ├── keys.ts           # Environment schema with STORAGE_PROVIDER ('local' | 'maxio' | 'minio' | 's3' | 'b2')
    ├── router.ts         # Hono storageRouter for local presigned PUT/GET requests
    ├── index.ts          # Singleton getStorage() factory, class exports, and backward-compatible function facades
    ├── base.test.ts      # Unit tests for BaseStorage utilities
    ├── local.test.ts     # Unit tests for LocalStorage and path traversal defense
    ├── signature.test.ts # Unit tests for HMAC generation, expiry, and verification
    ├── router.test.ts    # Unit tests for Hono storageRouter PUT and GET endpoints
    └── s3.test.ts        # Unit tests for S3Storage
```

### 2.2 `BaseStorage` Abstract Class
`BaseStorage` acts as the uniform contract across all storage providers:
- **`putObject(key, body, contentType?, target?)`**: Persists content (`Buffer`, `string`, `Uint8Array`, or `Readable` stream) under `key`.
- **`getObjectStream(key, range?, target?)`**: Returns a readable Node stream of the file with optional byte range `{ start, end }`.
- **`headObject(key, target?)`**: Retrieves object metadata (`ContentLength`, `ContentType`, `LastModified`).
- **`objectExists(key, target?)`**: Checks if the file/key exists.
- **`deleteObject(key, target?)`**: Removes a single file.
- **`deletePrefix(prefix, target?)`**: Recursively removes all files sharing a key prefix.
- **`moveFile(fromKey, toKey, target?)`**: Moves/renames a file from `fromKey` to `toKey`.
- **`getFileBuffer(key, target?)`**: Helper that consumes `getObjectStream(key)` into a Node `Buffer`.
- **`getFileHandle(key, target?)`**: Outline-compatible helper returning `{ path: string; cleanup: () => Promise<void> }`.
- **`presignPutUrl(options)`**: Returns a presigned URL for direct client PUT upload.
- **`presignGetUrl(options)`**: Returns a presigned URL for direct client GET download.
- **`buildPublicUrl(key, target?)`**: Constructs the canonical public CDN / HTTP URL for a key.
- **`ensureBucket(target?)`**: Bootstraps the storage container (creates bucket or directory).
- **`configureUploadCors(origins, target?)`**: Applies CORS rules to enable direct browser uploads (no-op on local fs).
- **`getContentDisposition(contentType?, fileName?)`**: Generates standard RFC-compliant `Content-Disposition`.
- **`getContentDispositionType(contentType?)`**: Returns `'inline'` for safe web assets (`image/*`, `application/pdf`) or `'attachment'`.

---

## 3. Storage Providers

### 3.1 `S3Storage`
- Wraps `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
- Supports existing features:
  - Custom endpoints, path style addressing, regions, buckets.
  - Multi-part upload and deletion batches (`DeleteObjectsCommand` in batches of 1,000).
  - Presigned PUT (`PutObjectCommand`) and presigned GET (`GetObjectCommand`).
  - `getFileHandle(key)`: Streams file to a temporary file on disk with a cleanup callback that removes the temp file.

### 3.2 `LocalStorage`
- **Root Directory**: `STORAGE_LOCAL_ROOT_DIR` (defaults to `./data/storage`).
- **Workspace-Aware Path Resolution**:
  - Resolves relative root paths to the monorepo root (finding parent containing `pnpm-workspace.yaml`).
- **Path Sanitization**:
  - Rejects keys containing null bytes (`\0`) or directory climbing (`..` segments).
  - Enforces that `path.resolve(rootDir, cleanKey)` begins strictly with `rootDir`.
- **Read & Write Operations**:
  - `putObject`: Creates parent directory structure recursively (`mkdir({ recursive: true })`), then pipes stream or writes buffer.
  - `getObjectStream`: Returns `fs.createReadStream(filePath, range)` with byte range slicing.
  - `headObject`: Calls `fs.stat(filePath)` and infers MIME content type from file extension.
  - `objectExists`: Checks file presence via `fs.access(filePath)`.
  - `deleteObject`: Unlinks the file and recursively prunes empty parent directories up to storage root.
  - `deletePrefix`: Recursively walks the directory tree under the prefix, unlinks all matching files, cleans up empty directories, and returns total count deleted.
  - `moveFile`: Moves using `fs.rename`, falling back to stream copy + unlink on `EXDEV` cross-device moves.
  - `getFileHandle`: Returns `{ path: filePath, cleanup: async () => {} }` directly.
  - `ensureBucket`: Creates the root directory if it does not exist.
  - `configureUploadCors`: Idempotent no-op (CORS is handled at HTTP server layer).

---

## 4. Local Presigned URLs & Server Handler

### 4.1 URL Signing (`signature.ts`)
For `LocalStorage`, presigned URLs target the server's API route:
- **Upload (`presignPutUrl`)**:
  `${apiUrl}/api/storage/files?action=put&key=${encodeURIComponent(key)}&expires=${expires}&sig=${sig}`
- **Download (`presignGetUrl`)**:
  `${apiUrl}/api/storage/files?action=get&key=${encodeURIComponent(key)}&expires=${expires}&sig=${sig}`

**Signature Scheme**:
- Payload: `${action}:${key}:${expires}`
- Algorithm: HMAC-SHA256 (`node:crypto`)
- Secret: `STORAGE_SIGNING_SECRET ?? BETTER_AUTH_SECRET ?? 'nibleaf-local-secret'`
- Validation: Verifies expiration timestamp (`expires >= Math.floor(Date.now() / 1000)`) and validates HMAC using constant-time comparison (`crypto.timingSafeEqual`).

### 4.2 Server Route (`packages/storage/src/router.ts` & `apps/server`)
- Mounted in `apps/server/src/create-app.ts` under `/api/storage/files`:
  - **`PUT` Request**:
    - Validates signature for `action=put`.
    - Streams request body directly into `storage.putObject(key, body, contentType)`.
    - Responds with `200 OK`.
    - Seamlessly satisfies client upload (`fetch(presign.uploadUrl, { method: 'PUT', body: file })`).
  - **`GET` Request**:
    - Validates signature for `action=get`.
    - Heads file for length and type, streams file via `storage.getObjectStream(key)`.
    - Sets appropriate `Content-Type`, `Content-Length`, `Content-Disposition`, and `Cache-Control`.

---

## 5. Configuration & Environment

`packages/storage/src/keys.ts` updated with:
```ts
STORAGE_PROVIDER: z.enum(['local', 'maxio', 'minio', 's3', 'b2']).default('maxio'),
STORAGE_LOCAL_ROOT_DIR: z.string().default('./data/storage'),
STORAGE_SIGNING_SECRET: z.string().optional(),
STORAGE_API_URL: z.string().optional(),
```
`.gitignore` updated to include:
```gitignore
data/storage/
```

---

## 6. Backward Compatibility Façade

In `packages/storage/src/index.ts`:
- An active `storage` instance is obtained via `getStorage()`.
- Exported functions delegate directly to `getStorage()`:
  - `putObject`, `getObjectStream`, `headObject`, `objectExists`, `deleteObject`, `deletePrefix`, `moveFile`, `getFileBuffer`, `getFileHandle`, `presignPutUrl`, `presignGetUrl`, `buildPublicUrl`, `ensureBucket`, `configureUploadCors`, `putBucketCors`.
- Re-exports classes: `BaseStorage`, `LocalStorage`, `S3Storage`.
- Re-exports client helpers: `StorageTarget`, `defaultTarget`, `publicTarget`, `getS3Client`, `getBucket`, `getPublicBaseUrl`.
- Re-exports router: `createStorageRouter`, `storageRouter`.
- Default export: `export default storage`.

---

## 7. Verification Plan

1. **Unit Tests in `packages/storage`**:
   - `base.test.ts`:
     - Test content disposition generation and MIME type inference.
   - `local.test.ts`:
     - Test storing strings, Buffers, and streams.
     - Test retrieving streams and byte range slicing.
     - Test `headObject`, `objectExists`, `deleteObject`, `deletePrefix`, `moveFile`.
     - Test path traversal attempts (`../`, absolute paths, percent-encoded traversal).
     - Test `getFileBuffer` and `getFileHandle`.
   - `signature.test.ts`:
     - Test HMAC signing, valid verification, expired token rejection, tampered payload rejection.
   - `router.test.ts`:
     - Test PUT upload and GET download through Hono test client.
   - `s3.test.ts`:
     - Test S3Storage method delegation.
2. **Typecheck & Monorepo Validation**:
   - `pnpm --filter @nibleaf/storage typecheck`
   - `pnpm --filter @nibleaf/storage test`
   - `pnpm --filter @nibleaf/server typecheck`
