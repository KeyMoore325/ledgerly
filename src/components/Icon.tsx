const paths: Record<string, string> = {
  logo: "M4 19V5m0 14h16M8 15l3-4 3 2 5-6",
  sun: "M12 3v2m0 14v2M5.6 5.6 7 7m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
  monitor: "M4 5h16v11H4zM9 20h6M12 16v4",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  trash: "M5 7h14M10 11v6m4-6v6M9 7l1-3h4l1 3M6 7l1 13h10l1-13",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
  card: "M3 6h18v12H3zM3 10h18M7 15h3",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0",
  rss: "M5 19a1 1 0 1 0 0-.01M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  download: "M12 4v11m-5-5 5 5 5-5M5 20h14",
  upload: "M12 20V9m-5 5 5-5 5 5M5 4h14",
};

export function Icon({ name, size = 20, label }: { name: string; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={paths[name] ?? ""} />
    </svg>
  );
}
