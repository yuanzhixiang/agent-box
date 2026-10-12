import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** 渲染 agent 回复里的 Markdown（含表格、任务列表） */
export function MarkdownText({ text }: { text: string }) {
  return (
    <div className="leading-[1.55] [overflow-wrap:anywhere] [&_:is(p,ul,ol,pre,table)]:mb-2 [&>:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_:is(h1,h2,h3)]:mt-3 [&_:is(h1,h2,h3)]:mb-2 [&_:is(h1,h2,h3)]:font-semibold [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[13px] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:block [&_table]:border-collapse [&_table]:overflow-x-auto [&_:is(th,td)]:border [&_:is(th,td)]:border-border [&_:is(th,td)]:px-2 [&_:is(th,td)]:py-1 [&_:is(th,td)]:text-left [&_a]:text-primary">
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
    </div>
  );
}
