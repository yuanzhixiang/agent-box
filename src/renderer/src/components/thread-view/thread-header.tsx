import { useState } from "react";
import type { ThreadSummary, TokenUsage } from "../../../../shared/types";
import { formatTokens } from "../../lib/format";
import { Icon } from "../shared/icon";

export function ThreadHeader({
  thread,
  title,
  tokens,
}: {
  thread: ThreadSummary;
  title: string;
  tokens: TokenUsage | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <header className="flex min-h-10 shrink-0 items-center gap-3 px-6 text-[12px] [@media(max-width:1050px)]:px-4 [&_h2]:min-w-0 [&_h2]:truncate [&_h2]:text-[13px] [&_h2]:font-normal [-webkit-app-region:drag]">
      <h2 title={title}>{title}</h2>
      <span
        className="whitespace-nowrap text-subtle-foreground [@media(max-width:1050px)]:hidden"
        title={thread.cwd}
      >
        {thread.cwd.split("/").filter(Boolean).at(-1)}
      </span>
      <button
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-[2px] border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground [-webkit-app-region:no-drag]"
        aria-label="Copy session ID"
        title={copied ? "Copied" : "Copy session ID"}
        onClick={() => {
          void navigator.clipboard
            .writeText(thread.id)
            .then(() => setCopied(true));
        }}
      >
        <Icon name="more" />
      </button>
      <div className="relative ml-auto shrink-0 [&>button]:flex [&>button]:items-center [&>button]:gap-2 [&>button]:text-[12px] [&>button]:text-muted-foreground [-webkit-app-region:no-drag]">
        <button onClick={() => setOpen(!open)} aria-expanded={open}>
          Access Options <Icon name="chevron" size={12} />
        </button>
        {open && (
          <div className="absolute top-7 right-0 z-10 w-[300px] rounded border border-input bg-white p-4 shadow-[0_8px_12px_#00000014] [overflow-wrap:anywhere] [&_p]:mt-2 [&_p]:text-subtle-foreground">
            <strong>Local workspace</strong>
            <p>{thread.cwd}</p>
            <p>
              {thread.model} · {thread.reasoningEffort}
            </p>
            <p>
              {thread.status === "running" ? "Running" : "Idle"}
              {tokens ? ` · ${formatTokens(tokens.total)} tokens` : ""}
            </p>
            <p>执行权限由本地 Codex 配置控制。</p>
          </div>
        )}
      </div>
    </header>
  );
}
