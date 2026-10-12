import { useState } from "react";
import { ThreadList } from "./components/thread-list/thread-list";
import { ThreadView } from "./components/thread-view/thread-view";
import { NewTaskView } from "./components/new-task/new-task-view";

/** 应用外壳：左侧对话列表，右侧是选中的对话或新任务页 */
export function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="flex h-full bg-background pt-7 text-foreground before:fixed before:inset-x-0 before:top-0 before:h-7 before:bg-sidebar before:content-[''] before:[-webkit-app-region:drag]">
      <ThreadList selectedId={selectedId} onSelect={setSelectedId} />
      <main className="flex min-w-0 flex-1 flex-col">
        {selectedId ? (
          <ThreadView key={selectedId} threadId={selectedId} />
        ) : (
          <NewTaskView onThreadCreated={setSelectedId} />
        )}
      </main>
    </div>
  );
}
