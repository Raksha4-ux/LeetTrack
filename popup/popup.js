import { getRecords } from "../storage/storage.js";
import { computeStreaks } from "../utils/date.js";
import { renderDashboard } from "./components/dashboard.js";
import { renderCalendar } from "./components/calendar.js";
import { renderStats } from "./components/stats.js";
import { renderHistory } from "./components/history.js";
import { renderSettings } from "./components/settings.js";

const panels = {
  dashboard: document.getElementById("panel-dashboard"),
  calendar: document.getElementById("panel-calendar"),
  stats: document.getElementById("panel-stats"),
  history: document.getElementById("panel-history"),
  settings: document.getElementById("panel-settings"),
};

let records = [];

async function loadAndRenderAll() {
  records = await getRecords();

  const { current } = computeStreaks(records);
  document.getElementById("streak-value").textContent = current;

  renderDashboard(panels.dashboard, records);
  renderCalendar(panels.calendar, records);
  renderStats(panels.stats, records);
  renderHistory(panels.history, records);
  await renderSettings(panels.settings, loadAndRenderAll);
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      Object.entries(panels).forEach(([name, panel]) => {
        panel.classList.toggle("active", name === btn.dataset.tab);
      });
    });
  });
}

// Keep the popup in sync if a solve is recorded while it's open, or if
// another instance (e.g. reset from settings) changes storage.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if ("leettrack_records" in changes) {
    loadAndRenderAll();
  }
});

setupTabs();
loadAndRenderAll();
