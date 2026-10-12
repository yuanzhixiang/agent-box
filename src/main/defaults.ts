import { readFileSync } from "node:fs";
import { configPath, modelsCachePath } from "./codex-home";
import { recentCwds } from "./thread-store";
import type { Defaults, ModelOption } from "../shared/types";

// 发任务时可选的最近目录数量
const RECENT_CWD_LIMIT = 15;

/** 读 config.toml 顶层（第一个 [table] 之前）的简单 key = "value" */
function readTopLevelConfig(): Record<string, string> {
  let text = "";
  try {
    text = readFileSync(configPath, "utf8");
  } catch {
    return {};
  }
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    if (line.trim().startsWith("[")) {
      break;
    }
    const match = /^\s*([\w.-]+)\s*=\s*"([^"]*)"/.exec(line);
    if (match) {
      result[match[1]] = match[2];
    }
  }
  return result;
}

/** 从 Codex 缓存的模型目录里取用户可见的模型，按 Codex 自己的优先级排序 */
function readModels(): ModelOption[] {
  try {
    const data = JSON.parse(readFileSync(modelsCachePath, "utf8")) as {
      models?: Array<Record<string, unknown>>;
    };
    return (data.models ?? [])
      .filter((model) => model.visibility === "list")
      .sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0))
      .map((model) => ({
        slug: String(model.slug),
        displayName: String(model.display_name ?? model.slug),
        efforts: (
          (model.supported_reasoning_levels ?? []) as Array<{ effort: string }>
        ).map((level) => level.effort),
        defaultEffort: (model.default_reasoning_level as string) ?? null,
        supportsFast: (
          (model.service_tiers ?? []) as Array<{ id: string }>
        ).some((tier) => tier.id === "priority"),
      }));
  } catch {
    return [];
  }
}

/** 发任务表单的默认值：沿用用户 config.toml 的模型、档位和 fast 设置 */
export function readDefaults(): Defaults {
  const config = readTopLevelConfig();
  return {
    model: config.model ?? null,
    effort: config.model_reasoning_effort ?? null,
    fast: config.service_tier === "priority",
    models: readModels(),
    recentCwds: recentCwds(RECENT_CWD_LIMIT),
  };
}
