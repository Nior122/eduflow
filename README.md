# EduFlow — AI-Powered School Management Platform

Next.js 15 school management platform with role-based portals for **School Admins, Teachers, Students, and Parents**, including AI-assisted lesson plans, report comments, homework help, and performance analysis.

## Tech Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict)
- **NextAuth v5** (beta) — credentials provider, bcrypt (12 rounds), JWT sessions
- **Prisma 5** + **PostgreSQL** (Neon-compatible) — 34 models
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
npx prisma migrate dev --name phase2_3

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
- **Admin**: students (full profile, CRUD, search, pagination, one-time credentials, status actions, timeline, import/export, ID card), teachers (department, staff ID, assignments), parents (multi-child linking), classes, subjects, departments, academic sessions/terms, classrooms, announcements, fees + payments, reports, school settings, dashboard
- **Teacher**: attendance (save/prefill/corrections/SICK), results, AI lesson plans + report comments, timetable, assignments + homework (with grading), daily dashboard
- **Student**: dashboard, AI homework assistant, performance analysis, assignments + homework (submit, track, feedback)
- **Parent**: multi-child dashboard (results, attendance, fees)

## Phase 2 — School Administration Module

- **Students**: full profile (blood group, religion, nationality, state/LGA, emergency contacts, previous school, medical notes, disabilities), auto admission numbers, status lifecycle (suspend/graduate/transfer/promote/reactivate) with timeline history, bulk CSV import (with auto credentials), CSV export, ID card, advanced filters + pagination.
- **Teachers**: staff ID, department, years of experience, salary grade, address; department heads.
- **Parents**: profiles with one-time credentials, multi-child linking.
- **Departments** (head teacher, subjects), **Academic Sessions** (activate/lock/archive) and **Terms** (single active term per school), **Classrooms** (capacity, room, class/assistant teacher), **School Settings** (identity, colors, currency, time zone, grade system, attendance rules).

## Phase 3 — Academic Operations Module

- **Timetable**: weekly scheduling with automatic conflict detection (class/teacher/room overlap → 409), per-day management, teacher weekly view.
- **Academic Calendar**: openings, closings, exams, sports, PTA meetings, holidays — shown on dashboards.
- **Assignments**: teacher CRUD, student submission (locked once graded), grading + feedback, submission tracking.
- **Homework**: same workflow with review scores and feedback.
- **Attendance**: SICK status, corrections, staff (teacher) attendance, per-student summaries with weekly/monthly/term ranges and CSV export.
- **Teacher daily dashboard**: today's classes from the timetable, pending attendance, grading queue, upcoming events.

## Notes

- AI routes are rate-limited (in-memory, per instance) — swap `src/lib/rate-limit.ts` for a shared store (e.g. Upstash Redis) before horizontal scaling.
- File attachments on assignments/homework are stored as URLs/text — a real upload endpoint (e.g. Vercel Blob) can be added without schema changes.
- No files are uploaded yet; the UI renders user and AI content as escaped text (no `dangerouslySetInnerHTML`).
