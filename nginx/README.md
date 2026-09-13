# Nginx Ingress Proxy for Nibleaf

This directory provides a production-grade and local-development Nginx reverse proxy configuration for Nibleaf. It handles routing across:
1. **App Dashboard**: `http://nibleaf.local` and `http://app.nibleaf.local`
2. **Default Project Subdomains**: `http://<slug>.nibleaf.local` (e.g. `http://docs.nibleaf.local`)
3. **Custom Domains**: `http://custom.local` or any user-connected domain

---

## Architecture Overview

```
                        ┌──────────────────────────────────────────────┐
                        │                Browser / Client              │
                        └──────────────────────┬───────────────────────┘
                                               │
                                       HTTP Port 80 (or 443)
                                               │
                                               ▼
                                 ┌───────────────────────────┐
                                 │       Nginx Ingress       │
                                 │      (nginx/conf.d/)      │
                                 └─────────────┬─────────────┘
                                               │
                 ┌─────────────────────────────┴─────────────────────────────┐
                 │                                                           │
        Host: nibleaf.local                           Host: docs.nibleaf.local OR custom.local
                 │                                                           │
                 ▼                                                           ▼
    ┌──────────────────────────┐                               ┌──────────────────────────┐
    │ Nibleaf App (:4310)      │                               │ Nibleaf App (:4310)      │
    │  - Dashboard & Admin     │                               │  - Custom domain rewrite │
    │  - Workspace routes      │                               │  - Resolves via API DB   │
    └────────────┬─────────────┘                               └─────────────┬────────────┘
                 │                                                           │
                 │ /api/* proxy                                              │ /api/public/*
                 ▼                                                           ▼
    ┌─────────────────────────────────────────────────────────────────────────────────────┐
    │                              Nibleaf API Server (:4311)                             │
    │             - resolveDomainHost: queries prisma.domain & project slugs              │
    └─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Local Domain Testing Setup

Run the automated helper script to configure local domains:

```bash
# Set up baseline test domains (.local) and verify database project linkage:
pnpm domains:setup

# View all active projects, default subdomains, and connected custom domains:
pnpm domains:list

# Add and verify a custom domain in the local database:
pnpm domains:add test.local docs

# Test domain resolution through the running Nibleaf server:
pnpm domains:test
```

### OS Hosts File Entries
Ensure your OS `hosts` file (`C:\Windows\System32\drivers\etc\hosts` on Windows or `/etc/hosts` on Linux/macOS) contains:

```text
127.0.0.1 nibleaf.local
127.0.0.1 app.nibleaf.local
127.0.0.1 docs.nibleaf.local
127.0.0.1 custom.local
```

---

## 2. Running Nginx

### Option A: Windows Native
Download Nginx for Windows (or use Chocolatey/Scoop: `choco install nginx` or `scoop install nginx`), then start it using this config:

```powershell
# Run from repository root:
nginx -p d:/07_Downloads/nibleaf-o/nginx -c nginx.conf

# Reload after config edits:
nginx -p d:/07_Downloads/nibleaf-o/nginx -s reload

# Stop:
nginx -p d:/07_Downloads/nibleaf-o/nginx -s stop
```

### Option B: Linux / macOS / WSL
Link or copy `conf.d/nibleaf.conf` to `/etc/nginx/conf.d/` and reload Nginx:

```bash
sudo ln -sf "$(pwd)/nginx/conf.d/nibleaf.conf" /etc/nginx/conf.d/nibleaf.conf
sudo nginx -t
sudo systemctl reload nginx
```

### Option C: Docker
```bash
docker run -d --name nibleaf-nginx \
  --network host \
  -v "$(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
  -v "$(pwd)/nginx/conf.d:/etc/nginx/conf.d:ro" \
  nginx:alpine
```

---

## 3. Verifying Routes

With Nibleaf dev servers running (`pnpm dev` or bun server + vite app):

| Route | Target | Description |
| :--- | :--- | :--- |
| `http://nibleaf.local/` | App Dashboard | Main dashboard / landing page |
| `http://app.nibleaf.local/` | App Dashboard | App dashboard |
| `http://docs.nibleaf.local/` | Documentation Site | Default subdomain mapped to project slug `docs` |
| `http://custom.local/` | Documentation Site | Custom domain verified in `prisma.domain` |
| `http://unknown.local/` | 404 | Unregistered domain returns `Published site not found.` |
