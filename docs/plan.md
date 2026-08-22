# Digital Maturity Assessment Tool — Implementation Plan

**Project:** Developing a Digital Maturity Model in the Apparel Industry — web tool
**Target host:** Vercel
**Source of truth for content:** [`docs/requirements-extract.md`](requirements-extract.md)

---

## 0. How to use this plan (READ THIS FIRST)

This plan is written to be executed **one task at a time**, by an agent that may have no other
context. If you are that agent, follow these rules exactly:

1. **Find the next pending task.** Scan the Task Board in §8 from the top. The next task to do is
   the first one whose status is `[ ]`. Ignore everything below it.
2. **Check its dependencies.** If a task lists `Depends on:` and any of those are not `[x]`, stop
   and do the earliest unmet dependency instead.
3. **Implement only that one task.** Do not start the next one. Do not "helpfully" build ahead.
   Scope creep here breaks the plan for the next run.
4. **Create exactly the files listed** under `Files:`. Paths are relative to the repo root.
5. **Meet every bullet under `Acceptance:`.**
6. **Run the `Verify:` command(s).** They must pass. If they fail, fix your own work until they
   pass — do not edit the verify command, and do not move on.
7. **Run the Definition of Done checks** (§0.1) — every task, no exceptions.
8. **Mark the task `[x]`** in the Task Board *and* in the task's own `**Status:**` line, then add
   a one-line note under `**Notes:**` if you deviated from the plan or discovered something the
   next task needs to know.
9. **Commit** with the message `feat(T-0XX): <task title>` (or `chore(...)` / `test(...)` where
   that fits better). One commit per task.
10. **Then stop and report** what you did.

### 0.1 Definition of Done — applies to every task

After the task-specific `Verify:` passes, all of these must also pass (skip only the ones whose
tooling does not exist yet — i.e. before T-002):

```bash
npx tsc --noEmit          # no type errors
npm run lint              # no lint errors
npm test -- --run         # all unit tests pass
npm run build             # production build succeeds
```

Plus:

- No `any`, no `@ts-ignore`, no `eslint-disable` unless you write a one-line comment saying why.
- No secrets, API keys, or personal data committed.
- No new runtime dependency that isn't listed in this plan without noting it under `**Notes:**`.
- Every user-facing string comes from `conf.yaml` or a UI copy constant — **never hardcode
  questionnaire content in a component**.

### 0.2 Rules that hold for the whole project

- **`conf.yaml` is the only place questionnaire content lives.** Questions, statements, tiers,
  weights, maturity bands, and recommendations are all data. If you find yourself typing a
  question into a `.tsx` file, you are doing it wrong.
- **The scoring engine is pure.** `src/lib/scoring/*` must not import React, Next.js, `fs`, or
  anything browser-specific. It takes data in, returns data out. That is what makes it testable.
- **British spelling in user-facing content** (`organisation`, `optimised`, `visualisation`) to
  match the source document. Code identifiers stay in plain ASCII English.
- **No user accounts, no login, no survey retrieval.** This is explicit in the requirements:
  *"users might not able to retrieve a previously done survey"*. Do not build auth.
- **Accessibility is not a later phase.** Every interactive element gets a label, keyboard access,
  and a visible focus ring as it is built.
- **Task IDs are stable identifiers, not execution order.** The Task Board in §8 defines the order.
  Admin tasks (T-029…T-035) were added after the rest was written, so the IDs are not strictly
  ascending as you read down the board. **Always go by board position, never by number.**
- **Admin surfaces are deny-by-default.** Anything under `/admin` or `/api/admin` must be
  unreachable without a valid admin session, and must be gated in *two* places — the middleware
  *and* the route or page itself.
- **Respondent data is personal data.** Names, designations and free text leave the server only
  through an authenticated admin route. Never log it, never put it in an error message, never
  return it from a public endpoint.

---

## 1. What we are building (one paragraph)

A public, no-login web app where an apparel-industry respondent starts a survey from the landing
page, fills in some background information, then answers 7 factor questions one at a time
(each a choice of 5 statements). At the end they review their answers, see a computed digital
maturity score and level, see prioritised recommendations for improvement, and can download the
whole thing as a PDF. Submissions are stored server-side as JSON for the researcher. A second,
static page explains the theory behind the model.

---

## 2. Functional requirements (traced to source)

| # | Requirement | Source |
|---|---|---|
| FR-1 | Landing page from which the user starts the survey | p1 |
| FR-2 | A second, static page explaining the theory behind the model | p1 |
| FR-3 | Questions, tiers and weights fully configurable via `conf.yaml` | p1 |
| FR-4 | Questions presented **one after another**, interactively | p1 |
| FR-5 | After completion, user can review the answers they submitted | p1 |
| FR-6 | Final score shown | p1, p7 |
| FR-7 | Recommendations to improve digital maturity shown | p1 |
| FR-8 | Results + recommendations downloadable as PDF | p1 |
| FR-9 | Submission data stored as JSON | p1 |
| FR-10 | No retrieval of a previously completed survey | p1 |
| FR-11 | Collect General Information (name, designation, experience, qualification) | p2 |
| FR-12 | Score maps to a named maturity level (1–5) | p7, pyramid figure |
| FR-13 | Deployed on Vercel | p1 |
| FR-14 | Admin must authenticate before reaching any admin surface | added 2026-08-22 |
| FR-15 | Admin can list and view every submission, with summary statistics | added 2026-08-22 |
| FR-16 | Admin can export all submissions as CSV and as JSON | added 2026-08-22 |
| FR-17 | Respondents cannot reach admin surfaces, or any other respondent's data | added 2026-08-22 |

Non-functional:

| # | Requirement |
|---|---|
| NFR-1 | Works on mobile and desktop; no horizontal page scroll |
| NFR-2 | WCAG 2.1 AA: keyboard operable, labelled controls, ≥4.5:1 text contrast, light + dark |
| NFR-3 | Scoring engine covered by unit tests, including exact worked examples |
| NFR-4 | Changing `conf.yaml` alone can add/remove a factor or a whole tier, with **no code change** |
| NFR-5 | Survey progress survives an accidental page refresh (sessionStorage), but is not retrievable later |
| NFR-6 | Admin access is deny-by-default and gated twice: in middleware **and** in the route/page itself |
| NFR-7 | Export streams — memory stays flat regardless of how many submissions exist |

---

## 3. The scoring model — exact specification

This is the heart of the product. Implement it exactly as written.

### 3.1 Structure

```
Tier 1 "Organisational Enablers"   weight w1 = 0.7
  ├─ Leadership              i1 = 0.383
  ├─ Strategy & Governance   i2 = 0.367
  ├─ People & Culture        i3 = 0.190
  └─ Technology              i4 = 0.060      Σ = 1.000

Tier 2 "Core Operations"           weight w2 = 0.3
  ├─ Research                l1 = 0.40
  ├─ Design                  l2 = 0.23
  └─ Development             l3 = 0.37       Σ = 1.00

w1 + w2 = 1.0
```

### 3.2 Formula

Each answer `a_f` is an integer 1–5.

```
tier1Score = Σ over Tier-1 factors ( i_f × a_f )        → range [1, 5]
tier2Score = Σ over Tier-2 factors ( l_f × a_f )        → range [1, 5]

overallScore = w1 × tier1Score + w2 × tier2Score        → range [1, 5]
```

Because factor weights within a tier sum to 1, and tier weights sum to 1, the overall score is
always in `[1, 5]`. **Assert this in the engine** (`throw` on violation) — it catches bad config.

> **Note on the diagram.** `docs/assets/model-diagram.png` draws a ⊕ after Tier 1 and a ⊗ after
> Tier 2, which could be read as multiplication. Multiplication is rejected: it would make the
> result range `[0.7, 3.5]·[0.3, 1.5]`, the stated `w1 + w2 = 1` constraint would be meaningless,
> and the output could not map onto the 1–5 pyramid. **A weighted sum is the implemented model.**
> The formula is nevertheless selected by `scoring.formula: weighted_sum` in `conf.yaml`, so an
> alternative can be added later without a rewrite. See Open Decision OD-1 (§7).

### 3.3 Rounding

- Keep full precision internally.
- Display `overallScore`, `tier1Score`, `tier2Score` to **2 decimal places**.
- Band selection uses the **unrounded** score. (Round-then-band causes off-by-one at edges.)

### 3.4 Level bands

| Band | Score range (inclusive lower, exclusive upper, last band inclusive) | Level |
|---|---|---|
| 1 | 1.00 ≤ s < 1.80 | Initial |
| 2 | 1.80 ≤ s < 2.60 | Emerging |
| 3 | 2.60 ≤ s < 3.40 | Developing |
| 4 | 3.40 ≤ s < 4.20 | Established |
| 5 | 4.20 ≤ s ≤ 5.00 | Optimised |

Equal-width bands over `[1, 5]`. **These thresholds are an assumption** — see OD-2 (§7). They live
in `conf.yaml` and can be changed without touching code.

### 3.5 Recommendation priority

For every factor the user did **not** answer 5, emit a recommendation. Rank them by impact:

```
impact_f = tierWeight(f) × factorWeight(f) × (5 − a_f)
```

Sort descending by `impact_f`; ties break by tier order then factor order in `conf.yaml`. This
makes "fix Leadership" outrank "fix Technology" at the same gap, which is correct — Leadership
carries 0.383 of a 0.7 tier, Technology 0.060 of the same tier.

The recommendation *text* for factor `f` at answer `a_f` is `factors[f].recommendations[a_f]` in
`conf.yaml` — i.e. "here is how to get from where you are to the next level". Answer 5 maps to a
"sustain" message and is shown in a separate, de-emphasised "Strengths" list.

### 3.6 Worked example (use this as the golden test)

All answers = 3:

```
tier1 = 0.383(3) + 0.367(3) + 0.190(3) + 0.060(3) = 3.000
tier2 = 0.40(3)  + 0.23(3)  + 0.37(3)             = 3.000
overall = 0.7(3.000) + 0.3(3.000) = 3.000  → Level 3 "Developing"
```

Mixed answers — Leadership 5, Strategy 4, People 3, Technology 2, Research 4, Design 2, Development 3:

```
tier1 = 0.383(5) + 0.367(4) + 0.190(3) + 0.060(2)
      = 1.915 + 1.468 + 0.570 + 0.120 = 4.073
tier2 = 0.40(4) + 0.23(2) + 0.37(3)
      = 1.600 + 0.460 + 1.110 = 3.170
overall = 0.7(4.073) + 0.3(3.170)
        = 2.8511 + 0.9510 = 3.8021  → Level 4 "Established"
```

Boundary cases that must be tested:

```
all 1s → overall 1.00 → Level 1
all 5s → overall 5.00 → Level 5
overall exactly 3.40 → Level 4 (lower bound is inclusive)
overall exactly 2.60 → Level 3
```

---

## 4. Tech stack

Chosen for: Vercel-native, minimal moving parts, and a pure-function core that is easy to test.

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Vercel-native, static pages + one API route |
| Styling | **Tailwind CSS v4** | No design-system dependency to install/configure |
| Config parsing | **`js-yaml`** | Reads `conf.yaml` |
| Config validation | **`zod`** | Fails loudly at build time on a bad config |
| Survey state | **`zustand`** (with `persist` → sessionStorage) | Much less boilerplate than context+reducer |
| Charts | **`recharts`** | Tier bar chart + factor radar |
| PDF | **`@react-pdf/renderer`**, client-side, dynamically imported | Declarative, no headless browser, stays out of the serverless bundle |
| Storage | **Neon Postgres** (`@neondatabase/serverless`), JSON document in a `jsonb` column; local filesystem in dev, behind one interface | Admin needs list, aggregate and export — see OD-5 for why blob-per-file was rejected |
| Admin auth | **`jose`** — HMAC-signed session cookie over a single shared password | One researcher, no user accounts; Edge-compatible, zero transitive dependencies |
| Unit tests | **Vitest** | Fast, zero-config with TS |
| E2E (optional) | **Playwright** | One happy-path smoke test |

Node 20+. Package manager: **npm** (keep it boring; `package-lock.json` is committed).

---

## 5. Target repository layout

```
.
├── conf.yaml                          # THE survey configuration — single source of truth
├── middleware.ts                      # gates /admin/* and /api/admin/*
├── docs/
│   ├── plan.md                        # this file
│   ├── requirements-extract.md
│   └── assets/{model-diagram,maturity-pyramid}.png
├── public/
│   └── assets/{model-diagram,maturity-pyramid}.png
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx                   # FR-1 landing
│   │   ├── model/page.tsx             # FR-2 static theory page
│   │   ├── survey/page.tsx            # FR-4 one-question-at-a-time flow
│   │   ├── results/page.tsx           # FR-5..FR-8
│   │   ├── not-found.tsx
│   │   ├── admin/                     # FR-14..FR-16 — session-gated
│   │   │   ├── login/page.tsx
│   │   │   ├── page.tsx               # dashboard
│   │   │   └── submissions/[id]/page.tsx
│   │   └── api/
│   │       ├── submissions/route.ts   # FR-9  — POST only, public
│   │       └── admin/
│   │           ├── login/route.ts
│   │           ├── logout/route.ts
│   │           ├── submissions/route.ts
│   │           └── export/route.ts
│   ├── components/
│   │   ├── ui/{Button,Card,Field,ProgressBar,RadioStatement}.tsx
│   │   ├── survey/{RespondentForm,QuestionCard,SurveyNav,ReviewPanel}.tsx
│   │   ├── results/{ScoreHeadline,TierBreakdown,FactorRadar,RecommendationList,StrengthList}.tsx
│   │   ├── pdf/{ResultsPdfDocument.tsx,DownloadPdfButton.tsx}
│   │   └── admin/{LoginForm,SummaryStats,SubmissionTable,ExportButtons}.tsx
│   ├── lib/
│   │   ├── config/{schema.ts,load.ts}
│   │   ├── scoring/{engine.ts,recommend.ts,index.ts}
│   │   ├── storage/{types.ts,postgres.ts,fs.ts,index.ts}
│   │   ├── auth/{session.ts,password.ts,rate-limit.ts}
│   │   ├── export/csv.ts
│   │   └── format.ts
│   ├── store/survey-store.ts
│   └── types/domain.ts
├── scripts/migrate.ts                 # creates the submissions table
├── tests/
│   ├── scoring.test.ts
│   ├── recommend.test.ts
│   ├── config.test.ts
│   ├── auth.test.ts
│   ├── csv.test.ts
│   └── access-control.test.ts
├── data/submissions/                  # dev-only JSON output; gitignored
└── README.md
```

---

## 6. Data contracts

### 6.1 Submission JSON (what gets stored — FR-9)

```jsonc
{
  "id": "sub_2026-08-22T09-31-04-123Z_a1b2c3",   // ISO-ish timestamp + random suffix
  "submittedAt": "2026-08-22T09:31:04.123Z",
  "configVersion": "1.0.0",                       // from conf.yaml meta.version
  "respondent": {
    "name": "…",
    "designation": "…",
    "experienceTechnicalYears": 8,
    "experienceManagerialYears": 4,
    "experienceDigitalisationYears": 3,
    "highestQualification": "masters"
  },
  "answers": { "leadership": 5, "strategy_governance": 4, "people_culture": 3,
               "technology": 2, "research": 4, "design": 2, "development": 3 },
  "result": {
    "overallScore": 3.8021,
    "tierScores": { "organisational_enablers": 4.073, "core_operations": 3.17 },
    "level": { "value": 4, "name": "Established" }
  },
  "meta": { "userAgent": "…", "durationMs": 184320 }
}
```

Never store an IP address. `respondent.name` is personal data — see OD-4 (§7).

### 6.2 Domain types (`src/types/domain.ts`)

```ts
export type AnswerValue = 1 | 2 | 3 | 4 | 5;
export type Answers = Record<string, AnswerValue>;          // keyed by factor id

export interface FactorScore {
  factorId: string; factorName: string; tierId: string;
  answer: AnswerValue; factorWeight: number; tierWeight: number;
  contribution: number;   // tierWeight * factorWeight * answer
  impact: number;         // tierWeight * factorWeight * (5 - answer)
}

export interface TierScore { tierId: string; tierName: string; weight: number; score: number; }

export interface MaturityLevel {
  value: 1|2|3|4|5; name: string; subtitle: string;
  headline: string; description: string; characteristics: string[]; colour: string;
}

export interface ScoreResult {
  overallScore: number;
  tierScores: TierScore[];
  factorScores: FactorScore[];
  level: MaturityLevel;
}

export interface Recommendation {
  factorId: string; factorName: string; tierName: string;
  currentAnswer: AnswerValue; impact: number; text: string;
}
```

---

### 6.3 Database schema (Postgres)

```sql
create table if not exists submissions (
  id             text         primary key,
  submitted_at   timestamptz  not null default now(),
  config_version text         not null,
  overall_score  numeric(6,4) not null,
  level_value    smallint     not null,
  payload        jsonb        not null
);

create index if not exists submissions_submitted_at_idx
  on submissions (submitted_at desc, id desc);
```

`payload` holds the §6.1 document verbatim — that is what satisfies *"we will store the data in a
json format"*. The four scalar columns are denormalised copies of fields inside `payload`, present
only so the admin dashboard can sort, paginate and aggregate without deserialising every row.
`payload` remains the source of truth; if the two ever disagree, `payload` wins.

The composite index on `(submitted_at desc, id desc)` is what makes keyset pagination in
`store.all()` (T-029) stable while new submissions are arriving.

Run `npm run db:migrate` (`scripts/migrate.ts`) to create the table. It must be idempotent.

---

## 7. Open decisions & assumptions

These are decided so that implementation is never blocked. Each has a safe default and is
config-driven, so reversing one is cheap. **Flag them to the project owner.**

| ID | Question | Decision taken | How to reverse |
|---|---|---|---|
| **OD-1** | Is the tier combination a weighted sum or a product? | **Weighted sum.** Reasoning in §3.2. | `scoring.formula` in `conf.yaml` |
| **OD-2** | What are the score→level band thresholds? *(not in source document)* | Equal-width bands over [1,5]: 1.8 / 2.6 / 3.4 / 4.2 | `maturity_levels[].min_score` in `conf.yaml` |
| **OD-3** | Where does recommendation text come from? *(not in source document)* | Authored in `conf.yaml`, one per factor per level 1–5, phrased as "how to reach the next level". Draft text supplied in T-003 — **owner should review the wording**. | Edit `conf.yaml` |
| **OD-4** | Is the respondent's name required? | **Optional**, with a consent checkbox before submit. Reduces PII risk and lifts completion rate. | `respondent_fields[].required` in `conf.yaml` |
| **OD-5** | Where do submissions go? | **Neon Postgres** via `DATABASE_URL`, one row per submission, JSON document in a `jsonb` column. Filesystem adapter for local dev. *Revised 2026-08-22:* Vercel Blob was the original choice and is now **rejected** — listing N submissions from blob storage costs N HTTP round-trips, aggregation is impossible without fetching everything, and access control would rest on unguessable URLs rather than on a session. If storage is unreachable the API logs and still returns 200 — the respondent must never lose their result over an outage. | Swap the adapter in `src/lib/storage/index.ts` |
| **OD-6** | "Product Development" box in the diagram | Treated as a **grouping label** for Research/Design/Development, not a scored factor. There is no 8th question in the source. | Add a factor to `conf.yaml` |
| **OD-7** | Per-factor level 5 label | Questionnaire says "Advanced", pyramid says "Optimised". **Both kept**, in separate config sections. | `scale_labels` vs `maturity_levels` |
| **OD-8** | How does the admin authenticate? | **One shared password + an HMAC-signed session cookie** (`jose`, HS256, 8-hour expiry). No accounts, no OAuth, no identity provider — there is one researcher. `ADMIN_PASSWORD` must be ≥12 characters and lives only in Vercel's encrypted environment variables, never in the repo. | Replace `src/lib/auth/` with Auth.js if the study ever needs several named admins with an audit trail |
| **OD-9** | Retention and PII | Responses are kept for the duration of the study. `respondent.name` is optional (OD-4); nothing else is directly identifying, and no IP address is stored. **The project owner must confirm this matches the ethics approval and the consent wording shown to participants** — that is a research-governance decision, not an engineering one. | `respondent_fields` in `conf.yaml`; add a purge script |
| **OD-10** | Can the admin delete submissions from the UI? | **Out of scope.** Read and export only. A destructive endpoint sitting behind a single shared password is a poor trade, and accidental deletion of research data is unrecoverable. Deletions are done directly against the database. | Add `DELETE /api/admin/submissions/[id]` with a typed confirmation |

---

## 8. Task Board

Legend: `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked (say why in Notes)

### Phase 0 — Foundation
- [x] **T-001** Scaffold the Next.js + TypeScript + Tailwind project
- [x] **T-002** Install dependencies and wire up tooling (Vitest, lint, scripts)
- [x] **T-003** Author `conf.yaml` — the complete survey configuration

### Phase 1 — Domain core (pure, testable, no UI)
- [x] **T-004** Config schema (zod) + loader
- [x] **T-005** Domain types
- [x] **T-006** Scoring engine + unit tests
- [x] **T-007** Recommendation engine + unit tests

### Phase 2 — App shell
- [x] **T-008** Root layout, design tokens, global styles (light + dark)
- [x] **T-009** Base UI primitives (`Button`, `Card`, `Field`, `ProgressBar`, `RadioStatement`)
- [x] **T-010** Landing page (FR-1)
- [x] **T-011** Model / theory page (FR-2)

### Phase 3 — Survey flow
- [x] **T-012** Survey store (zustand + sessionStorage)
- [x] **T-013** Respondent information step (FR-11)
- [x] **T-014** Question card component
- [x] **T-015** Survey page orchestration — one question at a time (FR-4)
- [x] **T-016** Review step — read back submitted answers (FR-5)

### Phase 4 — Results
- [x] **T-017** Results page shell + score headline + level band (FR-6, FR-12)
- [x] **T-018** Tier breakdown + factor radar charts
- [x] **T-019** Recommendations and strengths lists (FR-7)

### Phase 5 — Persistence
- [x] **T-020** Storage adapters (Postgres + filesystem) behind one interface
- [x] **T-021** `POST /api/submissions` route (FR-9)
- [x] **T-022** Wire submission into the survey completion flow

### Phase 5b — Admin data access *(added 2026-08-22)*
- [x] **T-029** Extend the storage layer with read + stream methods
- [x] **T-030** Admin session auth primitives (password, session token, rate limit)
- [x] **T-031** Middleware gate + login/logout routes (FR-14, FR-17)
- [x] **T-032** Admin dashboard — summary stats + paginated submissions (FR-15)
- [x] **T-033** Submission detail view (FR-15)
- [x] **T-034** CSV / JSON export (FR-16)
- [x] **T-035** Access-control audit — prove respondents are locked out (FR-17, NFR-6)

### Phase 6 — PDF
- [x] **T-023** PDF document component (FR-8)
- [x] **T-024** Download button + client-only wiring

### Phase 7 — Hardening & ship
- [ ] **T-025** Accessibility and responsive pass (NFR-1, NFR-2)
- [ ] **T-026** Error, empty and loading states + `not-found`
- [ ] **T-027** README + Vercel deployment configuration (FR-13)
- [ ] **T-028** *(optional)* Playwright happy-path smoke test

---

## Phase 0 — Foundation

### T-001 — Scaffold the Next.js + TypeScript + Tailwind project

**Status:** [x] done
**Depends on:** —

**Do:**

Scaffold in the **repo root** (the repo already contains `docs/` and `requirements/` — do not
create a nested subfolder, and do not delete those directories).

```bash
npx create-next-app@latest . \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --no-turbopack --use-npm
```

If the CLI refuses because the directory is non-empty, scaffold into a temp dir and move the
generated files in, preserving `docs/`, `requirements/`, `requirement.txt`, and `.git/`.

Then:

- Delete the boilerplate marketing content from `src/app/page.tsx`; leave a minimal placeholder
  (`<main><h1>Digital Maturity Assessment</h1></main>`). T-010 replaces it properly.
- Copy the two figures so the app can serve them:
  `mkdir -p public/assets && cp docs/assets/*.png public/assets/`
- Append to `.gitignore`:
  ```
  # local submission store (dev only)
  /data/submissions/
  .vercel
  ```
- Set `"engines": { "node": ">=20" }` in `package.json`.

**Files:** standard Next.js scaffold, `public/assets/*.png`, `.gitignore`, `package.json`

**Acceptance:**
- `npm run dev` serves a page at `/` with no console errors.
- `docs/`, `requirements/`, and git history are all intact.
- `src/` directory layout and the `@/*` import alias both work.

**Verify:**
```bash
npm run build && npx tsc --noEmit && npm run lint
```

**Notes:**
- Scaffolded into a temp dir and copied in, since the repo root was non-empty. create-next-app installed Next 16.3.2 / React 19.2.8; Next 16 builds with Turbopack regardless of --no-turbopack (that flag only affects `next dev`).

---

### T-002 — Install dependencies and wire up tooling

**Status:** [x] done
**Depends on:** T-001

**Do:**

```bash
npm install js-yaml zod zustand recharts @react-pdf/renderer @neondatabase/serverless jose
npm install -D vitest @types/js-yaml @vitejs/plugin-react jsdom
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
```

Add to `package.json` scripts:

```json
"test": "vitest",
"test:run": "vitest run",
"typecheck": "tsc --noEmit"
```

Create `tests/smoke.test.ts` containing a single trivial assertion so the runner has something to
find. Delete it in T-006.

**Files:** `package.json`, `package-lock.json`, `vitest.config.ts`, `tests/smoke.test.ts`

**Acceptance:**
- `npm run test:run` runs and reports 1 passing test.
- The `@/` alias resolves inside test files.
- No dependency versions pinned by hand — take what npm installs and commit the lockfile.

**Verify:**
```bash
npm run test:run && npm run typecheck && npm run lint && npm run build
```

**Notes:**
- js-yaml resolved to 5.3.0, which ships its own type declarations, so `@types/js-yaml` was uninstalled again as redundant (it would shadow the real types with a v4 copy). The `load()` API used by T-004 is unchanged.
- Vitest prints a cosmetic warning that `vitest.config.ts` uses ESM syntax while loaded as CJS; the config loads and runs correctly. Renaming it to .mts would silence it, at the cost of deviating from the filename this plan specifies.

---

### T-003 — Author `conf.yaml`

**Status:** [x] done
**Depends on:** T-002 *(the verify command below needs `js-yaml` installed)*

This is the most important file in the project. Create `conf.yaml` in the **repo root** with
exactly the content below. Content is transcribed from `docs/requirements-extract.md` — do not
paraphrase the questions or statements.

**Files:** `conf.yaml`

```yaml
# =============================================================================
# Digital Maturity Model — Apparel Industry
# Single source of truth for all survey content, weights and scoring.
# Changing this file alone must be enough to add/remove factors or tiers.
# =============================================================================

meta:
  version: "1.0.0"
  title: "Digital Maturity Assessment"
  subtitle: "A digital maturity model for the apparel industry"
  intro: >-
    This study addresses the lack of a practical tool to quantify digital maturity in the
    apparel industry. The primary aim of the research is to develop a data-driven framework
    to measure digital maturity and demonstrate the potential advantages of digital
    transformation. This framework will support apparel manufacturers in transitioning
    toward sustainable, technology-driven business models.
  instructions: >-
    For each factor, select one statement (1-5) that best describes the current situation
    in your organisation.
  estimated_minutes: 5

scoring:
  formula: weighted_sum      # see docs/plan.md OD-1
  min_answer: 1
  max_answer: 5
  decimals: 2

# Answer-scale labels (note: level 5 here is "Advanced" per the questionnaire,
# while the overall maturity band at 5 is "Optimised" per the pyramid figure — OD-7)
scale_labels:
  1: "Initial"
  2: "Emerging"
  3: "Developing"
  4: "Established"
  5: "Advanced"

respondent_fields:
  - id: name
    label: "Name"
    type: text
    required: false
    help: "Optional. Leave blank if you prefer to respond anonymously."
  - id: designation
    label: "Designation"
    type: text
    required: true
  - id: experienceTechnicalYears
    label: "Years of technical experience"
    type: number
    required: true
    min: 0
    max: 60
  - id: experienceManagerialYears
    label: "Years of managerial experience"
    type: number
    required: true
    min: 0
    max: 60
  - id: experienceDigitalisationYears
    label: "Years of experience in digitalisation"
    type: number
    required: true
    min: 0
    max: 60
  - id: highestQualification
    label: "Highest level of academic qualification"
    type: select
    required: true
    options:
      - { value: "secondary",  label: "Secondary / High school" }
      - { value: "diploma",    label: "Diploma" }
      - { value: "bachelors",  label: "Bachelor's degree" }
      - { value: "masters",    label: "Master's degree" }
      - { value: "doctorate",  label: "Doctorate" }
      - { value: "other",      label: "Other" }

tiers:
  - id: organisational_enablers
    name: "Organisational Enablers"
    label: "Tier 1"
    weight: 0.7
    description: >-
      The leadership, strategy, people and technology foundations that make digital
      transformation possible.

  - id: core_operations
    name: "Core Operations"
    label: "Tier 2"
    weight: 0.3
    description: >-
      How digitally mature the product development value chain is, from research through
      design to development.

factors:
  # --------------------------------------------------------------- Tier 1 ---
  - id: leadership
    tier: organisational_enablers
    name: "Leadership"
    weight: 0.383
    question: "To what extent does management support and drive digital transformation?"
    statements:
      1: "Management provides little or no direction for digital transformation."
      2: "Management supports some digital initiatives when needed."
      3: "Management has a clear digital vision and supports selected digital initiatives."
      4: "Management actively drives digital transformation, provides resources, and monitors progress."
      5: "Management continuously drives digital transformation, uses digital information for decision-making, and actively leads organisational change."
    recommendations:
      1: "Appoint a named senior sponsor for digital transformation and put a standing digital item on the management agenda, so that direction exists at all."
      2: "Move from reacting to individual requests to stating a digital vision: agree what digital should achieve for the business over the next 2-3 years and communicate it."
      3: "Back the vision with commitment - assign budget and named owners to your selected initiatives, and review their progress on a fixed cadence."
      4: "Start using digital information in the decisions management already makes, and have leaders visibly lead change rather than sponsor it from a distance."
      5: "Sustain this. Keep leadership attention on emerging technologies and continue using data as the default basis for decisions."

  - id: strategy_governance
    tier: organisational_enablers
    name: "Strategy & Governance"
    weight: 0.367
    question: "To what extent is digital transformation formally planned and managed in the organisation?"
    statements:
      1: "There is no formal digital strategy, roadmap, or governance structure."
      2: "Digital initiatives are planned individually with limited formal guidance."
      3: "The organisation has some digital priorities, policies, and governance practices."
      4: "Digital transformation is guided by a formal strategy, roadmap, governance structure, and regular reviews."
      5: "Digital strategy and governance are continuously reviewed and improved based on performance, risks, and emerging technologies."
    recommendations:
      1: "Write a first digital roadmap, even a one-page one: current state, three priorities, and who owns each. A rough plan beats no plan."
      2: "Replace project-by-project planning with a shared prioritisation method, so initiatives are chosen against agreed criteria rather than in isolation."
      3: "Consolidate your scattered priorities and policies into one formal strategy with a roadmap, a governance forum, and a regular review cycle."
      4: "Close the loop: feed performance data, delivery risks and technology scanning back into the strategy so it is revised rather than merely reported against."
      5: "Sustain this. Keep the review cycle honest by acting on what it surfaces, including stopping initiatives that are not working."

  - id: people_culture
    tier: organisational_enablers
    name: "People & Culture"
    weight: 0.190
    question: "To what extent are employees prepared and encouraged to support digital transformation?"
    statements:
      1: "Employees have limited digital skills and there is significant resistance to digital change."
      2: "Basic digital training is provided to selected employees."
      3: "Employees receive regular digital training and participate in some digital initiatives."
      4: "Continuous learning, employee participation, and cross-functional collaboration are well established."
      5: "Employees actively identify digital opportunities, develop new digital skills, and contribute to digital innovation."
    recommendations:
      1: "Run a digital skills baseline across roles, then address the resistance directly - most of it is fear of redundancy or of looking incompetent. Start training with the willing."
      2: "Widen training beyond the selected few and set a regular cadence, so digital skills stop being concentrated in a handful of people."
      3: "Move people from attending initiatives to shaping them: build cross-functional teams and make continuous learning an expectation, not an event."
      4: "Create channels through which employees can propose digital improvements, and make sure good proposals visibly get resourced."
      5: "Sustain this. Protect the time and psychological safety that let employees keep experimenting."

  - id: technology
    tier: organisational_enablers
    name: "Technology"
    weight: 0.060
    question: "To what extent are digital technologies and systems used and integrated across the organisation?"
    statements:
      1: "Digital technologies are limited and mainly used for basic activities."
      2: "Some departments use digital tools, but systems are mostly separate."
      3: "Digital systems are used across several functions with some level of integration."
      4: "Digital systems are well integrated and data is shared across relevant functions."
      5: "The organisation continuously integrates and improves its digital technologies using advanced analytics, AI, automation, and emerging technologies."
    recommendations:
      1: "Identify the two or three highest-volume manual processes and digitise those first. Do not attempt a platform-wide programme from this starting point."
      2: "Tackle the silos: agree a master data definition and connect the two systems that most often need the same information re-keyed."
      3: "Extend integration to the remaining functions and make shared data the default rather than an export-on-request."
      4: "Build on your integrated data with analytics and automation, and set up a way to evaluate emerging technologies rather than adopting them ad hoc."
      5: "Sustain this. Keep retiring what no longer earns its place - integration debt accumulates quietly."

  # --------------------------------------------------------------- Tier 2 ---
  - id: research
    tier: core_operations
    name: "Research"
    weight: 0.40
    question: "To what extent are digital technologies and data used for product-related research?"
    statements:
      1: "Research is mainly conducted using traditional methods with little use of digital tools."
      2: "Digital platforms or databases are occasionally used for research."
      3: "Digital platforms and data are regularly used to support market, customer, and trend research."
      4: "Digital analytics and advanced tools are systematically used to identify trends, customer needs, and product opportunities."
      5: "AI, predictive analytics, and integrated data are continuously used to predict trends, customer preferences, and future product opportunities."
    recommendations:
      1: "Subscribe to at least one digital trend or market intelligence source and make consulting it a required step in the research process."
      2: "Make digital research routine rather than occasional by defining which sources are consulted at which stage of every new development."
      3: "Move from supporting decisions to systematically driving them: adopt analytics tooling and define the metrics that signal a real customer need."
      4: "Add predictive capability - connect your research, sales and returns data so the organisation can anticipate demand rather than describe it after the fact."
      5: "Sustain this. Keep validating model predictions against outcomes so confidence stays earned."

  - id: design
    tier: core_operations
    name: "Design"
    weight: 0.23
    question: "To what extent are digital technologies used in the product design process?"
    statements:
      1: "Product design is mainly conducted using traditional methods."
      2: "Basic digital design tools are used by selected employees or departments."
      3: "Digital design and visualisation tools are regularly used, with some digital collaboration."
      4: "Digital design, visualisation, file sharing, and collaboration are integrated into the design process."
      5: "Advanced digital technologies such as 3D, AI, and virtual tools are continuously used for design optimisation, collaboration, and innovation."
    recommendations:
      1: "Introduce digital design tooling for one product category as a pilot, and train the designers who will champion it rather than the whole team at once."
      2: "Extend the tools beyond the early adopters and standardise file formats and naming, so digital design output can actually be shared."
      3: "Integrate design into a single collaborative environment so visualisation, file sharing and review stop being separate manual steps."
      4: "Adopt 3D and virtual sampling to cut physical sample rounds, and use design data to optimise, not just to draw."
      5: "Sustain this. Keep measuring the sample rounds and lead time you are saving, so the investment stays defensible."

  - id: development
    tier: core_operations
    name: "Development"
    weight: 0.37
    question: "To what extent are digital technologies used to manage and improve product development?"
    statements:
      1: "Product development is mainly conducted through physical and manual processes."
      2: "Individual digital tools are used for activities such as pattern development, sampling, or fit evaluation."
      3: "Digital tools are regularly used for pattern development, 3D sampling, fit evaluation, or digital approval."
      4: "Digital tools, simulation, digital workflows, and integrated systems are used throughout product development."
      5: "Integrated systems, AI, analytics, simulation, and digital twins are used to continuously optimise product development and reduce time, cost, and physical sampling."
    recommendations:
      1: "Digitise one development stage end to end - pattern development is usually the highest-return starting point - before broadening."
      2: "Connect your individual tools into a sequence so output from one stage feeds the next without re-work."
      3: "Extend digital approval across the full development calendar and integrate it with the systems that carry the order through."
      4: "Introduce simulation and digital twins to test fit and performance before physical sampling, and measure the reduction in sample rounds."
      5: "Sustain this. Feed production and quality outcomes back into the models so optimisation keeps improving."

# Score -> maturity band. min_score is INCLUSIVE. Bands must be contiguous and
# cover the full [1, 5] range. See docs/plan.md OD-2 - these thresholds are an
# assumption and are open for the project owner to revise.
maturity_levels:
  - value: 1
    min_score: 1.0
    name: "Initial"
    subtitle: "Manual & Siloed"
    headline: "Digital is Minimal - Traditional"
    colour: "#B0392E"
    description: >-
      The organisation relies on manual processes and disconnected systems.
      Digital transformation is not a priority.
    characteristics:
      - "Manual processes and paper-based work"
      - "Limited or no digital tools"
      - "No structured data management"
      - "Low digital awareness and skills"

  - value: 2
    min_score: 1.8
    name: "Emerging"
    subtitle: "Ad Hoc & Reactive"
    headline: "Digital is Emerging - Opportunity Driven"
    colour: "#C9962F"
    description: >-
      Digital awareness exists and some initiatives are in place, but implementation
      is inconsistent and mostly isolated.
    characteristics:
      - "Limited use of digital tools"
      - "Unstructured initiatives"
      - "Limited data usage"
      - "Skills and change management in progress"

  - value: 3
    min_score: 2.6
    name: "Developing"
    subtitle: "Structured & Consistent"
    headline: "Digital is Implemented - Value Focused"
    colour: "#2E7E8C"
    description: >-
      Digital initiatives are implemented across key areas with defined processes.
      The organisation is building consistency and capability.
    characteristics:
      - "Digital tools used across key functions"
      - "Defined processes and policies"
      - "Data used for decision-making"
      - "Growing digital culture and skills"

  - value: 4
    min_score: 3.4
    name: "Established"
    subtitle: "Managed & Integrated"
    headline: "Digital is Integrated - Performance Driven"
    colour: "#8DA84A"
    description: >-
      Digital technologies and processes are fully integrated across functions.
      The organisation manages and measures digital performance.
    characteristics:
      - "Integrated digital systems and data"
      - "Standardised processes and governance"
      - "Measurable impact and ROI"
      - "Strong digital skills and collaboration"

  - value: 5
    min_score: 4.2
    name: "Optimised"
    subtitle: "Innovation Leader"
    headline: "Digital at the Core - Continuous Innovation"
    colour: "#2E6B3A"
    description: >-
      Digital transformation is embedded in the culture. The organisation continuously
      innovates, adapts and creates new value through digital technologies.
    characteristics:
      - "Data-driven decisions at all levels"
      - "Advanced analytics, AI and automation"
      - "Ecosystem collaboration and co-creation"
      - "Continuous improvement and innovation"
```

**Acceptance:**
- File parses as valid YAML.
- Tier weights sum to exactly 1.0; factor weights sum to exactly 1.0 **within each tier**.
- All 7 factors have exactly 5 statements and 5 recommendations, keyed 1–5.
- `maturity_levels` are contiguous, ascending, and start at 1.0.
- Question and statement text matches `docs/requirements-extract.md` **word for word**.

**Verify:**
```bash
node -e "const y=require('js-yaml'),f=require('fs');const c=y.load(f.readFileSync('conf.yaml','utf8'));
const s=a=>a.reduce((n,x)=>n+x,0);
const tw=s(c.tiers.map(t=>t.weight));
console.assert(Math.abs(tw-1)<1e-9,'tier weights != 1: '+tw);
for(const t of c.tiers){const w=s(c.factors.filter(f=>f.tier===t.id).map(f=>f.weight));
console.assert(Math.abs(w-1)<1e-9,t.id+' factor weights != 1: '+w);}
console.assert(c.factors.length===7,'expected 7 factors');
for(const f of c.factors){console.assert(Object.keys(f.statements).length===5,f.id+' statements');
console.assert(Object.keys(f.recommendations).length===5,f.id+' recommendations');}
console.log('conf.yaml OK');"
```

**Notes:**
- Transcribed verbatim from the plan. Every question and all 35 statements were then diffed programmatically against `docs/requirements-extract.md` and match word for word. Recommendation text is the draft from OD-3 and still needs the project owner's review.

---

## Phase 1 — Domain core

### T-004 — Config schema (zod) + loader

**Status:** [x] done
**Depends on:** T-002, T-003

**Do:**

`src/lib/config/schema.ts` — a zod schema mirroring `conf.yaml` exactly, plus **cross-field
refinements** that are the real value here:

- `tiers[].weight` sums to 1.0 (tolerance `1e-9`)
- for each tier, its factors' weights sum to 1.0 (tolerance `1e-9`)
- every `factors[].tier` refers to a tier that exists
- `factors[].id` values are unique
- every factor has statements and recommendations for keys 1–5
- `maturity_levels` sorted ascending by `min_score`, first is exactly `scoring.min_answer`, no gaps
- at least one tier and at least one factor per tier

Export `export type AppConfig = z.infer<typeof configSchema>;`

`src/lib/config/load.ts`:

```ts
import 'server-only'; // if this causes trouble in Vitest, drop it and note why
```

- `loadConfig(): AppConfig` — reads `conf.yaml` from `process.cwd()`, parses with `js-yaml`,
  validates with the zod schema, **caches the result in a module-level variable**.
- On validation failure, `throw` with a readable message listing each zod issue path. A broken
  config must fail the build, not degrade silently at runtime.
- Also export `loadConfigFromString(yaml: string): AppConfig` so tests can feed in fixtures
  without touching the filesystem.

**Files:** `src/lib/config/schema.ts`, `src/lib/config/load.ts`, `tests/config.test.ts`

**Acceptance:**
- `loadConfig()` returns a fully typed config for the real `conf.yaml`.
- Tests cover: valid config loads; tier weights ≠ 1 rejected; factor weights ≠ 1 rejected;
  unknown `tier` reference rejected; duplicate factor id rejected; missing statement `4` rejected;
  non-contiguous maturity bands rejected.
- Error messages name the offending field path.

**Verify:**
```bash
npm run test:run -- tests/config.test.ts && npm run typecheck
```

**Notes:**
- Dropped `import 'server-only'`: the package is not a dependency here and adding one purely as a lint marker was not worth a new runtime dep. The boundary is held by convention plus the T-035 import-boundary check instead, and load.ts says so.
- js-yaml v5 exports no default under ESM, so the loader uses `import { load as parseYaml } from 'js-yaml'`. A default import typechecks but is undefined at runtime — worth knowing for any other module that reaches for js-yaml.
- Also exported `clearConfigCache()` as a test seam.

---

### T-005 — Domain types

**Status:** [x] done
**Depends on:** T-004

**Do:** Create `src/types/domain.ts` with exactly the types listed in §6.2 of this plan. Add
`RespondentInfo` and `Submission` interfaces matching the JSON contract in §6.1.

**Files:** `src/types/domain.ts`

**Acceptance:**
- No `any`. `AnswerValue` is the literal union `1|2|3|4|5`, not `number`.
- Types are structural only — no runtime code, no imports from React or Next.

**Verify:**
```bash
npm run typecheck && npm run lint
```

**Notes:**
- Added `StoredResult` and `SubmissionMeta` alongside the §6.2 types, so the §6.1 storage document (which holds tier scores as a plain id→number map, not the richer `TierScore[]`) has a name rather than an inline shape.
- `RespondentInfo` carries an index signature because `respondent_fields` is config-driven; the named members are what storage and CSV export rely on.

---

### T-006 — Scoring engine + unit tests

**Status:** [x] done
**Depends on:** T-005

**Do:**

`src/lib/scoring/engine.ts` — **pure functions only**. No React, no `fs`, no `next/*`.

```ts
export function computeScore(config: AppConfig, answers: Answers): ScoreResult
export function resolveLevel(config: AppConfig, overallScore: number): MaturityLevel
export function isComplete(config: AppConfig, answers: Partial<Answers>): boolean
```

Implement §3.2 exactly. Requirements:

- Throw a descriptive error if an answer is missing for any configured factor.
- Throw if an answer is outside `scoring.min_answer..max_answer`.
- Throw if the computed `overallScore` falls outside `[min_answer, max_answer]` — this is the
  config sanity assertion from §3.2.
- `resolveLevel` picks the **last** band whose `min_score <= score`. Lower bound inclusive.
- Return full `factorScores` including `contribution` and `impact`, so the UI and the
  recommendation engine never recompute the maths.
- Do **not** round inside the engine. Rounding is a formatting concern (`src/lib/format.ts`).

`tests/scoring.test.ts` must include, at minimum:

- all-3s → overall exactly `3` → Level 3 (§3.6)
- the mixed worked example → `tier1 = 4.073`, `tier2 = 3.17`, `overall = 3.8021` → Level 4
  (compare with `toBeCloseTo(…, 6)`)
- all-1s → `1` → Level 1; all-5s → `5` → Level 5
- band boundaries: `3.40` → Level 4, `2.60` → Level 3, `4.19999` → Level 4
- missing answer throws; answer `0` throws; answer `6` throws
- **config-agnostic test**: build a fixture config with 3 tiers and different weights, and assert
  the engine still returns a score in range — proves NFR-4

Delete `tests/smoke.test.ts`.

**Files:** `src/lib/scoring/engine.ts`, `src/lib/scoring/index.ts`, `src/lib/format.ts`,
`tests/scoring.test.ts`; delete `tests/smoke.test.ts`

**Acceptance:**
- Every test above passes with the stated numbers.
- `engine.ts` imports nothing from `react`, `next`, or `node:fs`.
- `src/lib/format.ts` exports `formatScore(n, decimals)` returning a fixed-decimal string.

**Verify:**
```bash
npm run test:run -- tests/scoring.test.ts && npm run typecheck && npm run lint
```

**Notes:**
- Added `missingFactorIds()` next to `isComplete()` — the review step (T-016) has to name which factors are unanswered, and deriving that in the component would put scoring logic back in the UI.
- `format.ts` also carries `formatWeight`, `formatDateTime` and `formatDuration`, used later by the model page, admin and PDF.
- The range assertion allows 1e-9 of slack: weights like 0.383 do not sum to exactly 1 in binary floating point.

---

### T-007 — Recommendation engine + unit tests

**Status:** [x] done
**Depends on:** T-006

**Do:**

`src/lib/scoring/recommend.ts`:

```ts
export function buildRecommendations(config: AppConfig, result: ScoreResult): {
  improvements: Recommendation[];   // answer < 5, sorted by impact desc
  strengths: Recommendation[];      // answer === 5
}
```

- `impact = tierWeight × factorWeight × (5 − answer)`, per §3.5. Reuse `factorScores[].impact`
  from the engine — do not recompute.
- Sort `improvements` by `impact` descending. Ties break by tier order, then by factor order as
  they appear in `conf.yaml` — the sort must be **stable and deterministic**.
- Text comes from `factors[f].recommendations[answer]`. Never generate text in code.

`tests/recommend.test.ts`:

- all-5s → `improvements` empty, `strengths` has 7 entries
- all-1s → 7 improvements, ordered `leadership, strategy_governance, people_culture, research,
  development, design, technology` — with impacts `1.0724, 1.0276, 0.5320, 0.4800, 0.4440,
  0.2760, 0.1680` respectively. Assert the order **and** the impact values.
- equal-impact factors keep config order
- a factor answered 5 never appears in `improvements`

**Files:** `src/lib/scoring/recommend.ts`, `tests/recommend.test.ts`, update `src/lib/scoring/index.ts`

**Acceptance:**
- Deterministic ordering, verified by a test that runs the sort twice.
- Still pure — no React/Next/fs imports.

**Verify:**
```bash
npm run test:run && npm run typecheck && npm run lint
```

**Notes:**
- Ties are compared with a 1e-12 epsilon before falling through to tier-then-factor order. Without it, two factors that are equal in principle differ in the last bits of the float and the documented tie-break would never actually run.

---

## Phase 2 — App shell

### T-008 — Root layout, design tokens, global styles

**Status:** [x] done
**Depends on:** T-001

**Do:**

`src/app/globals.css` — define the palette as CSS custom properties on `:root`, then redefine
**only the token values** under `@media (prefers-color-scheme: dark)`. Never give a colour its
only definition inside a media query.

Tokens to define: `--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--accent`,
`--accent-contrast`, `--focus`, plus `--level-1` … `--level-5` seeded from the `colour` values in
`conf.yaml` (§T-003). Dark mode lightens the level colours enough to keep ≥4.5:1 against
`--surface`.

`src/app/layout.tsx`:
- `metadata`: title `"Digital Maturity Assessment"`, a real description, `viewport` with
  `width=device-width, initial-scale=1`.
- A skip-to-content link as the first focusable element.
- A minimal header (product name → `/`, link to `/model`) and a footer.
- `<main id="main">` wrapper.

Set a `:focus-visible` ring on every interactive element, using `--focus`. Do **not** ship
`outline: none` anywhere.

**Files:** `src/app/layout.tsx`, `src/app/globals.css`

**Acceptance:**
- Light and dark both render with explicit background and text colour — no transparent `body`.
- Tab from page load reaches the skip link first, and it works.
- No horizontal scroll at 320px width.

**Verify:**
```bash
npm run build && npm run lint
```

**Notes:**
- Dropped the scaffold's next/font Geist import for a system font stack: it removes a build-time network fetch and the font-swap layout shift, and matches the plain, document-like feel of a research instrument.
- Each level colour has two tokens. `--level-N` is the figure colour from conf.yaml, used for fills and bars; `--level-N-text` is the nearest variant that clears 4.5:1 against --surface. #C9962F (Level 2) is only 2.66:1 on white, so using the raw figure colour as text would have failed WCAG — this is the T-025 failure the plan predicted, headed off here.
- Likewise `--border` (decorative separators) and `--border-strong` (>= 3:1, for form-control boundaries) are separate.
- Tailwind v4 `@theme inline` maps the tokens to utilities; note the utility names are bg/surface/line/ink/muted/accent, since `text-text` and `border-border` read badly.

---

### T-009 — Base UI primitives

**Status:** [x] done
**Depends on:** T-008

**Do:** Build small, unstyled-by-default, prop-driven components in `src/components/ui/`:

- `Button.tsx` — variants `primary | secondary | ghost`, sizes `sm | md`, `disabled`,
  forwards ref, renders a real `<button>` (or `<a>` when `href` is given).
- `Card.tsx` — surface container with optional heading.
- `Field.tsx` — wraps a labelled input; renders `<label for>`, optional help text, and an error
  message wired via `aria-describedby` and `aria-invalid`.
- `ProgressBar.tsx` — `value`/`max`, with `role="progressbar"` and `aria-valuenow/min/max` plus a
  visible "Question 3 of 7" text label.
- `RadioStatement.tsx` — one selectable statement in the 1–5 scale. Renders a native
  `<input type="radio">` visually hidden but focusable, with the whole card as the label.
  Shows the number, the scale label (`Initial`…`Advanced`), and the statement text.

All are client components only where they need state; keep them server-renderable otherwise.

**Files:** `src/components/ui/{Button,Card,Field,ProgressBar,RadioStatement}.tsx`

**Acceptance:**
- A `RadioStatement` group is fully operable with arrow keys (native radio behaviour preserved).
- Focus rings visible on every primitive in both themes.
- No component hardcodes survey content.

**Verify:**
```bash
npm run build && npm run typecheck && npm run lint
```

**Notes:**
- `Button` renders a `<button>`; the `href` case is a separate `ButtonLink` export wrapping next/link, because one component cannot forward a ref to both element types cleanly and the union props made every call site need a cast.
- `Field` takes a render prop rather than wrapping an input, so callers keep control of the control while Field owns the label/aria-describedby/aria-invalid wiring. `inputClassName` is exported alongside it for consistent styling.
- `RadioStatement` is the only client component of the five. Its native radio stays focusable (opacity-0, not display:none) so arrow keys and Space work natively, and the card shows the focus ring via `has-[:focus-visible]`. Selection is signalled by a tick and a ring, not colour alone.

---

### T-010 — Landing page (FR-1)

**Status:** [x] done
**Depends on:** T-009, T-004

**Do:** Replace `src/app/page.tsx`. Server component; read content via `loadConfig()`.

Sections:
1. Hero — `meta.title`, `meta.subtitle`, a primary **"Start the survey"** button → `/survey`,
   and `"Takes about {meta.estimated_minutes} minutes"`.
2. Intro — `meta.intro`.
3. "What you'll be asked" — the tiers and their factors, rendered from config (never hardcoded),
   showing tier label, name, description, and its factor names.
4. A quiet link to `/model` — "How the model works".
5. A short privacy note: responses are stored for research; the name field is optional; results
   cannot be retrieved later.

**Files:** `src/app/page.tsx`

**Acceptance:**
- Adding a factor to `conf.yaml` changes this page with no code edit.
- The page is a server component — no `'use client'`.
- One `<h1>` only; heading levels don't skip.

**Verify:**
```bash
npm run build && npm run lint
```

**Notes:**
- Every string on the page comes from conf.yaml or is generic UI copy; the tier and factor lists are mapped straight from config, so adding a factor changes the page with no code edit. Question count in the hero is `factors.length`, not a literal.

---

### T-011 — Model / theory page (FR-2)

**Status:** [x] done
**Depends on:** T-009, T-004

**Do:** `src/app/model/page.tsx` — static server component explaining the theory.

Content:
1. Aim and objectives — from `meta.intro` plus the study description in
   `docs/requirements-extract.md` (page 2).
2. **The two-tier structure** — render `public/assets/model-diagram.png` via `next/image` with a
   descriptive `alt`, and beneath it a text description of the same structure (the image must not
   be the only carrier of the information — NFR-2).
3. **The weights** — a table generated from config: tier, factor, factor weight, effective weight
   (`tierWeight × factorWeight`). Show that each column sums to 1.
4. **The formula** — render §3.2 as readable maths with a worked example.
5. **The maturity levels** — render `public/assets/maturity-pyramid.png` plus a config-driven
   table of all five levels with score range, name, subtitle, headline, description, and
   characteristics. Colour-code the rows with the `--level-N` tokens.
6. A note on limitations and the source of the weights.

**Files:** `src/app/model/page.tsx`

**Acceptance:**
- Both figures have meaningful `alt` text, and all information in them also exists as text.
- The weights table is computed from `conf.yaml`, not typed by hand.
- Tables scroll inside their own container on narrow screens; the page body never scrolls sideways.

**Verify:**
```bash
npm run build && npm run lint
```

**Notes:**
- Both figures carry long alt text that states everything the image conveys, and every fact in them is repeated as text (tier cards, level articles) so the image is never the only carrier.
- The weights table, the formula block and the worked example are all computed from conf.yaml — no weight is typed by hand. Verified against a production build: effective weights render as 0.2681, 0.2569, 0.1330, 0.0420, 0.1200, 0.0690, 0.1110, both totals 1.00.
- Maturity levels render top-down (5→1) to match the pyramid figure, with each band's upper bound derived from the next band's min_score.

---

## Phase 3 — Survey flow

### T-012 — Survey store

**Status:** [x] done
**Depends on:** T-005, T-002

**Do:** `src/store/survey-store.ts` — zustand store with `persist` middleware writing to
**sessionStorage** (not localStorage — see NFR-5 and FR-10).

State: `respondent`, `answers`, `currentStep`, `startedAt`, `submissionState`
(`'idle' | 'saving' | 'saved' | 'error'`).

Actions: `setRespondentField`, `setAnswer`, `next`, `prev`, `goTo`, `reset`,
`setSubmissionState`.

Step model: step `0` is the respondent form, steps `1..N` are the N factors from config, step
`N+1` is review. Store the **step index only**; derive the factor from config at render time so
adding a factor to `conf.yaml` does not corrupt a persisted store.

Include a `configVersion` in persisted state and **discard persisted state whose version differs**
from the current `meta.version`. Stale answers against a changed questionnaire are worse than
starting over.

**Files:** `src/store/survey-store.ts`

**Acceptance:**
- Refreshing mid-survey preserves answers; closing the tab loses them.
- `reset()` clears sessionStorage.
- Bumping `meta.version` in `conf.yaml` invalidates persisted state.
- The store holds no derived scores — scores are computed from answers on demand.

**Verify:**
```bash
npm run typecheck && npm run lint && npm run build
```

**Notes:**
- Version invalidation lives in `setConfigVersion`, called once by the survey page: if the persisted `configVersion` differs from the current `meta.version`, the whole store resets rather than carrying answers across a changed questionnaire.
- `useSurveyHydrated()` is built on `useSyncExternalStore`, not `hasHydrated()` read during render (not reactive) and not setState-in-effect (which the react-hooks lint rule rejects, rightly — it cascades renders). The results page needs this to avoid flashing its empty state over data that is about to rehydrate.
- Added `returnToReview` to the state so an Edit jump from the review panel can come back to review instead of continuing forwards (T-016).

---

### T-013 — Respondent information step (FR-11)

**Status:** [x] done
**Depends on:** T-012, T-009

**Do:** `src/components/survey/RespondentForm.tsx` — client component rendering fields
**generated from `respondent_fields` in `conf.yaml`** (text / number / select).

- Validate on blur and on submit: required fields present, numbers within `min`/`max`, numbers are
  integers.
- Show errors inline via `Field`, and move focus to the first invalid field on failed submit.
- A consent checkbox — "I understand my responses will be stored for research purposes" —
  required to continue (OD-4).
- On submit, write to the store and advance to step 1.

**Files:** `src/components/survey/RespondentForm.tsx`

**Acceptance:**
- Adding a field to `respondent_fields` renders it with no code change.
- Submitting empty shows errors and does not advance.
- Every input has a programmatically associated label.

**Verify:**
```bash
npm run build && npm run typecheck && npm run lint
```

**Notes:**
- Fields render from `respondent_fields`; the only per-type branching is text/number/select input rendering, so a new field in conf.yaml needs no code change. Validation reads `required`, `min` and `max` from the same config.
- Validates on blur and on submit, and additionally clears an error the moment the value becomes valid — leaving a stale message while someone visibly fixes the field is worse than either.
- The consent checkbox (OD-4) is a separate required control with its own error association; submitting without it moves focus there.

---

### T-014 — Question card component

**Status:** [x] done
**Depends on:** T-009, T-012

**Do:** `src/components/survey/QuestionCard.tsx` — client component. Props: the factor object,
the current answer, and `onAnswer`.

Renders: tier label + name as context, factor name as the heading, the question text, then the
5 statements as a `RadioStatement` radiogroup wrapped in a `<fieldset>` with a `<legend>`.

- Statements render in ascending order 1→5, each showing its number and scale label.
- Selecting a statement records the answer immediately.
- The whole statement card is clickable and is the radio's label.
- `aria-describedby` links the group to the question text.

**Files:** `src/components/survey/QuestionCard.tsx`

**Acceptance:**
- Keyboard: Tab reaches the group, arrows move between statements, Space selects.
- Long statements wrap; nothing is truncated or overflows at 320px.
- Selected state is distinguishable **without relying on colour alone**.

**Verify:**
```bash
npm run build && npm run typecheck && npm run lint
```

**Notes:**
- Forwards a ref to the `<h2>` (which carries tabIndex={-1}) so T-015 can move focus to the new question on a step change without the card knowing anything about navigation.
- The scale values and labels are passed in from config rather than hardcoded 1-5, so a config with a different `min_answer`/`max_answer` still renders correctly.

---

### T-015 — Survey page orchestration (FR-4)

**Status:** [x] done
**Depends on:** T-013, T-014

**Do:** `src/app/survey/page.tsx` — a thin server component that loads the config and passes it to
a client `SurveyFlow` component.

Behaviour:
- **One question on screen at a time.** This is an explicit requirement — do not render a long
  scrolling list.
- `ProgressBar` showing "Question {i} of {n}" for factor steps.
- Back / Next in `src/components/survey/SurveyNav.tsx`. Next is disabled until the current factor
  is answered. Back is always available and never loses an answer.
- On step change, move focus to the new question heading and announce the change to screen readers
  via an `aria-live="polite"` region.
- Deep-linking into `/survey` mid-flow resumes from the persisted step.
- After the last factor, advance to the review step (T-016).

**Files:** `src/app/survey/page.tsx`, `src/components/survey/SurveyFlow.tsx`,
`src/components/survey/SurveyNav.tsx`

**Acceptance:**
- Exactly one factor question is in the DOM at a time.
- Adding an 8th factor to `conf.yaml` adds an 8th step with no code change.
- Focus lands on the new question after Next/Back — it does not stay on the button or reset to the
  top of the document.

**Verify:**
```bash
npm run build && npm run typecheck && npm run lint
```

**Notes:**
- Exactly one factor question is in the DOM at a time: the flow returns a single QuestionCard for the current step, it does not render a list and hide the rest.
- Focus moves to the new question heading on a step change, but deliberately not on first paint — grabbing focus on load is disorienting and there is nothing new to announce yet. The change is also announced through an aria-live=polite region.
- Added `src/components/survey/ReviewPanel.tsx` here as a placeholder so the build passes; T-016 replaces it with the real review step.
- The `returnToReview` flag makes an Edit jump from review behave as a round trip — Next and Back both return to review rather than continuing through the questionnaire.

---

### T-016 — Review step (FR-5)

**Status:** [x] done
**Depends on:** T-015

**Do:** `src/components/survey/ReviewPanel.tsx` — the final step before results.

- Lists every factor with the statement the user chose, grouped by tier.
- Each row has an **Edit** control that jumps back to that factor's step (and returns to review).
- Shows the respondent information with an Edit control too.
- A prominent **"See my results"** button, disabled until all factors are answered, with a clear
  message naming which are missing.

**Files:** `src/components/survey/ReviewPanel.tsx`

**Acceptance:**
- Answers shown here match the store exactly.
- Editing from review returns the user to review, not to the front of the survey.
- The requirement *"users can go through the answers submitted"* is visibly satisfied.

**Verify:**
```bash
npm run build && npm run typecheck && npm run lint
```

**Notes:**
- Answers are read from the store and their statement text resolved through conf.yaml, so the review shows exactly what will be scored and stored — nothing is copied at answer time.
- Every factor row and the respondent block have an Edit control that sets `returnToReview`, so editing lands back here rather than continuing forwards through the questionnaire.
- "See my results" is disabled until every factor is answered and names the missing factors in visible text (and in an sr-only description tied to the button); the unanswered rows are also flagged inline.
- "Back to the last question" uses `goTo` rather than the edit path on purpose, so the last question keeps its normal Back/Review navigation.

---

## Phase 4 — Results

### T-017 — Results page + score headline (FR-6, FR-12)

**Status:** [x] done
**Depends on:** T-016, T-007

**Do:** `src/app/results/page.tsx` (server shell) + `src/components/results/ScoreHeadline.tsx`.

- Compute the result **client-side** from the store using `computeScore` — the score must never
  depend on a network round-trip.
- If the store has no complete set of answers, show an empty state offering to start the survey.
  Do not crash, and do not show a score of 0.
- `ScoreHeadline` shows: overall score to 2dp out of 5, the level number and name, subtitle,
  headline, description, characteristics, and the level colour used as an accent (never as the
  only signal).

**Files:** `src/app/results/page.tsx`, `src/components/results/ScoreHeadline.tsx`

**Acceptance:**
- Score matches the §3.6 worked examples when those answers are entered by hand.
- Direct navigation to `/results` with an empty store shows the empty state.
- Level name and score are both present as text (not only inside a chart or image).

**Verify:**
```bash
npm run build && npm run typecheck && npm run lint
```

**Notes:**
- Added `src/components/results/ResultsView.tsx` (not in the plan's file list) so the page itself can stay a server component that only loads config: the score has to be computed client-side from the store, which needs a client boundary somewhere.
- Three distinct states, in this order: not-yet-hydrated ("Working out your result…"), no complete answer set (empty state offering the survey), and the result. The hydration state exists so a refresh never flashes the empty state over answers that are about to load.
- The level colour is a left border and the level heading's colour; the level number, name, headline and description are always text, so nothing depends on seeing the colour.

---

### T-018 — Tier breakdown + factor radar

**Status:** [x] done
**Depends on:** T-017

**Do:** `src/components/results/TierBreakdown.tsx` and `FactorRadar.tsx`, using recharts.

- `TierBreakdown` — horizontal bars for each tier's score on a fixed `[1, 5]` axis, labelled with
  the tier name, its weight, and its score. Fixed axis matters: an auto-scaled axis makes a 2.1
  look strong.
- `FactorRadar` — one axis per factor, domain fixed `[1, 5]`, showing the answer per factor.
- Both must be **accompanied by a data table** (visually compact, or `sr-only`) carrying the same
  numbers, so the information is not chart-only.
- Colours come from the CSS tokens; both charts must be legible in light and dark.
- Charts are client components, wrapped so they don't break SSR.

**Files:** `src/components/results/{TierBreakdown,FactorRadar}.tsx`

**Acceptance:**
- Axis domain is hardcoded to `[1, 5]`, not inferred.
- Charts resize down to 320px without clipping labels.
- Equivalent numbers are available as text.

**Verify:**
```bash
npm run build && npm run typecheck && npm run lint
```

**Notes:**
- Both charts take their domain from `scoring.min_answer`/`max_answer` — fixed to the answer scale, never inferred from the data. An auto-scaled axis would make a 2.1 look like a strong result.
- Each chart is marked aria-hidden and is followed by a real table carrying the same numbers, so nothing is chart-only. Chart colours come from the CSS level tokens, which are already defined for both themes.
- Loaded through next/dynamic with ssr:false from ResultsView: recharts measures the DOM to size itself, so there is nothing for it to render server-side, and this keeps it off the initial payload.

---

### T-019 — Recommendations and strengths (FR-7)

**Status:** [x] done
**Depends on:** T-017, T-007

**Do:** `src/components/results/RecommendationList.tsx` and `StrengthList.tsx`.

- `RecommendationList` renders `buildRecommendations().improvements` in impact order. Each entry
  shows: rank, factor name, tier, current level (number + scale label), the recommendation text,
  and a quiet impact indicator explaining *why* it ranks where it does.
- Above the list, one sentence framing it: highest-impact actions first, ranked by how much the
  factor's weight and current gap affect the overall score.
- `StrengthList` renders the `strengths` (answered 5) in a de-emphasised section.
- If there are no improvements, say so positively rather than rendering an empty container.

**Files:** `src/components/results/{RecommendationList,StrengthList}.tsx`

**Acceptance:**
- Order matches the engine's output exactly — no re-sorting in the component.
- All text originates from `conf.yaml`.
- Empty and full cases both render sensibly.

**Verify:**
```bash
npm run test:run && npm run build && npm run lint
```

**Notes:**
- Neither component sorts or filters — they render `improvements` and `strengths` in the order the engine returns them. All text is from conf.yaml.
- The impact indicator is a bar scaled against the top-ranked item plus a sentence naming the actual points it would add, so the ranking explains itself rather than asking the reader to trust it.
- The no-improvements case renders a positive statement instead of an empty container; `StrengthList` renders nothing at all when there are no strengths, since a "Strengths: none" heading would be worse than silence.

---

## Phase 5 — Persistence

### T-020 — Storage adapters (write path)

**Status:** [x] done
**Depends on:** T-005

**Do:**

- `src/lib/storage/types.ts` — `export interface SubmissionStore { save(s: Submission): Promise<{ id: string }> }`
  (T-029 extends this interface with the read methods; do not add them yet.)
- `src/lib/storage/fs.ts` — writes `data/submissions/<id>.json`, creating the directory. Dev only.
- `src/lib/storage/postgres.ts` — `@neondatabase/serverless`, inserts one row per §6.3.
- `scripts/migrate.ts` — creates the table and index from §6.3. **Idempotent** (`if not exists`),
  safe to run on every deploy. `npm i -D tsx`, then add `"db:migrate": "tsx scripts/migrate.ts"`
  to scripts.
- `src/lib/storage/index.ts` — `getStore()` returns the Postgres adapter when `DATABASE_URL` is
  set, otherwise the filesystem adapter. If neither is usable, return a **no-op store that logs
  and resolves**, so a storage failure can never cost the respondent their result (OD-5).

**Files:** `src/lib/storage/{types,fs,postgres,index}.ts`, `scripts/migrate.ts`, `package.json`

**Acceptance:**
- Nothing outside `src/lib/storage/` and `scripts/` imports `@neondatabase/serverless` or `node:fs`.
- `data/submissions/` is gitignored.
- `npm run db:migrate` run twice in a row succeeds both times.
- Adapter selection is a single, readable function.
- `DATABASE_URL` is read from the environment only — never hardcoded, never `NEXT_PUBLIC_`.

**Verify:**
```bash
npm run typecheck && npm run lint && npm run build
```

**Notes:**
- Migration idempotency was verified for real: the DDL was extracted out of scripts/migrate.ts and run twice against a local Postgres. The second run emits only 'already exists, skipping' notices, and the resulting schema matches §6.3 column for column, including the (submitted_at desc, id desc) index. The neon() driver itself speaks HTTP to Neon and cannot be pointed at a local server, so the driver path is exercised on deploy, not here.
- `getStore()` also treats production-without-DATABASE_URL as a misconfiguration: it logs loudly and returns the no-op store rather than silently writing to an ephemeral serverless filesystem.
- The no-op store logs the submission id only — never the body, which is personal data.

---

### T-021 — `POST /api/submissions` (FR-9)

**Status:** [x] done
**Depends on:** T-020, T-006

**Do:** `src/app/api/submissions/route.ts`.

- `POST` only. Any other method → `405`.
- Validate the body against a zod schema matching §6.1. Invalid → `400` with the field paths.
- **Recompute the score server-side** from the submitted answers and store the server's numbers,
  not the client's. Never trust a client-supplied score in research data.
- Generate the id, stamp `submittedAt` server-side, attach `configVersion` from `conf.yaml`.
- Store `userAgent`. **Do not store the IP address.**
- Basic abuse guard: reject bodies over 32KB; reject if `answers` has keys not in the config.
- Return `200 { id }`. On a storage error, log it and still return `200 { id, stored: false }` —
  the user's result must not depend on the write succeeding.
- Add `export const runtime = 'nodejs'` (the filesystem adapter needs it).

**Files:** `src/app/api/submissions/route.ts`

**Acceptance:**
- Valid POST writes a JSON file locally matching §6.1.
- Malformed body returns 400 with useful detail.
- Client-supplied `result` values are ignored and overwritten.
- `GET /api/submissions` returns 405 — there is deliberately **no public read endpoint** (FR-10).
  Admin reads live under `/api/admin/*` and are separately authenticated (T-031).

**Verify:**
```bash
npm run build
# then, with the dev server running:
curl -sS -X POST localhost:3000/api/submissions -H 'content-type: application/json' \
  -d '{"respondent":{"designation":"Head of Product","experienceTechnicalYears":8,"experienceManagerialYears":4,"experienceDigitalisationYears":3,"highestQualification":"masters"},"answers":{"leadership":5,"strategy_governance":4,"people_culture":3,"technology":2,"research":4,"design":2,"development":3}}'
ls data/submissions/
```

**Notes:**
- Verified end to end against a running server: a valid POST writes data/submissions/<id>.json matching §6.1 exactly (the mixed worked example stored as 3.8021 / Level 4 Established); a body claiming `result.overallScore: 5` with all-1s answers was stored as 1.0 / Level 1, so the client's number is genuinely discarded; GET returns 405; a malformed body returns 400 naming the field path; an unknown factor id returns 400.
- Note the fs adapter only engages outside production — `npm run start` sets NODE_ENV=production, where getStore() correctly refuses the ephemeral serverless filesystem and logs instead. Use `npm run dev` to see files written locally.
- PUT/PATCH/DELETE return 405 alongside GET, with an Allow: POST header.

---

### T-022 — Wire submission into the flow

**Status:** [x] done
**Depends on:** T-021, T-016

**Do:** On "See my results" in `ReviewPanel`:

1. Set `submissionState = 'saving'`.
2. `POST` to `/api/submissions` with respondent + answers + `durationMs` (now − `startedAt`).
3. **Navigate to `/results` regardless of the outcome.** The score is computed client-side; the
   POST is for the researcher's dataset, not for the user's result.
4. On failure, show an unobtrusive note on the results page ("your response could not be saved for
   the study") — never a blocking error, never a lost result.
5. Guard against double submission (disable the button, and an in-flight ref).

**Files:** `src/components/survey/ReviewPanel.tsx`, `src/store/survey-store.ts`

**Acceptance:**
- Killing the API (or going offline) still gets the user to their results.
- Double-clicking the button produces exactly one submission.
- No PII is logged to the browser console.

**Verify:**
```bash
npm run build && npm run typecheck && npm run lint
```

**Notes:**
- Navigation to /results happens in a `finally`, so it runs whether the POST succeeds, fails or throws — offline still reaches the result.
- Double submission is guarded twice: the button disables on `submissionState === 'saving'`, and an `inFlight` ref covers two clicks landing in the same tick before React re-renders.
- The catch block deliberately logs nothing: the request body is personal data and the browser console is not a safe place for it. The failure surfaces as a quiet note on the results page instead.

---

## Phase 5b — Admin data access

> **Threat model for this phase, in one line:** the app is on a public URL, the survey is open to
> anyone, and the submissions contain names and job titles. The only thing standing between the
> open internet and that data is what you build here. Treat every shortcut as a leak.

### T-029 — Extend the storage layer with read + stream methods

**Status:** [x] done
**Depends on:** T-020

**Do:**

Extend `src/lib/storage/types.ts`:

```ts
export interface SubmissionListItem {
  id: string; submittedAt: string; configVersion: string;
  designation: string; overallScore: number; levelValue: number; levelName: string;
}
export interface ListOptions { limit: number; offset: number; }
export interface ListResult { items: SubmissionListItem[]; total: number; }

export interface SubmissionStore {
  save(s: Submission): Promise<{ id: string }>;
  list(o: ListOptions): Promise<ListResult>;
  get(id: string): Promise<Submission | null>;
  all(): AsyncIterable<Submission>;     // export path — MUST stream
  summary(): Promise<StoreSummary>;
}

export interface StoreSummary {
  total: number; last7Days: number; last30Days: number;
  meanOverallScore: number | null;
  levelDistribution: Record<1|2|3|4|5, number>;
  meanByFactor: Record<string, number>;
}
```

Implement in both adapters:

- **Postgres** — `list` uses `ORDER BY submitted_at DESC, id DESC LIMIT $1 OFFSET $2` plus a
  `COUNT(*)`. `summary` is SQL aggregation (`avg`, `count … group by level_value`, and
  `jsonb` extraction for the per-factor means) — **do not** pull rows into Node to average them.
  `all()` is an async generator using **keyset** pagination
  (`WHERE (submitted_at, id) < ($cursor_ts, $cursor_id) ORDER BY … LIMIT 500`), yielding batch by
  batch. Offset pagination would skip or duplicate rows if a submission arrives mid-export.
- **Filesystem** — same observable behaviour over `data/submissions/`, reading files lazily in
  `all()`.

`get` returns `null` for a missing id — it must never throw for "not found", because that is a
normal 404 path, not an error.

**Files:** `src/lib/storage/{types,fs,postgres}.ts`, `tests/storage.test.ts`

**Acceptance:**
- `all()` is an async generator. Memory stays flat whether there are 10 rows or 10,000.
- `all()` uses keyset pagination, not `OFFSET`.
- Test: seed 250 submissions into the fs adapter, assert `all()` yields exactly 250 with no
  duplicates, and `list({limit:20,offset:0}).total === 250`.
- Test: `get('does-not-exist')` resolves to `null`.
- **These read methods are called only from `src/app/api/admin/*` and `src/app/admin/*`.** No
  public route and no client component may import them.

**Verify:**
```bash
npm run test:run -- tests/storage.test.ts && npm run typecheck && npm run lint
```

**Notes:**
- Both adapters were verified. The fs adapter has 12 tests including the seeded 250: all() yields exactly 250 with no duplicates and in newest-first order across batch boundaries, list({limit:20,offset:0}).total is 250, and get('does-not-exist') resolves to null.
- The Postgres queries were run against a real local Postgres with seeded rows — the keyset page, the keyset continuation on (submitted_at, id) < (…), the filtered-count summary, the level distribution, and the jsonb_each unpivot for per-factor means all return correct results. The neon() HTTP driver cannot target a local server, so the driver wiring is exercised on deploy.
- `meanByFactor` uses a jsonb_each unpivot rather than one avg() per factor id, so the query never names a factor and stays correct when conf.yaml gains one.
- `get()` rejects ids containing a slash or '..' in the fs adapter — the id reaches it straight from a URL segment.
- `SubmissionListItem` carries `experienceDigitalisationYears` (a dashboard column in T-032) and deliberately no name; a test asserts the name never appears in a list row.

---

### T-030 — Admin session auth primitives

**Status:** [x] done
**Depends on:** T-002

**Do:**

`src/lib/auth/password.ts` (Node runtime only):

- `verifyAdminPassword(input: string): boolean`
- Compare against `process.env.ADMIN_PASSWORD` using a **timing-safe** comparison. Hash both sides
  with SHA-256 first so the buffers are always equal length — `crypto.timingSafeEqual` throws on a
  length mismatch, and a naive `===` leaks the password length and prefix through timing.
- Throw at module load if `ADMIN_PASSWORD` is missing or shorter than 12 characters. On a public
  URL a weak shared password *is* the entire attack surface; failing the build is the correct
  response.

`src/lib/auth/session.ts` — **must run on Edge**, so use `jose`, never `node:crypto`:

- `createSessionToken(): Promise<string>` — HS256 JWT: `sub: 'admin'`, `iat`, `exp` = now + 8h,
  signed with `ADMIN_SESSION_SECRET` (reject a secret shorter than 32 bytes).
- `verifySessionToken(token: string): Promise<boolean>` — verifies signature, expiry, and
  **pins the algorithm to `HS256`** via `jwtVerify(..., { algorithms: ['HS256'] })`. Without that
  pin an attacker can present `alg: none` or an algorithm-confusion token.
- `export const SESSION_COOKIE = 'dm_admin'` and a shared cookie-options object:
  `{ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 28800 }`.
  `httpOnly` is what stops any XSS on the public pages from stealing an admin session.

`src/lib/auth/rate-limit.ts`:

- Fixed-window counter keyed by a SHA-256 hash of the client IP: 5 attempts per 15 minutes, held
  in a module-level `Map` with expiry sweeping.
- **Write a comment stating the limitation honestly:** this is per-instance, so on serverless it is
  best-effort only — it raises the cost of brute force, it does not prevent it. The real defence is
  the length of `ADMIN_PASSWORD`.

`tests/auth.test.ts` — all of:
valid token round-trips · expired token rejected · token signed with a different secret rejected ·
tampered payload rejected · `alg: none` token rejected · `alg: RS256` token rejected ·
correct password accepted · wrong password rejected · wrong password of the same length rejected.

**Files:** `src/lib/auth/{password,session,rate-limit}.ts`, `tests/auth.test.ts`

**Acceptance:**
- No password, secret, or token is ever logged, returned in a response body, or included in an
  error message.
- `session.ts` imports nothing from `node:*`.
- Missing or weak env vars fail loudly at startup, not silently at first login.
- Every test above passes, including the `alg` confusion cases.

**Verify:**
```bash
npm run test:run -- tests/auth.test.ts && npm run typecheck && npm run lint
```

**Notes:**
- DEVIATION worth knowing: the plan says throw at MODULE LOAD when ADMIN_PASSWORD is missing or weak. It is validated on first use instead. `next build` imports every route module, so a module-load throw would make the build itself require the production secret — breaking local builds and CI, and tempting someone to commit a placeholder. The check still fires before anyone can authenticate, and `isAdminPasswordConfigured()` / `isSessionSecretConfigured()` let the login route report a misconfiguration without leaking it. Same reasoning for ADMIN_SESSION_SECRET.
- 20 tests pass, including the two that matter most: an `alg: none` token and an HS256 token relabelled RS256 are both rejected, because jwtVerify pins algorithms to ['HS256'].
- Tests also assert no secret appears in any thrown message.
- Rate limiting keys on a SHA-256 of the IP, so no raw address is held in memory, and the per-instance limitation is documented in the file itself.

---

### T-031 — Middleware gate + login/logout (FR-14, FR-17)

**Status:** [x] done
**Depends on:** T-030

**Do:**

`middleware.ts` at the repo root:

```ts
export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] };
```

- Let `/admin/login` and `/api/admin/login` through unauthenticated — otherwise nobody can ever
  log in. Everything else that matches requires a valid session.
- Read the `dm_admin` cookie and `verifySessionToken`. On failure:
  - `/api/admin/*` → `401 { "error": "unauthorized" }`, no other body content
  - `/admin/*` → redirect to `/admin/login`
- Set `X-Robots-Tag: noindex, nofollow` on every matched response.

`POST /api/admin/login` (`export const runtime = 'nodejs'`):

- Body `{ password: string }`. Rate-limit **first**, then verify, then set the cookie.
- Wrong password → `401 { "error": "invalid credentials" }`. The response must be **identical**
  whether the password was wrong, the body was malformed, or the field was missing — never explain
  *why* authentication failed.
- Rate-limited → `429` with a `Retry-After` header.
- On success, set the session cookie and return `204`. Do not return the token in the body.

`POST /api/admin/logout` — clears the cookie, returns `204`.

`src/app/admin/login/page.tsx` — a minimal password form. `robots: { index: false, follow: false }`
in its metadata. **Nothing on the public site links to it** — the researcher navigates there
directly.

**Files:** `middleware.ts`, `src/app/api/admin/{login,logout}/route.ts`,
`src/app/admin/login/page.tsx`, `src/components/admin/LoginForm.tsx`

**Acceptance:**
- Unauthenticated `GET /admin` → redirect to `/admin/login`.
- Unauthenticated `GET /api/admin/submissions` → `401`, and the body contains no submission data.
- A cookie with a tampered payload is rejected.
- Six rapid wrong-password attempts: the sixth returns `429`.
- After a successful login, `GET /admin` returns `200`; after logout it redirects again.
- No public page anywhere links to `/admin`.

**Verify:**
```bash
npm run build
# with the dev server running:
curl -sS -o /dev/null -w '%{http_code}\n' localhost:3000/api/admin/submissions          # expect 401
curl -sS -o /dev/null -w '%{http_code}\n' -L localhost:3000/admin                        # lands on login
curl -sS -X POST localhost:3000/api/admin/login -H 'content-type: application/json' \
     -d '{"password":"wrong"}' -o /dev/null -w '%{http_code}\n'                          # expect 401
curl -sS -X POST localhost:3000/api/admin/login -H 'content-type: application/json' \
     -d "{\"password\":\"$ADMIN_PASSWORD\"}" -c /tmp/dm.jar -o /dev/null -w '%{http_code}\n'  # expect 204
curl -sS -b /tmp/dm.jar -o /dev/null -w '%{http_code}\n' localhost:3000/api/admin/submissions # expect 200
```

**Notes:**
- Verified against a production build, all 14 checks: unauthenticated /api/admin/* returns 401 with only {"error":"unauthorized"}; /admin 307s to /admin/login; wrong password 401; correct password 204 with an HttpOnly cookie; authenticated /admin 200; X-Robots-Tag: noindex, nofollow on matched responses; a cookie with a forged payload is rejected on both surfaces; the sixth rapid wrong password returns 429 with Retry-After: 900; logout 204 and /admin redirects again.
- All four login failure modes — wrong password, non-JSON body, missing field, wrong field type — return byte-identical 401s, checked side by side from a fresh client IP.
- Added `src/lib/auth/guard.ts` (`hasAdminSession()`) as the shared second gate, and a placeholder `src/app/admin/page.tsx` that already uses it; T-032 fills in the dashboard.
- No public page, layout or component links to /admin — grepped.

---

### T-032 — Admin dashboard (FR-15)

**Status:** [x] done
**Depends on:** T-031, T-029

**Do:** `src/app/admin/page.tsx` — server component, `export const dynamic = 'force-dynamic'`.

- **Check the session again, server-side, in the page itself.** The middleware is a convenience,
  not the only gate (NFR-6). If the matcher is ever misconfigured or a future Next.js version
  changes matching behaviour, this page must still refuse.
- `SummaryStats` — from `store.summary()`: total submissions, last 7 and 30 days, mean overall
  score, level distribution (count per level 1–5), and mean answer per factor. Rendered as text
  and a small bar per level, reusing the `--level-N` tokens.
- `SubmissionTable` — 25 per page, columns: submitted date, designation, years in digitalisation,
  overall score, level. Each row links to `/admin/submissions/[id]`.
- Pagination via a `?page=` search param.
- `ExportButtons` (CSV / JSON) — wired in T-034.
- A logout button posting to `/api/admin/logout`.
- An empty state for when no submissions exist yet — the researcher will hit this on day one, and
  it must read as "nothing yet", not as "something broke".

**Files:** `src/app/admin/page.tsx`,
`src/components/admin/{SummaryStats,SubmissionTable,ExportButtons}.tsx`

**Acceptance:**
- `dynamic = 'force-dynamic'` — the page is never statically cached with real data baked in.
- An explicit server-side session check exists **in addition to** the middleware.
- Respondent **names are not shown in the table** — designation only. Names appear only on the
  detail page (T-033). This keeps a shoulder-surfed dashboard from exposing every participant.
- Aggregates come from `store.summary()`, not from fetching all rows into the page.
- The wide table sits in its own `overflow-x: auto` container.

**Verify:**
```bash
npm run build && npm run typecheck && npm run lint
```

**Notes:**
- Verified with three seeded submissions: summary stats (total 3, mean 2.77), level distribution, per-factor means and the table all render correctly, and grepping the rendered HTML for the seeded respondent names returns 0 matches — designation only, as required. With the data removed the page reads "No submissions yet", not an error.
- Aggregates come from `store.summary()`; the page never fetches all rows.
- Two gates: the middleware matcher, plus `hasAdminSession()` called in the page body before anything is read.
- Added `src/components/admin/LogoutButton.tsx` — the logout POST needs a client boundary and did not belong inside ExportButtons.
- ExportButtons are plain links rather than fetch-and-blob, so the browser streams a large download natively instead of buffering it in the tab.

---

### T-033 — Submission detail view (FR-15)

**Status:** [x] done
**Depends on:** T-032

**Do:** `src/app/admin/submissions/[id]/page.tsx` — server component, `force-dynamic`.

- Server-side session check, same as T-032.
- Show: the full respondent record (including name, if given), every factor with the answer value,
  its scale label, and the full statement text the respondent chose; tier scores; overall score;
  resolved maturity level; and the submission metadata (`submittedAt`, `configVersion`,
  `durationMs`, user agent).
- **Recompute the score from the stored answers** and compare against the stored `result`. If they
  differ, show a clear warning naming the `configVersion` the response was collected under — a
  mismatch means `conf.yaml` changed after this response was recorded, which matters a great deal
  when the numbers end up in a dissertation.
- Unknown id → `notFound()`.
- A "back to dashboard" link.

**Files:** `src/app/admin/submissions/[id]/page.tsx`

**Acceptance:**
- Statement text is resolved through the config, not stored per-submission.
- The config-drift warning triggers: test it by editing a weight in `conf.yaml` and reloading a
  detail page for an existing submission.
- Unknown id returns a real 404, not a crash and not an empty page.

**Verify:**
```bash
npm run build && npm run typecheck && npm run lint
```

**Notes:**
- Verified live: the detail page shows the full respondent record including the name, every factor with its answer, scale label and the statement text resolved through config, tier scores with weights, and the metadata block. An unknown id returns a real 404; unauthenticated access 307s to the login page.
- The drift warning was tested for real by editing two factor weights and bumping meta.version, then restarting: it reports "collected under 1.0.0, current is 1.1.0-drift-test, recomputing gives 2.1580 (Level 2) where the stored result was 2.2399 (Level 2)". conf.yaml was restored afterwards.
- Worth knowing for the next task: `loadConfig()` caches per process, so editing conf.yaml under a running dev server changes nothing until it restarts. That is correct behaviour, but it makes drift look absent if you test it without a restart.
- Drift is flagged on the score OR the level OR a recompute that throws outright (a factor removed from config), not on the version string alone — a version bump that does not move the numbers is not worth alarming the researcher about.

---

### T-034 — CSV / JSON export (FR-16)

**Status:** [x] done
**Depends on:** T-032

**Do:**

`src/lib/export/csv.ts`:

- `toCsvRow(values: string[]): string` — RFC 4180 quoting: wrap in `"` when the value contains a
  comma, a quote, `\n` or `\r`, and escape embedded quotes by doubling them.
- **CSV injection defence.** Any cell whose first character is `=`, `+`, `-`, `@`, tab or carriage
  return gets prefixed with a single quote. Respondents type free text into `name` and
  `designation`, and the researcher will open this file in Excel — `=HYPERLINK(...)` in a
  designation field is the one genuinely exploitable hole in an otherwise read-only feature.
- `buildHeader(config)` and `submissionToFlatRow(config, submission)` — one row per submission:
  `id`, `submittedAt`, `configVersion`, each respondent field, each factor answer (column per
  factor), each tier score, `overallScore`, `levelValue`, `levelName`.
  **Column order is derived from `conf.yaml`**, so adding a factor adds a column with no code change.

`GET /api/admin/export?format=csv|json` (`runtime = 'nodejs'`):

- Session-checked by middleware **and** explicitly in the handler.
- Streams the response with a `ReadableStream` fed by `store.all()`. Never build the whole file in
  memory — a serverless function has a hard memory ceiling and the researcher may export
  everything at once.
- `Content-Disposition: attachment; filename="dm-submissions-YYYY-MM-DD.csv"`.
- CSV: `Content-Type: text/csv; charset=utf-8`, and emit a **UTF-8 BOM** first so Excel renders
  accented characters correctly.
- JSON: streams a JSON array of the full §6.1 documents.
- An unknown `format` → `400`.

`tests/csv.test.ts`:
- fields containing `,`, `"`, and `\n` are quoted and escaped correctly
- `=HYPERLINK("http://evil")`, `+1+1`, `-1+1`, `@SUM(A1)` are all neutralised
- header row matches the config's factor order
- adding a factor to a fixture config adds exactly one column, in the right position
- a `null` / missing optional `name` produces an empty cell, not `"undefined"`

**Files:** `src/lib/export/csv.ts`, `src/app/api/admin/export/route.ts`, `tests/csv.test.ts`

**Acceptance:**
- Exporting 1,000 submissions does not load them all into memory (verify by reading the code path,
  and by seeding the fs adapter and watching it stream).
- Opening the exported CSV in a spreadsheet executes nothing.
- An unauthenticated export request returns `401` and no data.
- The CSV opens cleanly in Excel with correct encoding.

**Verify:**
```bash
npm run test:run -- tests/csv.test.ts && npm run build
# authenticated (reusing the cookie jar from T-031):
curl -sS -b /tmp/dm.jar 'localhost:3000/api/admin/export?format=csv' | head -3
curl -sS -o /dev/null -w '%{http_code}\n' 'localhost:3000/api/admin/export?format=csv'  # expect 401
```

**Notes:**
- Streaming was measured, not assumed. Seeded 2,004 submissions: time-to-first-byte 8ms against a 204ms total, and instrumenting the store.all() -> CSV path directly showed the heap oscillating between 12 and 20 MB (the 500-document batch being allocated and collected) and settling back to +0.3 MB after GC. Watching the dev server's RSS first suggested a climb — that was Next's own compilation cache and Node not returning RSS to the OS, not the export path.
- Injection defence verified end to end with a hostile fixture: a designation of =HYPERLINK("http://evil","click me") exports as "'=HYPERLINK(""http://evil"",""click me"")" — prefixed and quote-doubled — and a name of Perera, "Anil" round-trips correctly.
- Only a LEADING formula character is prefixed; one mid-string is quoted but left alone, since that is what a spreadsheet actually acts on.
- The BOM is emitted, unauthenticated export returns 401 with no data, and an unknown format returns 400.
- Note for analysis: scores are exported at full float precision (e.g. 3.0000000000000004), matching the stored document rather than the 2dp display. That is deliberate — the CSV is data, not a report — but it will look odd in a spreadsheet.

---

### T-035 — Access-control audit (FR-17, NFR-6)

**Status:** [x] done
**Depends on:** T-034

This task exists because "users should not be able to access this" is a requirement, and a
requirement you have not tested is a requirement you have not met.

**Do:**

Write `tests/access-control.test.ts` as a table test against a running production build. For an
**unauthenticated** client, assert every route's status exactly:

| Route | Method | Expected |
|---|---|---|
| `/` | GET | 200 |
| `/model` | GET | 200 |
| `/survey` | GET | 200 |
| `/results` | GET | 200 |
| `/api/submissions` | POST | 200 |
| `/api/submissions` | GET | 405 |
| `/admin` | GET | 307 → `/admin/login` |
| `/admin/login` | GET | 200 |
| `/admin/submissions/whatever` | GET | 307 → `/admin/login` |
| `/api/admin/submissions` | GET | 401 |
| `/api/admin/export?format=csv` | GET | 401 |
| `/api/admin/export?format=json` | GET | 401 |
| `/api/admin/logout` | POST | 401 |

Then repeat with a valid session and assert the admin routes return 200/204 while the public
routes still behave.

Also assert, for the unauthenticated responses, that **no response body contains a known seeded
respondent name** — status codes alone do not prove data did not leak.

Then complete the manual sweep:

- `public/robots.txt` — `Disallow: /admin` and `Disallow: /api/admin`.
- `robots: { index: false, follow: false }` metadata on every admin page.
- Security headers in `next.config.ts`: `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`.
- **No secret reaches the browser:**
  `! grep -rq "ADMIN_PASSWORD\|ADMIN_SESSION_SECRET\|DATABASE_URL" .next/static/`
- No `NEXT_PUBLIC_*` variable holds anything admin- or database-related.
- No file under `src/app/(public routes)`, and no client component, imports from
  `src/lib/auth/` or calls `store.list/get/all/summary`.

**Files:** `tests/access-control.test.ts`, `public/robots.txt`, `next.config.ts`

**Acceptance:**
- Every row of the table passes, unauthenticated and authenticated.
- No seeded respondent name appears in any unauthenticated response body.
- No secret appears anywhere in `.next/static/`.
- The import-boundary grep comes back clean.

**Verify:**
```bash
npm run build
npm run test:run -- tests/access-control.test.ts
! grep -rq "ADMIN_PASSWORD\|ADMIN_SESSION_SECRET\|DATABASE_URL" .next/static/ && echo "no secrets in client bundle"
grep -rn "lib/auth" src/components src/app --include=*.tsx | grep -v "app/admin" || echo "no public->auth imports"
```

**Notes:**
- 32 tests, run against a real `next start` production server. Every row of the §8 table passes unauthenticated and authenticated.
- The leak test was initially weaker than it looked: with no DATABASE_URL the production server selects the no-op store, so nothing was persisted and "no name leaked" would only have proved no data existed. Added an explicit `SUBMISSION_STORE=fs` opt-in (documented in index.ts as test-only), so the audit seeds a real submission, asserts `stored: true`, then proves the name and id appear in the AUTHENTICATED detail page and CSV while appearing in NO unauthenticated response body.
- The manual sweep is now automated as four import-boundary tests that run on every `npm test`, rather than a grep that is only true on the day someone runs it: lib/auth reachable only from admin routes; no client component imports storage or auth at runtime (type-only imports are allowed, since they are erased); store.list/get/all/summary called only from admin surfaces; no NEXT_PUBLIC_ variable carrying admin or database config; the filesystem-reading config loader never in a client component.
- The read-method check first flagged `guard.ts` — a false positive on `store.get(SESSION_COOKIE)`, the cookie store. Renamed that local to `cookieStore`, which is clearer regardless.
- Verified separately: no secret name or value appears anywhere in .next/static/ or .next/. robots.txt disallows /admin and /api/admin; the three security headers are set in next.config.ts and asserted on a live response.

---



### T-023 — PDF document component (FR-8)

**Status:** [x] done
**Depends on:** T-019

**Do:** `src/components/pdf/ResultsPdfDocument.tsx` using `@react-pdf/renderer`.

Pages/sections:
1. Title, `meta.title`, generation date, and the respondent's designation (name only if given).
2. Overall score, maturity level with name/subtitle/headline/description/characteristics.
3. Tier scores table with weights.
4. Full answer table: factor, tier, chosen level, statement text.
5. Recommendations in impact order, with the factor name and current level.
6. Strengths.
7. Footer with a one-line method note and the `configVersion`.

Constraints:
- **Use `@react-pdf/renderer` primitives only** (`Document`, `Page`, `View`, `Text`, `StyleSheet`).
  Standard fonts only — no remote font fetching.
- No `html2canvas`, no screenshotting the DOM. Charts are omitted from the PDF; the tables carry
  the numbers.
- Must paginate cleanly — long recommendation text may not be clipped.

**Files:** `src/components/pdf/ResultsPdfDocument.tsx`

**Acceptance:**
- Generated PDF is text-selectable, not an image.
- Content matches the results page exactly.
- No content clipped at page breaks.

**Verify:**
```bash
npm run build && npm run typecheck && npm run lint
```

**Notes:**
- Rendered a real PDF and inspected the file rather than trusting the component: 3 pages, fonts Helvetica and Helvetica-Bold only (no remote fetching), ZERO image XObjects (nothing screenshotted), and 187 text-showing operators — the output is genuinely selectable text.
- Extracted the text back out and diffed it against conf.yaml: all 7 statements and all 7 recommendation texts appear in full, so nothing is clipped at a page break. The recommendation order matches the engine exactly (People & Culture 0.27, Strategy 0.26, Development 0.22, Design 0.21, Technology 0.13, Research 0.12) with Leadership in Strengths.
- FIXED a real defect this inspection caught: @react-pdf hyphenates by default, which in the narrow table columns produced "Organisational En-ablers" and "trans-formation" — 8 bad breaks. `Font.registerHyphenationCallback((word) => [word])` disables it and words now wrap intact (0 bad breaks).
- Every long block uses wrap={false} so a recommendation moves whole to the next page rather than splitting.

---

### T-024 — Download button

**Status:** [x] done
**Depends on:** T-023

**Do:** `src/components/pdf/DownloadPdfButton.tsx`.

- Client component. **Dynamically import** `@react-pdf/renderer` (`ssr: false`) so it stays out of
  the server bundle and off the initial page load.
- Generate a blob on click, then trigger the download. Filename:
  `digital-maturity-{level-name-lowercased}-{YYYY-MM-DD}.pdf`.
- Show a loading state while generating, and revoke the object URL afterwards.
- On failure, show a retry, not a dead button.

**Files:** `src/components/pdf/DownloadPdfButton.tsx`, wired into `src/app/results/page.tsx`

**Acceptance:**
- The PDF library is not in the initial JS payload (confirm in the build output).
- Download works in Chrome, Firefox and Safari.
- Button has an accessible name and a busy state.

**Verify:**
```bash
npm run build   # check @react-pdf is in a separate chunk, not the entry
npm run lint
```

**Notes:**
- Confirmed against the built output rather than assumed: /results ships 8 chunks totalling 583 KB up front, and NONE of them contain @react-pdf. The library sits in its own 1,266 KB chunk that is fetched only when the button is clicked.
- Both `@react-pdf/renderer` and the document component are imported inside the click handler (not via next/dynamic at module scope), which is what keeps them out of the server bundle entirely as well as off the initial load.
- The object URL is revoked on a 10s timer rather than immediately — revoking synchronously after `click()` cancels the download in some browsers.
- Failure shows a retry affordance and a status message, never a dead button; the catch logs nothing, because the document contains the respondent's answers.

---

## Phase 7 — Hardening & ship

### T-025 — Accessibility and responsive pass

**Status:** [ ] pending
**Depends on:** T-024

**Do:** Sweep every page against NFR-1 and NFR-2.

- Keyboard-only walkthrough of the entire flow, start to PDF download. Fix every trap and every
  invisible focus state.
- Heading hierarchy: one `h1` per page, no skipped levels.
- Contrast ≥4.5:1 for body text and ≥3:1 for UI boundaries, in **both** themes — check the level
  colours in particular; `#C9962F` on white is the likely failure.
- 320px width: no horizontal page scroll. Wide tables get their own `overflow-x: auto` container.
- Every form control has a label; every error is associated via `aria-describedby`.
- `prefers-reduced-motion` respected by any transition.
- Charts have text equivalents (done in T-018 — verify it survived).
- **Admin pages too** — the login form needs a labelled password field and a proper error
  association; the submissions table is wide and needs its own `overflow-x: auto` container.

**Files:** across the app

**Acceptance:**
- Full flow completable with keyboard only.
- No contrast failures in light or dark.
- No horizontal scroll at 320px on any page.

**Verify:**
```bash
npm run build && npm run lint
```

**Notes:**

---

### T-026 — Error, empty and loading states

**Status:** [ ] pending
**Depends on:** T-025

**Do:**

- `src/app/not-found.tsx` — a real 404 with a route back to `/`.
- `src/app/error.tsx` — client error boundary with a reset action; never leaks a stack trace to
  the user.
- Loading state for `/results` while the store rehydrates — this prevents a flash of the empty
  state on refresh, which would otherwise look like data loss.
- A guard on `/survey` and `/results` for the "config failed to load" case.
- Confirm before `reset()` wipes an in-progress survey.

**Files:** `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/results/loading.tsx`

**Acceptance:**
- Refreshing `/results` mid-session does not flash the empty state.
- A thrown error in a page shows the boundary, not a white screen.

**Verify:**
```bash
npm run build && npm run lint
```

**Notes:**

---

### T-027 — README + Vercel deployment (FR-13)

**Status:** [ ] pending
**Depends on:** T-026

**Do:** Write `README.md` covering:

- What the tool is, and a screenshot or two.
- Local setup: `npm install`, `npm run dev`, Node 20+.
- **How to edit the survey** — the section a non-developer actually needs. Explain `conf.yaml`:
  how to change a question, add a factor, change weights (and that each tier's weights must sum
  to 1), and change the maturity bands. Point out that `npm run build` fails loudly on a bad
  config, which is the safety net.
- How scoring works, with the §3.6 worked example.
- Deployment: import the repo into Vercel, attach a Neon Postgres database, set the environment
  variables below, run `npm run db:migrate`, deploy.
- **"Getting your data out"** — the section the researcher will actually use. Go to `/admin`
  (not linked from anywhere), log in with `ADMIN_PASSWORD`, review the dashboard, click
  *Export CSV*. Note that the CSV has one row per respondent and one column per factor, ready to
  drop into SPSS, R, or Excel. Mention that `/admin` is deliberately unlinked and `noindex`.
- **Admin password guidance** — must be ≥12 characters, set only in Vercel's environment
  variables, never committed, and changed if it is ever shared. Explain that changing
  `ADMIN_SESSION_SECRET` immediately logs out any existing session, which is the way to revoke
  access.
- The open decisions from §7 that the project owner still needs to confirm — especially **OD-9**
  (retention and PII), which needs to line up with the study's ethics approval.

Also add `.env.example` documenting, with comments and no real values:

```
DATABASE_URL=            # Neon Postgres connection string
ADMIN_PASSWORD=          # >= 12 chars; admin login for /admin
ADMIN_SESSION_SECRET=    # >= 32 random bytes; rotating this revokes all sessions
```

Confirm `.env*` (except `.env.example`) is gitignored.

**Files:** `README.md`, `.env.example`

**Acceptance:**
- A reader who is not a developer can change a question and a weight from the README alone.
- A reader who is not a developer can retrieve the collected data from the README alone.
- No secrets in the repo; `.env.example` contains placeholders only.
- Deploy to Vercel succeeds, the full respondent flow works on the deployed URL, and `/admin`
  is reachable with the password and refuses without it.

**Verify:**
```bash
npm run build && npm run test:run
```

**Notes:**

---

### T-028 — *(optional)* Playwright smoke test

**Status:** [ ] pending
**Depends on:** T-027

**Do:** `npm i -D @playwright/test && npx playwright install chromium`.

`e2e/happy-path.spec.ts`: landing → start → fill respondent form → answer all 7 → review →
results → assert the score text is present → click download and assert a PDF download event.

`e2e/admin.spec.ts`: unauthenticated `/admin` redirects to the login page → log in → the
submission just created by the happy-path test is visible in the table → open its detail page →
export CSV and assert the downloaded file contains that submission's id.

Add `"test:e2e": "playwright test"`.

**Files:** `playwright.config.ts`, `e2e/happy-path.spec.ts`, `package.json`

**Acceptance:**
- Passes against a local production build.
- Asserts a specific expected score, not merely that a number is present.

**Verify:**
```bash
npm run build && npm run test:e2e
```

**Notes:**

---

## 9. Traceability check (run before calling the project done)

| Requirement | Delivered by | Verified |
|---|---|---|
| FR-1 landing page | T-010 | [ ] |
| FR-2 static theory page | T-011 | [ ] |
| FR-3 conf.yaml drives everything | T-003, T-004 | [ ] |
| FR-4 one question at a time | T-015 | [ ] |
| FR-5 review submitted answers | T-016 | [ ] |
| FR-6 final score | T-006, T-017 | [ ] |
| FR-7 recommendations | T-007, T-019 | [ ] |
| FR-8 PDF download | T-023, T-024 | [ ] |
| FR-9 JSON storage | T-020, T-021 | [ ] |
| FR-10 no retrieval | T-012 (sessionStorage), T-021 (no GET) | [ ] |
| FR-11 general information | T-013 | [ ] |
| FR-12 maturity level | T-006, T-017 | [ ] |
| FR-13 Vercel deployment | T-027 | [ ] |
| FR-14 admin authentication | T-030, T-031 | [ ] |
| FR-15 admin list, view, statistics | T-029, T-032, T-033 | [ ] |
| FR-16 CSV / JSON export | T-034 | [ ] |
| FR-17 respondents locked out of admin | T-031, T-035 | [ ] |
| NFR-1 responsive | T-025 | [ ] |
| NFR-2 accessibility | T-025 | [ ] |
| NFR-3 engine tests | T-006, T-007 | [ ] |
| NFR-4 config-only changes | T-004, T-010, T-015 | [ ] |
| NFR-5 refresh-safe progress | T-012 | [ ] |
| NFR-6 two-layer admin gate | T-031, T-032, T-035 | [ ] |
| NFR-7 streaming export | T-029, T-034 | [ ] |

---

## 10. Prompt to give a smaller model

Copy this verbatim:

> Read `docs/plan.md`. Find the first task in the Task Board (§8) whose status is `[ ]`.
> Check its dependencies are all `[x]`; if not, do the earliest unmet dependency instead.
> Implement **that one task only**, exactly as specified — create the files listed, meet every
> acceptance bullet, and run the `Verify:` command until it passes.
> Then run the Definition of Done checks in §0.1.
> Then mark the task `[x]` in both the Task Board and the task's own `**Status:**` line, add a
> line under its `**Notes:**` if anything deviated, and commit as `feat(T-0XX): <title>`.
> Do not start the next task. Report what you did and stop.
