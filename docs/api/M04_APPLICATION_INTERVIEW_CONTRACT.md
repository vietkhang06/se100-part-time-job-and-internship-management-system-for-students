# M04 Application & Interview — contract and implementation boundary

Status: **implemented as an isolated M04 slice; integration pending**. Schema, separate Application and Interview migrations, workflow, repository, controller and fixture tests exist. As of the 23-10-26 checkout, M02 publishes a CV snapshot adapter and approved C-03, but M03 still has no Job ownership/eligibility source. M04Module is not imported into AppModule. Live migration/test results are recorded in docs/testing/M04_SPRINT3_RESULTS.md; fixture tests are not full integration.

## Sources and precedence

- Project workbook is the primary M04 scope source: `Module 4 - Gia Khang` rows 15–18 and 24–29; `P2_05_DacTaYeuCau` rows 16–18; `P2_02_TuDiemMien` rows 13, 20, 22 and 24; original UC36–UC44.
- SRS supplied by the project team, sections 1.5–1.6, UT01–UT08, PV01–PV07 and HT04 (pages 2–3, 55–69, 98), supplies detail where the workbook does not define a rule.
- Repository `docs/ROLES_AND_STATES.md`, `docs/api/CV_API_CONTRACT.md`, `docs/api/RBAC_MATRIX.md`, and `packages/contracts/src/index.ts`.

The M04 base sheet maps withdrawal to original UC39 but gives no state matrix. The workbook's `P3A_01_CaSuDung` uses a different `UC-15` mapping and refers to `OFFERED`, which is absent from the repository's Application states. The SRS specifies withdrawal from pending and viewed applications (UT03); `docs/ROLES_AND_STATES.md` only draws withdrawal from `SUBMITTED`. The M04 domain rule uses the specific SRS precondition and implements `SUBMITTED`/`REVIEWING` → `WITHDRAWN`. The conflicting state documentation still needs reconciliation before the API contract is finalized.

## Application contract, confirmed portion

| Concern | Rule | Source |
| --- | --- | --- |
| Creation | Student chooses a CV for an open, unexpired job; store the submitted CV as an immutable snapshot. | UT01; workbook FR-12; CV contract C-03 |
| Repeat application | One student may submit only once to a given job, including after withdrawal or rejection. | Workbook FR-12; domain glossary GL-16 |
| Initial state | `SUBMITTED`. | UT01; repository state diagram |
| Ownership | Student may read only their own applications; employer may read only applications of jobs they manage. | UT02, UT04; UC36–UC37 |
| View | Employer viewing an application moves `SUBMITTED` → `REVIEWING` and records history. | UT06; state diagram |
| Withdraw | Student may move `SUBMITTED` or `REVIEWING` → `WITHDRAWN`. | UT03; SRS 1.5 |
| Reject before interview | Employer may move `REVIEWING` → `REJECTED`; rejection reason is required by workbook FR-13. | UT07; workbook FR-13 |
| Invite | Employer may move `REVIEWING` → `INTERVIEW_SCHEDULED` only with a valid interview. | PV01; state diagram |
| Final result | Employer may move `INTERVIEW_SCHEDULED` → `ACCEPTED` or `REJECTED` only after the interview occurred. | PV06–PV07 |
| Terminal states | `WITHDRAWN`, `ACCEPTED`, `REJECTED` cannot be changed by these M04 actions. | SRS 1.5; UT07; PV06–PV07 |

`application-state.ts` implements the role/state rules, and `application-submission-policy.ts` implements the one-student/one-job rule. `M04Workflow` checks CV and job ownership through required ports. `PrismaM04Repository` writes status/history in transactions and the Application migration adds a unique `(studentId, jobId)` constraint. This design still needs database-backed integration verification.

### Actor, permission and validation matrix

| Actor | Action | Required resource check | Required validation |
| --- | --- | --- | --- |
| Student | Submit | CV belongs to the student; job is open and accepting applications | CV selected; immutable snapshot available; no earlier application to that job; quota rule once defined |
| Student | List/detail | Application belongs to the student | No cross-user data returned |
| Student | Withdraw | Application belongs to the student | Current state is `SUBMITTED` or `REVIEWING` |
| Employer/HR | List/detail for job | Employer manages the actual job | No cross-company data returned; CV is read through the submitted snapshot |
| Employer/HR | Mark viewed | Employer manages the actual job | Current state is `SUBMITTED` |
| Employer/HR | Reject | Employer manages the actual job | Current state is `REVIEWING`; nonblank reason |
| Employer/HR | Invite | Employer manages the actual job | Current state is `REVIEWING`; valid future interview schedule |
| Employer/HR | Record final result | Employer manages the actual job | Interview occurred; application is `INTERVIEW_SCHEDULED` and has no final result |

Every successful status change writes a history entry with application ID, actor ID, prior state, new state and time. A rejection retains its reason. The controller uses the existing JWT/role guards and maps M04 workflow errors through `M04ExceptionFilter`. Original UC37 lists Moderator/Admin as detail viewers, but the M04 sheet does not grant their resource-level access rule, so no broad read permission is inferred here.

## Interview contract, confirmed portion

| Concern | Rule | Source |
| --- | --- | --- |
| Invitation | HR supplies future date/time, onsite location or online link, and may include a message. | PV01; workbook FR-14 |
| Read | Candidate sees only interviews attached to their own applications; latest accepted schedule is shown. | PV02 |
| Response | Candidate may confirm an effective invitation that has not received a final response. | PV03 |
| Change request | Candidate may submit at most one change request per interview, before the interview occurs. | PV04; UC43 |
| Change decision | HR managing the job may approve or reject a pending request only once; approval updates the visible schedule for both parties. | PV05; UC44 |
| Result | HR records a final decision after the interview and before a final application result exists. | PV06–PV07 |

`interview-rules.ts` covers schedule validity, the one-request limit, one-time decision, and result timing. `M04Workflow` checks ownership, and `PrismaM04Repository` persists invitations, confirmations, requests, decisions and results. Response expiry and cancellation are unspecified; notification is not implemented.

## Matching Score (M04-04)

The workbook's glossary GL-18 describes the score as the proportion of job-required skills found in the CV. It does not define the score scale, skill normalization, priority weighting, or behavior when the required-skill list is empty. UT08 says the score supports HR sorting, does not decide recruitment, and is absent when skill data is missing. The SRS section 1.6 also leaves the formula open. `matching-score.ts` defines `AVAILABLE`/`UNAVAILABLE` output and currently returns **unavailable**, with a reason, even when skills exist because the numeric formula is unapproved. Candidate time sorting is implemented. No fabricated numeric value is produced.

## Dependencies and unresolved decisions

1. **M02 CV:** Cv persistence, GetCvSnapshotUseCase, CvSnapshotSourceAdapter and approved C-03 now exist. Before binding, reconcile identity: M04Controller passes authenticated user ID, while M02 snapshot resolves StudentProfile.id and returns that profile ID. Do not equate these namespaces or copy CV CRUD into M04.
2. **M03 Job/Employer:** Company/Branch schema exists, but there is no Job model/API or real JobAccessSource adapter. M03 must publish its eligibility/ownership API under C-07; the workbook explicitly forbids direct M03 database access by M04. Skill requirements and accepted capacity still need a stable contract.
3. **M05 Notification:** NotificationsModule and a publisher now exist; docs/api/NOTIFICATION_API_CONTRACT.md (C-20) remains DRAFT and explicitly asks how C-20 maps to C-10. C-12/C-15 recipient, event identity and duplicate-handling semantics are not approved. M04 has no notification binding and must not claim delivery.
4. **Quota:** the workbook includes "quota check" in M04 scope but does not give a number or define which application statuses count. No numeric quota is enforced until that workbook rule is defined. The SRS mentions five applications but explicitly leaves the count policy open, so it does not settle the workbook gap. The one-student/one-job rule is enforced through a unique `(studentId, jobId)` constraint in the Application migration.
5. **Contract IDs:** the workbook associates C-05 with M04 CV submission, while `docs/api/CV_API_CONTRACT.md` defines C-05 for M01→M02 account ownership. Confirm the ID mapping before updating shared contracts.
6. **Interview response deadline and cancellation:** PV03 mentions a response that can expire or be cancelled but provides no deadline or cancellation rule. These must not be invented.

## Verification status

The domain rules and isolated workflow have unit coverage. `apps/api/test/m04-contract.e2e-spec.ts` exercises the HTTP controller, validation and role guard with fixture adapters. Prisma schema validates and the API typechecks/builds. No live database-backed or real M02/M03/M05 end-to-end test has run. The controller routes exist but are inactive in the main application until `M04Module.register(...)` receives real CV and Job providers and is imported into `AppModule`.

### Adapter binding

`M04Module.register(cvProvider, jobProvider)` requires the providers to bind `M04_CV_SOURCE` and `M04_JOB_SOURCE`. The CV adapter must return an owned, immutable `CvSnapshotDto`; the Job adapter must check active/unexpired acceptance and the actual employer-to-job relationship. `PrismaM04Repository` is the default M04 persistence provider. The module cannot be activated without those two real adapters.
