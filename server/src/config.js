import "dotenv/config";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const WORKSPACE_ID = createHash("sha256")
  .update(ROOT.toLowerCase())
  .digest("hex")
  .slice(0, 16);
export const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:28018/reviewflow?replicaSet=reviewflow";
export const PORT = Number(process.env.PORT || 5050);
export function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const directory = path.join(ROOT, ".local");
  mkdirSync(directory, { recursive: true });
  const file = path.join(directory, "session-secret");
  if (!existsSync(file)) writeFileSync(file, randomBytes(48).toString("hex"), { mode: 0o600 });
  return readFileSync(file, "utf8").trim();
}
