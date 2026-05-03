#!/usr/bin/env node

import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
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

  copyFileSync(resolve(sourceDir, entry.name), resolve(targetDir, entry.name));
  count += 1;
  console.log(`installed /prompts:${basename(entry.name, ".md")}`);
}

console.log(`installed ${count} prompt(s) into ${targetDir}`);
