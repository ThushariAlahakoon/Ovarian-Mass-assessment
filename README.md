# CFWU Ovarian Mass Assessment

Two parts, kept separate as the spec asks:

- **`packages/engine`** (Phase 0): a pure TypeScript rules engine for the CFWU ovarian mass protocol.
- **`apps/web`** (Phase 1): a clickable, tablet-friendly prototype built on that engine.

The engine covers:

- the IOTA two-step strategy
- IOTA Simple Rules
- RMI-I
- O-RADS US v2022 category
- escalation flags
- management text
- clinician confirm/override with an audit trail
- the sign/amend lifecycle
- the plain-text structured report

Everything uses **synthetic data only**. There is no database or real sign-in yet; those come in Phase 2.

> **Not for clinical use.** The rules file is a draft until a clinician signs it off (`signOff` in `packages/engine/rules/protocol-v1.json`). Every report prints a warning banner until then. See `docs/OPEN_QUESTIONS.md`.

## Running it

You need Node.js 22. Install once from the repository root:

```bash
npm install
```

Run the web prototype (Phase 1), then open http://localhost:3000 and choose **Load demo cases**:

```bash
npm run dev
```

Rules-engine unit tests:

```bash
npm test
```

End-to-end tests (build first):

```bash
npm run build
```

```bash
npm run e2e
```

Print a synthetic signed O-RADS 4 report from the engine alone:

```bash
npm run sample-report -w @cfwu/engine
```

## Phase 1 prototype (`apps/web`)

A Next.js app that follows the spec's seven screens. Each exam has a step bar:

1. **Patient**: synthetic patient, site, menopausal status, risk factors, CA125.
2. **Pelvic survey**: technique, uterus, ovaries (including "not visualised"), free fluid (none / POD only / ascites), upper abdomen.
3. **Lesions**: one tab per lesion (R1, L1…), IOTA fields as large touch buttons, ADNEX typed in from the IOTA app, optional descriptor-based O-RADS.
4. **Risk panel**: BD → Simple Rules → ADNEX → O-RADS, flags, RMI. It also sits beside screens 1–3 and updates as you type.
5. **Review**: confirm or override each category (reason required), edit management text (reason required), acknowledge red flags, log the referrer call, sign. The panel lists anything blocking signing.
6. **Report**: structured text, copy for Gentu, print / save as PDF, version history, amend, audit log.
7. **Follow-up**: due dates per exam, plus a due list across all exams with outcome and histology.

Prototype limits (Phase 2 replaces these):
- **Data:** stored only in the browser's localStorage, not in a database.
- **Sign-in:** an "Acting as" switcher stands in for SSO. Demo users: sonographer, student, Level III clinician, Level II clinician, admin.
- **Patients:** synthetic only. URLs contain only a random exam id, never a patient identifier.

## Layout

| Path | What it is |
|---|---|
| `docs/protocol-source.pdf`, `docs/protocol.md` | The CFWU protocol (source of truth) and its extracted text |
| `docs/spec-source.pdf`, `docs/spec.md` | The build spec |
| `docs/OPEN_QUESTIONS.md` | Items needing clinician answers or sign-off |
| `apps/web/` | Phase 1 Next.js prototype (screens in `app/exams/[id]/*`, live panel in `components/RiskPanel.tsx`, end-to-end tests in `e2e/`) |
| `packages/engine/rules/protocol-v1.json` | **All** clinical rules: thresholds, definitions, management wording. Each section has `source` and `sourceStatus` |
| `packages/engine/src/engine/assess.ts` | Rule engine (per lesion and per exam) |
| `packages/engine/src/engine/validate.ts` | Input validation and mandatory worksheet fields |
| `packages/engine/src/engine/match.ts` | Evaluates the rules file's declarative conditions |
| `packages/engine/src/record.ts` | Exam record: confirm/override, flag acknowledgement, referrer call, signing gate, amendments, audit log |
| `packages/engine/src/report.ts` | Plain-text report built from the protocol's structured template |
| `packages/engine/tests/acceptance.test.ts` | The 12 spec acceptance tests |
| `packages/engine/tests/engine.test.ts` | Boundary tests, rules-file integrity, roles and the signing gate |

No clinical rule is written into the TypeScript code. The code reads every threshold, definition and piece of wording from the rules file, so a protocol change means a new rules file version and new tests.

## Where each rule comes from

| Engine step | Rules-file section | Source |
|---|---|---|
| 1. Physiological (follicle/CL ≤3 cm, premenopausal → O-RADS 1) | `physiological` | Protocol E.1 |
| 2. Modified benign descriptors BD1–4, <10 cm → O-RADS 2 | `benignDescriptors` | Protocol E.2; spec step 2 |
| 3. ADNEX: manual entry from the IOTA app (no formula) | `adnex` | Protocol E.3; spec step 3 and fallback |
| 4. Simple Rules B1–B5 / M1–M5 | `simpleRules` | **Not defined in the protocol.** Taken from Timmerman 2008; needs verification |
| 5. RMI-I U features; score only if CA125 is entered | `rmi` | Protocol (RMI-I, U features, >200); scoring values from Jacobs 1990, needs verification |
| 6. O-RADS from ADNEX band (<1 / 1–<10 / 10–<50 / ≥50 %) or descriptors, whichever is higher | `orads` | Protocol E.5, IOTA 2026 mapping |
| 7. Escalation flags (M feature, ADNEX ≥10%, metastatic ≥10%, ascites, RMI >200) | `flags` | Spec step 7; protocol E.6 and "Additional triggers" |
| 8. Management text, verbatim | `management` | Protocol "Management recommendations by category" |
| Special situations (acute, pregnancy, BRCA/Lynch, ovaries not visualised, upper-abdomen survey) | `specialSituations` | Protocol G and C.6 |
| Level III review for O-RADS 3–5 and inconclusive lesions | `review` | Protocol QA – Expertise levels |
| Mandatory worksheet fields | `mandatoryFields` | Protocol QA – Worksheet |

## Signing gate

`signingBlockers()` lists everything that stops signing:

- validation errors
- lesions without a confirmed or overridden category
- unacknowledged red flags
- no logged referrer call when there are flags, O-RADS 4–5 or an acute presentation
- a signer who isn't a reporting clinician (any CFWU reporting clinician can sign, at any level)

Level III review of O-RADS 3–5 and inconclusive lesions is advisory: it appears as a note on the report. Setting `review.enforceAtSigning` to `true` in the rules file turns it back into a hard block.

## Changing the rules

1. Edit `packages/engine/rules/protocol-v1.json`, bump `rulesVersion` and record the source.
2. Add or adjust tests.
3. Run `npm test`. A test also checks the rules file's structure.
4. Get clinician sign-off: set `signOff.status` to `"signed-off"` and fill in the clinician, second checker and date.
