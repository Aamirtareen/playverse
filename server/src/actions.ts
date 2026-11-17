// PlayVerse server actions.
//
// Public actions serve the portal (published games only). Every admin action
// verifies a server-side session token AND the admin's role before touching
// data — route protection in the client is never the only check. Provider API
// keys are stored server-side only and are never returned to the client.

import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import * as schema from "./schema";
import { ensureSeed, isEmbedAllowed } from "./seed";
import { privileged } from "@space/privileged";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

const okResponse = z.object({ ok: z.literal(true) });

const categoryOut = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  color: z.string(),
  icon: z.string(),
  targetCount: z.number(),
  gameCount: z.number(),
});

const gameOut = z.object({
  id: z.number(),
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  instructions: z.string(),
  rules: z.string(),
  tips: z.array(z.string()),
  features: z.array(z.string()),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })),
  thumbnailUrl: z.string().nullable(),
  gameUrl: z.string().nullable(),
  embedUrl: z.string().nullable(),
  embedAllowed: z.boolean(),
  providerId: z.number().nullable(),
  providerName: z.string().nullable(),
  gameType: z.string(),
  builtinKey: z.string().nullable(),
  controls: z.string(),
  licenseInfo: z.string(),
  featured: z.boolean(),
  trending: z.boolean(),
  isNew: z.boolean(),
  status: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  playCount: z.number(),
  categories: z.array(
    z.object({ id: z.number(), name: z.string(), slug: z.string(), color: z.string(), icon: z.string() }),
  ),
  createdAt: z.string(),
  publishedAt: z.string().nullable(),
});

type GameOut = z.infer<typeof gameOut>;

const adOut = z.object({
  id: z.number(),
  placementKey: z.string(),
  label: z.string(),
  network: z.string(),
  enabled: z.boolean(),
  publisherId: z.string(),
  networkCode: z.string(),
  adUnitPath: z.string(),
  sizes: z.string(),
  showDesktop: z.boolean(),
  showMobile: z.boolean(),
});

function parseStringArray(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseFaqs(raw: unknown): { q: string; a: string }[] {
  if (typeof raw !== "string") return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (x): x is { q: string; a: string } =>
          !!x && typeof x === "object" && typeof (x as AnyDb).q === "string" && typeof (x as AnyDb).a === "string",
      )
      .map((x) => ({ q: x.q, a: x.a }));
  } catch {
    return [];
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function logActivity(db: AnyDb, actor: string, action: string, detail: string) {
  await db.insert(schema.activityLogs).values({ actor, action, detail, createdAt: new Date() });
}

type AdminRow = typeof schema.adminProfiles.$inferSelect;

async function requireAdmin(
  ctx: Ctx,
  token: string | undefined,
  roles: string[],
): Promise<{ db: AnyDb; admin: AdminRow }> {
  if (!token) throw new Error("Admin sign-in required.");
  const db = ctx.db<typeof schema>() as AnyDb;
  const sessions = await db
    .select()
    .from(schema.adminSessions)
    .where(eq(schema.adminSessions.token, token))
    .limit(1);
  const session = sessions[0];
  if (!session || session.expiresAt.getTime() < Date.now()) {
    throw new Error("Admin session expired. Please sign in again.");
  }
  const admins = await db
    .select()
    .from(schema.adminProfiles)
    .where(eq(schema.adminProfiles.id, session.adminId))
    .limit(1);
  const admin = admins[0] as AdminRow | undefined;
  if (!admin) throw new Error("Admin account not found.");
  if (!roles.includes(admin.role)) {
    throw new Error(`Your role (${admin.role}) cannot perform this action.`);
  }
  return { db, admin };
}

async function serializeGames(db: AnyDb, rows: AnyDb[]): Promise<GameOut[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id as number);
  const links = await db
    .select()
    .from(schema.gameCategories)
    .where(inArray(schema.gameCategories.gameId, ids));
  const cats = await db.select().from(schema.categories);
  const providers = await db.select().from(schema.gameProviders);
  const thumbKeys = rows
    .map((r) => r.thumbnailBlobKey as string | null)
    .filter((k: string | null): k is string => !!k);
  const blobUrls = new Map<string, string>();
  // Blob URLs are resolved by the client through getThumbnailUrl; keep null here.
  void thumbKeys;
  void blobUrls;
  const out: GameOut[] = [];
  for (const r of rows) {
    const gameCats = (links as AnyDb[])
      .filter((l) => l.gameId === r.id)
      .map((l) => cats.find((c: AnyDb) => c.id === l.categoryId))
      .filter(Boolean)
      .map((c: AnyDb) => ({ id: c.id, name: c.name, slug: c.slug, color: c.color, icon: c.icon }));
    const provider = providers.find((p: AnyDb) => p.id === r.providerId);
    out.push({
      id: r.id,
      title: r.title,
      slug: r.slug,
      description: r.description,
      instructions: r.instructions,
      rules: r.rules ?? "",
      tips: parseStringArray(r.tips),
      features: parseStringArray(r.features),
      faqs: parseFaqs(r.faqs),
      thumbnailUrl: r.thumbnailUrl ?? null,
      gameUrl: r.gameUrl ?? null,
      embedUrl: r.embedUrl ?? null,
      embedAllowed:
        r.gameType === "iframe"
          ? await isEmbedAllowed(db, r.embedUrl ?? null, r.providerId ?? null)
          : false,
      providerId: r.providerId ?? null,
      providerName: provider?.name ?? null,
      gameType: r.gameType,
      builtinKey: r.builtinKey ?? null,
      controls: r.controls,
      licenseInfo: r.licenseInfo,
      featured: r.featured === 1,
      trending: r.trending === 1,
      isNew: r.isNew === 1,
      status: r.status,
      seoTitle: r.seoTitle,
      seoDescription: r.seoDescription,
      playCount: r.playCount,
      categories: gameCats,
      createdAt: (r.createdAt as Date).toISOString(),
      publishedAt: r.publishedAt ? (r.publishedAt as Date).toISOString() : null,
    });
  }
  return out;
}

async function publishedGames(db: AnyDb): Promise<AnyDb[]> {
  return db
    .select()
    .from(schema.games)
    .where(eq(schema.games.status, "published"));
}

async function categoriesWithCounts(db: AnyDb) {
  const cats = await db.select().from(schema.categories).orderBy(asc(schema.categories.sortOrder));
  const published = await publishedGames(db);
  const publishedIds = new Set(published.map((g: AnyDb) => g.id));
  const links = await db.select().from(schema.gameCategories);
  return cats.map((c: AnyDb) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    color: c.color,
    icon: c.icon,
    targetCount: c.targetCount,
    gameCount: (links as AnyDb[]).filter(
      (l) => l.categoryId === c.id && publishedIds.has(l.gameId),
    ).length,
  }));
}

async function settingsMap(db: AnyDb, table: typeof schema.websiteSettings | typeof schema.seoSettings) {
  const rows = await db.select().from(table);
  const map: Record<string, string> = {};
  for (const r of rows as AnyDb[]) map[r.key] = r.value;
  return map;
}

/* ------------------------------------------------------- code export -- */
function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export const CODE_FILES = [
  { key: "standalone", filename: "PlayVerse-Standalone.html", mimeType: "text/html", language: "HTML", icon: "🌐", title: "Standalone Website — Single HTML File", description: "Poori PlayVerse catalog ek hi HTML file mein. Download karke browser mein kholo — search, categories aur saari 100 games ki list chalegi, bina server ke. Ye sab se asaan code file hai." },
  { key: "gamesJson", filename: "playverse-games.json", mimeType: "application/json", language: "JSON", icon: "🎮", title: "Games Data — games.json", description: "Saari published games ka asal data: title, slug, description, how-to-play, rules, tips, features, FAQs, category, SEO — live database se generated." },
  { key: "gamesCsv", filename: "playverse-games.csv", mimeType: "text/csv", language: "CSV", icon: "📊", title: "Games Data — games.csv", description: "Wahi catalog Excel / Google Sheets mein khulne wali CSV file mein. Import/export aur backup ke liye best." },
  { key: "schemaSql", filename: "playverse-database-schema.sql", mimeType: "text/plain", language: "SQL", icon: "🗄️", title: "Database Schema — schema.sql", description: "PlayVerse ki tamam 15+ tables ki CREATE TABLE SQL — categories, games, providers, ads, settings, analytics sab. Supabase/Postgres ya SQLite mein dobara banane ke liye." },
  { key: "packageJson", filename: "package.json", mimeType: "application/json", language: "JSON", icon: "📦", title: "package.json — Project Config", description: "External deployment (Vercel/Netlify apni hosting) ke liye React + TypeScript project ki dependencies aur scripts wali file." },
  { key: "readme", filename: "README-PlayVerse.md", mimeType: "text/markdown", language: "Markdown", icon: "📖", title: "README — Project Guide", description: "PlayVerse kya hai, file structure, har folder/file ka kaam, aur code ko apni hosting par chalane ke steps." },
  { key: "deployment", filename: "DEPLOYMENT-GUIDE.md", mimeType: "text/markdown", language: "Markdown", icon: "🚀", title: "Deployment Guide", description: "Domain, Vercel, Supabase, AdSense, GAM aur Search Console setup ki step-by-step guide — env variables ki list ke saath." },
  { key: "envExample", filename: ".env.example", mimeType: "text/plain", language: "ENV", icon: "🔑", title: ".env.example — Environment Variables", description: "Production deployment ke liye tamam zaroori environment variables ki template (koi secret value nahi, sirf names aur notes)." },
  { key: "vercelJson", filename: "vercel.json", mimeType: "application/json", language: "JSON", icon: "▲", title: "vercel.json — Vercel Config", description: "Vercel par deploy karne ke liye ready config: rewrites, headers aur cache rules." },
  { key: "structure", filename: "PROJECT-STRUCTURE.txt", mimeType: "text/plain", language: "Text", icon: "🗂️", title: "Project Structure — File List", description: "Is workspace mein maujood tamam asal source files ki list aur har file ka kaam — taakeh pata chale poora code kahan kya hai." },
] as const;
type CodeFileKey = (typeof CODE_FILES)[number]["key"];

/* --------------------------------------- full project source export -- */
// Project-relative paths packaged verbatim into the full-source zip. The
// bytes are read from disk on the host by the privileged buildSourceExport
// handler (the action worker has no filesystem access); anything that
// cannot be read is reported in the zip's MANIFEST.txt gap list.
const SOURCE_EXPORT_PATHS = [
  "package.json",
  "bun.lock",
  "bunfig.toml",
  "tsconfig.base.json",
  "space.json",
  "client/index.html",
  "client/build.mjs",
  "client/tsconfig.json",
  "client/src/main.tsx",
  "client/src/App.tsx",
  "client/src/Admin.tsx",
  "client/src/api.ts",
  "client/src/gamekit.tsx",
  "client/src/games.tsx",
  "client/src/games2.tsx",
  "client/src/games3.tsx",
  "client/src/games4.tsx",
  "client/src/games5.tsx",
  "client/src/theme.css",
  "client/src/globals.d.ts",
  "server/tsconfig.json",
  "server/src/actions.ts",
  "server/src/schema.ts",
  "server/src/seed.ts",
  "server/src/library.ts",
  "server/src/pages-content.ts",
  "server/src/privileged.ts",
  "drizzle/0001_initial.sql",
  "drizzle/0002_playverse_platform_schema.sql",
  "drizzle/0003_add_game_content_fields.sql",
  "drizzle/0004_add_contact_messages.sql",
  "drizzle/meta/_journal.json",
];

// Workspace paths that exist but are deliberately kept out of the source
// zip; each one is named, with its reason, in the zip's MANIFEST.txt.
const SOURCE_EXPORT_EXCLUDED = [
  { path: "app.db (+ app.db-wal / app.db-shm)", reason: "The live database: admin password hashes, sessions, contact messages and analytics. Database data is never part of a source export — for catalog data use the playverse-games.json / .csv downloads in Code Files." },
  { path: "node_modules/", reason: "Installed dependencies. Reinstall from package.json / bun.lock on the target host." },
  { path: "client/dist/, client/dist-cvm/, .space-build/", reason: "Compiled build output. Rebuild from the included source instead." },
  { path: ".bun-cache/", reason: "Package-manager install cache, not project source." },
  { path: "audits/", reason: "Internal build/audit screenshots of the Muse workspace, not application source." },
  { path: ".harness/", reason: "Muse build-tooling metadata, not application source." },
  { path: "icon.png / icon.webp", reason: "The artifact icon, owned and managed by the Muse shell." },
  { path: "AGENTS.md, DATA-PLAN.md", reason: "Muse workspace build notes, not application source." },
];

const sortEnum = z.enum(["popular", "newest", "az", "recommended"]).default("recommended");

async function queryGames(
  db: AnyDb,
  opts: {
    collection?: string;
    categorySlug?: string;
    search?: string;
    sort?: string;
    limit: number;
    publishedOnly: boolean;
    status?: string;
  },
): Promise<GameOut[]> {
  let rows: AnyDb[];
  if (opts.publishedOnly) {
    rows = await publishedGames(db);
  } else if (opts.status && opts.status !== "all") {
    rows = await db.select().from(schema.games).where(eq(schema.games.status, opts.status as AnyDb));
  } else {
    rows = await db.select().from(schema.games);
  }
  if (opts.categorySlug) {
    const cats = await db.select().from(schema.categories);
    const cat = cats.find((c: AnyDb) => c.slug === opts.categorySlug);
    if (!cat) return [];
    const links = await db.select().from(schema.gameCategories);
    const ids = new Set(
      (links as AnyDb[]).filter((l) => l.categoryId === cat.id).map((l) => l.gameId),
    );
    rows = rows.filter((r) => ids.has(r.id));
  }
  if (opts.collection === "popular") rows = rows.filter((r) => r.playCount > 0 || r.featured === 1);
  if (opts.collection === "featured") rows = rows.filter((r) => r.featured === 1);
  if (opts.collection === "trending") rows = rows.filter((r) => r.trending === 1);
  if (opts.collection === "new") rows = rows.filter((r) => r.isNew === 1);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.title as string).toLowerCase().includes(q) ||
        (r.description as string).toLowerCase().includes(q),
    );
  }
  const byPopularity = (a: AnyDb, b: AnyDb) => (b.playCount as number) - (a.playCount as number);
  const byNewest = (a: AnyDb, b: AnyDb) =>
    (b.publishedAt?.getTime() ?? b.createdAt.getTime()) - (a.publishedAt?.getTime() ?? a.createdAt.getTime());
  if (opts.collection === "popular" || opts.sort === "popular") rows.sort(byPopularity);
  else if (opts.collection === "new" || opts.sort === "newest") rows.sort(byNewest);
  else if (opts.sort === "az") rows.sort((a, b) => (a.title as string).localeCompare(b.title as string));
  else if (opts.collection === "trending") rows.sort(byPopularity);
  else if (opts.collection === "featured") rows.sort(byNewest);
  else rows.sort((a, b) => (b.featured as number) - (a.featured as number) || byPopularity(a, b));
  rows = rows.slice(0, opts.limit);
  return serializeGames(db, rows);
}

export const Actions = {
  // ------------------------------------------------------------- public ---
  seedCatalog: defineAction({
    description: "Creates the initial PlayVerse structure (categories, providers, placements, settings, legal pages, original games) the first time it runs; later runs change nothing.",
    request: z.object({}),
    response: z.object({ seeded: z.boolean() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>() as AnyDb;
      const before = await db.select().from(schema.categories).limit(1);
      await ensureSeed(db);
      return { seeded: before.length === 0 };
    },
  }),

  getSite: defineAction({
    description: "Returns public site settings, categories with published game counts, enabled ad placements, and catalog totals for the portal shell.",
    request: z.object({}),
    response: z.object({
      settings: z.record(z.string(), z.string()),
      seo: z.record(z.string(), z.string()),
      categories: z.array(categoryOut),
      ads: z.array(adOut),
      totals: z.object({
        published: z.number(),
        categories: z.number(),
        targetLibrary: z.number(),
      }),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>() as AnyDb;
      await ensureSeed(db);
      const settings = await settingsMap(db, schema.websiteSettings);
      const seo = await settingsMap(db, schema.seoSettings);
      const categories = await categoriesWithCounts(db);
      const adRows = await db.select().from(schema.adPlacements);
      const published = await publishedGames(db);
      return {
        settings,
        seo,
        categories,
        ads: (adRows as AnyDb[]).map((a) => ({
          id: a.id,
          placementKey: a.placementKey,
          label: a.label,
          network: a.network,
          enabled: a.enabled === 1,
          publisherId: a.publisherId,
          networkCode: a.networkCode,
          adUnitPath: a.adUnitPath,
          sizes: a.sizes,
          showDesktop: a.showDesktop === 1,
          showMobile: a.showMobile === 1,
        })),
        totals: {
          published: published.length,
          categories: categories.length,
          targetLibrary: categories.reduce((s: number, c: AnyDb) => s + c.targetCount, 0),
        },
      };
    },
  }),

  listGames: defineAction({
    description: "Lists published games for the portal, with optional collection (popular/trending/new/featured), category, search and sort.",
    request: z.object({
      collection: z.string().optional(),
      categorySlug: z.string().optional(),
      search: z.string().optional(),
      sort: sortEnum.optional(),
      limit: z.number().int().min(1).max(200).default(60),
    }),
    response: z.object({ games: z.array(gameOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>() as AnyDb;
      await ensureSeed(db);
      const games = await queryGames(db, {
        collection: args.collection,
        categorySlug: args.categorySlug,
        search: args.search,
        sort: args.sort,
        limit: args.limit,
        publishedOnly: true,
      });
      return { games };
    },
  }),

  getGame: defineAction({
    description: "Returns one published game by slug with its categories, embed allowlist verdict, and related games from the same categories.",
    request: z.object({ slug: z.string().min(1) }),
    response: z.object({
      game: gameOut.nullable(),
      related: z.array(gameOut),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>() as AnyDb;
      await ensureSeed(db);
      const rows = await db
        .select()
        .from(schema.games)
        .where(and(eq(schema.games.slug, args.slug), eq(schema.games.status, "published")))
        .limit(1);
      if (!rows[0]) return { game: null, related: [] };
      const [game] = await serializeGames(db, rows);
      const catSlugs = (game?.categories ?? []).map((c) => c.slug);
      let related: GameOut[] = [];
      for (const slug of catSlugs) {
        const inCat = await queryGames(db, {
          categorySlug: slug,
          sort: "popular",
          limit: 12,
          publishedOnly: true,
        });
        related = [...related, ...inCat.filter((g) => g.id !== game?.id)];
      }
      const seen = new Set<number>();
      related = related.filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)));
      return { game: game ?? null, related: related.slice(0, 12) };
    },
  }),

  getStaticPage: defineAction({
    description: "Returns one CMS static page (about, contact, privacy-policy, terms, cookie-policy, dmca, disclaimer) by slug, with its last-updated timestamp.",
    request: z.object({ slug: z.string().min(1) }),
    response: z.object({
      page: z.object({ slug: z.string(), title: z.string(), body: z.string(), updatedAt: z.string() }).nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>() as AnyDb;
      await ensureSeed(db);
      const rows = await db
        .select()
        .from(schema.staticPages)
        .where(eq(schema.staticPages.slug, args.slug))
        .limit(1);
      const row = rows[0];
      return {
        page: row
          ? { slug: row.slug, title: row.title, body: row.body, updatedAt: (row.updatedAt as Date).toISOString() }
          : null,
      };
    },
  }),

  submitContactMessage: defineAction({
    description: "Stores one validated message from the public contact form (name, email, subject, message) for the admin inbox.",
    request: z.object({
      name: z.string().trim().min(2, "Please enter your name.").max(80),
      email: z.string().trim().email("Please enter a valid email address.").max(160),
      subject: z.string().trim().min(3, "Please add a subject.").max(140),
      message: z.string().trim().min(10, "Please write a message of at least 10 characters.").max(4000),
      // Honeypot: real visitors never fill this hidden field.
      website: z.string().max(200).optional().default(""),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      if (args.website) return { ok: true as const }; // silently drop bot submissions
      const db = ctx.db<typeof schema>() as AnyDb;
      await ensureSeed(db);
      const linkCount = (args.message.match(/https?:\/\//gi) ?? []).length;
      if (linkCount > 3) throw new Error("Your message contains too many links. Please remove them and try again.");
      await db.insert(schema.contactMessages).values({
        name: args.name,
        email: args.email,
        subject: args.subject,
        message: args.message,
        createdAt: new Date(),
      });
      await db.insert(schema.activityLogs).values({
        actor: "visitor",
        action: "contact.message",
        detail: `New contact message: "${args.subject}" from ${args.name}.`,
        createdAt: new Date(),
      });
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  recordPlay: defineAction({
    description: "Records one real game launch (increments play count and stores a game_plays row with device type) for analytics.",
    request: z.object({
      gameId: z.number().int().positive(),
      visitorId: z.string().max(80).default(""),
      deviceType: z.string().max(20).default("unknown"),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>() as AnyDb;
      const rows = await db
        .select()
        .from(schema.games)
        .where(and(eq(schema.games.id, args.gameId), eq(schema.games.status, "published")))
        .limit(1);
      if (!rows[0]) throw new Error("Game not found.");
      await db
        .update(schema.games)
        .set({ playCount: sql`${schema.games.playCount} + 1` })
        .where(eq(schema.games.id, args.gameId));
      await db.insert(schema.gamePlays).values({
        gameId: args.gameId,
        visitorId: args.visitorId,
        deviceType: args.deviceType,
        createdAt: new Date(),
      });
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  recordPageView: defineAction({
    description: "Records one portal page view for admin analytics.",
    request: z.object({ path: z.string().max(200) }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>() as AnyDb;
      await db.insert(schema.pageViews).values({ path: args.path, createdAt: new Date() });
      return { ok: true as const };
    },
  }),

  logSearch: defineAction({
    description: "Records one internal search (query and result count) for admin analytics and returns the matching published games.",
    request: z.object({ query: z.string().min(1).max(120) }),
    response: z.object({ games: z.array(gameOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>() as AnyDb;
      await ensureSeed(db);
      const games = await queryGames(db, {
        search: args.query,
        sort: "popular",
        limit: 60,
        publishedOnly: true,
      });
      await db.insert(schema.searchLogs).values({
        query: args.query,
        resultsCount: games.length,
        createdAt: new Date(),
      });
      return { games };
    },
  }),

  toggleFavorite: defineAction({
    description: "Adds or removes a game from this visitor's favorites (no account needed) and returns the new state.",
    request: z.object({
      visitorId: z.string().min(4).max(80),
      gameId: z.number().int().positive(),
    }),
    response: z.object({ favorite: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>() as AnyDb;
      const existing = await db
        .select()
        .from(schema.favorites)
        .where(
          and(
            eq(schema.favorites.visitorId, args.visitorId),
            eq(schema.favorites.gameId, args.gameId),
          ),
        )
        .limit(1);
      if (existing[0]) {
        await db
          .delete(schema.favorites)
          .where(eq(schema.favorites.id, existing[0].id));
        ctx.invalidateQueries();
        return { favorite: false };
      }
      await db.insert(schema.favorites).values({
        visitorId: args.visitorId,
        gameId: args.gameId,
        createdAt: new Date(),
      });
      ctx.invalidateQueries();
      return { favorite: true };
    },
  }),

  listFavorites: defineAction({
    description: "Lists the published games this visitor has favorited.",
    request: z.object({ visitorId: z.string().min(4).max(80) }),
    response: z.object({ games: z.array(gameOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>() as AnyDb;
      await ensureSeed(db);
      const favs = await db
        .select()
        .from(schema.favorites)
        .where(eq(schema.favorites.visitorId, args.visitorId))
        .orderBy(desc(schema.favorites.id));
      if (favs.length === 0) return { games: [] };
      const rows = await db
        .select()
        .from(schema.games)
        .where(
          and(
            inArray(schema.games.id, favs.map((f: AnyDb) => f.gameId)),
            eq(schema.games.status, "published"),
          ),
        );
      const games = await serializeGames(db, rows);
      const order = new Map<number, number>(
        favs.map((f: AnyDb, i: number): [number, number] => [f.gameId as number, i]),
      );
      games.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      return { games };
    },
  }),

  getSeoFiles: defineAction({
    description: "Generates sitemap.xml, robots.txt and ads.txt content from the live catalog, settings and redirect rules.",
    request: z.object({}),
    response: z.object({ sitemap: z.string(), robots: z.string(), adsTxt: z.string() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>() as AnyDb;
      await ensureSeed(db);
      const settings = await settingsMap(db, schema.websiteSettings);
      const base = (settings["base_url"] ?? "").replace(/\/$/, "");
      const prefix = base || "";
      const published = await publishedGames(db);
      const cats = await categoriesWithCounts(db);
      const urls: string[] = [
        "/", "/games", "/popular", "/trending", "/new", "/featured", "/categories",
        "/about", "/contact", "/privacy-policy", "/terms", "/cookie-policy", "/dmca", "/disclaimer",
      ];
      for (const c of cats) if (c.gameCount > 0) urls.push(`/category/${c.slug}`);
      for (const g of published) urls.push(`/game/${(g as AnyDb).slug}`);
      const sitemap =
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.map((u) => `  <url><loc>${prefix}${u}</loc></url>`).join("\n") +
        `\n</urlset>`;
      const robots = `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${prefix}/sitemap.xml\n`;
      const adsTxt =
        settings["ads_txt"] && settings["ads_txt"].length > 0
          ? settings["ads_txt"]
          : "# ads.txt — no advertising network configured yet.\n# Add your AdSense/GAM lines in Admin → Settings and they will be served here.\n";
      return { sitemap, robots, adsTxt };
    },
  }),

  resolveRedirect: defineAction({
    description: "Returns the redirect rule matching a path, if an admin has configured one.",
    request: z.object({ path: z.string().min(1).max(200) }),
    response: z.object({ toPath: z.string().nullable(), statusCode: z.number().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>() as AnyDb;
      const rows = await db
        .select()
        .from(schema.redirectRules)
        .where(eq(schema.redirectRules.fromPath, args.path))
        .limit(1);
      const row = rows[0];
      return { toPath: row?.toPath ?? null, statusCode: row?.statusCode ?? null };
    },
  }),

  getThumbnailUrl: defineAction({
    description: "Returns a temporary URL for a game's uploaded thumbnail stored in blob storage.",
    request: z.object({ blobKey: z.string().min(1) }),
    response: z.object({ url: z.string().nullable() }),
    async handler(ctx, args) {
      const url = await ctx.blobs.getUrl(args.blobKey);
      return { url: url ?? null };
    },
  }),

  // --------------------------------------------------------- admin auth ---
  adminStatus: defineAction({
    description: "Reports whether the first admin account still needs to be created, and the signed-in admin for a session token.",
    request: z.object({ token: z.string().optional() }),
    response: z.object({
      setupRequired: z.boolean(),
      admin: z
        .object({ id: z.number(), username: z.string(), displayName: z.string(), role: z.string() })
        .nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>() as AnyDb;
      await ensureSeed(db);
      const admins = await db.select().from(schema.adminProfiles).limit(1);
      if (!args.token) return { setupRequired: admins.length === 0, admin: null };
      try {
        const { admin } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor", "viewer"]);
        return {
          setupRequired: false,
          admin: {
            id: admin.id,
            username: admin.username,
            displayName: admin.displayName,
            role: admin.role,
          },
        };
      } catch {
        return { setupRequired: admins.length === 0, admin: null };
      }
    },
  }),

  adminSetup: defineAction({
    description: "Creates the first owner admin account (only works while no admin exists) and returns a session token.",
    request: z.object({
      username: z.string().min(3).max(40),
      displayName: z.string().max(60).default(""),
      password: z.string().min(8).max(200),
    }),
    response: z.object({ token: z.string(), role: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>() as AnyDb;
      await ensureSeed(db);
      const existing = await db.select().from(schema.adminProfiles).limit(1);
      if (existing.length > 0) throw new Error("An admin account already exists. Sign in instead.");
      const salt = randomToken(12);
      const passwordHash = await hashPassword(args.password, salt);
      const inserted = await db
        .insert(schema.adminProfiles)
        .values({
          username: args.username.toLowerCase(),
          displayName: args.displayName || args.username,
          passwordHash,
          salt,
          role: "owner",
          createdAt: new Date(),
        })
        .returning({ id: schema.adminProfiles.id });
      const adminId = inserted[0]?.id;
      if (!adminId) throw new Error("Could not create admin account.");
      const token = randomToken(32);
      await db.insert(schema.adminSessions).values({
        token,
        adminId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      });
      await logActivity(db, args.username, "admin.setup", "Created the owner admin account.");
      ctx.invalidateQueries();
      return { token, role: "owner" };
    },
  }),

  adminLogin: defineAction({
    description: "Signs an admin in with username and password and returns a server-side session token.",
    request: z.object({
      username: z.string().min(1).max(40),
      password: z.string().min(1).max(200),
    }),
    response: z.object({ token: z.string(), role: z.string(), displayName: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>() as AnyDb;
      const rows = await db
        .select()
        .from(schema.adminProfiles)
        .where(eq(schema.adminProfiles.username, args.username.toLowerCase()))
        .limit(1);
      const admin = rows[0];
      if (!admin) throw new Error("Invalid username or password.");
      const hash = await hashPassword(args.password, admin.salt);
      if (hash !== admin.passwordHash) throw new Error("Invalid username or password.");
      const token = randomToken(32);
      await db.insert(schema.adminSessions).values({
        token,
        adminId: admin.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      });
      await logActivity(db, admin.username, "admin.login", "Signed in to the admin dashboard.");
      return { token, role: admin.role, displayName: admin.displayName };
    },
  }),

  adminLogout: defineAction({
    description: "Signs an admin out by deleting their server-side session.",
    request: z.object({ token: z.string().min(1) }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>() as AnyDb;
      await db.delete(schema.adminSessions).where(eq(schema.adminSessions.token, args.token));
      return { ok: true as const };
    },
  }),

  // ------------------------------------------------------------ admin -----
  adminDashboard: defineAction({
    description: "Returns real admin dashboard metrics: game counts by status, categories, total launches, recent and most-played games, provider status.",
    request: z.object({ token: z.string().min(1) }),
    response: z.object({
      totalGames: z.number(),
      published: z.number(),
      drafts: z.number(),
      pending: z.number(),
      archived: z.number(),
      categories: z.number(),
      totalPlays: z.number(),
      pageViews: z.number(),
      searches: z.number(),
      favorites: z.number(),
      recent: z.array(gameOut),
      mostPlayed: z.array(gameOut),
      providers: z.array(
        z.object({ id: z.number(), name: z.string(), slug: z.string(), status: z.string(), gameCount: z.number() }),
      ),
    }),
    async handler(ctx, args) {
      const { db } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor", "viewer"]);
      const all = await db.select().from(schema.games);
      const count = (s: string) => all.filter((g: AnyDb) => g.status === s).length;
      const plays = await db.select().from(schema.gamePlays);
      const views = await db.select().from(schema.pageViews);
      const searches = await db.select().from(schema.searchLogs);
      const favs = await db.select().from(schema.favorites);
      const cats = await db.select().from(schema.categories);
      const provs = await db.select().from(schema.gameProviders);
      const recentRows = [...all]
        .sort((a: AnyDb, b: AnyDb) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 8);
      const playedRows = [...all]
        .sort((a: AnyDb, b: AnyDb) => b.playCount - a.playCount)
        .slice(0, 8);
      return {
        totalGames: all.length,
        published: count("published"),
        drafts: count("draft"),
        pending: count("pending"),
        archived: count("archived"),
        categories: cats.length,
        totalPlays: plays.length,
        pageViews: views.length,
        searches: searches.length,
        favorites: favs.length,
        recent: await serializeGames(db, recentRows),
        mostPlayed: await serializeGames(db, playedRows),
        providers: (provs as AnyDb[]).map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          status: p.status,
          gameCount: all.filter((g: AnyDb) => g.providerId === p.id).length,
        })),
      };
    },
  }),

  adminListGames: defineAction({
    description: "Lists games of every status for admin management, with optional status filter and search.",
    request: z.object({
      token: z.string().min(1),
      status: z.string().default("all"),
      search: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(200),
    }),
    response: z.object({ games: z.array(gameOut) }),
    async handler(ctx, args) {
      const { db } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor", "viewer"]);
      const games = await queryGames(db, {
        status: args.status,
        search: args.search,
        sort: "newest",
        limit: args.limit,
        publishedOnly: false,
      });
      return { games };
    },
  }),

  adminSaveGame: defineAction({
    description: "Creates or updates a game with all catalog, player, license and SEO fields, and assigns its categories.",
    request: z.object({
      token: z.string().min(1),
      id: z.number().int().positive().optional(),
      title: z.string().min(1).max(160),
      slug: z.string().max(120).optional(),
      description: z.string().max(6000).default(""),
      instructions: z.string().max(6000).default(""),
      rules: z.string().max(6000).default(""),
      tips: z.array(z.string().max(600)).max(12).default([]),
      features: z.array(z.string().max(600)).max(12).default([]),
      faqs: z.array(z.object({ q: z.string().max(300), a: z.string().max(900) })).max(8).default([]),
      thumbnailUrl: z.string().max(3000).nullable().optional(),
      thumbnailBlobKey: z.string().max(300).nullable().optional(),
      gameUrl: z.string().max(1000).nullable().optional(),
      embedUrl: z.string().max(1000).nullable().optional(),
      providerId: z.number().int().positive().nullable().optional(),
      gameType: z.enum(["builtin", "iframe", "external"]).default("iframe"),
      builtinKey: z.string().max(60).nullable().optional(),
      controls: z.string().max(2000).default("{}"),
      licenseInfo: z.string().max(2000).default("{}"),
      featured: z.boolean().default(false),
      trending: z.boolean().default(false),
      isNew: z.boolean().default(false),
      status: z.enum(["draft", "pending", "published", "archived"]).default("draft"),
      seoTitle: z.string().max(200).default(""),
      seoDescription: z.string().max(400).default(""),
      categoryIds: z.array(z.number().int().positive()).default([]),
    }),
    response: z.object({ id: z.number(), slug: z.string() }),
    async handler(ctx, args) {
      const { db, admin } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor"]);
      const slug = slugify(args.slug && args.slug.length > 0 ? args.slug : args.title);
      if (!slug) throw new Error("A title or slug is required.");
      // Publish gate: iframe games may only publish when the embed domain is allowlisted.
      if (args.status === "published" && args.gameType === "iframe") {
        const allowed = await isEmbedAllowed(db, args.embedUrl ?? null, args.providerId ?? null);
        if (!allowed) {
          throw new Error(
            "Cannot publish: this embed URL's domain is not on the provider allowlist. Add the domain under Providers → Integration, or keep the game as a draft.",
          );
        }
      }
      if (args.status === "published" && args.gameType === "external" && !args.gameUrl) {
        throw new Error("Cannot publish an external game without a game URL.");
      }
      const now = new Date();
      const values = {
        title: args.title,
        slug,
        description: args.description,
        instructions: args.instructions,
        rules: args.rules,
        tips: JSON.stringify(args.tips),
        features: JSON.stringify(args.features),
        faqs: JSON.stringify(args.faqs),
        thumbnailUrl: args.thumbnailUrl ?? null,
        thumbnailBlobKey: args.thumbnailBlobKey ?? null,
        gameUrl: args.gameUrl ?? null,
        embedUrl: args.embedUrl ?? null,
        providerId: args.providerId ?? null,
        gameType: args.gameType,
        builtinKey: args.builtinKey ?? null,
        controls: args.controls,
        licenseInfo: args.licenseInfo,
        featured: args.featured ? 1 : 0,
        trending: args.trending ? 1 : 0,
        isNew: args.isNew ? 1 : 0,
        status: args.status,
        seoTitle: args.seoTitle || `${args.title} — Play Free Online | PlayVerse`,
        seoDescription: args.seoDescription || args.description.slice(0, 155),
        updatedAt: now,
      };
      let gameId: number;
      if (args.id) {
        const existing = await db.select().from(schema.games).where(eq(schema.games.id, args.id)).limit(1);
        if (!existing[0]) throw new Error("Game not found.");
        const clash = await db.select().from(schema.games).where(eq(schema.games.slug, slug)).limit(1);
        if (clash[0] && clash[0].id !== args.id) throw new Error("Another game already uses this slug.");
        await db
          .update(schema.games)
          .set({
            ...values,
            publishedAt:
              args.status === "published" && !existing[0].publishedAt ? now : existing[0].publishedAt,
          })
          .where(eq(schema.games.id, args.id));
        gameId = args.id;
        await logActivity(db, admin.username, "game.update", `Updated game "${args.title}" (#${gameId}).`);
      } else {
        const clash = await db.select().from(schema.games).where(eq(schema.games.slug, slug)).limit(1);
        if (clash[0]) throw new Error("A game with this slug already exists (duplicate detection).");
        const inserted = await db
          .insert(schema.games)
          .values({ ...values, createdAt: now, publishedAt: args.status === "published" ? now : null })
          .returning({ id: schema.games.id });
        gameId = inserted[0]?.id ?? 0;
        if (!gameId) throw new Error("Could not save the game.");
        await logActivity(db, admin.username, "game.create", `Created game "${args.title}" as ${args.status}.`);
      }
      await db.delete(schema.gameCategories).where(eq(schema.gameCategories.gameId, gameId));
      if (args.categoryIds.length > 0) {
        const stmts: BatchItem<"sqlite">[] = args.categoryIds.map((categoryId) =>
          db.insert(schema.gameCategories).values({ gameId, categoryId }),
        );
        const [first, ...rest] = stmts;
        if (first) await db.batch([first, ...rest]);
      }
      ctx.invalidateQueries();
      return { id: gameId, slug };
    },
  }),

  adminDeleteGame: defineAction({
    description: "Permanently deletes a game and its category links.",
    request: z.object({ token: z.string().min(1), id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const { db, admin } = await requireAdmin(ctx, args.token, ["owner", "admin"]);
      await db.delete(schema.gameCategories).where(eq(schema.gameCategories.gameId, args.id));
      await db.delete(schema.games).where(eq(schema.games.id, args.id));
      await logActivity(db, admin.username, "game.delete", `Deleted game #${args.id}.`);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  adminBulkGames: defineAction({
    description: "Applies a bulk operation (publish, unpublish, feature, trending, new, archive, delete, assign category) to selected games, respecting the embed allowlist publish gate.",
    request: z.object({
      token: z.string().min(1),
      ids: z.array(z.number().int().positive()).min(1).max(200),
      operation: z.enum([
        "publish", "unpublish", "feature", "unfeature", "trending", "untrending",
        "markNew", "unmarkNew", "archive", "delete", "assignCategory",
      ]),
      categoryId: z.number().int().positive().optional(),
    }),
    response: z.object({ updated: z.number(), blocked: z.number() }),
    async handler(ctx, args) {
      const { db, admin } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor"]);
      if (args.operation === "delete") {
        await requireAdmin(ctx, args.token, ["owner", "admin"]);
      }
      let updated = 0;
      let blocked = 0;
      const now = new Date();
      for (const id of args.ids) {
        const rows = await db.select().from(schema.games).where(eq(schema.games.id, id)).limit(1);
        const game = rows[0];
        if (!game) continue;
        if (args.operation === "publish") {
          if (game.gameType === "iframe") {
            const allowed = await isEmbedAllowed(db, game.embedUrl, game.providerId);
            if (!allowed) { blocked++; continue; }
          }
          await db.update(schema.games).set({ status: "published", publishedAt: game.publishedAt ?? now, updatedAt: now }).where(eq(schema.games.id, id));
        } else if (args.operation === "unpublish") {
          await db.update(schema.games).set({ status: "draft", updatedAt: now }).where(eq(schema.games.id, id));
        } else if (args.operation === "feature") {
          await db.update(schema.games).set({ featured: 1, updatedAt: now }).where(eq(schema.games.id, id));
        } else if (args.operation === "unfeature") {
          await db.update(schema.games).set({ featured: 0, updatedAt: now }).where(eq(schema.games.id, id));
        } else if (args.operation === "trending") {
          await db.update(schema.games).set({ trending: 1, updatedAt: now }).where(eq(schema.games.id, id));
        } else if (args.operation === "untrending") {
          await db.update(schema.games).set({ trending: 0, updatedAt: now }).where(eq(schema.games.id, id));
        } else if (args.operation === "markNew") {
          await db.update(schema.games).set({ isNew: 1, updatedAt: now }).where(eq(schema.games.id, id));
        } else if (args.operation === "unmarkNew") {
          await db.update(schema.games).set({ isNew: 0, updatedAt: now }).where(eq(schema.games.id, id));
        } else if (args.operation === "archive") {
          await db.update(schema.games).set({ status: "archived", updatedAt: now }).where(eq(schema.games.id, id));
        } else if (args.operation === "delete") {
          await db.delete(schema.gameCategories).where(eq(schema.gameCategories.gameId, id));
          await db.delete(schema.games).where(eq(schema.games.id, id));
        } else if (args.operation === "assignCategory" && args.categoryId) {
          const existing = await db
            .select()
            .from(schema.gameCategories)
            .where(and(eq(schema.gameCategories.gameId, id), eq(schema.gameCategories.categoryId, args.categoryId)));
          if (existing.length === 0) {
            await db.insert(schema.gameCategories).values({ gameId: id, categoryId: args.categoryId });
          }
        }
        updated++;
      }
      await logActivity(db, admin.username, "game.bulk", `Bulk "${args.operation}" on ${updated} game(s)${blocked ? `, ${blocked} blocked by the allowlist gate` : ""}.`);
      ctx.invalidateQueries();
      return { updated, blocked };
    },
  }),

  adminImportGames: defineAction({
    description: "Imports game rows (from the CSV template) as drafts with duplicate detection by slug and title, and writes a provider import log.",
    request: z.object({
      token: z.string().min(1),
      providerId: z.number().int().positive().nullable().default(null),
      rows: z.array(
        z.object({
          title: z.string().min(1).max(160),
          slug: z.string().max(120).optional(),
          description: z.string().max(5000).default(""),
          instructions: z.string().max(5000).default(""),
          thumbnail_url: z.string().max(3000).default(""),
          game_url: z.string().max(1000).default(""),
          embed_url: z.string().max(1000).default(""),
          category: z.string().max(80).default(""),
          game_type: z.string().max(30).default("iframe"),
          license: z.string().max(500).default(""),
          seo_title: z.string().max(200).default(""),
          seo_description: z.string().max(400).default(""),
        }),
      ).min(1).max(500),
    }),
    response: z.object({ imported: z.number(), duplicates: z.number(), skipped: z.number() }),
    async handler(ctx, args) {
      const { db, admin } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor"]);
      const cats = await db.select().from(schema.categories);
      const existing = await db.select().from(schema.games);
      const seenSlugs = new Set(existing.map((g: AnyDb) => g.slug as string));
      const seenTitles = new Set(existing.map((g: AnyDb) => (g.title as string).toLowerCase()));
      let imported = 0;
      let duplicates = 0;
      let skipped = 0;
      const now = new Date();
      const batchLinks: { slug: string; categoryId: number }[] = [];
      for (const row of args.rows) {
        const slug = slugify(row.slug && row.slug.length > 0 ? row.slug : row.title);
        if (!slug || !row.title.trim()) { skipped++; continue; }
        if (seenSlugs.has(slug) || seenTitles.has(row.title.trim().toLowerCase())) { duplicates++; continue; }
        seenSlugs.add(slug);
        seenTitles.add(row.title.trim().toLowerCase());
        const gameType = row.game_type === "external" ? "external" : row.game_type === "builtin" ? "builtin" : "iframe";
        await db.insert(schema.games).values({
          title: row.title.trim(),
          slug,
          description: row.description,
          instructions: row.instructions,
          thumbnailUrl: row.thumbnail_url || null,
          gameUrl: row.game_url || null,
          embedUrl: row.embed_url || null,
          providerId: args.providerId,
          gameType: gameType as "iframe" | "external" | "builtin",
          controls: "{}",
          licenseInfo: JSON.stringify({ note: row.license || "Imported — verify license before publishing." }),
          status: "draft",
          seoTitle: row.seo_title || `${row.title.trim()} — Play Free Online | PlayVerse`,
          seoDescription: row.seo_description || row.description.slice(0, 155),
          createdAt: now,
          updatedAt: now,
          publishedAt: null,
        });
        const cat = cats.find(
          (c: AnyDb) => c.slug === slugify(row.category) || c.name.toLowerCase() === row.category.toLowerCase(),
        );
        if (cat) batchLinks.push({ slug, categoryId: cat.id });
        imported++;
      }
      if (batchLinks.length > 0) {
        const inserted = await db.select().from(schema.games);
        const stmts: BatchItem<"sqlite">[] = [];
        for (const link of batchLinks) {
          const game = inserted.find((g: AnyDb) => g.slug === link.slug);
          if (game) stmts.push(db.insert(schema.gameCategories).values({ gameId: game.id, categoryId: link.categoryId }));
        }
        const [first, ...rest] = stmts;
        if (first) await db.batch([first, ...rest]);
      }
      await db.insert(schema.providerImportLogs).values({
        providerId: args.providerId,
        source: "csv",
        imported,
        skipped,
        duplicates,
        status: "completed",
        message: `CSV import by ${admin.username}: ${imported} imported as drafts, ${duplicates} duplicates skipped, ${skipped} invalid rows skipped.`,
        createdAt: now,
      });
      await logActivity(db, admin.username, "game.import", `CSV import: ${imported} games imported as drafts (${duplicates} duplicates).`);
      ctx.invalidateQueries();
      return { imported, duplicates, skipped };
    },
  }),

  adminUploadThumbnail: defineAction({
    description: "Stores an uploaded game thumbnail image in blob storage and returns its blob key.",
    request: z.object({
      token: z.string().min(1),
      dataBase64: z.string().min(10),
      mimeType: z.string().min(3).max(60),
    }),
    response: z.object({ blobKey: z.string(), url: z.string().nullable() }),
    async handler(ctx, args) {
      await requireAdmin(ctx, args.token, ["owner", "admin", "editor"]);
      if (!args.mimeType.startsWith("image/")) throw new Error("Only image files can be uploaded as thumbnails.");
      const bytes = Uint8Array.from(atob(args.dataBase64), (c) => c.charCodeAt(0));
      if (bytes.length > 2_500_000) throw new Error("Thumbnail is too large (max ~2.5 MB).");
      const ext = args.mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
      const key = `thumbnails/${Date.now()}-${randomToken(6)}.${ext}`;
      await ctx.blobs.put(key, bytes, { contentType: args.mimeType });
      const url = await ctx.blobs.getUrl(key);
      return { blobKey: key, url: url ?? null };
    },
  }),

  adminListCategories: defineAction({
    description: "Lists all categories with total game counts and library targets for admin management.",
    request: z.object({ token: z.string().min(1) }),
    response: z.object({ categories: z.array(categoryOut) }),
    async handler(ctx, args) {
      const { db } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor", "viewer"]);
      const cats = await db.select().from(schema.categories).orderBy(asc(schema.categories.sortOrder));
      const links = await db.select().from(schema.gameCategories);
      return {
        categories: (cats as AnyDb[]).map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          color: c.color,
          icon: c.icon,
          targetCount: c.targetCount,
          gameCount: (links as AnyDb[]).filter((l) => l.categoryId === c.id).length,
        })),
      };
    },
  }),

  adminSaveCategory: defineAction({
    description: "Creates or updates a game category.",
    request: z.object({
      token: z.string().min(1),
      id: z.number().int().positive().optional(),
      name: z.string().min(1).max(80),
      slug: z.string().max(90).optional(),
      description: z.string().max(1000).default(""),
      color: z.string().max(20).default("#2563eb"),
      icon: z.string().max(8).default("🎮"),
      targetCount: z.number().int().min(0).max(100000).default(0),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const { db, admin } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor"]);
      const slug = slugify(args.slug && args.slug.length > 0 ? args.slug : args.name);
      if (args.id) {
        await db.update(schema.categories).set({
          name: args.name, slug, description: args.description, color: args.color,
          icon: args.icon, targetCount: args.targetCount,
        }).where(eq(schema.categories.id, args.id));
        await logActivity(db, admin.username, "category.update", `Updated category "${args.name}".`);
        ctx.invalidateQueries();
        return { id: args.id };
      }
      const inserted = await db.insert(schema.categories).values({
        name: args.name, slug, description: args.description, color: args.color,
        icon: args.icon, targetCount: args.targetCount, createdAt: new Date(),
      }).returning({ id: schema.categories.id });
      await logActivity(db, admin.username, "category.create", `Created category "${args.name}".`);
      ctx.invalidateQueries();
      return { id: inserted[0]?.id ?? 0 };
    },
  }),

  adminDeleteCategory: defineAction({
    description: "Deletes a category and unlinks its games (games themselves are kept).",
    request: z.object({ token: z.string().min(1), id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const { db, admin } = await requireAdmin(ctx, args.token, ["owner", "admin"]);
      await db.delete(schema.gameCategories).where(eq(schema.gameCategories.categoryId, args.id));
      await db.delete(schema.categories).where(eq(schema.categories.id, args.id));
      await logActivity(db, admin.username, "category.delete", `Deleted category #${args.id}.`);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  adminProviders: defineAction({
    description: "Lists game providers with their integration config, embed allowlist and import logs for admin management.",
    request: z.object({ token: z.string().min(1) }),
    response: z.object({
      providers: z.array(
        z.object({
          id: z.number(), name: z.string(), slug: z.string(), website: z.string().nullable(),
          status: z.string(), notes: z.string(), gameCount: z.number(),
          apiKeySet: z.boolean(), allowlistDomains: z.array(z.string()),
          environment: z.string(), publisherId: z.string(),
        }),
      ),
      logs: z.array(
        z.object({
          id: z.number(), providerId: z.number().nullable(), source: z.string(),
          imported: z.number(), skipped: z.number(), duplicates: z.number(),
          status: z.string(), message: z.string(), createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const { db } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor", "viewer"]);
      const provs = await db.select().from(schema.gameProviders);
      const integrations = await db.select().from(schema.providerIntegrations);
      const allGames = await db.select().from(schema.games);
      const logs = await db.select().from(schema.providerImportLogs).orderBy(desc(schema.providerImportLogs.id)).limit(50);
      return {
        providers: (provs as AnyDb[]).map((p) => {
          const integration = (integrations as AnyDb[]).find((i) => i.providerId === p.id);
          let config: Record<string, string> = {};
          try { config = JSON.parse(integration?.config ?? "{}"); } catch { config = {}; }
          let domains: string[] = [];
          try { domains = JSON.parse(integration?.allowlistDomains ?? "[]"); } catch { domains = []; }
          return {
            id: p.id, name: p.name, slug: p.slug, website: p.website ?? null,
            status: p.status, notes: p.notes,
            gameCount: allGames.filter((g: AnyDb) => g.providerId === p.id).length,
            apiKeySet: integration?.apiKeySet === 1,
            allowlistDomains: domains,
            environment: integration?.environment ?? "production",
            publisherId: config["publisherId"] ?? "",
          };
        }),
        logs: (logs as AnyDb[]).map((l) => ({
          id: l.id, providerId: l.providerId ?? null, source: l.source,
          imported: l.imported, skipped: l.skipped, duplicates: l.duplicates,
          status: l.status, message: l.message, createdAt: (l.createdAt as Date).toISOString(),
        })),
      };
    },
  }),

  adminSaveProvider: defineAction({
    description: "Updates a provider's status/notes and its integration config (publisher ID, embed allowlist, API key stored server-side only).",
    request: z.object({
      token: z.string().min(1),
      providerId: z.number().int().positive(),
      status: z.enum(["not_connected", "configured", "connected", "error"]),
      notes: z.string().max(2000).default(""),
      publisherId: z.string().max(200).default(""),
      apiKey: z.string().max(500).optional(),
      clearApiKey: z.boolean().default(false),
      allowlistDomains: z.array(z.string().max(200)).max(50).default([]),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const { db, admin } = await requireAdmin(ctx, args.token, ["owner", "admin"]);
      await db.update(schema.gameProviders)
        .set({ status: args.status, notes: args.notes })
        .where(eq(schema.gameProviders.id, args.providerId));
      const existing = await db.select().from(schema.providerIntegrations)
        .where(eq(schema.providerIntegrations.providerId, args.providerId)).limit(1);
      let config: Record<string, string> = {};
      try { config = JSON.parse(existing[0]?.config ?? "{}"); } catch { config = {}; }
      config["publisherId"] = args.publisherId;
      if (args.apiKey && args.apiKey.length > 0) config["apiKey"] = args.apiKey;
      if (args.clearApiKey) delete config["apiKey"];
      const domains = args.allowlistDomains
        .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "")
        .filter((d) => d.length > 0);
      const apiKeySet = typeof config["apiKey"] === "string" && config["apiKey"].length > 0 ? 1 : 0;
      if (existing[0]) {
        await db.update(schema.providerIntegrations).set({
          config: JSON.stringify(config), apiKeySet,
          allowlistDomains: JSON.stringify(domains), updatedAt: new Date(),
        }).where(eq(schema.providerIntegrations.id, existing[0].id));
      } else {
        await db.insert(schema.providerIntegrations).values({
          providerId: args.providerId, config: JSON.stringify(config), apiKeySet,
          allowlistDomains: JSON.stringify(domains), updatedAt: new Date(),
        });
      }
      await logActivity(db, admin.username, "provider.update", `Updated provider #${args.providerId} (status: ${args.status}, allowlist: ${domains.length} domain(s)).`);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  adminListAds: defineAction({
    description: "Lists all advertising placements with their AdSense/GAM configuration.",
    request: z.object({ token: z.string().min(1) }),
    response: z.object({ ads: z.array(adOut) }),
    async handler(ctx, args) {
      const { db } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor", "viewer"]);
      const rows = await db.select().from(schema.adPlacements).orderBy(asc(schema.adPlacements.id));
      return {
        ads: (rows as AnyDb[]).map((a) => ({
          id: a.id, placementKey: a.placementKey, label: a.label, network: a.network,
          enabled: a.enabled === 1, publisherId: a.publisherId, networkCode: a.networkCode,
          adUnitPath: a.adUnitPath, sizes: a.sizes,
          showDesktop: a.showDesktop === 1, showMobile: a.showMobile === 1,
        })),
      };
    },
  }),

  adminSaveAd: defineAction({
    description: "Updates one advertising placement (network, publisher/network IDs, ad unit path, sizes, device visibility, enabled).",
    request: z.object({
      token: z.string().min(1),
      id: z.number().int().positive(),
      network: z.enum(["none", "adsense", "gam"]),
      enabled: z.boolean(),
      publisherId: z.string().max(120).default(""),
      networkCode: z.string().max(60).default(""),
      adUnitPath: z.string().max(300).default(""),
      sizes: z.string().max(200).default("responsive"),
      showDesktop: z.boolean().default(true),
      showMobile: z.boolean().default(true),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const { db, admin } = await requireAdmin(ctx, args.token, ["owner", "admin"]);
      if (args.enabled && args.network === "adsense" && !args.publisherId) {
        throw new Error("AdSense placements need a publisher ID (ca-pub-…) before they can be enabled.");
      }
      if (args.enabled && args.network === "gam" && (!args.networkCode || !args.adUnitPath)) {
        throw new Error("GAM placements need a network code and an ad unit path before they can be enabled.");
      }
      await db.update(schema.adPlacements).set({
        network: args.network, enabled: args.enabled ? 1 : 0,
        publisherId: args.publisherId, networkCode: args.networkCode,
        adUnitPath: args.adUnitPath, sizes: args.sizes,
        showDesktop: args.showDesktop ? 1 : 0, showMobile: args.showMobile ? 1 : 0,
        updatedAt: new Date(),
      }).where(eq(schema.adPlacements.id, args.id));
      await logActivity(db, admin.username, "ads.update", `Updated ad placement #${args.id} (${args.network}, ${args.enabled ? "enabled" : "disabled"}).`);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  adminListPages: defineAction({
    description: "Lists all CMS static pages for editing.",
    request: z.object({ token: z.string().min(1) }),
    response: z.object({
      pages: z.array(z.object({ slug: z.string(), title: z.string(), body: z.string(), updatedAt: z.string() })),
    }),
    async handler(ctx, args) {
      const { db } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor", "viewer"]);
      const rows = await db.select().from(schema.staticPages).orderBy(asc(schema.staticPages.slug));
      return {
        pages: (rows as AnyDb[]).map((p) => ({
          slug: p.slug, title: p.title, body: p.body, updatedAt: (p.updatedAt as Date).toISOString(),
        })),
      };
    },
  }),

  adminSavePage: defineAction({
    description: "Updates a CMS static page's title and body.",
    request: z.object({
      token: z.string().min(1),
      slug: z.string().min(1).max(60),
      title: z.string().min(1).max(160),
      body: z.string().max(30000),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const { db, admin } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor"]);
      await db.update(schema.staticPages)
        .set({ title: args.title, body: args.body, updatedAt: new Date() })
        .where(eq(schema.staticPages.slug, args.slug));
      await logActivity(db, admin.username, "page.update", `Edited static page "${args.slug}".`);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  adminListContactMessages: defineAction({
    description: "Lists messages submitted through the public contact form, newest first.",
    request: z.object({ token: z.string().min(1) }),
    response: z.object({
      messages: z.array(z.object({
        id: z.number(), name: z.string(), email: z.string(),
        subject: z.string(), message: z.string(), createdAt: z.string(),
      })),
    }),
    async handler(ctx, args) {
      const { db } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor", "viewer"]);
      const rows = await db.select().from(schema.contactMessages).orderBy(desc(schema.contactMessages.id)).limit(200);
      return {
        messages: (rows as AnyDb[]).map((m) => ({
          id: m.id, name: m.name, email: m.email, subject: m.subject,
          message: m.message, createdAt: (m.createdAt as Date).toISOString(),
        })),
      };
    },
  }),

  adminDeleteContactMessage: defineAction({
    description: "Deletes one contact-form message from the admin inbox.",
    request: z.object({
      token: z.string().min(1),
      id: z.number().int().positive(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const { db, admin } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor"]);
      await db.delete(schema.contactMessages).where(eq(schema.contactMessages.id, args.id));
      await logActivity(db, admin.username, "contact.delete", `Deleted contact message #${args.id}.`);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  adminGetConfig: defineAction({
    description: "Returns website settings, SEO settings and redirect rules for the admin settings screens.",
    request: z.object({ token: z.string().min(1) }),
    response: z.object({
      settings: z.record(z.string(), z.string()),
      seo: z.record(z.string(), z.string()),
      redirects: z.array(z.object({ id: z.number(), fromPath: z.string(), toPath: z.string(), statusCode: z.number() })),
    }),
    async handler(ctx, args) {
      const { db } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor", "viewer"]);
      const settings = await settingsMap(db, schema.websiteSettings);
      const seo = await settingsMap(db, schema.seoSettings);
      const redirects = await db.select().from(schema.redirectRules).orderBy(asc(schema.redirectRules.id));
      return {
        settings, seo,
        redirects: (redirects as AnyDb[]).map((r) => ({
          id: r.id, fromPath: r.fromPath, toPath: r.toPath, statusCode: r.statusCode,
        })),
      };
    },
  }),

  adminSaveSettings: defineAction({
    description: "Saves website settings (brand, contact, analytics and ad network defaults) — owner/admin only.",
    request: z.object({
      token: z.string().min(1),
      values: z.record(z.string(), z.string().max(4000)),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const { db, admin } = await requireAdmin(ctx, args.token, ["owner", "admin"]);
      for (const [key, value] of Object.entries(args.values)) {
        await db.insert(schema.websiteSettings).values({ key, value })
          .onConflictDoUpdate({ target: schema.websiteSettings.key, set: { value } });
      }
      await logActivity(db, admin.username, "settings.update", `Updated ${Object.keys(args.values).length} website setting(s).`);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  adminSaveSeo: defineAction({
    description: "Saves SEO default settings — owner/admin only.",
    request: z.object({
      token: z.string().min(1),
      values: z.record(z.string(), z.string().max(4000)),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const { db, admin } = await requireAdmin(ctx, args.token, ["owner", "admin"]);
      for (const [key, value] of Object.entries(args.values)) {
        await db.insert(schema.seoSettings).values({ key, value })
          .onConflictDoUpdate({ target: schema.seoSettings.key, set: { value } });
      }
      await logActivity(db, admin.username, "seo.update", "Updated SEO defaults.");
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  adminSaveRedirect: defineAction({
    description: "Creates or updates a redirect rule.",
    request: z.object({
      token: z.string().min(1),
      id: z.number().int().positive().optional(),
      fromPath: z.string().min(1).max(200),
      toPath: z.string().min(1).max(500),
      statusCode: z.number().int().min(300).max(399).default(301),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const { db, admin } = await requireAdmin(ctx, args.token, ["owner", "admin"]);
      if (args.id) {
        await db.update(schema.redirectRules)
          .set({ fromPath: args.fromPath, toPath: args.toPath, statusCode: args.statusCode })
          .where(eq(schema.redirectRules.id, args.id));
        return { id: args.id };
      }
      const inserted = await db.insert(schema.redirectRules).values({
        fromPath: args.fromPath, toPath: args.toPath, statusCode: args.statusCode, createdAt: new Date(),
      }).returning({ id: schema.redirectRules.id });
      await logActivity(db, admin.username, "redirect.create", `Redirect ${args.fromPath} → ${args.toPath}.`);
      ctx.invalidateQueries();
      return { id: inserted[0]?.id ?? 0 };
    },
  }),

  adminDeleteRedirect: defineAction({
    description: "Deletes a redirect rule.",
    request: z.object({ token: z.string().min(1), id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const { db } = await requireAdmin(ctx, args.token, ["owner", "admin"]);
      await db.delete(schema.redirectRules).where(eq(schema.redirectRules.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  adminAnalytics: defineAction({
    description: "Returns analytics computed from real recorded events: totals, plays by game/category/device/day, top searches and top pages. Nothing is estimated.",
    request: z.object({ token: z.string().min(1) }),
    response: z.object({
      totalPlays: z.number(),
      totalViews: z.number(),
      totalSearches: z.number(),
      totalFavorites: z.number(),
      playsByGame: z.array(z.object({ title: z.string(), slug: z.string(), plays: z.number() })),
      playsByCategory: z.array(z.object({ name: z.string(), plays: z.number() })),
      playsByDevice: z.array(z.object({ device: z.string(), plays: z.number() })),
      playsByDay: z.array(z.object({ day: z.string(), plays: z.number() })),
      topSearches: z.array(z.object({ query: z.string(), count: z.number() })),
      topPages: z.array(z.object({ path: z.string(), views: z.number() })),
    }),
    async handler(ctx, args) {
      const { db } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor", "viewer"]);
      const plays = await db.select().from(schema.gamePlays);
      const views = await db.select().from(schema.pageViews);
      const searches = await db.select().from(schema.searchLogs);
      const favs = await db.select().from(schema.favorites);
      const allGames = await db.select().from(schema.games);
      const links = await db.select().from(schema.gameCategories);
      const cats = await db.select().from(schema.categories);
      const gameTitle = new Map<number, string>(
        allGames.map((g: AnyDb): [number, string] => [g.id as number, g.title as string]),
      );
      const gameSlug = new Map<number, string>(
        allGames.map((g: AnyDb): [number, string] => [g.id as number, g.slug as string]),
      );
      const byGame = new Map<number, number>();
      const byDevice = new Map<string, number>();
      const byDay = new Map<string, number>();
      for (const p of plays as AnyDb[]) {
        byGame.set(p.gameId, (byGame.get(p.gameId) ?? 0) + 1);
        byDevice.set(p.deviceType, (byDevice.get(p.deviceType) ?? 0) + 1);
        const day = (p.createdAt as Date).toISOString().slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
      }
      const byCategory = new Map<string, number>();
      for (const [gameId, count] of byGame) {
        for (const link of (links as AnyDb[]).filter((l) => l.gameId === gameId)) {
          const cat = cats.find((c: AnyDb) => c.id === link.categoryId);
          if (cat) byCategory.set(cat.name, (byCategory.get(cat.name) ?? 0) + count);
        }
      }
      const searchCounts = new Map<string, number>();
      for (const s of searches as AnyDb[]) searchCounts.set(s.query, (searchCounts.get(s.query) ?? 0) + 1);
      const pageCounts = new Map<string, number>();
      for (const v of views as AnyDb[]) pageCounts.set(v.path, (pageCounts.get(v.path) ?? 0) + 1);
      return {
        totalPlays: plays.length,
        totalViews: views.length,
        totalSearches: searches.length,
        totalFavorites: favs.length,
        playsByGame: [...byGame.entries()]
          .map(([id, count]) => ({ title: gameTitle.get(id) ?? `#${id}`, slug: gameSlug.get(id) ?? "", plays: count }))
          .sort((a, b) => b.plays - a.plays).slice(0, 10),
        playsByCategory: [...byCategory.entries()].map(([name, count]) => ({ name, plays: count })).sort((a, b) => b.plays - a.plays),
        playsByDevice: [...byDevice.entries()].map(([device, count]) => ({ device, plays: count })).sort((a, b) => b.plays - a.plays),
        playsByDay: [...byDay.entries()].map(([day, count]) => ({ day, plays: count })).sort((a, b) => a.day.localeCompare(b.day)).slice(-30),
        topSearches: [...searchCounts.entries()].map(([query, count]) => ({ query, count })).sort((a, b) => b.count - a.count).slice(0, 10),
        topPages: [...pageCounts.entries()].map(([path, count]) => ({ path, views: count })).sort((a, b) => b.views - a.views).slice(0, 10),
      };
    },
  }),

  adminTeam: defineAction({
    description: "Lists admin accounts and recent activity log entries.",
    request: z.object({ token: z.string().min(1) }),
    response: z.object({
      admins: z.array(z.object({ id: z.number(), username: z.string(), displayName: z.string(), role: z.string(), createdAt: z.string() })),
      activity: z.array(z.object({ id: z.number(), actor: z.string(), action: z.string(), detail: z.string(), createdAt: z.string() })),
    }),
    async handler(ctx, args) {
      const { db } = await requireAdmin(ctx, args.token, ["owner", "admin", "editor", "viewer"]);
      const admins = await db.select().from(schema.adminProfiles).orderBy(asc(schema.adminProfiles.id));
      const activity = await db.select().from(schema.activityLogs).orderBy(desc(schema.activityLogs.id)).limit(60);
      return {
        admins: (admins as AnyDb[]).map((a) => ({
          id: a.id, username: a.username, displayName: a.displayName, role: a.role,
          createdAt: (a.createdAt as Date).toISOString(),
        })),
        activity: (activity as AnyDb[]).map((a) => ({
          id: a.id, actor: a.actor, action: a.action, detail: a.detail,
          createdAt: (a.createdAt as Date).toISOString(),
        })),
      };
    },
  }),

  adminCreateAdmin: defineAction({
    description: "Creates an additional admin account with a role (owner only).",
    request: z.object({
      token: z.string().min(1),
      username: z.string().min(3).max(40),
      displayName: z.string().max(60).default(""),
      password: z.string().min(8).max(200),
      role: z.enum(["admin", "editor", "viewer"]),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const { db, admin } = await requireAdmin(ctx, args.token, ["owner"]);
      const salt = randomToken(12);
      const passwordHash = await hashPassword(args.password, salt);
      const inserted = await db.insert(schema.adminProfiles).values({
        username: args.username.toLowerCase(),
        displayName: args.displayName || args.username,
        passwordHash, salt, role: args.role, createdAt: new Date(),
      }).returning({ id: schema.adminProfiles.id });
      await logActivity(db, admin.username, "admin.create", `Created ${args.role} account "${args.username}".`);
      ctx.invalidateQueries();
      return { id: inserted[0]?.id ?? 0 };
    },
  }),

  adminDeleteAdmin: defineAction({
    description: "Deletes an admin account and their sessions (owner only; cannot delete yourself or the last owner).",
    request: z.object({ token: z.string().min(1), id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const { db, admin } = await requireAdmin(ctx, args.token, ["owner"]);
      if (args.id === admin.id) throw new Error("You cannot delete your own account.");
      const target = await db.select().from(schema.adminProfiles).where(eq(schema.adminProfiles.id, args.id)).limit(1);
      if (target[0]?.role === "owner") {
        const owners = await db.select().from(schema.adminProfiles).where(eq(schema.adminProfiles.role, "owner"));
        if (owners.length <= 1) throw new Error("Cannot delete the last owner account.");
      }
      await db.delete(schema.adminSessions).where(eq(schema.adminSessions.adminId, args.id));
      await db.delete(schema.adminProfiles).where(eq(schema.adminProfiles.id, args.id));
      await logActivity(db, admin.username, "admin.delete", `Deleted admin account #${args.id}.`);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  listCodeFiles: defineAction({
    description: "Lists the downloadable PlayVerse code and project files (standalone HTML, games data, schema, configs, guides) with live catalog counts.",
    request: z.object({}),
    response: z.object({
      files: z.array(z.object({
        key: z.string(), filename: z.string(), mimeType: z.string(), language: z.string(),
        icon: z.string(), title: z.string(), description: z.string(),
      })),
      totals: z.object({ published: z.number(), categories: z.number() }),
      generatedAt: z.string(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>() as AnyDb;
      await ensureSeed(db);
      const published = await publishedGames(db);
      const cats = await db.select().from(schema.categories);
      return {
        files: CODE_FILES.map((f) => ({ key: f.key, filename: f.filename, mimeType: f.mimeType, language: f.language, icon: f.icon, title: f.title, description: f.description })),
        totals: { published: published.length, categories: (cats as AnyDb[]).length },
        generatedAt: new Date().toISOString(),
      };
    },
  }),

  getCodeFile: defineAction({
    description: "Generates and returns the full text content of one downloadable PlayVerse code/project file, built live from the current catalog and settings.",
    request: z.object({
      fileKey: z.enum(["standalone", "gamesJson", "gamesCsv", "schemaSql", "packageJson", "readme", "deployment", "envExample", "vercelJson", "structure"]),
    }),
    response: z.object({ filename: z.string(), mimeType: z.string(), content: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>() as AnyDb;
      await ensureSeed(db);
      const meta = CODE_FILES.find((f) => f.key === (args.fileKey as CodeFileKey))!;
      const settings = await settingsMap(db, schema.websiteSettings);
      const siteTitle = settings["site_title"] || "PlayVerse";
      const tagline = settings["tagline"] || "Play More. Explore More. PlayVerse.";
      const published = await publishedGames(db);
      const games = await serializeGames(db, [...published].sort((a: AnyDb, b: AnyDb) => (a.title as string).localeCompare(b.title as string)));
      const cats = await categoriesWithCounts(db);
      const now = new Date().toISOString();
      let content = "";

      if (args.fileKey === "gamesJson") {
        content = JSON.stringify({
          project: siteTitle, tagline, exportedAt: now,
          totals: { publishedGames: games.length, categories: cats.length },
          categories: cats,
          games: games.map((g) => ({
            id: g.id, title: g.title, slug: g.slug, description: g.description, instructions: g.instructions,
            rules: g.rules, tips: g.tips, features: g.features, faqs: g.faqs,
            thumbnailUrl: g.thumbnailUrl, gameType: g.gameType, builtinKey: g.builtinKey,
            controls: g.controls, featured: g.featured, trending: g.trending, isNew: g.isNew,
            status: g.status, seoTitle: g.seoTitle, seoDescription: g.seoDescription,
            playCount: g.playCount, categories: g.categories.map((c) => c.name),
            url: `/game/${g.slug}`,
          })),
        }, null, 2);
      } else if (args.fileKey === "gamesCsv") {
        const head = ["id", "title", "slug", "category", "game_type", "builtin_key", "status", "featured", "trending", "play_count", "seo_title", "seo_description", "description"];
        const lines = [head.join(",")];
        for (const g of games) {
          lines.push([String(g.id), g.title, g.slug, g.categories.map((c) => c.name).join(" | "), g.gameType, g.builtinKey ?? "", g.status, g.featured ? "1" : "0", g.trending ? "1" : "0", String(g.playCount), g.seoTitle, g.seoDescription, g.description]
            .map((v) => csvEscape(v)).join(","));
        }
        content = lines.join("\n");
      } else if (args.fileKey === "schemaSql") {
        content = `-- ${siteTitle} — Database Schema (generated ${now})
-- Original source: server/src/schema.ts + drizzle/ migrations in this workspace.
-- Works on SQLite directly; for Supabase/Postgres change INTEGER PRIMARY KEY AUTOINCREMENT -> SERIAL / GENERATED ALWAYS AS IDENTITY and INTEGER timestamps -> TIMESTAMPTZ as needed.

CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '#2563eb', icon TEXT NOT NULL DEFAULT '🎮', target_count INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE games (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', instructions TEXT NOT NULL DEFAULT '', rules TEXT NOT NULL DEFAULT '', tips TEXT NOT NULL DEFAULT '[]', features TEXT NOT NULL DEFAULT '[]', faqs TEXT NOT NULL DEFAULT '[]', thumbnail_url TEXT, thumbnail_blob_key TEXT, game_url TEXT, embed_url TEXT, provider_id INTEGER, game_type TEXT NOT NULL DEFAULT 'iframe', builtin_key TEXT, controls TEXT NOT NULL DEFAULT '{}', license_info TEXT NOT NULL DEFAULT '{}', featured INTEGER NOT NULL DEFAULT 0, trending INTEGER NOT NULL DEFAULT 0, is_new INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', seo_title TEXT NOT NULL DEFAULT '', seo_description TEXT NOT NULL DEFAULT '', canonical_url TEXT, play_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, published_at INTEGER);
CREATE INDEX games_status_idx ON games (status);
CREATE INDEX games_provider_idx ON games (provider_id);
CREATE INDEX games_featured_idx ON games (featured);
CREATE INDEX games_trending_idx ON games (trending);
CREATE TABLE game_categories (game_id INTEGER NOT NULL, category_id INTEGER NOT NULL);
CREATE UNIQUE INDEX game_categories_pair ON game_categories (game_id, category_id);
CREATE TABLE game_providers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, website TEXT, status TEXT NOT NULL DEFAULT 'not_connected', notes TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
CREATE TABLE provider_integrations (id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER NOT NULL UNIQUE, environment TEXT NOT NULL DEFAULT 'production', config TEXT NOT NULL DEFAULT '{}', api_key_set INTEGER NOT NULL DEFAULT 0, allowlist_domains TEXT NOT NULL DEFAULT '[]', updated_at INTEGER NOT NULL);
CREATE TABLE provider_import_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER, source TEXT NOT NULL DEFAULT 'manual', imported INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0, duplicates INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'completed', message TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
CREATE TABLE admin_profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin', created_at INTEGER NOT NULL);
CREATE TABLE admin_sessions (token TEXT PRIMARY KEY, admin_id INTEGER NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE favorites (id INTEGER PRIMARY KEY AUTOINCREMENT, visitor_id TEXT NOT NULL, game_id INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE UNIQUE INDEX favorites_pair ON favorites (visitor_id, game_id);
CREATE TABLE game_plays (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER NOT NULL, visitor_id TEXT NOT NULL DEFAULT '', device_type TEXT NOT NULL DEFAULT 'unknown', referrer TEXT NOT NULL DEFAULT 'direct', created_at INTEGER NOT NULL);
CREATE TABLE page_views (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE search_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT NOT NULL, results_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE website_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');
CREATE TABLE seo_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');
CREATE TABLE ad_placements (id INTEGER PRIMARY KEY AUTOINCREMENT, placement_key TEXT NOT NULL UNIQUE, label TEXT NOT NULL, network TEXT NOT NULL DEFAULT 'none', enabled INTEGER NOT NULL DEFAULT 0, publisher_id TEXT NOT NULL DEFAULT '', network_code TEXT NOT NULL DEFAULT '', ad_unit_path TEXT NOT NULL DEFAULT '', sizes TEXT NOT NULL DEFAULT 'responsive', show_desktop INTEGER NOT NULL DEFAULT 1, show_mobile INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL);
CREATE TABLE static_pages (slug TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL);
CREATE TABLE activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL DEFAULT 'system', action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
CREATE TABLE contact_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT NOT NULL, message TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE redirect_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, from_path TEXT NOT NULL UNIQUE, to_path TEXT NOT NULL, status_code INTEGER NOT NULL DEFAULT 301, created_at INTEGER NOT NULL);
`;
      } else if (args.fileKey === "packageJson") {
        content = JSON.stringify({
          name: "playverse", private: true, version: "1.0.0", type: "module",
          description: `${siteTitle} — ${tagline}`,
          scripts: { dev: "vite", build: "tsc -b && vite build", preview: "vite preview", typecheck: "tsc --noEmit" },
          dependencies: { react: "^19.2.5", "react-dom": "^19.2.5", "@tanstack/react-query": "^5.100.10", "drizzle-orm": "^0.45.2", zod: "^4.4.3" },
          devDependencies: { "@types/react": "^19.2.14", "@types/react-dom": "^19.2.3", tailwindcss: "^4.1.13", typescript: "^5.6.3", vite: "^6.0.0" },
          note: "Ye is workspace ke asal package.json par mabni template hai. Muse workspace ke andar build bun se hota hai; apni hosting par Vite + ye dependencies istemal hon gi.",
        }, null, 2);
      } else if (args.fileKey === "envExample") {
        content = `# ${siteTitle} — Environment Variables (template, koi asal secret nahi)
# Production stack (apni hosting / Supabase / Vercel) ke liye
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # SERVER ONLY — kabhi frontend mein mat rakho
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ADSENSE_PUBLISHER_ID=ca-pub-XXXXXXXXXXXXXXXX
NEXT_PUBLIC_GAM_NETWORK_CODE=
# Note: Is Muse workspace build mein yehi values Admin -> Settings mein save hoti hain, env file mein nahi.
`;
      } else if (args.fileKey === "vercelJson") {
        content = JSON.stringify({
          $schema: "https://openapi.vercel.sh/vercel.json",
          framework: "vite",
          rewrites: [{ source: "/((?!assets/).*)", destination: "/index.html" }],
          headers: [
            { source: "/sitemap.xml", headers: [{ key: "Content-Type", value: "application/xml" }] },
            { source: "/assets/(.*)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
          ],
        }, null, 2);
      } else if (args.fileKey === "structure") {
        content = `${siteTitle} — PROJECT STRUCTURE (asal workspace files)
Generated: ${now} · Published games: ${games.length} · Categories: ${cats.length}

playverse/
  space.json                  — Artifact metadata (name, slug, runtime)
  package.json                — Dependencies & scripts  [Download: package.json]
  client/
    index.html                — HTML shell + loading watchdog
    src/
      main.tsx                — App entry + error boundary
      App.tsx                 — Public portal: home, listings, game page, search, static pages, CODE FILES page
      Admin.tsx               — Admin dashboard (dashboard, games, categories, providers, ads, pages, messages, analytics, settings, team)
      api.ts                  — Typed action client
      gamekit.tsx             — Shared game shell (start/pause/score/game-over)
      games.tsx               — Built-in games batch 1 (14 originals)
      games2.tsx … games5.tsx — Built-in games batches 2–5 (86 expansion games, kul 100)
      theme.css               — Design tokens & animations
  server/
    src/
      actions.ts              — Tamam server actions (public + admin + code export)
      schema.ts               — Database schema (15+ tables)  [Download: schema.sql]
      seed.ts                 — Categories, providers, ad placements, settings seed
      library.ts              — 100 games ka catalog data + 400–500 word SEO content
      pages-content.ts        — Legal/info pages ka lamba content
  drizzle/
    0001_initial.sql … 0004_*.sql — Database migrations

Data files jo is page se download hoti hain:
  PlayVerse-Standalone.html, playverse-games.json, playverse-games.csv — live catalog se har dafa fresh banti hain.
`;
      } else if (args.fileKey === "readme") {
        content = `# ${siteTitle}\n\n> ${tagline}\n\nFree online HTML5 gaming portal — ${games.length} published playable games, ${cats.length} categories. No downloads, no signup, mobile + desktop.\n\n## Is download mein kya hai\n\n- **PlayVerse-Standalone.html** — ek hi file mein chalne wali website (catalog, search, categories). Browser mein kholo aur chalao.\n- **playverse-games.json / .csv** — tamam games ka asal data (live database se).\n- **playverse-database-schema.sql** — poori database structure.\n- **package.json, vercel.json, .env.example** — apni hosting (Vercel + Supabase) par deploy karne ki config.\n- **DEPLOYMENT-GUIDE.md** — step-by-step launch guide.\n- **PROJECT-STRUCTURE.txt** — asal source files ki list aur har file ka kaam.\n\n## Asal source code kahan hai\n\nPoora React + TypeScript source is Muse workspace mein hai: \`client/src/\` (App.tsx, Admin.tsx, games*.tsx, gamekit.tsx) aur \`server/src/\` (actions.ts, schema.ts, library.ts). File list ke liye PROJECT-STRUCTURE.txt dekho. Standalone HTML aur data files yahin se live generate hoti hain — ye purani copy nahi, har download fresh hai.\n\n## Categories (${cats.length})\n\n${cats.map((c: AnyDb) => `- ${c.icon} **${c.name}** — ${c.gameCount} games — ${c.description}`).join("\n")}\n\n## Chalana / Deploy karna\n\n1. Standalone: sirf HTML file browser mein kholo.\n2. Full app apni hosting par: DEPLOYMENT-GUIDE.md follow karo (Supabase schema -> env -> Vercel deploy -> domain -> AdSense/GAM).\n\nExported: ${now}\n`;
      } else if (args.fileKey === "deployment") {
        content = `# ${siteTitle} — Deployment Guide\n\n## 1. Database (Supabase)\n1. supabase.com par naya project banao.\n2. SQL Editor mein **playverse-database-schema.sql** chalao (Postgres notes file ke top par hain).\n3. playverse-games.json ka data games/categories tables mein import karo, ya app ke Admin -> Games -> Import CSV se **playverse-games.csv** import karo (drafts banenge, review karke publish karo).\n\n## 2. Environment Variables\n.env.example ki tamam values apni hosting (Vercel -> Settings -> Environment Variables) mein set karo. SUPABASE_SERVICE_ROLE_KEY sirf server par — frontend mein kabhi nahi.\n\n## 3. Deploy (Vercel)\n1. Code ko GitHub repo mein rakho, Vercel mein Import karo.\n2. vercel.json pehle se routing/headers set karta hai.\n3. Deploy -> apna domain add karo (Settings -> Domains), DNS mein Vercel ke diye A/CNAME records lagao, HTTPS auto on hoga.\n\n## 4. App Settings (deploy ke baad)\nAdmin -> Settings mein: Base URL = apna asal domain, GA4 measurement ID, Search Console verification. Admin -> Advertising mein AdSense publisher ID / GAM network code + ad unit paths. Generated sitemap.xml / robots.txt / ads.txt Admin -> Settings se download karke domain root par host karo, phir Search Console mein sitemap submit karo.\n\n## 5. Launch Checklist\n- [ ] Owner admin account banaya, mazboot password\n- [ ] Base URL preview/localhost nahi, asal domain hai\n- [ ] Ek game phone aur desktop dono par test khela, Analytics mein play record hua\n- [ ] Legal pages (Privacy/Terms/DMCA/Cookie) apne hisab se review kiye\n- [ ] ads.txt domain root par live hai\n- [ ] Sitemap Search Console mein submitted hai\n`;
      } else if (args.fileKey === "standalone") {
        const dataJson = JSON.stringify({ title: siteTitle, tagline, categories: cats, games: games.map((g) => ({ title: g.title, slug: g.slug, description: g.description.slice(0, 220), category: g.categories[0]?.name ?? "Game", icon: g.categories[0]?.icon ?? "🎮", color: g.categories[0]?.color ?? "#2563eb", plays: g.playCount, isNew: g.isNew, trending: g.trending })) }).replace(/</g, "\\u003c");
        content = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${siteTitle} — Play Free Online Games</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#f4f6ff;color:#0f172a}header{background:linear-gradient(120deg,#2563eb,#7c3aed,#d946ef);color:#fff;padding:28px 16px;text-align:center}h1{margin:0 0 6px;font-size:32px}input{width:min(520px,92%);padding:12px 18px;border-radius:999px;border:0;font-size:16px;margin-top:14px}.cats{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding:14px}.cats button{border:0;border-radius:999px;padding:8px 14px;font-weight:700;cursor:pointer;color:#fff}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:16px;max-width:1100px;margin:0 auto}.card{background:#fff;border-radius:16px;padding:14px;box-shadow:0 2px 12px rgba(15,23,42,.08)}.thumb{height:84px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:38px;color:#fff}.card h3{margin:8px 0 4px;font-size:15px}.card p{margin:0;font-size:12px;color:#5b6478;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}footer{text-align:center;color:#5b6478;padding:20px;font-size:13px}</style></head>
<body><header><h1>🎮 ${siteTitle}</h1><div>${tagline}</div><div>${games.length} free games — no downloads, no signup</div><input id="q" type="search" placeholder="Search games…" aria-label="Search games"></header>
<div class="cats" id="cats"></div><main class="grid" id="grid"></main>
<footer>Standalone export generated ${now} from the live PlayVerse catalog. Full playable games live on PlayVerse.</footer>
<script>const DATA=${dataJson};let cat='All';const grid=document.getElementById('grid'),catsEl=document.getElementById('cats');
function render(){const q=document.getElementById('q').value.toLowerCase();grid.innerHTML=DATA.games.filter(g=>(cat==='All'||g.category===cat)&&g.title.toLowerCase().includes(q)).map(g=>'<article class="card"><div class="thumb" style="background:'+g.color+'">'+g.icon+'</div><h3>'+g.title+(g.isNew?' ✨':'')+(g.trending?' 🔥':'')+'</h3><p>'+g.description+'</p><p>▶ '+g.plays+' plays · '+g.category+'</p></article>').join('')||'<p>No games match.</p>'}
catsEl.innerHTML=['All',...DATA.categories.map(c=>c.name)].map(n=>'<button style="background:#2563eb" onclick="cat=this.textContent;render()">'+n+'</button>').join('');
document.getElementById('q').addEventListener('input',render);render();<\/script></body></html>`;
      }
      return { filename: meta.filename, mimeType: meta.mimeType, content };
    },
  }),

  exportProjectSource: defineAction({
    description: "Owner/admin only: builds a zip of the real PlayVerse project source (client, all builtin game modules, server, schema/migrations, configs) with a deployment README and an honest MANIFEST of included files and gaps.",
    request: z.object({ token: z.string().min(1) }),
    response: z.object({
      filename: z.string(),
      mimeType: z.string(),
      contentBase64: z.string(),
      fileCount: z.number(),
      zipBytes: z.number(),
      included: z.array(z.object({ path: z.string(), sizeBytes: z.number(), origin: z.string() })),
      gaps: z.array(z.object({ path: z.string(), reason: z.string() })),
      generatedAt: z.string(),
    }),
    privileged: [privileged.buildSourceExport],
    async handler(ctx, args) {
      const { db, admin } = await requireAdmin(ctx, args.token, ["owner", "admin"]);
      await ensureSeed(db);
      const settings = await settingsMap(db, schema.websiteSettings);
      const siteTitle = settings["site_title"] || "PlayVerse";
      const tagline = settings["tagline"] || "Play More. Explore More. PlayVerse.";
      const published = await publishedGames(db);
      const cats = await categoriesWithCounts(db);
      const exportedAt = new Date().toISOString();

      const readme = `# ${siteTitle} — Full Project Source

> ${tagline}

Exported ${exportedAt} from Admin → Code Files. This zip contains the REAL
source code of the ${siteTitle} gaming portal: ${published.length} published
playable games in ${cats.length} categories. Every source file was read live
from the project on disk at export time — see MANIFEST.txt for the exact
file list with sizes, plus anything that could not be included and why.

## What's inside

- \`client/\` — React + TypeScript frontend (Vite). Entry: \`client/index.html\`
  + \`client/src/main.tsx\`; portal in \`App.tsx\`; admin dashboard in
  \`Admin.tsx\`; the shared game shell in \`gamekit.tsx\`; ALL builtin game
  modules in \`games.tsx\` … \`games5.tsx\` (the 100 published games).
- \`server/\` — the backend: \`actions.ts\` (every API action), \`schema.ts\`
  (database schema), \`library.ts\` (the game catalog + per-game SEO
  content), \`seed.ts\`, \`pages-content.ts\`, \`privileged.ts\` (the host-side
  file reader that built this very export).
- \`drizzle/\` — the SQL migrations that create the database tables.
- \`package.json\`, \`bun.lock\`, \`bunfig.toml\`, \`tsconfig.base.json\`,
  \`space.json\` — project configuration, exactly as in the live project.
- \`vercel.json\`, \`.env.example\` — deployment templates (generated for
  this export, same content as the Code Files downloads).

## What a standalone host must provide

1. **A Node.js runtime** (Node 20+ or Bun) to build and serve the app.
   Install dependencies with \`bun install\` (or npm) using the included
   \`package.json\`; build the client with Vite.
2. **An action/API host for the server code.** \`server/src/actions.ts\` is
   written against the Muse \`@hatch/space-sdk\` runtime (\`defineAction\` +
   \`ctx.db\`). Outside Muse you must either run it on a compatible host or
   port the actions to your own framework (e.g. Next.js route handlers or
   Express). The business logic, schema and all game code port directly —
   only the thin action-host layer is Muse-specific.
3. **A database.** The schema targets SQLite via drizzle-orm
   (\`server/src/schema.ts\`, migrations in \`drizzle/\`). For Postgres /
   Supabase: change \`INTEGER PRIMARY KEY AUTOINCREMENT\` to \`SERIAL\` /
   \`GENERATED ALWAYS AS IDENTITY\`, integer millisecond timestamps to
   \`BIGINT\` or \`TIMESTAMPTZ\`, and 0/1 flag columns stay \`INTEGER\` (or
   convert to \`BOOLEAN\` and adjust the seed data). A ready-made Postgres
   schema + catalog data export is available in Admin → Code Files inside
   the app (schema SQL + playverse-games.json).
4. **Environment variables.** Copy \`.env.example\` and fill in your own
   values (site URL, Supabase URL + keys, analytics / ads IDs). This export
   contains NO secrets and NO database data — admin accounts, game catalog
   rows and settings live in the database, which is deliberately excluded
   (see MANIFEST.txt). Re-create the owner admin account on first run and
   re-seed the catalog from \`server/src/library.ts\` / \`seed.ts\`, or import
   \`playverse-games.csv\` from the app's Code Files page.
5. **Deploy (Vercel + GitHub).** Push this folder to a GitHub repo, import
   it in Vercel, set the environment variables, add your domain and point
   DNS at Vercel. \`vercel.json\` already carries the SPA rewrites and cache
   headers.

## Security note

No database data, no secrets, no API keys and no password hashes are in
this zip. Anything that exists in the project but was left out on purpose
is listed, with its reason, at the end of MANIFEST.txt.
`;

      const vercelJson = JSON.stringify({
        $schema: "https://openapi.vercel.sh/vercel.json",
        framework: "vite",
        rewrites: [{ source: "/((?!assets/).*)", destination: "/index.html" }],
        headers: [
          { source: "/sitemap.xml", headers: [{ key: "Content-Type", value: "application/xml" }] },
          { source: "/assets/(.*)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
        ],
      }, null, 2);

      const envExample = `# ${siteTitle} — Environment Variables (template, koi asal secret nahi)
# Production stack (apni hosting / Supabase / Vercel) ke liye
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # SERVER ONLY — kabhi frontend mein mat rakho
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ADSENSE_PUBLISHER_ID=ca-pub-XXXXXXXXXXXXXXXX
NEXT_PUBLIC_GAM_NETWORK_CODE=
# Note: Is Muse workspace build mein yehi values Admin -> Settings mein save hoti hain, env file mein nahi.
`;

      const result = await ctx.executePrivileged(privileged.buildSourceExport, {
        root: ctx.spaceDir,
        sourcePaths: SOURCE_EXPORT_PATHS,
        extraFiles: [
          { path: "README.md", content: readme },
          { path: "vercel.json", content: vercelJson },
          { path: ".env.example", content: envExample },
        ],
        excluded: SOURCE_EXPORT_EXCLUDED,
        exportedAt,
      });
      await logActivity(db, admin.username, "source.export",
        `Exported full project source zip: ${result.fileCount} files, ${result.zipBytes} bytes, ${result.gaps.length} manifest notes.`);
      ctx.invalidateQueries();
      return {
        filename: result.filename,
        mimeType: "application/zip",
        contentBase64: result.zipBase64,
        fileCount: result.fileCount,
        zipBytes: result.zipBytes,
        included: result.included,
        gaps: result.gaps,
        generatedAt: exportedAt,
      };
    },
  }),
} satisfies ActionsModule;
