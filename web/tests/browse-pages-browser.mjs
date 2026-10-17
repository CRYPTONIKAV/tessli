// Release smoke test: runtime HTTP contracts plus a route × width browser
// matrix. Uses raw Chrome DevTools Protocol against $CDP_ENDPOINT, like the
// other *-browser.mjs tests, so it needs no browser-automation dependency.
import assert from "node:assert/strict";
import { connect, delay } from "./lib/cdp.mjs";

const ENDPOINT = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const ORIGIN = process.env.TESSLI_ORIGIN ?? "http://127.0.0.1:3000";

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

const outputDirectory = new URL("../artifacts/smoke/", import.meta.url);

// Full-page screenshots are saved at 1440 and 390. Every page also gets the
// same landmark, heading, overflow and console audit at the in-between and
// narrow widths the old release gate covered, without screenshots.
const widths = [
  { width: 1440, height: 900, screenshot: true },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 430, height: 932 },
  { width: 390, height: 844, screenshot: true },
  { width: 360, height: 800 },
];

// Every public page the smoke matrix renders. `status` is the HTTP status the
// server must return; `text` must appear in the server-rendered HTML.
const pages = [
  {
    name: "home",
    path: "/",
    text: "Find better design resources, faster",
    markers: [
      "UI with the reasoning attached.",
      "data-home-featured-item=",
      "data-home-anatomy=",
      'npx shadcn@latest add online-scope-lab/tessli/rules',
      'href="/contribute"',
    ],
  },
  {
    name: "resources",
    path: "/resources",
    text: "What are you trying to design?",
    markers: ['data-browse-view="cards"', "data-resource-inspect="],
  },
  { name: "source", path: "/resources/land-book", text: "How to access it" },
  {
    name: "collections",
    path: "/collections",
    text: "Guided research paths",
  },
  {
    name: "collection",
    path: "/collections/saas-landing-pages",
    text: "SaaS landing-page references",
  },
  {
    name: "for-ai",
    path: "/for-ai",
    text: "Code and reasoning, in the formats agents read.",
    markers: [
      "data-for-ai-install",
      "data-for-ai-workflow",
      'data-for-ai-remote-status="unavailable"',
      'npx shadcn@latest add online-scope-lab/tessli/rules',
    ],
  },
];

const extraRouteChecks = [
  {
    path: "/robots.txt",
    status: 200,
    text: "User-agent: *",
  },
  {
    path: "/sitemap.xml",
    status: 200,
    text: "<urlset",
  },
];

const machineRouteChecks = [
  {
    path: "/resources/land-book",
    status: 200,
    text: "How to access it",
  },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertOptionalDiscoveryMethod(path, method) {
  const discoveryPath = path === "/" ? "/discovery" : `/discovery${path}`;
  return fetch(`${ORIGIN}${discoveryPath}`).then((res) => {
    if (!res.ok) return;
    return res.text().then((body) => {
      const hasMethod = body.includes(method);
      if (!hasMethod) {
        throw new Error(`${discoveryPath} does not advertise ${method}`);
      }
    });
  });
}

const robotsResponse = await fetch(`${ORIGIN}/robots.txt`);
const robots = await robotsResponse.text();

const llmsResponse = await fetch(`${ORIGIN}/llms.txt`);
const llms = await llmsResponse.text();

assert.equal(
  robots.includes("User-agent: *"),
  true,
  "robots.txt allows crawling",
);
assert.equal(
  llms.includes("/llms.txt"),
  true,
  "llms.txt is present",
);

const defaultFilterAudit = await evaluate(`(() => ({
  values: [...document.querySelectorAll('select')].map((select) => select.value),
  labels: [...document.querySelectorAll('select')].map((select) => select.selectedOptions[0]?.textContent.trim()),
}))()`);
assert.deepEqual(defaultFilterAudit.values, ["", "", "", "curated"]);
assert.deepEqual(defaultFilterAudit.labels, [
  "All categories",
  "All access models",
  "All source types",
  "Curated order",
]);
const cardAudit = await evaluate(`(() => ({
  cards: document.querySelectorAll('[data-browse-view=cards] article').length,
  internalLinks: [...document.querySelectorAll('[data-browse-view=cards] article > a')]
    .every((link) => link.getAttribute('href')?.startsWith('/resources/')),
  providerLinks: document.querySelectorAll('[data-browse-view=cards] a[target=_blank][rel="noopener noreferrer"]').length,
  saves: document.querySelectorAll('[data-browse-view=cards] button[aria-pressed]').length,
  nextHref: [...document.querySelectorAll('nav[aria-label="Browse pages"] a')]
    .find((link) => link.textContent.trim() === 'Next')?.getAttribute('href'),
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}))()`);
assert.equal(cardAudit.cards, 24);
assert.equal(cardAudit.internalLinks, true);
assert.ok(cardAudit.providerLinks > 0);
assert.equal(cardAudit.saves, 0);
assert.match(cardAudit.nextHref, /page=2/);
assert.equal(cardAudit.overflow, false);

await navigate("/resources?view=list&profileLevel=profiled&page=2", ORIGIN);
assert.equal(
  await evaluate(
    `document.querySelectorAll('[data-browse-view=cards] article').length`,
  ),
  24,
);
assert.equal(
  await evaluate(
    `document.querySelector('[data-browse-view=cards] a')?.getAttribute('href')?.startsWith('/resources/')`,
  ),
  true,
);

await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});

await navigate("/resources?category=website-inspiration&sort=name-asc", ORIGIN);
const mobileFilterAudit = await evaluate(`(() => ({
  trigger: document.querySelector('[data-browse-filter-trigger]')?.textContent.trim(),
  layer: document.querySelector('[data-browse-filter-layer]')?.getAttribute('data-browse-filter-layer'),
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}))()`);
assert.equal(mobileFilterAudit.trigger, "Filter (2 active)");
assert.equal(mobileFilterAudit.layer, "closed");
assert.equal(mobileFilterAudit.overflow, false);

await evaluate(
  "document.querySelector('[data-browse-filter-trigger]')?.click()",
);
await cdpWaitFor(
  `document.querySelector('[data-browse-filter-layer]')?.getAttribute('data-browse-filter-layer') === 'open'`,
  "mobile Browse filter sheet",
);
await cdpWaitFor(
  "document.querySelector('[data-browse-filter-sheet]')?.contains(document.activeElement)",
  "mobile Browse filter focus",
);
const mobileFilterOpenAudit = await evaluate(`(() => ({
  dialog: document.querySelector('[data-browse-filter-sheet]')?.getAttribute('role'),
  bodyOverflow: document.body.style.overflow,
  focusInside: document.querySelector('[data-browse-filter-sheet]')?.contains(document.activeElement),
  closeSize: (() => {
    const rect = document.querySelector('[aria-label="Close filters"]')?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : null;
  })(),
}))()`);
assert.equal(mobileFilterOpenAudit.dialog, "dialog");
assert.equal(mobileFilterOpenAudit.bodyOverflow, "hidden");
assert.equal(mobileFilterOpenAudit.focusInside, true);
assert.deepEqual(mobileFilterOpenAudit.closeSize, { width: 44, height: 44 });

await pressKey({ code: "Escape", key: "Escape", virtualKeyCode: 27 });
await cdpWaitFor(
  `document.querySelector('[data-browse-filter-layer]')?.getAttribute('data-browse-filter-layer') === 'closed'`,
  "mobile Browse filter close",
);
await cdpWaitFor(
  "document.activeElement?.matches('[data-browse-filter-trigger]')",
  "mobile Browse filter focus restoration",
);

await navigate("/resources?view=table&profileLevel=verified", ORIGIN);
const mobileCardAudit = await evaluate(`(() => ({
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  cards: document.querySelectorAll('[data-browse-view=cards] article').length,
}))()`);
assert.equal(mobileCardAudit.overflow, false);
assert.equal(mobileCardAudit.cards, 24);

for (const [width, height] of [
  [1024, 768],
  [768, 1024],
  [320, 844],
]) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 390,
  });
  await navigate("/resources?q=motion", ORIGIN);
  const responsiveAudit = await evaluate(`(() => ({
    cards: document.querySelectorAll('[data-browse-view=cards] article').length,
    hasHeading: Boolean(document.querySelector('h1')),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }))()`);
  assert.equal(responsiveAudit.cards > 0, true, `Browse cards at ${width}px`);
  assert.equal(
    responsiveAudit.hasHeading,
    true,
    `Browse heading at ${width}px`,
  );
  assert.equal(
    responsiveAudit.overflow,
    false,
    `Browse overflow at ${width}px`,
  );
}

await markDocumentStale();
await send("Page.navigate", { url: `${ORIGIN}/resources?sort=verified` });
await cdpWaitFor(
  `!window.__tessliStale && document.readyState === "complete" && Boolean(document.querySelector('[data-browse-view=cards]'))`,
  "legacy verification sort",
);
assert.equal(
  await evaluate(`new URLSearchParams(window.location.search).get('sort')`),
  "verified",
);
assert.equal(
  await evaluate(`document.querySelector('select[name=sort]')?.value`),
  "curated",
);

await markDocumentStale();
await send("Page.navigate", { url: `${ORIGIN}/resources/designindex` });
await cdpWaitFor(
  `!window.__tessliStale && document.readyState === "complete" && Boolean(document.querySelector('[data-source-detail=designindex]'))`,
  "internal source profile",
);
assert.equal(
  await evaluate(`document.querySelector('h1')?.textContent.trim()`),
  "DesignIndex",
);

socket.close();
console.log("Canonical Browse browser checks passed.");
