# GradientRip — Agent Rules

How we work in this repo. Human instructions take precedence over everything
below; skills take precedence over default behavior.

## 1. Closed sets live in exactly two places

Every closed string set (visibility, status, role, kind, sport, theme, …) is
defined **once** in TypeScript (an exported `as const` array or `Set` in app
code) **and once** as a DB `CHECK` constraint — added in the same commit.
One side may never gain a value without the other.

- Text literals for set membership (`=== 'admin'`, `IN ('a','b')`) outside those
  two homes are a defect. Compare against the const, not a literal.
- CI enforces it: `npm run lint` includes a check that every string literal
  inside a `CHECK (… IN (…))` in `app/db/migrations/*.up.sql` appears in a
  same-named TS const (see `scripts/check-closed-sets.sh`; exact-name match,
  reviewer adjudicates renames).
- `TEXT + CHECK` is the standard column shape. Do not introduce Postgres ENUMs
  (rigid under ALTER, poor fit for our migration flow) without explicit approval.

## 2. Migrations are data-contracts, not just schema

- **Lossless by default.** A migration that rewrites existing rows must carry
  the old→new mapping in a comment, print an oddity pre-report (`SELECT` the
  affected rows before `UPDATE`) during verification, and either restore values
  on `down` or declare the loss explicitly in the file. Schema-only reversibility
  is not reversibility.
- **Normalize-then-constrain, never the reverse.** Backfill first, add the CHECK
  second, in the same file, in that order.
- **Rollback drill + row parity.** Every migration is proven `up/down/up` on
  dummy Postgres **with row counts before/after** on seed data. A silent rewrite
  (counts change, values change) fails verification.
- New tables that supersede dead ones (`channels` over legacy `crews`) must note
  the dead table. Dead tables are dropped by migration only after a row-count
  audit proves them empty; until then they are marked deprecated in a comment.

## 3. Verification beats assertion

- Gate per task: `npm run check && npm run lint && npm test` in `app/`
  (+ `npm run build` before merge-level milestones). No gate waivers except
  pre-existing failures recorded in the report.
- Browser/API proofs carry evidence (status codes, row counts, psql output),
  never claims. A proof that cannot run in this environment is labeled
  environment-limited with exactly what was proven another way.
- Dummy stack: app `:5173`, dummy Postgres `:5435`, dummy S3 `:9000`
  (s3rver — SDK ops valid, browser CORS untestable there; assert request
  shapes, not s3rver pixels). Never touch seed data except own probes;
  delete probes + objects afterwards. Never put real credentials in `.env`
  (gitignored) or anywhere committed.

## 4. No fake UI, no silent behavior change

- Every control does its labelled thing; disabled states say why; errors tell
  the truth (never "are you offline?" for server rejections).
- Reskins change tokens/components only — thresholds, handlers, copy, and
  scoring constants are behavior and need explicit approval to change.
- One primary action per visible state; 44px targets; 12px type floor
  (11px metadata only); `goto(resolve(...))` in-app, plain anchors for
  external/OAuth/invite/share URLs.
