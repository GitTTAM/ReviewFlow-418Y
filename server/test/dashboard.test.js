// Govinda: extend with list/empty/error/retry and timing acceptance tests.
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { Review } from "../src/models/index.js";
import { assignedReviewFilter } from "../src/permissions.js";
import { startFixture } from "./helpers.js";
let fx;
before(async () => {
  fx = await startFixture();
});
after(async () => {
  if (fx) await fx.stop();
});
test("Govinda boundary: assigned query includes own assignments only; empty fixture exists", async () => {
  assert(
    await Review.exists({
      ...assignedReviewFilter(fx.users["matt.manager@example.test"]),
      _id: fx.review._id,
    }),
  );
  assert(
    !(await Review.exists({
      ...assignedReviewFilter(fx.users["riley.manager@example.test"]),
      _id: fx.review._id,
    })),
  );
  assert.equal(
    await Review.countDocuments(assignedReviewFilter(fx.users["empty.manager@example.test"])),
    0,
  );
});
