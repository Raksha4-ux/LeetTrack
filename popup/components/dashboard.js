import {
  toDateKey,
  startOfWeek,
  startOfMonth,
  startOfYear,
  isWithinRange,
} from "../../utils/date.js";

function countBucket(records, start) {
  const inRange = records.filter((r) => isWithinRange(r.acceptedAt, start));
  return {
    newCount: inRange.filter((r) => !r.isRevision).length,
    revisionCount: inRange.filter((r) => r.isRevision).length,
  };
}

function statCell(num, label) {
  return `<div class="stat-cell"><span class="num">${num}</span><span class="label">${label}</span></div>`;
}

function periodCard(title, bucket) {
  return `
    <div class="card">
      <p class="section-title">${title}</p>
      <div class="stat-grid" style="grid-template-columns: repeat(2, 1fr);">
        ${statCell(bucket.newCount, "New")}
        ${statCell(bucket.revisionCount, "Re-solved")}
      </div>
    </div>
  `;
}

export function renderDashboard(container, records) {
  const now = new Date();
  const todayKey = toDateKey(now.getTime());
  const todayRecords = records.filter((r) => r.date === todayKey);

  const today = {
    newCount: todayRecords.filter((r) => !r.isRevision).length,
    revisionCount: todayRecords.filter((r) => r.isRevision).length,
  };
  const week = countBucket(records, startOfWeek(now));
  const month = countBucket(records, startOfMonth(now));
  const year = countBucket(records, startOfYear(now));

  container.innerHTML = `
    <div class="card">
      <p class="section-title">Today</p>
      <div class="stat-grid">
        ${statCell(today.newCount, "New")}
        ${statCell(today.revisionCount, "Re-solved")}
        ${statCell(today.newCount + today.revisionCount, "Total")}
      </div>
    </div>
    <div class="two-col">
      ${periodCard("This Week", week)}
      ${periodCard("This Month", month)}
    </div>
    ${periodCard("This Year", year)}
  `;
}
