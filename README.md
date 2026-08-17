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


## Phase 6 — Portals & Communication System

Everything in Phase 6 uses the production database and the same role-guarded
API patterns as earlier phases. New in this phase:

| Module | Where |
|---|---|
| **Parent Portal** | `/parent/*` — My Children, Attendance, Timetable, School Work (assignments + homework status), Results, Report Cards, Fees & Receipts (printable), Calendar, Announcements, Documents, Messages |
| **Student Portal** | `/student/*` — My Timetable, Attendance, Assignments/Homework (submit + track), Results, Report Cards, Transcript, Calendar, Homework Help, Announcements, Documents, Messages |
| **Enhanced Teacher Portal** | Dashboard now shows Today's Classes, pending attendance/grading, upcoming events, **recent messages** and **unread notifications**; full messaging with parents/students/admins |
| **Messaging** | `/messages` — Inbox / Sent / Drafts, conversation threads, read receipts, attachments, search, soft-delete, role-scoped recipient directory (Admin<->Teacher, Admin<->Parent, Teacher<->Parent, Teacher<->Student) |
| **Notification Center** | Bell drawer in the top bar (60s polling) + `/notifications` page + per-user preferences (email / SMS / push / in-app toggles, language, theme, 2FA-ready flag) at `/profile` |
| **Announcements** | `/announcements` (all roles) + `/admin/announcements` (manage) — role / class / department targeting, priority, pinning, expiry dates, automatic fan-out to recipients' notification centers |
| **School Documents** | `/documents` — handbooks, policies, timetables, study materials, forms, circulars, past questions; category filter + search; upload by teachers/admins; audience-based visibility (Everyone / Teachers / Parents / Students / Staff) |
| **Profile & Settings** | `/profile` — avatar upload, name/phone, password change (bcrypt 12), notification preferences, theme & language, 2FA status (architecture ready) |
| **Activity Timeline** | `/activity` — login, messages, announcements, documents, profile & password changes, preferences; paginated per user |

### Storage
Uploads (documents, message attachments, avatars) are stored locally under
`public/uploads/<school>/...` and served statically. For serverless or
multi-instance deploys, replace `src/lib/uploads.ts` with S3/R2 (the return
shape stays the same). Files are validated (10 MB cap, extension allowlist).

### Realtime
The notification drawer polls `/api/notifications` every 60 seconds — a
deliberate self-host-friendly default. The notification creation path is
centralised in `src/lib/notifications.ts` (`notifyUser` / `logActivity` /
`fanOutAnnouncement`), so swapping polling for SSE/WebSockets touches one
component.

### Database (Phase 6)
New models: `SchoolDocument`, `UserPreference`, `UserActivityLog`.
Extended: `Message` (conversations, drafts, soft-delete, attachments,
replies, read receipts), `Announcement` (pinned, expiresAt, class &
department targets), `Notification` (readAt, schoolId).

```bash
npx prisma migrate dev --name phase6_portals_communication
# or: npm run db:push
npm run db:seed   # SEED_CONFIRM=yes (wipes data; seeds Phase 6 demo docs/messages/notifications)
```

### Verification (run locally)
```bash
npm run typecheck   # tsc --noEmit — after `npm install` regenerates the Prisma client
npm run lint
npm run build
npx prisma migrate deploy
```


## Phase 7 — EduFlow AI: Intelligent Automation & AI Assistant

EduFlow AI is a provider-agnostic AI layer covering all 12 modules. Every
endpoint uses the production database, logs usage and respects role
permissions. Keys live in environment variables only — nothing secret is
stored in the database or exposed to clients.

### Provider abstraction (`src/lib/ai/providers.ts`)
OpenAI, Anthropic, Google Gemini, Groq, OpenRouter, GitHub Models and
Cloudflare AI — selected in **Admin → AI Settings**, configuration-only
change. Includes: streaming (SSE), tool calling, retry on 429/5xx,
automatic fallback to the next configured provider, and a per-model cost
table. Set at least one key in the environment (see `.env.example`).

### The 12 modules

| # | Module | Where |
|---|--------|-------|
| 1 | **AI School Assistant** — app-wide chat widget with tool calling against the real DB (poor attendance, fee debtors, failing students, today's timetable, announcements, class performance, student progress, homework stats, admin announcement creation) | floating widget on every page + `/api/ai/chat` (SSE) |
| 2 | **AI Lesson Planner** — full lesson note with objectives, materials, activities, assessment, homework, extension activities | `/teacher/lesson-plans` → `/api/ai/lesson-plan` |
| 3 | **AI Report Comment Generator** — personalized comments from real student data; never repeats previous comments | `/teacher/report-comments` → `/api/ai/report-comment` |
| 4 | **AI Performance Analyzer** — real metrics + AI strengths/weak subjects/improvement plan | `/student/ai-performance`, `/parent/ai-performance` |
| 5 | **AI Homework Assistant** — streaming tutor with hints (never just answers) | `/student/homework-assistant` |
| 6 | **AI Question Generator** — MCQ/theory/T-F/fill-blank/matching/practical, saved to the question bank, export Word/PDF/JSON | `/teacher/ai-questions` |
| 7 | **AI Exam Generator** — instructions, sections, marking scheme, answer key, difficulty + Bloom coverage, printable | `/teacher/ai-exams` (+ print view) |
| 8 | **AI Student Risk Prediction** — deterministic risk score (attendance 30%, academics 40%, homework 20%, behaviour 10%) + AI interventions, saved to the student profile | `/teacher/ai-risk` |
| 9 | **AI Parent Communication** — drafts from real data, editable, delivered via the messaging system + notification | `/teacher/ai-communication` |
| 10 | **AI School Analytics** — subject difficulty, teacher performance, attendance & fee trends, at-risk students, class/department comparisons + executive summary | `/admin/ai-analytics` |
| 11 | **AI Document Assistant** — PDF/Word/Excel/text upload, summarize or ask questions about the document (SSE) | `/ai-documents` |
| 12 | **AI Knowledge Base (RAG)** — approved school documents, chunked + keyword retrieval with source citations | `/admin/ai-knowledge-base` + query endpoint |

### Platform features
- **Prompt management** — `/admin/ai-prompts`: every prompt is a DB template
  (system defaults seeded; create/edit/version/deactivate + dry-run test).
- **Usage & cost control** — `/admin/ai-usage`: tokens, cost (per-model
  pricing), per module/user, monthly budget cap enforced per request.
- **AI settings** — `/admin/ai-settings`: provider, model, temperature,
  max tokens, streaming toggle, module on/off, fallback, budget + a
  "test connection" button.
- **Security** — school-scoped data, role-guarded routes, prompt
  sanitization + injection guard, rate limiting (per-user/hour), keys in
  env only, all requests logged (success + error).
- **Conversation memory** — the assistant persists conversations per user
  (history, title, continue/regenerate).

### Local verification
```bash
npm install            # includes pdf-parse, mammoth, xlsx for document parsing
npx prisma migrate dev --name phase7_ai   # or npm run db:push
SEED_CONFIRM=yes npm run db:seed          # seeds AI settings + system prompts + KB demo doc
npm run typecheck && npm run lint && npm run build
```
Smoke test: login → open the AI assistant (bottom-right) → ask "How many
students owe fees?" → confirm the tool result; Teacher → AI Questions →
generate a set; Admin → AI Settings → Test connection.


---

## Phase 9 — Multi-Tenant SaaS Platform

EduFlow is now a commercial multi-tenant SaaS:

- **Tenant isolation** — every school is a tenant; all queries are school-scoped
  (`src/lib/saas/tenant.ts`, `apiGuard`), and the middleware injects an
  `x-tenant-id` header derived from the session. The isolation test suite is in
  `scripts/verify-tenant-isolation.sh` (run it against a live instance).
- **School onboarding** — registration creates a school + trial subscription;
  a 6-step wizard (`/onboarding`) walks admins through setup.
- **Subscriptions & billing** — 4 plans (Starter/Professional/Business/
  Enterprise) with per-plan limits (students, teachers, storage, AI tokens,
  API calls) and module licensing. Provider abstraction supports **Stripe,
  Paystack and Flutterwave** (fetch-based REST, no SDKs) with verified
  webhooks, invoices, coupons, trials, proration notes and payment-failure
  alerts. See `docs/BILLING.md`.
- **Feature flags** — plan defaults + per-school overrides
  (`Admin → Features`); enforcement in `apiGuard({ feature })`.
- **Usage metering** — `UsageRecord` counters per school/month; student and
  teacher creation is plan-limited; uploads are storage-quota-limited.
- **Super admin portal** — `/superadmin`: platform KPIs, school management
  (suspend/activate, plan changes), plans, coupons, support tickets, audit
  log, backups, platform settings (maintenance mode, registration pause).
- **API v1** — versioned REST API (`/api/v1/*`) with API-key auth
  (`Admin → API Keys`), rate limiting, pagination/filtering/sorting, an
  OpenAPI spec at `/api/v1/openapi.json`, and signed outbound webhooks
  (`Admin → Webhooks`) with retry.
- **Ops** — `/api/health` + `/api/health/ready`, daily cron
  (`/api/cron/daily`, Vercel cron), structured JSON logging, audit trail,
  backup jobs (`scripts/backup.ts` + restore), GitHub Actions CI, security
  headers + CSP, rate-limited login.

### Phase 9 setup (after `npm install`)

```bash
cp .env.example .env.local     # add CRON_SECRET + billing/storage keys
npm run db:push                # or: npx prisma migrate dev --name phase9
SEED_CONFIRM=yes npm run db:seed   # demo data + superadmin@eduflow.app / password123
npm run typecheck && npm run lint && npm test
npm run dev                    # → /superadmin (platform) · /admin/subscription (school)
```

Demo accounts: `admin@eduflow.com` (school admin), `superadmin@eduflow.app`
(platform owner) — password `password123`.

New in Phase 9 (files): `src/lib/saas/*` (tenant guard, features, usage,
logger, audit, billing/email/storage providers), `src/app/superadmin/*`,
`src/app/api/v1/*`, `src/app/api/billing/*`, `src/app/api/onboarding/*`,
`src/app/onboarding/*`, `scripts/backup.ts`, `scripts/restore.sh`,
`scripts/verify-tenant-isolation.sh`, `vercel.json`, `.github/workflows/ci.yml`,
`docs/*`. See `docs/ARCHITECTURE.md` and `docs/QA.md` for details.

### Deploying against an existing database (auto-baseline)

If your Neon/Postgres database was created with `npm run db:push` it has
**no migration history**, and `prisma migrate deploy` refuses to run
against a non-empty schema (error **P3005**). The build script
(`scripts/migrate-deploy.mjs`) handles this automatically on the first
deploy: it generates a `0_init` baseline from the current schema, records
it and the pre-existing migrations as applied (`migrate resolve`),
reconciles any drift with a non-destructive `prisma db push`, then
deploys. Afterwards the database has a real migration history and
subsequent builds are plain `migrate deploy`.

> Fail-safe: the reconcile step (`db push`) never passes
> `--accept-data-loss`; if the current schema would require a destructive
> change the build fails loudly and you decide how to proceed.

For a **fresh** database (empty), run `npx prisma migrate dev --name init`
once to create the history, or use `npm run db:push`.

