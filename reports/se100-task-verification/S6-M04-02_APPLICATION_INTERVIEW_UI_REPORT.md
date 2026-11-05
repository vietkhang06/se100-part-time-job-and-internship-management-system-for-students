# S6-M04-02 — Application/Interview UI verification

## Scope

- Connect the public job application entry point to the real M04 API.
- Connect Student application/interview pages to authenticated API data and mutations.
- Connect Employer application/interview pages to authenticated API data and mutations.
- Preserve backend authorization as the authority; UI visibility is only an additional guard.
- Provide isolated browser fixtures and responsive smoke evidence.

## Implemented UI

| Actor | Route | Behavior |
|---|---|---|
| Student | `/jobs` | Load public jobs/CVs, submit selected CV and cover letter |
| Student | `/candidate/applications` | List/detail, CV snapshot, history, reason and withdraw |
| Student | `/candidate/interviews` | List schedules, confirm and request one reschedule |
| Employer | `/employer/applications` | Select owned job, list/detail snapshot, mark viewed, reject and invite |
| Employer | `/employer/interviews` | Select owned job, resolve reschedule and record result |

All mutations disable actions while pending and reload authoritative API data after success. Matching score is displayed as unavailable when the API reports `UNAVAILABLE`; the UI does not fabricate a value.

## Verification

- `pnpm verify`: PASS before branch split; typecheck, lint, unit tests and production build exited 0.
- Browser smoke with the real local API/PostgreSQL: submit → HR review → invite → Student confirm/reschedule → HR approve → reload persistence: PASS.
- Responsive inspection: 360px, 768px and 1440px: PASS after the shared dashboard navigation fix.
- Synthetic fixture lifecycle is guarded to localhost database `campusjob_m04_test` and cleaned after execution.

Artifacts are stored beside this report under `artifacts/`.

## Remaining verification

- Automated offline/retry browser scenario.
- Full keyboard-only journey for every modal.
- Cross-owner browser deep-link scenario; backend/API ownership coverage remains required from S6-M04-01.

This task depends on the S6-M04-01 production API branch for the employer interview-list endpoint and complete production journey.
