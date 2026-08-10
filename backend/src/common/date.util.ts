export function startOfUTCDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Exclusive upper bound for a UTC day range. */
export function endOfUTCDay(date = new Date()): Date {
  return addUTCDays(startOfUTCDay(date), 1);
}

export function toUTCDateOnly(date: Date): Date {
  return startOfUTCDay(date);
}

export function addUTCDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function daysBetweenUTC(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function addUTCMonthsClamped(date: Date, months: number, preferredDay: number): Date {
  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  const day = Math.min(clampDayOfMonth(preferredDay), daysInUTCMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}

function daysInUTCMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function clampDayOfMonth(day: number): number {
  return Math.min(31, Math.max(1, day));
}
