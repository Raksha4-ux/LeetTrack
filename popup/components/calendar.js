import { bucketByDate, toDateKey } from "../../utils/date.js";

const WEEKS_TO_SHOW = 13; // 13 x 7 = 91 days, fits the popup width cleanly

let currentMode = "combined"; // "new" | "revision" | "combined"

function levelFor(count) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function buildDayList() {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = WEEKS_TO_SHOW * 7 - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

function valueForMode(bucket, mode) {
  if (!bucket) return 0;
  if (mode === "new") return bucket.new;
  if (mode === "revision") return bucket.revision;
  return bucket.new + bucket.revision;
}

function renderGrid(records) {
  const buckets = bucketByDate(records);
  const days = buildDayList();

  const cells = days
    .map((d) => {
      const key = toDateKey(d.getTime());
      const bucket = buckets[key];
      const value = valueForMode(bucket, currentMode);
      const level = levelFor(value);
      const label = `${key}: ${value} ${
        currentMode === "combined" ? "solve(s)" : currentMode
      }`;
      return `<div class="cal-cell" data-level="${level}" data-tooltip="${label}"></div>`;
    })
    .join("");

  return `<div class="calendar-grid">${cells}</div>`;
}

export function renderCalendar(container, records) {
  function paint() {
    container.innerHTML = `
      <p class="section-title">Contribution Calendar (last ${WEEKS_TO_SHOW} weeks)</p>
      <div class="pill-toggle" id="cal-toggle">
        <button data-mode="new" class="${currentMode === "new" ? "active" : ""}">New</button>
        <button data-mode="revision" class="${currentMode === "revision" ? "active" : ""}">Re-solves</button>
        <button data-mode="combined" class="${currentMode === "combined" ? "active" : ""}">Combined</button>
      </div>
      ${renderGrid(records)}
      <div class="calendar-legend">
        <span>Less</span>
        <div class="cal-cell" data-level="0" style="width:10px;height:10px;flex:none;"></div>
        <div class="cal-cell" data-level="1" style="width:10px;height:10px;flex:none;"></div>
        <div class="cal-cell" data-level="2" style="width:10px;height:10px;flex:none;"></div>
        <div class="cal-cell" data-level="3" style="width:10px;height:10px;flex:none;"></div>
        <div class="cal-cell" data-level="4" style="width:10px;height:10px;flex:none;"></div>
        <span>More</span>
      </div>
    `;

    container.querySelectorAll("#cal-toggle button").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentMode = btn.dataset.mode;
        paint();
      });
    });
  }

  paint();
}
