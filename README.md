# Changes History
LabPrima adalah projek laboratorium CV Prima Husada

# LabPrima

Monorepo: **React + Vite** (frontend) and **Node + Fastify + Prisma + PostgreSQL** (API).

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8 (`apps/web`) |
| API | Fastify 5 (`apps/api`) |
| ORM | Prisma 7 + PostgreSQL |
| DB (local) | PostgreSQL + pgAdmin (no Docker) |

## Prerequisites

- **Node.js** 22+ (24 recommended; see `mise.toml`)
- **PostgreSQL** installed locally
- **pgAdmin** (or any SQL client)
- **npm** 10+

## PostgreSQL + pgAdmin (local)

1. Install PostgreSQL for Windows if you have not already.
2. Open **pgAdmin** → connect to your local server (often `localhost`, user `postgres`).
3. Create a database, e.g. `labprima` (right‑click **Databases** → **Create** → **Database**).
4. Copy env and set your real password:

```sh
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/labprima?schema=public"
```

Use the same host, port, user, and database name as in pgAdmin.

## Quick start

### 1. Install dependencies

```sh
npm install
```

### 2. Migrate database & generate Prisma Client

```sh
npm run prisma:migrate
npm run prisma:generate
```

If prompted for a migration name, use `init`.

### 3. Run frontend + API

```sh
npm run dev
```

- Web: http://localhost:5173  
- API: http://localhost:3001  
- Vite proxies `/api/*` to the API server.

## Menjalankan web saja (frontend)

Jika Anda hanya ingin melihat layout UI LabPrima tanpa API/database:

### 1. Install dependencies (sekali)

Dari folder root proyek:

```sh
npm install
```

### 2. Jalankan dev server Vite

**Opsi A — dari root monorepo:**

```sh
npm run dev:web
```

**Opsi B — dari folder web:**

```sh
cd apps/web
npm run dev
```

### 3. Buka di browser

Buka **http://localhost:5173**

Anda akan melihat dashboard LabPrima dengan sidebar tetap (lebar 260px), header, dan halaman placeholder untuk setiap menu PRD.

### 4. Build production (opsional)

```sh
npm run build -w @labprima/web
npm run preview -w @labprima/web
```

Preview biasanya di **http://localhost:4173**.

### Struktur UI (`apps/web/src`)

| Folder / file | Fungsi |
|---------------|--------|
| `components/layout/` | Sidebar, header, shell aplikasi |
| `config/navigation.ts` | Menu sidebar sesuai PRD |
| `pages/DashboardPage.tsx` | Halaman dashboard (contoh metrik & kartu) |
| `styles/variables.css` | Warna & lebar sidebar |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | API + web in watch mode |
| `npm run dev:api` | API only |
| `npm run dev:web` | Web only |
| `npm run build` | Production build (api + web) |
| `npm run prisma:migrate` | Apply migrations (dev) |
| `npm run prisma:generate` | Regenerate Prisma Client |

## Project layout

```
apps/
  api/          # Fastify + Prisma
    prisma/
    src/
  web/          # React + Vite
```

## API routes (LabPrima)

- `GET /api/health` — health check
- `GET /api/dashboard` — metrik dashboard
- `GET|POST /api/pasien` — registrasi pasien
- `PATCH /api/pasien/:id` — kesan, status hasil & pembayaran
- `GET /api/radiolog/antrean` — antrean radiolog
- `GET|POST /api/dokter`, `/api/radiolog`, `/api/jenis-pemeriksaan`
- `GET|POST /api/harga-layanan`, `/api/kesan-template`, `/api/staff`

Setelah migrate, isi data demo:

```sh
npm run prisma:seed
```

## Git — auto commit & push

This repo is configured to **commit and push** after agent work:

- **Rule:** `.cursor/rules/auto-git.mdc` (agent commits when finishing a turn)
- **Hook:** `.cursor/hooks.json` → `stop` runs `.cursor/hooks/auto-sync.mjs`

Never commits `.env` or secrets. Restart Cursor once after cloning if hooks do not run (check **Hooks** in settings).

## Troubleshooting

**API / DB connection errors** — check Postgres is running, database exists in pgAdmin, and `DATABASE_URL` in `apps/api/.env` matches your login.

**Prisma migrate fails** — create the empty database in pgAdmin first, then run `npm run prisma:migrate` again.

**Node version** — if you use Mise: `mise install` then `mise trust`.
