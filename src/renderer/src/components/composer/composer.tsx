import { useEffect, useState, type KeyboardEvent } from "react";
import type {
  Defaults,
  RunInfo,
  ThreadSummary,
} from "../../../../shared/types";
import { shortPath } from "../../lib/format";
import { useDefaults } from "./use-defaults";
import { useRuns } from "./use-runs";

type ComposerProps =
  | { mode: "new"; onThreadCreated: (threadId: string) => void }
  | { mode: "resume"; thread: ThreadSummary };

/** 用户手动改过的设置；没改的项跟随默认值 */
interface Overrides {
  cwd?: string;
  model?: string;
  effort?: string;
  fast?: boolean;
}

/** 底部输入框：新建 codex exec 任务，或在当前对话里继续追问 */
export function Composer(props: ComposerProps) {
  const defaults = useDefaults();
  const runs = useRuns();
  const [prompt, setPrompt] = useState("");
  const [overrides, setOverrides] = useState<Overrides>({});
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const threadId = props.mode === "resume" ? props.thread.id : null;
  const settings = resolveSettings(
    defaults,
    props.mode === "resume" ? props.thread : null,
    overrides,
  );
  const pendingRun = runs.find((run) => run.runId === pendingRunId) ?? null;
  // 当前对话里由本应用启动、还在跑的进程，用来显示「停止」
  const activeRun =
    runs.find(
      (run) => run.running && threadId !== null && run.threadId === threadId,
    ) ?? (pendingRun?.running ? pendingRun : null);
  const onThreadCreated = props.mode === "new" ? props.onThreadCreated : null;

  // 新任务拿到对话 id 后跳到这条对话
  const createdThreadId = pendingRun?.threadId ?? null;
  useEffect(() => {
    if (onThreadCreated && createdThreadId) {
      onThreadCreated(createdThreadId);
    }
  }, [createdThreadId, onThreadCreated]);
  // 发送接口报错，或进程没跑起来就退出了，都把原因显示出来
  const shownError =
    error ?? (pendingRun && !pendingRun.running ? pendingRun.error : null);

  const model =
    defaults?.models.find((option) => option.slug === settings.model) ?? null;
  // 别的 agent 启动的进程还在跑这条对话时，不能同时追问，否则两个进程会写同一个对话
  const busyElsewhere =
    props.mode === "resume" && props.thread.status === "running" && !activeRun;
  const canSend =
    prompt.trim().length > 0 &&
    settings.cwd &&
    settings.model &&
    settings.effort &&
    !activeRun &&
    !busyElsewhere;

  /** 发出任务：新对话走 startTask，已有对话走 resumeTask */
  async function send() {
    if (!canSend) {
      return;
    }
    setError(null);
    const options = {
      prompt: prompt.trim(),
      cwd: settings.cwd!,
      model: settings.model!,
      effort: settings.effort!,
      fast: settings.fast,
    };
    try {
      const run: RunInfo = threadId
        ? await window.agentBox.resumeTask({ ...options, threadId })
        : await window.agentBox.startTask(options);
      setPendingRunId(run.runId);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // Cmd/Ctrl + Enter 发送，普通回车换行
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void send();
    }
  }

  async function pickDirectory() {
    const path = await window.agentBox.pickDirectory();
    if (path) {
      setOverrides((prev) => ({ ...prev, cwd: path }));
    }
  }

  return (
    <div className="shrink-0 border-t border-border bg-background px-6 py-4">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 rounded-xl border border-input bg-card p-3 focus-within:border-primary">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={onKeyDown}
          rows={props.mode === "new" ? 6 : 3}
          placeholder={
            props.mode === "new"
              ? "给 Codex 的任务描述…"
              : "在这条对话里继续追问…"
          }
          className="resize-none bg-transparent text-[14px] leading-6 outline-none placeholder:text-muted-foreground"
        />
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          {props.mode === "new" ? (
            <span className="flex items-center gap-1">
              <select
                value={settings.cwd ?? ""}
                onChange={(event) =>
                  setOverrides((prev) => ({ ...prev, cwd: event.target.value }))
                }
                title={settings.cwd ?? ""}
                className="max-w-64 rounded-md border border-input bg-muted px-2 py-1 outline-none"
              >
                {settings.cwd &&
                  !defaults?.recentCwds.includes(settings.cwd) && (
                    <option value={settings.cwd}>
                      {shortPath(settings.cwd)}
                    </option>
                  )}
                {defaults?.recentCwds.map((path) => (
                  <option key={path} value={path}>
                    {shortPath(path)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void pickDirectory()}
                className="rounded-md border border-input px-2 py-1 text-subtle-foreground hover:bg-muted"
              >
                选择目录
              </button>
            </span>
          ) : (
            <span
              className="truncate text-muted-foreground"
              title={props.thread.cwd}
            >
              {shortPath(props.thread.cwd)}
            </span>
          )}

          <select
            value={settings.model ?? ""}
            onChange={(event) =>
              setOverrides((prev) => ({
                ...prev,
                model: event.target.value,
                effort: undefined,
              }))
            }
            className="rounded-md border border-input bg-muted px-2 py-1 outline-none"
          >
            {settings.model && !model && (
              <option value={settings.model}>{settings.model}</option>
            )}
            {defaults?.models.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.displayName}
              </option>
            ))}
          </select>
          <select
            value={settings.effort ?? ""}
            onChange={(event) =>
              setOverrides((prev) => ({ ...prev, effort: event.target.value }))
            }
            className="rounded-md border border-input bg-muted px-2 py-1 outline-none"
          >
            {(model?.efforts ?? (settings.effort ? [settings.effort] : [])).map(
              (effort) => (
                <option key={effort} value={effort}>
                  {effort}
                </option>
              ),
            )}
          </select>
          {(model?.supportsFast ?? true) && (
            <label className="flex cursor-pointer items-center gap-1 text-subtle-foreground">
              <input
                type="checkbox"
                checked={settings.fast}
                onChange={(event) =>
                  setOverrides((prev) => ({
                    ...prev,
                    fast: event.target.checked,
                  }))
                }
              />
              Fast
            </label>
          )}

          <span className="ml-auto flex items-center gap-2">
            {busyElsewhere && (
              <span className="text-warning">对话正在由其他进程执行</span>
            )}
            {shownError && (
              <span
                className="max-w-80 truncate text-danger"
                title={shownError}
              >
                {shownError}
              </span>
            )}
            {activeRun ? (
              <button
                type="button"
                onClick={() => void window.agentBox.stopRun(activeRun.runId)}
                className="rounded-md border border-danger px-3 py-1 font-medium text-danger hover:bg-muted"
              >
                停止
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void send()}
                disabled={!canSend}
                className="rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {props.mode === "new" ? "发送" : "追问"} ⌘↵
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

/** 合成当前表单设置：手动修改 > 对话原设置 > config.toml 默认 > 模型列表第一项 */
function resolveSettings(
  defaults: Defaults | null,
  thread: ThreadSummary | null,
  overrides: Overrides,
) {
  const model =
    overrides.model ??
    thread?.model ??
    defaults?.model ??
    defaults?.models[0]?.slug ??
    null;
  const option = defaults?.models.find((item) => item.slug === model) ?? null;
  const fallbackEffort =
    model === defaults?.model ? defaults?.effort : option?.defaultEffort;
  const effort =
    overrides.effort ??
    (overrides.model
      ? (option?.defaultEffort ?? null)
      : (thread?.reasoningEffort ?? fallbackEffort ?? null));
  return {
    cwd: overrides.cwd ?? thread?.cwd ?? defaults?.recentCwds[0] ?? null,
    model,
    effort,
    fast: overrides.fast ?? defaults?.fast ?? false,
  };
}
