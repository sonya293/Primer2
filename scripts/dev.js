// Запускает сразу сервер API и Vite: npm run dev:all
import { spawn } from "node:child_process";

const run = (cmd, args) => spawn(cmd, args, { stdio: "inherit", shell: true });
const procs = [run("node", ["server/index.js"]), run("npm", ["run", "dev"])];

const stop = () => procs.forEach((p) => p.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
procs.forEach((p) => p.on("exit", stop));
