import { useState } from "react";
import type { ThreadSummary, TokenUsage } from "../../../../shared/types";
import { formatRelativeTime, formatTokens } from "../../lib/format";

interface ThreadHeaderProps {
  thread: ThreadSummary;
  title: string;
  tokens: TokenUsage | null;
}

/** 对话顶栏：标题、目录、模型、运行状态、token 与上下文占用 */
export function ThreadHeader({ thread, title, tokens }: ThreadHeaderProps) {
  const [copied, setCopied] = useState(false);
  const contextPercent =
    tokens?.contextWindow && tokens.lastInput
      ? Math.round((tokens.lastInput / tokens.contextWindow) * 100)
      : null;

  // 复制对话 id，方便在终端里 codex exec resume
  function copyId() {
    void navigator.clipboard.writeText(thread.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <header className="drag-region shrink-0 border-b border-border px-6 pt-8 pb-3">
      <div className="flex items-center gap-3">
        <h2 className="min-w-0 truncate text-[15px] font-semibold">{title}</h2>
        {thread.status === "running" ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            运行中
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            空闲
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
        <span className="no-drag select-text" title="工作目录">
          {thread.cwd}
        </span>
        {thread.model && (
          <span>
            {thread.model}
            {thread.reasoningEffort ? ` · ${thread.reasoningEffort}` : ""}
          </span>
        )}
        {tokens && <span>{formatTokens(tokens.total)} tokens</span>}
        {contextPercent !== null && <span>上下文 {contextPercent}%</span>}
        <span>更新于 {formatRelativeTime(thread.updatedAt)}</span>
        <button
          type="button"
          onClick={copyId}
          className="no-drag font-mono hover:text-foreground"
          title="复制对话 id"
        >
          {copied ? "已复制" : thread.id.slice(0, 8)}
        </button>
      </div>
    </header>
  );
}
