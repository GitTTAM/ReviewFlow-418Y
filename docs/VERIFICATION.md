# Verification record — November 22, 2026

I kept ReviewFlow in `418Y Review flow` and left the PA4 reference source alone. These checks cover the MERN app. I keep `matt/reviewflow-work` as my personal branch and update `main` with the verified changes.

For the original foundation check, I reset the demo and verified Jordan's Assigned/version 0 review with four questions and the initial note. The production-server sign-in check returned HTTP 200 and the correct manager/employee. I now provide `start_platform.bat` and `clear_platform_ports.bat` for everyday use. The later launcher checks used separate ports and data folders; I left the existing manually started app on port 5050 and its database alone.

## Shared database launcher

### Latest connection and two-laptop preparation

I added `npm run check:shared`. It passed against live Atlas: the migration is present, with **8 fictional app accounts and 5 reviews**. The command only reads data. Its local-mode, missing-connection, and wrong-database error checks also passed without exposing credentials.

The current API run passed **23/23**, and the browser run passed **3/3**, including failed saves, completion, access rules, and inactivity sign-out. The production build, formatter, launcher preflight, repeated Start, and all six live Atlas smoke checks passed. The live checks left review answers unchanged.

The final full launcher rerun passed **9/9**, about 123 seconds. The first run passed **8/9**: its local fresh-demo startup stopped during database setup without logging a cause. That case passed **1/1** by itself and passed again in the final full rerun, including intact backups and demo sign-in. I haven't established the cause of that initial process exit. The shared two-app test passed in both full runs.

I restored `.env.example` to a safe template with local defaults and commented Atlas placeholders. The working, ignored `.env` still uses Atlas. A scan found none of the five current database passwords in shareable source, the Git index, or the existing Git commit. The private master credential file retains my broader database roles; teammates remain scoped to `readWrite@reviewflow_team`.

I updated README, DEVELOPMENT, and TEAM_HANDOFF with private `.env` setup, the read-only check, and saving a draft across two laptops. MongoDB connection on the second laptop has been reported; the actual app-to-app save/refresh/stop/restart check still needs confirmation. No shared review was completed or reset for these checks.

I also prepared a source-only transfer ZIP in ignored `.local/transfer/ReviewFlow-second-laptop-test.zip` so the second laptop can use the same source without copying local state. It includes the startup buttons, lockfile, safe template, updated docs, and connection check. It excludes `.env`, credentials, local data, dependencies, Git metadata, supplied PDFs, and the private report draft.

I added shared mode to Start Platform, a separate one-time `npm run setup:shared -- --seed-demo` command, and protection against exposing connection passwords in startup errors. Shared startup doesn't launch local MongoDB, seed accounts, or apply migrations. Clear Ports leaves the shared database online. The local fresh-demo button refuses shared mode, and the local reset refuses the dedicated `reviewflow_team` database.

- `npm test`: **23 passed, 0 failed**, including three new configuration/password-redaction checks.
- `npm run test:launcher`: **9 passed, 0 failed**, about 148 seconds. Two separate app launchers connected to one isolated replica set; a draft saved through one appeared through the other. Stopping one app left the other app, its database, and an unrelated listener online.
- Shared setup was rerun after a saved draft without changing that draft. Uninitialized shared startup refused to seed automatically. Failed shared connections never fell back to local MongoDB; state and error output omitted the test URI and password.
- The suite also covered the original local startup, missing-file backup flow, persistence, process ownership, and junction checks. I fixed a timing issue where a fast supervisor exit could hide its database error in the visible launcher.
- `npm run format:check` and `git diff --check` passed. The tests use separate ports and data folders; they leave shared reviews alone.
- Those automated shared-database tests use temporary local replica sets. I also completed the live Atlas checks below; teammate credentials and IP approvals remain separate checks.
- PDF storage remains a separate team task. Sharing MongoDB alone does not share local PDF files.

### Live Atlas setup

I connected to Cluster0 in the separate ReviewFlow project, applied the migration to `reviewflow_team`, and seeded its empty database with **8 fictional app accounts and 5 reviews**. I saved the working connection in ignored `.env`, kept a private backup of the previous settings, and restarted this checkout using Atlas. The old local database stayed on disk. I did not change the existing `418Y` cluster.

Six live smoke checks passed: production login/health, manager sign-in and actual saved questions/answers, matching the served review against Atlas, reopening after sign-out, direct-link draft privacy, and an employee reading a completed result without a PDF. These checks did not change review answers. The private receipt is `.local/atlas/live-app-smoke.json`.

All five database logins now authenticate. Tasfiah, Ahmet, Govinda, and Lucille each have only `readWrite` on `reviewflow_team`. I am keeping my existing `readWriteAnyDatabase`, `dbAdmin@reviewflow_team`, and `readWrite@reviewflow_team` roles. The verified private credentials file is in Downloads and stays out of Git. Each teammate still needs their laptop's public IP approved, and I haven't verified the shared app from a second physical laptop yet.

## Database startup on another laptop

I added a missing/empty `WiredTiger.wt` check and a separate `start_fresh_demo.bat` button. Normal Start never replaces a database automatically. The fresh-demo button requires an explicit choice, keeps the existing folder as a uniquely named backup, and leaves any earlier recovery copy alone. I kept the README to three recovery steps and put technical details in DEVELOPMENT.md.

- Final Windows launcher run: **7 passed, 0 failed**, about 103 seconds. This includes the original saved-draft restart test and new checks for incomplete metadata, explicit confirmation, intact backup contents, untouched recovery copies, fresh demo sign-in, unrelated processes, normal and broken junctions, and a database already used on another port.
- Production frontend builds ran successfully through the launcher tests. `npm run format:check` passed.
- The tests used isolated folders and ports. My usual demo stayed on its original running instance; no normal database reset or recovery was attempted.
- The restricted sandbox blocked esbuild and Windows process inspection, so I ran the final suite with normal Windows access. One intermediate rerun exited without a diagnostic; the final detailed TAP run completed all seven checks.
- I haven't inspected or repaired the other laptop. These changes provide a safe new demo, not recovery of missing database contents. Browser auto-opening remains a manual check; automated starts use `-NoBrowser`.

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
