# CFWU Ovarian Mass Assessment: Phase 0 rules engine

This is a pure TypeScript rules engine for the CFWU ovarian mass protocol. It covers:

- the IOTA two-step strategy
- IOTA Simple Rules
- RMI-I
- O-RADS US v2022 category
- escalation flags
- management text
- clinician confirm/override with an audit trail
- the sign/amend lifecycle
- the plain-text structured report

There is no user interface and no database yet; those come in Phase 1. The engine uses **synthetic data only**.

> **Not for clinical use.** The rules file is a draft until a clinician signs it off (`signOff` in `rules/protocol-v1.json`). Every report prints a warning banner until then. See `docs/OPEN_QUESTIONS.md`.

## Running it

```bash
npm install
```

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npx vite-node scripts/sample-report.ts
```

The last command prints a synthetic signed O-RADS 4 report.

## Layout

| Path | What it is |
|---|---|
| `docs/protocol-source.pdf`, `docs/protocol.md` | The CFWU protocol (source of truth) and its extracted text |
| `docs/spec-source.pdf`, `docs/spec.md` | The build spec |
| `docs/OPEN_QUESTIONS.md` | Items needing clinician answers or sign-off |
| `rules/protocol-v1.json` | **All** clinical rules: thresholds, definitions, management wording. Each section has `source` and `sourceStatus` |
| `src/engine/assess.ts` | Rule engine (per lesion and per exam) |
| `src/engine/validate.ts` | Input validation and mandatory worksheet fields |
| `src/engine/match.ts` | Evaluates the rules file's declarative conditions |
| `src/record.ts` | Exam record: confirm/override, flag acknowledgement, referrer call, signing gate, amendments, audit log |
| `src/report.ts` | Plain-text report built from the protocol's structured template |
| `tests/acceptance.test.ts` | The 12 spec acceptance tests |
| `tests/engine.test.ts` | Boundary tests, rules-file integrity, roles and the signing gate |

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
- a signer below Level III when Level III review is required
- a signer who isn't a reporting clinician

## Changing the rules

1. Edit `rules/protocol-v1.json`, bump `rulesVersion` and record the source.
2. Add or adjust tests.
3. Run `npm test`. A test also checks the rules file's structure.
4. Get clinician sign-off: set `signOff.status` to `"signed-off"` and fill in the clinician, second checker and date.
