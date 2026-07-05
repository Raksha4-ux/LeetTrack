/**
 * background.js
 * -------------
 * Service worker. Listens for SOLVE_DETECTED messages from content scripts
 * on any leetcode.com tab, and is the single authority for writing to
 * storage. Centralizing this here (rather than writing from content.js
 * directly) avoids double-counting when the user has multiple LeetCode
 * tabs open at once.
 */

import { recordSolve } from "../storage/storage.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SOLVE_DETECTED") return false;

  recordSolve(message.payload)
    .then((record) => {
      sendResponse({ ok: true, recorded: Boolean(record), record });
    })
    .catch((err) => {
      console.error("[LeetTrack] Failed to record solve:", err);
      sendResponse({ ok: false, error: String(err) });
    });

  return true; // keep the message channel open for the async response
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log(
      "[LeetTrack] Installed. Tracking starts now - past submissions are not backfilled."
    );
  }
});
