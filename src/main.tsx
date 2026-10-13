import React, { useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import {
  Home,
  Compass,
  ChartNoAxesCombined,
  NotebookPen,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Flame,
  Check,
  CheckCheck,
  LockKeyhole,
  Globe2,
  Heart,
  MessageCircle,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Leaf,
  Wind,
  Sparkles,
  LogOut,
  Settings2,
  ImagePlus,
  Download,
  CalendarDays,
  Clock3,
  Ellipsis,
  Trash2,
  Pencil,
  Target,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import "./styles.css";
const cn = (...v: ClassValue[]) => twMerge(clsx(v));
type User = {
  id: string;
  name: string;
  email: string;
  goal: string;
  weeklyTarget: number;
};
type Entry = {
  id: string;
  userId: string;
  date: string;
  category: string;
  title: string;
  content: string;
  minutes: number;
  weight: number | null;
  mood: string;
  visibility: "private" | "public";
  hasPhoto: boolean;
  author: string;
  likes: number;
  comments: number;
  liked: boolean;
};
type Stats = { total: number; streak: number; minutes: number; week: number };
type Comment = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
};
const categories = ["训练", "饮食", "恢复", "心得"];
const categoryIcons = [Dumbbell, Leaf, Wind, Sparkles];
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const shortDate = (d: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(new Date(d + "T00:00:00+08:00"));
async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const r = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw new Error("服务暂时没有响应，请稍后重试");
  }
  if (!r.ok) throw new Error(data.error || "网络请求失败，请重试");
  return data;
}
function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className={cn("modal", wide && "wide")}>
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="关闭弹窗">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function App() {
  const [user, setUser] = useState<User | null>(null),
    [demo, setDemo] = useState(false),
    [view, setView] = useState("home"),
    [authOpen, setAuthOpen] = useState(false),
    [authMode, setAuthMode] = useState("register"),
    [editor, setEditor] = useState<Entry | null | false>(false),
    [settings, setSettings] = useState(false),
    [entries, setEntries] = useState<Entry[]>([]),
    [stats, setStats] = useState<Stats>({
      total: 0,
      streak: 0,
      minutes: 0,
      week: 0,
    }),
    [feed, setFeed] = useState<Entry[]>([]),
    [category, setCategory] = useState(""),
    [search, setSearch] = useState(""),
    [searchDraft, setSearchDraft] = useState(""),
    [page, setPage] = useState(0),
    [hasMore, setHasMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<Entry | null>(null),
    [deleteEntry, setDeleteEntry] = useState<Entry | null>(null),
    [deleteError, setDeleteError] = useState(""),
    [deleting, setDeleting] = useState(false),
    [recordFilter, setRecordFilter] = useState("all");
  const refresh = () => setRevision((x) => x + 1);
  useEffect(() => {
    api("/me")
      .then((d) => {
        setUser(d.user);
        setDemo(d.demo);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api(
      `/community?category=${encodeURIComponent(category)}&search=${encodeURIComponent(search)}&page=${page}`,
    )
      .then((d) => {
        if (active) {
          setFeed(d.entries);
          setHasMore(d.hasMore);
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [category, search, page, revision]);
  useEffect(() => {
    let active = true;
    if (user)
      api("/entries")
        .then((d) => {
          if (active) {
            setEntries(d.entries);
            setStats(d.stats);
          }
        })
        .catch((e) => active && setError(e.message));
    else {
      setEntries([]);
      setStats({ total: 0, streak: 0, minutes: 0, week: 0 });
    }
    return () => {
      active = false;
    };
  }, [user, revision]);
  const requireUser = (fn: () => void) => {
    if (user) fn();
    else setAuthOpen(true);
  };
  const newEntry = () =>
    requireUser(() =>
      setEditor(entries.find((e) => e.date === today()) || null),
    );
  const onLogin = (u: User) => {
    setUser(u);
    setAuthOpen(false);
    refresh();
    setNotice("欢迎回来，把今天也记录下来吧。");
  };
  const navigate = (v: string) => {
    setView(v);
    setSearch("");
    setSearchDraft("");
    setCategory("");
    setPage(0);
    setNotice("");
  };
  async function like(e: Entry) {
    requireUser(async () => {
      try {
        await api(`/entries/${e.id}/like`, {
          method: "POST",
          body: JSON.stringify({ liked: !e.liked }),
        });
        refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }
  async function logout() {
    await api("/auth/logout", { method: "POST", body: "{}" });
    setUser(null);
    setSettings(false);
    setSelected(null);
    setEditor(false);
    setNotice("你已退出登录。");
    refresh();
  }
  const done = entries.some((e) => e.date === today());
  const visibleRecords = entries.filter(
    (e) => recordFilter === "all" || e.visibility === recordFilter,
  );
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("home");
          }}
        >
          <img src="/mark.svg" alt="" />
          <span>
            大水肌薄<span className="brand-sub">一 起 慢 慢 变 强</span>
          </span>
        </a>
        <div className="nav-label">我的运动生活</div>
        <nav>
          {[
            ["home", "今日概览", Home],
            ["records", "我的记录", NotebookPen],
            ["growth", "成长轨迹", ChartNoAxesCombined],
            ["community", "社区广场", Compass],
          ].map(([id, label, Icon]: any) => (
            <button
              key={id}
              className={cn("nav-item", view === id && "active")}
              onClick={() => navigate(id)}
            >
              <Icon size={20} />
              {label}
              {id === "community" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="little-leaf">
            <Leaf size={22} />
          </span>
          <h3>每一点坚持，都算数。</h3>
          <p>
            不必和别人比进度，
            <br />
            照顾好自己的节奏。
          </p>
          <span className="note-line" />
        </div>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() => requireUser(() => setSettings(true))}
          >
            <Settings2 size={19} />
            个人设置
          </button>
          {user ? (
            <div className="user-row">
              <span className="avatar">{user.name[0]}</span>
              <div>
                <strong>{user.name}</strong>
                <small>今天也为自己加油</small>
              </div>
              <button
                className="icon-button"
                aria-label="退出登录"
                onClick={async () => {
                  try {
                    await logout();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <button className="login-side" onClick={() => setAuthOpen(true)}>
              登录 / 加入社区 <ArrowUpRight size={16} />
            </button>
          )}
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            大水肌薄社区 <span>/</span>{" "}
            <b>
              {
                {
                  home: "今日概览",
                  records: "我的记录",
                  growth: "成长轨迹",
                  community: "社区广场",
                }[view]
              }
            </b>
          </span>
          <div className="top-actions">
            <span className="today-date">
              {new Intl.DateTimeFormat("zh-CN", {
                month: "long",
                day: "numeric",
                weekday: "long",
                timeZone: "Asia/Shanghai",
              }).format(new Date())}
            </span>
            <button
              className="small-avatar"
              aria-label={user ? "打开个人设置" : "登录账号"}
              onClick={() => (user ? setSettings(true) : setAuthOpen(true))}
            >
              {user?.name[0] || "水"}
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "home"
                  ? "A LITTLE BETTER, EVERY DAY."
                  : view === "community"
                    ? "GROW TOGETHER."
                    : view === "growth"
                      ? "YOUR OWN PACE."
                      : "MAKE EVERY DAY COUNT."}
              </div>
              <h1>
                {view === "home"
                  ? `${user ? user.name.replace(" · 示例", "") : "同路人"}，今天也向前一点。`
                  : view === "community"
                    ? "在这里，找到同路人。"
                    : view === "growth"
                      ? "你的坚持，有迹可循。"
                      : "留住每一个认真生活的日子。"}
              </h1>
              <p>
                {view === "home"
                  ? "记录日常，分享心得。让微小的坚持，长成看得见的改变。"
                  : view === "community"
                    ? "分享真实的日常，也从彼此的经历里汲取一点力量。"
                    : view === "growth"
                      ? "成长不只有一个数字，每一次出现都值得被看见。"
                      : "公开分享或只留给自己，每一份记录都由你决定。"}
              </p>
            </div>
            <button className="primary" onClick={newEntry}>
              <Plus size={18} />
              {done ? "编辑今日打卡" : "记一笔今天"}
            </button>
          </div>
          {notice && (
            <div className="notice" role="status">
              <CheckCheck size={18} />
              {notice}
              <button
                className="icon-button"
                aria-label="关闭提示"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={refresh}>重试</button>
            </div>
          )}
          {view === "home" && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-kicker">
                    <span /> 不赶路，感受路。
                  </span>
                  <h2>
                    把每一天，
                    <br />
                    练成自己的样子<span>。</span>
                  </h2>
                  <p>
                    一次训练，一顿好饭，一场好眠。
                    <br />
                    身体记得，你付出的每一点努力。
                  </p>
                  <button className="hero-button" onClick={newEntry}>
                    {done ? "今天的努力，已记录" : "开始今天的打卡"}
                    {done ? <Check size={18} /> : <ArrowUpRight size={19} />}
                  </button>
                  <span className="hero-foot">记录是写给未来自己的信</span>
                </div>
                <img
                  className="hero-art"
                  src="/weights.svg"
                  alt="绿色哑铃插画"
                />
                <span className="hero-edition">DAILY PRACTICE / 01</span>
              </section>
              <section className="metrics">
                <Metric
                  icon={<Flame />}
                  label="连续打卡"
                  value={stats.streak}
                  unit="天"
                  note={
                    stats.streak
                      ? "把自己的节奏保持下去"
                      : "从今天，开始新的坚持"
                  }
                />
                <Metric
                  icon={<CheckCheck />}
                  label="累计记录"
                  value={stats.total}
                  unit="次"
                  note="每一次记录，都是成长的注脚"
                />
                <Metric
                  icon={<Clock3 />}
                  label="本周打卡"
                  value={stats.week}
                  unit={`/ ${user?.weeklyTarget || 4} 天`}
                  note={
                    user
                      ? `本周目标：${user.weeklyTarget} 天，按自己的节奏来`
                      : "登录后，开启你的每周小目标"
                  }
                  progress={stats.week / (user?.weeklyTarget || 4)}
                />
              </section>
            </>
          )}
          <div
            className={cn("content-grid", view === "growth" && "growth-grid")}
          >
            <div className="primary-column">
              {(view === "home" || view === "community") && (
                <>
                  <div className="section-heading">
                    <div>
                      <h2>
                        社区里的日常 <span className="tiny-dot" />
                      </h2>
                      <p>真实的分享，比完美的答案更有力量。</p>
                    </div>
                    {view === "home" && (
                      <button
                        className="text-button"
                        onClick={() => navigate("community")}
                      >
                        逛逛社区 <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                  <div className="feed-toolbar">
                    <div className="tabs" aria-label="记录分类">
                      {["全部", ...categories].map((c) => (
                        <button
                          key={c}
                          aria-pressed={category === (c === "全部" ? "" : c)}
                          className={cn(
                            category === (c === "全部" ? "" : c) && "selected",
                          )}
                          onClick={() => {
                            setCategory(c === "全部" ? "" : c);
                            setPage(0);
                          }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    {view === "community" && (
                      <form
                        className="search-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          setSearch(searchDraft);
                          setPage(0);
                        }}
                      >
                        <Search size={16} />
                        <input
                          aria-label="搜索心得"
                          placeholder="搜索心得…"
                          value={searchDraft}
                          onChange={(e) => setSearchDraft(e.target.value)}
                        />
                        <button aria-label="提交搜索">
                          <ArrowRight size={17} />
                        </button>
                      </form>
                    )}
                  </div>
                  {demo && (
                    <p className="demo-label">
                      预览环境 · 带「示例」的内容用于展示，新注册账号从零开始。
                    </p>
                  )}
                  {loading ? (
                    <div className="skeleton" aria-label="加载记录中">
                      <div />
                      <div />
                      <div />
                    </div>
                  ) : feed.length ? (
                    feed.map((e) => (
                      <EntryCard
                        key={e.id}
                        entry={e}
                        onLike={() => like(e)}
                        onComments={() => setSelected(e)}
                        onEdit={
                          e.userId === user?.id ? () => setEditor(e) : undefined
                        }
                      />
                    ))
                  ) : (
                    <Empty
                      title="这里的第一份分享，等你来写。"
                      text="把今天的小收获公开，让更多同路人看见。"
                      action="写一条打卡"
                      onAction={newEntry}
                    />
                  )}
                  <div className="pagination">
                    {page > 0 && (
                      <button
                        className="secondary"
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ChevronLeft size={16} />
                        上一页
                      </button>
                    )}
                    {hasMore && (
                      <button
                        className="secondary"
                        onClick={() => setPage((p) => p + 1)}
                      >
                        下一页
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </div>
                </>
              )}
              {view === "records" && (
                <>
                  <div className="section-heading">
                    <h2>
                      我的打卡 <span className="count">{entries.length}</span>
                    </h2>
                    {user && (
                      <a className="text-button" href="/api/export" download>
                        <Download size={16} />
                        导出记录
                      </a>
                    )}
                  </div>
                  <div className="tabs record-tabs">
                    {[
                      ["all", "全部记录"],
                      ["private", "仅自己可见"],
                      ["public", "公开记录"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        className={cn(recordFilter === id && "selected")}
                        aria-pressed={recordFilter === id}
                        onClick={() => setRecordFilter(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {visibleRecords.length ? (
                    visibleRecords.map((e) => (
                      <EntryCard
                        key={e.id}
                        entry={e}
                        onLike={() => like(e)}
                        onComments={() => setSelected(e)}
                        onEdit={() => setEditor(e)}
                        onDelete={() => {
                          setDeleteEntry(e);
                          setDeleteError("");
                        }}
                      />
                    ))
                  ) : (
                    <Empty
                      title={
                        user
                          ? "你的成长故事，从这一页开始。"
                          : "给自己一个记录成长的地方。"
                      }
                      text="训练、饮食、恢复，或只是今天的一个念头。"
                      action={user ? "记录第一天" : "登录并开始记录"}
                      onAction={newEntry}
                    />
                  )}
                </>
              )}
              {view === "growth" && (
                <>
                  <section className="metrics growth-metrics">
                    <Metric
                      icon={<Flame />}
                      label="连续打卡"
                      value={stats.streak}
                      unit="天"
                      note="坚持自己的节奏"
                    />
                    <Metric
                      icon={<NotebookPen />}
                      label="累计打卡"
                      value={stats.total}
                      unit="次"
                      note="认真生活的证据"
                    />
                    <Metric
                      icon={<Clock3 />}
                      label="累计活动"
                      value={stats.minutes}
                      unit="分钟"
                      note="为自己投入的时间"
                    />
                  </section>
                  <GrowthChart entries={entries} />
                  <div className="panel reflection">
                    <span className="eyebrow">A NOTE TO YOURSELF</span>
                    <h2>慢一点，也是在向前。</h2>
                    <p>
                      {user?.goal || "先留下今天的记录，再回头看看走过的路。"}
                    </p>
                    <button
                      className="text-button"
                      onClick={() => requireUser(() => setSettings(true))}
                    >
                      调整我的小目标 <ArrowUpRight size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
            <aside className="right-column">
              <Calendar entries={entries} />
              <section className="panel weekly">
                <div className="section-heading">
                  <h3>本周的小目标</h3>
                  <Target size={18} />
                </div>
                <div className="goal-number">
                  <strong>{stats.week}</strong>
                  <span>/ {user?.weeklyTarget || 4} 天</span>
                  <span className="goal-pill">
                    {stats.week >= (user?.weeklyTarget || 4)
                      ? "目标达成"
                      : "慢慢积累"}
                  </span>
                </div>
                <div className="week-bars">
                  {Array.from({ length: user?.weeklyTarget || 4 }, (_, i) => (
                    <span key={i} className={cn(i < stats.week && "filled")} />
                  ))}
                </div>
                <p>{user?.goal || "规律运动，慢慢变强。"}</p>
                <button
                  className="text-button"
                  onClick={() => requireUser(() => setSettings(true))}
                >
                  设置我的目标 <ArrowRight size={14} />
                </button>
              </section>
              <section className="privacy-note">
                <LockKeyhole size={19} />
                <div>
                  <h3>有些成长，只属于你</h3>
                  <p>
                    打卡默认仅自己可见。
                    <br />
                    准备好分享时，再让大家看见。
                  </p>
                </div>
              </section>
              <div className="community-values">
                <span>真实记录</span>
                <span>友善交流</span>
                <span>尊重节奏</span>
              </div>
            </aside>
          </div>
          <footer>
            大水肌薄社区 <span>·</span> 不求一天改变很多，只求每天认真一点。
            <span className="footer-right">GROW AT YOUR OWN PACE.</span>
          </footer>
        </main>
      </div>
      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        mode={authMode}
        setMode={setAuthMode}
        onLogin={onLogin}
        demo={demo}
      />
      {editor !== false && (
        <Editor
          entry={editor}
          onClose={() => setEditor(false)}
          onSaved={() => {
            setEditor(false);
            refresh();
            setNotice("已保存。今天的这一点努力，未来的你会看见。");
          }}
        />
      )}
      {settings && user && (
        <Settings
          user={user}
          onLogout={logout}
          onClose={() => setSettings(false)}
          onSaved={(u) => {
            setUser(u);
            setSettings(false);
            setNotice("小目标已更新，按自己的节奏来。");
          }}
        />
      )}
      {selected && (
        <Comments
          entry={selected}
          user={user}
          onClose={() => setSelected(null)}
          onAuth={() => setAuthOpen(true)}
          onChanged={refresh}
        />
      )}
      <AlertDialog.Root
        open={!!deleteEntry}
        onOpenChange={(v) => {
          if (!v && !deleting) setDeleteEntry(null);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="overlay" />
          <AlertDialog.Content className="modal">
            <AlertDialog.Title>删除这条成长记录？</AlertDialog.Title>
            <AlertDialog.Description>
              记录、照片和相关评论会一起删除，无法恢复。
            </AlertDialog.Description>
            {deleteError && (
              <p className="error" role="alert">
                {deleteError}
              </p>
            )}
            <div className="form-actions">
              <AlertDialog.Cancel asChild>
                <button className="secondary" disabled={deleting}>
                  保留记录
                </button>
              </AlertDialog.Cancel>
              <button
                className="danger"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await api("/entries/" + deleteEntry!.id, {
                      method: "DELETE",
                      body: "{}",
                    });
                    setDeleteEntry(null);
                    refresh();
                    setNotice("记录已删除。");
                  } catch (e) {
                    setDeleteError((e as Error).message);
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? "删除中…" : "确认删除"}
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
function Metric({
  icon,
  label,
  value,
  unit,
  note,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  note: string;
  progress?: number;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <div className="metric-value">
        {value}
        <span>{unit}</span>
        {progress !== undefined && (
          <span className="mini-progress">
            <span style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </span>
        )}
      </div>
      <p>{note}</p>
    </div>
  );
}
function EntryCard({
  entry: e,
  onLike,
  onComments,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  onLike: () => void;
  onComments: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const Icon = categoryIcons[categories.indexOf(e.category)] || NotebookPen;
  return (
    <article className="entry-card">
      <div className="entry-header">
        <span
          className={cn("avatar", `avatar-${categories.indexOf(e.category)}`)}
        >
          {e.author[0]}
        </span>
        <div className="author">
          <strong>{e.author}</strong>
          <span>
            {shortDate(e.date)} <span>·</span> {e.mood}
          </span>
        </div>
        <span className="category-tag">
          <Icon size={13} />
          {e.category}
        </span>
      </div>
      <h3>{e.title}</h3>
      <p className="entry-content">{e.content}</p>
      {e.hasPhoto && (
        <img
          className="entry-photo"
          src={`/api/entries/${e.id}/photo`}
          alt={`${e.title}的打卡照片`}
          loading="lazy"
        />
      )}
      <div className="entry-chips">
        {e.minutes > 0 && (
          <span>
            <Clock3 size={13} />
            {e.minutes} 分钟
          </span>
        )}
        {e.weight !== null && <span>{e.weight} kg</span>}
        <span>
          {e.visibility === "private" ? (
            <LockKeyhole size={13} />
          ) : (
            <Globe2 size={13} />
          )}{" "}
          {e.visibility === "private" ? "仅自己可见" : "公开分享"}
        </span>
      </div>
      <div className="entry-actions">
        <button
          className={cn(e.liked && "liked")}
          aria-label={e.liked ? "取消点赞" : "为这份坚持点赞"}
          aria-pressed={e.liked}
          onClick={onLike}
        >
          <Heart size={17} fill={e.liked ? "currentColor" : "none"} />
          {e.likes || "加个油"}
        </button>
        <button onClick={onComments}>
          <MessageCircle size={17} />
          {e.comments || "聊一聊"}
        </button>
        <div className="entry-owner-actions">
          {onEdit && (
            <button onClick={onEdit} aria-label="编辑记录">
              <Pencil size={16} />
              <span>编辑</span>
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} aria-label="删除记录">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
function Empty({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <NotebookPen size={28} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="primary" onClick={onAction}>
        <Plus size={17} />
        {action}
      </button>
    </div>
  );
}
function Calendar({ entries }: { entries: Entry[] }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const date = new Date(month + "-01T00:00:00Z"),
    year = date.getUTCFullYear(),
    m = date.getUTCMonth(),
    days = new Date(Date.UTC(year, m + 1, 0)).getUTCDate(),
    offset = (date.getUTCDay() + 6) % 7;
  const dates = new Set(entries.map((e) => e.date));
  const change = (n: number) =>
    setMonth(new Date(Date.UTC(year, m + n, 1)).toISOString().slice(0, 7));
  return (
    <section className="panel calendar">
      <div className="section-heading">
        <h3>我的打卡日历</h3>
        <CalendarDays size={17} />
      </div>
      <div className="calendar-nav">
        <b>
          {year} 年 {m + 1} 月
        </b>
        <div>
          <button
            className="icon-button"
            onClick={() => change(-1)}
            aria-label="上个月"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="icon-button"
            onClick={() => change(1)}
            aria-label="下个月"
            disabled={month >= today().slice(0, 7)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
          <span className="day-label" key={d}>
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={"blank" + i} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const key = `${month}-${String(i + 1).padStart(2, "0")}`;
          return (
            <span
              key={key}
              className={cn(
                "calendar-day",
                dates.has(key) && "checked",
                key === today() && "today",
              )}
              title={`${key}${dates.has(key) ? " 已打卡" : ""}`}
              aria-label={`${key}${dates.has(key) ? " 已打卡" : ""}${key === today() ? " 今天" : ""}`}
            >
              {i + 1}
              {dates.has(key) && <i />}
            </span>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span>
          <i />
          已打卡
        </span>
        <span>
          本月 <b>{entries.filter((e) => e.date.startsWith(month)).length}</b>{" "}
          天
        </span>
      </div>
    </section>
  );
}
function GrowthChart({ entries }: { entries: Entry[] }) {
  const [metric, setMetric] = useState("minutes");
  const data = [...entries]
    .reverse()
    .slice(-14)
    .filter((e) => metric === "minutes" || e.weight !== null);
  const values = data.map((e) =>
      metric === "minutes" ? e.minutes : e.weight!,
    ),
    max = Math.max(...values, 1),
    min = metric === "minutes" ? 0 : Math.min(...values) - 1,
    range = Math.max(1, max - min);
  const points = values
    .map(
      (v, i) =>
        `${55 + (i / Math.max(values.length - 1, 1)) * 580},${180 - ((v - min) / range) * 135}`,
    )
    .join(" ");
  return (
    <section className="panel chart-panel">
      <div className="section-heading">
        <div>
          <h2>记录里的变化</h2>
          <p>
            最近 14 次记录 ·{" "}
            {metric === "minutes" ? "活动时长 / 分钟" : "体重 / kg"}
          </p>
        </div>
        <select
          aria-label="趋势指标"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
        >
          <option value="minutes">活动时长</option>
          <option value="weight">体重变化</option>
        </select>
      </div>
      {data.length ? (
        <>
          <svg
            viewBox="0 0 680 240"
            role="img"
            aria-label={metric === "minutes" ? "活动时长趋势" : "体重趋势"}
          >
            <title>
              {data.map((e, i) => `${e.date}: ${values[i]}`).join("; ")}
            </title>
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <line
                  x1="55"
                  x2="640"
                  y1={45 + i * 45}
                  y2={45 + i * 45}
                  stroke="#e7ebe5"
                />
                <text x="8" y={49 + i * 45} fill="#72796f" fontSize="12">
                  {Math.round((max - (i * range) / 3) * 10) / 10}
                </text>
              </g>
            ))}
            <polyline
              points={points}
              fill="none"
              stroke="#42664b"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {values.map((v, i) => (
              <circle
                key={i}
                cx={55 + (i / Math.max(values.length - 1, 1)) * 580}
                cy={180 - ((v - min) / range) * 135}
                r="4"
                fill="#42664b"
              />
            ))}
            <text x="55" y="220" fontSize="12" fill="#72796f">
              {shortDate(data[0].date)}
            </text>
            <text x="640" y="220" textAnchor="end" fontSize="12" fill="#72796f">
              {shortDate(data[data.length - 1].date)}
            </text>
          </svg>
          <details className="chart-data">
            <summary>查看详细数据</summary>
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>{metric === "minutes" ? "分钟" : "kg"}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((e, i) => (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>{values[i]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      ) : (
        <div className="chart-empty">
          <ChartNoAxesCombined size={32} />
          <p>
            {metric === "weight"
              ? "在打卡时填写体重，就能看到变化。"
              : "留下第一条记录，这里会慢慢长出你的轨迹。"}
          </p>
        </div>
      )}
    </section>
  );
}
function AuthModal({
  open,
  onOpenChange,
  mode,
  setMode,
  onLogin,
  demo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: string;
  setMode: (v: string) => void;
  onLogin: (u: User) => void;
  demo: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const d = await api("/auth/" + mode, {
        method: "POST",
        body: JSON.stringify(values),
      });
      onLogin(d.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        mode === "register" ? "从今天开始，慢慢变强。" : "欢迎回来，同路人。"
      }
      description="加入大水肌薄社区，为自己留下一份成长记录。"
    >
      <form onSubmit={submit} className="form">
        {mode === "register" && (
          <label>
            怎么称呼你
            <input
              name="name"
              required
              maxLength={24}
              autoComplete="nickname"
              placeholder="你的昵称"
            />
          </label>
        )}
        <label>
          邮箱
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>
        <label>
          密码
          <input
            name="password"
            type="password"
            minLength={10}
            maxLength={128}
            required
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            placeholder="至少 10 位字符"
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          {busy
            ? "稍等一下…"
            : mode === "register"
              ? "创建账号，开始记录"
              : "登录"}
        </button>
      </form>
      <button
        className="auth-switch"
        onClick={() => {
          setMode(mode === "register" ? "login" : "register");
          setError("");
        }}
      >
        {mode === "register" ? "已经有账号？去登录" : "还没有账号？加入社区"}
      </button>
      {demo && (
        <button
          className="demo-button"
          disabled={busy}
          onClick={async () => {
            setError("");
            setBusy(true);
            try {
              const d = await api("/auth/login", {
                method: "POST",
                body: JSON.stringify({
                  email: "demo@dashui.local",
                  password: "DashuiDemo2026!",
                }),
              });
              onLogin(d.user);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          体验示例账号 <ArrowUpRight size={15} />
        </button>
      )}
      <p className="auth-foot">
        <LockKeyhole size={13} />
        你的记录默认私密，由你决定是否分享。
      </p>
    </Modal>
  );
}
function Editor({
  entry,
  onClose,
  onSaved,
}: {
  entry: Entry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState(entry?.category || "训练"),
    [visibility, setVisibility] = useState(entry?.visibility || "private"),
    [photo, setPhoto] = useState<string | null | undefined>(undefined),
    [preview, setPreview] = useState(
      entry?.hasPhoto ? `/api/entries/${entry.id}/photo` : "",
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reading, setReading] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("/entries" + (entry ? "/" + entry.id : ""), {
        method: entry ? "PUT" : "POST",
        body: JSON.stringify({
          ...f,
          category,
          visibility,
          minutes: Number(f.minutes),
          weight: f.weight ? Number(f.weight) : null,
          photo,
        }),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
      title={entry ? "编辑这一天的记录" : "今天，为自己做了什么？"}
      description="不用很厉害，也不用很完整。真实记录就很好。"
      wide
    >
      <form className="form" onSubmit={submit}>
        <div className="category-choices" aria-label="打卡类型">
          {categories.map((c, i) => {
            const Icon = categoryIcons[i];
            return (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                className={cn(category === c && "chosen")}
                onClick={() => setCategory(c)}
              >
                <Icon size={19} />
                {c}
              </button>
            );
          })}
        </div>
        <div className="form-row">
          <label>
            记录日期
            <input
              name="date"
              type="date"
              min="2000-01-01"
              max={today()}
              defaultValue={entry?.date || today()}
              required
            />
          </label>
          <label>
            今天的状态
            <select name="mood" defaultValue={entry?.mood || "平稳踏实"}>
              {["状态很棒", "平稳踏实", "有点疲惫"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          给今天一个小标题
          <input
            name="title"
            placeholder="比如：练完背，心情也舒展开了"
            maxLength={80}
            defaultValue={entry?.title}
            required
          />
        </label>
        <label>
          今日心得
          <textarea
            name="content"
            placeholder="做了什么？有什么感受？记下一点想留给未来自己的话……"
            rows={5}
            maxLength={3000}
            defaultValue={entry?.content}
            required
          />
        </label>
        <div className="form-row">
          <label>
            活动时长（分钟）
            <input
              name="minutes"
              type="number"
              min={0}
              max={1440}
              defaultValue={entry?.minutes || 0}
              required
            />
          </label>
          <label>
            体重（kg，可选）
            <input
              name="weight"
              type="number"
              min={20}
              max={350}
              step="0.1"
              placeholder="按需记录，不必每天称"
              defaultValue={entry?.weight ?? ""}
            />
          </label>
        </div>
        <div className="photo-upload">
          <label className="photo-label">
            <ImagePlus size={18} />
            {reading ? "正在读取照片…" : "加一张今天的照片"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={reading || busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 5 * 1024 * 1024) {
                  setError("图片需小于 5MB");
                  e.target.value = "";
                  return;
                }
                setReading(true);
                setError("");
                const r = new FileReader();
                r.onload = () => {
                  setPhoto(String(r.result));
                  setPreview(String(r.result));
                  setReading(false);
                };
                r.onerror = () => {
                  setError("读取照片失败，请重新选择");
                  setReading(false);
                };
                r.readAsDataURL(f);
              }}
            />
          </label>
          <small>JPG / PNG / WebP，最大 5MB</small>
          {preview && (
            <div className="photo-preview">
              <img src={preview} alt="待保存的打卡照片" />
              <button
                type="button"
                className="icon-button"
                aria-label="移除照片"
                onClick={() => {
                  setPhoto(null);
                  setPreview("");
                }}
              >
                <X size={18} />
              </button>
            </div>
          )}
        </div>
        <fieldset className="visibility">
          <legend>谁可以看见这条记录？</legend>
          <label className={cn(visibility === "private" && "chosen")}>
            <input
              type="radio"
              name="visibility"
              checked={visibility === "private"}
              onChange={() => setVisibility("private")}
            />
            <LockKeyhole size={19} />
            <span>
              <b>仅自己可见</b>
              <small>给自己留一份安静的成长</small>
            </span>
          </label>
          <label className={cn(visibility === "public" && "chosen")}>
            <input
              type="radio"
              name="visibility"
              checked={visibility === "public"}
              onChange={() => setVisibility("public")}
            />
            <Globe2 size={19} />
            <span>
              <b>公开到社区</b>
              <small>与同路人分享，也互相鼓励</small>
            </span>
          </label>
        </fieldset>
        {visibility === "public" && (
          <p className="form-hint">
            本条记录的文字、体重与照片都将公开到社区。
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={busy}
          >
            再想一想
          </button>
          <button className="primary" disabled={busy || reading}>
            <Check size={17} />
            {busy ? "正在保存…" : "保存这一天"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Settings({
  user,
  onClose,
  onSaved,
  onLogout,
}: {
  user: User;
  onClose: () => void;
  onSaved: (u: User) => void;
  onLogout: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="按自己的节奏来"
      description="一个刚刚好的目标，比一个遥远的目标更容易坚持。"
    >
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const d = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const r = await api("/me", {
              method: "PATCH",
              body: JSON.stringify({
                ...d,
                weeklyTarget: Number(d.weeklyTarget),
              }),
            });
            onSaved(r.user);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          昵称
          <input name="name" defaultValue={user.name} maxLength={24} required />
        </label>
        <label>
          写给自己的小目标
          <input
            name="goal"
            defaultValue={user.goal}
            maxLength={100}
            required
          />
        </label>
        <label>
          每周想打卡几天
          <select name="weeklyTarget" defaultValue={user.weeklyTarget}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option value={n} key={n}>
                {n} 天
              </option>
            ))}
          </select>
        </label>
        <p className="form-hint">账号邮箱：{user.email}</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          {busy ? "保存中…" : "保存我的目标"}
        </button>
        <button
          type="button"
          className="secondary full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onLogout();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <LogOut size={16} />
          退出登录
        </button>
      </form>
    </Modal>
  );
}
function Comments({
  entry,
  user,
  onClose,
  onAuth,
  onChanged,
}: {
  entry: Entry;
  user: User | null;
  onClose: () => void;
  onAuth: () => void;
  onChanged: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [content, setContent] = useState(""),
    [loading, setLoading] = useState(true);
  const reload = () =>
    api(`/entries/${entry.id}/comments`).then((d) => setComments(d.comments));
  useEffect(() => {
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [entry.id]);
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="给同路人一点回应"
      description={entry.title}
    >
      <div className="comment-list">
        {loading ? (
          <p>正在加载回应…</p>
        ) : comments.length ? (
          comments.map((c) => (
            <div className="comment" key={c.id}>
              <span className="avatar">{c.author[0]}</span>
              <div>
                <b>{c.author}</b>
                <small>
                  {new Date(c.createdAt).toLocaleDateString("zh-CN")}
                </small>
                <p>{c.content}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">还没有回应，送出第一句鼓励吧。</p>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {user ? (
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            try {
              await api(`/entries/${entry.id}/comments`, {
                method: "POST",
                body: JSON.stringify({ content }),
              });
              setContent("");
              await reload();
              onChanged();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            你的回应
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              maxLength={500}
              rows={3}
              placeholder="分享经验，也别忘了友善与尊重。"
            />
          </label>
          <button className="primary" disabled={busy || !content.trim()}>
            {busy ? "发送中…" : "发送回应"}
            <ArrowRight size={16} />
          </button>
        </form>
      ) : (
        <button className="primary full" onClick={onAuth}>
          登录后参与交流
        </button>
      )}
    </Modal>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
