import { recordsToCsv, recordsToJson, downloadFile } from "../../utils/format.js";

function applyFilters(records, { search, difficulty, dateFrom, type }) {
  return records
    .filter((r) => {
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (difficulty !== "all" && r.difficulty !== difficulty) return false;
      if (dateFrom && r.date !== dateFrom) return false;
      if (type === "new" && r.isRevision) return false;
      if (type === "revision" && !r.isRevision) return false;
      return true;
    })
    .sort((a, b) => b.acceptedAt - a.acceptedAt);
}

export function renderHistory(container, records) {
  const state = {
    search: "",
    difficulty: "all",
    dateFrom: "",
    type: "all",
  };

  function paint() {
    const filtered = applyFilters(records, state);

    const rows =
      filtered.length === 0
        ? `<tr><td colspan="5"><div class="empty-state">No records match these filters.</div></td></tr>`
        : filtered
            .map(
              (r) => `
        <tr>
          <td>${r.date}</td>
          <td>${r.time}</td>
          <td class="title-cell" title="${r.title}">${r.title}</td>
          <td><span class="tag ${r.difficulty}">${r.difficulty}</span></td>
          <td>${r.isRevision ? "Re-solve" : "New"}</td>
        </tr>`
            )
            .join("");

    container.innerHTML = `
      <div class="history-controls">
        <input type="text" id="hist-search" placeholder="Search by problem title..." value="${state.search}" />
        <div class="filter-row">
          <select id="hist-difficulty">
            <option value="all">All difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
          <select id="hist-type">
            <option value="all">New + Re-solve</option>
            <option value="new">New only</option>
            <option value="revision">Re-solve only</option>
          </select>
          <input type="date" id="hist-date" value="${state.dateFrom}" />
        </div>
        <div class="btn-row">
          <button class="btn" id="export-csv">Export CSV</button>
          <button class="btn" id="export-json">Export JSON</button>
        </div>
      </div>
      <table class="history-table">
        <thead>
          <tr><th>Date</th><th>Time</th><th>Problem</th><th>Difficulty</th><th>Type</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    container.querySelector("#hist-search").addEventListener("input", (e) => {
      state.search = e.target.value;
      paint();
    });
    container.querySelector("#hist-difficulty").value = state.difficulty;
    container.querySelector("#hist-difficulty").addEventListener("change", (e) => {
      state.difficulty = e.target.value;
      paint();
    });
    container.querySelector("#hist-type").value = state.type;
    container.querySelector("#hist-type").addEventListener("change", (e) => {
      state.type = e.target.value;
      paint();
    });
    container.querySelector("#hist-date").addEventListener("change", (e) => {
      state.dateFrom = e.target.value;
      paint();
    });
    container.querySelector("#export-csv").addEventListener("click", () => {
      downloadFile("leettrack-export.csv", recordsToCsv(filtered), "text/csv");
    });
    container.querySelector("#export-json").addEventListener("click", () => {
      downloadFile(
        "leettrack-export.json",
        recordsToJson(filtered),
        "application/json"
      );
    });
  }

  paint();
}
