/**
 * date.js
 * -------
 * Pure date-math helpers. No storage or DOM access here, so this module
 * is trivially unit-testable and shared between background.js and the
 * popup components.
 *
 * Convention: every record's "date" field is a local-time "YYYY-MM-DD"
 * string. We bucket by LOCAL day, not UTC, since "today" should match
 * what the user sees on their own clock.
 */

export function toDateKey(timestampMs) {
  const d = new Date(timestampMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toTimeString(timestampMs) {
  const d = new Date(timestampMs);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export function startOfMonth(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  return d;
}

export function startOfYear(date = new Date()) {
  return new Date(date.getFullYear(), 0, 1);
}

export function isSameDateKey(tsMs, dateKey) {
  return toDateKey(tsMs) === dateKey;
}

export function isWithinRange(tsMs, startDate, endDate = new Date()) {
  return tsMs >= startDate.getTime() && tsMs <= endDate.getTime();
}

/**
 * Groups records into { dateKey: { new: n, revision: n } } buckets.
 * Used by both the calendar heatmap and stats (most active day/month).
 */
export function bucketByDate(records) {
  const buckets = {};
  for (const r of records) {
    const key = r.date;
    if (!buckets[key]) buckets[key] = { new: 0, revision: 0 };
    if (r.isRevision) buckets[key].revision += 1;
    else buckets[key].new += 1;
  }
  return buckets;
}

export function bucketByMonth(records) {
  const buckets = {};
  for (const r of records) {
    const key = r.date.slice(0, 7); // "YYYY-MM"
    buckets[key] = (buckets[key] || 0) + 1;
  }
  return buckets;
}

/**
 * Current streak = consecutive days up to and including today (or
 * yesterday, if nothing logged yet today) with at least one solve
 * (new or revision - both count towards "showed up").
 * Longest streak = the longest such run in the full history.
 */
export function computeStreaks(records) {
  if (records.length === 0) return { current: 0, longest: 0 };

  const activeDays = new Set(records.map((r) => r.date));
  const sortedDays = Array.from(activeDays).sort();

  // Longest streak: walk sorted unique days, count consecutive runs.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diffDays = Math.round((curr - prev) / 86400000);
    if (diffDays === 1) {
      run += 1;
    } else if (diffDays > 1) {
      run = 1;
    }
    longest = Math.max(longest, run);
  }

  // Current streak: count back from today.
  let current = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // If nothing logged today, the streak can still be "alive" through
  // yesterday - only breaks once a full day is skipped.
  if (!activeDays.has(toDateKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (activeDays.has(toDateKey(cursor.getTime()))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current, longest };
}
