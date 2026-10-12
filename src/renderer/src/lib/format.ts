/** 把毫秒时间戳格式化成「刚刚 / 5 分钟前 / 昨天 14:03 / 10-09 14:03」 */
export function formatRelativeTime(ms: number, now = Date.now()): string {
  const diff = now - ms;
  if (diff < 60_000) {
    return "刚刚";
  }
  if (diff < 3_600_000) {
    return `${Math.floor(diff / 60_000)} 分钟前`;
  }
  const date = new Date(ms);
  const time = date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const today = new Date(now);
  if (date.toDateString() === today.toDateString()) {
    return time;
  }
  const yesterday = new Date(now - 86_400_000);
  if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${time}`;
  }
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day} ${time}`;
}

/** 时间线条目上的时钟时间 */
export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("zh-CN", { hour12: false });
}

/** 时长：850ms / 12.3s / 4m 05s */
export function formatDuration(ms: number | null): string {
  if (ms === null) {
    return "";
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

/** token 数：950 / 12.3k / 1.2M */
export function formatTokens(value: number): string {
  if (value < 1000) {
    return String(value);
  }
  if (value < 1_000_000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return `${(value / 1_000_000).toFixed(1)}M`;
}

/** 路径只保留最后两段，完整路径放 title 里 */
export function shortPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.length <= 2 ? path : `…/${parts.slice(-2).join("/")}`;
}
