const JAKARTA_OFFSET_MINUTES = 7 * 60; // Asia/Jakarta is UTC+7, no DST.

type JakartaParts = {
  year: number;
  monthIndex: number; // 0-11
  day: number; // 1-31
  dow: number; // 0-6 (Sun-Sat)
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function getJakartaParts(date: Date): JakartaParts {
  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    monthIndex: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    dow: shifted.getUTCDay(),
  };
}

export function formatJakartaYmd(date: Date): string {
  const parts = getJakartaParts(date);
  return `${parts.year}-${pad2(parts.monthIndex + 1)}-${pad2(parts.day)}`;
}

export function jakartaMidnightUtcMs(year: number, monthIndex: number, day: number): number {
  // Midnight in Jakarta equals UTC midnight minus offset (UTC+7).
  return Date.UTC(year, monthIndex, day, 0, 0, 0) - JAKARTA_OFFSET_MINUTES * 60_000;
}

export function addJakartaDays(ymd: string, deltaDays: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const baseUtc = jakartaMidnightUtcMs(year, monthIndex, day);
  const shifted = new Date(baseUtc + deltaDays * 86_400_000);
  return formatJakartaYmd(shifted);
}

export function compareYmd(a: string, b: string): number {
  // YYYY-MM-DD lexicographic compare is correct.
  return a.localeCompare(b);
}

