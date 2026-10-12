import { Composer } from "../composer/composer";

interface NewTaskViewProps {
  onThreadCreated: (threadId: string) => void;
}

/** 新任务页：说明 + 输入框，发送后跳到新对话 */
export function NewTaskView({ onThreadCreated }: NewTaskViewProps) {
  return (
    <>
      <div className="drag-region h-10 shrink-0" />
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <h2 className="text-xl font-semibold">给 Codex 派一个任务</h2>
        <p className="max-w-md text-[13px] text-muted-foreground">
          通过 codex exec 在后台执行，过程会实时显示在这里。左侧列出所有由 codex
          exec 创建的对话，包括其他 agent 发起的。
        </p>
      </div>
      <Composer mode="new" onThreadCreated={onThreadCreated} />
    </>
  );
}
