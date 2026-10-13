import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { z } from "zod";
import { db, userView, today, shiftDate, stats } from "./db.js";
const scrypt = promisify(scryptCallback),
  prod = process.env.NODE_ENV === "production";
const digest = (t) => createHash("sha256").update(t).digest("hex");
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + (await scrypt(password, salt, 64)).toString("hex");
}
async function verify(password, stored) {
  const [salt, key] = stored.split(":");
  return timingSafeEqual(
    Buffer.from(key, "hex"),
    await scrypt(password, salt, 64),
  );
}
const safeDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => {
    const n = new Date(d + "T00:00:00Z");
    return (
      !Number.isNaN(n.getTime()) &&
      n.toISOString().slice(0, 10) === d &&
      d <= today() &&
      d >= "2000-01-01"
    );
  }, "请选择有效日期，不支持未来打卡");
const entrySchema = z.object({
  date: safeDate,
  category: z.enum(["训练", "饮食", "恢复", "心得"]),
  title: z.string().trim().min(1, "写一个小标题吧").max(80),
  content: z.string().trim().min(1, "记录一点今天的感受吧").max(3000),
  minutes: z.number().int().min(0).max(1440),
  weight: z.number().min(20).max(350).nullable(),
  mood: z.enum(["状态很棒", "平稳踏实", "有点疲惫"]),
  visibility: z.enum(["private", "public"]).default("private"),
  photo: z.string().max(7000000).nullable().optional(),
});
export const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "img-src": ["'self'", "data:", "blob:"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "script-src": ["'self'"],
        "upgrade-insecure-requests": prod ? [] : null,
      },
    },
    strictTransportSecurity: prod ? undefined : false,
  }),
);
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (!req.is("application/json"))
      return res.status(415).json({ error: "请使用 JSON 请求" });
    const origin = req.get("origin");
    const allowed = process.env.APP_ORIGIN;
    if (
      origin &&
      (allowed
        ? origin !== allowed
        : ![
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
          ].includes(origin))
    )
      return res.status(403).json({ error: "请求来源不受信任" });
  }
  next();
});
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "请求太频繁，请稍后再试" },
  }),
);
app.use(express.json({ limit: "7mb" }));
app.use((req, res, next) => {
  const match = req.headers.cookie?.match(
    /(?:^|;\s*)session=([a-f0-9]{64})(?:;|$)/,
  );
  if (match) {
    req.sessionHash = digest(match[1]);
    req.user = db
      .prepare(
        "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?",
      )
      .get(req.sessionHash, Date.now());
  }
  next();
});
const auth = (req, res, next) =>
  req.user
    ? next()
    : res.status(401).json({ error: "请先登录，再记录你的成长" });
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "尝试次数较多，请 15 分钟后再试" },
});
function login(res, user) {
  const token = randomBytes(32).toString("hex");
  db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    digest(token),
    user.id,
    Date.now() + 30 * 86400000,
  );
  res.cookie("session", token, {
    httpOnly: true,
    secure: prod,
    sameSite: "lax",
    maxAge: 30 * 86400000,
    path: "/",
  });
  return res.json({ user: userView(user) });
}
app.get("/api/health", (_req, res) => {
  db.prepare("SELECT 1").get();
  res.json({ status: "ok" });
});
app.get("/api/me", (req, res) =>
  res.json({
    user: userView(req.user) || null,
    demo: process.env.SEED_DEMO === "true" && !prod,
  }),
);
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(10, "密码至少 10 位").max(128),
});
app.post("/api/auth/register", authLimit, async (req, res) => {
  const data = credentials
    .extend({ name: z.string().trim().min(1).max(24) })
    .parse(req.body);
  if (db.prepare("SELECT id FROM users WHERE email=?").get(data.email))
    return res.status(409).json({ error: "这个邮箱已经注册，请直接登录" });
  const id = randomUUID(),
    password = await hashPassword(data.password);
  try {
    db.prepare(
      "INSERT INTO users(id,email,password,name,created_at) VALUES(?,?,?,?,?)",
    ).run(id, data.email, password, data.name, new Date().toISOString());
  } catch (e) {
    if (e.errcode === 2067 || e.code?.includes("CONSTRAINT"))
      return res.status(409).json({ error: "这个邮箱已经注册，请直接登录" });
    throw e;
  }
  login(res, db.prepare("SELECT * FROM users WHERE id=?").get(id));
});
app.post("/api/auth/login", authLimit, async (req, res) => {
  const data = credentials.parse(req.body),
    u = db.prepare("SELECT * FROM users WHERE email=?").get(data.email);
  const stored = u?.password || dummyPassword;
  const valid = await verify(data.password, stored);
  if (!u || !valid) return res.status(401).json({ error: "邮箱或密码不正确" });
  login(res, u);
});
app.post("/api/auth/logout", (_req, res) => {
  if (_req.sessionHash)
    db.prepare("DELETE FROM sessions WHERE token=?").run(_req.sessionHash);
  res
    .clearCookie("session", {
      path: "/",
      httpOnly: true,
      secure: prod,
      sameSite: "lax",
    })
    .json({ ok: true });
});
app.patch("/api/me", auth, (req, res) => {
  const d = z
    .object({
      name: z.string().trim().min(1).max(24),
      goal: z.string().trim().min(1).max(100),
      weeklyTarget: z.number().int().min(1).max(7),
    })
    .parse(req.body);
  db.prepare("UPDATE users SET name=?,goal=?,weekly_target=? WHERE id=?").run(
    d.name,
    d.goal,
    d.weeklyTarget,
    req.user.id,
  );
  res.json({
    user: userView(
      db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id),
    ),
  });
});
const selectEntries = `SELECT e.id,e.user_id AS userId,e.date,e.category,e.title,e.content,e.minutes,e.weight,e.mood,e.visibility,e.created_at AS createdAt,u.name AS author, CASE WHEN e.photo IS NULL THEN 0 ELSE 1 END AS hasPhoto,(SELECT count(*) FROM likes WHERE entry_id=e.id) AS likes,(SELECT count(*) FROM comments WHERE entry_id=e.id) AS comments,EXISTS(SELECT 1 FROM likes WHERE entry_id=e.id AND user_id=?) AS liked FROM entries e JOIN users u ON u.id=e.user_id`;
const mapEntry = (e) => ({ ...e, hasPhoto: !!e.hasPhoto, liked: !!e.liked });
app.get("/api/entries", auth, (req, res) => {
  const entries = db
    .prepare(selectEntries + " WHERE e.user_id=? ORDER BY e.date DESC")
    .all(req.user.id, req.user.id)
    .map(mapEntry);
  res.json({ entries, stats: stats(entries) });
});
app.get("/api/community", (req, res) => {
  const category =
    typeof req.query.category === "string" ? req.query.category : "";
  const search =
    typeof req.query.search === "string" ? req.query.search.slice(0, 100) : "";
  const page = Math.max(
    0,
    Math.min(10000, Number.parseInt(req.query.page) || 0),
  );
  const where =
    " WHERE e.visibility='public' AND (?='' OR e.category=?) AND (?='' OR e.title LIKE ? OR e.content LIKE ?)";
  const entries = db
    .prepare(
      selectEntries + where + " ORDER BY e.created_at DESC LIMIT 13 OFFSET ?",
    )
    .all(
      req.user?.id || "",
      category,
      category,
      search,
      "%" + search + "%",
      "%" + search + "%",
      page * 12,
    )
    .map(mapEntry);
  res.json({ entries: entries.slice(0, 12), hasMore: entries.length > 12 });
});
function accessible(id, user) {
  return db
    .prepare(
      "SELECT id,user_id,visibility FROM entries WHERE id=? AND (visibility='public' OR user_id=?)",
    )
    .get(id, user?.id || "");
}
async function photoBuffer(value) {
  if (value === null) return null;
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(value))
    throw new Error("INVALID_IMAGE");
  const raw = Buffer.from(value.split(",")[1], "base64");
  if (raw.length > 5 * 1024 * 1024) throw new Error("INVALID_IMAGE");
  try {
    return await sharp(raw, { limitInputPixels: 25000000 })
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    throw new Error("INVALID_IMAGE");
  }
}
app.post("/api/entries", auth, async (req, res) => {
  const d = entrySchema.parse(req.body),
    photo = d.photo ? await photoBuffer(d.photo) : null,
    id = randomUUID();
  try {
    db.prepare("INSERT INTO entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(
      id,
      req.user.id,
      d.date,
      d.category,
      d.title,
      d.content,
      d.minutes,
      d.weight,
      d.mood,
      d.visibility,
      photo,
      new Date().toISOString(),
    );
  } catch (e) {
    if (e.errcode === 2067 || e.code?.includes("CONSTRAINT"))
      return res
        .status(409)
        .json({ error: "这一天已经打过卡了，可以在「我的记录」中编辑" });
    throw e;
  }
  res.status(201).json({ id });
});
app.put("/api/entries/:id", auth, async (req, res) => {
  if (
    !db
      .prepare("SELECT id FROM entries WHERE id=? AND user_id=?")
      .get(req.params.id, req.user.id)
  )
    return res.status(404).json({ error: "记录不存在" });
  const d = entrySchema.parse(req.body);
  const photo = d.photo === undefined ? undefined : await photoBuffer(d.photo);
  try {
    db.prepare(
      "UPDATE entries SET date=?,category=?,title=?,content=?,minutes=?,weight=?,mood=?,visibility=? WHERE id=? AND user_id=?",
    ).run(
      d.date,
      d.category,
      d.title,
      d.content,
      d.minutes,
      d.weight,
      d.mood,
      d.visibility,
      req.params.id,
      req.user.id,
    );
    if (photo !== undefined)
      db.prepare("UPDATE entries SET photo=? WHERE id=?").run(
        photo,
        req.params.id,
      );
  } catch (e) {
    if (e.errcode === 2067 || e.code?.includes("CONSTRAINT"))
      return res.status(409).json({ error: "这一天已有记录，请修改日期" });
    throw e;
  }
  res.json({ ok: true });
});
app.delete("/api/entries/:id", auth, (req, res) => {
  const result = db
    .prepare("DELETE FROM entries WHERE id=? AND user_id=?")
    .run(req.params.id, req.user.id);
  res
    .status(result.changes ? 200 : 404)
    .json(result.changes ? { ok: true } : { error: "记录不存在" });
});
app.get("/api/entries/:id/photo", (req, res) => {
  if (!accessible(req.params.id, req.user))
    return res.status(404).json({ error: "照片不存在" });
  const e = db
    .prepare("SELECT photo FROM entries WHERE id=?")
    .get(req.params.id);
  if (!e.photo) return res.status(404).json({ error: "照片不存在" });
  res.type("jpeg").send(Buffer.from(e.photo));
});
app.post("/api/entries/:id/like", auth, (req, res) => {
  if (!accessible(req.params.id, req.user))
    return res.status(404).json({ error: "记录不存在" });
  const { liked } = z.object({ liked: z.boolean() }).parse(req.body);
  if (liked)
    db.prepare("INSERT OR IGNORE INTO likes VALUES(?,?)").run(
      req.user.id,
      req.params.id,
    );
  else
    db.prepare("DELETE FROM likes WHERE user_id=? AND entry_id=?").run(
      req.user.id,
      req.params.id,
    );
  res.json({ ok: true });
});
app.get("/api/entries/:id/comments", (req, res) => {
  if (!accessible(req.params.id, req.user))
    return res.status(404).json({ error: "记录不存在或已设为私密" });
  res.json({
    comments: db
      .prepare(
        "SELECT c.id,c.content,c.created_at AS createdAt,u.name AS author FROM comments c JOIN users u ON u.id=c.user_id WHERE c.entry_id=? ORDER BY c.created_at LIMIT 200",
      )
      .all(req.params.id),
  });
});
app.post("/api/entries/:id/comments", auth, (req, res) => {
  const { content } = z
    .object({ content: z.string().trim().min(1).max(500) })
    .parse(req.body);
  if (!accessible(req.params.id, req.user))
    return res.status(404).json({ error: "记录不存在或已设为私密" });
  db.prepare("INSERT INTO comments VALUES(?,?,?,?,?)").run(
    randomUUID(),
    req.user.id,
    req.params.id,
    content,
    new Date().toISOString(),
  );
  res.status(201).json({ ok: true });
});
app.get("/api/export", auth, (req, res) => {
  const entries = db
    .prepare(selectEntries + " WHERE e.user_id=? ORDER BY e.date DESC")
    .all(req.user.id, req.user.id)
    .map(mapEntry);
  res
    .set("Content-Disposition", 'attachment; filename="my-growth.json"')
    .json({
      exportedAt: new Date().toISOString(),
      profile: userView(req.user),
      entries,
    });
});
app.use("/api", (_req, res) => res.status(404).json({ error: "接口不存在" }));
if (existsSync(resolve("dist/index.html"))) {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
}
app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError)
    return res
      .status(400)
      .json({ error: err.issues[0]?.message || "请检查填写内容" });
  if (err.message === "INVALID_IMAGE")
    return res
      .status(400)
      .json({ error: "请选择 5MB 以内的 JPG、PNG 或 WebP 图片" });
  if (err.type === "entity.too.large")
    return res.status(413).json({ error: "图片太大，请选择 5MB 以内的图片" });
  if (err instanceof SyntaxError)
    return res.status(400).json({ error: "请求格式不正确" });
  console.error(err);
  res.status(500).json({ error: "服务暂时不可用，请稍后重试" });
});
const dummyPassword = await hashPassword(randomBytes(32).toString("hex"));
if (process.env.SEED_DEMO === "true" && !prod) {
  const { seed } = await import("./seed.js");
  await seed(hashPassword);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (prod && !/^https:\/\//.test(process.env.APP_ORIGIN || ""))
    throw new Error("Production requires APP_ORIGIN=https://your-domain");
  const port = Number(process.env.PORT) || 3001;
  app.listen(port, "0.0.0.0", () =>
    console.log(`大水肌薄社区 http://localhost:${port}`),
  );
}
