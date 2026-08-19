# EduFlow — Demo Environment (docs/DEMO.md)

This document describes the **isolated demo tenant** ("EduFlow Demo
Academy") that lets you test every portal, role and AI feature with real,
meaningful data — **without touching any real customer tenant**.

## Why a dedicated demo seed?

- The original seed (`prisma/seed.ts`) **wipes the entire database** and is
  disabled in production. It cannot be run against a database that already
  has real schools.
- `prisma/seed-demo.ts` creates a **separate, clearly identifiable demo
  school** and only ever deletes/recreates **that school's own records**.
  It is safe to run repeatedly, even against a populated production
  database, and requires explicit `SEED_CONFIRM=yes`.

## Run it

```bash
# 1. Environment (template now ships with the repo)
cp .env.example .env.local      # fill in DATABASE_URL + AUTH_SECRET (+ at least one AI key)

# 2. Migrate (first run)
npx prisma migrate deploy       # or: npm run db:push

# 3. Seed the demo tenant (idempotent — safe to re-run)
SEED_CONFIRM=yes npm run db:seed-demo

# optional: override the demo password
SEED_CONFIRM=yes DEMO_SEED_PASSWORD="SomethingStrong123!" npm run db:seed-demo
```

## Demo accounts

All accounts share one demo password (default `EduflowDemo#2026`, set via
`DEMO_SEED_PASSWORD` or `.env` — **never** stored in frontend code; the
seed prints it at the end of the run).

| Portal | Email | What you can test |
|---|---|---|
| Admin | `demo.admin@eduflow.demo` | Dashboard, students, teachers, classes, attendance, results, finance, reports, AI settings, AI analytics |
| Teacher | `demo.teacher@eduflow.demo` | Dashboard, assigned classes, timetable, attendance, assignments, homework, results, AI lesson planner |
| Parent | `demo.parent@eduflow.demo` | Child profile, attendance, results, report card, fees, payments, assignments, announcements, messages |
| Student | `demo.student@eduflow.demo` | Timetable, homework, results, report card, announcements |
| Finance | `demo.finance@eduflow.demo` | Invoices, payments, receipts, discounts, payment plans |

## What the demo tenant contains

- **Tenant**: "EduFlow Demo Academy" (slug `eduflow-demo-academy`), fully
  isolated — every row is scoped to this school id.
- **40 students** across Primary 1–6 + JSS 1–3 (realistic Nigerian names,
  admission numbers `EUF/2026/0001…`).
- **9 teachers**, 9 subjects (incl. the 8 required), full class-subject and
  teacher assignments, classrooms, departments, and a **conflict-free
  timetable** (5 days × 4 periods per class).
- **Attendance**: 30 school days × all 40 students with a realistic
  PRESENT / ABSENT / LATE / EXCUSED mix, including deliberately irregular
  attendees.
- **Results**: FIRST-term scores + computed results + positions + approval
  trail + **published report cards for all 40 students**, plus SECOND/THIRD
  term history. Performance profiles are deliberately varied
  (high / average / struggling / improving / declining / irregular) so the
  AI performance analyser and risk analysis have meaningful input.
- **Finance**: 6 fees across 9 categories, invoices for every student,
  fully-paid / partially-paid / outstanding balances, 3 approved
  scholarships, 1 sibling discount, payment plans, fee records with
  PAID / PARTIAL / PENDING / OVERDUE mix.
- **Assignments & homework** with graded submissions; announcements
  (meeting, mid-term exam, holiday, fee reminder, performance notice);
  messages; notifications; documents; knowledge-base documents.
- **AI defaults**: `AiSetting` row + all system prompt templates + 2 KB
  documents, so AI features are ready the moment a provider key is set.

## Verification checklist

After seeding and starting the app (`npm run dev`), verify each item:

1. Login as **demo.admin** → dashboard → students (40) → teachers (9) →
   classes (9) → attendance → results → fees → AI lesson planner.
2. Login as **demo.teacher** → dashboard → assigned classes → timetable →
   take attendance → enter/view results → generate an AI lesson plan.
3. Login as **demo.parent** → view child → attendance → results → report
   card → fees → assignments → announcements.
4. Login as **demo.student** → timetable → homework → results → report card.
5. AI: with at least one provider key set (e.g. `OPENAI_API_KEY`), the
   lesson planner and other AI modules return real responses. Without any
   key, they return a clean JSON error ("AI provider is not configured")
   — never an empty body / "Unexpected end of JSON input".

## Notes

- The demo seed is intentionally **non-destructive to other tenants**: the
  scoped wipe only ever deletes rows belonging to `eduflow-demo-academy`.
- Re-running the seed refreshes the demo tenant to the exact state above.
- To remove the demo tenant entirely, delete the school row (slug
  `eduflow-demo-academy`); its records are child rows and will be removed
  by the same scoped wipe on the next run.
