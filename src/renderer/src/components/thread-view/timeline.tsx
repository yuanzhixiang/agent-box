import { useLayoutEffect, useMemo, useRef } from "react";
import type { TimelineItem } from "../../../../shared/types";
import { ActivityGroup } from "./activity-group";
import { MessageItem } from "./message-item";

interface TimelineProps {
  items: TimelineItem[];
  running: boolean;
}

/** 时间线分段：消息单独成块，连续的命令/工具调用合并成一组 */
type Block =
  | { type: "message"; item: TimelineItem }
  | { type: "activity"; key: string; items: TimelineItem[] };

const ACTIVITY_KINDS = new Set<TimelineItem["kind"]>([
  "command",
  "file_change",
  "mcp",
  "image",
  "other",
]);
// 距离底部小于这个值就认为用户在看最新内容，新内容到来时自动滚到底
const STICK_THRESHOLD_PX = 120;

/** 把条目切成消息块和活动组 */
function toBlocks(items: TimelineItem[]): Block[] {
  const blocks: Block[] = [];
  for (const item of items) {
    const last = blocks.at(-1);
    if (ACTIVITY_KINDS.has(item.kind)) {
      if (last?.type === "activity") {
        last.items.push(item);
      } else {
        blocks.push({ type: "activity", key: item.id, items: [item] });
      }
    } else {
      blocks.push({ type: "message", item });
    }
  }
  return blocks;
}

/** 对话时间线；停在底部时跟随新内容滚动，用户往上翻时不打扰 */
export function Timeline({ items, running }: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const blocks = useMemo(() => toBlocks(items), [items]);

  // 内容变化后，如果之前停在底部就继续贴底
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [blocks]);

  function onScroll() {
    const el = scrollRef.current;
    if (el) {
      stickRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
    }
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="min-h-0 flex-1 overflow-y-auto px-6 py-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        {blocks.length === 0 && (
          <p className="text-center text-[13px] text-muted-foreground">
            这条对话还没有内容
          </p>
        )}
        {blocks.map((block, index) =>
          block.type === "message" ? (
            <MessageItem key={block.item.id} item={block.item} />
          ) : (
            <ActivityGroup
              key={block.key}
              items={block.items}
              live={running && index === blocks.length - 1}
            />
          ),
        )}
        {running && (
          <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            Codex 正在执行…
          </p>
        )}
      </div>
    </div>
  );
}
