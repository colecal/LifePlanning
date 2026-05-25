// Best-effort natural-language date parser for the Quick Capture input.
// Examples: "dinner fri 7pm", "vet tomorrow at 9am", "trash tuesday".
// Returns the parsed Date (in local time) and the cleaned title.

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

export type ParsedQuick = {
  title: string;
  date: Date | null;
  hasTime: boolean;
};

export function parseQuick(input: string): ParsedQuick {
  let text = input.trim();
  let date: Date | null = null;
  let hasTime = false;
  const now = new Date();

  // Time: "at 7pm", "7:30pm", "7pm", "at 14:00"
  const timeMatch = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  let hours: number | null = null;
  let minutes = 0;
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3]?.toLowerCase();
    if (meridiem === "pm" && h < 12) hours = h + 12;
    else if (meridiem === "am" && h === 12) hours = 0;
    else if (meridiem) hours = h;
    else if (h >= 0 && h <= 23 && (m > 0 || timeMatch[0].includes(":"))) hours = h;
    if (hours !== null) {
      minutes = m;
      hasTime = true;
      text = text.replace(timeMatch[0], "").trim();
    }
  }

  // Date: "today", "tomorrow", "tonight", "this/next <weekday>", "<weekday>"
  const lower = text.toLowerCase();
  const todayRe = /\b(today|tonight)\b/;
  const tomorrowRe = /\btomorrow\b/;
  const weekdayRe = /\b(next\s+)?(sun|sunday|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday)\b/i;
  const inDaysRe = /\bin\s+(\d+)\s+days?\b/i;
  const inHoursRe = /\bin\s+(\d+)\s+hours?\b/i;

  let m: RegExpMatchArray | null;
  if ((m = lower.match(todayRe))) {
    date = new Date(now);
    if (m[1] === "tonight" && hours === null) {
      hours = 19;
      minutes = 0;
      hasTime = true;
    }
    text = text.replace(new RegExp(m[1], "i"), "").trim();
  } else if (tomorrowRe.test(lower)) {
    date = new Date(now);
    date.setDate(date.getDate() + 1);
    text = text.replace(/tomorrow/i, "").trim();
  } else if ((m = text.match(weekdayRe))) {
    const isNext = !!m[1];
    const dayIdx = WEEKDAYS[m[2].toLowerCase()];
    date = new Date(now);
    let diff = dayIdx - date.getDay();
    if (diff <= 0 || isNext) diff += 7;
    date.setDate(date.getDate() + diff);
    text = text.replace(m[0], "").trim();
  } else if ((m = text.match(inDaysRe))) {
    date = new Date(now);
    date.setDate(date.getDate() + parseInt(m[1], 10));
    text = text.replace(m[0], "").trim();
  } else if ((m = text.match(inHoursRe))) {
    date = new Date(now);
    date.setHours(date.getHours() + parseInt(m[1], 10));
    hasTime = true;
    text = text.replace(m[0], "").trim();
  }

  // Apply parsed hour/minute
  if (date && hours !== null) {
    date.setHours(hours, minutes, 0, 0);
  } else if (date && !hasTime) {
    // No time given — default to 9am for a date-only event
    date.setHours(9, 0, 0, 0);
  }

  // If only a time was given (no date), assume today
  if (!date && hasTime && hours !== null) {
    date = new Date(now);
    date.setHours(hours, minutes, 0, 0);
    // If that time has already passed today, push to tomorrow
    if (date < now) date.setDate(date.getDate() + 1);
  }

  // Clean up leftover prepositions
  text = text
    .replace(/\b(at|on|for)\b\s*$/i, "")
    .replace(/^\s*(at|on|for)\b\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return { title: text || input.trim(), date, hasTime };
}
