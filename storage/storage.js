/**
 * storage.js
 * ----------
 * Single source of truth for the extension's data schema. Nothing else in
 * the codebase should call chrome.storage.* directly - go through the
 * functions here so the schema only has to be understood in one place.
 *
 * Schema (chrome.storage.local):
 *   leettrack_records:      SolveRecord[]
 *   leettrack_solvedIndex:  { [problemId]: firstSolvedAtMs }   -- for isRevision + unique count
 *   leettrack_submissionIds: string[]                          -- dedupe guard, never re-issued by LeetCode
 *   leettrack_settings:     { dedupeWindowSeconds: number }
 *
 * SolveRecord shape:
 *   {
 *     id: string,            // uuid, our own record id
 *     submissionId: string,  // LeetCode's submission id (dedupe key)
 *     problemId: string,     // LeetCode slug, e.g. "two-sum"
 *     title: string,
 *     difficulty: "Easy" | "Medium" | "Hard" | "Unknown",
 *     url: string,
 *     acceptedAt: number,    // ms epoch
 *     date: string,          // "YYYY-MM-DD" local date, derived from acceptedAt
 *     time: string,          // "HH:MM" local time, derived from acceptedAt (display convenience)
 *     isRevision: boolean
 *   }
 *
 * NOTE ON SCALE: this uses chrome.storage.local (with the "unlimitedStorage"
 * permission) rather than IndexedDB. At realistic solve volumes this is
 * fine for years of use. If you ever need to store much larger blobs
 * (e.g. saved code per submission), swap the records array for an
 * IndexedDB object store here - this file is the only one that would need
 * to change.
 */

import { toDateKey, toTimeString } from "../utils/date.js";

const KEYS = {
  RECORDS: "leettrack_records",
  SOLVED_INDEX: "leettrack_solvedIndex",
  SUBMISSION_IDS: "leettrack_submissionIds",
  SETTINGS: "leettrack_settings",
};

const DEFAULT_SETTINGS = {
  dedupeWindowSeconds: 5,
};

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getAll() {
  const data = await chrome.storage.local.get([
    KEYS.RECORDS,
    KEYS.SOLVED_INDEX,
    KEYS.SUBMISSION_IDS,
    KEYS.SETTINGS,
  ]);
  return {
    records: data[KEYS.RECORDS] || [],
    solvedIndex: data[KEYS.SOLVED_INDEX] || {},
    submissionIds: data[KEYS.SUBMISSION_IDS] || [],
    settings: { ...DEFAULT_SETTINGS, ...(data[KEYS.SETTINGS] || {}) },
  };
}

export async function getRecords() {
  const { records } = await getAll();
  return records;
}

export async function getSettings() {
  const { settings } = await getAll();
  return settings;
}

export async function saveSettings(partial) {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ [KEYS.SETTINGS]: next });
  return next;
}

/**
 * The core write path. Called by background.js whenever an Accepted
 * verdict is detected. Handles:
 *   - hard dedupe on submissionId (LeetCode never reissues these)
 *   - soft dedupe on (problemId within dedupeWindowSeconds) to guard
 *     against edge cases where a submission id itself gets re-reported
 *   - isRevision determination via the solvedIndex map
 *
 * Returns the created record, or null if it was rejected as a duplicate.
 */
export async function recordSolve(detected) {
  const { records, solvedIndex, submissionIds, settings } = await getAll();

  if (submissionIds.includes(detected.submissionId)) {
    return null; // already recorded, e.g. duplicate event from a page refresh
  }

  const dedupeWindowMs = settings.dedupeWindowSeconds * 1000;
  const recentDuplicate = records.find(
    (r) =>
      r.problemId === detected.problemId &&
      Math.abs(r.acceptedAt - detected.acceptedAt) <= dedupeWindowMs
  );
  if (recentDuplicate) {
    return null;
  }

  const isFirstSolve = !(detected.problemId in solvedIndex);
  const record = {
    id: uuid(),
    submissionId: detected.submissionId,
    problemId: detected.problemId,
    title: detected.title,
    difficulty: detected.difficulty,
    url: detected.url,
    acceptedAt: detected.acceptedAt,
    date: toDateKey(detected.acceptedAt),
    time: toTimeString(detected.acceptedAt),
    isRevision: !isFirstSolve,
  };

  const nextRecords = [...records, record];
  const nextSolvedIndex = isFirstSolve
    ? { ...solvedIndex, [detected.problemId]: detected.acceptedAt }
    : solvedIndex;
  const nextSubmissionIds = [...submissionIds, detected.submissionId];

  await chrome.storage.local.set({
    [KEYS.RECORDS]: nextRecords,
    [KEYS.SOLVED_INDEX]: nextSolvedIndex,
    [KEYS.SUBMISSION_IDS]: nextSubmissionIds,
  });

  return record;
}

export async function resetAllData() {
  await chrome.storage.local.remove([
    KEYS.RECORDS,
    KEYS.SOLVED_INDEX,
    KEYS.SUBMISSION_IDS,
  ]);
}

/**
 * Imports previously-exported JSON. Rebuilds the solvedIndex and
 * submissionIds from the records themselves so the file is the single
 * source of truth for an import - no separate index file needed.
 */
export async function importRecords(records) {
  if (!Array.isArray(records)) {
    throw new Error("Import file must contain an array of records.");
  }

  const solvedIndex = {};
  const submissionIds = [];
  const sorted = [...records].sort((a, b) => a.acceptedAt - b.acceptedAt);

  for (const r of sorted) {
    if (!(r.problemId in solvedIndex)) {
      solvedIndex[r.problemId] = r.acceptedAt;
    }
    submissionIds.push(r.submissionId);
  }

  await chrome.storage.local.set({
    [KEYS.RECORDS]: sorted,
    [KEYS.SOLVED_INDEX]: solvedIndex,
    [KEYS.SUBMISSION_IDS]: submissionIds,
  });
}
