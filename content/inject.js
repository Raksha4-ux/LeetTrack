/**
 * inject.js
 * ---------
 * Runs in the PAGE's JS context (not the extension's isolated world).
 * This is required because LeetCode's own `fetch`/`XMLHttpRequest` calls
 * are only visible if we patch them from inside the page itself.
 *
 * Responsibility: watch network traffic for the submission-check endpoint,
 * and when it reports an Accepted verdict, broadcast a CustomEvent that
 * content.js (isolated world) can listen for via window.addEventListener.
 *
 * This file talks to content.js ONLY through window.dispatchEvent /
 * window.addEventListener with a namespaced event name. It never touches
 * chrome.* APIs directly (it can't - it's not running as an extension script).
 */
(function () {
  const EVENT_NAME = "__leettrack_verdict__";

  // Matches https://leetcode.com/submissions/detail/<id>/check/
  // and the newer https://leetcode.com/submissions/detail/<id>/v2/check/
  // The (\d+) requirement also naturally excludes the "Run" button's
  // /submissions/detail/runcode_.../check/ calls, since that id is not
  // purely numeric - we only want real Submit verdicts, not test runs.
  const CHECK_URL_RE = /\/submissions\/detail\/(\d+)\/(?:v2\/)?check\/?/;

  function extractSubmissionId(url) {
    const match = url.match(CHECK_URL_RE);
    return match ? match[1] : null;
  }

  function emitVerdict(submissionId, payload) {
    console.log("[LeetTrack:inject] Accepted verdict detected", submissionId, payload);
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { submissionId, payload },
      })
    );
  }

  console.log("[LeetTrack:inject] fetch/XHR patched, watching for", CHECK_URL_RE);

  // --- Patch window.fetch -------------------------------------------------
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;

      // DEBUG: log anything that looks submission/graphql related, even if
      // it doesn't match our assumed pattern. If you never see verdicts
      // recorded, check this log to find what LeetCode is ACTUALLY calling
      // now, then update CHECK_URL_RE above to match it.
      if (url && /\/submissions\/detail\//i.test(url)) {
        console.log("[LeetTrack:inject] observed request:", url);
      }

      if (url && CHECK_URL_RE.test(url)) {
        const submissionId = extractSubmissionId(url);
        // Clone so we don't consume the body the page itself needs to read.
        response
          .clone()
          .json()
          .then((data) => {
            if (data && data.state === "SUCCESS") {
              emitVerdict(submissionId, data);
            }
          })
          .catch(() => {
            /* not JSON or already consumed - ignore */
          });
      }
    } catch (e) {
      /* never let our instrumentation break the page's real fetch */
    }

    return response;
  };

  // --- Patch XMLHttpRequest (LeetCode has used both over time) ----------
  const OriginalXHR = window.XMLHttpRequest;
  const originalOpen = OriginalXHR.prototype.open;
  const originalSend = OriginalXHR.prototype.send;

  OriginalXHR.prototype.open = function (method, url, ...rest) {
    this.__leettrack_url = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  OriginalXHR.prototype.send = function (...args) {
    if (this.__leettrack_url && CHECK_URL_RE.test(this.__leettrack_url)) {
      this.addEventListener("load", function () {
        try {
          const data = JSON.parse(this.responseText);
          if (data && data.state === "SUCCESS") {
            const submissionId = extractSubmissionId(this.__leettrack_url);
            emitVerdict(submissionId, data);
          }
        } catch (e) {
          /* ignore parse failures */
        }
      });
    }
    return originalSend.apply(this, args);
  };
})();
