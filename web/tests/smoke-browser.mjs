// Release smoke test: runtime HTTP contracts plus a route × width browser
// matrix. Uses raw Chrome DevTools Protocol against $CDP_ENDPOINT, like the
// other *-browser.mjs tests, so it needs no browser-automation dependency.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { connect, delay } from "./lib/cdp.mjs";

const endpoint = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const origin = process.env.TESSLI_ORIGIN ?? "http://127.0.0.1:3000";
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
      "npx shadcn@latest add online-scope-lab/tessli/rules",
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
  { name: "collections", path: "/collections", text: "Guided research paths" },
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
  { name: "about", path: "/about", text: "Keep reading" },
  { name: "privacy", path: "/privacy", text: "Keep reading" },
  { name: "terms", path: "/terms", text: "Keep reading" },
  {
    name: "content-policy",
    path: "/content-policy",
    text: "Keep reading",
  },
  {
    name: "contribute",
    path: "/contribute",
    text: "Contribute on GitHub.",
    markers: [
      "https://github.com/Online-Scope-Lab/tessli/issues/new?template=suggest-source.yml",
      "https://github.com/Online-Scope-Lab/tessli/issues/new?template=submit-design.yml",
      "https://github.com/Online-Scope-Lab/tessli/issues/new?template=report-source.yml",
      "https://github.com/Online-Scope-Lab/tessli/issues/new?template=bug.yml",
      "https://github.com/Online-Scope-Lab/tessli/blob/main/CONTRIBUTING.md#contribute-an-item",
      "https://github.com/Online-Scope-Lab/tessli/tree/main/web/registry/_template",
      "https://github.com/Online-Scope-Lab/tessli/contribute",
    ],
  },
  { name: "lab", path: "/lab", text: "Design system" },
  {
    name: "not-found",
    path: "/a-clearly-missing-route",
    status: 404,
    text: "Page not found",
  },
];

// Routes checked over HTTP only: the rest of the published collections, the
// remaining public pages, and removed or unknown routes that must stay 404.
const extraRouteChecks = [
  ["/collections/typography-font-tools", 200, "Typography and font tools"],
  ["/collections/motion-starter-pack", 200, "Motion starter pack"],
  ["/collections/open-source-ui-libraries", 200, "Open-source UI libraries"],
  [
    "/collections/design-systems-worth-studying",
    200,
    "Design systems worth studying",
  ],
  ["/resources/land-book", 200, "How to access it"],
  // Archived by the v1.2 triage: the page stays, with its notice.
  ["/resources/designindex", 200, "data-source-archived"],
  ["/curation", 200, "Keep reading"],
  ["/auth", 404, "Page not found"],
  ["/saved", 404, "Page not found"],
  ["/boards", 404, "Page not found"],
  ["/collections/not-a-real-collection", 404, "Page not found"],
  ["/library/faq", 200, "FAQ that answers real objections"],
  ["/library/empty-state", 200, "Empty state that says why and what next"],
  ["/library?kind=section", 200, "Showing 6 of 12 items."],
  ["/library/data-table", 200, "Data table with filters and states"],
  ["/library/not-a-real-item", 404, "Page not found"],
  ["/rules/H-01", 200, "One primary action per surface"],
  ["/rules/H-03", 200, "No library item applies this rule yet"],
  ["/rules/TESSLI.md", 200, "# Tessli UI rules"],
  ["/rules/Z-99", 404, "Page not found"],
  // Bare previews: the item only, no site header.
  ["/preview/faq", 200, 'data-theme="tessli"'],
  ["/preview/faq?theme=dark", 200, 'data-theme="dark"'],
  ["/preview/empty-state?state=error", 200, 'data-preview-state="error"'],
  ["/preview/faq?theme=sepia", 404, "Page not found"],
  ["/preview/empty-state?state=nope", 404, "Page not found"],
  ["/preview/not-a-real-item", 404, "Page not found"],
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

// --- HTTP contracts -------------------------------------------------------

for (const { path, status = 200, text, markers = [] } of pages) {
  const response = await fetch(`${origin}${path}`);
  const body = await response.text();
  assert.equal(response.status, status, `${path} status`);
  assert.match(body, new RegExp(escapeRegExp(text), "i"), `${path} content`);
  for (const marker of markers) {
    assert.ok(body.includes(marker), `${path} server HTML has ${marker}`);
  }
}

for (const [path, status, text] of extraRouteChecks) {
  const response = await fetch(`${origin}${path}`);
  const body = await response.text();
  assert.equal(response.status, status, `${path} status`);
  assert.match(body, new RegExp(escapeRegExp(text), "i"), `${path} content`);
}

// /contribute replaced /submit and /suggest: both answer a permanent 308.
for (const path of ["/submit", "/suggest"]) {
  const response = await fetch(`${origin}${path}`, { redirect: "manual" });
  assert.equal(response.status, 308, `${path} redirects permanently`);
  assert.equal(
    new URL(response.headers.get("location") ?? "", origin).pathname,
    "/contribute",
    `${path} redirects to /contribute`,
  );
}

for (const path of ["/preview/faq", "/preview/pricing-tiers?theme=neutral"]) {
  const body = await (await fetch(`${origin}${path}`)).text();
  // The rendered markup only: the RSC payload in <script> also carries the
  // root not-found boundary, which has the site chrome.
  const markup = body.replace(/<script[\s\S]*?<\/script>/g, "");
  assert.doesNotMatch(
    markup,
    /<header|<footer|Skip to content/,
    `${path} is bare`,
  );
  assert.match(markup, /<meta name="robots" content="noindex, nofollow"/, path);
}

async function assertOptionalDiscoveryMethod(path, method) {
  const response = await fetch(`${origin}${path}`, { method });
  if (response.status === 405) return;

  const allowed = response.headers.get("allow") ?? "";
  assert.ok(
    allowed.includes(method) || allowed.includes("*"),
    `${path} allows ${method}`,
  );
}

for (const path of ["/api/search", "/api/library"]) {
  await assertOptionalDiscoveryMethod(path, "GET");
  await assertOptionalDiscoveryMethod(path, "HEAD");
}

// --- Browser matrix -------------------------------------------------------

const pending = new Map();
let messageId = 0;
let currentPage = null;
const browserErrors = [];

const {
  send,
  evaluate,
  evaluateSettled,
  waitFor: cdpWaitFor,
  markDocumentStale,
  navigate,
  socket,
} = await connect(endpoint);

// Record CDP exceptions and console errors so the suite can assert the page
// stayed clean.
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") {
    const details = message.params.exceptionDetails;
    recordError(details.exception?.description ?? details.text);
  }
  if (
    message.method === "Runtime.consoleAPICalled" &&
    message.params.type === "error"
  ) {
    recordError(
      message.params.args
        .map(
          (argument) =>
            argument.value ?? argument.description ?? "console error",
        )
        .join(" "),
    );
  }
  if (
    message.method === "Log.entryAdded" &&
    message.params.entry.level === "error"
  ) {
    const { entry } = message.params;
    // Two network errors are expected and ignored: the intentional 404 page's
    // own document response, and third-party source media (previews and
    // favicons hosted by the sources), which the media fallback chain covers
    // and which CI cannot keep reachable. Any same-origin network error, and
    // every non-network error, fails the run.
    const expectedNotFound =
      currentPage?.page.status === 404 &&
      entry.url === `${origin}${currentPage.page.path}`;
    const thirdParty =
      typeof entry.url === "string" &&
      /^https?:/u.test(entry.url) &&
      new URL(entry.url).origin !== new URL(origin).origin;
    const ignored =
      entry.source === "network" && (expectedNotFound || thirdParty);
    if (!ignored) recordError(`${entry.text} ${entry.url ?? ""}`);
  }
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});

function recordError(text) {
  const where = currentPage
    ? `${currentPage.page.path} @${currentPage.width}`
    : "setup";
  browserErrors.push(`${where}: ${text}`);
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

async function waitForLocal(expression, label, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  lastTransientError = null;
  while (Date.now() < deadline) {
    if (await evaluateSettledLocal(expression)) return;
    await delay(75);
  }
  throw new Error(
    `Timed out waiting for ${label}.${lastTransientError ? ` Last transient CDP error: ${lastTransientError}` : ""}`,
  );
}

async function markDocumentStaleLocal() {
  await waitForLocal("window.__tessliStale = true", "stale-document marker");
}

await mkdir(outputDirectory, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");

for (const { width, height, screenshot: capture = false } of widths) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 430,
  });

  for (const page of pages) {
    const label = `${page.path} at ${width}`;
    currentPage = { page, width };
    await markDocumentStaleLocal();
    await send("Page.navigate", { url: `${origin}${page.path}` });
    await cdpWaitFor(
      "!window.__tessliStale && document.readyState === 'complete'",
      `${label} document`,
      15_000,
    );
    await cdpWaitFor("document.fonts.status === 'loaded'", `${label} fonts`, 15_000);
    // Let hydration and effects run so their errors are attributed here.
    await delay(400);

    const audit = await evaluate(`(() => {
      const root = document.documentElement;
      const header = document.querySelector('body > header');
      return {
        mains: document.querySelectorAll('main').length,
        h1s: document.querySelectorAll('h1').length,
        headerNav: Boolean(header?.querySelector('nav a[href]')),
        footer: Boolean(document.querySelector('[data-site-content] > footer')),
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
        title: document.title,
      };
    })()`);
    assert.equal(audit.mains, 1, `${label}: one <main> landmark`);
    assert.equal(audit.h1s, 1, `${label}: exactly one <h1>`);
    assert.equal(audit.headerNav, true, `${label}: header navigation`);
    assert.equal(audit.footer, true, `${label}: site footer`);
    assert.ok(
      audit.scrollWidth <= audit.clientWidth,
      `${label}: horizontal overflow (${audit.scrollWidth} > ${audit.clientWidth})`,
    );
    assert.ok(audit.title.length > 0, `${label}: document title`);

    if (!capture) continue;
    const metrics = await send("Page.getLayoutMetrics");
    const fullHeight = Math.min(
      Math.ceil(metrics.cssContentSize.height),
      16_000,
    );
    const screenshot = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: fullHeight, scale: 1 },
    });
    await writeFile(
      new URL(`${page.name}-${width}.png`, outputDirectory),
      Buffer.from(screenshot.data, "base64"),
    );
  }
}

currentPage = null;
socket.close();
assert.deepEqual(
  browserErrors,
  [],
  `Browser errors:\n${browserErrors.join("\n")}`,
);
console.log(
  `Smoke test passed: ${pages.length} pages audited at ${widths.map(({ width }) => width).join(", ")}px (screenshots at ${widths
    .filter(({ screenshot }) => screenshot)
    .map(({ width }) => width)
    .join(" and ")}px), plus HTTP contracts.`,
);
