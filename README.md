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

## Phase 4 — Examinations, Results & Report Card System

Complete academic assessment lifecycle (built on the Phase 1-3 base):

- **Examinations** — create/edit/activate/archive/duplicate per session + term, with class assignments
- **Assessment configuration** — school-defined components (Assignment 10% · Class Test 20% · Project 10% · Exam 60%) with per-term weight/max-score overrides (weights must total 100%)
- **Grade engine** — school-configurable percentage bands (default A=70+ … F<40), GPA + remark, band-gap safe (decimal totals)
- **Score entry** — spreadsheet grid for teachers, bulk upsert with validation (no negatives, no above-max, duplicates prevented by unique constraints), client-side totals preview, recalculate → weighted totals, grades, subject & class positions (standard competition ranking with tie handling)
- **Approval workflow** — Draft → Submitted → Approved → Published → Locked with full audit trail; publishing blocked while any result in the sheet is unapproved; role-gated actions (teachers submit, admins approve/publish/lock)
- **Report cards** — generate per class/term from published results; overall average, grade, class position, attendance %, promotion status, teacher/principal comments, signature & stamp placeholders, QR verification code; printable A4 layout (`/report-cards/[id]`)
- **Transcripts** — full academic history per student (every session × term, promotion & transfer history, attendance summary, graduation records)
- **Analytics** — class/school dashboards: averages, pass/fail rates, grade distribution, subject comparison, best/weakest subjects, term trends
- **Promotions** — suggestion engine (promote when average ≥ 50 with no failing subject), apply promote/repeat/graduate/transfer/archive with history
- **Role security** — teachers restricted to assigned classes/subjects; students & parents read-only; admins own the workflow

### Phase 4 verification
```bash
npx prisma validate            # schema valid (44 models)
npm run typecheck              # 0 TS errors
npm run build                  # production build passes
SEED_CONFIRM=yes npm run db:seed   # demo data incl. published results + report cards
```

New Phase 4 admin pages: Examinations · Assessment Config · Grade Scale · Results & Approval · Report Cards · Promotions · Analytics · Transcripts. Teacher: Score Entry (+ updated Results). Student/Parent: results + printable report cards.

## Phase 5 — Finance, Fees & Accounting System

Complete school financial management (built on the Phase 1-4 base):

- **Fee structure** — 14 built-in fee categories (Tuition, Admission, Books, Uniform, Development Levy, Transport, Hostel, Lab, Sports, Exam, Library, PTA, ICT, Graduation) + custom categories; fees support session, term, class/department scope, amount, due date, optional, recurring and late-fee flags
- **Student billing** — bulk invoice generation per class / department / whole school / selected students and fees; one invoice per student bundling items; duplicate prevention (open invoices block re-billing); manual draft invoices with issue/cancel workflow (paid invoices cannot be cancelled)
- **Payments** — cash / bank transfer / POS / mobile money / cheque with FIFO allocation across open invoices; partial payments supported; duplicate references rejected; overpayments blocked; balances recalculate automatically; cashier attribution
- **Receipts** — auto-generated numbered receipts (RCP-YYYY-####) with school header, method, cashier, outstanding balance, signature area and QR verification code; printable A4 page (`/receipts/[id]`) + verify endpoint
- **Discounts & scholarships** — percentage/fixed/waiver/scholarship/sibling/staff with student/class/school/fee scope; approval workflow (PENDING → APPROVED/REJECTED, becomes ACTIVE on first application); value validation (percent ≤ 100, fixed ≤ invoice total)
- **Outstanding & plans** — overdue auto-detection (past-due invoices flip to OVERDUE with LatePayment records + late-fee capture), defaulter list, reminder queue (mark SENT), installment payment plans with completion/cancellation
- **Financial reports** — daily/weekly/monthly/annual/custom revenue, outstanding, discounts summary, payment-method breakdown, monthly cash flow, revenue by class and department; CSV export for every report
- **Finance dashboard** — today/month revenue, outstanding, students owing, collection rate, overdue count, 12-month revenue chart, method breakdown, recent payments & receipts
- **Audit trail** — every financial action logged (who, what, when, old/new values, IP): fee/category CRUD, billing, payments, receipts, discounts, plans, reminders, gateway changes
- **Payment gateway architecture** — provider-agnostic abstraction (Paystack / Flutterwave / Stripe adapters behind one interface), per-school config with single-active enforcement, initialize/verify endpoints — no provider hardcoded, adapters refuse without keys
- **Finance role** — new `FINANCE_OFFICER` role with its own nav, API gates and dashboard; admins retain full access

### Phase 5 verification
```bash
npx prisma validate            # schema valid (57 models)
npm run typecheck              # 0 TS errors
npm run build                  # production build passes
SEED_CONFIRM=yes npm run db:seed   # demo finance data (14 categories, 6 invoices, payments, receipts, scholarship, plan)
```

New finance pages: Finance Dashboard · Billing & Invoices · Payments · Receipts (+ printable) · Discounts & Scholarships · Outstanding & Plans · Finance Reports (CSV) · Audit Log · Payment Gateways. Demo login: `finance@eduflow.com / password123`.
