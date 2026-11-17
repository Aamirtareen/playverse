// PlayVerse schema — mirrors the production data model from the build brief
// (games, categories, game_categories, game_providers, provider_integrations,
// provider_import_logs, admin_profiles, favorites, game_plays,
// website_settings, ad_placements, static_pages, seo_settings, activity_logs,
// redirect_rules) plus admin_sessions, page_views and search_logs so the
// admin analytics show only real recorded events.

import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const ts = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("#2563eb"),
  icon: text("icon").notNull().default("🎮"),
  targetCount: integer("target_count").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: ts("created_at"),
});

export const games = sqliteTable("games", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  instructions: text("instructions").notNull().default(""),
  rules: text("rules").notNull().default(""),
  // JSON array of tip strings.
  tips: text("tips").notNull().default("[]"),
  // JSON array of feature strings.
  features: text("features").notNull().default("[]"),
  // JSON array of { q, a } objects.
  faqs: text("faqs").notNull().default("[]"),
  thumbnailUrl: text("thumbnail_url"),
  thumbnailBlobKey: text("thumbnail_blob_key"),
  gameUrl: text("game_url"),
  embedUrl: text("embed_url"),
  providerId: integer("provider_id"),
  gameType: text("game_type", {
    enum: ["builtin", "iframe", "external"],
  })
    .notNull()
    .default("iframe"),
  builtinKey: text("builtin_key"),
  controls: text("controls").notNull().default("{}"),
  licenseInfo: text("license_info").notNull().default("{}"),
  featured: integer("featured").notNull().default(0),
  trending: integer("trending").notNull().default(0),
  isNew: integer("is_new").notNull().default(0),
  status: text("status", {
    enum: ["draft", "pending", "published", "archived"],
  })
    .notNull()
    .default("draft"),
  seoTitle: text("seo_title").notNull().default(""),
  seoDescription: text("seo_description").notNull().default(""),
  canonicalUrl: text("canonical_url"),
  playCount: integer("play_count").notNull().default(0),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),
});

export const gameCategories = sqliteTable(
  "game_categories",
  {
    gameId: integer("game_id").notNull(),
    categoryId: integer("category_id").notNull(),
  },
  (t) => [uniqueIndex("game_categories_pair").on(t.gameId, t.categoryId)],
);

export const gameProviders = sqliteTable("game_providers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  website: text("website"),
  status: text("status", {
    enum: ["not_connected", "configured", "connected", "error"],
  })
    .notNull()
    .default("not_connected"),
  notes: text("notes").notNull().default(""),
  createdAt: ts("created_at"),
});

export const providerIntegrations = sqliteTable("provider_integrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  providerId: integer("provider_id").notNull().unique(),
  environment: text("environment").notNull().default("production"),
  // JSON: non-secret config only. Secrets are never returned to the client;
  // api_key_set records only whether a key has been stored.
  config: text("config").notNull().default("{}"),
  apiKeySet: integer("api_key_set").notNull().default(0),
  allowlistDomains: text("allowlist_domains").notNull().default("[]"),
  updatedAt: ts("updated_at"),
});

export const providerImportLogs = sqliteTable("provider_import_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  providerId: integer("provider_id"),
  source: text("source").notNull().default("manual"),
  imported: integer("imported").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  duplicates: integer("duplicates").notNull().default(0),
  status: text("status").notNull().default("completed"),
  message: text("message").notNull().default(""),
  createdAt: ts("created_at"),
});

export const adminProfiles = sqliteTable("admin_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  role: text("role", { enum: ["owner", "admin", "editor", "viewer"] })
    .notNull()
    .default("admin"),
  createdAt: ts("created_at"),
});

export const adminSessions = sqliteTable("admin_sessions", {
  token: text("token").primaryKey(),
  adminId: integer("admin_id").notNull(),
  createdAt: ts("created_at"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const favorites = sqliteTable(
  "favorites",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    visitorId: text("visitor_id").notNull(),
    gameId: integer("game_id").notNull(),
    createdAt: ts("created_at"),
  },
  (t) => [uniqueIndex("favorites_pair").on(t.visitorId, t.gameId)],
);

export const gamePlays = sqliteTable("game_plays", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id").notNull(),
  visitorId: text("visitor_id").notNull().default(""),
  deviceType: text("device_type").notNull().default("unknown"),
  referrer: text("referrer").notNull().default("direct"),
  createdAt: ts("created_at"),
});

export const pageViews = sqliteTable("page_views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  path: text("path").notNull(),
  createdAt: ts("created_at"),
});

export const searchLogs = sqliteTable("search_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  query: text("query").notNull(),
  resultsCount: integer("results_count").notNull().default(0),
  createdAt: ts("created_at"),
});

export const websiteSettings = sqliteTable("website_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

export const seoSettings = sqliteTable("seo_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

export const adPlacements = sqliteTable("ad_placements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  placementKey: text("placement_key").notNull().unique(),
  label: text("label").notNull(),
  network: text("network", { enum: ["none", "adsense", "gam"] })
    .notNull()
    .default("none"),
  enabled: integer("enabled").notNull().default(0),
  publisherId: text("publisher_id").notNull().default(""),
  networkCode: text("network_code").notNull().default(""),
  adUnitPath: text("ad_unit_path").notNull().default(""),
  sizes: text("sizes").notNull().default("responsive"),
  showDesktop: integer("show_desktop").notNull().default(1),
  showMobile: integer("show_mobile").notNull().default(1),
  updatedAt: ts("updated_at"),
});

export const staticPages = sqliteTable("static_pages", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  updatedAt: ts("updated_at"),
});

export const activityLogs = sqliteTable("activity_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actor: text("actor").notNull().default("system"),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: ts("created_at"),
});

export const contactMessages = sqliteTable("contact_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  createdAt: ts("created_at"),
});

export const redirectRules = sqliteTable("redirect_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromPath: text("from_path").notNull().unique(),
  toPath: text("to_path").notNull(),
  statusCode: integer("status_code").notNull().default(301),
  createdAt: ts("created_at"),
});
