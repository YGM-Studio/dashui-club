import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
process.env.DB_PATH = ":memory:";
process.env.NODE_ENV = "test";
process.env.SEED_DEMO = "false";
process.env.PHOTO_CONCURRENCY = "1";
const { app } = await import("../server/index.js");
const { db, today, shiftDate } = await import("../server/db.js");

test("parallel photo uploads return a retryable busy response and recover", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const registration = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Capacity", email: "capacity@example.test", password: "LocalCapacity2026!" }),
    });
    assert.equal(registration.status, 200);
    const cookie = registration.headers.get("set-cookie").split(";")[0];
    await registration.arrayBuffer();
    const image = await sharp({ create: { width: 4800, height: 4800, channels: 3, background: "#43805c" } }).png().toBuffer();
    const photo = `data:image/png;base64,${image.toString("base64")}`;
    const upload = (offset) => fetch(`${base}/api/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ date: shiftDate(today(), -offset), category: "训练", title: "Capacity", content: "Synthetic test", minutes: 10, weight: null, mood: "平稳踏实", photo }),
    });
    const responses = await Promise.all([1, 2, 3, 4].map(upload));
    assert.ok(responses.some((r) => r.status === 201));
    assert.ok(responses.some((r) => r.status === 429));
    for (const response of responses) {
      assert.ok([201, 429].includes(response.status));
      if (response.status === 429) assert.equal(response.headers.get("retry-after"), "1");
      await response.arrayBuffer();
    }
    const retry = await upload(10);
    assert.equal(retry.status, 201);
    await retry.arrayBuffer();
  } finally {
    server.close();
    db.close();
  }
});
