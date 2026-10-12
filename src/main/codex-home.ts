import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Codex 数据目录，和 codex CLI 一样优先尊重 CODEX_HOME */
export const codexHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");

export const stateDbPath = join(codexHome, "state_5.sqlite");
export const configPath = join(codexHome, "config.toml");
export const modelsCachePath = join(codexHome, "models_cache.json");

// 从 Finder 启动的 app 拿不到 shell 的 PATH，按常见安装位置补齐
const EXTRA_PATH_DIRS = [
  join(homedir(), ".local/bin"),
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
];

/** 给 codex 子进程用的 PATH：原 PATH 加上常见安装目录 */
export function childPath(): string {
  const current = (process.env.PATH ?? "").split(":").filter(Boolean);
  return [...new Set([...current, ...EXTRA_PATH_DIRS])].join(":");
}

/** 找到 codex 可执行文件，找不到就交给 PATH 解析 */
export function resolveCodexBinary(): string {
  for (const dir of EXTRA_PATH_DIRS) {
    const candidate = join(dir, "codex");
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return "codex";
}
