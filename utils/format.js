/**
 * format.js
 * ---------
 * Serialization helpers for the export feature. Kept separate from
 * storage.js because this is presentation/output logic, not data
 * ownership.
 */

const CSV_COLUMNS = [
  "id",
  "submissionId",
  "problemId",
  "title",
  "difficulty",
  "url",
  "date",
  "time",
  "acceptedAt",
  "isRevision",
];

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function recordsToCsv(records) {
  const header = CSV_COLUMNS.join(",");
  const rows = records.map((r) =>
    CSV_COLUMNS.map((col) => csvEscape(r[col])).join(",")
  );
  return [header, ...rows].join("\n");
}

export function recordsToJson(records) {
  return JSON.stringify(records, null, 2);
}

export function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
