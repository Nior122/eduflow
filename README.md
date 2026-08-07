# EduFlow — AI-Powered School Management Platform

Next.js 15 school management platform with role-based portals for **School Admins, Teachers, Students, and Parents**, including AI-assisted lesson plans, report comments, homework help, and performance analysis.

## Tech Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict)
- **NextAuth v5** (beta) — credentials provider, bcrypt (12 rounds), JWT sessions
- **Prisma 5** + **PostgreSQL** (Neon-compatible)
- **Tailwind CSS** + Radix UI + shadcn-style components
- **zod** — server-side request validation

## Getting Started

```bash
npm install                  # runs prisma generate via postinstall
cp .env.example .env.local   # fill in DATABASE_URL (required), AUTH_SECRET, OPENAI_API_KEY (optional)
```

### Database

```bash
# First run — create the baseline migration, then apply it:
npx prisma migrate dev --name phase1_stabilization

# Or, without migrations history:
npm run db:push
```

### Seed (development only)

The seed **wipes all existing data** — it is disabled in production and requires explicit confirmation:

```bash
SEED_CONFIRM=yes npm run db:seed
```

Demo accounts (password `password123`): `admin@eduflow.com`, `teacher@eduflow.com`, `parent@eduflow.com`, `student@eduflow.com`.

### Run

```bash
npm run dev       # http://localhost:3000
```

## Verification Checklist (before deploying)

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # production build
npx prisma migrate deploy
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js lifecycle |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run db:push` | Push schema without migrations |
| `npm run db:migrate` | Create/apply migrations |
| `npm run db:seed` | Seed demo data (needs `SEED_CONFIRM=yes`, dev only) |
| `npm run db:studio` | Prisma Studio |

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ prod | `openssl rand -base64 32` |
| `AUTH_URL` | dev | `http://localhost:3000` |
| `OPENAI_API_KEY` | optional | AI features fall back to built-in answers without it |
| `OPENAI_MODEL` | optional | default `gpt-4o-mini` |
| `RESEND_API_KEY` | optional | Transactional email (password reset). Without it, reset links are returned by the API in dev mode |

## Features

- **Auth**: register school, login/logout, role-based page + API authorization (401/403), password reset via email token (or dev link)
- **Admin**: students (CRUD + search + pagination + one-time login credentials), teachers (CRUD + class/subject assignment), classes, subjects, announcements, fees (fee types + payment recording), reports (top students, weak subjects, finances, attendance trend), dashboard with real stats
- **Teacher**: attendance (save + prefill), results (save + prefill + term/session), AI lesson plans (generate + save + manage), AI report comments (generate + save + manage)
- **Student**: dashboard, AI homework assistant, performance analysis
- **Parent**: multi-child dashboard (results, attendance, fees)

## Notes

- AI routes are rate-limited (in-memory, per instance) — swap `src/lib/rate-limit.ts` for a shared store (e.g. Upstash Redis) before horizontal scaling.
- No files are uploaded yet; the UI renders user and AI content as escaped text (no `dangerouslySetInnerHTML`).
