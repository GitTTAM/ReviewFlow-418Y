# ReviewFlow

I put together this foundation for our Team 02 project in ICSI 418Y. My part covers signing in, saving drafts, and completing a review. Once a manager finishes a review, the employee can read it right away.

I left each of you a separate starting screen and backend route for your part. [Start with your task card](docs/TEAM_HANDOFF.md) for the files, account, first change, and tests I want you to use.

**I've verified 3 of our 10 MVP stories:** US-01, US-02, and US-08. We need at least 6 for Milestone 4. The sample forms and assignments let us try the app, but they don't count as finished HR features.

## Start the app with one button

You'll need **Node.js 22 or newer** installed. After that:

For our team database, follow the shared setup below before your first Start. Without those settings, Start creates a separate local demo.

If an older copy is already running, close that session once before switching to the buttons.

1. Open this project folder and double-click **`start_platform.bat`**.
2. Let setup finish. First run installs packages and, for a local demo, downloads MongoDB.
3. Your browser opens **http://127.0.0.1:5050** when the app is ready. Sign in with one of the accounts below.

Start builds the app and connects to the database. Everything runs in the background. You can close the startup window once the browser opens. Saved answers stay between launches.

When you're done, double-click **`clear_platform_ports.bat`**. It stops this project's app without deleting reviews. A local database stops too; a shared database stays online for the team.

If you change React or CSS, use **Clear Ports**, then **Start** to rebuild and see your changes. I put the optional setup for live updates in [DEVELOPMENT.md](docs/DEVELOPMENT.md#manual-development-setup).

## Moving to another laptop

Download and extract the project. Don't copy `.local` or `node_modules` from another computer.

**For our shared Atlas database:**

1. Ask me to approve your **public IP** in Atlas. The `10.x.x.x` or `192.168.x.x` address from `ipconfig` is your private address.
2. Create `.env` beside `package.json` and paste the private three-line block I send you. Use your own database login.
3. Double-click **`start_platform.bat`**. If an older copy is running, use **Clear Ports** first.

`.env` holds your working connection and stays out of Git. `.env.example` is just a template; leave real passwords out of it. Use the demo accounts below to sign into the app, not your Atlas database username.

**For a separate local demo:** just double-click **`start_platform.bat`**. It creates its own fictional accounts. These local answers won't appear on other laptops.

If a local database won't start and you only need the fictional demo:

1. Double-click **`start_fresh_demo.bat`**.
2. Type **`FRESH`** when asked. Your old database goes into a backup folder, and a new demo starts.
3. Sign in with one of the accounts below. Use normal **Start** next time.

This doesn't recover old answers. If you need them, keep your original database and recovery copy; see [recovery details](docs/DEVELOPMENT.md#when-the-local-database-wont-start). Normal Start keeps saved work.

## Check that both laptops share the same reviews

I added a read-only check you can run in PowerShell after Start has installed the packages:

```powershell
npm run check:shared
```

You should see **PASS: connected to shared database reviewflow_team**. If it says local demo, fix `.env`. If it cannot connect, check your private connection details and approved public IP. The check doesn't change any reviews.

For the actual two-laptop test:

1. Start the app on both laptops. On each, sign in as `matt.manager@example.test` and click **Open review**.
2. On the first laptop, add a short note such as **Two laptop test** and click **Save draft**.
3. Refresh the review on the second laptop. The same note should appear. Make another small change there, save, then refresh the first laptop.
4. Use **Clear Ports** on the first laptop. The second laptop should still work. Start the first again and check that the saved note is still there.

I leave the review unfinished for this check so the next person can keep testing. Completing it locks it for everyone. Refresh before saving if someone else has edited the same review.

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
