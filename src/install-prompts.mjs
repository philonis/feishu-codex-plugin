#!/usr/bin/env node

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { homedir } from "node:os";
import { PROJECT_ROOT } from "./env.mjs";

const codexHome = process.env.CODEX_HOME || resolve(homedir(), ".codex");
const sourceDir = resolve(PROJECT_ROOT, "prompts");
const targetDir = resolve(codexHome, "prompts");

mkdirSync(targetDir, { recursive: true });

let count = 0;
for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".md")) {
    continue;
  }

  const sourcePath = resolve(sourceDir, entry.name);
  const targetPath = resolve(targetDir, entry.name);
  const body = readFileSync(sourcePath, "utf8")
    .replaceAll("__PLUGIN_DIR__", PROJECT_ROOT);
  writeFileSync(targetPath, body);
  count += 1;
  console.log(`installed /prompts:${basename(entry.name, ".md")}`);
}

console.log(`installed ${count} prompt(s) into ${targetDir}`);
