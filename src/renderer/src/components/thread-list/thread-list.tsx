import { useEffect, useMemo, useState } from "react";
import type { ThreadSummary } from "../../../../shared/types";
import { formatRelativeTime, formatTokens, shortPath } from "../../lib/format";

interface ThreadListProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

// 搜索输入停顿这么久再查库，避免每个字符都发一次请求
const SEARCH_DEBOUNCE_MS = 200;

/** 左侧栏：codex exec 对话列表，支持关键词搜索和按项目筛选，数据库有变化时自动刷新 */
export function ThreadList({ selectedId, onSelect }: ThreadListProps) {
  const [query, setQuery] = useState("");
  const [cwd, setCwd] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 关键词变化后防抖查询，主进程通知有变化时按当前关键词重查
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      window.agentBox
        .listThreads({ query, cwd: null })
        .then((rows) => {
          if (!cancelled) {
            setThreads(rows);
            setError(null);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
          }
        });
    };
    const timer = setTimeout(load, SEARCH_DEBOUNCE_MS);
    const off = window.agentBox.onThreadsChanged(load);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      off();
    };
  }, [query]);

  // 项目下拉的选项从当前结果里取，按出现次数排序
  const cwdOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const thread of threads ?? []) {
      counts.set(thread.cwd, (counts.get(thread.cwd) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([path]) => path);
  }, [threads]);

  const visible = useMemo(
    () => (threads ?? []).filter((thread) => !cwd || thread.cwd === cwd),
    [threads, cwd],
  );
  const runningCount = visible.filter(
    (thread) => thread.status === "running",
  ).length;

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="drag-region h-10 shrink-0" />
      <div className="flex flex-col gap-2 px-3 pb-3">
        <div className="flex items-center justify-between px-1">
          <h1 className="text-[15px] font-semibold">Agent Box</h1>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="no-drag rounded-md bg-primary px-3 py-1 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover"
          >
            新任务
          </button>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索任务内容"
          className="rounded-md border border-input bg-muted px-3 py-1.5 text-[13px] outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <select
          value={cwd ?? ""}
          onChange={(event) => setCwd(event.target.value || null)}
          className="rounded-md border border-input bg-muted px-2 py-1.5 text-[13px] outline-none focus:border-primary"
        >
          <option value="">全部项目</option>
          {cwdOptions.map((path) => (
            <option key={path} value={path}>
              {shortPath(path)}
            </option>
          ))}
        </select>
        <p className="px-1 text-xs text-muted-foreground">
          {threads === null ? "加载中…" : `${visible.length} 条对话`}
          {runningCount > 0 ? ` · ${runningCount} 条运行中` : ""}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {error && <p className="px-2 text-xs text-danger">读取失败：{error}</p>}
        {threads !== null && visible.length === 0 && !error && (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            {query || cwd ? "没有匹配的对话" : "还没有 codex exec 对话"}
          </p>
        )}
        <ul className="flex flex-col gap-0.5">
          {visible.map((thread) => (
            <li key={thread.id}>
              <ThreadRow
                thread={thread}
                selected={thread.id === selectedId}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

interface ThreadRowProps {
  thread: ThreadSummary;
  selected: boolean;
  onSelect: (id: string) => void;
}

/** 列表里的一行：标题、项目、时间、运行状态 */
function ThreadRow({ thread, selected, onSelect }: ThreadRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(thread.id)}
      className={`flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left transition-colors ${
        selected ? "bg-accent" : "hover:bg-muted"
      }`}
    >
      <span className="flex items-center gap-2">
        {thread.status === "running" && (
          <span
            className="size-2 shrink-0 animate-pulse rounded-full bg-success"
            aria-label="运行中"
          />
        )}
        <span className="truncate text-[13px]">{thread.title || "新对话"}</span>
      </span>
      <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="truncate" title={thread.cwd}>
          {shortPath(thread.cwd)}
        </span>
        <span className="ml-auto shrink-0">
          {formatRelativeTime(thread.updatedAt)}
        </span>
        {thread.tokensUsed > 0 && (
          <span className="shrink-0">{formatTokens(thread.tokensUsed)}</span>
        )}
      </span>
    </button>
  );
}
