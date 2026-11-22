# ReviewFlow

I put together this foundation for our Team 02 project in ICSI 418Y. My part covers signing in, saving drafts, and completing a review. Once a manager finishes a review, the employee can read it right away.

I left each of you a separate starting screen and backend route for your part. [Start with your task card](docs/TEAM_HANDOFF.md) for the files, account, first change, and tests I want you to use.

**I've verified 3 of our 10 MVP stories:** US-01, US-02, and US-08. We need at least 6 for Milestone 4. The sample forms and assignments let us try the app, but they don't count as finished HR features.

## Start the app with one button

You'll need **Node.js 22 or newer** installed. After that:

If an older copy is already running, close that session once before switching to the buttons.

1. Open this project folder and double-click **`start_platform.bat`**.
2. Let the setup finish. On the first run, it installs packages and downloads MongoDB, which can take a few minutes.
3. Your browser opens **http://127.0.0.1:5050** when the app is ready. Sign in with one of the accounts below.

I set the launcher up to build the frontend, check the database setup, and add demo accounts only when the database is empty. Your saved answers stay there between launches. Everything runs in the background. You can close the startup window once the browser opens.

When you're done, double-click **`clear_platform_ports.bat`**. It stops this project's app and database without deleting saved reviews. It leaves processes it can't identify as ReviewFlow alone and tells you which ports are still busy.

If you change React or CSS, use **Clear Ports**, then **Start** to rebuild and see your changes. I put the optional setup for live updates in [DEVELOPMENT.md](docs/DEVELOPMENT.md#manual-development-setup).

## Accounts you can use

Every demo account uses **`ReviewFlow!2026`** as its password. I used fictional people and feedback for all the sample data.

| Email | Role | What I set up for you |
| --- | --- | --- |
| `matt.manager@example.test` | Manager | My demo manager account: Jordan's unfinished review, plus my own completed result. |
| `riley.manager@example.test` | Manager | Jamie's unfinished review. Use this to test another manager's access. |
| `empty.manager@example.test` | Manager | No assignments, so you can build the empty dashboard state. |
| `hr@example.test` | HR | The form and assignment starting screens. |
| `jordan.employee@example.test` | Employee | No result until I finish Jordan's review using the manager account. |
| `casey.employee@example.test` | Employee | A completed review without a PDF. |
| `taylor.employee@example.test` | Employee | A completed review with a fictional sample PDF record. Download still needs work. |
| `jamie.employee@example.test` | Employee | An unfinished review assigned to Riley. |

## Try my review workflow

Here's the walkthrough I want you to try before changing your part:

1. Sign in with **`matt.manager@example.test`**. On Home, click **Open review**. You'll see Jordan's questions and a saved sample note. Copy the page address for the access check later.
2. Fill in **What went well this review period?** Pick **Meets expectations** for collaboration. Leave **What is the next development goal?** blank, then click **Save draft**. You should see a save confirmation.
3. **Sign out**, sign back in, and click **Open review** again. Your text and dropdown answer should still be there.
4. Click **Complete review** with the goal blank and the discussion box unchecked. The page should point out both issues and keep your other answers.
5. Add a goal and check **I confirm I discussed this review with the employee.** Click **Complete review**. You should see the finished answers, reviewer, completion time, and discussion confirmation. The answers are now locked.
6. Sign in as **Jordan**, open **My results**, and click **Read result**. The feedback should be available immediately, even without a PDF.

For the privacy check, I want you to use another browser or a private window. Before completion, Jordan should see **No completed review yet**, and the copied review link should show access denied. Riley or Casey should also get access denied when opening Jordan's result.

Review IDs change after a reset. Use **Home > Open review** to find the right one.

## Where I need each of you to start

| Person | What I need you to build | First file |
| --- | --- | --- |
| My part | Keep the sign-in and manager review workflow working. | `client/src/pages/ReviewWorkflow.jsx` |
| Tasfiah | Create and edit review forms. | `client/src/pages/FormBuilder.jsx` |
| Ahmet | Assign and reassign reviews. | `client/src/pages/Assignments.jsx` |
| Govinda | Build the assigned-review dashboard and its error/empty states. | `client/src/pages/ManagerDashboard.jsx` |
| Lucille | Expand the employee result page and add authorized PDFs. | `client/src/pages/EmployeeResults.jsx` |

I wrote the full instructions and follow-up Codex prompts in [TEAM_HANDOFF.md](docs/TEAM_HANDOFF.md). I also left a [demo outline](docs/DEMO_OUTLINE.md) and [verification notes](docs/VERIFICATION.md).

## Keeping our code readable

I expanded the React, CSS, and shared server files so we can read and edit them together. `client/src/App.css` has labeled sections for buttons, layout, forms, messages, and mobile styles. The dropdown icon lives in its own SVG file.

Please edit the source in `client/src`; `client/dist` gets rebuilt automatically. Use these commands to keep the formatting consistent:

```powershell
npm run format
npm run format:check
```

`format` tidies the files. `format:check` checks them without changing anything. I put the shared code rules and troubleshooting details in [DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Tests I want you to run

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run test:launcher
```

The API tests check saving, permissions, and failed transactions. The browser tests walk through my review flow. The launcher tests use their own ports and database folder. None of these reset your normal demo database.

I've recorded the verified results in [VERIFICATION.md](docs/VERIFICATION.md). If you're using my existing test browser on this machine, use the command in [DEVELOPMENT.md](docs/DEVELOPMENT.md#using-my-existing-test-browser).

## Starting over for a demo

Normal Start and Clear Ports keep your saved work. If you need the original sample reviews back, I put the [explicit reset steps in DEVELOPMENT.md](docs/DEVELOPMENT.md#resetting-the-demo).

**Reset deletes the local demo accounts, reviews, answers, PDF records, and sessions. It is not needed for normal startup.**
