# EduFlow — Comprehensive Technical Audit Report (Phase 0)

**Repo:** https://github.com/Nior122/eduflow · **Audited:** 2026-08-07
**Method:** 100% static source analysis (all 72 TS/TSX files, Prisma schema, seed, configs; greps for cross-cutting evidence). No Node runtime available in the audit sandbox — nothing was built/run; runtime-dependent items are marked ⚠️.
**Deliverables:** this report · notebook with reproducible evidence cell · prioritized roadmap · master checklist · Phase 1 plan.

---

## 1 · Executive Summary

EduFlow is a **Next.js 15 + React 19 + TypeScript (strict) + Prisma (PostgreSQL) + NextAuth v5 (beta, credentials/JWT)** school-management platform: 4 role portals (admin/teacher/student/parent), 20 API route files, 19 pages, 22 Prisma models, shadcn/Radix UI kit. The **UI layer is polished and the data model is coherent**; the gap is integration depth — roughly half the features are unwired, unauthorized, or decorated with hardcoded numbers.

**Working (verified):** login/logout, registration (school + admin), role-gated *page* routing, student create/search/soft-delete, teacher/class/fee-type/announcement create, attendance + results save, 4 dashboards with real aggregates, AI homework chat, lesson-plan & report-comment generation (no persistence), performance-analysis API (no UI).

**Broken/fake (headline):** no role-based authorization on ANY API route (a student can create teachers, post fees, save results); committed `.env.local.bak` with real-looking DATABASE_URL/AUTH_SECRET; dead student Edit/View buttons; dead "Save Lesson Plan" button; toast-only "Save" on report comments; simulated password reset; hardcoded 72% fee collection & dashboard trends; `weakSubjects = 0 // Placeholder`; 8 of 22 models never queried, 10 with no write path; no Prisma migrations; zod `validations.ts` entirely dead code.

**Overall Health: 47/100 — a visually complete prototype, not yet a stable foundation.**

## 2 · Health Scores

| Area | Score | Basis |
|---|---|---|
| Frontend | 58 | Real data on most pages; dead buttons, hardcoded stats, missing edit flows |
| Backend | 42 | All routes exist + hit Prisma; no role checks, no validation, no rate limiting, placeholders |
| Database | 48 | Coherent relations; no migrations, 8 dead tables, destructive seed, string-enum drift |
| Authentication | 62 | Solid credentials+JWT, typed session, page middleware; no reset, no account provisioning |
| Security | 32 | Committed secrets, API privilege escalation, mass assignment, open registration |
| Performance | 55 | Parallel queries where it matters; all-client components, no pagination UI, arbitrary caps |
| Code Quality | 55 | Strict TS, clean structure, zero TODOs; 15 unused deps, duplicated logic, no tests |
| Deployment Readiness | 28 | No migrations/CI/README/Dockerfile; env drift; next-auth beta |

## 3 · Key Findings (with file references)

### CRITICAL
1. **C1 — Secrets committed:** `.env.local.bak` is git-tracked (`.gitignore` misses `*.bak`); contains real-looking `DATABASE_URL` (69 chars) and `AUTH_SECRET` (51 chars). Rotate + scrub.
2. **C2 — API privilege escalation:** every route authorizes on `session?.user?.schoolId` presence only; middleware gates only page paths, not `/api/*` roles. Any authenticated role can call every admin endpoint (`src/middleware.ts`, all `src/app/api/**/route.ts`).
3. **C3 — Mass assignment / no validation:** mutating routes do `data: {...body}`; `src/lib/validations.ts` (zod) is never imported anywhere (grep-verified). Attackers can inject `parentId`, `userId`, `isActive`, etc.
4. **C4 — No password reset:** `src/app/forgot-password/page.tsx` simulates a 1.5 s send; no backend, no email.
5. **C5 — Unauthenticated/unthrottled AI endpoints:** `api/ai/homework-assistant|lesson-plan|report-comment` have no `auth()` call (middleware-only) and no rate limiting; `/api/register` is open + unlimited.

### HIGH
- **H1** Dead View/Edit buttons on students (`admin/students/page.tsx`); PATCH/GET-by-id exist but are never called.
- **H2** `PATCH /api/admin/students/[id]` returns `{student: {count}}` (updateMany result, not the row).
- **H3** "Save Lesson Plan" has no onClick; `LessonPlan` model never written (`teacher/lesson-plans/page.tsx`).
- **H4** Report-comment "Save" is toast-only; `AIReportComment` never written (`teacher/report-comments/page.tsx`).
- **H5** Created students/teachers/parents can never log in — no User/password provisioning anywhere (seed is the only account source).
- **H6** No teacher→class/subject assignment UI/API; `ClassSubject` is seed-only → teacher dashboards empty for real schools.
- **H7** No edit/delete for classes/fees/teachers/announcements; no admin subjects page (API exists).
- **H8** Fee money flow read-only: `Payment`/`FeeRecord` have no create path; "Total Fees" = amount×records; 72% hardcoded.
- **H9** No `prisma/migrations/`; `seed.ts` wipes all 22 tables (destructive).
- **H10** Grading diverges in 3 places: API (`api/results/route.ts`), `utils.calculateGrade`, and the results page client logic.

### MEDIUM
M1 attendance deleteMany `{subjectId: undefined}` wipes all class/date rows (Prisma ignores undefined) · M2 parent dashboard shows only `children[0]` · M3 results/attendance never prefill (GET routes unused) · M4 register non-transactional, no confirm-password server-side · M5 duplicate admission/email → 500 instead of 409 · M6 anonymous API calls get HTML redirect, not 401 JSON · M7 string fields (Announcement.priority/audience, Notification.type) vs zod enums · M8 30-day JWT, `AUTH_URL=localhost` in example, demo creds public · M9 Attendance unique w/ nullable subjectId (NULL-distinct duplicates) · M10 raw `**markdown**` shown in homework chat.

### LOW
L1 icon buttons lack aria-labels; `confirm()` delete · L2 dead imports (Settings, Trash2, Eye/Pencil, MessageSquare, UserCheck) · L3 stale `prisma/fix-user.txt` (diverges from schema) · L4 duplicated fallbacks client+server ×4 · L5 "Recent Activity" is announcements; dashboard "chart" is a number (recharts unused) · L6 `@vercel/blob` unused; image hosts `**` permissive.

## 4 · Placeholder / Fake Inventory
reports API `weakSubjects = 0 // Placeholder` + `trend: 3` · fees page `72%` · dashboard trends 12/8/3/5 + `+5.2% avg` · forgot-password setTimeout simulation · report-comment toast-only save · lesson-plan dead Save + demo fallback · homework keyword fallback · student "Performance Analysis" dead card · admin "Recent Activity" = announcements · reports page "charts will appear here" · seed demo `password123` · landing marketing stats · committed artifacts (`fix-user.txt`, `.env.local.bak`) · `validations.ts` dead.

## 5 · Database Audit (22 models)
**Used:** User, School, Student, Teacher, Class, Subject, ClassSubject, Attendance, Result, Fee, FeeRecord (read-only), Announcement, PerformanceAnalysis.
**Never queried (dead):** Account, Session, VerificationToken (adapter unused w/ JWT), Payment, Notification, Message, LessonPlan, AIReportComment.
**No write path:** + Parent, FeeRecord (seed-only writes).
**Issues:** no migrations; destructive seed; nullable-subjectId unique; string enums; no onDelete on school children; register creates orphan schools on failure.

## 6 · Security & Auth Audit
Positives: bcrypt(12), JWT strategy, typed sessions, CSRF via NextAuth, React-escaped output, no raw SQL. Negatives: C1–C5 above; no email verification; no password change; demo creds on login page; AUTH_URL localhost; no logging/observability.

## 7 · Deployment Readiness
No migrations · no CI/Dockerfile/vercel.json · no README · no error boundaries · `.env.example` documents 2 unused vars and only a placeholder AUTH_SECRET · next-auth 5.0.0-beta.25 on Next 15.1 ⚠️ · positives: postinstall prisma generate, OpenAI-key-optional fallbacks, Neon-ready DATABASE_URL example.

## 8 · Prioritized Roadmap
R1 secrets rotation (S) · R2 role guard + 403s (M) · R3 zod server-side (M) · R4 migrations + safe seed (M) · R5 student edit/view + PATCH fix (M) · R6 CRUD completion + subjects + assignments (L) · R7 persist AI outputs (M) · R8 account provisioning (L) · R9 payment flow (L) · R10 real reset or honest disable (M) · R11 rate limiting (M) · R12 remove placeholders/dead code (M) · R13 401 JSON contract (S) · R14 attendance/parent fixes (M) · R15 unified grading + prefill (M) · R16 error boundaries + README (S) · R17 tests (L) · R18 chat markdown (S).
*(Full detail incl. files/root-cause/complexity/dependencies in the notebook; S=5, M=8, L=5 tasks.)*

## 9 · Phase 1 Plan (not started — awaiting approval)
M0 incident response (secrets) → M1 authz+validation → M2 DB safety → M3 CRUD completion → M4 persistence wiring → M5 truthful numbers → M6 hardening (reset, rate limits, error pages, README, tests). Est. 2–3 weeks, one senior engineer. No new features — connects, validates, stabilizes.

## 10 · Master Checklist
☐ secrets scrubbed & rotated ☐ 403 on wrong-role API calls ☐ 401 JSON for anonymous API ☐ reset works or is disabled ☐ provisioned accounts for created people ☐ student create/list/search/view/edit/delete/pagination ☐ teacher create/edit/delete/assignment ☐ class/subject CRUD ☐ attendance save+prefill+per-subject ☐ results save+prefill+consistent grades ☐ fees + payments + real stats ☐ announcements audience delivery + edit/delete ☐ AI: generate+save+list ×3, analyze reachable, auth+rate-limited ☐ dashboards real numbers ☐ migrations + safe seed ☐ zod enforced ☐ unused deps/imports removed ☐ error/not-found pages ☐ README ☐ tests green ☐ `next build` + `prisma generate` pass ⚠️
