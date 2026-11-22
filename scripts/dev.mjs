import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["--watch", "server/src/server.js"], { stdio: "inherit" }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js", "client", "--host", "127.0.0.1"], {
    stdio: "inherit",
  }),
];
function stop() {
  for (const child of children) child.kill();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);
for (const child of children) child.on("exit", stop);
