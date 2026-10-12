/**
 * Shared Chrome DevTools Protocol plumbing for the `*-browser.mjs` tests.
 *
 * Every browser test used to carry its own copy of these helpers, so a fix
 * to one copy never reached the others. File-specific helpers with genuinely
 * different behavior (per-page `navigate` readiness, `setViewport`,
 * `screenshot`, `pressKey`) stay in their files; everything here is
 * byte-for-byte the common core, modulo documented normalizations:
 * - `waitFor` polls every 75ms in all files (was 50ms in some; deadlines
 *   unchanged, so only the poll cadence differs).
 * - `evaluate` uses the richest error detail (description ?? text ??
 *   default); same behavior on success paths.
 */

export async function delay(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function findPageTarget(endpoint) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${endpoint}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // Chrome may still be starting.
    }
    await delay(100);
  }
  throw new Error("Chrome DevTools endpoint did not become ready.");
}

// Polling right after Page.navigate can land on the document swap, which CDP
// rejects with a transient error. Treat that as "not ready yet"; the waitFor
// deadline still bounds the wait, and its timeout reports the last such error.
const transientNavigationError =
  /Inspected target navigated or closed|Execution context was destroyed|Cannot find context with specified id|Cannot find default execution context|Promise was collected/;

/**
 * Open a CDP session. `onEvent`, when given, observes every incoming message
 * (e.g. global-navigation's load/console collectors) without touching the
 * request/response plumbing. A throwing observer is isolated so it can never
 * break message dispatch. Transient-error state lives in the session
 * closure, so concurrent sessions never share it.
 */
export async function createSession(webSocketDebuggerUrl, { onEvent } = {}) {
  const pending = new Map();
  let messageId = 0;
  let lastTransientError = null;
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (onEvent) {
      try {
        onEvent(message);
      } catch {
        // Observer bugs must not break request/response dispatch.
      }
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });

  function send(method, params = {}) {
    const id = ++messageId;
    return new Promise((resolve, reject) => {
      pending.set(id, { reject, resolve });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const response = await send("Runtime.evaluate", {
      awaitPromise: true,
      expression,
      returnByValue: true,
    });
    if (response.exceptionDetails) {
      throw new Error(
        response.exceptionDetails.exception?.description ??
          response.exceptionDetails.text ??
          "Browser evaluation failed.",
      );
    }
    return response.result.value;
  }

  async function evaluateSettled(expression) {
    try {
      return await evaluate(expression);
    } catch (error) {
      if (transientNavigationError.test(error.message)) {
        lastTransientError = error.message;
        return false;
      }
      throw error;
    }
  }

  async function waitFor(expression, label, timeout = 10_000) {
    const deadline = Date.now() + timeout;
    lastTransientError = null;
    while (Date.now() < deadline) {
      if (await evaluateSettled(expression)) return;
      await delay(75);
    }
    throw new Error(
      `Timed out waiting for ${label}.${lastTransientError ? ` Last transient CDP error: ${lastTransientError}` : ""}`,
    );
  }

  // Page.navigate returns before the old document is gone, so a readiness check
  // could pass against it. Mark the current document first; readiness checks
  // then require !window.__tessliStale, which only a new document satisfies.
  async function markDocumentStale() {
    await waitFor("window.__tessliStale = true", "stale-document marker");
  }

  return {
    socket,
    send,
    evaluate,
    evaluateSettled,
    waitFor,
    markDocumentStale,
  };
}
