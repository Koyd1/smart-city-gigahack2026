#!/usr/bin/env node

const path = require("path");
const { spawn } = require("child_process");
const { loadEnvConfig } = require("@next/env");

const frontendDir = path.resolve(__dirname, "..");
const repoRootDir = path.resolve(frontendDir, "..");

loadEnvConfig(repoRootDir);

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/run-with-root-env.cjs <command> [args...]");
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: "inherit",
  env: process.env,
  shell: true
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
