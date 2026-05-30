import { eachMonthOfInterval, format } from "date-fns";

export function centsToDollars(c: number): string {
  return (c / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/** "YYYY-MM" key for a Date in local time. */
export function yearMonth(d: Date): string {
  return format(d, "yyyy-MM");
}

/** Pretty label like "May 2026" for a "YYYY-MM" key. */
export function monthLabel(ym: string): string {
  return format(parseYearMonth(ym), "MMMM yyyy");
}

/** Inclusive list of "YYYY-MM" keys from startYM through endYM. */
export function monthsBetweenInclusive(startYM: string, endYM: string): string[] {
  const start = parseYearMonth(startYM);
  const end = parseYearMonth(endYM);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [];
  }
  return eachMonthOfInterval({ start, end }).map((d) => format(d, "yyyy-MM"));
}

function parseYearMonth(ym: string): Date {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1);
}
