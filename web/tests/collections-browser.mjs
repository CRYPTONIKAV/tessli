// Browser checks for Tessli collections research paths, stages and links.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { connect, delay } from "./lib/cdp.mjs";

const ENDPOINT = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const ORIGIN = process.env.TESSLI_ORIGIN ?? "http://127.0.0.1:3000";
const outputDirectory = new URL("../artifacts/playbooks/", import.meta.url);
const browserFailures = [];

const catalogue = JSON.parse(
  await readFile(new URL("../data/catalogue.json", import.meta.url), "utf8"),
);
const resource = catalogue.resources.find(
  (candidate) => candidate.slug === "motion",
);

const collectionSlugs = [
  "saas-landing-pages",
  "typography-font-tools",
  "motion-starter-pack",
  "open-source-ui-libraries",
  "accessible-colour-tools",
  "design-systems-worth-studying",
];
// Membership sizes differ since the v1.2 triage archived some members; the
// page must show exactly the recorded, ordered membership.
const memberCounts = new Map(
  JSON.parse(
    await readFile(
      new URL("../../lib_data/tessli-launch-collections.json", import.meta.url),
      "utf8",
    ),
  ).collections.map((collection) => [
    collection.slug,
    collection.resourceIds.length,
  ]),
);

const {
  send,
  evaluate,
  evaluateSettled,
  waitFor: cdpWaitFor,
  markDocumentStale,
  navigate,
  socket,
} = await connect(ENDPOINT);

// Record CDP exceptions and console errors so the suite can assert the page
// stayed clean.
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") {
    browserFailures.push(message.params.exceptionDetails.text);
  }
  if (
    message.method === "Runtime.consoleAPICalled" &&
    message.params.type === "error"
  ) {
    browserFailures.push(
      message.params.args
        .map((argument) => argument.value ?? argument.description ?? "error")
        .join(" "),
    );
  }
});

async function screenshot(filename) {
  const image = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(
    new URL(filename, outputDirectory),
    Buffer.from(image.data, "base64"),
  );
}

async function navigateCollection(pathname, readyExpression) {
  await navigate(pathname, ORIGIN, readyExpression);
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all([send("Page.enable"), send("Runtime.enable")]);
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await navigateCollection(
  "/collections",
  'document.querySelectorAll("[data-collection-card]").length === 6',
);

assert.equal(
  await evaluate('document.querySelectorAll("[data-collection-card]").length'),
  6,
);
assert.equal(
  await evaluate(
    'document.querySelectorAll("[data-collection-stage-count=\\"3\\"]").length',
  ),
  6,
);
assert.deepEqual(
  await evaluate(
    'Array.from(document.querySelectorAll("[data-collection-card] a")).map((link) => link.getAttribute("href"))',
  ),
  collectionSlugs.map((slug) => `/collections/${slug}`),
);
assert.equal(
  await evaluate(
    `document.querySelector('nav[aria-label="Primary navigation"] a[aria-current="page"]')?.textContent?.trim()`,
  ),
  // Collections are curated source guides, so Sources is the current item.
  "Sources",
);
assert.equal(
  await evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
  true,
);
await screenshot("playbooks-index-1440x900.png");

for (const [index, slug] of collectionSlugs.entries()) {
  const memberCount = memberCounts.get(slug);
  assert.ok(memberCount >= 5, `${slug} keeps at least five members.`);
  await navigateCollection(
    `/collections/${slug}`,
    `document.querySelectorAll('[data-collection-detail="${slug}"] [data-collection-resource-grid] > li').length === ${memberCount}`,
  );

  assert.equal(
    await evaluate('document.querySelectorAll("[data-playbook-stage]").length'),
    3,
    `${slug} should expose three ordered stages.`,
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll("[data-collection-resource-grid] > li").length',
    ),
    memberCount,
    `${slug} should expose its ${memberCount} ordered resources.`,
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll("[data-playbook-resource-role]").length',
    ),
    memberCount,
    `${slug} should explain every source role.`,
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll("[data-collection-resource-grid] [data-resource-save]").length',
    ),
    0,
  );
  assert.equal(
    await evaluate(
      'Boolean(document.querySelector("a[href=\\"/boards\\"], a[href=\\"/saved\\"]"))',
    ),
    false,
  );
  assert.equal(
    await evaluate(
      'Boolean(document.querySelector("a[href=\\"#research-sequence\\"]")) && Boolean(document.getElementById("research-sequence"))',
    ),
    true,
  );
  assert.equal(
    await evaluate(
      `Boolean(document.querySelector('a[href="/collections/${slug}/collection.md"]'))`,
    ),
    true,
  );
  assert.equal(
    await evaluate(
      `Boolean(document.querySelector('a[href="/collections/${slug}/collection.json"]'))`,
    ),
    true,
  );

  if (index === 0) {
    await screenshot("playbook-detail-1440x900.png");
  }

  assert.equal(
    await evaluate(
      `document.querySelector('nav[aria-label="Primary navigation"] a[aria-current="page"]')?.textContent?.trim()`,
    ),
    "Sources",
  );
  assert.equal(
    await evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
    true,
  );
}

await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await navigateCollection(
  "/collections/saas-landing-pages",
  'document.querySelectorAll("[data-playbook-stage]").length === 3',
);
assert.equal(
  await evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
  true,
);
assert.equal(
  await evaluate(
    'getComputedStyle(document.querySelector("[data-collection-resource-grid]" )).gridTemplateColumns.split(" ").length',
  ),
  1,
);
await screenshot("playbook-detail-390x844.png");

socket.close();
assert.deepEqual(browserFailures, []);
console.log(
  "Collections research paths, stages and machine links checks passed.",
);
