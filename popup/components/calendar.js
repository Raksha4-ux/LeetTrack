import { bucketByDate, toDateKey } from "../../utils/date.js";

const CELL_SIZE = 10; // px, fixed - matches GitHub's density, not stretched to fill width
const CELL_GAP = 3;
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

let currentMode = "combined"; // "new" | "revision" | "combined"
let currentYear = new Date().getFullYear();

function levelFor(count) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function valueForMode(bucket, mode) {
  if (!bucket) return 0;
  if (mode === "new") return bucket.new;
  if (mode === "revision") return bucket.revision;
  return bucket.new + bucket.revision;
}

/**
 * Builds a GitHub-style week grid for the given year: each entry is a
 * "week" (array of 7 Date-or-null slots, Sunday first). The first week
 * is padded backward to start on a Sunday and the last week padded
 * forward to end on a Saturday, so every column lines up to real weekdays
 * - this is what makes month boundaries land in the right place, unlike
 * the old row-major layout.
 */
function buildYearWeeks(year, today) {
  const jan1 = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const rangeEnd = year === today.getFullYear() ? today : yearEnd;

  const cursor = new Date(jan1);
  cursor.setDate(cursor.getDate() - cursor.getDay()); // back up to Sunday

  const days = [];
  while (true) {
    const inRange = cursor >= jan1 && cursor <= rangeEnd;
    days.push(inRange ? new Date(cursor) : null);
    const passedEnd = cursor > rangeEnd;
    cursor.setDate(cursor.getDate() + 1);
    if (passedEnd && days.length % 7 === 0) break;
  }

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

function monthLabelsForWeeks(weeks) {
  const labels = [];
  let lastMonth = -1;
  weeks.forEach((week, colIndex) => {
    const lastDay = [...week].reverse().find((d) => d !== null);
    if (!lastDay) return;
    if (lastDay.getMonth() !== lastMonth) {
      labels.push({ colIndex, text: MONTH_NAMES[lastDay.getMonth()] });
      lastMonth = lastDay.getMonth();
    }
  });
  return labels;
}

function availableYears(records, today) {
  const years = new Set([today.getFullYear()]);
  records.forEach((r) => years.add(new Date(r.acceptedAt).getFullYear()));
  return Array.from(years).sort((a, b) => b - a); // newest first
}

function renderGrid(records, year) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = bucketByDate(records);
  const weeks = buildYearWeeks(year, today);
  const labels = monthLabelsForWeeks(weeks);
  const colWidth = CELL_SIZE + CELL_GAP;

  const cellsHtml = weeks
    .map((week, colIndex) =>
      week
        .map((day, rowIndex) => {
          if (!day) {
            return `<div class="cal-cell empty" style="grid-column:${colIndex + 1}; grid-row:${rowIndex + 1};"></div>`;
          }
          const key = toDateKey(day.getTime());
          const bucket = buckets[key];
          const value = valueForMode(bucket, currentMode);
          const level = levelFor(value);
          const label = `${key}: ${value} ${currentMode === "combined" ? "solve(s)" : currentMode}`;
          return `<div class="cal-cell" data-level="${level}" data-tooltip="${label}" style="grid-column:${colIndex + 1}; grid-row:${rowIndex + 1};"></div>`;
        })
        .join("")
    )
    .join("");

  const labelsHtml = labels
    .map(
      (l) =>
        `<span style="position:absolute; left:${l.colIndex * colWidth}px;">${l.text}</span>`
    )
    .join("");

  const gridWidth = weeks.length * colWidth;

  return `
    <div class="cal-month-labels" style="width:${gridWidth}px;">${labelsHtml}</div>
    <div class="cal-year-grid" style="width:${gridWidth}px; grid-template-columns: repeat(${weeks.length}, ${CELL_SIZE}px); grid-template-rows: repeat(7, ${CELL_SIZE}px);">
      ${cellsHtml}
    </div>
  `;
}

export function renderCalendar(container, records) {
  const today = new Date();

  function paint() {
    const years = availableYears(records, today);

    container.innerHTML = `
      <div class="calendar-header-row">
        <p class="section-title" style="margin:0;">Contribution Calendar</p>
        <select id="cal-year">
          ${years.map((y) => `<option value="${y}" ${y === currentYear ? "selected" : ""}>${y}</option>`).join("")}
        </select>
      </div>
      <div class="pill-toggle" id="cal-toggle">
        <button data-mode="new" class="${currentMode === "new" ? "active" : ""}">New</button>
        <button data-mode="revision" class="${currentMode === "revision" ? "active" : ""}">Re-solves</button>
        <button data-mode="combined" class="${currentMode === "combined" ? "active" : ""}">Combined</button>
      </div>
      <div class="cal-year-scroll" id="cal-scroll">
        ${renderGrid(records, currentYear)}
      </div>
      <div class="calendar-legend">
        <span>Less</span>
        <div class="cal-cell" data-level="0" style="width:10px;height:10px;"></div>
        <div class="cal-cell" data-level="1" style="width:10px;height:10px;"></div>
        <div class="cal-cell" data-level="2" style="width:10px;height:10px;"></div>
        <div class="cal-cell" data-level="3" style="width:10px;height:10px;"></div>
        <div class="cal-cell" data-level="4" style="width:10px;height:10px;"></div>
        <span>More</span>
      </div>
    `;

    container.querySelectorAll("#cal-toggle button").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentMode = btn.dataset.mode;
        paint();
      });
    });

    container.querySelector("#cal-year").addEventListener("change", (e) => {
      currentYear = Number(e.target.value);
      paint();
    });

    // Default scroll position: rightmost (most recent weeks), so "today"
    // is visible without the user having to scroll on open - a full year
    // at real cell size doesn't fit in a 380px popup, so this matters.
    const scrollEl = container.querySelector("#cal-scroll");
    scrollEl.scrollLeft = scrollEl.scrollWidth;
  }

  paint();
}
