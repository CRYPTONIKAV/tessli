// For AI route, install commands, MCP setup, plain files, responsive layout.
import assert from "node:assert/strict";
import { connect } from "./lib/cdp.mjs";

const ENDPOINT = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const ORIGIN = process.env.TESSLI_ORIGIN ?? "http://127.0.0.1:3000";
const outputDirectory = new URL("../artifacts/for-ai/", import.meta.url);
const browserFailures = [];

const {
  send,
  evaluate,
  evaluateSettled,
  waitFor: cdpWaitFor,
  markDocumentStale,
  navigate,
  socket,
} = await connect(ENDPOINT);

// Record CDP exceptions and console errors so the suite can assert the page stayed clean.
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

async function delay(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function screenshot(filename) {
  const image = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const fs = await import("node:fs/promises");
  const { mkdir, writeFile } = fs;
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    new URL(filename, outputDirectory),
    Buffer.from(image.data, "base64"),
  );
}

async function setViewport(width, height, mobile) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
}

const sections = [
  "data-for-ai-install",
  "data-for-ai-rules-file",
  "data-for-ai-workflow",
  "data-for-ai-local-mcp",
  "data-for-ai-agent-gets",
  "data-for-ai-representations",
  "data-for-ai-not-claimed",
];

await Promise.all([send("Page.enable"), send("Runtime.enable")]);

await setViewport(1440, 900, false);
await navigate(
  "/for-ai",
  ORIGIN,
  'Boolean(document.querySelector("[data-for-ai-page] [data-for-ai-install]")) && Boolean(document.querySelector("[data-for-ai-remote-status=\\"unavailable\\"]"))',
);

assert.equal(await evaluate('document.querySelectorAll("main").length'), 1);
assert.equal(await evaluate('document.querySelectorAll("h1").length'), 1);
assert.equal(
  await evaluate(
    'document.querySelector("nav[aria-label=\\"Primary navigation\\"] a[aria-current=\\"page\\"]")?.textContent?.trim()',
  ),
  "For AI",
);
// Every section is present, in order.
assert.equal(
  await evaluate(
    `(() => {
      const page = document.querySelector("[data-for-ai-page]");
      const nodes = ${JSON.stringify(sections)}.map((attribute) => page.querySelector("[" + attribute + "]"));
      return nodes.every(Boolean) && nodes.every((node, index) => index === 0 || nodes[index - 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
    })()`,
  ),
  true,
);
assert.equal(
  await evaluate(
    'document.querySelector("[data-for-ai-remote-status]")?.getAttribute("data-for-ai-remote-status")',
  ),
  "unavailable",
);
assert.equal(
  await evaluate(
    `[
      "Code and reasoning, in the formats agents read.",
      "Install with the shadcn CLI.",
      "TESSLI.md keeps every rule in reach.",
      "How an agent uses Tessli.",
      "Local MCP server.",
      "What an agent gets.",
      "Plain files at stable URLs.",
      "What Tessli does not claim."
    ].every((heading) => Array.from(document.querySelectorAll("h1, h2")).some((node) => node.textContent?.trim() === heading))`,
  ),
  true,
);
// Heading outline: one h1, no skipped levels.
assert.equal(
  await evaluate(
    `(() => {
      const levels = Array.from(document.querySelectorAll("main h1, main h2, main h3, main h4"), (node) => Number(node.tagName[1]));
      return levels[0] === 1 && levels.every((level, index) => index === 0 || level <= levels[index - 1] + 1);
    })()`,
  ),
  true,
);
// The install commands, the rules excerpt, the five tools and the steps.
const content = await evaluate(`(() => ({
  commands: Array.from(document.querySelectorAll("[data-for-ai-install] [data-install-command]"), (node) => node.textContent.trim()),
  copyLabels: Array.from(document.querySelectorAll("[data-for-ai-install] [data-copy-install]"), (node) => node.getAttribute("aria-label")),
  statusRegions: document.querySelectorAll("[data-for-ai-install] [role=\\"status\\"]").length,
  excerpt: document.querySelector("[data-for-ai-rules-file] pre")?.textContent ?? "",
  tools: Array.from(document.querySelectorAll("[data-for-ai-tools] dt"), (node) => node.textContent.trim()),
  steps: document.querySelectorAll("[data-for-ai-workflow] ol > li").length,
  mcpText: document.querySelector("[data-for-ai-local-mcp]").textContent,
}))()`);
assert.deepEqual(content.commands, [
  "npx shadcn@latest add online-scope-lab/tessli/pricing-tiers",
  "npx shadcn@latest add online-scope-lab/tessli/rules",
]);
assert.deepEqual(content.copyLabels, [
  "Copy the item install command",
  "Copy the rules install command",
]);
assert.equal(content.statusRegions, 2);
assert.match(content.excerpt, /^- H-01 /);
assert.deepEqual(content.tools, [
  "search_items",
  "get_item",
  "get_rules",
  "find_sources",
  "get_source",
]);
assert.equal(content.steps, 5);
assert.match(content.mcpText, /npm run mcp/);
assert.match(content.mcpText, /mcp\/server\.ts/);
assert.match(content.mcpText, /no hosted or remote Tessli MCP/i);

assert.equal(
  await evaluate(
    '!/\\bBoards?\\b/.test(document.querySelector("main").textContent) && !document.querySelector("a[href=\\"/boards\\"], a[href=\\"/saved\\"]") && Boolean(document.querySelector("a[href=\\"#local-mcp\\"]")) && Boolean(document.getElementById("local-mcp"))',
  ),
  true,
);
assert.equal(
  await evaluate(
    "!/\\b(?:coverage|evidence|verification|taste)\\b/i.test(document.body.textContent)",
  ),
  true,
);
assert.equal(
  await evaluate('document.querySelectorAll("a a, a button, button a").length'),
  0,
);
assert.equal(
  await evaluate('document.querySelectorAll("pre[tabindex=\\"0\\"]").length'),
  2,
);
// The scrollable code blocks are focusable; the wrapped excerpt never scrolls.
assert.equal(
  await evaluate(
    'Array.from(document.querySelectorAll("pre")).every((node) => node.tabIndex === 0 || node.closest("[data-install-command]") || node.matches("[data-install-command]") || node.scrollWidth <= node.clientWidth)',
  ),
  true,
);
assert.equal(
  await evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
  true,
);

// Every plain-file link on the page answers with the right content type.
const representationStatuses = await evaluate(`Promise.all(
  Array.from(document.querySelectorAll("[data-for-ai-representations] a[href]"), (link) => link.getAttribute("href"))
    .map(async (pathname) => {
      const response = await fetch(pathname);
      return [pathname, response.status, response.headers.get("content-type")];
    })
)`);
assert.deepEqual(
  representationStatuses.map(([pathname]) => pathname),
  [
    "/llms.txt",
    "/rules/TESSLI.md",
    "/library/pricing-tiers/item.json",
    "/library/pricing-tiers/item.md",
    "/resources/land-book/profile.json",
    "/resources/land-book/profile.md",
  ],
);
const expectedTypes = {
  ".txt": /text\/plain/,
  ".md": /text\/markdown/,
  ".json": /application\/json/,
};
for (const [pathname, status, contentType] of representationStatuses) {
  assert.equal(status, 200, pathname);
  assert.match(
    contentType,
    expectedTypes[pathname.slice(pathname.lastIndexOf("."))],
    pathname,
  );
}
await screenshot("for-ai-1440x900.png");

for (const [width, height, mobile] of [
  [1024, 768, false],
  [768, 1024, false],
  [390, 844, true],
  [320, 800, true],
]) {
  await setViewport(width, height, mobile);
  await navigate(
    "/for-ai",
    ORIGIN,
    'Boolean(document.querySelector("[data-for-ai-page]"))',
  );
  assert.equal(
    await evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
    true,
    `For AI should not overflow at ${width}px.`,
  );
  assert.equal(
    await evaluate(
      'Array.from(document.querySelectorAll("pre")).every((node) => node.scrollWidth >= node.clientWidth && node.getBoundingClientRect().right <= window.innerWidth)',
    ),
    true,
  );

  if (width === 390) {
    await screenshot("for-ai-390x844.png");
  }
}

socket.close();
assert.deepEqual(browserFailures, []);
console.log(
  "For AI route, install commands, MCP setup, plain files, responsive layout and non-claims passed.",
);
