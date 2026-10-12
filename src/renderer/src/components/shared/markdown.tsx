import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** 渲染 agent 回复里的 Markdown（含表格、任务列表） */
export function MarkdownText({ text }: { text: string }) {
  return (
    <div className="prose-agent">
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
    </div>
  );
}
