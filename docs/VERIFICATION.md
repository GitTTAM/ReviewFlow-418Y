# Verification record — November 22, 2026

I kept ReviewFlow in `418Y Review flow`. The `GitTTAM/ReviewFlow-418Y` remote was empty when I started. I haven't committed, pushed, or deployed anything, and I left the PA4 reference source alone. These checks cover the MERN app.

For the original foundation check, I reset the demo and verified Jordan's Assigned/version 0 review with four questions and the initial note. The production-server sign-in check returned HTTP 200 and the correct manager/employee. I now provide `start_platform.bat` and `clear_platform_ports.bat` for everyday use. The later launcher checks used separate ports and data folders; I left the existing manually started app on port 5050 and its database alone.

## Readability and desktop launcher update

I rewrote the README and handoff in my voice, expanded the CSS/React/shared server files, added labeled CSS sections, and moved the dropdown icon to `client/src/assets/select-chevron.svg`. Prettier and `.editorconfig` keep the source readable for the team.

- `npm run format:check`: all matched source files passed.
- `npm test`: 20 passed, 0 failed after formatting and launcher changes.
- `npm run test:browser`: 3 passed, 0 failed after the readability update, including the full review walkthrough and inactivity sign-out.
- `npm run test:launcher`: 3 passed, 0 failed. I checked prerequisites, first startup, repeated Start, cleanup preview, graceful stop, saved-draft persistence after restart, repeated cleanup, and leaving an unrelated listener running. These tests launch real hidden services on their own ports.
- `.\start_platform.bat -PreflightOnly -NoWait`: the batch entry point passed its prerequisite check.
- The launcher rebuilt the production frontend successfully. I test its automatic startup with `-NoBrowser`; opening the default browser by double-click is still a manual desktop check.
- The shared repo contains no supplied PDFs or report starter. I verified those files are neither tracked nor staged. Git ignore rules cover PDFs and the private local working folder.

## Automated evidence

- `npm ci --no-audit --no-fund`: clean lockfile setup.
- `npm run migrate`, `npm run seed`: additive migration and fictional seed against persistent local MongoDB.
- `npm run build`: React production bundle via Vite.
- `npm test`: **20 passed, 0 failed**, final run ~50 seconds, against actual isolated MongoDB replica sets.
- `npm run test:browser`: **3 passed, 0 failed**, final run ~20 seconds. Chromium walkthrough via Playwright; manager-to-employee flow, incorrect login/HR role denial, and browser inactivity timer.
- `Invoke-RestMethod http://127.0.0.1:5050/api/health`: API running; `Invoke-WebRequest http://127.0.0.1:5050/login -UseBasicParsing`: HTTP 200 from built React app.
- `npm run reset`: correctly refuses without destructive flag. `npm run reset -- --yes-delete-local-data`: explicit local reset/reseed; demo left at initial state.
- `node scripts/verify-local-persistence.mjs capture` / `check`: compare saved draft across actual app and persistent MongoDB stop/start. Capture modifies only Jordan's fictional draft; reset afterward.
- `py -3.8-32 scripts/check_submission.py`: report accounting and evidence-file check, separate from behavior verification.

## Covered behavior

| Requirement | Evidence |
| --- | --- |
| Email/password, invalid credentials, all three roles | API tests + browser role/login tests |
| Seeded questions and existing answer | API + browser editor checks |
| Text/dropdown draft with missing required goal | API + browser draft check |
| Sign-out/new sign-in, app/database reconnect | API persistence test + browser reopen |
| Disk persistence with local MongoDB restarted | Explicit capture/check smoke command |
| Missing question and discussion errors | API field assertions + browser correction retention |
| Invalid dropdown/unknown question/malformed values | API negative tests; saved snapshot unchanged |
| Failure after first answer write | Real MongoDB transaction throws after write; old answers/status/version intact |
| Failure after final completion metadata write | Throw before commit; all answers/metadata roll back; employee still denied |
| Failed HTTP save display | Browser intercepted 503; typed entries remain, no success message |
| Atomic completion and employee visibility without PDF | API metadata assertions + independent employee browser profile |
| Locked completed answers | Five additional completed samples; manager/HR direct saves rejected; main final tested against manager/HR/employee/unrelated manager |
| Completing manager/date | Main final plus five samples involving three distinct managers |
| Direct-link and spoofed identity access | API wrong manager/employee/role attempts; browser draft denial; request body actor ignored |
| One active review/employee, one answer/question, one PDF/review | Actual unique-index rejection tests |
| No self-review/inconsistent completion metadata | Database validator rejection tests |
| Stale tabs/concurrent saves | Two simultaneous requests; one success, one 409; consistent version |
| 15-minute server timeout | Injected clock crosses deadline for HR/manager/employee; writes denied; active request renews timeout |
| Browser hides private UI after inactivity | Playwright clock advances 15 minutes; login screen replaces private screen |
| CSRF/private response caching | Missing/forged token rejected; no-store response asserted |
| Seed/migration preserve existing work | Saved snapshot/count/password checks before/after re-run |

## Manual verification still needed

- Latest Chrome, Firefox and Edge compatibility; automated run used existing Chromium headless shell, not all latest browsers.
- Complete keyboard-only workflow, visible focus/error-link order, screen reader behavior, and small-screen usability inspection.
- Real elapsed 15-minute idle session per role. Automated clock tests prove code paths, not a wall-clock waiting trial.
- NFR-03: 50 assigned reviews, 20 dashboard loads, 19 under two seconds. Dashboard is not built yet.
- Teammate acceptance tests for form CRUD, assignment/reassignment, dashboard, PDF upload/download. No production upload path currently exists.
- Final integrated story accounting, contributions, report export, 3–5 minute recording and Brightspace upload.

**Verified story count: 3/10 (30%) — US-01, US-02, US-08.** US-03 stays Incomplete because signed PDF opening is missing. Seeded assignments/forms/PDF records do not count as HR workflows. This foundation alone falls below M4's 60% threshold.
