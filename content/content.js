/**
 * content.js
 * ----------
 * Runs in the extension's isolated world on every leetcode.com/problems/* page.
 *
 * Responsibilities:
 *  1. Inject inject.js into the page context (only way to see the page's fetch/XHR).
 *  2. Listen for the "__leettrack_verdict__" event inject.js fires on Accepted.
 *  3. Read problem metadata (title, difficulty, slug) from the DOM/URL.
 *  4. Send a SOLVE_DETECTED message to the background service worker.
 *  5. Re-run metadata extraction on SPA navigation (LeetCode never hard-reloads
 *     between problems, it swaps content via client-side routing).
 *
 * This script does NOT decide isRevision or write to storage - that's the
 * background worker's job, so multiple tabs don't create duplicate records.
 */
(function () {
  const EVENT_NAME = "__leettrack_verdict__";

  // Track submission IDs we've already forwarded in THIS page session,
  // as a first, cheap line of defense before the background worker's
  // authoritative dedupe check.
  const seenInSession = new Set();

  function injectPageScript() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("content/inject.js");
    script.onload = function () {
      this.remove(); // keep the DOM clean; the patch is already applied
    };
    (document.head || document.documentElement).appendChild(script);
  }

  /**
   * Difficulty and title markup on LeetCode changes fairly often since it's
   * not a stable public contract. We try several selector strategies and
   * fall back gracefully. If LeetCode redesigns again, this is the function
   * to update.
   */
  function extractProblemMetadata() {
    const slug = getSlugFromUrl();

    // Title: try common LeetCode DOM patterns, then fall back to <title>.
    let title = null;
    const titleSelectors = [
      '[data-cy="question-title"]',
      "a.no-underline.truncate", // older LeetCode layout
      'div[class*="text-title-large"]',
    ];
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        title = el.textContent.trim();
        break;
      }
    }
    if (!title) {
      // document.title is usually "123. Two Sum - LeetCode"
      title = document.title.replace(/\s*-\s*LeetCode\s*$/, "").trim();
    }

    // Difficulty: LeetCode tags it with a color-coded class/text near the title.
    let difficulty = null;
    const difficultyCandidates = document.querySelectorAll(
      '[class*="difficulty"], [class*="text-difficulty"]'
    );
    for (const el of difficultyCandidates) {
      const text = el.textContent.trim();
      if (/^(easy|medium|hard)$/i.test(text)) {
        difficulty = text[0].toUpperCase() + text.slice(1).toLowerCase();
        break;
      }
    }
    if (!difficulty) difficulty = "Unknown";

    // Problem numeric ID, when present in the title text ("123. Two Sum").
    let problemNumber = null;
    const numberMatch = title.match(/^(\d+)\./);
    if (numberMatch) problemNumber = numberMatch[1];

    return {
      problemId: slug, // slug is stable and unique; use it as the canonical id
      problemNumber,
      title: title.replace(/^\d+\.\s*/, ""),
      difficulty,
      url: `https://leetcode.com/problems/${slug}/`,
    };
  }

  function getSlugFromUrl() {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/);
    return match ? match[1] : window.location.pathname;
  }

  function handleVerdict(evt) {
    const { submissionId, payload } = evt.detail || {};
    if (!submissionId) return;
    if (seenInSession.has(submissionId)) return;

    if (!(payload && payload.status_msg === "Accepted")) return;

    seenInSession.add(submissionId);

    const metadata = extractProblemMetadata();
    const now = Date.now();

    console.log("[LeetTrack:content] forwarding solve to background:", {
      submissionId,
      ...metadata,
    });

    chrome.runtime.sendMessage(
      {
        type: "SOLVE_DETECTED",
        payload: {
          submissionId,
          ...metadata,
          acceptedAt: now,
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[LeetTrack:content] background did not respond:",
            chrome.runtime.lastError.message
          );
          return;
        }
        console.log("[LeetTrack:content] background response:", response);
      }
    );
  }

  // --- SPA navigation handling --------------------------------------------
  // LeetCode swaps routes via History API without a full reload, so we watch
  // for pathname changes to know when metadata should be re-derived, and to
  // make sure a fresh listener state is ready for the new problem.
  let lastPath = window.location.pathname;
  function checkForNavigation() {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      // Nothing to re-init here today, but this is the hook point if the
      // extension ever needs to reset per-problem UI state on navigation.
    }
  }
  const navObserver = new MutationObserver(checkForNavigation);
  navObserver.observe(document, { subtree: true, childList: true });

  window.addEventListener(EVENT_NAME, handleVerdict);
  injectPageScript();
})();
