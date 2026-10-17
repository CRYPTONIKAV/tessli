// Resource card: hover, selection, overflow, independent-action, media fallback.
import assert from "node:assert/strict";
import { connect, delay } from "./lib/cdp.mjs";

const ENDPOINT = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const browseUrl =
  process.env.TESSLI_BROWSE_URL ?? "http://127.0.0.1:3000/resources";
const firstCard = "[data-browse-view=cards] [data-resource-card]";

const {
  send,
  evaluate,
  evaluateSettled,
  waitFor: cdpWaitFor,
  markDocumentStale,
  navigate,
  socket,
} = await connect(ENDPOINT);

async function pageTargets() {
  const response = await fetch(`${ENDPOINT}/json/list`);
  const targets = await response.json();
  return targets.filter((target) => target.type === "page");
}

async function findPageTarget() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const page = (await pageTargets())[0];
      if (page?.webSocketDebuggerUrl) {
        return page;
      }
    } catch {
      // Chrome may still be starting.
    }
    await delay(100);
  }
  throw new Error("Chrome DevTools endpoint did not become ready.");
}

async function revealFirstCard() {
  await evaluate(`(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.querySelector('${firstCard}')?.scrollIntoView({
      block: 'center',
    });
  })()`);
  await delay(100);
}

async function hoverFirstCard() {
  const point = await evaluate(`(() => {
    const card = document.querySelector('${firstCard}');
    const rect = card.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  })()`);

  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
  });
}

const transientNavigationError =
  /Inspected target navigated or closed|Execution context was destroyed|Cannot find context with specified id|Cannot find default execution context|Promise was collected/;
let lastTransientError = null;

async function evaluateSettledLocal(expression) {
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

async function waitForLocal(expression, label, timeout = 7_500) {
  const deadline = Date.now() + timeout;
  lastTransientError = null;
  while (Date.now() < deadline) {
    if (await evaluateSettledLocal(expression)) {
      return;
    }
    await delay(50);
  }
  throw new Error(
    `Timed out waiting for ${label}.${lastTransientError ? ` Last transient CDP error: ${lastTransientError}` : ""}`,
  );
}

async function markDocumentStaleLocal() {
  await waitForLocal("window.__tessliStale = true", "stale-document marker");
}

await send("Page.enable");
await send("Runtime.enable");
await markDocumentStaleLocal();
await send("Page.navigate", { url: browseUrl });
await cdpWaitFor(
  `!window.__tessliStale && document.readyState === "complete" && document.querySelectorAll("${firstCard}").length > 0`,
  "profile-linked Browse cards",
);

await revealFirstCard();
await hoverFirstCard();
await waitForLocal(
  `getComputedStyle(document.querySelector("${firstCard}")).transform !== "none"`,
  "the card hover lift",
);
await waitForLocal(
  `getComputedStyle(document.querySelector("${firstCard}"), "::before").backgroundSize.includes("100% 1px")`,
  "the card hover border trace",
);

assert.equal(
  await evaluate(`(() => {
    const paragraph = Array.from(
      document.querySelectorAll('${firstCard} p'),
    ).find((candidate) => candidate.textContent.trim().length > 20);
    if (!paragraph) return false;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    selection.removeAllRanges();
    selection.addRange(range);
    const selected = selection.toString().trim().length > 20;
    selection.removeAllRanges();
    return selected;
  })()`),
  true,
  "Card text should remain selectable.",
);

assert.equal(
  await evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
  true,
  "Browse cards must not overflow horizontally.",
);

assert.equal(
  await evaluate(`(() => {
    const cards = Array.from(
      document.querySelectorAll('[data-browse-view=cards] [data-resource-card]'),
    );
    return cards.every((card) => {
      const inspect = card.querySelector('a[data-resource-inspect]');
      const primary = card.querySelector(':scope > a[data-resource-profile-link]');
      const save = card.querySelector('button[data-resource-save], button[aria-pressed]');
      const visit = card.querySelector('a[data-resource-visit]');
      const archived = card.getAttribute('data-resource-status') === 'archived';
      const independentActions = archived
        ? !visit && /Archived/.test(card.textContent)
        : visit?.getAttribute('target') === '_blank' &&
          visit?.getAttribute('rel') === 'noopener noreferrer';
      return Boolean(
        inspect &&
          primary?.getAttribute('href')?.startsWith('/resources/') &&
          !primary.hasAttribute('target') &&
          !save &&
          independentActions &&
          !card.querySelector('a a, a button, button a, button button'),
      );
    });
  })()`),
  true,
  "Every profile-linked Browse card should keep Inspect and Visit as independent controls, with no Save control.",
);

assert.equal(
  await evaluate(`(() => {
    const inspect = document.querySelector('[data-browse-view=cards] a[data-resource-inspect]');
    inspect?.focus();
    return document.activeElement === inspect && inspect.closest('[data-resource-card]')?.matches(':focus-within');
  })()`),
  true,
  "The explicit Inspect action should be keyboard-focusable.",
);

const mediaOrder = ["preview", "favicon", "generated"];
const mediaCardIndex = await evaluate(`(() => {
  const cards = Array.from(
    document.querySelectorAll('[data-browse-view=cards] [data-resource-card]'),
  );
  return cards.findIndex(
    (card) => card.getAttribute('data-media-state') !== 'generated' && card.querySelector('img'),
  );
})()`);
assert.notEqual(
  mediaCardIndex,
  -1,
  "At least one Browse card should render preview or favicon media.",
);
const mediaCard = `document.querySelectorAll('[data-browse-view=cards] [data-resource-card]')[${mediaCardIndex}]`;
const observedStates = [
  await evaluate(`${mediaCard}.getAttribute('data-media-state')`),
];

while (observedStates.at(-1) !== "generated") {
  const previous = observedStates.at(-1);
  await evaluate(
    `${mediaCard}.querySelector('img')?.dispatchEvent(new Event('error'))`,
  );
  await waitForLocal(
    `${mediaCard}.getAttribute('data-media-state') !== '${previous}'`,
    `the media fallback to advance past ${previous}`,
  );
  observedStates.push(
    await evaluate(`${mediaCard}.getAttribute('data-media-state')`),
  );
}

assert.deepEqual(
  observedStates,
  mediaOrder.filter((state) => observedStates.includes(state)),
  "Card media should fall back in preview, favicon, generated-mark order.",
);
assert.equal(
  await evaluate(`(() => {
    const card = ${mediaCard};
    const mark = card.querySelector(':scope > a span[aria-hidden="true"]');
    return !card.querySelector('img') && /^[A-Z0-9]$/.test(mark?.textContent?.trim() ?? '');
  })()`),
  true,
  "A card whose media all fails should render the generated mark without an image.",
);

socket.close();
console.log(
  "Resource card hover, selection, overflow, independent-action, and media-fallback checks passed.",
);
