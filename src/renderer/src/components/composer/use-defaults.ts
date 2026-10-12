import { useEffect, useState } from "react";
import type { Defaults } from "../../../../shared/types";

// 默认值在一次应用会话里不会变，全局只读一次
let cached: Promise<Defaults> | null = null;

/** 读取发任务表单的默认值（模型列表、config.toml 设置、最近目录） */
export function useDefaults(): Defaults | null {
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  useEffect(() => {
    cached ??= window.agentBox.getDefaults();
    let cancelled = false;
    void cached.then((value) => {
      if (!cancelled) {
        setDefaults(value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return defaults;
}
