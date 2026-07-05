import { computeStreaks, bucketByDate, bucketByMonth } from "../../utils/date.js";

function daysBetween(startMs, endMs) {
  return Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
}

export function renderStats(container, records) {
  if (records.length === 0) {
    container.innerHTML = `<div class="empty-state">No solves recorded yet. Stats will show up once you solve something on LeetCode.</div>`;
    return;
  }

  const { current, longest } = computeStreaks(records);
  const uniqueProblems = new Set(records.map((r) => r.problemId)).size;
  const totalRevisions = records.filter((r) => r.isRevision).length;
  const totalNew = records.length - totalRevisions;

  const firstSolveMs = Math.min(...records.map((r) => r.acceptedAt));
  const span = daysBetween(firstSolveMs, Date.now());
  const avgNewPerDay = (totalNew / span).toFixed(2);
  const avgRevisionPerDay = (totalRevisions / span).toFixed(2);

  const dayBuckets = bucketByDate(records);
  let mostActiveDay = null;
  let mostActiveDayCount = 0;
  for (const [day, b] of Object.entries(dayBuckets)) {
    const total = b.new + b.revision;
    if (total > mostActiveDayCount) {
      mostActiveDayCount = total;
      mostActiveDay = day;
    }
  }

  const monthBuckets = bucketByMonth(records);
  let mostActiveMonth = null;
  let mostActiveMonthCount = 0;
  for (const [month, count] of Object.entries(monthBuckets)) {
    if (count > mostActiveMonthCount) {
      mostActiveMonthCount = count;
      mostActiveMonth = month;
    }
  }

  container.innerHTML = `
    <div class="card">
      <p class="section-title">Streaks</p>
      <div class="stat-grid" style="grid-template-columns: repeat(2, 1fr);">
        <div class="stat-cell"><span class="num">${current}</span><span class="label">Current streak (days)</span></div>
        <div class="stat-cell"><span class="num">${longest}</span><span class="label">Longest streak (days)</span></div>
      </div>
    </div>

    <div class="card">
      <p class="section-title">Totals</p>
      <div class="stat-grid" style="grid-template-columns: repeat(2, 1fr);">
        <div class="stat-cell"><span class="num">${uniqueProblems}</span><span class="label">Unique problems solved</span></div>
        <div class="stat-cell"><span class="num">${totalRevisions}</span><span class="label">Total re-solves</span></div>
      </div>
    </div>

    <div class="card">
      <p class="section-title">Averages (since first tracked solve)</p>
      <div class="stat-grid" style="grid-template-columns: repeat(2, 1fr);">
        <div class="stat-cell"><span class="num">${avgNewPerDay}</span><span class="label">New / day</span></div>
        <div class="stat-cell"><span class="num">${avgRevisionPerDay}</span><span class="label">Re-solves / day</span></div>
      </div>
    </div>

    <div class="card">
      <p class="section-title">Most Active</p>
      <div class="stat-grid" style="grid-template-columns: repeat(2, 1fr);">
        <div class="stat-cell"><span class="num">${mostActiveDay ?? "—"}</span><span class="label">Day (${mostActiveDayCount} solves)</span></div>
        <div class="stat-cell"><span class="num">${mostActiveMonth ?? "—"}</span><span class="label">Month (${mostActiveMonthCount} solves)</span></div>
      </div>
    </div>
  `;
}
