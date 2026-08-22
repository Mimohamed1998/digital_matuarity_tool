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

Non-functional:

| # | Requirement |
|---|---|
| NFR-1 | Works on mobile and desktop; no horizontal page scroll |
| NFR-2 | WCAG 2.1 AA: keyboard operable, labelled controls, ≥4.5:1 text contrast, light + dark |
| NFR-3 | Scoring engine covered by unit tests, including exact worked examples |
| NFR-4 | Changing `conf.yaml` alone can add/remove a factor or a whole tier, with **no code change** |
| NFR-5 | Survey progress survives an accidental page refresh (sessionStorage), but is not retrievable later |

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
| Storage | **Vercel Blob** in prod, local filesystem in dev, behind one interface | Requirement is write-only JSON; Blob is the least infrastructure |
| Unit tests | **Vitest** | Fast, zero-config with TS |
| E2E (optional) | **Playwright** | One happy-path smoke test |

Node 20+. Package manager: **npm** (keep it boring; `package-lock.json` is committed).

---

## 5. Target repository layout

```
.
├── conf.yaml                          # THE survey configuration — single source of truth
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
│   │   └── api/submissions/route.ts   # FR-9
│   ├── components/
│   │   ├── ui/{Button,Card,Field,ProgressBar,RadioStatement}.tsx
│   │   ├── survey/{RespondentForm,QuestionCard,SurveyNav,ReviewPanel}.tsx
│   │   ├── results/{ScoreHeadline,TierBreakdown,FactorRadar,RecommendationList,StrengthList}.tsx
│   │   └── pdf/{ResultsPdfDocument.tsx,DownloadPdfButton.tsx}
│   ├── lib/
│   │   ├── config/{schema.ts,load.ts}
│   │   ├── scoring/{engine.ts,recommend.ts,index.ts}
│   │   ├── storage/{types.ts,blob.ts,fs.ts,index.ts}
│   │   └── format.ts
│   ├── store/survey-store.ts
│   └── types/domain.ts
├── tests/
│   ├── scoring.test.ts
│   ├── recommend.test.ts
│   └── config.test.ts
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

## 7. Open decisions & assumptions

These are decided so that implementation is never blocked. Each has a safe default and is
config-driven, so reversing one is cheap. **Flag them to the project owner.**

| ID | Question | Decision taken | How to reverse |
|---|---|---|---|
| **OD-1** | Is the tier combination a weighted sum or a product? | **Weighted sum.** Reasoning in §3.2. | `scoring.formula` in `conf.yaml` |
| **OD-2** | What are the score→level band thresholds? *(not in source document)* | Equal-width bands over [1,5]: 1.8 / 2.6 / 3.4 / 4.2 | `maturity_levels[].min_score` in `conf.yaml` |
| **OD-3** | Where does recommendation text come from? *(not in source document)* | Authored in `conf.yaml`, one per factor per level 1–5, phrased as "how to reach the next level". Draft text supplied in T-003 — **owner should review the wording**. | Edit `conf.yaml` |
| **OD-4** | Is the respondent's name required? | **Optional**, with a consent checkbox before submit. Reduces PII risk and lifts completion rate. | `respondent_fields[].required` in `conf.yaml` |
| **OD-5** | Storage backend on Vercel | **Vercel Blob** (`@vercel/blob`), one JSON object per submission. Filesystem adapter for local dev. If `BLOB_READ_WRITE_TOKEN` is absent in prod, the API logs the payload and still returns 200 — the user must never lose their result over a storage outage. | Swap `src/lib/storage/index.ts` |
| **OD-6** | "Product Development" box in the diagram | Treated as a **grouping label** for Research/Design/Development, not a scored factor. There is no 8th question in the source. | Add a factor to `conf.yaml` |
| **OD-7** | Per-factor level 5 label | Questionnaire says "Advanced", pyramid says "Optimised". **Both kept**, in separate config sections. | `scale_labels` vs `maturity_levels` |

---

## 8. Task Board

Legend: `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked (say why in Notes)

### Phase 0 — Foundation
- [ ] **T-001** Scaffold the Next.js + TypeScript + Tailwind project
- [ ] **T-002** Install dependencies and wire up tooling (Vitest, lint, scripts)
- [ ] **T-003** Author `conf.yaml` — the complete survey configuration

### Phase 1 — Domain core (pure, testable, no UI)
- [ ] **T-004** Config schema (zod) + loader
- [ ] **T-005** Domain types
- [ ] **T-006** Scoring engine + unit tests
- [ ] **T-007** Recommendation engine + unit tests

### Phase 2 — App shell
- [ ] **T-008** Root layout, design tokens, global styles (light + dark)
- [ ] **T-009** Base UI primitives (`Button`, `Card`, `Field`, `ProgressBar`, `RadioStatement`)
- [ ] **T-010** Landing page (FR-1)
- [ ] **T-011** Model / theory page (FR-2)

### Phase 3 — Survey flow
- [ ] **T-012** Survey store (zustand + sessionStorage)
- [ ] **T-013** Respondent information step (FR-11)
- [ ] **T-014** Question card component
- [ ] **T-015** Survey page orchestration — one question at a time (FR-4)
- [ ] **T-016** Review step — read back submitted answers (FR-5)

### Phase 4 — Results
- [ ] **T-017** Results page shell + score headline + level band (FR-6, FR-12)
- [ ] **T-018** Tier breakdown + factor radar charts
- [ ] **T-019** Recommendations and strengths lists (FR-7)

### Phase 5 — Persistence
- [ ] **T-020** Storage adapters (Blob + filesystem) behind one interface
- [ ] **T-021** `POST /api/submissions` route (FR-9)
- [ ] **T-022** Wire submission into the survey completion flow

### Phase 6 — PDF
- [ ] **T-023** PDF document component (FR-8)
- [ ] **T-024** Download button + client-only wiring

### Phase 7 — Hardening & ship
- [ ] **T-025** Accessibility and responsive pass (NFR-1, NFR-2)
- [ ] **T-026** Error, empty and loading states + `not-found`
- [ ] **T-027** README + Vercel deployment configuration (FR-13)
- [ ] **T-028** *(optional)* Playwright happy-path smoke test

---

## Phase 0 — Foundation

### T-001 — Scaffold the Next.js + TypeScript + Tailwind project

**Status:** [ ] pending
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

---

### T-002 — Install dependencies and wire up tooling

**Status:** [ ] pending
**Depends on:** T-001

**Do:**

```bash
npm install js-yaml zod zustand recharts @react-pdf/renderer @vercel/blob
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

---

### T-003 — Author `conf.yaml`

**Status:** [ ] pending
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

---

## Phase 1 — Domain core

### T-004 — Config schema (zod) + loader

**Status:** [ ] pending
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

---

### T-005 — Domain types

**Status:** [ ] pending
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

---

### T-006 — Scoring engine + unit tests

**Status:** [ ] pending
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

---

### T-007 — Recommendation engine + unit tests

**Status:** [ ] pending
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

---

## Phase 2 — App shell

### T-008 — Root layout, design tokens, global styles

**Status:** [ ] pending
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

---

### T-009 — Base UI primitives

**Status:** [ ] pending
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

---

### T-010 — Landing page (FR-1)

**Status:** [ ] pending
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

---

### T-011 — Model / theory page (FR-2)

**Status:** [ ] pending
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

---

## Phase 3 — Survey flow

### T-012 — Survey store

**Status:** [ ] pending
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

---

### T-013 — Respondent information step (FR-11)

**Status:** [ ] pending
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

---

### T-014 — Question card component

**Status:** [ ] pending
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

---

### T-015 — Survey page orchestration (FR-4)

**Status:** [ ] pending
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

---

### T-016 — Review step (FR-5)

**Status:** [ ] pending
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

---

## Phase 4 — Results

### T-017 — Results page + score headline (FR-6, FR-12)

**Status:** [ ] pending
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

---

### T-018 — Tier breakdown + factor radar

**Status:** [ ] pending
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

---

### T-019 — Recommendations and strengths (FR-7)

**Status:** [ ] pending
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

---

## Phase 5 — Persistence

### T-020 — Storage adapters

**Status:** [ ] pending
**Depends on:** T-005

**Do:**

- `src/lib/storage/types.ts` — `export interface SubmissionStore { save(s: Submission): Promise<{ id: string }> }`
- `src/lib/storage/fs.ts` — writes `data/submissions/<id>.json`, creating the directory. Dev only.
- `src/lib/storage/blob.ts` — `@vercel/blob` `put(\`submissions/${id}.json\`, …)`, access `'private'`.
- `src/lib/storage/index.ts` — `getStore()` picks Blob when `BLOB_READ_WRITE_TOKEN` is set,
  otherwise filesystem. If neither is usable, return a **no-op store that logs and resolves**, so
  a storage failure can never cost the user their result (OD-5).

**Files:** `src/lib/storage/{types,fs,blob,index}.ts`

**Acceptance:**
- Nothing outside `src/lib/storage/` imports `@vercel/blob` or `node:fs`.
- `data/submissions/` is gitignored.
- Adapter selection is a single function that is easy to read.

**Verify:**
```bash
npm run typecheck && npm run lint && npm run build
```

**Notes:**

---

### T-021 — `POST /api/submissions` (FR-9)

**Status:** [ ] pending
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
- `GET /api/submissions` returns 405 — there is deliberately **no read endpoint** (FR-10).

**Verify:**
```bash
npm run build
# then, with the dev server running:
curl -sS -X POST localhost:3000/api/submissions -H 'content-type: application/json' \
  -d '{"respondent":{"designation":"Head of Product","experienceTechnicalYears":8,"experienceManagerialYears":4,"experienceDigitalisationYears":3,"highestQualification":"masters"},"answers":{"leadership":5,"strategy_governance":4,"people_culture":3,"technology":2,"research":4,"design":2,"development":3}}'
ls data/submissions/
```

**Notes:**

---

### T-022 — Wire submission into the flow

**Status:** [ ] pending
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

---

## Phase 6 — PDF

### T-023 — PDF document component (FR-8)

**Status:** [ ] pending
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

---

### T-024 — Download button

**Status:** [ ] pending
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
- Deployment: import the repo into Vercel, set `BLOB_READ_WRITE_TOKEN`, deploy.
- Where submissions land and how to export them for analysis.
- The open decisions from §7 that the project owner still needs to confirm.

Also add `.env.example` documenting `BLOB_READ_WRITE_TOKEN`.

**Files:** `README.md`, `.env.example`

**Acceptance:**
- A reader who is not a developer can change a question and a weight from the README alone.
- No secrets in the repo.
- Deploy to Vercel succeeds and the full flow works on the deployed URL.

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
| NFR-1 responsive | T-025 | [ ] |
| NFR-2 accessibility | T-025 | [ ] |
| NFR-3 engine tests | T-006, T-007 | [ ] |
| NFR-4 config-only changes | T-004, T-010, T-015 | [ ] |
| NFR-5 refresh-safe progress | T-012 | [ ] |

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
