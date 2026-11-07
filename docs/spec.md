# Ovarian Mass Assessment App: Build Spec for Claude Code

> Text extracted from `docs/spec-source.pdf` (Nov 7, 2026, @Indika) with pdftotext. The PDF is the authoritative copy; this file exists so the source text can be searched and diffed.

```text
Ovarian Mass Assessment App: Build Spec for Claude Code




Ovarian Mass Assessment App: Build Spec
for Claude Code
  ​Nov 7, 2026      ·   ​@Indika




Purpose and scope
A secure web app that takes a sonographer through the CFWU ovarian mass protocol
step by step and records IOTA findings. It runs the two-step strategy, assigns an O-RADS
US v2022 category, and produces a signed structured report with the protocol's
management recommendation.

The clinical rules come from Ovarian Mass Ultrasound: Guideline Review & Scanning and
Reporting Protocol. The app implements that protocol and changes only when the
protocol changes.

       Users: sonographers and WSU student sonographers (data entry), sonologists and
       MFM/O&G specialists (review and sign), practice admin (audit exports).
       Sites: Westmead Innovation Quarter and Norwest Private Hospital, Bella Vista.
       In scope (v1): patient and clinical context, per-lesion IOTA description, modified
       benign descriptors, Simple Rules, ADNEX risk (via a validated implementation — see
       Clinical logic), O-RADS category, management text, structured report (PDF and copy-
       to-clipboard), follow-up tracking and audit dashboard.
       Out of scope (v1): image analysis or automatic measurement from ultrasound images
       (keeps the app outside TGA image-processing rules), direct writes into Gentu or
       Viewpoint (phase 3), and patient-facing access.
       Design principle: the app suggests; the reporting clinician always confirms or
       overrides the category and recommendation, with the reason recorded.


Clinical workflow
The app mirrors the protocol's scanning order: context, survey, one form per lesion, a live
risk panel, then clinician review before the report can be signed.




                                                                                        Page 1 of 9
Ovarian Mass Assessment App: Build Spec for Claude Code




App workflow · 7 screens, per-lesion loop, red-flag gate

The risk panel updates as fields are entered, so the sonographer sees the BD, Simple
Rules and O-RADS result before the patient leaves; a red flag blocks signing until it is
acknowledged and the referrer call is logged.


Clinical logic
All rules live in one versioned, clinician-approved rules file ( rules/protocol-v1.json )
with unit tests. They are never hard-coded across screens, and Claude Code must not
invent any coefficient, threshold or management text.


Rule engine, in order (per lesion)
   1. Physiological check: clinician ticks "follicle / corpus luteum ≤3 cm, premenopausal" →
       O-RADS 1; stop.
   2. Modified benign descriptors (deterministic; all need largest diameter <10 cm):
             BD1 = unilocular AND ground-glass AND premenopausal
             BD2 = unilocular AND mixed echogenicity AND acoustic shadows AND
             premenopausal
             BD3 = unilocular AND anechoic AND regular walls
             BD4 = unilocular AND regular walls (any other content)
       Any true → O-RADS 2, show which BD applied.




                                                                                       Page 2 of 9
Ovarian Mass Assessment App: Build Spec for Claude Code




   3. ADNEX (when no BD applies): inputs are age, CA125 (optional; run the with/without
       model accordingly), centre type, maximum lesion diameter, maximum solid
       component diameter, >10 locules, papillary projection count (0/1/2/3/>3), acoustic
       shadows, ascites. Outputs are total risk plus benign, borderline, stage I, stage II–IV
       and metastatic probabilities. If the solid component is larger than the lesion, block
       calculation and ask for correction.
   4. Simple Rules (deterministic): B1–B5 and M1–M5 from the same fields → benign /
      malignant / inconclusive. Always shown; any M feature raises an escalation flag.
   5. RMI U-score features listed for referrer compatibility; RMI calculated only if CA125 is
       entered.
   6. O-RADS category: from the ADNEX band using the IOTA 2026 mapping (<1% = 2; 1–
       <10% = 3; 10–<50% = 4; ≥50% = 5). The clinician can also assign by O-RADS
       descriptors; the higher category displays with both shown.
   7. Escalation flags (red banner, report cannot be finalised without acknowledgement):
       any M feature; ADNEX ≥10%; ADNEX metastatic risk ≥10%; ascites; RMI >200.
   8. Management text: pulled from the protocol's management table for the final
      category and menopausal status. The clinician can edit it, and any edit is logged as an
       override.


What must be sourced and verified before clinical use

  Item                                               Source                         Verification

  ADNEX model coefficients                           Van Calster et al., BMJ        Match the official IOTA
  (both versions)                                    2014;349:g5920 and             app/online calculator to
                                                     supplementary material, or     0.1% on at least 50 test
                                                     directly from the IOTA group   cases spanning all
                                                                                    categories

  Simple Rules and BD                                IOTA 2026 updated terms        Clinician sign-off on the
  definitions                                        (UOG 2026;67:702–724);         rules file
                                                     Landolfo 2023

  O-RADS v2022 classic-                              ACR O-RADS US v2022            Transcribed by a clinician;
  lesion and follow-up tables                        assessment categories PDF      second clinician checks

  Management wording                                 CFWU protocol (reporting       Protocol owner approval;
                                                     section)                       version number printed on
                                                                                    every report




                                                                                                            Page 3 of 9
Ovarian Mass Assessment App: Build Spec for Claude Code




Fallback if ADNEX coefficients cannot be confirmed: v1 records an ADNEX result
entered manually from the IOTA app (number + subclass percentages) instead of
calculating it. Everything else still runs.


Data model and report output
One examination holds one or more lesions; each lesion stores its raw IOTA fields, every
computed result, and the rules-file version used, so any report can be reproduced exactly
later.


  Entity                                       Key fields

  Patient                                      internal ID, MRN (Gentu), name, DOB (age derived
                                               at exam date)

  Examination                                  site, date/time, sonographer, reporting clinician,
                                               menopausal status, LMP/cycle day, hormones,
                                               pregnancy, symptoms, family history/BRCA/Lynch,
                                               CA125 (value, date), technique (TV/TA/TR), image
                                               quality, uterus/endometrium, free fluid (POD depth
                                               / ascites), upper-abdomen findings, status (draft /
                                               for review / signed / amended)

  Lesion                                       side, origin, 3 diameters, IOTA type, locule count,
                                               >10 locules, wall regularity, content echogenicity,
                                               solid component present + 3 diameters, papillary
                                               count + flow, solid surface, acoustic shadows,
                                               colour score, tenderness/mobility, suggested
                                               diagnosis + confidence

  Assessment (per lesion)                      BD result, ADNEX total + 5 subclasses (calculated
                                               or entered), Simple Rules B/M features + result,
                                               RMI features/score, O-RADS (model-derived,
                                               descriptor-derived, final), flags, management text,
                                               override reason, rules version

  Follow-up                                    due date, reason, linked prior lesion, outcome
                                               (resolved / stable / surgery), histology result

  Audit log                                    who changed what and when, including every
                                               override and amendment


Report output: generated from the protocol's structured template — clinical details, per-
lesion IOTA description, risk assessment block (BD, ADNEX with subclasses, Simple Rules,
RMI features, O-RADS), conclusion with the recommendation and timeframe, interval



                                                                                                     Page 4 of 9
Ovarian Mass Assessment App: Build Spec for Claude Code




comparison, reporting clinician, sonographer, protocol version, and time of verbal
communication for O-RADS 4–5. Delivered as a PDF, as plain text to paste into the Gentu
report, and (phase 3) as an HL7/FHIR message.

Audit dashboard: completeness of IOTA fields, distribution by O-RADS category, override
rate, time to referrer call for O-RADS 4–5, and malignancy rate per category vs
histology/follow-up — the annual audit measures in the protocol.


Regulatory, privacy and IOTA licensing
Software that calculates a cancer risk for an individual patient is likely to be a medical
device. It is designed to fit the TGA's clinical decision support (CDSS) exemption, but get
regulatory advice before go-live.

TGA. CDSS that meets the medical-device definition must be on the ARTG unless it meets
all three exemption criteria in Schedule 4, Part 2 of the Medical Devices Regulations 2002
(TGA guidance). In summary, the software must not directly process a medical image or a
signal from another device, it must only support a health professional's decision, and it
must not replace their clinical judgement (HWL Ebsworth summary). An exempt CDSS
must still be notified to the TGA within 30 working days of supply (TGA detailed
guidance). Design choices that support the exemption:

       Clinician enters measurements manually; no image import or automatic
       measurement.
       Every output shows its basis (which BD, which M features, the ADNEX inputs), so the
       clinician can review the reasoning.
       Category and recommendation are suggestions the clinician must confirm or override.
       Clinician-only access; no patient-facing output.
       Open question: whether internal use within CFWU counts as "supply", and whether
       sharing the app with other practices or WSU changes that — confirm with a
       regulatory adviser.

Privacy and security. Health information is covered by the Privacy Act 1988 (APPs) and
the NSW Health Records and Information Privacy Act 2002.

       Host in an Australian region; encrypt data in transit and at rest.
       Single sign-on or MFA; role-based access (sonographer, student, reporting clinician,
       admin).
       Full audit trail; retention aligned with CFWU's medical-records policy.
       Students see only cases they are assigned; option for de-identified teaching mode.
       Never put patient identifiers in URLs; daily backups and a tested restore.




                                                                                        Page 5 of 9
Ovarian Mass Assessment App: Build Spec for Claude Code




IOTA. The IOTA terms, Simple Rules and ADNEX are published, but IOTA's conditions for
embedding ADNEX in third-party software, and any trademark use of the "IOTA" name,
could not be confirmed online. Contact the IOTA group before building in the calculation;
until then, use the manual-entry fallback described above.


Tech stack, integrations and build plan
Build the clinical rules engine first as tested, UI-free code, then wrap it in a web app. Pilot
at one site with fake data before any real patient is entered.

Suggested stack (Claude Code can propose alternatives, but keep the rules engine
separate):


  Layer                   Choice                                      Why

  Rules                   TypeScript pure functions +                 Deterministic, testable, versioned
  engine                   rules/protocol-v1.json , Vitest unit
                          tests

  Web app                 Next.js (React, TypeScript), tablet-        Works on scanning-room PCs and
                          friendly forms                              tablets

  Database                PostgreSQL in an Australian region (e.g.    Relational audit trail; data stays
                          AWS Sydney or Supabase Sydney) via          onshore
                          Prisma

  Auth                    Microsoft Entra ID / Google Workspace       Matches practice accounts
                          SSO with MFA, role-based access

  Reports                 Server-side PDF (e.g. react-pdf) + plain-   Paste into Gentu now; message
                          text export                                 later

  Testing                 Vitest (rules), Playwright (end-to-end)     Regression safety when the
                                                                      protocol changes


Integrations (phase 3): pull patient demographics and referral details from Gentu, and
push the finalised report back, if Gentu exposes an API or HL7/FHIR interface. Link to
images in Viewpoint via accession number. Both depend on the vendor interfaces, which
are still being worked through with Gentu.

Build phases:

   1. Phase 0 — Rules engine (1–2 weeks): BD, Simple Rules, O-RADS mapping, flags and
       management lookup with unit tests built from protocol examples; ADNEX as a
       manual-entry field.




                                                                                                      Page 6 of 9
Ovarian Mass Assessment App: Build Spec for Claude Code




   2. Phase 1 — Clickable prototype (2–3 weeks): all forms, live risk panel, report preview;
       runs locally with synthetic patients only. Clinician usability review.
   3. Phase 2 — Secure pilot (4–6 weeks): hosting, SSO, audit log, PDF reports, follow-up
       list; pilot at one site in parallel with normal reporting, compare outputs.
   4. Phase 3 — Integrations: Gentu and Viewpoint links; audit dashboard.
   5. Phase 4 — ADNEX calculation: only after coefficients are confirmed (IOTA/BMJ 2014)
       and validated against the IOTA app, and IOTA permission is in place.

Timeframes are rough estimates for one developer working with Claude Code; treat them
as a starting point.


Acceptance tests and Claude Code kickoff prompt
Phase 0 is done when every test below passes and a clinician has signed off the rules file;
paste the prompt below into Claude Code in an empty project folder to start.


Rule-engine acceptance tests (minimum)

  #          Input                                        Expected

  1          34 y, premenopausal, unilocular, ground-     BD1 → O-RADS 2; no flags
             glass, 45 mm

  2          30 y, premenopausal, unilocular, mixed       BD2 → O-RADS 2
             echogenicity, shadows, 60 mm

  3          62 y, postmenopausal, unilocular,            BD3 → O-RADS 2
             anechoic, regular walls, 40 mm

  4          45 y, unilocular anechoic, regular walls,    No BD (≥10 cm) → ADNEX required;
             120 mm                                       Simple Rules B1 benign

  5          Multilocular-solid, irregular, 130 mm,       Simple Rules malignant (M2, M4, M5); red
             ascites, colour score 4                      escalation flag; cannot finalise without
                                                          acknowledgement

  6          Unilocular-solid, 4 papillary projections    M3 present; escalation flag

  7          Solid component diameter > lesion            Validation error; no result
             diameter

  8          Both B and M features present                Simple Rules inconclusive

  9          ADNEX entered as 12% total, metastatic       O-RADS 4; flags for ADNEX ≥10% and
             11%                                          metastatic ≥10%




                                                                                             Page 7 of 9
Ovarian Mass Assessment App: Build Spec for Claude Code




  #          Input                                        Expected

  10         Clinician changes O-RADS 3 → 4               Override reason mandatory; audit log
                                                          entry; report shows both

  11         Postmenopausal ovaries not visualised        Report states "not visualised", not
                                                          "normal"

  12         Any signed report                            Shows protocol and rules version;
                                                          amendments create a new version




                                                                                                Page 8 of 9
Ovarian Mass Assessment App: Build Spec for Claude Code




Kickoff prompt for Claude Code

  You are helping me build an internal clinical web app for the Centre for
  Women's Ultrasound (CFWU) to assess and record adnexal (ovarian) masses using
  IOTA terminology, the IOTA two-step strategy and O-RADS US v2022, following
  our protocol. I will save the protocol and this spec as docs/protocol.md and
  docs/spec.md.


  Non-negotiable rules:
  1. Do NOT invent any clinical coefficient, threshold, definition or
  management text. All clinical rules come from docs/protocol.md and
  docs/spec.md and live in rules/protocol-v1.json. If something is missing or
  ambiguous, stop and ask me.
  2. ADNEX is a manual-entry field in this phase (total risk + 5 subclass
  probabilities). Do not implement the ADNEX formula.
  3. The app suggests; the clinician confirms or overrides with a recorded
  reason.
  4. No real patient data. Use synthetic data only. No patient identifiers in
  URLs or logs.


  Phase 0 task (do this first, nothing else):
  - Set up a TypeScript project with Vitest.
  - Implement a pure-function rules engine: physiological check, modified
  benign descriptors BD1-4, IOTA Simple Rules B1-B5 and M1-M5, RMI U-score
  features (and RMI if CA125 is given), O-RADS mapping from ADNEX bands (<1% =
  2, 1-<10% = 3, 10-<50% = 4, >=50% = 5), escalation flags, and management text
  lookup from the rules file.
  - Implement input validation (e.g. solid component cannot exceed lesion
  diameter).
  - Write unit tests covering the 12 acceptance tests in docs/spec.md.
  - Write a short README explaining how to run the tests and where each rule
  comes from in the protocol.


  Before writing code, give me a plan and list any questions about the
  protocol. Then build Phase 0 only.


How to use it: export both docs as Markdown into a docs/ folder, open Claude Code in
that folder, paste the prompt, and review its plan before it writes code. After Phase 0, ask
it for Phase 1 using the build plan above.




                                                                                       Page 9 of 9
```
