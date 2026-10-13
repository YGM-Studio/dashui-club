import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
const file = process.env.DB_PATH || resolve("data/community.sqlite");
if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
export const db = new DatabaseSync(file);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,name TEXT NOT NULL,goal TEXT NOT NULL DEFAULT '规律运动，慢慢变强',weekly_target INTEGER NOT NULL DEFAULT 4,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,date TEXT NOT NULL,category TEXT NOT NULL,title TEXT NOT NULL,content TEXT NOT NULL,minutes INTEGER NOT NULL DEFAULT 0,weight REAL,mood TEXT NOT NULL,visibility TEXT NOT NULL DEFAULT 'private',photo BLOB,created_at TEXT NOT NULL,UNIQUE(user_id,date));
CREATE TABLE IF NOT EXISTS likes (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,PRIMARY KEY(user_id,entry_id));
CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,content TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS entries_public ON entries(visibility,date DESC);
CREATE INDEX IF NOT EXISTS comments_entry ON comments(entry_id,created_at);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);`);
export const userView = (u) =>
  u && {
    id: u.id,
    name: u.name,
    email: u.email,
    goal: u.goal,
    weeklyTarget: u.weekly_target,
  };
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function shiftDate(date, offset) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export function stats(entries) {
  const dates = new Set(entries.map((e) => e.date));
  const now = today();
  let cursor = dates.has(now) ? now : shiftDate(now, -1),
    streak = 0;
  while (dates.has(cursor)) {
    streak++;
    cursor = shiftDate(cursor, -1);
  }
  const weekday = (new Date(now + "T00:00:00Z").getUTCDay() + 6) % 7;
  const start = shiftDate(now, -weekday);
  return {
    total: entries.length,
    streak,
    minutes: entries.reduce((sum, e) => sum + e.minutes, 0),
    week: entries.filter((e) => e.date >= start && e.date <= now).length,
  };
}
