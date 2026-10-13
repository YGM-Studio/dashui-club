import { randomUUID } from "node:crypto";
import { db, today, shiftDate } from "./db.js";
export async function seed(hash) {
  if (db.prepare("SELECT id FROM users WHERE email=?").get("demo@dashui.local"))
    return;
  const password = await hash("DashuiDemo2026!"),
    now = new Date().toISOString();
  const names = ["小水", "阿川", "认真吃饭的栗子", "慢慢来呀"];
  const ids = names.map((name, i) => {
    const id = randomUUID();
    db.prepare(
      "INSERT INTO users(id,email,password,name,created_at) VALUES(?,?,?,?,?)",
    ).run(
      id,
      i === 0 ? "demo@dashui.local" : `example${i}@dashui.local`,
      password,
      name + " · 示例",
      now,
    );
    return id;
  });
  const samples = [
    [
      "训练",
      "重量可以慢慢加，动作要认真做",
      "今天练了背和肩。把重量降了一点，反而更能感受到肌肉发力。\n\n不着急和别人比较，能比上周的自己多一点控制，就很好。",
      45,
    ],
    [
      "饮食",
      "好好吃饭，也是训练的一部分",
      "下班后给自己做了鸡肉、杂粮饭和一大盘蔬菜。没什么复杂的食谱，吃得舒服、方便坚持就好。",
      0,
    ],
    [
      "恢复",
      "今天的计划：允许自己休息",
      "散步二十分钟，早点睡。以前休息会有负罪感，现在慢慢学会听身体的话。恢复好了，才有下一次好好训练。",
      20,
    ],
    [
      "心得",
      "一个月过去，先变好的其实是心情",
      "镜子里的变化还不算大，但下班后不再只想躺着了。能把一点时间留给自己，这件事本身就很值得。",
      30,
    ],
  ];
  for (let i = 0; i < 4; i++) {
    const s = samples[i];
    db.prepare("INSERT INTO entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(
      randomUUID(),
      ids[i],
      today(),
      s[0],
      s[1],
      s[2],
      s[3],
      null,
      "平稳踏实",
      "public",
      null,
      now,
    );
  }
  for (const offset of [1, 2, 3, 5, 7, 8, 10, 12, 14, 16, 19, 22, 25])
    db.prepare("INSERT INTO entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(
      randomUUID(),
      ids[0],
      shiftDate(today(), -offset),
      "训练",
      "把一点时间留给自己",
      "完成了今天的训练。记录感受，慢慢进步。",
      30 + (offset % 4) * 10,
      65 + offset / 20,
      "平稳踏实",
      offset % 2 ? "private" : "public",
      null,
      shiftDate(today(), -offset) + "T08:00:00.000Z",
    );
}
