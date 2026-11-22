import assert from "node:assert/strict";
import { test } from "node:test";
import {
  databaseSettings,
  LOCAL_DATABASE_URI,
  safeDatabaseError,
} from "../src/databaseSettings.js";

test("database mode keeps the original local default and honors isolated launcher ports", () => {
  assert.equal(databaseSettings({}).mode, "local");
  assert.equal(
    databaseSettings({ MONGO_URI: LOCAL_DATABASE_URI }, 29001).uri,
    "mongodb://127.0.0.1:29001/reviewflow?replicaSet=reviewflow",
  );
});

test("Atlas selects shared mode and requires the dedicated team database", () => {
  const uri =
    "mongodb+srv://demo:fake-test-password@cluster.example.test/reviewflow_team?retryWrites=true&w=majority";
  assert.deepEqual(databaseSettings({ MONGO_URI: uri }), { mode: "shared", uri });
  assert.throws(
    () => databaseSettings({ MONGO_URI: uri, REVIEWFLOW_DATABASE_MODE: "local" }),
    /MODE=shared/,
  );
  for (const invalid of [
    uri.replace("/reviewflow_team", "/admin"),
    uri.replace("/reviewflow_team", "/"),
  ]) {
    assert.throws(() => databaseSettings({ MONGO_URI: invalid }), /must name \/reviewflow_team/);
  }
  assert.throws(() => databaseSettings({ REVIEWFLOW_DATABASE_MODE: "shared" }), /needs MONGO_URI/);
  assert.throws(
    () => databaseSettings({ REVIEWFLOW_DATABASE_MODE: "typo" }),
    /must be local or shared/,
  );
});

test("connection errors hide raw URIs, encoded passwords, and decoded passwords", () => {
  const password = "fake-test-password!";
  const encoded = "fake-test-password%21";
  const uri = `mongodb+srv://demo:${encoded}@cluster.example.test/reviewflow_team`;
  const result = safeDatabaseError(
    new Error(`Failed ${uri}; password ${password}; encoded ${encoded}`),
    uri,
  );
  for (const secret of [uri, password, encoded]) assert.equal(result.includes(secret), false);
  assert.match(result, /hidden/);
  const invalid = databaseSettings.bind(null, {
    REVIEWFLOW_DATABASE_MODE: "shared",
    MONGO_URI: "not a URI",
  });
  assert.throws(invalid, /not a valid MongoDB connection string/);
});
