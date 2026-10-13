import { test, before, after } from "node:test";
import assert from "node:assert/strict";
process.env.DB_PATH = ":memory:";
process.env.NODE_ENV = "test";
process.env.SEED_DEMO = "false";
const { app } = await import("../server/index.js");
const { db, stats, today, shiftDate } = await import("../server/db.js");
let server, base, cookieA, cookieB, id;
const body = {
  date: today(),
  category: "训练",
  title: "第一天",
  content: "练完以后感觉很好",
  minutes: 45,
  weight: 65.5,
  mood: "平稳踏实",
  visibility: "private",
};
async function req(path, method = "GET", data, cookie, origin) {
  const res = await fetch(base + path, {
    signal: AbortSignal.timeout(5000),
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const json = await res.json();
  return {
    status: res.status,
    json,
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => {
  server.close();
  db.close();
});
test("full user and privacy lifecycle", async (t) => {
  await t.test("anonymous cannot read personal entries", async () => {
    assert.equal((await req("/entries")).status, 401);
  });
  await t.test(
    "register separate accounts and reject weak password",
    async () => {
      assert.equal(
        (
          await req("/auth/register", "POST", {
            name: "弱密码",
            email: "weak@test.com",
            password: "short",
          })
        ).status,
        400,
      );
      const a = await req("/auth/register", "POST", {
        name: "甲",
        email: "a@test.com",
        password: "VeryStrong123!",
      });
      assert.equal(a.status, 200);
      cookieA = a.cookie;
      assert.equal(a.json.user.name, "甲");
      assert.equal(a.json.user.password, undefined);
      const b = await req("/auth/register", "POST", {
        name: "乙",
        email: "b@test.com",
        password: "VeryStrong123!",
      });
      assert.equal(b.status, 200);
      cookieB = b.cookie;
      assert.equal(
        (
          await req("/auth/register", "POST", {
            name: "甲",
            email: "a@test.com",
            password: "VeryStrong123!",
          })
        ).status,
        409,
      );
    },
  );
  await t.test(
    "reject invalid auth and untrusted cross-origin writes",
    async () => {
      assert.equal(
        (
          await req("/auth/login", "POST", {
            email: "a@test.com",
            password: "WrongPass123!",
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await req(
            "/entries",
            "POST",
            body,
            cookieA,
            "https://attacker.example",
          )
        ).status,
        403,
      );
    },
  );
  await t.test(
    "persist private record, unique daily record and invalid date validation",
    async () => {
      const r = await req("/entries", "POST", body, cookieA);
      assert.equal(r.status, 201);
      id = r.json.id;
      assert.equal((await req("/entries", "POST", body, cookieA)).status, 409);
      assert.equal(
        (
          await req(
            "/entries",
            "POST",
            { ...body, date: "2025-02-30" },
            cookieA,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await req(
            "/entries",
            "POST",
            { ...body, date: "2099-01-01" },
            cookieA,
          )
        ).status,
        400,
      );
      const mine = await req("/entries", "GET", undefined, cookieA);
      assert.equal(mine.json.entries.length, 1);
      assert.equal(mine.json.stats.total, 1);
      assert.equal(mine.json.stats.streak, 1);
    },
  );
  await t.test("omitted visibility defaults to private on the server", async () => {
    const { visibility, ...data } = body;
    const created = await req("/entries", "POST", { ...data, date: shiftDate(today(), -1) }, cookieA);
    assert.equal(created.status, 201);
    const mine = await req("/entries", "GET", undefined, cookieA);
    assert.equal(mine.json.entries.find(e => e.id === created.json.id).visibility, "private");
    assert.equal((await req("/community")).json.entries.length, 0);
    await req(`/entries/${created.json.id}`, "DELETE", {}, cookieA);
  });
  await t.test(
    "private records and interactions inaccessible to everyone else",
    async () => {
      assert.equal((await req("/community")).json.entries.length, 0);
      assert.equal(
        (await req("/entries", "GET", undefined, cookieB)).json.entries.length,
        0,
      );
      for (const cookie of [undefined, cookieB]) {
        assert.equal(
          (await req(`/entries/${id}/comments`, "GET", undefined, cookie))
            .status,
          404,
        );
        assert.equal(
          (await req(`/entries/${id}/photo`, "GET", undefined, cookie)).status,
          404,
        );
      }
      assert.equal(
        (await req(`/entries/${id}/like`, "POST", { liked: true }, cookieB))
          .status,
        404,
      );
      assert.equal(
        (
          await req(
            `/entries/${id}/comments`,
            "POST",
            { content: "try" },
            cookieB,
          )
        ).status,
        404,
      );
      assert.equal(
        (await req(`/entries/${id}`, "PUT", body, cookieB)).status,
        404,
      );
      assert.equal(
        (await req(`/entries/${id}`, "DELETE", {}, cookieB)).status,
        404,
      );
    },
  );
  await t.test("photo upload, normalization and private access", async () => {
    const sharp = (await import("sharp")).default;
    const image = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "#123456" },
    })
      .png()
      .toBuffer();
    const photo = "data:image/png;base64," + image.toString("base64");
    assert.equal(
      (await req(`/entries/${id}`, "PUT", { ...body, photo }, cookieA)).status,
      200,
    );
    const res = await fetch(`${base}/entries/${id}/photo`, {
      headers: { cookie: cookieA },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/jpeg");
    assert.equal(
      (await req(`/entries/${id}/photo`, "GET", undefined, cookieB)).status,
      404,
    );
    assert.equal(
      (
        await req(
          `/entries/${id}`,
          "PUT",
          { ...body, photo: "data:image/svg+xml;base64,PHN2Zz4=" },
          cookieA,
        )
      ).status,
      400,
    );
  });
  await t.test(
    "publish, filter, search, like idempotently and comment",
    async () => {
      assert.equal(
        (
          await req(
            `/entries/${id}`,
            "PUT",
            { ...body, visibility: "public" },
            cookieA,
          )
        ).status,
        200,
      );
      assert.equal((await req("/community")).json.entries.length, 1);
      assert.equal(
        (await req("/community?category=" + encodeURIComponent("饮食"))).json
          .entries.length,
        0,
      );
      assert.equal(
        (await req("/community?search=" + encodeURIComponent("第一天"))).json
          .entries.length,
        1,
      );
      assert.equal((await fetch(`${base}/entries/${id}/photo`)).status, 200);
      for (let i = 0; i < 2; i++)
        assert.equal(
          (await req(`/entries/${id}/like`, "POST", { liked: true }, cookieB))
            .status,
          200,
        );
      const feed = await req("/community", "GET", undefined, cookieB);
      assert.equal(feed.json.entries[0].likes, 1);
      assert.equal(feed.json.entries[0].liked, true);
      assert.equal(
        (
          await req(
            `/entries/${id}/comments`,
            "POST",
            { content: "加油呀！" },
            cookieB,
          )
        ).status,
        201,
      );
      assert.equal(
        (await req(`/entries/${id}/comments`)).json.comments[0].content,
        "加油呀！",
      );
      assert.equal(
        (
          await req(
            `/entries/${id}/comments`,
            "POST",
            { content: " " },
            cookieB,
          )
        ).status,
        400,
      );
    },
  );
  await t.test(
    "switch back to private removes photo and comments from public access",
    async () => {
      assert.equal(
        (await req(`/entries/${id}`, "PUT", body, cookieA)).status,
        200,
      );
      assert.equal((await req("/community")).json.entries.length, 0);
      assert.equal(
        (await req(`/entries/${id}/comments`, "GET", undefined, cookieB))
          .status,
        404,
      );
      assert.equal(
        (await req(`/entries/${id}/photo`, "GET", undefined, cookieB)).status,
        404,
      );
    },
  );
  await t.test("settings, export and profile isolation", async () => {
    const r = await req(
      "/me",
      "PATCH",
      { name: "甲改名", goal: "一周运动三次", weeklyTarget: 3 },
      cookieA,
    );
    assert.equal(r.json.user.weeklyTarget, 3);
    const a = await req("/export", "GET", undefined, cookieA);
    assert.equal(a.json.entries.length, 1);
    assert.equal(a.json.entries[0].title, "第一天");
    assert.equal(
      (await req("/export", "GET", undefined, cookieB)).json.entries.length,
      0,
    );
    assert.equal(
      (
        await req(
          "/me",
          "PATCH",
          { name: "X", goal: "X", weeklyTarget: 8 },
          cookieA,
        )
      ).status,
      400,
    );
  });
  await t.test("delete cascades and revoke session on logout", async () => {
    assert.equal(
      (await req(`/entries/${id}`, "DELETE", {}, cookieA)).status,
      200,
    );
    assert.equal(db.prepare("SELECT count(*) AS n FROM comments").get().n, 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM likes").get().n, 0);
    assert.equal(
      (await req("/entries", "GET", undefined, cookieA)).json.entries.length,
      0,
    );
    assert.equal((await req("/auth/logout", "POST", {}, cookieA)).status, 200);
    assert.equal(
      (await req("/entries", "GET", undefined, cookieA)).status,
      401,
    );
    const again = await req("/auth/login", "POST", {
      email: "a@test.com",
      password: "VeryStrong123!",
    });
    assert.equal(again.status, 200);
  });
});
test("streak calculations handle rest gaps and current day", () => {
  const now = today();
  const entry = (d) => ({ date: d, minutes: 30 });
  assert.equal(stats([]).streak, 0);
  assert.equal(
    stats([entry(shiftDate(now, -1)), entry(shiftDate(now, -2))]).streak,
    2,
  );
  assert.equal(stats([entry(now), entry(shiftDate(now, -2))]).streak, 1);
  assert.equal(stats([entry(shiftDate(now, -2))]).streak, 0);
});
