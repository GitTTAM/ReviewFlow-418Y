import assert from "node:assert/strict";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ROOT } from "../src/config.js";
import { createApp } from "../src/app.js";
import { entities, Review, User } from "../src/models/index.js";
import { seedDemoData, DEMO_PASSWORD } from "../src/demoData.js";
import { migrate } from "../migrations/001-reviewflow.js";

export async function startFixture() {
  const db = await MongoMemoryReplSet.create({
    binary: { version: "7.0.24", downloadDir: path.join(ROOT, ".local", "mongo-binaries") },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(db.getUri(), { autoIndex: false });
  await migrate();
  const fixture = { db, now: Date.now(), failAfterAnswer: false, failBeforeCommit: false };
  fixture.start = async () => {
    fixture.server = createApp({
      secret: "isolated-test-session-secret",
      now: () => fixture.now,
      workflowHooks: {
        afterAnswerWrite: async () => {
          if (fixture.failAfterAnswer) throw new Error("injected answer write failure");
        },
        beforeCommit: async () => {
          if (fixture.failBeforeCommit) throw new Error("injected final metadata failure");
        },
      },
    }).listen(0, "127.0.0.1");
    await new Promise((resolve) => fixture.server.once("listening", resolve));
    fixture.url = `http://127.0.0.1:${fixture.server.address().port}/api`;
  };
  fixture.closeServer = async () => {
    fixture.server.closeAllConnections();
    await new Promise((resolve) => fixture.server.close(resolve));
  };
  fixture.reset = async () => {
    fixture.failAfterAnswer = false;
    fixture.failBeforeCommit = false;
    fixture.now = Date.now();
    for (const entity of entities) await entity.deleteMany({});
    await mongoose.connection.db.collection("sessions").deleteMany({});
    Object.assign(fixture, await seedDemoData());
  };
  fixture.stop = async () => {
    await fixture.closeServer();
    await mongoose.disconnect();
    await db.stop();
  };
  await fixture.start();
  await fixture.reset();
  return fixture;
}

export class Session {
  constructor(fixture) {
    this.fixture = fixture;
    this.cookie = "";
    this.csrf = "";
  }
  async request(method, route, body, expected = 200, extra = {}) {
    this.last = await fetch(this.fixture.url + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: this.cookie,
        "X-CSRF-Token": this.csrf,
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookie = this.last.headers.get("set-cookie");
    if (cookie) this.cookie = cookie.split(";")[0];
    const data = await this.last.json();
    assert.equal(this.last.status, expected, `${method} ${route}: ${JSON.stringify(data)}`);
    if (data.csrfToken) this.csrf = data.csrfToken;
    return data;
  }
  async login(email = "matt.manager@example.test", password = DEMO_PASSWORD) {
    await this.request("GET", "/auth/session");
    return this.request("POST", "/auth/login", { email, password });
  }
}
export function payload(fixture, action = "draft", overrides = {}) {
  return {
    action,
    version: fixture.review.version,
    discussionConfirmed: action === "complete",
    answers: Object.fromEntries(
      fixture.questions.map((q) => [
        String(q._id),
        q.kind === "dropdown" ? "Meets expectations" : `Saved feedback ${q.position}`,
      ]),
    ),
    ...overrides,
  };
}
export async function snapshot(fixture) {
  const review = await Review.findById(fixture.review._id).lean();
  const { ReviewAnswer } = await import("../src/models/index.js");
  const answers = await ReviewAnswer.find({ review: review._id }).sort({ question: 1 }).lean();
  return JSON.stringify({ review, answers });
}
