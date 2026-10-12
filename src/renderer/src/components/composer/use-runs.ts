import { useEffect, useState } from "react";
import type { RunInfo } from "../../../../shared/types";

/** 订阅本应用启动的 codex 进程列表 */
export function useRuns(): RunInfo[] {
  const [runs, setRuns] = useState<RunInfo[]>([]);
  useEffect(() => {
    let cancelled = false;
    void window.agentBox.listRuns().then((value) => {
      if (!cancelled) {
        setRuns(value);
      }
    });
    const off = window.agentBox.onRunsChanged(setRuns);
    return () => {
      cancelled = true;
      off();
    };
  }, []);
  return runs;
}
