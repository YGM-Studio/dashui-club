import { backup } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { db } from "./db.js";
const destination = resolve(
  process.argv[2] ||
    `data/backups/community-${new Date().toISOString().replaceAll(":", "-")}.sqlite`,
);
mkdirSync(dirname(destination), { recursive: true });
await backup(db, destination);
db.close();
console.log(destination);
