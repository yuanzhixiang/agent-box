import { useState } from "react";
import type { TimelineItem } from "../../../../shared/types";
import { formatClock, formatDuration } from "../../lib/format";
import { MarkdownText } from "../shared/markdown";

// 任务描述超过这么多行时默认折叠
const COLLAPSE_LINES = 14;

/** 消息类条目：任务、回复、推理摘要、回合分隔线 */
export function MessageItem({ item }: { item: TimelineItem }) {
  switch (item.kind) {
    case "user":
      return <UserMessage text={item.text} at={item.at} images={item.images} />;
    case "agent":
      return item.phase === "commentary" ? (
        <div className="text-[13px] text-subtle-foreground">
          <MarkdownText text={item.text} />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-card-foreground">
          <p className="mb-2 text-[11px] text-muted-foreground">
            Codex 回复 · {formatClock(item.at)}
          </p>
          <MarkdownText text={item.text} />
        </div>
      );
    case "reasoning":
      return (
        <p className="border-l-2 border-reasoning pl-3 text-[12px] whitespace-pre-wrap text-muted-foreground italic">
          {item.text}
        </p>
      );
    case "turn_start":
      return (
        <Divider
          label={`回合开始 · ${formatClock(item.at)}${item.model ? ` · ${item.model}` : ""}${item.effort ? ` · ${item.effort}` : ""}`}
        />
      );
    case "turn_end":
      return (
        <Divider
          label={`${item.aborted ? "回合中断" : "回合结束"} · ${formatClock(item.at)}${
            item.durationMs !== null
              ? ` · 用时 ${formatDuration(item.durationMs)}`
              : ""
          }`}
          tone={item.aborted ? "danger" : "muted"}
        />
      );
    case "compaction":
      return <Divider label={`上下文已压缩 · ${formatClock(item.at)}`} />;
    default:
      return null;
  }
}

/** 发给 Codex 的任务描述，超长时可展开 */
function UserMessage({
  text,
  at,
  images,
}: {
  text: string;
  at: number;
  images: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const long = text.split("\n").length > COLLAPSE_LINES || text.length > 1500;
  return (
    <div className="rounded-xl border border-primary/40 bg-muted px-4 py-3">
      <p className="mb-2 text-[11px] text-muted-foreground">
        任务 · {formatClock(at)}
      </p>
      <div
        className={`text-[13px] leading-6 whitespace-pre-wrap select-text ${
          long && !expanded
            ? "max-h-80 overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]"
            : ""
        }`}
      >
        {text}
      </div>
      {images.length > 0 && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          附图：{images.join("，")}
        </p>
      )}
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-[12px] text-primary hover:text-primary-hover"
        >
          {expanded ? "收起" : "展开全文"}
        </button>
      )}
    </div>
  );
}

function Divider({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "muted" | "danger";
}) {
  return (
    <div
      className={`flex items-center gap-3 text-[11px] ${tone === "danger" ? "text-danger" : "text-muted-foreground"}`}
    >
      <span className="h-px flex-1 bg-border" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
