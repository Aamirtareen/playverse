import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fileToBase64 } from "@hatch/space-sdk/client";
import { api, type ApiResponse } from "./api";

type Game = ApiResponse<typeof api, "adminListGames">["games"][number];
type Category = ApiResponse<typeof api, "adminListCategories">["categories"][number];

const TOKEN_KEY = "pv-admin-token";

function getToken(): string {
  try { return sessionStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; }
}
function setToken(t: string) {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable */ }
}

const inputCls = "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";
const labelCls = "mb-1 block text-xs font-extrabold uppercase tracking-wide text-[var(--dim)]";
const btnPrimary = "rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white shadow hover:brightness-110 disabled:opacity-50";
const btnGhost = "rounded-full bg-[var(--surface-alt)] px-4 py-2 text-sm font-bold hover:brightness-95 disabled:opacity-50";
const btnDanger = "rounded-full bg-red-500 px-4 py-2 text-sm font-bold text-white shadow hover:brightness-110 disabled:opacity-50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    published: "bg-green-100 text-green-800",
    draft: "bg-slate-200 text-slate-700",
    pending: "bg-amber-100 text-amber-800",
    archived: "bg-red-100 text-red-700",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${colors[status] ?? "bg-slate-200"}`}>{status.toUpperCase()}</span>;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/* ------------------------------------------------------------ auth gate */
function AuthGate({ onAuthed }: { onAuthed: (token: string) => void }) {
  const status = useQuery({ queryKey: ["admin-status"], queryFn: () => api.adminStatus({}) });
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const setup = useMutation({
    mutationFn: () => api.adminSetup({ username, displayName, password }),
    onSuccess: (r) => { setToken(r.token); onAuthed(r.token); },
    onError: (e) => setError(errMsg(e)),
  });
  const login = useMutation({
    mutationFn: () => api.adminLogin({ username, password }),
    onSuccess: (r) => { setToken(r.token); onAuthed(r.token); },
    onError: (e) => setError(errMsg(e)),
  });
  const setupRequired = status.data?.setupRequired;
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-soft)] px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl ring-1 ring-[var(--border)]">
        <p className="text-center text-4xl" aria-hidden>🛡️</p>
        <h1 className="mt-2 text-center text-2xl font-extrabold">PlayVerse Admin</h1>
        <p className="mt-1 text-center text-sm text-[var(--dim)]">
          {setupRequired
            ? "No admin account exists yet. Create the owner account to unlock the dashboard — this form disappears once an owner exists."
            : "Sign in with your admin account. Every admin action is verified on the server against your role."}
        </p>
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            if (setupRequired) setup.mutate();
            else login.mutate();
          }}
        >
          <div>
            <label className={labelCls} htmlFor="adm-user">Username</label>
            <input id="adm-user" className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required aria-label="Username" />
          </div>
          {setupRequired && (
            <div>
              <label className={labelCls} htmlFor="adm-name">Display name</label>
              <input id="adm-name" className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" aria-label="Display name" />
            </div>
          )}
          <div>
            <label className={labelCls} htmlFor="adm-pass">Password {setupRequired && "(min. 8 characters)"}</label>
            <input id="adm-pass" type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password"
              autoComplete={setupRequired ? "new-password" : "current-password"} required minLength={setupRequired ? 8 : 1} />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
          <button type="submit" className={`${btnPrimary} w-full`} disabled={setup.isPending || login.isPending}>
            {setupRequired ? "Create owner account" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- dashboard */
function DashboardTab({ token, goGames }: { token: string; goGames: () => void }) {
  const dash = useQuery({ queryKey: ["admin-dash", token], queryFn: () => api.adminDashboard({ token }) });
  if (dash.isPending) return <p className="font-semibold text-[var(--dim)]">Loading dashboard…</p>;
  if (dash.error) return <p className="font-semibold text-red-600">{errMsg(dash.error)}</p>;
  const d = dash.data!;
  const cards: [string, number, string][] = [
    ["Total games", d.totalGames, "🎮"],
    ["Published", d.published, "✅"],
    ["Drafts", d.drafts, "📝"],
    ["Pending review", d.pending, "⏳"],
    ["Categories", d.categories, "🧭"],
    ["Game launches", d.totalPlays, "🚀"],
    ["Page views", d.pageViews, "👀"],
    ["Searches", d.searches, "🔍"],
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value, icon]) => (
          <div key={label} className="rounded-3xl bg-white p-4 ring-1 ring-[var(--border)]">
            <p className="text-2xl" aria-hidden>{icon}</p>
            <p className="mt-1 text-3xl font-extrabold">{value.toLocaleString()}</p>
            <p className="text-sm font-semibold text-[var(--dim)]">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
          <h2 className="font-extrabold">Recently added</h2>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {d.recent.map((g) => (
              <li key={g.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{g.title}</span>
                <StatusPill status={g.status} />
              </li>
            ))}
            {d.recent.length === 0 && <li className="py-2 text-[var(--dim)]">No games yet.</li>}
          </ul>
          <button type="button" className={`${btnPrimary} mt-3`} onClick={goGames}>Manage games</button>
        </div>
        <div className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
          <h2 className="font-extrabold">Most played</h2>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {d.mostPlayed.map((g) => (
              <li key={g.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{g.title}</span>
                <span className="text-sm font-bold text-[var(--accent)]">▶ {g.playCount.toLocaleString()}</span>
              </li>
            ))}
            {d.mostPlayed.every((g) => g.playCount === 0) && <li className="py-2 text-[var(--dim)]">No launches recorded yet — plays appear here as visitors play.</li>}
          </ul>
          <h2 className="mt-4 font-extrabold">Provider integrations</h2>
          <ul className="mt-2 space-y-1.5">
            {d.providers.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${p.status === "connected" ? "bg-green-500" : p.status === "configured" ? "bg-amber-400" : p.status === "error" ? "bg-red-500" : "bg-slate-300"}`} aria-hidden />
                <span className="font-semibold">{p.name}</span>
                <span className="text-[var(--dim)]">{p.status.replace("_", " ")} · {p.gameCount} games</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ game form */
type GameFormState = {
  id?: number;
  title: string; slug: string; description: string; instructions: string;
  rules: string; tips: string; features: string; faqs: string;
  thumbnailUrl: string; thumbnailBlobKey: string;
  gameUrl: string; embedUrl: string; providerId: string;
  gameType: "builtin" | "iframe" | "external"; builtinKey: string;
  controls: string; licenseInfo: string;
  featured: boolean; trending: boolean; isNew: boolean;
  status: "draft" | "pending" | "published" | "archived";
  seoTitle: string; seoDescription: string; categoryIds: number[];
};
const emptyForm: GameFormState = {
  title: "", slug: "", description: "", instructions: "",
  rules: "", tips: "", features: "", faqs: "",
  thumbnailUrl: "", thumbnailBlobKey: "", gameUrl: "", embedUrl: "", providerId: "",
  gameType: "iframe", builtinKey: "", controls: "{}", licenseInfo: "{}",
  featured: false, trending: false, isNew: true, status: "draft",
  seoTitle: "", seoDescription: "", categoryIds: [],
};
// All built-in game keys implemented in the client player (14 originals + the
// 86-game expansion library).
const BUILTIN_KEYS = [
  "snake", "memory", "breakout", "reaction", "merge2048", "flappy", "tictactoe", "racer", "shooter", "wordguess", "match3", "traffic", "bubblepop", "mazedash",
  "asteroids", "zombie-survival", "tank-battle", "dragon-flight", "blade-master", "robot-rampage",
  "pirate-cannon", "sky-turret", "viking-raid", "cyber-chase", "gladiator-arena", "knights-quest",
  "galaxy-invaders", "duck-gallery", "sniper-range", "missile-command", "west-duel", "bubble-shooter", "turret-defense",
  "drift-king", "moto-rush", "kart-chaos", "drag-strip", "boat-gp", "snow-rally", "derby-dash", "speedway-sprint",
  "pong-classic", "mole-mania", "stack-tower", "pinball-mini", "sky-bounce", "road-hopper", "fruit-catch",
  "penalty-shootout", "hoop-shots", "bowling-alley", "mini-golf", "tennis-ace", "archery-master", "boxing-champ", "darts-301",
  "minefield", "sudoku-sprint", "sliding-puzzle", "lights-out", "hanoi", "color-flood", "pipe-connect", "word-search", "block-fit",
  "connect-four", "checkers", "tower-defense", "knights-tour", "sea-battle", "code-breaker",
  "temple-runner", "jungle-swing", "treasure-diver", "cave-explorer", "treasure-hunt", "wizard-tower", "sahara-trek",
  "cookie-bakery", "happy-puppy", "fishing-relax", "echo-beats", "garden-grow",
  "math-quest", "spelling-bee", "counting-carnival", "shape-sorter", "animal-quiz",
  "pong-duel", "tank-duel", "duo-dash", "air-hockey", "tug-of-war",
  "tiny-farm", "city-builder", "lemonade-stand", "aquarium-keeper", "cafe-manager", "airport-control", "train-master",
];
function formFromGame(g: Game): GameFormState {
  return {
    id: g.id, title: g.title, slug: g.slug, description: g.description, instructions: g.instructions,
    rules: g.rules, tips: g.tips.join("\n"), features: g.features.join("\n"),
    faqs: g.faqs.map((f) => `${f.q} | ${f.a}`).join("\n"),
    thumbnailUrl: g.thumbnailUrl?.startsWith("pvblob:") ? "" : (g.thumbnailUrl ?? ""),
    thumbnailBlobKey: g.thumbnailUrl?.startsWith("pvblob:") ? g.thumbnailUrl.slice(7) : "",
    gameUrl: g.gameUrl ?? "", embedUrl: g.embedUrl ?? "",
    providerId: g.providerId ? String(g.providerId) : "",
    gameType: (["builtin", "iframe", "external"].includes(g.gameType) ? g.gameType : "iframe") as GameFormState["gameType"],
    builtinKey: g.builtinKey ?? "", controls: g.controls, licenseInfo: g.licenseInfo,
    featured: g.featured, trending: g.trending, isNew: g.isNew,
    status: g.status as GameFormState["status"],
    seoTitle: g.seoTitle, seoDescription: g.seoDescription,
    categoryIds: g.categories.map((c) => c.id),
  };
}

function GameForm({ token, initial, categories, providers, onDone }: {
  token: string;
  initial: GameFormState;
  categories: Category[];
  providers: { id: number; name: string }[];
  onDone: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof GameFormState>(key: K, value: GameFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const save = useMutation({
    mutationFn: () => api.adminSaveGame({
      token,
      id: form.id,
      title: form.title,
      slug: form.slug || undefined,
      description: form.description,
      instructions: form.instructions,
      rules: form.rules,
      tips: form.tips.split("\n").map((s) => s.trim()).filter(Boolean),
      features: form.features.split("\n").map((s) => s.trim()).filter(Boolean),
      faqs: form.faqs.split("\n").map((s) => s.trim()).filter(Boolean).flatMap((line) => {
        const idx = line.indexOf("|");
        if (idx < 0) return [];
        const q = line.slice(0, idx).trim();
        const a = line.slice(idx + 1).trim();
        return q && a ? [{ q, a }] : [];
      }),
      thumbnailUrl: form.thumbnailBlobKey ? `pvblob:${form.thumbnailBlobKey}` : (form.thumbnailUrl || null),
      thumbnailBlobKey: form.thumbnailBlobKey || null,
      gameUrl: form.gameUrl || null,
      embedUrl: form.embedUrl || null,
      providerId: form.providerId ? Number(form.providerId) : null,
      gameType: form.gameType,
      builtinKey: form.builtinKey || null,
      controls: form.controls,
      licenseInfo: form.licenseInfo,
      featured: form.featured, trending: form.trending, isNew: form.isNew,
      status: form.status,
      seoTitle: form.seoTitle, seoDescription: form.seoDescription,
      categoryIds: form.categoryIds,
    }),
    onSuccess: onDone,
    onError: (e) => setError(errMsg(e)),
  });
  const onThumbFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { dataBase64, mimeType } = await fileToBase64(file);
      const r = await api.adminUploadThumbnail({ token, dataBase64, mimeType });
      set("thumbnailBlobKey", r.blobKey);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setUploading(false);
    }
  };
  return (
    <form
      className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]"
      onSubmit={(e) => { e.preventDefault(); setError(""); save.mutate(); }}
    >
      <h2 className="text-lg font-extrabold">{form.id ? `Edit game — ${form.title}` : "Add a game"}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title *">
          <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} required aria-label="Game title" />
        </Field>
        <Field label="Slug (auto from title if empty)">
          <input className={inputCls} value={form.slug} onChange={(e) => set("slug", e.target.value)} aria-label="Game slug" placeholder="my-game" />
        </Field>
      </div>
      <Field label="Description">
        <textarea className={inputCls} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} aria-label="Game description" />
      </Field>
      <Field label="How to play / instructions">
        <textarea className={inputCls} rows={3} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} aria-label="Game instructions" />
      </Field>
      <Field label="Game rules">
        <textarea className={inputCls} rows={3} value={form.rules} onChange={(e) => set("rules", e.target.value)} aria-label="Game rules" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tips & strategies (one per line)">
          <textarea className={inputCls} rows={4} value={form.tips} onChange={(e) => set("tips", e.target.value)} aria-label="Game tips, one per line" />
        </Field>
        <Field label="Features (one per line)">
          <textarea className={inputCls} rows={4} value={form.features} onChange={(e) => set("features", e.target.value)} aria-label="Game features, one per line" />
        </Field>
      </div>
      <Field label="FAQs (one per line, as: Question | Answer)">
        <textarea className={inputCls} rows={3} value={form.faqs} onChange={(e) => set("faqs", e.target.value)} aria-label="Game FAQs, question pipe answer per line" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Player type">
          <select className={inputCls} value={form.gameType} onChange={(e) => set("gameType", e.target.value as GameFormState["gameType"])} aria-label="Player type">
            <option value="builtin">Built-in (PlayVerse Original)</option>
            <option value="iframe">iFrame embed</option>
            <option value="external">External link</option>
          </select>
        </Field>
        <Field label="Provider">
          <select className={inputCls} value={form.providerId} onChange={(e) => set("providerId", e.target.value)} aria-label="Game provider">
            <option value="">— None —</option>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value as GameFormState["status"])} aria-label="Publication status">
            <option value="draft">Draft</option>
            <option value="pending">Pending review</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
      </div>
      {form.gameType === "builtin" && (
        <Field label="Built-in game key">
          <select className={inputCls} value={form.builtinKey} onChange={(e) => set("builtinKey", e.target.value)} aria-label="Built-in game key">
            <option value="">— Choose —</option>
            {BUILTIN_KEYS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </Field>
      )}
      {form.gameType === "iframe" && (
        <Field label="Embed URL (domain must be on the provider allowlist to publish)">
          <input className={inputCls} value={form.embedUrl} onChange={(e) => set("embedUrl", e.target.value)} aria-label="Embed URL" placeholder="https://games.example.com/play/…" inputMode="url" />
        </Field>
      )}
      {form.gameType === "external" && (
        <Field label="Game URL (opens on the provider's site)">
          <input className={inputCls} value={form.gameUrl} onChange={(e) => set("gameUrl", e.target.value)} aria-label="Game URL" placeholder="https://…" inputMode="url" />
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Thumbnail URL">
          <input className={inputCls} value={form.thumbnailUrl} onChange={(e) => set("thumbnailUrl", e.target.value)} aria-label="Thumbnail URL" placeholder="https://… or upload →" />
        </Field>
        <Field label="Upload thumbnail">
          <input type="file" accept="image/*" aria-label="Upload thumbnail image" className="text-sm"
            onChange={(e) => onThumbFile(e.target.files?.[0])} />
          {uploading && <span className="text-sm font-semibold text-[var(--dim)]">Uploading…</span>}
          {form.thumbnailBlobKey && <span className="text-sm font-semibold text-green-700">✓ Uploaded thumbnail attached</span>}
        </Field>
      </div>
      <Field label="Categories">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const on = form.categoryIds.includes(c.id);
            return (
              <button key={c.id} type="button" aria-pressed={on}
                onClick={() => set("categoryIds", on ? form.categoryIds.filter((id) => id !== c.id) : [...form.categoryIds, c.id])}
                className={`rounded-full px-3 py-1.5 text-sm font-bold ${on ? "text-white" : "bg-[var(--surface-alt)]"}`}
                style={on ? { backgroundColor: c.color } : undefined}>
                {c.icon} {c.name}
              </button>
            );
          })}
        </div>
      </Field>
      <div className="flex flex-wrap gap-4">
        {([["featured", "⭐ Featured"], ["trending", "🔥 Trending"], ["isNew", "✨ Mark as new"]] as const).map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center gap-2 font-semibold">
            <input type="checkbox" className="h-5 w-5" checked={form[key]} onChange={(e) => set(key, e.target.checked)} />
            {label}
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label='Controls (JSON, e.g. {"Move":"Arrow keys"})'>
          <textarea className={inputCls} rows={2} value={form.controls} onChange={(e) => set("controls", e.target.value)} aria-label="Controls JSON" />
        </Field>
        <Field label='License info (JSON, e.g. {"status":"Licensed via GameDistribution"})'>
          <textarea className={inputCls} rows={2} value={form.licenseInfo} onChange={(e) => set("licenseInfo", e.target.value)} aria-label="License info JSON" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="SEO title">
          <input className={inputCls} value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} aria-label="SEO title" />
        </Field>
        <Field label="SEO description">
          <input className={inputCls} value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} aria-label="SEO description" />
        </Field>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={save.isPending}>{save.isPending ? "Saving…" : form.id ? "Save changes" : "Create game"}</button>
        <button type="button" className={btnGhost} onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------- games tab */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = splitLine(lines[0]!).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
}

const CSV_TEMPLATE = `title,slug,description,instructions,thumbnail_url,game_url,embed_url,category,game_type,license,seo_title,seo_description
My Licensed Game,my-licensed-game,"A short description of the game.","How to play it.",https://cdn.example.com/thumb.jpg,,https://games.example.com/embed/my-game,Action,iframe,"Licensed via GameDistribution — publisher account on file","My Licensed Game — Play Free Online | PlayVerse","Play My Licensed Game free online."
`;

function GamesTab({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<GameFormState | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [notice, setNotice] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const games = useQuery({
    queryKey: ["admin-games", token, statusFilter, search],
    queryFn: () => api.adminListGames({ token, status: statusFilter, search: search || undefined, limit: 300 }),
  });
  const cats = useQuery({ queryKey: ["admin-cats", token], queryFn: () => api.adminListCategories({ token }) });
  const provs = useQuery({ queryKey: ["admin-provs", token], queryFn: () => api.adminProviders({ token }) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-games"] });
  const bulk = useMutation({
    mutationFn: (operation: string) => api.adminBulkGames({
      token, ids: [...selected],
      operation: operation as "publish",
      categoryId: operation === "assignCategory" ? Number(bulkCategory) : undefined,
    }),
    onSuccess: (r) => {
      setNotice(`Done: ${r.updated} game(s) updated${r.blocked ? `, ${r.blocked} blocked by the embed allowlist gate` : ""}.`);
      setSelected(new Set());
      invalidate();
    },
    onError: (e) => setNotice(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.adminDeleteGame({ token, id }),
    onSuccess: invalidate,
    onError: (e) => setNotice(errMsg(e)),
  });
  const importGames = useMutation({
    mutationFn: (rows: Record<string, string>[]) => api.adminImportGames({
      token, providerId: null,
      rows: rows.map((r) => ({
        title: r["title"] ?? "",
        slug: r["slug"] || undefined,
        description: r["description"] ?? "",
        instructions: r["instructions"] ?? "",
        thumbnail_url: r["thumbnail_url"] ?? "",
        game_url: r["game_url"] ?? "",
        embed_url: r["embed_url"] ?? "",
        category: r["category"] ?? "",
        game_type: r["game_type"] ?? "iframe",
        license: r["license"] ?? "",
        seo_title: r["seo_title"] ?? "",
        seo_description: r["seo_description"] ?? "",
      })),
    }),
    onSuccess: (r) => {
      setImportMsg(`Import complete: ${r.imported} imported as drafts, ${r.duplicates} duplicates skipped, ${r.skipped} invalid rows skipped. Review and publish from the list below.`);
      invalidate();
    },
    onError: (e) => setImportMsg(errMsg(e)),
  });
  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "playverse-games-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  const onCsvFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) { setImportMsg("No data rows found in that CSV."); return; }
    importGames.mutate(rows);
  };
  const list = games.data?.games ?? [];
  const toggleSelect = (id: number) =>
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (editing) {
    return (
      <GameForm
        token={token}
        initial={editing}
        categories={cats.data?.categories ?? []}
        providers={(provs.data?.providers ?? []).map((p) => ({ id: p.id, name: p.name }))}
        onDone={() => { setEditing(null); invalidate(); }}
      />
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnPrimary} onClick={() => setEditing({ ...emptyForm })}>＋ Add game</button>
        <label className={btnGhost} htmlFor="pv-csv-file" role="button">📥 Import CSV</label>
        <input id="pv-csv-file" type="file" accept=".csv,text/csv" className="sr-only" aria-label="Import games from CSV"
          onChange={(e) => onCsvFile(e.target.files?.[0])} />
        <button type="button" className={btnGhost} onClick={downloadTemplate}>⬇ CSV template</button>
        <span className="text-sm font-semibold text-[var(--dim)]">Imports land as drafts — review licenses & allowlist, then publish.</span>
      </div>
      {importMsg && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800" role="status">{importMsg}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-bold" htmlFor="adm-status-filter">Status</label>
        <select id="adm-status-filter" className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold"
          value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="archived">Archived</option>
        </select>
        <label className="sr-only" htmlFor="adm-game-search">Search games</label>
        <input id="adm-game-search" className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm"
          placeholder="Search games…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="text-sm font-semibold text-[var(--dim)]">{list.length} games</span>
      </div>
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--bg-soft)] px-3 py-2">
          <span className="font-bold">{selected.size} selected</span>
          {([["publish", "Publish"], ["unpublish", "Unpublish"], ["feature", "Feature"], ["unfeature", "Unfeature"], ["trending", "Trending"], ["untrending", "Untrending"], ["markNew", "Mark new"], ["archive", "Archive"], ["delete", "Delete"]] as const).map(([op, label]) => (
            <button key={op} type="button" className={op === "delete" ? btnDanger : btnGhost} disabled={bulk.isPending}
              onClick={() => bulk.mutate(op)}>{label}</button>
          ))}
          <select aria-label="Bulk assign category" className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold"
            value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
            <option value="">Assign category…</option>
            {(cats.data?.categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" className={btnGhost} disabled={!bulkCategory || bulk.isPending} onClick={() => bulk.mutate("assignCategory")}>Apply category</button>
        </div>
      )}
      {notice && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800" role="status">{notice}</p>}
      <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-[var(--border)]">
        {games.isPending ? (
          <p className="px-4 py-8 font-semibold text-[var(--dim)]">Loading games…</p>
        ) : list.length === 0 ? (
          <p className="px-4 py-8 font-semibold text-[var(--dim)]">No games in this view.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {list.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <input type="checkbox" className="h-5 w-5 shrink-0" checked={selected.has(g.id)} onChange={() => toggleSelect(g.id)}
                  aria-label={`Select ${g.title}`} />
                {g.thumbnailUrl && !g.thumbnailUrl.startsWith("pvblob:")
                  ? <img src={g.thumbnailUrl} alt="" className="hidden h-10 w-16 shrink-0 rounded-lg object-cover sm:block" />
                  : <span className="hidden h-10 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-lg sm:flex">🎮</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{g.title}</span>
                  <span className="block truncate text-xs text-[var(--dim)]">
                    /game/{g.slug} · {g.categories.map((c) => c.name).join(", ") || "No category"} · ▶ {g.playCount}
                    {g.featured ? " · ⭐" : ""}{g.trending ? " · 🔥" : ""}{g.isNew ? " · ✨" : ""}
                  </span>
                </span>
                <StatusPill status={g.status} />
                <button type="button" className={btnGhost} onClick={() => setEditing(formFromGame(g))}>Edit</button>
                <button type="button" className={btnDanger} disabled={del.isPending} aria-label={`Delete ${g.title}`}
                  onClick={() => del.mutate(g.id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- categories tab */
function CategoriesTab({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const cats = useQuery({ queryKey: ["admin-cats", token], queryFn: () => api.adminListCategories({ token }) });
  const [form, setForm] = useState<{ id?: number; name: string; slug: string; description: string; color: string; icon: string; targetCount: number } | null>(null);
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: () => api.adminSaveCategory({
      token, id: form!.id, name: form!.name, slug: form!.slug || undefined,
      description: form!.description, color: form!.color, icon: form!.icon, targetCount: form!.targetCount,
    }),
    onSuccess: () => { setForm(null); queryClient.invalidateQueries({ queryKey: ["admin-cats"] }); },
    onError: (e) => setError(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.adminDeleteCategory({ token, id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-cats"] }),
    onError: (e) => setError(errMsg(e)),
  });
  const totalTarget = (cats.data?.categories ?? []).reduce((s, c) => s + c.targetCount, 0);
  const totalGames = (cats.data?.categories ?? []).reduce((s, c) => s + c.gameCount, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-semibold text-[var(--dim)]">Library progress: <strong className="text-[var(--text)]">{totalGames}</strong> games assigned toward the <strong className="text-[var(--text)]">{totalTarget}</strong>-game launch target.</p>
        <button type="button" className={btnPrimary} onClick={() => setForm({ name: "", slug: "", description: "", color: "#2563eb", icon: "🎮", targetCount: 0 })}>＋ Add category</button>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
      {form && (
        <form className="grid gap-3 rounded-3xl bg-white p-5 ring-1 ring-[var(--border)] sm:grid-cols-3"
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Name *"><input className={inputCls} value={form.name} required aria-label="Category name" onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Slug"><input className={inputCls} value={form.slug} aria-label="Category slug" onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
          <Field label="Icon (emoji)"><input className={inputCls} value={form.icon} aria-label="Category icon" onChange={(e) => setForm({ ...form, icon: e.target.value })} /></Field>
          <Field label="Color"><input className={inputCls} value={form.color} aria-label="Category color" onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field>
          <Field label="Library target"><input className={inputCls} type="number" min={0} value={form.targetCount} aria-label="Library target count" onChange={(e) => setForm({ ...form, targetCount: Number(e.target.value) })} /></Field>
          <Field label="Description"><input className={inputCls} value={form.description} aria-label="Category description" onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" className={btnPrimary} disabled={save.isPending}>Save category</button>
            <button type="button" className={btnGhost} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(cats.data?.categories ?? []).map((c) => (
          <div key={c.id} className="rounded-3xl bg-white p-4 ring-1 ring-[var(--border)]">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: `${c.color}22` }} aria-hidden>{c.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{c.name}</p>
                <p className="text-xs font-semibold text-[var(--dim)]">/category/{c.slug}</p>
              </div>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--surface-alt)]" role="progressbar" aria-valuenow={c.gameCount} aria-valuemax={Math.max(c.targetCount, 1)} aria-label={`${c.name} library progress`}>
              <div className="h-full rounded-full" style={{ width: `${c.targetCount ? Math.min(100, (c.gameCount / c.targetCount) * 100) : 0}%`, backgroundColor: c.color }} />
            </div>
            <p className="mt-1 text-sm font-semibold text-[var(--dim)]">{c.gameCount} / {c.targetCount} target games</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className={btnGhost} onClick={() => setForm({ id: c.id, name: c.name, slug: c.slug, description: c.description, color: c.color, icon: c.icon, targetCount: c.targetCount })}>Edit</button>
              <button type="button" className={btnDanger} disabled={del.isPending} onClick={() => del.mutate(c.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- providers tab */
function ProvidersTab({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["admin-provs", token], queryFn: () => api.adminProviders({ token }) });
  const [drafts, setDrafts] = useState<Record<number, { status: string; notes: string; publisherId: string; apiKey: string; domains: string }>>({});
  const [msg, setMsg] = useState("");
  const save = useMutation({
    mutationFn: (providerId: number) => {
      const d = drafts[providerId]!;
      const original = data.data!.providers.find((p) => p.id === providerId)!;
      return api.adminSaveProvider({
        token, providerId,
        status: (d.status || original.status) as "not_connected",
        notes: d.notes ?? original.notes,
        publisherId: d.publisherId ?? original.publisherId,
        apiKey: d.apiKey || undefined,
        allowlistDomains: (d.domains ?? original.allowlistDomains.join("\n")).split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
      });
    },
    onSuccess: () => { setMsg("Provider saved."); queryClient.invalidateQueries({ queryKey: ["admin-provs"] }); },
    onError: (e) => setMsg(errMsg(e)),
  });
  const getDraft = (p: NonNullable<typeof data.data>["providers"][number]) =>
    drafts[p.id] ?? { status: p.status, notes: p.notes, publisherId: p.publisherId, apiKey: "", domains: p.allowlistDomains.join("\n") };
  const setDraft = (id: number, patch: Partial<{ status: string; notes: string; publisherId: string; apiKey: string; domains: string }>) =>
    setDrafts((all) => {
      const base = all[id] ?? (() => {
        const p = data.data!.providers.find((x) => x.id === id)!;
        return { status: p.status, notes: p.notes, publisherId: p.publisherId, apiKey: "", domains: p.allowlistDomains.join("\n") };
      })();
      return { ...all, [id]: { ...base, ...patch } };
    });
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-[var(--dim)]">
        Connect licensed game providers here. API keys are stored on the server only and never shown again after saving.
        A provider's games can only be published when the embed domain is on that provider's allowlist below.
        PlayVerse does not fabricate provider feeds — imports happen through CSV or games you add manually with a recorded license.
      </p>
      {msg && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800" role="status">{msg}</p>}
      {(data.data?.providers ?? []).map((p) => {
        const d = getDraft(p);
        return (
          <div key={p.id} className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold">{p.name}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${p.status === "connected" ? "bg-green-100 text-green-800" : p.status === "configured" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"}`}>
                {p.status.replace("_", " ").toUpperCase()}
              </span>
              <span className="text-sm font-semibold text-[var(--dim)]">{p.gameCount} games in catalog</span>
              {p.website && <a href={p.website} target="_blank" rel="noreferrer" className="text-sm font-bold text-[var(--accent)]">Provider site ↗</a>}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <select className={inputCls} value={d.status} aria-label={`${p.name} status`} onChange={(e) => setDraft(p.id, { status: e.target.value })}>
                  <option value="not_connected">Not connected</option>
                  <option value="configured">Configured</option>
                  <option value="connected">Connected</option>
                  <option value="error">Error</option>
                </select>
              </Field>
              <Field label="Publisher / account ID">
                <input className={inputCls} value={d.publisherId} aria-label={`${p.name} publisher ID`} onChange={(e) => setDraft(p.id, { publisherId: e.target.value })} />
              </Field>
              <Field label={`API key ${p.apiKeySet ? "(stored — enter to replace)" : "(not stored)"}`}>
                <input className={inputCls} type="password" value={d.apiKey} aria-label={`${p.name} API key`} autoComplete="off"
                  placeholder={p.apiKeySet ? "•••••••• stored on server" : "Paste API key"} onChange={(e) => setDraft(p.id, { apiKey: e.target.value })} />
              </Field>
              <Field label="Notes">
                <input className={inputCls} value={d.notes} aria-label={`${p.name} notes`} onChange={(e) => setDraft(p.id, { notes: e.target.value })} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Embed allowlist domains (one per line — only these domains may be embedded for this provider)">
                <textarea className={inputCls} rows={2} value={d.domains} aria-label={`${p.name} embed allowlist domains`}
                  placeholder={"games.example.com\n*.cdn.example.com"} onChange={(e) => setDraft(p.id, { domains: e.target.value })} />
              </Field>
            </div>
            <button type="button" className={`${btnPrimary} mt-3`} disabled={save.isPending} onClick={() => save.mutate(p.id)}>Save provider</button>
          </div>
        );
      })}
      <div className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
        <h2 className="font-extrabold">Import history</h2>
        {(data.data?.logs ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-[var(--dim)]">No imports yet. CSV imports from the Games tab will appear here.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {(data.data?.logs ?? []).map((l) => (
              <li key={l.id} className="py-2 text-sm">
                <span className="font-bold">{l.source}</span> · {l.imported} imported · {l.duplicates} duplicates · {l.skipped} skipped
                <span className="block text-[var(--dim)]">{l.message} — {new Date(l.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- ads tab */
function AdsTab({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const ads = useQuery({ queryKey: ["admin-ads", token], queryFn: () => api.adminListAds({ token }) });
  const [msg, setMsg] = useState("");
  const save = useMutation({
    mutationFn: (a: ApiResponse<typeof api, "adminListAds">["ads"][number] & { enabled: boolean }) =>
      api.adminSaveAd({
        token, id: a.id, network: a.network as "none", enabled: a.enabled,
        publisherId: a.publisherId, networkCode: a.networkCode, adUnitPath: a.adUnitPath,
        sizes: a.sizes, showDesktop: a.showDesktop, showMobile: a.showMobile,
      }),
    onSuccess: () => { setMsg("Placement saved."); queryClient.invalidateQueries({ queryKey: ["admin-ads"] }); },
    onError: (e) => setMsg(errMsg(e)),
  });
  const [local, setLocal] = useState<Record<number, ApiResponse<typeof api, "adminListAds">["ads"][number]>>({});
  useEffect(() => {
    if (ads.data) setLocal(Object.fromEntries(ads.data.ads.map((a) => [a.id, a])));
  }, [ads.data]);
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-[var(--dim)]">
        One network per placement — AdSense and GAM never run in the same slot. Ads never overlay gameplay.
        A placement with no network configured reserves labeled empty space on the public site, so layout never shifts when you connect a network.
        GAM slots load Google Publisher Tag once, with responsive size mapping and lazy loading; AdSense slots load the AdSense script once.
      </p>
      {msg && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800" role="status">{msg}</p>}
      {Object.values(local).map((a) => (
        <div key={a.id} className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-extrabold">{a.label}</h2>
            <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-bold">{a.placementKey}</span>
            <label className="ml-auto flex cursor-pointer items-center gap-2 font-semibold">
              <input type="checkbox" className="h-5 w-5" checked={a.enabled}
                onChange={(e) => setLocal((l) => ({ ...l, [a.id]: { ...a, enabled: e.target.checked } }))} />
              Enabled
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Network">
              <select className={inputCls} value={a.network} aria-label={`${a.label} network`}
                onChange={(e) => setLocal((l) => ({ ...l, [a.id]: { ...a, network: e.target.value } }))}>
                <option value="none">None (reserved space)</option>
                <option value="adsense">Google AdSense</option>
                <option value="gam">Google Ad Manager (GPT)</option>
              </select>
            </Field>
            {a.network === "adsense" && (
              <>
                <Field label="AdSense publisher ID (ca-pub-…)">
                  <input className={inputCls} value={a.publisherId} aria-label={`${a.label} publisher ID`}
                    onChange={(e) => setLocal((l) => ({ ...l, [a.id]: { ...a, publisherId: e.target.value } }))} />
                </Field>
                <Field label="Ad slot ID">
                  <input className={inputCls} value={a.adUnitPath} aria-label={`${a.label} ad slot ID`}
                    onChange={(e) => setLocal((l) => ({ ...l, [a.id]: { ...a, adUnitPath: e.target.value } }))} />
                </Field>
              </>
            )}
            {a.network === "gam" && (
              <>
                <Field label="GAM network code">
                  <input className={inputCls} value={a.networkCode} aria-label={`${a.label} GAM network code`}
                    onChange={(e) => setLocal((l) => ({ ...l, [a.id]: { ...a, networkCode: e.target.value } }))} />
                </Field>
                <Field label="Ad unit path">
                  <input className={inputCls} value={a.adUnitPath} aria-label={`${a.label} GAM ad unit path`} placeholder="/12345678/playverse/home_top"
                    onChange={(e) => setLocal((l) => ({ ...l, [a.id]: { ...a, adUnitPath: e.target.value } }))} />
                </Field>
              </>
            )}
            <Field label="Sizes">
              <select className={inputCls} value={a.sizes} aria-label={`${a.label} sizes`}
                onChange={(e) => setLocal((l) => ({ ...l, [a.id]: { ...a, sizes: e.target.value } }))}>
                <option value="responsive">Responsive</option>
                <option value="leaderboard">Leaderboard 728×90</option>
                <option value="billboard">Billboard 970×250</option>
                <option value="rectangle">Rectangle 300×250</option>
                <option value="mobile-banner">Mobile banner 320×50</option>
              </select>
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 font-semibold">
              <input type="checkbox" className="h-5 w-5" checked={a.showDesktop}
                onChange={(e) => setLocal((l) => ({ ...l, [a.id]: { ...a, showDesktop: e.target.checked } }))} /> Desktop
            </label>
            <label className="flex cursor-pointer items-center gap-2 font-semibold">
              <input type="checkbox" className="h-5 w-5" checked={a.showMobile}
                onChange={(e) => setLocal((l) => ({ ...l, [a.id]: { ...a, showMobile: e.target.checked } }))} /> Mobile
            </label>
            <span className="text-sm text-[var(--dim)]">
              Preview: {a.enabled && a.network !== "none" ? `Live ${a.network === "gam" ? "GAM" : "AdSense"} slot` : "Reserved labeled space on the public site"}
            </span>
            <button type="button" className={`${btnPrimary} ml-auto`} disabled={save.isPending} onClick={() => save.mutate(a)}>Save placement</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- pages tab */
function PagesTab({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const pages = useQuery({ queryKey: ["admin-pages", token], queryFn: () => api.adminListPages({ token }) });
  const [selected, setSelected] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const first = pages.data?.pages[0];
    if (first && !selected) {
      setSelected(first.slug);
      setTitle(first.title);
      setBody(first.body);
    }
  }, [pages.data, selected]);
  const pick = (slug: string) => {
    const p = pages.data?.pages.find((x) => x.slug === slug);
    if (p) { setSelected(p.slug); setTitle(p.title); setBody(p.body); }
  };
  const save = useMutation({
    mutationFn: () => api.adminSavePage({ token, slug: selected, title, body }),
    onSuccess: () => { setMsg("Page saved — it's live on the public site."); queryClient.invalidateQueries({ queryKey: ["admin-pages"] }); },
    onError: (e) => setMsg(errMsg(e)),
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Static pages">
        {(pages.data?.pages ?? []).map((p) => (
          <button key={p.slug} type="button" role="tab" aria-selected={selected === p.slug} onClick={() => pick(p.slug)}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${selected === p.slug ? "bg-[var(--accent)] text-white" : "bg-white ring-1 ring-[var(--border)]"}`}>
            {p.title}
          </button>
        ))}
      </div>
      {msg && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800" role="status">{msg}</p>}
      <form className="space-y-3 rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]"
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label="Page title">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Static page title" required />
        </Field>
        <Field label="Body (blank lines separate blocks · ## heading · - bullet list · [label](#/path) internal link)">
          <textarea className={inputCls} rows={14} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Static page body" />
        </Field>
        <button type="submit" className={btnPrimary} disabled={save.isPending || !selected}>Save page</button>
      </form>
    </div>
  );
}

/* ----------------------------------------------------- settings + SEO tab */
function SettingsTab({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const cfg = useQuery({ queryKey: ["admin-config", token], queryFn: () => api.adminGetConfig({ token }) });
  const seoFiles = useQuery({ queryKey: ["seo-files"], queryFn: () => api.getSeoFiles({}) });
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [seo, setSeo] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [redirectForm, setRedirectForm] = useState({ fromPath: "", toPath: "", statusCode: 301 });
  useEffect(() => {
    if (cfg.data) { setSettings(cfg.data.settings); setSeo(cfg.data.seo); }
  }, [cfg.data]);
  const saveSettings = useMutation({
    mutationFn: () => api.adminSaveSettings({ token, values: settings }),
    onSuccess: () => { setMsg("Website settings saved."); queryClient.invalidateQueries({ queryKey: ["site"] }); },
    onError: (e) => setMsg(errMsg(e)),
  });
  const saveSeo = useMutation({
    mutationFn: () => api.adminSaveSeo({ token, values: seo }),
    onSuccess: () => { setMsg("SEO settings saved."); queryClient.invalidateQueries({ queryKey: ["site"] }); },
    onError: (e) => setMsg(errMsg(e)),
  });
  const saveRedirect = useMutation({
    mutationFn: () => api.adminSaveRedirect({ token, ...redirectForm }),
    onSuccess: () => { setRedirectForm({ fromPath: "", toPath: "", statusCode: 301 }); queryClient.invalidateQueries({ queryKey: ["admin-config"] }); },
    onError: (e) => setMsg(errMsg(e)),
  });
  const delRedirect = useMutation({
    mutationFn: (id: number) => api.adminDeleteRedirect({ token, id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-config"] }),
  });
  const download = (name: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };
  const sField = (key: string, label: string, placeholder = "") => (
    <Field label={label}>
      <input className={inputCls} value={settings[key] ?? ""} placeholder={placeholder} aria-label={label}
        onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))} />
    </Field>
  );
  const seoField = (key: string, label: string) => (
    <Field label={label}>
      <input className={inputCls} value={seo[key] ?? ""} aria-label={label}
        onChange={(e) => setSeo((s) => ({ ...s, [key]: e.target.value }))} />
    </Field>
  );
  return (
    <div className="space-y-4">
      {msg && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800" role="status">{msg}</p>}
      <form className="space-y-3 rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]"
        onSubmit={(e) => { e.preventDefault(); saveSettings.mutate(); }}>
        <h2 className="font-extrabold">Website settings</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {sField("site_title", "Website title")}
          {sField("tagline", "Tagline")}
          {sField("logo_text", "Logo text")}
          {sField("logo_emoji", "Logo symbol (emoji)")}
          {sField("primary_color", "Primary color", "#2563eb")}
          {sField("contact_email", "Public contact email", "hello@example.com")}
          {sField("base_url", "Public base URL (for canonicals & sitemap)", "https://playverse.example.com")}
          {sField("ga_measurement_id", "Google Analytics 4 measurement ID", "G-XXXXXXXXXX")}
          {sField("adsense_publisher_id", "Default AdSense publisher ID", "ca-pub-…")}
          {sField("gam_network_code", "Default GAM network code")}
          {sField("social_facebook", "Facebook URL")}
          {sField("social_x", "X (Twitter) URL")}
          {sField("social_youtube", "YouTube URL")}
          {sField("social_instagram", "Instagram URL")}
        </div>
        <Field label="ads.txt content (served verbatim once set)">
          <textarea className={inputCls} rows={3} value={settings["ads_txt"] ?? ""} aria-label="ads.txt content"
            placeholder={"google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0"}
            onChange={(e) => setSettings((s) => ({ ...s, ads_txt: e.target.value }))} />
        </Field>
        <button type="submit" className={btnPrimary} disabled={saveSettings.isPending}>Save website settings</button>
        <p className="text-sm text-[var(--dim)]">
          GA4 note: paste your measurement ID here to record it as the site's analytics configuration. Page views and game launches are
          always recorded in PlayVerse's own analytics (see the Analytics tab) from real events — nothing is estimated.
        </p>
      </form>

      <form className="space-y-3 rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]"
        onSubmit={(e) => { e.preventDefault(); saveSeo.mutate(); }}>
        <h2 className="font-extrabold">SEO defaults</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {seoField("default_title", "Default page title")}
          {seoField("twitter_handle", "Twitter / X handle", )}
          {seoField("og_image_url", "Default Open Graph image URL")}
          {seoField("search_console_verification", "Google Search Console verification code")}
        </div>
        <Field label="Default meta description">
          <textarea className={inputCls} rows={2} value={seo["default_description"] ?? ""} aria-label="Default meta description"
            onChange={(e) => setSeo((s) => ({ ...s, default_description: e.target.value }))} />
        </Field>
        <button type="submit" className={btnPrimary} disabled={saveSeo.isPending}>Save SEO defaults</button>
      </form>

      <div className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
        <h2 className="font-extrabold">Generated SEO files</h2>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Generated live from the published catalog — only canonical, published, non-empty pages are included. Download and host these at your domain root when you deploy.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={btnGhost} disabled={!seoFiles.data} onClick={() => seoFiles.data && download("sitemap.xml", seoFiles.data.sitemap)}>⬇ sitemap.xml</button>
          <button type="button" className={btnGhost} disabled={!seoFiles.data} onClick={() => seoFiles.data && download("robots.txt", seoFiles.data.robots)}>⬇ robots.txt</button>
          <button type="button" className={btnGhost} disabled={!seoFiles.data} onClick={() => seoFiles.data && download("ads.txt", seoFiles.data.adsTxt)}>⬇ ads.txt</button>
        </div>
        {seoFiles.data && (
          <details className="mt-3">
            <summary className="cursor-pointer font-bold">Preview sitemap.xml</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-[var(--bg-soft)] p-3 text-xs">{seoFiles.data.sitemap}</pre>
          </details>
        )}
      </div>

      <div className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
        <h2 className="font-extrabold">Redirect rules</h2>
        <form className="mt-3 grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); saveRedirect.mutate(); }}>
          <Field label="From path"><input className={inputCls} value={redirectForm.fromPath} required aria-label="Redirect from path" placeholder="/old-game" onChange={(e) => setRedirectForm({ ...redirectForm, fromPath: e.target.value })} /></Field>
          <Field label="To path / URL"><input className={inputCls} value={redirectForm.toPath} required aria-label="Redirect to path" placeholder="/game/new-game" onChange={(e) => setRedirectForm({ ...redirectForm, toPath: e.target.value })} /></Field>
          <Field label="Status code">
            <select className={inputCls} value={redirectForm.statusCode} aria-label="Redirect status code" onChange={(e) => setRedirectForm({ ...redirectForm, statusCode: Number(e.target.value) })}>
              <option value={301}>301 Permanent</option>
              <option value={302}>302 Temporary</option>
              <option value={307}>307 Temporary (strict)</option>
            </select>
          </Field>
          <div className="flex items-end"><button type="submit" className={btnPrimary} disabled={saveRedirect.isPending}>Add redirect</button></div>
        </form>
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {(cfg.data?.redirects ?? []).map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="font-bold">{r.fromPath}</span> → <span>{r.toPath}</span>
              <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-bold">{r.statusCode}</span>
              <button type="button" className={`${btnDanger} ml-auto`} onClick={() => delRedirect.mutate(r.id)}>Delete</button>
            </li>
          ))}
          {(cfg.data?.redirects ?? []).length === 0 && <li className="py-2 text-sm text-[var(--dim)]">No redirect rules yet.</li>}
        </ul>
      </div>

      <DeploymentGuide />
    </div>
  );
}

function DeploymentGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
      <button type="button" className="flex w-full items-center justify-between font-extrabold" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        🚀 Deployment, environment & launch checklist <span aria-hidden>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--text)]/90">
          <p><strong>Going live on your own domain:</strong> point your domain's DNS (A/CNAME records) at your hosting, enable HTTPS, then set the exact public URL as the Base URL above so canonical tags, the sitemap and Open Graph URLs are correct. Never leave a preview or localhost URL in the Base URL field.</p>
          <p><strong>Environment variables (production stack):</strong> NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (server only — never expose in frontend code), NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_GA_MEASUREMENT_ID, NEXT_PUBLIC_ADSENSE_PUBLISHER_ID, NEXT_PUBLIC_GAM_NETWORK_CODE. In this PlayVerse workspace build, the same configuration lives in Admin → Settings and provider records instead of env files.</p>
          <p><strong>Google Search Console:</strong> verify ownership with the meta tag (paste the code in SEO defaults), then submit sitemap.xml from the Generated SEO files section.</p>
          <p><strong>AdSense:</strong> add your site in AdSense, paste the publisher ID into placements (or the default above), and host the generated ads.txt at your domain root. <strong>GAM:</strong> create the network and ad units, then set the network code and ad unit paths per placement — GPT loads once with lazy loading and responsive mappings.</p>
          <p><strong>Launch checklist:</strong> ① Owner account created and extra admins added with least-privilege roles. ② Licensed providers connected; every published iframe game's domain allowlisted. ③ Demo records deleted or kept as drafts. ④ Legal pages reviewed with your own counsel. ⑤ Base URL, GA4, Search Console set. ⑥ ads.txt hosted. ⑦ Test a game launch on phone and desktop; check Analytics records it. ⑧ Submit sitemap.</p>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- analytics tab */
function AnalyticsTab({ token }: { token: string }) {
  const data = useQuery({ queryKey: ["admin-analytics", token], queryFn: () => api.adminAnalytics({ token }) });
  if (data.isPending) return <p className="font-semibold text-[var(--dim)]">Loading analytics…</p>;
  if (data.error) return <p className="font-semibold text-red-600">{errMsg(data.error)}</p>;
  const a = data.data!;
  const maxDay = Math.max(1, ...a.playsByDay.map((d) => d.plays));
  const block = (title: string, children: React.ReactNode) => (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
      <h2 className="font-extrabold">{title}</h2>
      <div className="mt-2">{children}</div>
    </div>
  );
  const rows = (items: { label: string; value: number }[]) => (
    items.length === 0
      ? <p className="text-sm text-[var(--dim)]">No data recorded yet.</p>
      : <ul className="space-y-1.5">{items.map((i) => (
          <li key={i.label} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-semibold">{i.label}</span>
            <span className="font-bold text-[var(--accent)]">{i.value.toLocaleString()}</span>
          </li>
        ))}</ul>
  );
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--dim)]">Every number below comes from events PlayVerse actually recorded — page views, game launches, searches and favorites. Nothing is sampled or estimated.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Game launches", a.totalPlays], ["Page views", a.totalViews], ["Searches", a.totalSearches], ["Favorites added", a.totalFavorites]].map(([label, v]) => (
          <div key={label as string} className="rounded-3xl bg-white p-4 ring-1 ring-[var(--border)]">
            <p className="text-3xl font-extrabold">{(v as number).toLocaleString()}</p>
            <p className="text-sm font-semibold text-[var(--dim)]">{label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {block("Launches by day (last 30 days with data)",
          a.playsByDay.length === 0 ? <p className="text-sm text-[var(--dim)]">No launches yet.</p> : (
            <div className="flex h-32 items-end gap-1" role="img" aria-label="Bar chart of game launches per day">
              {a.playsByDay.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t-md bg-[var(--accent)]" style={{ height: `${Math.max(6, (d.plays / maxDay) * 100)}%` }} title={`${d.day}: ${d.plays}`} />
                  <span className="text-[9px] font-semibold text-[var(--dim)]">{d.day.slice(5)}</span>
                </div>
              ))}
            </div>
          ))}
        {block("Most launched games", rows(a.playsByGame.map((g) => ({ label: g.title, value: g.plays }))))}
        {block("Launches by category", rows(a.playsByCategory.map((c) => ({ label: c.name, value: c.plays }))))}
        {block("Launches by device", rows(a.playsByDevice.map((d) => ({ label: d.device, value: d.plays }))))}
        {block("Top internal searches", rows(a.topSearches.map((s) => ({ label: s.query, value: s.count }))))}
        {block("Top pages", rows(a.topPages.map((p) => ({ label: p.path, value: p.views }))))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- team tab */
function TeamTab({ token, me }: { token: string; me: { username: string; role: string } }) {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["admin-team", token], queryFn: () => api.adminTeam({ token }) });
  const [form, setForm] = useState({ username: "", displayName: "", password: "", role: "editor" as "admin" | "editor" | "viewer" });
  const [msg, setMsg] = useState("");
  const create = useMutation({
    mutationFn: () => api.adminCreateAdmin({ token, ...form }),
    onSuccess: () => { setForm({ username: "", displayName: "", password: "", role: "editor" }); setMsg("Admin account created."); queryClient.invalidateQueries({ queryKey: ["admin-team"] }); },
    onError: (e) => setMsg(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.adminDeleteAdmin({ token, id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-team"] }),
    onError: (e) => setMsg(errMsg(e)),
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--dim)]">
        Roles are enforced on the server for every action: <strong>owner</strong> (everything, incl. team & settings),{" "}
        <strong>admin</strong> (manage content, providers, ads), <strong>editor</strong> (games, categories, pages),{" "}
        <strong>viewer</strong> (read-only). You are signed in as <strong>{me.username}</strong> ({me.role}).
      </p>
      {msg && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800" role="status">{msg}</p>}
      <div className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
        <h2 className="font-extrabold">Admin accounts</h2>
        <ul className="mt-2 divide-y divide-[var(--border)]">
          {(data.data?.admins ?? []).map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-2">
              <span className="font-bold">{a.displayName || a.username}</span>
              <span className="text-sm text-[var(--dim)]">@{a.username}</span>
              <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-extrabold">{a.role.toUpperCase()}</span>
              {me.role === "owner" && a.username !== me.username && (
                <button type="button" className={`${btnDanger} ml-auto`} disabled={del.isPending} onClick={() => del.mutate(a.id)}>Delete</button>
              )}
            </li>
          ))}
        </ul>
        {me.role === "owner" && (
          <form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <Field label="Username"><input className={inputCls} value={form.username} required minLength={3} aria-label="New admin username" onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
            <Field label="Display name"><input className={inputCls} value={form.displayName} aria-label="New admin display name" onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></Field>
            <Field label="Password (min 8)"><input className={inputCls} type="password" value={form.password} required minLength={8} aria-label="New admin password" onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            <Field label="Role">
              <select className={inputCls} value={form.role} aria-label="New admin role" onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}>
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </Field>
            <div className="sm:col-span-4"><button type="submit" className={btnPrimary} disabled={create.isPending}>Create admin</button></div>
          </form>
        )}
      </div>
      <div className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
        <h2 className="font-extrabold">Activity log</h2>
        <ul className="mt-2 divide-y divide-[var(--border)]">
          {(data.data?.activity ?? []).map((a) => (
            <li key={a.id} className="py-2 text-sm">
              <span className="font-bold">{a.action}</span> <span className="text-[var(--dim)]">by {a.actor} · {new Date(a.createdAt).toLocaleString()}</span>
              <span className="block">{a.detail}</span>
            </li>
          ))}
          {(data.data?.activity ?? []).length === 0 && <li className="py-2 text-sm text-[var(--dim)]">No activity yet.</li>}
        </ul>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- messages tab */
function MessagesTab({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const messages = useQuery({ queryKey: ["admin-messages", token], queryFn: () => api.adminListContactMessages({ token }) });
  const [msg, setMsg] = useState("");
  const del = useMutation({
    mutationFn: (id: number) => api.adminDeleteContactMessage({ token, id }),
    onSuccess: () => { setMsg("Message deleted."); queryClient.invalidateQueries({ queryKey: ["admin-messages"] }); },
    onError: (e) => setMsg(errMsg(e)),
  });
  const list = messages.data?.messages ?? [];
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-[var(--dim)]">
        Messages sent through the public contact form, newest first. Reply to the sender's email address from your own mailbox.
      </p>
      {msg && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800" role="status">{msg}</p>}
      {messages.isPending ? (
        <p className="font-semibold text-[var(--dim)]">Loading messages…</p>
      ) : list.length === 0 ? (
        <div className="rounded-3xl bg-white px-6 py-10 text-center ring-1 ring-[var(--border)]">
          <p className="text-4xl" aria-hidden>📭</p>
          <p className="mt-2 font-bold">No messages yet</p>
          <p className="text-sm text-[var(--dim)]">When a visitor submits the contact form, their message will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((m) => (
            <li key={m.id} className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0">
                  <p className="font-extrabold">{m.subject}</p>
                  <p className="text-sm font-semibold text-[var(--dim)]">
                    {m.name} · <a className="text-[var(--accent)] underline" href={`mailto:${m.email}`}>{m.email}</a> ·{" "}
                    {new Date(m.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <button type="button" className={`${btnDanger} ml-auto`} disabled={del.isPending}
                  onClick={() => del.mutate(m.id)} aria-label={`Delete message: ${m.subject}`}>
                  Delete
                </button>
              </div>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-[var(--text)]/90">{m.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ code tab */
type SourceExportResult = ApiResponse<typeof api, "exportProjectSource">;

function CodeTab({ token }: { token: string }) {
  const list = useQuery({ queryKey: ["code-files"], queryFn: () => api.listCodeFiles({}) });
  const [downloading, setDownloading] = useState("");
  const [msg, setMsg] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportInfo, setExportInfo] = useState<SourceExportResult | null>(null);
  const downloadSourceZip = async () => {
    setExporting(true);
    setMsg("");
    setExportInfo(null);
    try {
      const r = await api.exportProjectSource({ token });
      const bin = atob(r.contentBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = r.filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setExportInfo(r);
      setMsg(`✅ ${r.filename} downloaded — ${r.fileCount} files, ${(r.zipBytes / 1024).toFixed(1)} KB.`);
    } catch (e) {
      setMsg(errMsg(e));
    } finally { setExporting(false); }
  };
  const download = async (key: string) => {
    setDownloading(key);
    setMsg("");
    try {
      const r = await api.getCodeFile({ fileKey: key as "standalone" });
      const blob = new Blob([r.content], { type: `${r.mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = r.filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setMsg(`✅ ${r.filename} downloaded — check your Downloads folder.`);
    } catch (e) {
      setMsg(errMsg(e));
    } finally { setDownloading(""); }
  };
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-[var(--dim)]">
        Owner ke liye code files — har file live catalog ({list.data?.totals.published ?? "…"} published games) se fresh banti hai.
        Yehi files public <strong>Code Files</strong> page (footer link) par bhi available hain.
      </p>
      {msg && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800" role="status">{msg}</p>}
      <div className="rounded-3xl bg-white p-5 ring-2 ring-[var(--accent)]">
        <p className="text-2xl" aria-hidden>📦</p>
        <p className="mt-1 font-extrabold">Full Project Source — playverse-full-source.zip</p>
        <p className="font-mono text-xs font-bold text-[var(--accent)]">playverse-full-source.zip</p>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Poora asal project source ek zip mein — client entry + components, gamekit aur saaray builtin game
          modules (100 games), server code, database schema/migrations, package.json, vercel.json aur
          .env.example. Andar README (standalone host ko kya chahiye: Node runtime, Postgres/Supabase database,
          environment variables) aur MANIFEST.txt hai — har included file apne size ke saath, aur jo kuch include
          nahi ho saka us ki wajah bhi wazeh likhi hai. Koi database data, secret ya API key zip mein nahi hai.
          Sirf owner/admin download kar sakta hai.
        </p>
        <button type="button" className={`${btnPrimary} mt-3`} disabled={exporting} onClick={downloadSourceZip}
          aria-label="Download full project source (.zip)">{exporting ? "⏳ Building zip…" : "⬇ Download full project source (.zip)"}</button>
        {exportInfo && (
          <div className="mt-3 rounded-2xl bg-[var(--bg-soft)] p-3 text-sm">
            <p className="font-bold">
              Zip tayyar: {exportInfo.fileCount} files · {(exportInfo.zipBytes / 1024).toFixed(1)} KB ·{" "}
              {exportInfo.included.filter((f) => f.origin === "source").length} asal source files,{" "}
              {exportInfo.included.filter((f) => f.origin === "generated").length} generated (README, configs, MANIFEST).
            </p>
            {exportInfo.gaps.length > 0 && (
              <>
                <p className="mt-2 font-bold">MANIFEST notes — ye cheezen zip mein nahi hain:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[var(--dim)]">
                  {exportInfo.gaps.map((g) => (
                    <li key={g.path}><span className="font-mono text-xs font-bold">{g.path}</span> — {g.reason}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(list.data?.files ?? []).map((f) => (
          <div key={f.key} className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
            <p className="text-2xl" aria-hidden>{f.icon}</p>
            <p className="mt-1 font-extrabold">{f.title}</p>
            <p className="font-mono text-xs font-bold text-[var(--accent)]">{f.filename}</p>
            <p className="mt-1 text-sm text-[var(--dim)]">{f.description}</p>
            <button type="button" className={`${btnPrimary} mt-3`} disabled={downloading === f.key} onClick={() => download(f.key)}
              aria-label={`Download ${f.filename}`}>{downloading === f.key ? "⏳ Building…" : `⬇ Download ${f.filename}`}</button>
          </div>
        ))}
      </div>
      {list.isPending && <p className="font-semibold text-[var(--dim)]">Loading file list…</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ shell */
const TABS = [
  ["dashboard", "📊 Dashboard"],
  ["games", "🎮 Games"],
  ["categories", "🧭 Categories"],
  ["providers", "🔌 Providers"],
  ["ads", "📣 Advertising"],
  ["pages", "📄 Pages"],
  ["messages", "✉️ Messages"],
  ["analytics", "📈 Analytics"],
  ["settings", "⚙️ Settings & SEO"],
  ["code", "💻 Code Files"],
  ["team", "👥 Team & Activity"],
] as const;
type TabKey = (typeof TABS)[number][0];

export function AdminApp({ navigate }: { navigate: (p: string) => void }) {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState(getToken);
  const [tab, setTab] = useState<TabKey>("dashboard");
  const status = useQuery({
    queryKey: ["admin-status", token],
    queryFn: () => api.adminStatus({ token: token || undefined }),
  });
  const me = status.data?.admin ?? null;
  const logout = useMutation({
    mutationFn: () => api.adminLogout({ token }),
    onSettled: () => {
      setToken("");
      setTokenState("");
      queryClient.clear();
    },
  });
  if (status.isPending) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--bg-soft)]"><p className="font-bold text-[var(--dim)]">Loading admin…</p></div>;
  }
  if (!me) {
    return (
      <div className="min-h-screen bg-[var(--bg-soft)]">
        <AuthGate onAuthed={(t) => setTokenState(t)} />
        <p className="pb-6 text-center">
          <button type="button" className="font-bold text-[var(--accent)]" onClick={() => navigate("/")}>← Back to PlayVerse</button>
        </p>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[var(--bg-soft)] text-[var(--text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/95 pt-safe backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:px-5">
          <p className="text-lg font-extrabold">🛡️ PlayVerse <span className="text-[var(--accent)]">Admin</span></p>
          <span className="hidden rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-bold sm:inline">
            {me.displayName || me.username} · {me.role}
          </span>
          <div className="ml-auto flex gap-2">
            <button type="button" className={btnGhost} onClick={() => navigate("/")}>View site</button>
            <button type="button" className={btnGhost} onClick={() => logout.mutate()}>Sign out</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2 sm:px-5" aria-label="Admin sections">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} aria-pressed={tab === key}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${tab === key ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-soft)]"}`}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-5">
        {tab === "dashboard" && <DashboardTab token={token} goGames={() => setTab("games")} />}
        {tab === "games" && <GamesTab token={token} />}
        {tab === "categories" && <CategoriesTab token={token} />}
        {tab === "providers" && <ProvidersTab token={token} />}
        {tab === "ads" && <AdsTab token={token} />}
        {tab === "pages" && <PagesTab token={token} />}
        {tab === "messages" && <MessagesTab token={token} />}
        {tab === "analytics" && <AnalyticsTab token={token} />}
        {tab === "settings" && <SettingsTab token={token} />}
        {tab === "code" && <CodeTab token={token} />}
        {tab === "team" && <TeamTab token={token} me={me} />}
      </main>
    </div>
  );
}
