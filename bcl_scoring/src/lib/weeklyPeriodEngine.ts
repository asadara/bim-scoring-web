import { addJakartaDays, compareYmd, formatJakartaYmd, getJakartaParts, jakartaMidnightUtcMs } from "@/lib/jakartaTime";

export type WeekAnchorDow =
  | "SUNDAY"
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY";

export const WEEK_ANCHOR_OPTIONS: Array<{ value: WeekAnchorDow; label: string; dow: number }> = [
  { value: "MONDAY", label: "Senin", dow: 1 },
  { value: "TUESDAY", label: "Selasa", dow: 2 },
  { value: "WEDNESDAY", label: "Rabu", dow: 3 },
  { value: "THURSDAY", label: "Kamis", dow: 4 },
  { value: "FRIDAY", label: "Jumat", dow: 5 },
  { value: "SATURDAY", label: "Sabtu", dow: 6 },
  { value: "SUNDAY", label: "Minggu", dow: 0 },
];

function dowNumber(anchor: WeekAnchorDow): number {
  return WEEK_ANCHOR_OPTIONS.find((item) => item.value === anchor)?.dow ?? 1;
}

export type WeeklyPeriodWindow = {
  start_ymd: string; // inclusive, Jakarta date
  end_ymd: string; // inclusive, Jakarta date
};

export function buildAutoWeeklyPeriodId(projectId: string, startYmd: string): string {
  const pid = String(projectId || "").trim() || "UNKNOWN_PROJECT";
  const start = String(startYmd || "").trim() || "UNKNOWN_START";
  return `auto-weekly:${pid}:${start}`;
}

export function isAutoWeeklyPeriodId(periodId: string | null | undefined): boolean {
  return typeof periodId === "string" && periodId.trim().toLowerCase().startsWith("auto-weekly:");
}

export function extractAutoWeeklyStartYmd(periodId: string | null | undefined): string | null {
  if (!isAutoWeeklyPeriodId(periodId)) return null;
  const parts = String(periodId).split(":");
  return parts.length >= 3 ? parts.slice(2).join(":").trim() || null : null;
}

export function resolveWeeklyWindow(now: Date, anchor: WeekAnchorDow): WeeklyPeriodWindow {
  const parts = getJakartaParts(now);
  const todayYmd = formatJakartaYmd(now);
  const anchorDow = dowNumber(anchor);
  const delta = (7 + (parts.dow - anchorDow)) % 7;
  const start = addJakartaDays(todayYmd, -delta);
  const end = addJakartaDays(start, 6);
  return { start_ymd: start, end_ymd: end };
}

export function listWeeklyWindowsAround(
  now: Date,
  anchor: WeekAnchorDow,
  backWeeks: number,
  forwardWeeks: number
): WeeklyPeriodWindow[] {
  const base = resolveWeeklyWindow(now, anchor);
  const windows: WeeklyPeriodWindow[] = [];
  for (let i = -Math.max(0, backWeeks); i <= Math.max(0, forwardWeeks); i += 1) {
    const start = addJakartaDays(base.start_ymd, i * 7);
    windows.push({ start_ymd: start, end_ymd: addJakartaDays(start, 6) });
  }
  return windows;
}

export function formatWeeklyLabel(window: WeeklyPeriodWindow): string {
  return `${window.start_ymd} - ${window.end_ymd}`;
}

export function ymdWithinWindow(ymd: string, window: WeeklyPeriodWindow): boolean {
  return compareYmd(ymd, window.start_ymd) >= 0 && compareYmd(ymd, window.end_ymd) <= 0;
}

export function computeCustomWeekOfYear(params: {
  start_ymd: string;
  anchor: WeekAnchorDow;
}): { year: number; week: number } {
  // Week numbering anchored by project start day:
  // - weekYear is the year of the window start date (Jakarta).
  // - week 1 starts at the first anchor start within that year (>= Jan 1).
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(params.start_ymd);
  if (!match) return { year: Number.NaN, week: Number.NaN };
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const anchorDow = dowNumber(params.anchor);

  const jan1Utc = jakartaMidnightUtcMs(year, 0, 1);
  const jan1Parts = getJakartaParts(new Date(jan1Utc));
  const jan1Ymd = `${year}-01-01`;
  const deltaToAnchor = (7 + (anchorDow - jan1Parts.dow)) % 7;
  const firstAnchorYmd = addJakartaDays(jan1Ymd, deltaToAnchor);

  const startUtc = jakartaMidnightUtcMs(year, monthIndex, day);
  const firstUtc = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(firstAnchorYmd);
    if (!m) return jan1Utc;
    return jakartaMidnightUtcMs(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  })();

  const diffWeeks = Math.floor((startUtc - firstUtc) / (7 * 86_400_000));
  return { year, week: 1 + Math.max(0, diffWeeks) };
}
