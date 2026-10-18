import assert from "node:assert/strict";

import catalogue from "../data/catalogue.json" with { type: "json" };
import { createSession, delay, findPageTarget } from "./lib/cdp.mjs";

// The hero facts are derived from the catalogue: non-archived sources and the
// categories that hold at least one of them.
const listedSources = catalogue.resources.filter(
  (resource) => resource.status !== "archived",
);

const endpoint = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const pageUrl = process.env.TESSLI_URL ?? "http://127.0.0.1:3000/";

const page = await findPageTarget(endpoint);
const { socket, send, evaluate, evaluateSettled, waitFor, markDocumentStale } =
  await createSession(page.webSocketDebuggerUrl);

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

async function pressKeyUntil(keyOptions, expression, label) {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    await pressKey(keyOptions);
    if (await evaluate(expression)) {
      return;
    }
    await delay(100);
  }

  throw new Error(`Timed out waiting for ${label}.`);
}

await send("Page.enable");
await send("Runtime.enable");
await markDocumentStale();
await send("Page.navigate", { url: pageUrl });
await waitFor(
  '!window.__tessliStale && document.readyState === "complete" && Boolean(document.querySelector("[data-explore-search-input]"))',
  "the Explore search input",
  5000,
);

await pressKeyUntil(
  {
    code: "KeyK",
    key: "k",
    modifiers: 2,
    virtualKeyCode: 75,
  },
  'document.activeElement?.hasAttribute("data-explore-search-input") === true',
  "Ctrl/Cmd + K focus",
);

await send("Input.insertText", { text: "motion" });
await waitFor(
  'document.querySelector("[data-explore-search-input]")?.value === "motion"',
  "search text entry",
  5000,
);
await waitFor(
  `(() => {
    const input = document.querySelector('[data-explore-search-input]');
    const status = document.getElementById(input?.getAttribute('aria-describedby'));
    return status?.textContent.trim() === 'Search query entered.';
  })()`,
  "the search query announcement",
  5000,
);
assert.equal(
  await evaluate('Boolean(document.querySelector("[data-search-clear]"))'),
  true,
  "A populated query should expose the clear control.",
);

await pressKey({ code: "Escape", key: "Escape", virtualKeyCode: 27 });
await waitFor(
  'document.querySelector("[data-explore-search-input]")?.value === ""',
  "first Escape to clear",
  5000,
);
assert.equal(
  await evaluate(
    'document.activeElement?.hasAttribute("data-explore-search-input") === true',
  ),
  true,
  "The first Escape should preserve input focus.",
);

await pressKey({ code: "Escape", key: "Escape", virtualKeyCode: 27 });
await waitFor(
  'document.activeElement?.hasAttribute("data-explore-search-input") !== true',
  "second Escape to blur",
  5000,
);

await pressKey({ code: "Slash", key: "/", virtualKeyCode: 191 });
await waitFor(
  'document.activeElement?.hasAttribute("data-explore-search-input") === true',
  "slash shortcut focus",
  5000,
);
await send("Input.insertText", { text: "type" });
await waitFor(
  'document.querySelector("[data-explore-search-input]")?.value === "type"',
  "second search text entry",
  5000,
);
await evaluate('document.querySelector("[data-search-clear]")?.click()');
await waitFor(
  'document.querySelector("[data-explore-search-input]")?.value === ""',
  "clear-button behaviour",
  5000,
);
assert.equal(
  await evaluate(
    'document.activeElement?.hasAttribute("data-explore-search-input") === true',
  ),
  true,
  "The clear button should return focus to the input.",
);

const facts = await evaluate(`Array.from(
  document.querySelectorAll('[aria-label="Tessli catalogue facts"] li')
).map((item) => ({
  value: item.querySelector('strong')?.textContent?.trim(),
  label: item.querySelector('strong + span')?.textContent?.trim(),
}))`);

assert.deepEqual(facts, [
  { label: "Curated resources", value: String(listedSources.length) },
  {
    label: "Practical categories",
    value: String(
      new Set(listedSources.map((resource) => resource.category)).size,
    ),
  },
  { label: "Needed to browse", value: "No account" },
  { label: "Community-built project", value: "Open" },
]);

socket.close();
console.log("Explore search browser interaction checks passed.");
