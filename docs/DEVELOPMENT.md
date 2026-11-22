# Working on ReviewFlow

I kept the README focused on getting started. These are the extra details I want you to have when changing shared code or troubleshooting your setup.

## How the code fits together

| Folder or file | What's there |
| --- | --- |
| `client/src/pages/` | React screens, including a separate starting file for each teammate. |
| `client/src/App.jsx` | Routes, role navigation, and shared loading/error screens. |
| `client/src/App.css` | Shared styles, grouped by page area and component. |
| `client/src/assets/` | Small assets such as the dropdown chevron. |
| `client/src/api.js` | Shared functions for calling the API. |
| `server/src/routes/` | Separate route files for forms, assignments, dashboard, and employee/PDF work. |
| `server/src/services/` | Shared validation and review-saving logic. |
| `server/src/models/index.js` | The six M3 entities and their indexes. |
| `server/test/` | API/database tests, including one file for each teammate's feature. |
| `client/test/` | Browser tests. |

## Keeping the code readable

Use two spaces for indentation, one CSS declaration per line, and a blank line between separate pieces of logic. Keep JSX spread over multiple lines so the page structure is easy to follow.

Prettier handles the mechanical formatting:

```powershell
npm run format
npm run format:check
```

The settings are in `.prettierrc.json`. `.editorconfig` tells supporting editors to use the same indentation and line endings. Generated builds, dependencies, and local data are excluded from formatting.

Add comments where they explain a rule or a decision. For example, explain why a completed answer cannot be edited; you don't need a comment explaining what every `setState` call does.

In `App.css`, start with the section closest to what you're changing. The dropdown icon is in `client/src/assets/select-chevron.svg` so nobody has to edit an encoded SVG inside a CSS line.

## Shared rules to keep working

The M3 entities are `User`, `ReviewForm`, `FormQuestion`, `Review`, `ReviewAnswer`, and `SignedPDF`. MongoDB also has `sessions` and `migrations` collections for app infrastructure.

- Use **`saveReview()`** in `server/src/services/reviewWorkflow.js` for answer and completion writes. It checks access and answer values, then saves everything together in a transaction. A successful return means the save committed.
- Keep server permission checks in every feature. Helpers live in `server/src/permissions.js`: `requireRole`, `requireRead`, `requireEdit`, `assignedReviewFilter`, `employeeResultFilter`, and `requirePDFRead`. The React role gate helps with navigation; the server decides access.
- Call **`getReviewForUser(user, id)`** in `server/src/services/reviewQueries.js` before exposing a review's questions, answers, or files.
- Use the existing helpers in `client/src/api.js`. They send the session cookie and CSRF token. A user ID in a request body is never proof of who is signed in.
- Keep new multi-record writes in transactions. Reassignment must increment `Review.version` so an old editor tab cannot overwrite the new assignment. Protect forms once a review uses them.
- Keep uploaded PDFs private. There is no public media URL; downloads need a server access check.

Unique indexes allow one active review per employee, one answer per review/question, and at most one PDF per review. The migration also rejects self-review and inconsistent completion details. Cross-record checks still belong in the services.

The server and browser sign users out after 15 minutes without a request. Unsaved typing doesn't extend that deadline. Save a draft before stepping away; there is no autosave.

## Starting from the desktop buttons

I added `start_platform.bat` and `clear_platform_ports.bat` so you can run the demo without keeping two terminals open. Their PowerShell helpers live in `devkit/`; `scripts/platform.mjs` manages the hidden app and database processes. Startup logs and process state go in ignored `.local/platform/`.

The Start button checks Node, installs missing packages, builds the client, applies additive migrations, and seeds only an empty database. It reuses an already-running app only when the health check identifies this checkout. The Clear Ports button asks the supervisor to stop gracefully, then checks ownership before stopping any leftover listeners. Unknown processes are left running. It never deletes database files.

You can preview cleanup or check startup prerequisites without launching the browser:

```powershell
.\start_platform.bat -PreflightOnly -NoWait
.\clear_platform_ports.bat -WhatIf -NoWait
npm run test:launcher
```

The helpers use a process-local execution-policy setting; they don't change your machine's policy. If an older app is already running without the checkout health marker, close its original terminal once before using the new Start button. For a custom MONGO_URI, use the manual commands below; the buttons target the local demo database.

## Manual development setup

For normal use, I want you to use `start_platform.bat`. I kept the manual commands here for debugging or working with live frontend updates.

Open PowerShell in the project folder. First-time setup:

```powershell
npm ci --no-audit --no-fund
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run db
```

Keep that database terminal open. In a second terminal:

```powershell
npm run migrate
npm run seed
npm run build
npm start
```

For live frontend updates, use `npm run dev` instead of `npm start` and open http://127.0.0.1:5173. On later manual starts, use `npm run db` and `npm start` in separate terminals. Use Ctrl+C to stop them.

## Resetting the demo

I only use this when I want the original fictional accounts and reviews back.

**Reset deletes all accounts, reviews, answers, PDF records, and sessions in the local demo database. Stop the app first.**

1. Double-click `clear_platform_ports.bat`.
2. Open PowerShell in the project folder, run `npm run db`, and leave it running.
3. In another PowerShell window, run:

```powershell
npm run reset -- --yes-delete-local-data
```

4. Stop the database with Ctrl+C, then double-click `start_platform.bat` to return to normal use.

The reset refuses remote databases and requires the explicit flag. Existing PDF files stay on disk, but their database records are removed. Starting the app normally keeps saved work.

## Database setup details

`npm run db` runs MongoDB 7.0.24 as a local replica set on port 28018. It uses the `mongodb-memory-server` development helper with a persistent folder, so saved data stays after a restart.

| Path | Contents |
| --- | --- |
| `.local/mongo/db` | Saved local database. |
| `.local/mongo-binaries` | Downloaded MongoDB program files. |
| `.local/media` | Private local PDF files. |

These folders are ignored by Git. If you back up the database folder, stop MongoDB first.

If you already have MongoDB, set `MONGO_URI` in the root `.env` to a dedicated replica-set database and skip `npm run db`. A standalone MongoDB server won't support the transactions this app needs.

`npm run migrate` applies `server/migrations/001-reviewflow.js`. It adds collections, indexes, and validation without clearing work. `npm run seed` adds missing sample records and preserves existing answers, passwords, names, and completion status. The desktop launcher applies migrations and seeds only an empty database; the manual `npm start` command starts the server without either setup step.

The separate PA4 project from `418Y V4.zip` was class reference material. ReviewFlow has its own code and database. Keep fictional data in this local class prototype.

## Checking persistence and failed saves

The API tests inject errors inside real MongoDB transactions to check that a failed save keeps the last saved version. The browser tests also check that an error response leaves typed answers in the form.

You can use browser DevTools > Network > Offline to see an unconfirmed request. Switch back to Online before retrying. That shows the network-error screen; the API tests are what check database rollback.

For a full database restart check, this command saves a marker in Jordan's fictional draft:

```powershell
node scripts/verify-local-persistence.mjs capture
```

Stop the app and database with Ctrl+C. Restart `npm run db`, then `npm start`, and run:

```powershell
node scripts/verify-local-persistence.mjs check
```

It compares the saved review with the earlier snapshot. Use the explicit demo reset afterward if you want Jordan's initial sample note back.

## Using my existing test browser

I reused a Chromium browser already on this machine for the earlier verified run. Other computers can use `npx playwright install chromium` as shown in the README.

```powershell
$env:REVIEWFLOW_BROWSER_PATH = 'C:\Users\mlawrence\Python Projects\Personal\418Y V3\.runtime\browsers\chromium_headless_shell-1254\chrome-headless-shell-win64\chrome-headless-shell.exe'
npm run test:browser
Remove-Item Env:REVIEWFLOW_BROWSER_PATH
```

Screenshots go in `.local/evidence/`. Failed-test traces go in `test-results/`.

## Optional Python report check

No Python packages needed. Python 3.8 or newer can check the story count, effort split, and required handoff files:

```powershell
python scripts/check_submission.py
```

I have a working Python 3.8 launcher on this machine, so this is the command I tested here:

```powershell
py -3.8-32 scripts/check_submission.py
```

This checks report bookkeeping, not whether stories work. Run the app tests before marking a story Complete.

## If something won't start

- **Database connection error:** check that the `npm run db` terminal is still running and your `.env` has the expected `MONGO_URI`.
- **Migration missing:** run `npm run migrate`, then `npm run seed` for demo records.
- **Frontend changes aren't showing:** use `npm run dev`, or rebuild with `npm run build` before `npm start`.
- **Sign-in acts differently between tabs:** use `127.0.0.1` consistently instead of mixing it with `localhost`.
- **Port already in use:** check which project is using it before stopping anything. ReviewFlow uses 28018 for the database, 5050 for the app, and 5173 for Vite during development.
