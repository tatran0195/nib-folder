import { Readable } from 'node:stream';
import { Hono } from 'hono';
import { BaseStorage } from './base';
import { keys } from './keys';
import { verifyStorageSignature } from './signature';

const pathBasename = (filePath: string): string => {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || 'download';
};

export const createStorageRouter = (storageInstance?: BaseStorage, signingSecret?: string) => {
  const router = new Hono();

  const getSecret = () =>
    signingSecret ?? keys().STORAGE_SIGNING_SECRET ?? process.env.BETTER_AUTH_SECRET ?? 'nibleaf-local-secret';

  router.put('/', async (ctx) => {
    const action = ctx.req.query('action');
    const key = ctx.req.query('key');
    const expiresStr = ctx.req.query('expires');
    const sig = ctx.req.query('sig');

    if (action !== 'put' || !key || !expiresStr || !sig) {
      return ctx.text('Missing required query parameters', 400);
    }

    const expires = parseInt(expiresStr, 10);
    if (Number.isNaN(expires)) {
      return ctx.text('Invalid expiration timestamp', 400);
    }

    if (!verifyStorageSignature('put', key, expires, sig, getSecret())) {
      return ctx.text('Forbidden: invalid or expired signature', 403);
    }

    const storage = storageInstance ?? (await import('./index')).default;
    const contentType = ctx.req.header('content-type') || undefined;

    const arrayBuffer = await ctx.req.arrayBuffer();
    await storage.putObject(key, Buffer.from(arrayBuffer), contentType);

    return ctx.text('OK', 200);
  });

  router.get('/', async (ctx) => {
    const action = ctx.req.query('action');
    const key = ctx.req.query('key');
    const expiresStr = ctx.req.query('expires');
    const sig = ctx.req.query('sig');

    if (action !== 'get' || !key || !expiresStr || !sig) {
      return ctx.text('Missing required query parameters', 400);
    }

    const expires = parseInt(expiresStr, 10);
    if (Number.isNaN(expires)) {
      return ctx.text('Invalid expiration timestamp', 400);
    }

    if (!verifyStorageSignature('get', key, expires, sig, getSecret())) {
      return ctx.text('Forbidden: invalid or expired signature', 403);
    }

    const storage = storageInstance ?? (await import('./index')).default;
    try {
      const head = await storage.headObject(key);
      const stream = await storage.getObjectStream(key);

      const headers: Record<string, string> = {
        'Content-Type': head.ContentType ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
      };
      if (typeof head.ContentLength === 'number') {
        headers['Content-Length'] = String(head.ContentLength);
      }
      const filename = pathBasename(key);
      headers['Content-Disposition'] = storage.getContentDisposition(head.ContentType, filename);

      for (const [k, v] of Object.entries(headers)) {
        ctx.header(k, v);
      }

      return ctx.body(Readable.toWeb(stream) as ReadableStream);
    } catch {
      return ctx.text('Not found', 404);
    }
  });

  return router;
};

export const storageRouter = createStorageRouter();
