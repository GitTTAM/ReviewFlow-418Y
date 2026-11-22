import mongoose from "mongoose";

export const LOCAL_DATABASE_URI = "mongodb://127.0.0.1:28018/reviewflow?replicaSet=reviewflow";

// Return connection details to callers, never to logs, health checks, or state.json.
export function databaseSettings(env = process.env, databasePort = 28018) {
  const configured = env.MONGO_URI?.trim() || "";
  const mode =
    env.REVIEWFLOW_DATABASE_MODE?.trim() ||
    (!configured || configured === LOCAL_DATABASE_URI ? "local" : "shared");
  if (!["local", "shared"].includes(mode)) {
    throw new Error("REVIEWFLOW_DATABASE_MODE must be local or shared.");
  }
  if (mode === "local") {
    if (configured && configured !== LOCAL_DATABASE_URI) {
      throw new Error("For an Atlas connection, set REVIEWFLOW_DATABASE_MODE=shared.");
    }
    return {
      mode,
      uri: `mongodb://127.0.0.1:${databasePort}/reviewflow?replicaSet=reviewflow`,
    };
  }
  if (!configured) throw new Error("Shared database mode needs MONGO_URI in your private .env.");
  let client;
  try {
    client = new mongoose.mongo.MongoClient(configured);
  } catch {
    throw new Error("MONGO_URI is not a valid MongoDB connection string. Check your private .env.");
  }
  if (client.options.dbName !== "reviewflow_team") {
    throw new Error(
      "The shared connection string must name /reviewflow_team before its ? options.",
    );
  }
  return { mode, uri: configured };
}

// Connection failures sometimes repeat a URI. Do not expose its password in logs.
export function safeDatabaseError(error, uri = process.env.MONGO_URI) {
  let message = error?.message || String(error);
  if (uri) {
    message = message.replaceAll(uri, "[database address hidden]");
    const credentials = uri.match(/^mongodb(?:\+srv)?:\/\/([^@]+)@/i)?.[1];
    if (credentials?.includes(":")) {
      const password = credentials.slice(credentials.indexOf(":") + 1);
      for (const value of [password, decodePassword(password)]) {
        if (value) message = message.replaceAll(value, "[password hidden]");
      }
    }
  }
  return message.replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, "[database address hidden]");
}

function decodePassword(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
