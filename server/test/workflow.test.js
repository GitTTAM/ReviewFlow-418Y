import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
import mongoose from "mongoose";
import { Review, ReviewAnswer, SignedPDF, User } from "../src/models/index.js";
import { seedDemoData } from "../src/demoData.js";
import { migrate } from "../migrations/001-reviewflow.js";
import { startFixture, Session, payload, snapshot } from "./helpers.js";
let fx, manager;
const edit = () => `/reviews/${fx.review._id}/save`;
const detail = () => `/reviews/${fx.review._id}`;
before(async () => {
  fx = await startFixture();
});
beforeEach(async () => {
  await fx.closeServer();
  await fx.reset();
  await fx.start();
  manager = new Session(fx);
  await manager.login();
});
after(async () => {
  if (fx) await fx.stop();
});

test("US-08: email/password sign-in, generic errors, role account details", async () => {
  const client = new Session(fx);
  await client.request("GET", "/auth/session");
  await client.request(
    "POST",
    "/auth/login",
    { email: fx.users["matt.manager@example.test"].email, password: "wrong" },
    401,
  );
  assert.equal((await client.request("GET", "/auth/session")).user, null);
  const signedIn = await client.request("POST", "/auth/login", {
    email: "MATT.MANAGER@EXAMPLE.TEST",
    password: "ReviewFlow!2026",
  });
  assert.equal(signedIn.user.role, "manager");
  assert.equal(signedIn.user.passwordHash, undefined);
  await client.request("GET", "/hr/forms", undefined, 403);
  await client.request("GET", "/hr/assignments", undefined, 403);
});
test("US-01: actual questions, saved note, incomplete text/dropdown draft and fresh login persistence", async () => {
  const loaded = await manager.request("GET", detail());
  assert.equal(loaded.questions.length, 4);
  assert.match(loaded.answers[String(fx.questions[0]._id)], /Initial saved note/);
  const data = payload(fx);
  data.answers[String(fx.questions[2]._id)] = "";
  const saved = await manager.request("POST", edit(), data);
  assert.match(saved.message, /Draft saved/);
  await manager.request("POST", "/auth/logout", {});
  const fresh = new Session(fx);
  await fresh.login();
  const reopened = await fresh.request("GET", detail());
  assert.deepEqual(reopened.answers, data.answers);
  assert.equal(reopened.review.status, "In progress");
  assert.equal(reopened.review.completedAt, null);
});
test("US-02: missing answer and discussion both identified without modifying saved draft", async () => {
  const before = await snapshot(fx),
    data = payload(fx, "complete");
  data.answers[String(fx.questions[2]._id)] = "";
  data.discussionConfirmed = false;
  const invalid = await manager.request("POST", edit(), data, 400);
  assert.match(invalid.fields[String(fx.questions[2]._id)], /next development goal/);
  assert.match(invalid.fields.discussionConfirmed, /Confirm/);
  assert.equal(await snapshot(fx), before);
  data.answers[String(fx.questions[2]._id)] = "Corrected goal";
  data.discussionConfirmed = true;
  await manager.request("POST", edit(), data);
});
test("US-01: invalid dropdown, unknown question, malformed answer types rejected with saved data intact", async () => {
  const before = await snapshot(fx);
  for (const changes of [
    (a) => {
      a[String(fx.questions[1]._id)] = "forged-choice";
    },
    (a) => {
      a["000000000000000000000001"] = "wrong form";
    },
    (a) => {
      a[String(fx.questions[0]._id)] = {};
    },
    (a) => {
      delete a[String(fx.questions[0]._id)];
    },
  ]) {
    const data = payload(fx);
    changes(data.answers);
    await manager.request("POST", edit(), data, 400);
    assert.equal(await snapshot(fx), before);
  }
});
test("US-01/02: failed saves roll back partial answer writes, status/version, and stay private", async () => {
  for (const action of ["draft", "complete"]) {
    const before = await snapshot(fx);
    fx.failAfterAnswer = true;
    const failed = await manager.request("POST", edit(), payload(fx, action), 503);
    assert.match(failed.message, /failed/);
    assert.doesNotMatch(failed.message, /Draft saved/);
    assert.equal(await snapshot(fx), before);
    fx.failAfterAnswer = false;
    const employee = new Session(fx);
    await employee.login("jordan.employee@example.test");
    await employee.request("GET", detail(), undefined, 403);
  }
});
test("US-02: failure after final metadata update still rolls back entire transaction", async () => {
  const before = await snapshot(fx);
  fx.failBeforeCommit = true;
  await manager.request("POST", edit(), payload(fx, "complete"), 503);
  assert.equal(await snapshot(fx), before);
});
test("US-02: completion records manager/time/discussion, locks every role, employee reads immediately without PDF", async () => {
  const start = Date.now();
  const final = payload(fx, "complete");
  await manager.request("POST", edit(), final);
  const stored = await Review.findById(fx.review._id);
  assert.equal(stored.status, "Completed");
  assert.equal(String(stored.completedBy), String(fx.users["matt.manager@example.test"]._id));
  assert(stored.completedAt.getTime() >= start);
  assert(stored.discussionConfirmed);
  const before = await snapshot(fx);
  for (const email of [
    "matt.manager@example.test",
    "riley.manager@example.test",
    "hr@example.test",
    "jordan.employee@example.test",
    "casey.employee@example.test",
  ]) {
    const client = new Session(fx);
    await client.login(email);
    await client.request("POST", edit(), { ...final, version: 1 }, 403);
  }
  assert.equal(await snapshot(fx), before);
  const employee = new Session(fx);
  await employee.login("jordan.employee@example.test");
  const result = await employee.request("GET", detail());
  assert.deepEqual(result.answers, final.answers);
  assert.equal(result.pdf, null);
  assert.equal(result.review.completedBy.name, "Matt Demo");
  assert.equal((await employee.request("GET", "/employee/results")).reviews.length, 1);
});
test("privacy: employee/other manager direct links and spoofed actor cannot read or change draft", async () => {
  const before = await snapshot(fx);
  for (const email of [
    "jordan.employee@example.test",
    "riley.manager@example.test",
    "casey.employee@example.test",
  ]) {
    const client = new Session(fx);
    await client.login(email);
    await client.request("GET", detail(), undefined, 403);
    await client.request("GET", `${detail()}/pdf`, undefined, 403);
    await client.request(
      "POST",
      edit(),
      {
        ...payload(fx),
        actor: fx.users["matt.manager@example.test"],
        manager: fx.users["matt.manager@example.test"]._id,
      },
      403,
    );
  }
  assert.equal(await snapshot(fx), before);
  const hr = new Session(fx);
  await hr.login("hr@example.test");
  await hr.request("GET", detail());
  await hr.request("POST", edit(), payload(fx), 403);
});
test("US-08: all role pages deny mismatched roles and unauthenticated requests", async () => {
  const anon = new Session(fx);
  await anon.request("GET", detail(), undefined, 401);
  for (const [email, denied] of [
    ["hr@example.test", ["/manager/reviews", "/employee/results"]],
    ["jordan.employee@example.test", ["/hr/forms", "/hr/assignments", "/manager/reviews"]],
  ]) {
    const client = new Session(fx);
    await client.login(email);
    for (const route of denied) await client.request("GET", route, undefined, 403);
  }
});
test("security: CSRF token is required for login and review saves", async () => {
  await manager.request("POST", edit(), payload(fx), 403, { "X-CSRF-Token": "forged" });
  const anon = new Session(fx);
  await anon.request(
    "POST",
    "/auth/login",
    { email: "hr@example.test", password: "ReviewFlow!2026" },
    403,
  );
});
test("NFR-07: server inactivity expires all roles at 15 minutes and blocks write", async () => {
  const clients = [];
  for (const email of [
    "matt.manager@example.test",
    "hr@example.test",
    "jordan.employee@example.test",
  ]) {
    const c = new Session(fx);
    await c.login(email);
    clients.push(c);
  }
  const before = await snapshot(fx);
  fx.now += 900001;
  for (const client of clients) {
    const expired = await client.request("POST", edit(), payload(fx), 401);
    assert.match(expired.message, /15 minutes/);
    assert.equal((await client.request("GET", "/auth/session")).user, null);
  }
  assert.equal(await snapshot(fx), before);
});
test("NFR-07: activity renews timeout and responses forbid private caching", async () => {
  fx.now += 899000;
  await manager.request("GET", detail());
  assert.match(manager.last.headers.get("cache-control"), /no-store/);
  fx.now += 899000;
  await manager.request("GET", detail());
});
test("concurrent stale tabs: exactly one snapshot wins; no mixed answers", async () => {
  const one = payload(fx),
    two = payload(fx);
  two.answers[String(fx.questions[0]._id)] = "Other tab";
  const send = (body) =>
    fetch(fx.url + edit(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: manager.cookie,
        "X-CSRF-Token": manager.csrf,
      },
      body: JSON.stringify(body),
    });
  const responses = await Promise.all([send(one), send(two)]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const saved = await manager.request("GET", detail());
  assert.equal(saved.review.version, 1);
  assert(
    [one.answers[String(fx.questions[0]._id)], "Other tab"].includes(
      saved.answers[String(fx.questions[0]._id)],
    ),
  );
});
test("database constraints: one active review, one answer, one PDF, self-review and completion metadata", async () => {
  await assert.rejects(
    Review.create({
      employee: fx.review.employee,
      manager: fx.users["riley.manager@example.test"]._id,
      form: fx.form._id,
    }),
    (e) => e.code === 11000,
  );
  await assert.rejects(
    ReviewAnswer.create({
      review: fx.review._id,
      question: fx.questions[0]._id,
      value: "duplicate",
      savedAt: new Date(),
    }),
    (e) => e.code === 11000,
  );
  const pdf = await SignedPDF.findOne();
  await assert.rejects(
    SignedPDF.create({
      review: pdf.review,
      originalName: "duplicate.pdf",
      storagePath: "duplicate.pdf",
      uploadedBy: pdf.uploadedBy,
    }),
    (e) => e.code === 11000,
  );
  await assert.rejects(
    Review.create({
      employee: fx.users["matt.manager@example.test"]._id,
      manager: fx.users["matt.manager@example.test"]._id,
      form: fx.form._id,
    }),
    (e) => e.code === 121,
  );
  await assert.rejects(
    Review.updateOne({ _id: fx.review._id }, { $set: { status: "Completed" } }),
    (e) => e.code === 121,
  );
});
test("normal app restart, reconnect, migration and reseed preserve saved draft and existing password", async () => {
  await manager.request("POST", edit(), payload(fx));
  const before = await snapshot(fx);
  await fx.closeServer();
  await mongoose.disconnect();
  await mongoose.connect(fx.db.getUri(), { autoIndex: false });
  await fx.start();
  await manager.request("GET", detail());
  assert.equal(await snapshot(fx), before);
  const counts = [await Review.countDocuments(), await ReviewAnswer.countDocuments()];
  await migrate();
  await seedDemoData();
  assert.equal(await snapshot(fx), before);
  assert.deepEqual([await Review.countDocuments(), await ReviewAnswer.countDocuments()], counts);
  const user = await User.findOne({ email: "hr@example.test" }).select("+passwordHash");
  await User.updateOne(
    { _id: user._id },
    { $set: { name: "Edited name", passwordHash: "preserved-custom-hash" } },
  );
  await seedDemoData();
  assert.equal(
    (await User.findById(user._id).select("+passwordHash")).passwordHash,
    "preserved-custom-hash",
  );
});
test("NFR-02/08/09: ten saved drafts, five locked finals and three distinct completing managers", async () => {
  const reviewers = [
    fx.users["matt.manager@example.test"],
    fx.users["riley.manager@example.test"],
    fx.users["empty.manager@example.test"],
  ];
  const { saveReview } = await import("../src/services/reviewWorkflow.js");
  for (let i = 0; i < 10; i++) {
    const employee = await User.create({
      email: `sample${i}@example.test`,
      name: `Sample ${i}`,
      role: "employee",
      passwordHash: "not-a-login",
    });
    const review = await Review.create({
      employee: employee._id,
      manager: reviewers[i % 3]._id,
      form: fx.form._id,
    });
    const answers = payload(fx).answers;
    answers[String(fx.questions[0]._id)] = `Persistent ${i}`;
    await saveReview({
      actor: reviewers[i % 3],
      reviewId: String(review._id),
      answers,
      version: 0,
      action: "draft",
    });
    assert.equal(
      (await ReviewAnswer.findOne({ review: review._id, question: fx.questions[0]._id })).value,
      `Persistent ${i}`,
    );
    if (i < 5) {
      await saveReview({
        actor: reviewers[i % 3],
        reviewId: String(review._id),
        answers,
        version: 1,
        action: "complete",
        discussionConfirmed: true,
      });
      for (const actor of [reviewers[i % 3], fx.users["hr@example.test"]])
        await assert.rejects(
          saveReview({ actor, reviewId: String(review._id), answers, version: 2, action: "draft" }),
          (e) => e.status === 403,
        );
      const final = await Review.findById(review._id);
      assert.equal(String(final.completedBy), String(reviewers[i % 3]._id));
    }
  }
});
