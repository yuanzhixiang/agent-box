import type { CSSProperties } from "react";

const paths = {
  mic: "M12 19v3M19 10v2a7 7 0 0 1-14 0v-2M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z",
  plus: "M12 5v14M5 12h14",
  search: "m21 21-4.3-4.3M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0",
  panel: "M9 3v18M3 3h18v18H3z",
  flag: "M4 22V3m0 0c5-4 9 4 15 0v11c-6 4-10-4-15 0",
  sparkle: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
  folder: "M3 7V5h6l2 2h10v13H3z",
  filter: "M4 6h16M7 12h10M10 18h4",
  chevron: "m6 9 6 6 6-6",
  terminal: "M3 3h18v18H3zM7 8l3 4-3 4m6 0h4",
  arrow: "M12 19V5m-6 6 6-6 6 6",
  stop: "M6 6h12v12H6z",
  help: "M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 4h.01",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  close: "m6 6 12 12M6 18 18 6",
} as const;
export function Icon({
  name,
  size = 16,
  style,
}: {
  name: keyof typeof paths;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
