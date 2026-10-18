import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { delay, findPageTarget } from "./lib/cdp.mjs";

describe("lib/cdp.mjs shared helpers (issue #151)", () => {
  it("delay waits at least the requested time", async () => {
    const start = Date.now();
    await delay(50);
    assert.ok(Date.now() - start >= 40, "waited ~50ms");
  });

  it("findPageTarget returns the first page with a debugger URL", async () => {
    const targets = [
      { type: "background_page", webSocketDebuggerUrl: "ws://x/1" },
      { type: "page", webSocketDebuggerUrl: "ws://x/2" },
    ];
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(targets));
    });
    await new Promise((resolve) => server.listen(0, resolve));
    try {
      const endpoint = `http://127.0.0.1:${server.address().port}`;
      const page = await findPageTarget(endpoint);
      assert.equal(page.webSocketDebuggerUrl, "ws://x/2");
    } finally {
      server.close();
    }
  });

  it("findPageTarget throws when no debugger ever appears", async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([]));
    });
    await new Promise((resolve) => server.listen(0, resolve));
    try {
      const endpoint = `http://127.0.0.1:${server.address().port}`;
      await assert.rejects(
        findPageTarget(endpoint),
        /Chrome DevTools endpoint did not become ready/,
      );
    } finally {
      server.close();
    }
  });
});
