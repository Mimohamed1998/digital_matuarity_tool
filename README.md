# Digital Maturity Assessment Tool

A web tool that measures the digital maturity of an apparel-manufacturing organisation.
A respondent answers seven questions, one at a time, then sees a score out of 5, a named
maturity level, and recommendations ranked by how much each would move the score. They can
download the result as a PDF. Every response is stored for the researcher, who can review
and export the data from `/admin`.

Built for the study *Developing a Digital Maturity Model in the Apparel Industry*.

- **Landing page** `/` — what the survey covers, and where it starts
- **How the model works** `/model` — the theory, weights, formula and maturity levels
- **Survey** `/survey` — background information, then one question at a time, then a review step
- **Results** `/results` — score, level, charts, recommendations, PDF download
- **Admin** `/admin` — submissions, summary statistics and data export (password-protected,
  and deliberately not linked from anywhere on the public site)

---

## Running it locally

You need **Node 20 or newer**.

```bash
npm install
npm run dev          # http://localhost:3000
```

The survey works immediately. Submissions are written to `data/submissions/` as one JSON file
each (that directory is gitignored). To use the admin area locally, create `.env.local`:

```bash
cp .env.example .env.local
```

and fill in `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET`. See **Environment variables** below.

Useful commands:

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build — **fails loudly if `conf.yaml` is invalid** |
| `npm start` | Serve the production build |
| `npm test` | Unit tests, watching for changes |
| `npm run test:run` | Unit tests, once. The access-control suite runs a real production server and will build one first if none exists |
| `npm run typecheck` | TypeScript. Runs `next typegen` first, because Next generates the route types (`PageProps`, `LayoutProps`) that the app code depends on |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create the database table (needs `DATABASE_URL`) |

---

## Editing the survey — you do not need to be a developer

**Everything the respondent reads lives in one file: `conf.yaml` in the project root.**
Questions, statements, weights, maturity levels and recommendations are all there. No question
text exists anywhere in the code.

Edit it, save, and run `npm run build`. If you have made a mistake — a weight that does not add
up, a missing statement — **the build fails and tells you exactly which line is wrong**. That is
your safety net: a broken configuration can never reach the live site quietly.

### Changing the wording of a question

Find the factor and edit `question`, or the numbered `statements`:

```yaml
  - id: leadership
    name: "Leadership"
    question: "To what extent does management support and drive digital transformation?"
    statements:
      1: "Management provides little or no direction for digital transformation."
      ...
```

Keep all five statements. They must stay in order from least to most mature.

### Changing the weights

Each factor has a `weight` within its tier, and each tier has a `weight` in the overall score.

```yaml
tiers:
  - id: organisational_enablers
    weight: 0.7          # ← tier weight
factors:
  - id: leadership
    tier: organisational_enablers
    weight: 0.383        # ← factor weight, within that tier
```

**Two rules, both checked at build time:**

1. The tier weights must add up to exactly **1.0**.
2. Within each tier, the factor weights must add up to exactly **1.0**.

If you raise one weight you must lower another by the same amount. This is what keeps the final
score on the 1–5 scale.

### Adding a new factor (a new question)

Add a block to `factors` with a unique `id`, the `tier` it belongs to, a `weight`, a `question`,
five `statements` and five `recommendations` — then **reduce the other weights in that tier so
they still total 1.0**. Nothing else needs changing: the question appears in the survey, on the
results page, in the PDF and as a new column in the CSV export, automatically.

### Changing the maturity levels

`maturity_levels` sets the score bands. `min_score` is the lowest score that falls in that band,
and it is inclusive:

```yaml
  - value: 4
    min_score: 3.4        # a score of exactly 3.40 is Level 4
    name: "Established"
```

Bands must ascend and the first must start at 1.0. The current thresholds (1.8 / 2.6 / 3.4 / 4.2)
are equal-width bands — see **Open decisions** below, because they are an assumption.

### After any edit

```bash
npm run test:run     # confirms the scoring still behaves
npm run build        # confirms the configuration is valid
```

Then commit and push. Vercel redeploys automatically.

---

## How the score is worked out

Each answer is a number from 1 to 5. Each tier's score is the weighted sum of its factors'
answers; the overall score is the weighted sum of the tier scores.

```
Organisational Enablers = 0.383×Leadership + 0.367×Strategy & Governance
                        + 0.190×People & Culture + 0.060×Technology

Core Operations         = 0.400×Research + 0.230×Design + 0.370×Development

Overall                 = 0.7×Organisational Enablers + 0.3×Core Operations
```

**Worked example.** Leadership 5, Strategy 4, People 3, Technology 2, Research 4, Design 2,
Development 3:

```
Organisational Enablers = 0.383(5) + 0.367(4) + 0.190(3) + 0.060(2) = 4.073
Core Operations         = 0.400(4) + 0.230(2) + 0.370(3)            = 3.170
Overall                 = 0.7(4.073) + 0.3(3.170)                   = 3.8021
                                                    → Level 4, "Established"
```

Scores are displayed to 2 decimal places, but the maturity band is always chosen from the
unrounded number — otherwise a score of 3.399 would round to 3.40 and be put in the wrong band.

Recommendations are ranked by `tier weight × factor weight × (5 − answer)`. This is why "improve
Leadership" outranks "improve Technology" at the same gap: Leadership carries 0.383 of a 0.7
tier, Technology only 0.060 of it.

This is all verified by tests, including the worked example above and every band boundary.

---

## Getting your data out

This is the part you will actually use.

1. Go to **`/admin`** on the live site — e.g. `https://your-site.vercel.app/admin`.
   It is not linked from anywhere, and it is marked `noindex`, so you need to type it in.
2. Sign in with `ADMIN_PASSWORD`.
3. The dashboard shows total submissions, how many arrived in the last 7 and 30 days, the mean
   overall score, the spread across maturity levels, and the mean answer for each factor.
4. Click any row to see one full response: the respondent's details, every statement they chose,
   their tier scores and their level.
5. Click **Export CSV**.

**The CSV has one row per respondent and one column per factor** — ready to drop straight into
SPSS, R or Excel. Columns are `id`, `submittedAt`, `configVersion`, each background field, one
`answer_*` column per factor, one `tier_*` column per tier, then `overallScore`, `levelValue` and
`levelName`. **Export JSON** gives the complete stored record for each submission instead.

Two things worth knowing:

- **Respondent names are never shown in the submissions table** — only on an individual response's
  page. This is deliberate, so a dashboard left open on screen does not expose every participant.
- **If you edit `conf.yaml` after collecting responses**, any response whose score no longer
  matches today's weights is flagged with a warning on its detail page, naming the configuration
  version it was collected under. Take that seriously: it means those responses came from a
  different instrument and should not be pooled with newer ones without saying so.

---

## Deploying to Vercel

1. Push this repository to GitHub and import it at [vercel.com/new](https://vercel.com/new).
   The framework preset is detected automatically; no build settings need changing.
2. Add a Postgres database — **Storage → Create Database → Neon**. Vercel sets `DATABASE_URL`
   for you.
3. Add the two admin variables (**Settings → Environment Variables**), for all environments:
   `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET`.
4. Create the table. Locally, with the same `DATABASE_URL` in `.env.local`:
   ```bash
   npm run db:migrate
   ```
   It is safe to run repeatedly — it creates nothing that already exists.
5. Deploy, then check: complete the survey end to end, and confirm `/admin` refuses without the
   password and lets you in with it.

### Environment variables

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | For production | Neon Postgres connection string. Without it, **nothing is stored in production** — the app logs a warning and respondents still get their results. |
| `ADMIN_PASSWORD` | For admin access | At least 12 characters. |
| `ADMIN_SESSION_SECRET` | For admin access | At least 32 bytes of randomness: `openssl rand -base64 48`. |

`SUBMISSION_STORE=fs` exists for the access-control test suite and forces the filesystem store.
**Do not set it on a deployment** — a serverless filesystem is temporary, and your data would
vanish with the instance.

### Looking after the admin password

- **At least 12 characters** — the app refuses to authenticate against anything shorter. On a
  public URL this one password is the entire defence around participants' data.
- Set it **only** in Vercel's environment variables. Never commit it, never put it in a document
  you share.
- **To revoke access immediately** — for instance if the password has been shared, or a laptop is
  lost — change `ADMIN_SESSION_SECRET` and redeploy. Every signed-in session stops working at
  once. Changing `ADMIN_PASSWORD` alone does *not* end sessions that are already open.
- Login is rate-limited to 5 attempts per 15 minutes per client. This raises the cost of guessing;
  it does not remove it. The password's length is what actually protects you.

---

## Open decisions for the project owner

These were decided so that building could proceed. Each is recorded in `docs/plan.md` §7 with the
reasoning, and each is cheap to reverse. **Two need your confirmation:**

- **OD-2 — the maturity band thresholds.** The source document names the five levels but does not
  say where one ends and the next begins. Equal-width bands (1.8 / 2.6 / 3.4 / 4.2) are currently
  used. If your research suggests different cut-offs, change `min_score` in `conf.yaml`.
- **OD-9 — retention and personal data.** Responses are kept for the duration of the study. The
  name field is optional, no IP address is ever recorded, and nothing else is directly
  identifying. **Please confirm this matches your ethics approval and the consent wording shown to
  participants** — that is a research-governance decision, not an engineering one.

Also worth reviewing: **OD-3**, the recommendation text in `conf.yaml`. It was drafted for this
tool rather than taken from the source document, so the wording is yours to correct.

---

## How it is put together

```
conf.yaml                  the survey — questions, weights, levels, recommendations
src/middleware.ts          blocks /admin and /api/admin without a valid session
src/lib/config/            reads and validates conf.yaml (fails the build on a bad one)
src/lib/scoring/           the scoring and recommendation engines — pure functions, no UI
src/lib/storage/           Postgres and filesystem adapters behind one interface
src/lib/auth/              admin password, session token, rate limiting
src/lib/export/            CSV generation
src/app/                   pages and API routes
src/components/            UI, grouped by area (ui, survey, results, pdf, admin)
tests/                     scoring, config, storage, auth, CSV, contrast, access control
docs/plan.md               the implementation plan, task by task
docs/requirements-extract.md   the source document, transcribed
```

Two rules hold throughout, and are worth preserving:

1. **`conf.yaml` is the only place survey content lives.** If you find yourself typing a question
   into a `.tsx` file, something has gone wrong.
2. **The scoring engine is pure.** `src/lib/scoring/` imports no React, no Next.js, no filesystem.
   That is what makes the numbers testable, and the same code produces the score in the browser
   and the score that gets stored.

### Tests

```bash
npm run test:run
```

Covers the scoring engine against the worked examples and every band boundary, configuration
validation, storage and streaming, admin authentication (including JWT `alg` confusion attempts),
CSV escaping and spreadsheet-formula injection, colour contrast in both themes, and a full
access-control audit that runs a real production server and asserts that no unauthenticated
request can reach respondent data.
