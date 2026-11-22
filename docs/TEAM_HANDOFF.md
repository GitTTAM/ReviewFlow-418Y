# What I need each of you to work on

I've put the shared review workflow in place. I can sign in, save a draft, come back to it, and complete it so the employee can read the result. I need you to build the four features below around that workflow.

Double-click `start_platform.bat` to get running. All demo passwords are `ReviewFlow!2026`. I gave each feature its own React file, route file, shared helpers, and test file so we can work without constantly editing the same files. Please keep the existing review editor working and check access on the server in every new endpoint.

## My part: US-08, US-01, US-02 / UI-01, UI-04

I'm handling sign-in, saving drafts, and completing reviews. I also added the basic employee reading page so we can demonstrate the full handoff after completion.

- **Open first:** `client/src/pages/ReviewWorkflow.jsx`. My shared save function is `saveReview()` in `server/src/services/reviewWorkflow.js`.
- **First step:** try the README walkthrough before changing anything that touches saving or permissions.
- **Account:** `matt.manager@example.test`, then `jordan.employee@example.test`.
- **What you should see:** Home > Open review; saved answers, missing-answer errors, locked completion, and an employee-readable result.
- **How to test:** `npm test`, `npm run build`, and `npm run test:browser`. I need the rollback, access, and lock checks to keep passing.
- **Follow-up Codex prompt:** "Inspect `client/src/pages/ReviewWorkflow.jsx`, `server/src/services/reviewWorkflow.js`, and `server/test/workflow.test.js`. Keep my US-01/02/08 workflow working. Run the manager-to-employee walkthrough and report only fully verified M2 stories. Do not push."

## Tasfiah: US-05/09 / UI-02

Tasfiah, I need you to build the form creator and editor. I left the form list and sample questions ready for you.

- **Open first:** `client/src/pages/FormBuilder.jsx`; your backend file is `server/src/routes/forms.js`.
- **First change:** add name and question fields using **Unused practice form**, then wire up create/edit saves. Support text questions and dropdown options. Keep typed entries when validation fails.
- **Account and screen:** `hr@example.test`; `/hr/forms` and `/hr/forms/:id`.
- **What you should see:** **Team growth review** is in use; **Unused practice form** is editable once your controls work. Valid changes should appear in the list. Missing names/questions should show errors. An in-use form must keep its original definition.
- **Shared function:** call `validateFormDefinition({ actor, name, questions, existingFormId, session })` in `server/src/services/formDefinitions.js`. Use `getForms()` / `apiRequest()` in `client/src/api.js`. Save the form and questions in one transaction, and protect against an assignment arriving during an edit.
- **How to test:** start with `node --test server/test/forms.test.js`, then `npm test`. I need successful create/edit, missing fields, dropdown validation, non-HR denial, in-use protection, and failed-save rollback covered. Add browser cases in `client/test/forms.spec.js`.
- **Follow-up Codex prompt:** "I need US-05/09 implemented in `client/src/pages/FormBuilder.jsx` and `server/src/routes/forms.js`. Call `validateFormDefinition` from `server/src/services/formDefinitions.js` inside atomic writes. Use hr@example.test and Unused practice form. Protect forms already used by any review, including concurrent assignment. Extend `server/test/forms.test.js` and keep the existing review workflow passing. Do not push."

## Ahmet: US-06/10 / UI-05

Ahmet, I need you to turn the assignment table into a working assign/reassign screen. The sample records are there, but creating them with a seed doesn't count as the HR assignment story.

- **Open first:** `client/src/pages/Assignments.jsx`; your backend file is `server/src/routes/assignments.js`.
- **First change:** add employee, manager, and form dropdowns using the existing `getAssignments()` response. Build assignment first, then reassignment for unfinished reviews.
- **Account and screen:** `hr@example.test`; `/hr/assignments`. Check the manager side with `matt.manager@example.test` and `riley.manager@example.test`.
- **What you should see:** Jordan is assigned to my demo manager; Jamie is assigned to Riley. Casey has a completed review and no active one, so you can use that account for a new assignment. Your new review should appear as Assigned. Missing choices, self-review, duplicate active assignments, and completed reassignment must show errors without changing records.
- **Shared function:** call `validateAssignment({ actor, employee, manager, form, existingReview, session })` in `server/src/services/assignments.js`. Use a transaction. Reassignment must check the current manager/version and increment `Review.version`, so an old editor can't overwrite it. Govinda can use `assignedReviewFilter()` for the updated lists.
- **Team decision I still need:** do saved drafts carry over or get cleared on reassignment? Check with us before choosing. Record the decision and test it, along with old-manager denial.
- **How to test:** start with `node --test server/test/assignments.test.js`, then `npm test`. Cover real assign/reassign, missing choices, self-review, duplicates, old/new manager access, completed rejection, and stale editors. Add browser cases in `client/test/assignments.spec.js`.
- **Follow-up Codex prompt:** "I need US-06/10 in `client/src/pages/Assignments.jsx` and `server/src/routes/assignments.js`. Call `validateAssignment` from `server/src/services/assignments.js`, use transactions, and increment Review.version on reassignment. Reject missing choices, self-review, duplicate active assignments, and completed reassignment. Leave draft carryover as a team decision until answered. Extend `server/test/assignments.test.js` and preserve the existing saveReview permissions. Do not push."

## Govinda: US-04 / UI-03/07/08

Govinda, I need you to build the full assigned-review dashboard. My Home page currently has a shortcut to one unfinished review; you can link your list to that same editor.

- **Open first:** `client/src/pages/ManagerDashboard.jsx`; your backend file is `server/src/routes/dashboard.js`.
- **First change:** replace the 501 placeholder with a query for the signed-in manager's reviews. Return employee name, status, and review ID, then render the list.
- **Account and screen:** `/manager/reviews`; `matt.manager@example.test` for an assignment, `riley.manager@example.test` for a different manager, and `empty.manager@example.test` for no assignments.
- **What you should see:** only that manager's assignments, with Assigned/In progress/Completed status. I need an empty message, a load-error screen with **Try again**, and access denied for another manager's review. Don't leave an old or incorrect list visible after a load failure.
- **Shared function:** use `assignedReviewFilter(user)` in `server/src/permissions.js` and `getAssignedReviews()` in `client/src/api.js`. Link unfinished reviews to `/reviews/${review._id}/edit` and completed reviews to `/reviews/${review._id}`. Use the shared `AccessDenied` component for 403 responses. Keep the manager's own employee result under `/employee/results`.
- **How to test:** start with `node --test server/test/dashboard.test.js`, then `npm test`. Add list, empty, retry, and denied-link cases; browser cases go in `client/test/dashboard.spec.js`. For NFR-03, I need 20 loads with 50 assignments, with at least 19 finishing under two seconds.
- **Follow-up Codex prompt:** "I need US-04 in `client/src/pages/ManagerDashboard.jsx` and `server/src/routes/dashboard.js`. Use assignedReviewFilter from `server/src/permissions.js` and getAssignedReviews from `client/src/api.js`. Build own-only names/statuses, empty, load-error/retry, and denied states. Link unfinished reviews to the existing `/reviews/:id/edit` editor. Extend `server/test/dashboard.test.js` and add browser/timing checks. Do not push."

## Lucille: US-03/07 / UI-06/09

Lucille, I need you to expand the employee result page and add the signed PDF workflow. The basic result without a PDF already works, so please build on it.

- **Open first:** `client/src/pages/EmployeeResults.jsx`. The record component is `ReviewResult` in `client/src/pages/ReviewWorkflow.jsx`; your backend file is `server/src/routes/employee.js`.
- **First change:** add HR-only upload for completed reviews and an authorized download link. Put the PDF UI in a small separate component so you don't have to change my review editor.
- **Accounts and screens:** `/employee/results`, `/reviews/:id`, `/api/reviews/:id/pdf`. Use `hr@example.test` for upload; Jordan for no completed result, Casey for completed without PDF, and Taylor for a completed result with a fictional sample PDF record. Managers also need to read their own employee results.
- **What you should see:** the empty and no-PDF states already work. Taylor's sample file exists, but download and upload return 501 until you implement them. After your change, HR and the authorized employee should open the PDF; another employee's direct link must stay denied. The review must remain readable without a PDF.
- **Shared functions:** `employeeResultFilter` and `requirePDFRead` in `server/src/permissions.js`; `getReviewForUser` in `server/src/services/reviewQueries.js`; `validatePDFUpload` in `server/src/services/pdfs.js`. Keep files private, check their content/size, and clean up staged files if saving fails. Preserve the one-PDF index and CSRF checks. The current JSON-only request parser needs a deliberate upload branch or bounded JSON file encoding.
- **How to test:** start with `node --test server/test/employee-pdf.test.js`, then `npm test`. I need successful upload/download, wrong files, storage failures, unfinished-review rejection, duplicate PDFs, authorized/denied links, manager-own-result access, and no public file URL. Add browser cases in `client/test/employee-pdf.spec.js`.
- **Follow-up Codex prompt:** "I need US-03/07 expanded in `client/src/pages/EmployeeResults.jsx`, a separate PDF component beside ReviewResult in `client/src/pages/ReviewWorkflow.jsx`, and `server/src/routes/employee.js`. Use getReviewForUser, requirePDFRead, and validatePDFUpload from the existing services. Add HR-only completed-review upload, authorized download, safe failure cleanup, and all three employee states. Extend `server/test/employee-pdf.test.js`. Count US-03 only when optional PDF opening works. Do not push."
