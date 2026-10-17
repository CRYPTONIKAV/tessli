// Home page: hero, featured items, anatomy, sources, contribute, For AI.
import assert from "node:assert/strict";
import { connect } from "./lib/cdp.mjs";

const ENDPOINT = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const ORIGIN = process.env.TESSLI_ORIGIN ?? "http://127.0.0.1:3000";

const {
  send,
  evaluate,
  evaluateSettled,
  waitFor: cdpWaitFor,
  markDocumentStale,
  navigate,
  socket,
} = await connect(ENDPOINT);

async function delay(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function auditHome(width, height) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 430,
  });
  await markDocumentStale();
  await navigate("/", ORIGIN);
  await cdpWaitFor(
    `!window.__tessliStale && document.readyState === "complete" && Boolean(document.querySelector('[data-home-sections]'))`,
    `Home sections at ${width}`,
  );

  return evaluate(`(() => {
    const sections = document.querySelector('[data-home-sections]');
    const featured = Array.from(sections.querySelectorAll('[data-home-featured-item]'));
    const frames = featured.map((card) => card.querySelector('[data-preview-thumbnail]'));
    return {
      heroTitle: document.querySelector('#explore-hero-title')?.textContent,
      heroArtwork: document.querySelector('img[src*="tessli-hero-geometry.webp"]')?.getAttribute('src'),
      searchAction: document.querySelector('form[aria-label="Search Tessli resources"]')?.getAttribute('action'),
      searchName: document.querySelector('[data-explore-search-input]')?.getAttribute('name'),
      h2s: Array.from(sections.querySelectorAll('h2')).map((h) => h.textContent.trim()),
      featured: featured.map((card) => card.getAttribute('data-home-featured-item')),
      featuredLinks: featured.map((card) => card.querySelector('h3 a')?.getAttribute('href')),
      thumbnailsInert: frames.every((frame) => frame?.inert === true),
      thumbnailRatios: frames.map((frame) => {
        const box = frame.getBoundingClientRect();
        return Math.round((box.width / box.height) * 100) / 100;
      }),
      lazyFrames: Array.from(sections.querySelectorAll('[data-preview-thumbnail] iframe')).every(
        (frame) => frame.getAttribute('loading') === 'lazy' && frame.getAttribute('src').startsWith('/preview/'),
      ),
      anatomyRules: sections.querySelectorAll('[data-home-anatomy-rules] a[href^="/rules/"]').length,
      anatomyDefault: sections.querySelector('[data-home-anatomy-default] p')?.textContent.length ?? 0,
      commands: Array.from(sections.querySelectorAll('[data-home-for-ai] [data-install-command]')).map((c) => c.textContent),
      forAiHref: sections.querySelector('[data-home-for-ai] a[href="/for-ai"]')?.getAttribute('href'),
      sourcesLinks: Array.from(sections.querySelectorAll('[data-home-sources] a')).map((a) => a.getAttribute('href')),
      sourcesCopy: sections.querySelector('[data-home-sources] p')?.textContent ?? '',
      contributeLinks: Array.from(sections.querySelectorAll('[data-home-contribute] a')).map((a) => a.getAttribute('href')),
      eyebrows: document.querySelectorAll('main [class*="eyebrow"]').length,
      arrows: (sections.textContent.match(/→/g) ?? []).length,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  })()`);
}

await send("Page.enable");
await send("Runtime.enable");

for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  const audit = await auditHome(width, height);
  const label = `home at ${width}`;

  assert.equal(audit.heroTitle, "Find better design resources, faster.", label);
  assert.equal(audit.heroArtwork, "/brand/tessli-hero-geometry.webp", label);
  assert.equal(audit.searchAction, "/resources", label);
  assert.equal(audit.searchName, "q", label);
  assert.deepEqual(
    audit.h2s,
    [
      "UI with the reasoning attached.",
      "Anatomy of an item.",
      "The same notes, for coding agents.",
      "Where else to look.",
      "Built in the open.",
    ],
    label,
  );
  assert.deepEqual(
    audit.featured,
    ["product-hero", "dashboard-overview", "empty-state"],
    label,
  );
  assert.deepEqual(
    audit.featuredLinks,
    audit.featured.map((slug) => `/library/${slug}`),
    label,
  );
  assert.equal(audit.thumbnailsInert, true, `${label}: previews are inert`);
  // Fixed 16:10 frames, so a preview loading late never shifts the page.
  assert.ok(
    audit.thumbnailRatios.every((ratio) => Math.abs(ratio - 1.6) < 0.02),
    `${label}: preview ratios ${audit.thumbnailRatios}`,
  );
  assert.equal(audit.lazyFrames, true, `${label}: lazy /preview iframes`);
  assert.ok(audit.anatomyRules >= 3, `${label}: anatomy rules`);
  assert.ok(audit.anatomyDefault > 40, `${label}: anatomy default`);
  assert.deepEqual(
    audit.commands,
    [
      "npx shadcn@latest add online-scope-lab/tessli/rules",
      "npx shadcn@latest add online-scope-lab/tessli/pricing-tiers",
    ],
    label,
  );
  assert.equal(audit.forAiHref, "/for-ai", label);
  assert.deepEqual(audit.sourcesLinks, ["/resources", "/collections"], label);
  assert.match(
    audit.sourcesCopy,
    /\b\d+ design and frontend sources in \d+ categories/u,
  );
  assert.deepEqual(
    audit.contributeLinks,
    ["/contribute", "https://github.com/Online-Scope-Lab/tessli"],
    label,
  );
  assert.equal(audit.eyebrows, 1, `${label}: one eyebrow, in the hero`);
  assert.equal(audit.arrows, 0, `${label}: no arrows on ordinary links`);
  assert.equal(audit.overflow, false, `${label}: no horizontal overflow`);
}

socket.close();
console.log("Home browser checks passed.");
