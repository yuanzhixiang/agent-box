import { Composer } from "../composer/composer";

interface NewTaskViewProps {
  onThreadCreated: (threadId: string) => void;
}

/** 新任务页：说明 + 输入框，发送后跳到新对话 */
export function NewTaskView({ onThreadCreated }: NewTaskViewProps) {
  return (
    <>
      <header className="flex min-h-10 shrink-0 items-center gap-3 px-6 text-[12px] [@media(max-width:1050px)]:px-4 [&_h2]:min-w-0 [&_h2]:truncate [&_h2]:text-[13px] [&_h2]:font-normal [-webkit-app-region:drag]">
        <h2>New Session</h2>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:tracking-[-0.5px] [&_p]:text-[13px] [&_p]:text-muted-foreground">
        <h2>What can I help you with?</h2>
        <p>Start a session in your workspace.</p>
      </div>
      <Composer mode="new" onThreadCreated={onThreadCreated} />
    </>
  );
}
