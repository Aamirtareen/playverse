// First-run seed: structural configuration the brief specifies (the 12
// categories with their library targets, the 5 provider records, the 9 ad
// placements, site/SEO settings, legal page drafts) plus the PlayVerse
// Originals — games actually implemented in the client player and therefore
// genuinely playable — and a small set of clearly labeled UNPUBLISHED demo
// records. No licensed third-party games are seeded: none are connected.

import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import * as schema from "./schema";
import { CONTENT_BACKFILL, LIBRARY } from "./library";
import { PAGE_CONTENT_V2 } from "./pages-content";

// The db type is inferred from ctx at call sites; this module only uses the
// standard drizzle surface.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

function svgThumb(emoji: string, c1: string, c2: string, label: string): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/>` +
    `</linearGradient></defs>` +
    `<rect width='640' height='400' fill='url(#g)'/>` +
    `<circle cx='540' cy='60' r='90' fill='rgba(255,255,255,0.18)'/>` +
    `<circle cx='70' cy='350' r='70' fill='rgba(255,255,255,0.15)'/>` +
    `<text x='320' y='215' font-size='150' text-anchor='middle'>${emoji}</text>` +
    `<text x='320' y='330' font-family='Arial, sans-serif' font-size='34' font-weight='bold' fill='white' text-anchor='middle'>${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const CATEGORY_SEED = [
  { name: "Action", slug: "action", target: 12, color: "#ef4444", icon: "⚔️", description: "Fast reflexes, big combos and non-stop action games." },
  { name: "Puzzle", slug: "puzzle", target: 12, color: "#7c3aed", icon: "🧩", description: "Brain teasers, logic challenges and satisfying puzzle games." },
  { name: "Racing", slug: "racing", target: 10, color: "#f97316", icon: "🏎️", description: "Speed, drifts and photo-finish racing games." },
  { name: "Arcade", slug: "arcade", target: 10, color: "#2563eb", icon: "🕹️", description: "Classic arcade fun — quick rounds, high scores, instant restarts." },
  { name: "Adventure", slug: "adventure", target: 8, color: "#22c55e", icon: "🗺️", description: "Explore worlds, dodge traps and chase treasure." },
  { name: "Shooting", slug: "shooting", target: 8, color: "#0ea5e9", icon: "🎯", description: "Aim, dodge and defend in fast shooting games." },
  { name: "Sports", slug: "sports", target: 8, color: "#16a34a", icon: "⚽", description: "Goals, hoops and checkered flags — sports games for everyone." },
  { name: "Strategy", slug: "strategy", target: 7, color: "#9333ea", icon: "♟️", description: "Out-think the board in turn-based and tactical games." },
  { name: "Casual", slug: "casual", target: 7, color: "#ec4899", icon: "🎲", description: "Relaxed, pick-up-and-play games for a quick break." },
  { name: "Kids & Educational", slug: "kids-educational", target: 6, color: "#eab308", icon: "📚", description: "Friendly learning games for younger players." },
  { name: "Multiplayer & 2 Player", slug: "multiplayer", target: 5, color: "#0891b2", icon: "👥", description: "Play together on one screen or challenge a friend." },
  { name: "Simulation", slug: "simulation", target: 7, color: "#64748b", icon: "🏙️", description: "Build, manage and simulate little worlds." },
];

export const PROVIDER_SEED = [
  { name: "PlayVerse Originals", slug: "playverse-originals", website: null, status: "connected" as const, notes: "Original games built into the PlayVerse player. Fully licensed by PlayVerse itself." },
  { name: "GameDistribution", slug: "gamedistribution", website: "https://gamedistribution.com", status: "not_connected" as const, notes: "Connect with your GameDistribution publisher account to import licensed games via their official feed/API. No credentials stored yet." },
  { name: "GameMonetize", slug: "gamemonetize", website: "https://gamemonetize.com", status: "not_connected" as const, notes: "Connect with your GameMonetize publisher ID to import licensed games. No credentials stored yet." },
  { name: "itch.io", slug: "itch-io", website: "https://itch.io", status: "not_connected" as const, notes: "Embed only itch.io games whose creators permit embedding. Add each game manually with its license note." },
  { name: "Direct HTML5 Uploads", slug: "direct-html5", website: null, status: "not_connected" as const, notes: "Games you own or have licensed, hosted by you and embedded from your own allowlisted domain." },
  { name: "Authorized Custom iFrame", slug: "custom-iframe", website: null, status: "not_connected" as const, notes: "One-off authorized embeds. The embed domain must be on the allowlist before a game can be published." },
];

type BuiltinSeed = {
  title: string;
  slug: string;
  builtinKey: string;
  emoji: string;
  c1: string;
  c2: string;
  categories: string[];
  description: string;
  instructions: string;
  controls: Record<string, string>;
  featured?: boolean;
  trending?: boolean;
  isNew?: boolean;
};

const ORIGINAL_LICENSE = JSON.stringify({
  type: "original",
  owner: "PlayVerse",
  status: "Owned by PlayVerse — built into the PlayVerse player.",
});

export const BUILTIN_SEED: BuiltinSeed[] = [
  {
    title: "Neon Snake", slug: "neon-snake", builtinKey: "snake", emoji: "🐍", c1: "#16a34a", c2: "#065f46",
    categories: ["arcade", "casual"],
    description: "The timeless snake game with a neon twist. Eat the glowing orbs to grow longer, chain combos for bonus points, and don't bite your own tail.",
    instructions: "Guide the snake to the food. Each orb makes you longer and faster. The run ends if you hit a wall or yourself — how long can you survive?",
    controls: { Move: "Arrow keys / WASD / swipe", Pause: "P" },
    featured: true, trending: true,
  },
  {
    title: "Memory Match", slug: "memory-match", builtinKey: "memory", emoji: "🃏", c1: "#7c3aed", c2: "#db2777",
    categories: ["puzzle", "kids-educational"],
    description: "Flip the cards and find every matching pair. Fewer flips means a better score — a gentle workout for your memory.",
    instructions: "Tap two cards to flip them. If the pictures match they stay face up. Match all 8 pairs in as few flips as you can.",
    controls: { Flip: "Tap / click a card", Restart: "New game button" },
    featured: true,
  },
  {
    title: "Block Breaker", slug: "block-breaker", builtinKey: "breakout", emoji: "🧱", c1: "#2563eb", c2: "#06b6d4",
    categories: ["arcade", "action"],
    description: "Smash every brick with the ball and your paddle. Clear the wall, keep the ball alive, and chase the high score.",
    instructions: "Move the paddle to bounce the ball into the bricks. You have 3 balls — clear all bricks to win.",
    controls: { "Move paddle": "Mouse / touch / arrow keys", Launch: "Click / tap / space" },
    trending: true,
  },
  {
    title: "Color Sprint", slug: "color-sprint", builtinKey: "reaction", emoji: "⚡", c1: "#f97316", c2: "#ef4444",
    categories: ["casual", "arcade"],
    description: "How fast are your reflexes? Wait for green, then tap as fast as humanly possible. Five rounds, one average reaction time.",
    instructions: "Wait for the panel to turn green, then tap immediately. Tapping too early restarts the round. Complete 5 rounds to get your average.",
    controls: { Tap: "Click / tap when green" },
    isNew: true,
  },
  {
    title: "Number Merge", slug: "number-merge", builtinKey: "merge2048", emoji: "🔢", c1: "#eab308", c2: "#f97316",
    categories: ["puzzle", "strategy"],
    description: "Slide the tiles, merge matching numbers, and build your way to the legendary 2048 tile in this compact puzzle favorite.",
    instructions: "Swipe or use arrow keys to slide all tiles. Two tiles with the same number merge into one. Reach 2048 to win — run out of moves and it's over.",
    controls: { Slide: "Arrow keys / WASD / swipe" },
    featured: true, trending: true,
  },
  {
    title: "Sky Hopper", slug: "sky-hopper", builtinKey: "flappy", emoji: "🐤", c1: "#38bdf8", c2: "#2563eb",
    categories: ["arcade", "casual"],
    description: "Tap to flap through the gaps in the pipes. One touch, endless frustration, infinite 'just one more try'.",
    instructions: "Tap, click or press space to flap upward. Thread the bird through each gap to score. Touch a pipe or the ground and the run ends.",
    controls: { Flap: "Tap / click / space" },
    isNew: true,
  },
  {
    title: "Tic Tac Tactics", slug: "tic-tac-tactics", builtinKey: "tictactoe", emoji: "❌", c1: "#9333ea", c2: "#2563eb",
    categories: ["strategy", "multiplayer"],
    description: "The classic noughts-and-crosses duel. Outsmart the computer across three difficulty levels, or pass and play with a friend on the same screen.",
    instructions: "Get three of your marks in a row — across, down or diagonally — before your opponent does. Choose 2 Player mode to share the screen.",
    controls: { "Place mark": "Tap / click a cell" },
  },
  {
    title: "Pixel Racer", slug: "pixel-racer", builtinKey: "racer", emoji: "🏁", c1: "#dc2626", c2: "#7c2d12",
    categories: ["racing", "arcade"],
    description: "Weave through highway traffic at full speed. Every car you pass adds to your score — one crash ends the run.",
    instructions: "Steer left and right to dodge traffic. Your speed keeps climbing, so plan your lane changes early.",
    controls: { Steer: "Arrow keys / A,D / on-screen buttons" },
    trending: true,
  },
  {
    title: "Star Defender", slug: "star-defender", builtinKey: "shooter", emoji: "🚀", c1: "#1e3a8a", c2: "#7c3aed",
    categories: ["shooting", "action"],
    description: "Pilot the last starfighter. Blast the incoming drones, dodge their formation, and defend the sector wave after wave.",
    instructions: "Move your ship and fire at the drones before they reach the bottom line. Clear a wave to advance; don't let any drone through.",
    controls: { Move: "Arrow keys / mouse / touch", Fire: "Auto-fire / space" },
    featured: true,
  },
  {
    title: "Word Sprint", slug: "word-sprint", builtinKey: "wordguess", emoji: "🔤", c1: "#059669", c2: "#0d9488",
    categories: ["kids-educational", "puzzle"],
    description: "Guess the hidden word letter by letter before the balloon pops. A friendly vocabulary game with categories from animals to space.",
    instructions: "Pick letters to reveal the word. You can miss 6 times before the round ends. Solve it to move to the next word and build your streak.",
    controls: { Guess: "Tap a letter" },
    isNew: true,
  },
  {
    title: "Gem Cascade", slug: "gem-cascade", builtinKey: "match3", emoji: "💎", c1: "#db2777", c2: "#7c3aed",
    categories: ["puzzle", "casual"],
    description: "Swap neighboring gems to line up three or more of a kind. Chain cascades for combo points and race the move limit.",
    instructions: "Tap two adjacent gems to swap them. Matches of 3+ clear and new gems cascade down. Score as much as you can in 25 moves.",
    controls: { Swap: "Tap two adjacent gems" },
  },
  {
    title: "Turbo Traffic", slug: "turbo-traffic", builtinKey: "traffic", emoji: "🚦", c1: "#0ea5e9", c2: "#22c55e",
    categories: ["racing", "simulation"],
    description: "You're the traffic light at the busiest crossing in town. Keep cars flowing from all four directions — and whatever you do, don't let them crash.",
    instructions: "Tap a traffic light to switch it between red and green. Cars stop at red and go on green. Survive as long as you can without a collision.",
    controls: { "Switch light": "Tap / click a light" },
    isNew: true,
  },
  {
    title: "Bubble Pop Frenzy", slug: "bubble-pop-frenzy", builtinKey: "bubblepop", emoji: "🫧", c1: "#06b6d4", c2: "#3b82f6",
    categories: ["casual", "kids-educational"],
    description: "Sixty seconds, endless bubbles. Pop the right colors for combos and watch out — the spiky bubbles end your streak.",
    instructions: "Tap bubbles to pop them before they float away. Golden bubbles are worth bonus points; avoid the dark spiky ones, they cost you time.",
    controls: { Pop: "Tap / click bubbles" },
  },
  {
    title: "Dungeon Dash", slug: "dungeon-dash", builtinKey: "mazedash", emoji: "🏰", c1: "#475569", c2: "#b45309",
    categories: ["adventure", "puzzle"],
    description: "A fresh maze every run. Grab the key, dodge the patrolling guard, and escape through the door before your steps run out.",
    instructions: "Move through the maze to find the key, then reach the exit door. Avoid the guard — if it touches you, you lose a life. Three lives per run.",
    controls: { Move: "Arrow keys / WASD / on-screen pad" },
  },
];

export const DEMO_SEED = [
  { title: "Demo Record — Street Racer Sample", slug: "demo-street-racer-sample", category: "racing" },
  { title: "Demo Record — Puzzle Quest Sample", slug: "demo-puzzle-quest-sample", category: "puzzle" },
  { title: "Demo Record — Galaxy Shooter Sample", slug: "demo-galaxy-shooter-sample", category: "shooting" },
  { title: "Demo Record — Farm Builder Sample", slug: "demo-farm-builder-sample", category: "simulation" },
  { title: "Demo Record — Soccer Stars Sample", slug: "demo-soccer-stars-sample", category: "sports" },
  { title: "Demo Record — Jungle Adventure Sample", slug: "demo-jungle-adventure-sample", category: "adventure" },
];

export const PLACEMENT_SEED = [
  { key: "header-banner", label: "Header banner" },
  { key: "homepage-top", label: "Homepage top banner" },
  { key: "homepage-in-content", label: "Homepage in-content" },
  { key: "category-banner", label: "Category page banner" },
  { key: "game-top", label: "Game page top" },
  { key: "game-sidebar", label: "Game page sidebar" },
  { key: "below-player", label: "Below game player" },
  { key: "related-games", label: "Related games section" },
  { key: "footer-banner", label: "Footer banner" },
];

export const SETTINGS_SEED: Record<string, string> = {
  site_title: "PlayVerse",
  tagline: "Play More. Explore More. PlayVerse.",
  logo_text: "PlayVerse",
  logo_emoji: "🎮",
  primary_color: "#2563eb",
  contact_email: "",
  base_url: "",
  ga_measurement_id: "",
  adsense_publisher_id: "",
  gam_network_code: "",
  ads_txt: "",
  social_facebook: "",
  social_x: "",
  social_youtube: "",
  social_instagram: "",
};

export const SEO_SEED: Record<string, string> = {
  default_title: "PlayVerse — Play Free Online Games",
  default_description:
    "Play free online games instantly on PlayVerse. No downloads, no installation — just fun. Browse action, puzzle, racing, arcade and more.",
  twitter_handle: "",
  og_image_url: "",
  search_console_verification: "",
};

export const PAGE_SEED: Record<string, { title: string; body: string }> = {
  // About, Contact, Privacy Policy, Cookie Policy and DMCA carry the full
  // expanded content from pages-content.ts (600–700 words each).
  ...PAGE_CONTENT_V2,
  terms: {
    title: "Terms of Service",
    body: "This is the starting Terms of Service for PlayVerse. Review and adapt it with your own legal counsel before public launch.\n\nUsing PlayVerse: Games are provided free for personal, non-commercial play in your browser. You agree not to misuse the service, attempt to disrupt it, or scrape it in ways that burden the platform.\n\nContent and licensing: Games remain the property of their respective owners and are published under the licenses recorded in our catalog. If you believe content infringes your rights, see the DMCA page.\n\nAvailability: The service is provided as-is; availability of any individual game may change as licenses change.\n\nYou can edit this page any time from Admin → Pages.",
  },
  disclaimer: {
    title: "Disclaimer",
    body: "Games on PlayVerse are provided for entertainment. Third-party games remain the property of their owners and are offered under the licenses recorded for each title; availability may change without notice.\n\nPlayVerse makes no guarantee that every game will run on every device or browser. If advertising is enabled on this site, advertisements are served by third-party networks and PlayVerse is not responsible for the content of external advertiser websites.\n\nYou can edit this page any time from Admin → Pages.",
  },
};

// Expansion seed: brings an existing catalog (14 published originals) up to
// the 100-game library. Idempotent — gated on the `asteroids` slug, so it
// runs exactly once per database. It (1) aligns category targets with the
// final distribution, (2) backfills full page content (rules, tips, features,
// FAQs and longer descriptions) onto the original 14 games, and (3) inserts
// the 86 new originals from the library as published, each linked to its one
// primary category.
export async function ensureExpansion(db: AnyDb): Promise<void> {
  const sentinel = await db
    .select()
    .from(schema.games)
    .where(eq(schema.games.slug, "asteroids"))
    .limit(1);
  if (sentinel.length > 0) return;

  const now = new Date();

  for (const c of CATEGORY_SEED) {
    await db
      .update(schema.categories)
      .set({ targetCount: c.target })
      .where(eq(schema.categories.slug, c.slug));
  }

  for (const [slug, content] of Object.entries(CONTENT_BACKFILL)) {
    await db
      .update(schema.games)
      .set({
        description: content.description,
        instructions: content.instructions,
        rules: content.rules,
        tips: JSON.stringify(content.tips),
        features: JSON.stringify(content.features),
        faqs: JSON.stringify(content.faqs),
        updatedAt: now,
      })
      .where(eq(schema.games.slug, slug));
  }

  const cats = await db.select().from(schema.categories);
  const provs = await db.select().from(schema.gameProviders);
  const catId = (slug: string) => cats.find((c: AnyDb) => c.slug === slug)?.id as number;
  const originals = provs.find((p: AnyDb) => p.slug === "playverse-originals");

  const gameStmts: BatchItem<"sqlite">[] = [];
  for (const [i, g] of LIBRARY.entries()) {
    // Stagger publication times so "recently added" ordering looks natural:
    // the last library entries are the most recently published.
    const publishedAt = new Date(now.getTime() - (LIBRARY.length - i) * 3_600_000);
    gameStmts.push(
      db.insert(schema.games).values({
        title: g.title,
        slug: g.slug,
        description: g.description,
        instructions: g.instructions,
        rules: g.rules,
        tips: JSON.stringify(g.tips),
        features: JSON.stringify(g.features),
        faqs: JSON.stringify(g.faqs),
        thumbnailUrl: svgThumb(g.emoji, g.c1, g.c2, g.title),
        gameUrl: null,
        embedUrl: null,
        providerId: originals?.id ?? null,
        gameType: "builtin" as const,
        builtinKey: g.builtinKey,
        controls: JSON.stringify(g.controls),
        licenseInfo: ORIGINAL_LICENSE,
        featured: g.featured ? 1 : 0,
        trending: g.trending ? 1 : 0,
        isNew: g.isNew ? 1 : 0,
        status: "published" as const,
        seoTitle: `${g.title} — Play Free Online | PlayVerse`,
        seoDescription: g.description.slice(0, 155),
        createdAt: publishedAt,
        updatedAt: now,
        publishedAt,
      }),
    );
  }
  const [g1, ...grest] = gameStmts;
  if (g1) await db.batch([g1, ...grest]);

  const inserted = await db.select().from(schema.games);
  const linkStmts: BatchItem<"sqlite">[] = [];
  for (const g of LIBRARY) {
    const game = inserted.find((x: AnyDb) => x.slug === g.slug);
    if (game) {
      linkStmts.push(
        db
          .insert(schema.gameCategories)
          .values({ gameId: game.id, categoryId: catId(g.category) }),
      );
    }
  }
  const [l1, ...lrest] = linkStmts;
  if (l1) await db.batch([l1, ...lrest]);

  await db.insert(schema.activityLogs).values({
    actor: "system",
    action: "library-expansion",
    detail:
      "PlayVerse library expanded to 100 published games: 86 new originals added across all 12 categories, category targets aligned to the final distribution, and full page content (rules, tips, features, FAQs) backfilled onto the original 14 games.",
    createdAt: now,
  });
}

// One-time distribution alignment: the original 14 games were seeded with a
// primary plus a secondary category link, which makes per-category totals sum
// past 100. The final library distribution counts each game once, under its
// primary (first-listed) category, so this step — gated by its own activity
// log marker, so it runs exactly once and never undoes later admin edits —
// reduces each original game to its primary category link only.
export async function ensureCategoryNormalization(db: AnyDb): Promise<void> {
  const done = await db
    .select()
    .from(schema.activityLogs)
    .where(eq(schema.activityLogs.action, "category-distribution-v1"))
    .limit(1);
  if (done.length > 0) return;

  const cats = await db.select().from(schema.categories);
  const allGames = await db.select().from(schema.games);
  const catId = (slug: string) => cats.find((c: AnyDb) => c.slug === slug)?.id as number;

  for (const g of BUILTIN_SEED) {
    const primary = g.categories[0];
    if (!primary) continue;
    const game = allGames.find((x: AnyDb) => x.slug === g.slug);
    if (!game) continue;
    await db
      .delete(schema.gameCategories)
      .where(eq(schema.gameCategories.gameId, game.id));
    await db
      .insert(schema.gameCategories)
      .values({ gameId: game.id, categoryId: catId(primary) });
  }

  await db.insert(schema.activityLogs).values({
    actor: "system",
    action: "category-distribution-v1",
    detail:
      "Original games aligned to their primary category so per-category published totals match the final library distribution exactly (12/12/10/10/8/8/8/7/7/6/5/7 = 100).",
    createdAt: new Date(),
  });
}

// One-time content upgrade for the five public information pages (About,
// Contact, Privacy Policy, Cookie Policy, DMCA). Gated by an activity-log
// marker so it runs exactly once. It only replaces a page whose body still
// contains the original starter-draft marker ("You can edit this page any
// time from Admin"), so any page an admin has already rewritten in the CMS
// is left untouched.
export async function ensurePageContent(db: AnyDb): Promise<void> {
  const done = await db
    .select()
    .from(schema.activityLogs)
    .where(eq(schema.activityLogs.action, "pages-content-v2"))
    .limit(1);
  if (done.length > 0) return;

  const rows = await db.select().from(schema.staticPages);
  const now = new Date();
  let replaced = 0;
  for (const [slug, content] of Object.entries(PAGE_CONTENT_V2)) {
    const row = (rows as AnyDb[]).find((p: AnyDb) => p.slug === slug);
    if (!row) {
      await db.insert(schema.staticPages).values({ slug, title: content.title, body: content.body, updatedAt: now });
      replaced++;
    } else if (typeof row.body === "string" && row.body.includes("You can edit this page any time from Admin")) {
      await db
        .update(schema.staticPages)
        .set({ title: content.title, body: content.body, updatedAt: now })
        .where(eq(schema.staticPages.slug, slug));
      replaced++;
    }
  }

  await db.insert(schema.activityLogs).values({
    actor: "system",
    action: "pages-content-v2",
    detail:
      `Expanded content (600–700 words each) installed for the About, Contact, Privacy Policy, Cookie Policy and DMCA pages; ${replaced} starter draft(s) replaced, admin-edited pages left untouched.`,
    createdAt: now,
  });
}

export async function ensureSeed(db: AnyDb): Promise<void> {
  const existing = await db.select().from(schema.categories).limit(1);
  if (existing.length > 0) {
    await ensureExpansion(db);
    await ensureCategoryNormalization(db);
    await ensurePageContent(db);
    return;
  }

  const now = new Date();
  const stmts: BatchItem<"sqlite">[] = [];

  for (const [i, c] of CATEGORY_SEED.entries()) {
    stmts.push(
      db.insert(schema.categories).values({
        name: c.name,
        slug: c.slug,
        description: c.description,
        color: c.color,
        icon: c.icon,
        targetCount: c.target,
        sortOrder: i,
        createdAt: now,
      }),
    );
  }
  for (const p of PROVIDER_SEED) {
    stmts.push(
      db.insert(schema.gameProviders).values({
        name: p.name,
        slug: p.slug,
        website: p.website,
        status: p.status,
        notes: p.notes,
        createdAt: now,
      }),
    );
  }
  for (const p of PLACEMENT_SEED) {
    stmts.push(
      db.insert(schema.adPlacements).values({
        placementKey: p.key,
        label: p.label,
        updatedAt: now,
      }),
    );
  }
  for (const [key, value] of Object.entries(SETTINGS_SEED)) {
    stmts.push(db.insert(schema.websiteSettings).values({ key, value }));
  }
  for (const [key, value] of Object.entries(SEO_SEED)) {
    stmts.push(db.insert(schema.seoSettings).values({ key, value }));
  }
  for (const [slug, page] of Object.entries(PAGE_SEED)) {
    stmts.push(
      db.insert(schema.staticPages).values({
        slug,
        title: page.title,
        body: page.body,
        updatedAt: now,
      }),
    );
  }
  stmts.push(
    db.insert(schema.activityLogs).values({
      actor: "system",
      action: "seed",
      detail:
        "Initial PlayVerse structure created: 12 categories with library targets, 5 provider records, 9 ad placements, site settings and legal pages.",
      createdAt: now,
    }),
  );
  const [first, ...rest] = stmts;
  if (first) await db.batch([first, ...rest]);

  // Games need real category/provider ids, so insert them after the batch.
  const cats = await db.select().from(schema.categories);
  const provs = await db.select().from(schema.gameProviders);
  const catId = (slug: string) => cats.find((c: AnyDb) => c.slug === slug)?.id as number;
  const originals = provs.find((p: AnyDb) => p.slug === "playverse-originals");
  const customIframe = provs.find((p: AnyDb) => p.slug === "custom-iframe");

  const gameStmts: BatchItem<"sqlite">[] = [];
  for (const g of BUILTIN_SEED) {
    gameStmts.push(
      db.insert(schema.games).values({
        title: g.title,
        slug: g.slug,
        description: g.description,
        instructions: g.instructions,
        thumbnailUrl: svgThumb(g.emoji, g.c1, g.c2, g.title),
        gameUrl: null,
        embedUrl: null,
        providerId: originals?.id ?? null,
        gameType: "builtin" as const,
        builtinKey: g.builtinKey,
        controls: JSON.stringify(g.controls),
        licenseInfo: ORIGINAL_LICENSE,
        featured: g.featured ? 1 : 0,
        trending: g.trending ? 1 : 0,
        isNew: g.isNew ? 1 : 0,
        status: "published" as const,
        seoTitle: `${g.title} — Play Free Online | PlayVerse`,
        seoDescription: g.description.slice(0, 155),
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
      }),
    );
  }
  for (const d of DEMO_SEED) {
    gameStmts.push(
      db.insert(schema.games).values({
        title: d.title,
        slug: d.slug,
        description:
          "DEMO RECORD (unpublished): placeholder catalog entry used to develop and test the PlayVerse admin pipeline. It has no licensed game source connected, no embed URL, and is never shown on the public site. Replace it with a licensed game via CSV import or a provider connection.",
        instructions: "Demo record — not playable. Connect a licensed provider or import real games to publish playable content.",
        thumbnailUrl: svgThumb("🧪", "#94a3b8", "#64748b", "DEMO"),
        providerId: customIframe?.id ?? null,
        gameType: "iframe" as const,
        controls: "{}",
        licenseInfo: JSON.stringify({ status: "demo — no license connected" }),
        status: "draft" as const,
        seoTitle: d.title,
        seoDescription: "Unpublished demo record.",
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
      }),
    );
  }
  const [g1, ...grest] = gameStmts;
  if (g1) await db.batch([g1, ...grest]);

  const inserted = await db.select().from(schema.games);
  const linkStmts: BatchItem<"sqlite">[] = [];
  const link = (slug: string, catSlug: string) => {
    const game = inserted.find((g: AnyDb) => g.slug === slug);
    if (game) {
      linkStmts.push(
        db
          .insert(schema.gameCategories)
          .values({ gameId: game.id, categoryId: catId(catSlug) }),
      );
    }
  };
  for (const g of BUILTIN_SEED) for (const c of g.categories) link(g.slug, c);
  for (const d of DEMO_SEED) link(d.slug, d.category);
  const [l1, ...lrest] = linkStmts;
  if (l1) await db.batch([l1, ...lrest]);

  await ensureExpansion(db);
  await ensureCategoryNormalization(db);
  await ensurePageContent(db);
}

export async function isEmbedAllowed(
  db: AnyDb,
  embedUrl: string | null,
  providerId: number | null,
): Promise<boolean> {
  if (!embedUrl) return false;
  let host: string;
  try {
    host = new URL(embedUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  const rows = await db.select().from(schema.providerIntegrations);
  const allowed = new Set<string>();
  for (const r of rows as AnyDb[]) {
    if (providerId != null && r.providerId !== providerId) continue;
    try {
      const domains = JSON.parse(r.allowlistDomains) as string[];
      for (const d of domains) allowed.add(d.toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "");
    } catch {
      /* ignore malformed allowlist */
    }
  }
  if (allowed.has(host)) return true;
  return [...allowed].some((d) => d.startsWith("*.") && host.endsWith(d.slice(1)));
}

export { eq };
