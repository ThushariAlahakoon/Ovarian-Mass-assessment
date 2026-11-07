# Open questions and items for clinician sign-off

Phase 0 is finished only when every test passes (done) **and** a clinician has signed off `rules/protocol-v1.json`. A second clinician must also check it. Until then, every assessment and report carries the banner *DRAFT RULES – NOT SIGNED OFF – NOT FOR CLINICAL USE*.

## A. Not in the CFWU protocol: transcribed from the published sources, needs verification

These rules are marked `"sourceStatus": "external-unverified"` in the rules file.

1. **IOTA Simple Rules B1–B5 and M1–M5.** The protocol names these features but doesn't define them. I transcribed them from Timmerman et al., *UOG* 2008:
   - B1 unilocular
   - B2 solid component <7 mm
   - B3 acoustic shadows
   - B4 smooth multilocular <100 mm
   - B5 colour score 1
   - M1 irregular solid
   - M2 ascites
   - M3 ≥4 papillary projections
   - M4 irregular multilocular-solid ≥100 mm
   - M5 colour score 4

   **Please check these against the IOTA 2026 updated terms (UOG 2026;67:702–724)** in case any wording changed.
2. ~~**What counts as "irregular" for M4.**~~ **Answered 2026-11-07:** irregular walls/septa only. An irregular solid surface alone does not make a multilocular-solid lesion M4. (Rules file version 1.0.0-draft.2.)
3. **RMI-I scoring values.** The protocol names RMI-I, the five U features and the >200 threshold, but not the scores. I used Jacobs 1990:
   - U = 0, 1 or 3 for 0, 1 or ≥2 features
   - M = 1 if premenopausal, 3 if postmenopausal
4. **How the RMI U features are worked out from the IOTA fields:**
   - *multilocular*: IOTA type multilocular or multilocular-solid
   - *solid*: any solid component
   - *bilateral*: lesions on both sides
   - *ascites*: ascites recorded
   - *metastases*: peritoneal nodules or omental cake on the upper-abdomen survey

   **Answered 2026-11-07:** yes, use this mapping.

## B. Ambiguities in the protocol: the engine's current interpretation

5. ~~**Do BD1 and BD2 require regular walls?**~~ **Answered 2026-11-07:** yes. All four BDs now require regular walls (rules file version 1.0.0-draft.3). If a lesion matches more than one BD, the engine reports the first match in order.
6. **Management by menopausal status.** The spec says management is looked up by category *and* menopausal status, but the protocol's table has one row per category. The engine supports separate pre- and postmenopausal wording (`management.byMenopause`), but that section is currently empty.
7. **O-RADS 2 follow-up detail.** The protocol defers this to "the O-RADS v2022 classic-lesion table", which isn't transcribed. The table needs to be transcribed, with a second clinician checking it (spec, sourcing table). The protocol also says management must be "verified against the current ACR tables before go-live".
8. **Escalation flags.** The protocol's "Escalation in clinic" step lists M feature, ADNEX ≥10% and metastatic ≥10%. The spec adds ascites and RMI >200. The engine follows the spec (all five). **Confirmed 2026-11-07.**
9. **Is the referrer call mandatory?** The engine requires a logged referrer call before signing whenever:
   - any red flag is present
   - the final category is O-RADS 4–5
   - the presentation is acute

   O-RADS 3 ("report within 24 h") does not block signing. **Confirmed 2026-11-07.**
10. ~~**Level III review.**~~ **Answered 2026-11-07:** any CFWU reporting clinician may sign, whatever their level. For O-RADS 3–5 and inconclusive lesions, the report shows "Level III review advised" as a note, but signing isn't blocked. Students still can't sign. This differs from the protocol's QA section ("reviewed by a Level III examiner before the report is finalised"), so **the protocol text should be updated to match** (or set `review.enforceAtSigning` back to `true`). Rules file version 1.0.0-draft.4.
11. **BD lesion with an ADNEX result also entered.** The engine ignores ADNEX for O-RADS when a BD applies, as in the protocol's step order. A clinician-entered descriptor category can still raise the category.
12. **Upper-abdomen survey.** For O-RADS ≥4 or any M feature, the engine shows a reminder but doesn't block signing. **Confirmed 2026-11-07: reminder only, no block.**

## C. Not clinical, still to decide

13. **ADNEX arithmetic check tolerance.** There's a warning (never a block) when benign + total ≠ 100%, or when the subclasses don't add up to the total, by more than 1 percentage point.
14. **Regulatory and IOTA permission.** See the spec. The ADNEX formula is not implemented. ADNEX is entered manually from the IOTA app.
