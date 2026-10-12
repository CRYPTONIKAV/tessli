// Release smoke test: runtime HTTP contracts plus a route × width browser
// matrix. Uses raw Chrome DevTools Protocol against $CDP_ENDPOINT, like the
// other *-browser.mjs tests, so it needs no browser-automation dependency.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createSession, delay, findPageTarget } from "./lib/cdp.mjs";

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
      "npx shadcn@latest add online-scope-lab/tessli/rules",
      "item.json",
      "profile.json",
      "What Tessli does not claim.",
    ],
  },
  {
    name: "library",
    path: "/library",
    text: "UI with the reasoning attached.",
    markers: ["data-library-grid", 'data-library-item="pricing-tiers"'],
  },
  {
    name: "library-item",
    path: "/library/pricing-tiers",
    text: "Common AI default vs. this",
    markers: [
      "data-preview-workbench",
      "npx shadcn@latest add online-scope-lab/tessli/pricing-tiers",
      "Community — not yet reviewed by a maintainer",
      'href="/rules/H-01"',
    ],
  },
  {
    name: "rules",
    path: "/rules",
    text: "Rules for structure, not style.",
    markers: [
      "data-rules-status",
      'data-rule="ST-02"',
      "npx shadcn@latest add online-scope-lab/tessli/rules",
      'href="/rules/TESSLI.md"',
    ],
  },
  {
    name: "rule",
    path: "/rules/ST-02",
    text: "Empty states differ by cause",
    markers: [
      "data-rule-check",
      "Draft — not yet reviewed by a maintainer",
      'href="/library/empty-state"',
    ],
  },
  { name: "about", path: "/about", text: "Keep reading" },
  { name: "privacy", path: "/privacy", text: "Keep reading" },
  { name: "terms", path: "/terms", text: "Keep reading" },
  { name: "content-policy", path: "/content-policy", text: "Keep reading" },
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
  ["/collections/accessible-colour-tools", 200, "Accessible colour tools"],
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

  assert.equal(
    response.status,
    method === "OPTIONS" ? 204 : 200,
    `${path} ${method} status`,
  );
  if (method === "HEAD") {
    assert.equal(await response.text(), "", `${path} HEAD body is empty`);
    assert.match(
      response.headers.get("content-type") ?? "",
      /^text\/plain/i,
      `${path} HEAD content type`,
    );
  }
  if (method === "OPTIONS") {
    assert.match(
      response.headers.get("allow") ?? "",
      /GET/i,
      `${path} OPTIONS allows GET`,
    );
  }
}

const robotsResponse = await fetch(`${origin}/robots.txt`);
const robots = await robotsResponse.text();
assert.equal(robotsResponse.status, 200, "/robots.txt status");
assert.match(
  robotsResponse.headers.get("content-type") ?? "",
  /^text\/plain/i,
  "/robots.txt content type",
);
assert.match(
  robots,
  /^Sitemap:\s*.+\/sitemap\.xml\s*$/imu,
  "/robots.txt sitemap",
);
for (const pathname of ["/lab/", "/preview/"]) {
  assert.match(
    robots,
    new RegExp(`^Disallow:\\s*${escapeRegExp(pathname)}\\s*$`, "imu"),
    `/robots.txt disallows ${pathname}`,
  );
}
await assertOptionalDiscoveryMethod("/robots.txt", "HEAD");
await assertOptionalDiscoveryMethod("/robots.txt", "OPTIONS");

const llmsResponse = await fetch(`${origin}/llms.txt`);
const llms = await llmsResponse.text();
assert.equal(llmsResponse.status, 200, "/llms.txt status");
assert.match(
  llmsResponse.headers.get("content-type") ?? "",
  /^text\/plain/i,
  "/llms.txt content type",
);
for (const fragment of [
  "/library",
  "/library/<slug>/item.json",
  "/rules/TESSLI.md",
  "npx shadcn@latest add online-scope-lab/tessli/<slug>",
  "npx shadcn@latest add online-scope-lab/tessli/rules",
  "[Pricing tiers compared on the limits that matter](/library/pricing-tiers)",
  "search_items, get_item, get_rules, find_sources, get_source",
  "skills/tessli/SKILL.md",
  "/resources",
  "/collections",
  "/resources/landingfolio/profile.json",
  "/resources/landingfolio/profile.md",
  "/collections/saas-landing-pages/collection.json",
  "/collections/saas-landing-pages/collection.md",
  "/contribute",
  "https://github.com/Online-Scope-Lab/tessli/issues/new?template=suggest-source.yml",
  "https://github.com/Online-Scope-Lab/tessli/issues/new?template=submit-design.yml",
  "https://github.com/Online-Scope-Lab/tessli/blob/main/CONTRIBUTING.md#contribute-an-item",
]) {
  assert.match(
    llms,
    new RegExp(escapeRegExp(fragment)),
    `/llms.txt ${fragment}`,
  );
}
assert.match(llms, /local\s+MCP/i, "/llms.txt local MCP boundary");
// Counts come from the data: no literal template or placeholder survives.
assert.match(
  llms,
  /^Today: \d+ library items \(\d+ reviewed by a maintainer\), \d+ rules in \d+ areas/mu,
  "/llms.txt counts",
);
assert.doesNotMatch(llms, /\$\{|undefined|NaN/u, "/llms.txt fully rendered");
assert.match(
  llms,
  /No accounts:[\s\S]{0,80}no sign-in/i,
  "/llms.txt account boundary",
);
assert.doesNotMatch(
  llms,
  /\bBoards?\b|\bSaved\b|\/saved|\/boards/u,
  "/llms.txt no Saved or Boards",
);
assert.match(
  llms,
  /no hosted(?: or remote)? MCP endpoint/i,
  "/llms.txt hosted MCP boundary",
);
for (const boundary of ["bulk", "credential", "crawl", "universal", "taste"]) {
  assert.match(
    llms,
    new RegExp(`(?:no|not)\\b[\\s\\S]{0,80}\\b${boundary}\\b`, "i"),
    `/llms.txt ${boundary} boundary`,
  );
}
await assertOptionalDiscoveryMethod("/llms.txt", "HEAD");
await assertOptionalDiscoveryMethod("/llms.txt", "OPTIONS");

const machineRouteChecks = [
  {
    path: "/resources/designindex/profile.json",
    contentType: "application/json",
    kind: "source",
  },
  {
    path: "/resources/designindex/profile.md",
    contentType: "text/markdown",
    headings: [
      "# Tessli Source Guide — DesignIndex",
      "**Archived:** Off-scope",
      "## Use it when",
      "## What to explore",
      "## How to access",
      "## Important limitations",
      "## Consider instead",
    ],
  },
  {
    path: "/library/pricing-tiers/item.json",
    contentType: "application/json",
    kind: "library-item",
  },
  {
    path: "/library/pricing-tiers/item.md",
    contentType: "text/markdown",
    headings: [
      "# Tessli library item — Pricing tiers compared on the limits that matter",
      "## Install",
      "npx shadcn@latest add online-scope-lab/tessli/pricing-tiers",
      "## Common AI default",
      "## Why this is better",
      "```tsx",
    ],
  },
  {
    path: "/collections/saas-landing-pages/collection.json",
    contentType: "application/json",
    kind: "collection",
  },
  {
    path: "/collections/saas-landing-pages/collection.md",
    contentType: "text/markdown",
    headings: [
      "# Tessli Collection — SaaS landing-page references",
      "## Use this research path",
      "## Staged decisions",
    ],
  },
];

function assertSourcePacket(packet, path) {
  assert.equal(packet.contract, "tessli.public-source.v3", `${path} contract`);
  assert.ok(
    ["active", "needs-review", "archived"].includes(packet.source?.status),
    `${path} status`,
  );
  for (const removed of ["profileLevel", "diagnostics"]) {
    assert.equal(
      Object.hasOwn(packet.source, removed) || Object.hasOwn(packet, removed),
      false,
      `${path} has no ${removed}`,
    );
  }
  assert.equal(typeof packet.source?.purpose, "string", `${path} purpose`);
  assert.ok(packet.source.purpose.length > 0, `${path} purpose copy`);
  for (const field of [
    "useWhen",
    "whatToExplore",
    "accessRoutes",
    "importantLimitations",
    "alternatives",
  ]) {
    assert.ok(Array.isArray(packet.source?.[field]), `${path} ${field}`);
  }
  assert.ok(
    packet.source.accessRoutes.every(
      (route) => typeof route.agentAction === "string" && route.agentAction,
    ),
    `${path} access actions`,
  );
  assert.ok(packet.source.alternatives.length <= 2, `${path} alternatives cap`);
  assert.ok(
    packet.source.alternatives.every(
      (alternative) =>
        typeof alternative.canonicalPath === "string" &&
        typeof alternative.differentiator === "string",
    ),
    `${path} differentiated alternatives`,
  );
}

function assertCollectionPacket(packet, path) {
  assert.equal(
    packet.contract,
    "tessli.public-collection.v2",
    `${path} contract`,
  );
  assert.equal(typeof packet.collection?.outcome, "string", `${path} outcome`);
  assert.ok(Array.isArray(packet.collection?.stages), `${path} stages`);
  assert.equal(
    packet.collection.stages.length,
    packet.collection.stageCount,
    `${path} stage count`,
  );
  assert.ok(
    packet.collection.stages.every(
      (stage, index) =>
        stage.order === index + 1 &&
        Array.isArray(stage.resources) &&
        stage.resources.every(
          (resource) =>
            typeof resource.role === "string" &&
            typeof resource.inspectPrompt === "string" &&
            typeof resource.decisionPrompt === "string" &&
            typeof resource.sourceGuide?.canonicalPath === "string",
        ),
    ),
    `${path} staged action guidance`,
  );
}

for (const check of machineRouteChecks) {
  const response = await fetch(`${origin}${check.path}`);
  const body = await response.text();
  assert.equal(response.status, 200, `${check.path} status`);
  assert.match(
    response.headers.get("content-type") ?? "",
    new RegExp(`^${escapeRegExp(check.contentType)}`),
    `${check.path} content type`,
  );
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "*",
    `${check.path} CORS`,
  );
  assert.equal(
    response.headers.get("x-content-type-options"),
    "nosniff",
    `${check.path} nosniff`,
  );
  assert.match(
    response.headers.get("link") ?? "",
    /rel="canonical"/u,
    `${check.path} canonical link`,
  );
  if (check.kind === "source") assertSourcePacket(JSON.parse(body), check.path);
  else if (check.kind === "collection")
    assertCollectionPacket(JSON.parse(body), check.path);
  else if (check.kind === "library-item") {
    const packet = JSON.parse(body);
    assert.equal(packet.contract, "tessli.public-library-item.v1", check.path);
    assert.equal(packet.item.slug, "pricing-tiers", check.path);
    assert.equal(packet.item.status, "community", check.path);
    assert.match(packet.item.source.code, /export function PricingTiers/);
  } else
    for (const heading of check.headings) {
      assert.match(
        body,
        new RegExp(escapeRegExp(heading), "i"),
        `${check.path} ${heading}`,
      );
    }

  const headResponse = await fetch(`${origin}${check.path}`, {
    method: "HEAD",
  });
  assert.equal(headResponse.status, 200, `${check.path} HEAD status`);
  assert.equal(await headResponse.text(), "", `${check.path} HEAD body`);
  assert.equal(
    headResponse.headers.get("access-control-allow-origin"),
    "*",
    `${check.path} HEAD CORS`,
  );

  const optionsResponse = await fetch(`${origin}${check.path}`, {
    method: "OPTIONS",
  });
  assert.equal(optionsResponse.status, 204, `${check.path} OPTIONS status`);
  assert.equal(
    optionsResponse.headers.get("allow"),
    "GET, HEAD, OPTIONS",
    `${check.path} OPTIONS methods`,
  );
  assert.equal(
    optionsResponse.headers.get("access-control-allow-origin"),
    "*",
    `${check.path} OPTIONS CORS`,
  );
}

for (const path of [
  "/resources/not-a-real-source/profile.json",
  "/collections/not-a-real-collection/collection.json",
  "/library/not-a-real-item/item.json",
]) {
  const response = await fetch(`${origin}${path}`);
  assert.equal(response.status, 404, `${path} remains not found`);
}

// --- Browser matrix -------------------------------------------------------

let currentPage = null;
const browserErrors = [];

function recordError(text) {
  const where = currentPage
    ? `${currentPage.page.path} @${currentPage.width}`
    : "setup";
  browserErrors.push(`${where}: ${text}`);
}

const target = await findPageTarget(endpoint);
const { socket, send, evaluate, evaluateSettled, waitFor, markDocumentStale } =
  await createSession(target.webSocketDebuggerUrl, {
    onEvent(message) {
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
    },
  });

// Polling right after Page.navigate can land on the document swap, which CDP
// rejects with a transient error. Treat that as "not ready yet"; the waitFor
// deadline still bounds the wait, and its timeout reports the last such error.

// Page.navigate returns before the old document is gone, so a readiness check
// could pass against it. Mark the current document first; readiness checks
// then require !window.__tessliStale, which only a new document satisfies.

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
    await markDocumentStale();
    await send("Page.navigate", { url: `${origin}${page.path}` });
    await waitFor(
      "!window.__tessliStale && document.readyState === 'complete'",
      `${label} document`,
    );
    await waitFor("document.fonts.status === 'loaded'", `${label} fonts`);
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
