import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function runCodexResume({ sessionId, cwd, prompt }) {
  return new Promise((resolve) => {
    const outputDir = join(tmpdir(), "feishu-codex-bridge");
    mkdirSync(outputDir, { recursive: true });
    const outputPath = join(outputDir, `codex-${Date.now()}.txt`);
    const codexBin = process.env.CODEX_BRIDGE_CODEX_BIN || "codex";
    const args = [
      "exec",
      "resume",
      "--skip-git-repo-check",
      "-o",
      outputPath,
      sessionId,
      "-"
    ];

    const child = spawn(codexBin, args, {
      cwd: cwd || process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      resolve({
        ok: false,
        code: -1,
        stdout,
        stderr: `${stderr}\n${error.message}`.trim(),
        finalMessage: ""
      });
    });
    child.on("close", (code) => {
      const finalMessage = existsSync(outputPath)
        ? readFileSync(outputPath, "utf8").trim()
        : "";
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr,
        finalMessage
      });
    });

    child.stdin.end(prompt);
  });
}
