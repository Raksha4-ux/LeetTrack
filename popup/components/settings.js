import { getSettings, saveSettings, resetAllData, importRecords, getRecords } from "../../storage/storage.js";
import { recordsToCsv, recordsToJson, downloadFile } from "../../utils/format.js";

export async function renderSettings(container, onDataChanged) {
  const settings = await getSettings();

  container.innerHTML = `
    <div class="card">
      <p class="section-title">Duplicate detection</p>
      <div class="settings-row">
        <div>
          <div>Treat repeated Accepted verdicts as one solve if within</div>
          <div class="desc">Guards against page refreshes re-triggering a detection. Applies per problem.</div>
        </div>
      </div>
      <div class="settings-row">
        <select id="dedupe-window">
          <option value="0">Off</option>
          <option value="5">5 seconds</option>
          <option value="15">15 seconds</option>
          <option value="60">60 seconds</option>
          <option value="300">5 minutes</option>
        </select>
      </div>
    </div>

    <div class="card">
      <p class="section-title">Export all data</p>
      <div class="btn-row">
        <button class="btn" id="settings-export-csv">Export CSV</button>
        <button class="btn" id="settings-export-json">Export JSON</button>
      </div>
    </div>

    <div class="card">
      <p class="section-title">Import data</p>
      <p class="desc" style="margin-top:-4px;margin-bottom:8px;">
        Restores from a previously exported LeetTrack JSON file. This replaces current data.
      </p>
      <input type="file" id="import-file" accept="application/json" />
    </div>

    <div class="card">
      <p class="section-title">Danger zone</p>
      <p class="desc" style="margin-top:-4px;margin-bottom:8px;">
        Permanently deletes every recorded solve on this device. Cannot be undone.
      </p>
      <button class="btn danger" id="reset-data">Reset all data</button>
    </div>
  `;

  const dedupeSelect = container.querySelector("#dedupe-window");
  dedupeSelect.value = String(settings.dedupeWindowSeconds);
  dedupeSelect.addEventListener("change", async (e) => {
    await saveSettings({ dedupeWindowSeconds: Number(e.target.value) });
  });

  container.querySelector("#settings-export-csv").addEventListener("click", async () => {
    const records = await getRecords();
    downloadFile("leettrack-all-data.csv", recordsToCsv(records), "text/csv");
  });

  container.querySelector("#settings-export-json").addEventListener("click", async () => {
    const records = await getRecords();
    downloadFile("leettrack-all-data.json", recordsToJson(records), "application/json");
  });

  container.querySelector("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await importRecords(parsed);
      alert("Import complete.");
      onDataChanged?.();
    } catch (err) {
      alert("Import failed: " + err.message);
    } finally {
      e.target.value = "";
    }
  });

  container.querySelector("#reset-data").addEventListener("click", async () => {
    const confirmed = confirm(
      "This deletes all LeetTrack data on this device permanently. Continue?"
    );
    if (!confirmed) return;
    await resetAllData();
    onDataChanged?.();
  });
}
