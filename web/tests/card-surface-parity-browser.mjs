// Release smoke test: runtime HTTP contracts plus a route × width browser
// matrix. Uses raw Chrome DevTools Protocol against $CDP_ENDPOINT, like the
// other *-browser.mjs tests, so it needs no browser-automation dependency.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { connect, delay } from "./lib/cdp.mjs";

const ENDPOINT = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const ORIGIN = process.env.TESSLI_ORIGIN ?? "http://127.0.0.1:3000";

const catalogue = JSON.parse(
  await readFile(new URL("../data/catalogue.json", import.meta.url), "utf8"),
);
const resource = catalogue.resources.find(
  (candidate) => candidate.slug === "motion",
);

assert.ok(
  resource,
  "The Motion fixture must remain in the canonical catalogue.",
);

const profilePath = `/resources/${resource.slug}`;
const collectionPath = "/collections/motion-starter-pack";

const {
  send,
  evaluate,
  evaluateSettled,
  waitFor: cdpWaitFor,
  markDocumentStale,
  navigate,
  pressKey,
  socket,
} = await connect(ENDPOINT);

function cardSelector() {
  return `[data-resource-card][data-resource-slug=${JSON.stringify(resource.slug)}]`;
}

const cardReadyExpression = `!window.__tessliStale && document.readyState === "complete" && Boolean(document.querySelector(${JSON.stringify(cardSelector())}))`;

async function setViewport(width) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: width <= 390 ? 844 : 1000,
    deviceScaleFactor: 1,
    mobile: width <= 390,
  });
}

async function assertCardActions(surface) {
  const audit = await evaluate(`(() => {
    const card = document.querySelector(${JSON.stringify(cardSelector())});
    const links = Array.from(card?.querySelectorAll("a") ?? []);
    const inspect = links.find(
      (link) => link.getAttribute("href") === ${JSON.stringify(profilePath)},
    );
    const visit = card?.querySelector("[data-resource-visit]");

    return {
      inspect: inspect
        ? {
            href: inspect.getAttribute("href"),
            target: inspect.getAttribute("target"),
          }
        : null,
      visit: visit
        ? {
            href: visit.getAttribute("href"),
            rel: visit.getAttribute("rel"),
            target: visit.getAttribute("target"),
          }
        : null,
      saveControls: card?.querySelectorAll("[data-resource-save], button[aria-pressed]").length ?? 0,
    };
  })()`);

  assert.deepEqual(
    audit.inspect,
    { href: profilePath, target: null },
    `${surface} exposes a same-tab internal Tessli profile route.`,
  );
  assert.equal(
    audit.visit?.href,
    resource.url,
    `${surface} keeps Visit pointed at the canonical provider URL.`,
  );
  assert.equal(
    audit.visit?.target,
    "_blank",
    `${surface} keeps Visit independent from internal profile navigation.`,
  );
  assert.equal(
    audit.visit?.rel?.split(/\s+/).includes("noopener"),
    true,
    `${surface} protects Visit with noopener.`,
  );
  assert.equal(
    audit.visit?.rel?.split(/\s+/).includes("noreferrer"),
    true,
    `${surface} protects Visit with noreferrer.`,
  );
  assert.equal(audit.saveControls, 0, `${surface} card has no Save control.`);
}

async function assertNoOverflow(pathname, label) {
  await navigate(pathname, ORIGIN, cardReadyExpression);
  assert.equal(
    await evaluate(
      "document.documentElement.scrollWidth <= document.documentElement.clientWidth",
    ),
    true,
    `${label} does not overflow horizontally.`,
  );
}

await send("Page.enable");
await send("Runtime.enable");
await setViewport(1440);

await navigate("/resources?q=motion", ORIGIN, cardReadyExpression);
await assertCardActions("Browse");

// Inspect is a plain link, so the click swaps documents like Page.navigate.
await markDocumentStale();
await evaluate(
  `document.querySelector(${JSON.stringify(`${cardSelector()} a[href=${JSON.stringify(profilePath)}]`)})?.click(); true`,
);
await cdpWaitFor(
  `!window.__tessliStale && window.location.pathname === ${JSON.stringify(profilePath)}`,
  "Browse Inspect navigation",
);
await navigate("/resources?q=motion", ORIGIN, cardReadyExpression);

await navigate(collectionPath, ORIGIN, cardReadyExpression);
await assertCardActions("Collection detail");

for (const width of [1440, 390, 320]) {
  await setViewport(width);
  await assertNoOverflow("/resources?q=motion", `Browse at ${width}px`);
  await assertNoOverflow(collectionPath, `Collection detail at ${width}px`);
}

socket.close();
console.log("Resource-card parity across Browse and Collections passed.");
