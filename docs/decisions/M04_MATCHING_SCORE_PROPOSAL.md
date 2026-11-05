# M04 Matching Score — Decision Proposal

**Status: DRAFT / PENDING OWNER-PM APPROVAL**

**Task:** S8-M04-01

**Date reviewed:** 2026-11-05

## Evidence and current behavior

- Workbook `Module 4 - Gia Khang` requires decision approval before implementation.
- `docs/api/M04_APPLICATION_INTERVIEW_CONTRACT.md` records only the GL-18 concept: the proportion of required job skills found in the CV.
- No approved source defines normalization, aliases, scale, empty required skills, rounding, weighting, missing data, tie-breaking, score explanation, or recomputation timing.
- The current API therefore returns `UNAVAILABLE` with `SKILLS_MISSING` or `FORMULA_UNAPPROVED`; the UI explains that the score is unavailable. It does not fabricate `0` or a ranking.

## Proposed rule for approval

1. Input is the immutable CV snapshot captured at submission and the job's required-skill IDs captured at the same time/version.
2. Normalize by canonical skill ID supplied by M02/M03. Display names are not matched as free text; aliases require an approved shared mapping.
3. Remove duplicate IDs from both sets.
4. If either set is missing, return `UNAVAILABLE/SKILLS_MISSING`. If the job has an explicitly empty required-skill set, return `UNAVAILABLE/NO_REQUIRED_SKILLS` rather than `0` or `100`.
5. Otherwise: `score = matchedRequiredSkillCount / requiredSkillCount * 100`, rounded to one decimal place. No weighting in v1.
6. Explanation returns matched IDs/count and required count, without exposing private CV content beyond the HR-authorized application view.
7. Sort available scores descending over the authorized full result set before pagination; ties use `submittedAt DESC, applicationId ASC`. Unavailable scores follow available scores and use the same stable tie-breaker.
8. Persist the score inputs/formula version with the application, or compute only from immutable captured inputs. Do not recompute from a later-edited CV/job.
9. Score is advisory only and never changes application status automatically.

## Decision required

Owner/PM and M02/M03/M04 must approve or amend every numbered rule, especially the canonical skill identity, empty-list behavior, snapshot/version ownership, range/rounding, and tie-breaker. Until then S8-M04-01 remains `BLOCKED_BY_DECISION` and no numeric score or matching sort is enabled.
