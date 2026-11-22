import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { Review, User } from "../src/models/index.js";
import { Session, startFixture } from "./helpers.js";

let fx;
before(async () => {
  fx = await startFixture();
});
after(async () => {
  if (fx) await fx.stop();
});

async function managerSession(email) {
  const client = new Session(fx);
  await client.login(email);
  return client;
}

test("US-04: each manager receives only their assigned reviews and readable names/statuses", async () => {
  const matt = await managerSession("matt.manager@example.test");
  const riley = await managerSession("riley.manager@example.test");
  const mattData = await matt.request("GET", "/manager/reviews");
  const rileyData = await riley.request("GET", "/manager/reviews");

  const mattReviews = await Review.find({ manager: fx.users["matt.manager@example.test"]._id });
  const rileyReviews = await Review.find({ manager: fx.users["riley.manager@example.test"]._id });
  assert.equal(mattData.reviews.length, mattReviews.length);
  assert.equal(rileyData.reviews.length, rileyReviews.length);
  assert.deepEqual(
    mattData.reviews.map((review) => review._id).sort(),
    mattReviews.map((review) => String(review._id)).sort(),
  );
  assert.deepEqual(
    rileyData.reviews.map((review) => review._id).sort(),
    rileyReviews.map((review) => String(review._id)).sort(),
  );
  assert(mattData.reviews.some((review) => review.employeeName === "Jordan Demo"));
  assert(rileyData.reviews.some((review) => review.employeeName === "Jamie Demo"));
  for (const review of [...mattData.reviews, ...rileyData.reviews]) {
    assert.equal(typeof review.employeeName, "string");
    assert.equal(typeof review.formName, "string");
    assert(["Assigned", "In progress", "Completed"].includes(review.status));
    assert.equal(typeof review._id, "string");
    assert.equal(review.passwordHash, undefined);
  }
});

test("US-04: manager with no assignments gets an empty list, not an error", async () => {
  const empty = await managerSession("empty.manager@example.test");
  assert.deepEqual((await empty.request("GET", "/manager/reviews")).reviews, []);
});

test("US-04: employee and HR cannot read manager assignment lists", async () => {
  for (const email of ["hr@example.test", "jordan.employee@example.test"]) {
    const client = new Session(fx);
    await client.login(email);
    await client.request("GET", "/manager/reviews", undefined, 403);
  }
  const visitor = new Session(fx);
  await visitor.request("GET", "/manager/reviews", undefined, 401);
});

test("US-04: another manager cannot open a review from someone else's list", async () => {
  const riley = await managerSession("riley.manager@example.test");
  await riley.request("GET", `/reviews/${fx.review._id}`, undefined, 403);
});

test("US-04: a review-list read failure returns an error; a retry can succeed", async () => {
  const manager = await managerSession("matt.manager@example.test");
  const originalFind = Review.find;
  try {
    Review.find = () => {
      throw new Error("Simulated database outage");
    };
    const response = await manager.request("GET", "/manager/reviews", undefined, 503);
    assert.match(response.message, /failed|try again/i);
    assert.equal(response.reviews, undefined);
  } finally {
    Review.find = originalFind;
  }
  const retry = await manager.request("GET", "/manager/reviews");
  assert(retry.reviews.some((review) => review.employeeName === "Jordan Demo"));
});

test("NFR-03: at least 19 of 20 loads of a 50-review list finish within two seconds", async () => {
  const manager = await managerSession("matt.manager@example.test");
  const createdUsers = await User.insertMany(
    Array.from({ length: 49 }, (_, i) => ({
      email: `govinda-performance-${i}@example.test`,
      name: `Demo Performance Employee ${i + 1}`,
      role: "employee",
      passwordHash: "unused-fixture-only",
      active: true,
    })),
  );
  const createdIds = createdUsers.map((user) => user._id);
  try {
    await Review.insertMany(
      createdUsers.map((employee) => ({
        employee: employee._id,
        manager: fx.users["matt.manager@example.test"]._id,
        form: fx.form._id,
        status: "Assigned",
      })),
    );
    const results = [];
    for (let i = 0; i < 20; i++) {
      const started = performance.now();
      const data = await manager.request("GET", "/manager/reviews");
      results.push(performance.now() - started);
      assert.equal(data.reviews.length, 50);
    }
    assert(
      results.filter((duration) => duration < 2000).length >= 19,
      `Only ${results.filter((duration) => duration < 2000).length}/20 requests below 2000ms: ${results.map((v) => Math.round(v)).join(", ")}ms`,
    );
  } finally {
    await Review.deleteMany({ employee: { $in: createdIds } });
    await User.deleteMany({ _id: { $in: createdIds } });
  }
});
