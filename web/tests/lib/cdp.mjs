// Shared Chrome DevTools Protocol helpers for the Tessli browser tests.
//
// Every *-browser.mjs test imports these instead of redefining them, so a fix
// lands in all nine tests at once. The file name deliberately does NOT match
// web/tests/*-browser.mjs, because CI runs every file matching that glob as a
// test and this module is not a test.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

export const ENDPOINT = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";

export async function delay(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function findPageTarget(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${ENDPOINT}/json/list`);
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

export const TRANSIENT_NAVIGATION_ERROR =
  /Inspected target navigated or closed|Execution context was destroyed|Cannot find context with specified id|Cannot find default execution context|Promise was collected/;

export function connect(endpoint = ENDPOINT) {
  const pending = new Map();
  let messageId = 0;
  let lastTransientError = null;

  const socket = new WebSocket(endpoint);
  const opened = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });

  async function send(method, params = {}) {
    await opened;
    const id = ++messageId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
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
      throw new Error(response.exceptionDetails.text);
    }
    return response.result.value;
  }

  async function evaluateSettled(expression) {
    try {
      return await evaluate(expression);
    } catch (error) {
      if (TRANSIENT_NAVIGATION_ERROR.test(error.message)) {
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

  async function markDocumentStale() {
    await waitFor("window.__tessliStale = true", "stale-document marker");
  }

  async function navigate(pathname, origin, readyExpression) {
    await markDocumentStale();
    await send("Page.navigate", { url: `${origin}${pathname}` });
    await waitFor(
      readyExpression ??
        `!window.__tessliStale && document.readyState === "complete" && Boolean(document.querySelector('[data-browse-view]'))`,
      pathname,
    );
  }

  async function screenshot(filename, fullPage = true) {
    const image = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: fullPage,
    });
    return image;
  }

  async function pressKey({ code, key, modifiers = 0, virtualKeyCode }) {
    const params = {
      code,
      key,
      modifiers,
      nativeVirtualKeyCode: virtualKeyCode,
      windowsVirtualKeyCode: virtualKeyCode,
    };
    await send("Input.dispatchKeyEvent", { ...params, type: "keyDown" });
    await send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
  }

  return {
    send,
    evaluate,
    evaluateSettled,
    waitFor,
    markDocumentStale,
    navigate,
    screenshot,
    pressKey,
    socket,
    lastTransientError: () => lastTransientError,
  };
}

export async function saveArtifact(filename, content, directory) {
  await mkdir(directory, { recursive: true });
  await writeFile(new URL(filename, directory), content);
}