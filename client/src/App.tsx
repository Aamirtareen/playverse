import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";
import { BuiltinGame } from "./games";
import { AdminApp } from "./Admin";

type Site = ApiResponse<typeof api, "getSite">;
type Game = ApiResponse<typeof api, "listGames">["games"][number];
type Ad = Site["ads"][number];

/* ------------------------------------------------------------ utilities */
function getVisitorId(): string {
  try {
    let id = localStorage.getItem("pv-visitor");
    if (!id) {
      id = `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("pv-visitor", id);
    }
    return id;
  } catch {
    return "v-memory-only";
  }
}

function deviceType(): string {
  const w = window.innerWidth;
  return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

function resetAllScroll() {
  // The artifact renders inside the Muse shell, whose actual scroller is
  // the inner [data-hatch-space-root] container — window.scrollTo alone
  // does nothing there, which left tapped cards looking like they never
  // opened (the new page rendered far below the old scroll position).
  try {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  } catch { /* noop */ }
  if (document.documentElement) document.documentElement.scrollTop = 0;
  if (document.body) document.body.scrollTop = 0;
  document
    .querySelectorAll<HTMLElement>("[data-hatch-space-root], [data-generated-space-root]")
    .forEach((el) => {
      el.scrollTop = 0;
      try { el.scrollTo({ top: 0, left: 0, behavior: "auto" }); } catch { /* noop */ }
    });
}

function useHashRoute(): [string, (path: string) => void] {
  const read = () => {
    const h = window.location.hash.replace(/^#/, "");
    return h.startsWith("/") ? h : "/";
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      resetAllScroll();
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const navigate = useCallback((path: string) => {
    // Update route state immediately instead of relying solely on the
    // hashchange event — in the mobile webview that event can be delayed
    // or swallowed, which made card taps appear to do nothing. Setting
    // the hash afterwards keeps the URL, back button, and deep links in
    // sync.
    setRoute(path);
    resetAllScroll();
    const target = `#${path}`;
    if (window.location.hash !== target) {
      window.location.hash = path;
    }
    // Re-assert the scroll reset after the hash assignment, which can
    // itself trigger a scroll to a same-named anchor.
    requestAnimationFrame(() => resetAllScroll());
  }, []);
  return [route, navigate];
}

function usePageView(route: string) {
  const last = useRef("");
  useEffect(() => {
    if (last.current === route) return;
    last.current = route;
    api.recordPageView({ path: route }).catch(() => undefined);
  }, [route]);
}

function parseControls(json: string): [string, string][] {
  try {
    const obj = JSON.parse(json) as Record<string, string>;
    return Object.entries(obj);
  } catch {
    return [];
  }
}

function parseLicense(json: string): string {
  try {
    const obj = JSON.parse(json) as Record<string, string>;
    return obj["status"] ?? obj["note"] ?? obj["type"] ?? "";
  } catch {
    return "";
  }
}

/* -------------------------------------------------------------- AdSlot */
function AdSlot({ ad, device }: { ad: Ad | undefined; device: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const configured =
    ad && ad.enabled && ad.network !== "none" &&
    (ad.network === "adsense" ? ad.publisherId.length > 0 : ad.networkCode.length > 0 && ad.adUnitPath.length > 0);
  const visible = ad && (device === "mobile" ? ad.showMobile : ad.showDesktop);

  useEffect(() => {
    if (!configured || !ad || !ref.current) return;
    if (ad.network === "gam") {
      const w = window as unknown as { googletag?: { cmd: unknown[] } };
      w.googletag = w.googletag ?? { cmd: [] };
      if (!document.querySelector("script[data-pv-gpt]")) {
        const s = document.createElement("script");
        s.async = true;
        s.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
        s.dataset["pvGpt"] = "1";
        document.head.appendChild(s);
      }
      const divId = `pv-gam-${ad.placementKey}`;
      ref.current.id = divId;
      const unitPath = ad.adUnitPath.startsWith("/") ? ad.adUnitPath : `/${ad.networkCode}/${ad.adUnitPath}`;
      (w.googletag.cmd as ((fn: () => void) => void)[]).push(() => {
        // GPT's surface is dynamically loaded; type it loosely at this boundary.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gt = (window as any).googletag;
        try {
          const mapping = gt.sizeMapping()
            .addSize([1024, 0], [[970, 250], [728, 90], [970, 90]])
            .addSize([640, 0], [[728, 90], [468, 60]])
            .addSize([0, 0], [[320, 50], [320, 100], [300, 250]])
            .build();
          const slot = gt.defineSlot(unitPath, [[970, 250], [728, 90], [320, 100], [300, 250]], divId);
          if (slot) {
            slot.defineSizeMapping(mapping);
            slot.addService(gt.pubads());
            gt.pubads().enableLazyLoad({ fetchMarginPercent: 200, renderMarginPercent: 100 });
            gt.pubads().collapseEmptyDivs();
            gt.enableServices();
            gt.display(divId);
          }
        } catch {
          /* GPT not ready — the reserved space simply stays empty */
        }
      });
    } else if (ad.network === "adsense") {
      if (!document.querySelector("script[data-pv-adsense]")) {
        const s = document.createElement("script");
        s.async = true;
        s.crossOrigin = "anonymous";
        s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ad.publisherId)}`;
        s.dataset["pvAdsense"] = "1";
        document.head.appendChild(s);
      }
      const ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.style.display = "block";
      ins.dataset["adClient"] = ad.publisherId;
      ins.dataset["adSlot"] = ad.adUnitPath;
      ins.dataset["adFormat"] = "auto";
      ins.dataset["fullWidthResponsive"] = "true";
      ref.current.replaceChildren(ins);
      try {
        const w = window as unknown as { adsbygoogle?: unknown[] };
        w.adsbygoogle = w.adsbygoogle ?? [];
        w.adsbygoogle.push({});
      } catch { /* ad blocker etc. — reserved space stays */ }
    }
  }, [configured, ad]);

  if (!ad || !visible || !ad.enabled) return null;
  if (!configured) {
    return (
      <div
        aria-label={`Advertisement space: ${ad.label} (not configured)`}
        className="mx-auto flex w-full max-w-3xl items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-soft)] px-4 py-5 text-center"
      >
        <p className="text-xs font-semibold tracking-wide text-[var(--dim)]">
          AD SPACE · {ad.label} — no network configured
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-3xl" aria-label={`Advertisement: ${ad.label}`}>
      <p className="mb-1 text-center text-[10px] font-semibold tracking-widest text-[var(--dim)]">ADVERTISEMENT</p>
      <div ref={ref} className="min-h-[90px] w-full overflow-hidden rounded-xl bg-[var(--bg-soft)]" />
    </div>
  );
}

/* ------------------------------------------------------------ GameCard */
function GameCard({ game, navigate, site }: { game: Game; navigate: (p: string) => void; site: Site }) {
  const primary = game.categories[0];
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  // Uploaded thumbnails live in blob storage; games store blob key in thumbnailUrl as pvblob:KEY
  const blobKey = game.thumbnailUrl?.startsWith("pvblob:") ? game.thumbnailUrl.slice(7) : null;
  useEffect(() => {
    if (!blobKey) return;
    let live = true;
    api.getThumbnailUrl({ blobKey }).then((r) => { if (live) setBlobUrl(r.url); }).catch(() => undefined);
    return () => { live = false; };
  }, [blobKey]);
  const imgSrc = blobKey ? blobUrl : game.thumbnailUrl;
  void site;
  return (
    <a
      href={`#/game/${game.slug}`}
      onClick={() => navigate(`/game/${game.slug}`)}
      className="group relative block w-full overflow-hidden rounded-[var(--radius)] bg-white text-left shadow-[0_2px_14px_rgba(15,23,42,0.08)] ring-1 ring-[var(--border)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(37,99,235,0.18)]"
      aria-label={`Play ${game.title}`}
    >
      <span className="relative block aspect-[8/5] w-full overflow-hidden bg-[var(--surface-alt)]">
        {imgSrc ? (
          <img src={imgSrc} alt={`${game.title} game thumbnail`} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-violet-600 text-5xl">🎮</span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-lg">▶</span>
        </span>
        {game.isNew && <span className="absolute left-2 top-2 rounded-full bg-green-500 px-2 py-0.5 text-[11px] font-extrabold text-white shadow">NEW</span>}
        {game.trending && <span className="absolute right-2 top-2 rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-extrabold text-white shadow">🔥 TRENDING</span>}
      </span>
      <span className="block px-3 py-2.5">
        <span className="block truncate text-[15px] font-bold leading-tight">{game.title}</span>
        <span className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold" style={{ color: primary?.color ?? "var(--dim)" }}>
            {primary ? `${primary.icon} ${primary.name}` : "Game"}
          </span>
          <span className="shrink-0 text-xs text-[var(--dim)]">▶ {game.playCount.toLocaleString()}</span>
        </span>
      </span>
    </a>
  );
}

function GameGrid({ games, navigate, site, emptyText }: { games: Game[]; navigate: (p: string) => void; site: Site; emptyText: string }) {
  if (games.length === 0) {
    return (
      <div className="rounded-3xl bg-[var(--bg-soft)] px-6 py-10 text-center">
        <p className="text-4xl">🕹️</p>
        <p className="mt-2 font-semibold text-[var(--dim)]">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6">
      {games.map((g) => <GameCard key={g.id} game={g} navigate={navigate} site={site} />)}
    </div>
  );
}

function Section({ title, icon, children, morePath, navigate }: {
  title: string; icon: string; children: React.ReactNode;
  morePath?: string; navigate: (p: string) => void;
}) {
  return (
    <section className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl"><span aria-hidden>{icon}</span> {title}</h2>
        {morePath && (
          <button type="button" onClick={() => navigate(morePath)} className="shrink-0 rounded-full bg-[var(--surface-alt)] px-3 py-1.5 text-sm font-bold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white">
            View all →
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------- Header */
function Header({ site, navigate, route }: { site: Site; navigate: (p: string) => void; route: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState("");
  const s = site.settings;
  const links: [string, string][] = [
    ["Home", "/"],
    ["All Games", "/games"],
    ["Categories", "/categories"],
    ["Popular", "/popular"],
    ["New Games", "/new"],
    ["Favorites", "/favorites"],
    ["Code Files", "/code"],
  ];
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) {
      navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      setMenuOpen(false);
    }
  };
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/95 pt-safe backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-5">
        <button type="button" onClick={() => navigate("/")} className="flex shrink-0 items-center gap-2" aria-label="PlayVerse home">
          <span className="pv-float flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-xl shadow" aria-hidden>
            {s["logo_emoji"] || "🎮"}
          </span>
          <span className="text-xl font-extrabold tracking-tight">
            <span className="text-[var(--accent)]">{(s["logo_text"] || "PlayVerse").slice(0, Math.ceil((s["logo_text"] || "PlayVerse").length / 2))}</span>
            <span className="text-violet-600">{(s["logo_text"] || "PlayVerse").slice(Math.ceil((s["logo_text"] || "PlayVerse").length / 2))}</span>
          </span>
        </button>
        <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {links.map(([label, path]) => (
            <button key={path} type="button" onClick={() => navigate(path)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${route === path ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--bg-soft)]"}`}>
              {label}
            </button>
          ))}
        </nav>
        <form onSubmit={submitSearch} className="ml-auto hidden min-w-0 flex-1 max-w-xs items-center sm:flex" role="search">
          <label className="sr-only" htmlFor="pv-search">Search games</label>
          <input
            id="pv-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search games…"
            className="w-full rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-4 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </form>
        <button type="button" className="ml-auto rounded-full bg-[var(--surface-alt)] px-3 py-2 text-lg sm:ml-0 lg:hidden"
          aria-label="Search games" onClick={() => navigate("/search")}>🔍</button>
        <button type="button" className="rounded-full bg-[var(--surface-alt)] px-3 py-2 text-lg lg:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>
      {menuOpen && (
        <nav className="border-t border-[var(--border)] px-3 py-2 lg:hidden" aria-label="Mobile navigation">
          <form onSubmit={submitSearch} className="mb-2 sm:hidden" role="search">
            <label className="sr-only" htmlFor="pv-search-m">Search games</label>
            <input id="pv-search-m" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search games…"
              className="w-full rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-4 py-2 text-sm outline-none" />
          </form>
          <div className="grid grid-cols-2 gap-1.5">
            {links.map(([label, path]) => (
              <button key={path} type="button" onClick={() => { navigate(path); setMenuOpen(false); }}
                className={`rounded-xl px-3 py-2.5 text-left font-bold ${route === path ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-soft)]"}`}>
                {label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

/* -------------------------------------------------------------- Footer */
function Footer({ site, navigate }: { site: Site; navigate: (p: string) => void }) {
  const s = site.settings;
  const socials: [string, string][] = ([
    ["Facebook", s["social_facebook"] ?? ""],
    ["X", s["social_x"] ?? ""],
    ["YouTube", s["social_youtube"] ?? ""],
    ["Instagram", s["social_instagram"] ?? ""],
  ] as [string, string][]).filter(([, url]) => url.length > 0);
  return (
    <footer className="mt-8 border-t border-[var(--border)] bg-[var(--bg-soft)]">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-5">
        <div>
          <p className="text-lg font-extrabold"><span aria-hidden>{s["logo_emoji"] || "🎮"}</span> {s["site_title"] || "PlayVerse"}</p>
          <p className="mt-1 text-sm font-semibold text-[var(--accent)]">{s["tagline"] || "Play More. Explore More. PlayVerse."}</p>
          <p className="mt-2 text-sm text-[var(--dim)]">Free online games that play instantly in your browser. No downloads. No installation. Just fun.</p>
          {socials.length > 0 && (
            <p className="mt-3 flex flex-wrap gap-2">
              {socials.map(([name, url]) => (
                <a key={name} href={url} target="_blank" rel="noreferrer" className="rounded-full bg-white px-3 py-1.5 text-sm font-bold ring-1 ring-[var(--border)]">{name}</a>
              ))}
            </p>
          )}
        </div>
        <nav aria-label="Explore">
          <p className="font-extrabold">Explore</p>
          <ul className="mt-2 space-y-1.5 text-sm font-semibold text-[var(--dim)]">
            {([["All Games", "/games"], ["Popular Games", "/popular"], ["Trending Games", "/trending"], ["New Games", "/new"], ["Featured Games", "/featured"], ["Categories", "/categories"], ["Favorites", "/favorites"], ["💻 Download Code Files", "/code"]] as [string, string][]).map(([label, path]) => (
              <li key={path}><button type="button" className="hover:text-[var(--accent)]" onClick={() => navigate(path)}>{label}</button></li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Information">
          <p className="font-extrabold">Information</p>
          <ul className="mt-2 space-y-1.5 text-sm font-semibold text-[var(--dim)]">
            {([["About Us", "/about"], ["Contact", "/contact"], ["Privacy Policy", "/privacy-policy"], ["Terms of Service", "/terms"], ["Cookie Policy", "/cookie-policy"], ["DMCA", "/dmca"], ["Disclaimer", "/disclaimer"]] as [string, string][]).map(([label, path]) => (
              <li key={path}><button type="button" className="hover:text-[var(--accent)]" onClick={() => navigate(path)}>{label}</button></li>
            ))}
            <li><button type="button" className="hover:text-[var(--accent)]" onClick={() => navigate("/admin")}>Admin Dashboard</button></li>
          </ul>
        </nav>
      </div>
      <p className="border-t border-[var(--border)] px-4 py-3 text-center text-xs text-[var(--dim)]">
        © {new Date().getFullYear()} {s["site_title"] || "PlayVerse"} — Play More. Explore More.
      </p>
    </footer>
  );
}

/* ---------------------------------------------------------- Home page */
function HomePage({ site, navigate, device }: { site: Site; navigate: (p: string) => void; device: string }) {
  const popular = useQuery({ queryKey: ["games", "popular"], queryFn: () => api.listGames({ collection: "popular", sort: "popular", limit: 12 }) });
  const featured = useQuery({ queryKey: ["games", "featured"], queryFn: () => api.listGames({ collection: "featured", limit: 12 }) });
  const trending = useQuery({ queryKey: ["games", "trending"], queryFn: () => api.listGames({ collection: "trending", limit: 12 }) });
  const fresh = useQuery({ queryKey: ["games", "new"], queryFn: () => api.listGames({ collection: "new", sort: "newest", limit: 12 }) });
  const recommended = useQuery({ queryKey: ["games", "recommended"], queryFn: () => api.listGames({ sort: "recommended", limit: 12 }) });
  const recent = useQuery({ queryKey: ["games", "recent"], queryFn: () => api.listGames({ sort: "newest", limit: 12 }) });
  const heroGames = (featured.data?.games ?? []).slice(0, 4);
  const ad = (key: string) => site.ads.find((a) => a.placementKey === key);

  return (
    <main>
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 via-violet-600 to-fuchsia-500 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 py-10 sm:px-5 lg:grid-cols-2 lg:py-14">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">Discover Your Next Favorite Game</h1>
            <p className="mt-3 max-w-md text-lg text-white/85">
              Play free online games instantly. No downloads. No installation. Just fun.
            </p>
            <p className="mt-2 text-sm font-semibold text-white/70">
              {site.totals.published >= 100
                ? "100+ Free Online Games — Play Instantly on PlayVerse!"
                : `${site.totals.published} games live now · growing toward our ${site.totals.targetLibrary}-game launch library · no signup needed`}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => navigate("/games")} className="rounded-full bg-white px-6 py-3 font-extrabold text-blue-700 shadow-lg hover:scale-[1.03]">
                🎮 Explore Games
              </button>
              <button type="button" onClick={() => navigate("/popular")} className="rounded-full bg-orange-500 px-6 py-3 font-extrabold text-white shadow-lg hover:scale-[1.03]">
                🔥 Play Popular Games
              </button>
              <button type="button" onClick={() => navigate("/code")} className="rounded-full bg-white/15 px-6 py-3 font-extrabold text-white ring-2 ring-white/60 shadow-lg hover:scale-[1.03]" aria-label="Download PlayVerse code files">
                💻 Get Code Files
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3" aria-label="Featured games preview">
            {heroGames.map((g, i) => (
              <a key={g.id} href={`#/game/${g.slug}`} onClick={() => navigate(`/game/${g.slug}`)}
                className={`block overflow-hidden rounded-3xl shadow-xl ring-4 ring-white/25 transition hover:scale-[1.03] ${i % 2 === 1 ? "translate-y-3" : ""}`}
                aria-label={`Play ${g.title}`}>
                {g.thumbnailUrl && !g.thumbnailUrl.startsWith("pvblob:")
                  ? <img src={g.thumbnailUrl} alt={`${g.title} game thumbnail`} className="aspect-[8/5] w-full object-cover" />
                  : <span className="flex aspect-[8/5] w-full items-center justify-center bg-white/20 text-4xl">🎮</span>}
              </a>
            ))}
            {heroGames.length === 0 && <p className="col-span-2 rounded-3xl bg-white/15 px-4 py-8 text-center font-semibold">Games are on the way — check back soon!</p>}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-5"><AdSlot ad={ad("homepage-top")} device={device} /></div>

      <Section title="Popular Games" icon="🏆" morePath="/popular" navigate={navigate}>
        <GameGrid games={popular.data?.games ?? []} navigate={navigate} site={site} emptyText="No plays yet — be the first to launch a game!" />
      </Section>

      <Section title="Featured Games" icon="⭐" morePath="/featured" navigate={navigate}>
        <GameGrid games={featured.data?.games ?? []} navigate={navigate} site={site} emptyText="No featured games yet." />
      </Section>

      <div className="mx-auto max-w-7xl px-3 sm:px-5"><AdSlot ad={ad("homepage-in-content")} device={device} /></div>

      <Section title="Game Categories" icon="🧭" morePath="/categories" navigate={navigate}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {site.categories.map((c) => (
            <a key={c.id} href={`#/category/${c.slug}`} onClick={() => navigate(`/category/${c.slug}`)}
              className="flex items-center gap-3 rounded-3xl bg-white p-4 text-left shadow-[0_2px_14px_rgba(15,23,42,0.07)] ring-1 ring-[var(--border)] transition hover:-translate-y-0.5"
              aria-label={`Browse ${c.name} games`}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: `${c.color}22` }} aria-hidden>{c.icon}</span>
              <span className="min-w-0">
                <span className="block truncate font-extrabold">{c.name}</span>
                <span className="block text-xs font-semibold text-[var(--dim)]">{c.gameCount} game{c.gameCount === 1 ? "" : "s"}</span>
              </span>
            </a>
          ))}
        </div>
      </Section>

      <Section title="Trending Games" icon="🔥" morePath="/trending" navigate={navigate}>
        <GameGrid games={trending.data?.games ?? []} navigate={navigate} site={site} emptyText="Nothing trending yet." />
      </Section>

      <Section title="New Games" icon="✨" morePath="/new" navigate={navigate}>
        <GameGrid games={fresh.data?.games ?? []} navigate={navigate} site={site} emptyText="No new games yet." />
      </Section>

      <Section title="Recommended For You" icon="💡" morePath="/games" navigate={navigate}>
        <GameGrid games={recommended.data?.games ?? []} navigate={navigate} site={site} emptyText="No recommendations yet." />
      </Section>

      <Section title="Recently Added" icon="🕒" morePath="/games" navigate={navigate}>
        <GameGrid games={recent.data?.games ?? []} navigate={navigate} site={site} emptyText="Nothing added yet." />
      </Section>
    </main>
  );
}

/* ------------------------------------------------------- Listing pages */
function ListingPage({ site, navigate, device, collection, title, icon, blurb }: {
  site: Site; navigate: (p: string) => void; device: string;
  collection?: string; title: string; icon: string; blurb: string;
}) {
  const [sort, setSort] = useState<"recommended" | "popular" | "newest" | "az">("recommended");
  void device;
  const [category, setCategory] = useState("");
  const games = useQuery({
    queryKey: ["games", "listing", collection ?? "all", sort, category],
    queryFn: () => api.listGames({
      collection,
      sort,
      categorySlug: category || undefined,
      limit: 120,
    }),
  });
  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-5">
      <h1 className="text-3xl font-extrabold tracking-tight"><span aria-hidden>{icon}</span> {title}</h1>
      <p className="mt-1 max-w-2xl text-[var(--dim)]">{blurb}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="text-sm font-bold" htmlFor="pv-sort">Sort</label>
        <select id="pv-sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold">
          <option value="recommended">Recommended</option>
          <option value="popular">Most played</option>
          <option value="newest">Newest first</option>
          <option value="az">A – Z</option>
        </select>
        <label className="text-sm font-bold" htmlFor="pv-cat-filter">Category</label>
        <select id="pv-cat-filter" value={category} onChange={(e) => setCategory(e.target.value)}
          className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold">
          <option value="">All categories</option>
          {site.categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
        <span className="text-sm font-semibold text-[var(--dim)]">{games.data?.games.length ?? 0} games</span>
      </div>
      <div className="mt-4">
        {games.isPending
          ? <p className="py-10 text-center font-semibold text-[var(--dim)]">Loading games…</p>
          : <GameGrid games={games.data?.games ?? []} navigate={navigate} site={site} emptyText="No games match this view yet." />}
      </div>
    </main>
  );
}

function CategoriesPage({ site, navigate }: { site: Site; navigate: (p: string) => void }) {
  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-5">
      <h1 className="text-3xl font-extrabold tracking-tight">🧭 Game Categories</h1>
      <p className="mt-1 max-w-2xl text-[var(--dim)]">Pick a category and jump straight in. Every game plays instantly in your browser.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {site.categories.map((c) => (
          <a key={c.id} href={`#/category/${c.slug}`} onClick={() => navigate(`/category/${c.slug}`)}
            className="block rounded-3xl bg-white p-5 text-left shadow-[0_2px_14px_rgba(15,23,42,0.07)] ring-1 ring-[var(--border)] transition hover:-translate-y-0.5"
            aria-label={`Browse ${c.name} games`}>
            <span className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl" style={{ backgroundColor: `${c.color}22` }} aria-hidden>{c.icon}</span>
              <span>
                <span className="block text-lg font-extrabold">{c.name}</span>
                <span className="block text-sm font-semibold" style={{ color: c.color }}>{c.gameCount} game{c.gameCount === 1 ? "" : "s"} to play</span>
              </span>
            </span>
            <span className="mt-2 block text-sm text-[var(--dim)]">{c.description}</span>
          </a>
        ))}
      </div>
    </main>
  );
}

function CategoryPage({ site, navigate, device, slug }: { site: Site; navigate: (p: string) => void; device: string; slug: string }) {
  const cat = site.categories.find((c) => c.slug === slug);
  const games = useQuery({
    queryKey: ["games", "category", slug],
    queryFn: () => api.listGames({ categorySlug: slug, sort: "popular", limit: 120 }),
    enabled: !!cat,
  });
  if (!cat) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14 text-center">
        <p className="text-5xl">🧭</p>
        <h1 className="mt-3 text-2xl font-extrabold">Category not found</h1>
        <button type="button" onClick={() => navigate("/categories")} className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2.5 font-bold text-white">Browse all categories</button>
      </main>
    );
  }
  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-5">
      <p className="text-sm font-semibold text-[var(--dim)]">
        <button type="button" className="hover:text-[var(--accent)]" onClick={() => navigate("/")}>Home</button> ›{" "}
        <button type="button" className="hover:text-[var(--accent)]" onClick={() => navigate("/categories")}>Categories</button> › {cat.name}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl" style={{ backgroundColor: `${cat.color}22` }} aria-hidden>{cat.icon}</span>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{cat.name} Games</h1>
          <p className="text-[var(--dim)]">{cat.description}</p>
        </div>
      </div>
      <div className="mt-4"><AdSlot ad={site.ads.find((a) => a.placementKey === "category-banner")} device={device} /></div>
      <div className="mt-4">
        <GameGrid games={games.data?.games ?? []} navigate={navigate} site={site}
          emptyText={`No ${cat.name} games are live yet — new titles are added as licensed games are imported.`} />
      </div>
    </main>
  );
}

/* ---------------------------------------------------------- Game page */
function GamePage({ site, navigate, device, slug, visitorId }: {
  site: Site; navigate: (p: string) => void; device: string; slug: string; visitorId: string;
}) {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["game", slug], queryFn: () => api.getGame({ slug }) });
  const game = data.data?.game ?? null;
  const [started, setStarted] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const [iframeError, setIframeError] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const favs = useQuery({ queryKey: ["favorites", visitorId], queryFn: () => api.listFavorites({ visitorId }) });
  useEffect(() => {
    if (game && favs.data) setIsFav(favs.data.games.some((g) => g.id === game.id));
  }, [game, favs.data]);
  useEffect(() => { setStarted(false); setIframeError(false); }, [slug]);

  const playMutation = useMutation({
    mutationFn: (gameId: number) => api.recordPlay({ gameId, visitorId, deviceType: deviceType() }),
  });
  const favMutation = useMutation({
    mutationFn: (gameId: number) => api.toggleFavorite({ visitorId, gameId }),
    onSuccess: (r) => {
      setIsFav(r.favorite);
      queryClient.invalidateQueries({ queryKey: ["favorites", visitorId] });
    },
  });

  const playerRef = useRef<HTMLDivElement>(null);
  const goFullscreen = () => {
    const el = playerRef.current;
    if (el && document.fullscreenEnabled) {
      el.requestFullscreen().catch(() => undefined);
    }
  };

  if (data.isPending) return <main className="px-4 py-16 text-center font-semibold text-[var(--dim)]">Loading game…</main>;
  if (!game) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14 text-center">
        <p className="text-5xl">👾</p>
        <h1 className="mt-3 text-2xl font-extrabold">Game not found</h1>
        <p className="mt-1 text-[var(--dim)]">This game isn't published (yet) or the link is wrong.</p>
        <button type="button" onClick={() => navigate("/games")} className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2.5 font-bold text-white">Browse all games</button>
      </main>
    );
  }

  const primaryCat = game.categories[0];
  const controls = parseControls(game.controls);
  const license = parseLicense(game.licenseInfo);
  const ad = (key: string) => site.ads.find((a) => a.placementKey === key);
  const startPlay = () => {
    setStarted(true);
    playMutation.mutate(game.id);
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-5">
      <p className="text-sm font-semibold text-[var(--dim)]">
        <button type="button" className="hover:text-[var(--accent)]" onClick={() => navigate("/")}>Home</button>
        {primaryCat && <> › <button type="button" className="hover:text-[var(--accent)]" onClick={() => navigate(`/category/${primaryCat.slug}`)}>{primaryCat.name}</button></>}
        {" "}› {game.title}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">{game.title}</h1>
        {game.isNew && <span className="rounded-full bg-green-500 px-2.5 py-1 text-xs font-extrabold text-white">NEW</span>}
        {game.trending && <span className="rounded-full bg-orange-500 px-2.5 py-1 text-xs font-extrabold text-white">🔥 TRENDING</span>}
        <span className="text-sm font-semibold text-[var(--dim)]">▶ {game.playCount.toLocaleString()} plays</span>
        <button type="button" onClick={() => favMutation.mutate(game.id)} aria-pressed={isFav}
          className={`ml-auto rounded-full px-4 py-2 text-sm font-bold shadow ${isFav ? "bg-pink-500 text-white" : "bg-white ring-1 ring-[var(--border)]"}`}>
          {isFav ? "❤️ Favorited" : "🤍 Add to favorites"}
        </button>
      </div>

      <div className="mt-3"><AdSlot ad={ad("game-top")} device={device} /></div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_300px]">
        <div>
          {/* Player */}
          <div ref={playerRef} className="overflow-hidden rounded-3xl bg-slate-900 shadow-lg ring-1 ring-[var(--border)]">
            {!started ? (
              <button type="button" onClick={startPlay} className="relative block w-full" aria-label={`Play ${game.title}`}>
                {game.thumbnailUrl && !game.thumbnailUrl.startsWith("pvblob:")
                  ? <img src={game.thumbnailUrl} alt={`${game.title} cover art`} className="aspect-video w-full object-cover opacity-90" />
                  : <span className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-blue-600 to-violet-600 text-6xl">🎮</span>}
                <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                  <span className="pv-pop flex h-20 w-20 items-center justify-center rounded-full bg-white text-4xl shadow-2xl">▶</span>
                  <span className="mt-3 rounded-full bg-black/60 px-4 py-1.5 font-bold text-white">Play now — free, no signup</span>
                </span>
              </button>
            ) : game.gameType === "builtin" && game.builtinKey ? (
              <div className="bg-white p-3 sm:p-4">
                <BuiltinGame key={`${game.builtinKey}-${restartKey}`} gameKey={game.builtinKey} />
              </div>
            ) : game.gameType === "iframe" ? (
              game.embedAllowed && game.embedUrl ? (
                iframeError ? (
                  <div className="flex aspect-video w-full flex-col items-center justify-center bg-slate-800 px-6 text-center text-white">
                    <p className="text-4xl">⚠️</p>
                    <p className="mt-2 font-bold">The game couldn't be loaded.</p>
                    <p className="text-sm text-white/70">The provider may be unreachable or blocking embeds right now. Please try again later.</p>
                  </div>
                ) : (
                  <iframe
                    key={restartKey}
                    src={game.embedUrl}
                    title={`${game.title} game player`}
                    className="aspect-video w-full border-0"
                    allow="autoplay; fullscreen; gamepad; keyboard-map; xr-spatial-tracking"
                    sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-orientation-lock"
                    referrerPolicy="no-referrer-when-downgrade"
                    onError={() => setIframeError(true)}
                  />
                )
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center bg-slate-800 px-6 text-center text-white">
                  <p className="text-4xl">🔒</p>
                  <p className="mt-2 font-bold">This embed is blocked by the domain allowlist.</p>
                  <p className="max-w-md text-sm text-white/70">
                    PlayVerse only loads games from provider domains an admin has approved. The provider can enable this game by adding its domain under Admin → Providers.
                  </p>
                </div>
              )
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center bg-slate-800 px-6 text-center text-white">
                <p className="text-4xl">🌐</p>
                <p className="mt-2 font-bold">This game opens on the provider's site.</p>
                {game.gameUrl && (
                  <a href={game.gameUrl} target="_blank" rel="noreferrer" className="mt-3 rounded-full bg-white px-5 py-2.5 font-bold text-slate-900">
                    Open {game.title} ↗
                  </a>
                )}
              </div>
            )}
          </div>
          {/* Player controls */}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={goFullscreen} className="rounded-full bg-[var(--surface-alt)] px-4 py-2 text-sm font-bold">⛶ Fullscreen</button>
            <button type="button" onClick={() => { setRestartKey((k) => k + 1); if (!started) startPlay(); }} className="rounded-full bg-[var(--surface-alt)] px-4 py-2 text-sm font-bold">↻ Restart</button>
            {game.providerName && <span className="rounded-full bg-[var(--bg-soft)] px-4 py-2 text-sm font-semibold text-[var(--dim)]">Provided by {game.providerName}</span>}
          </div>

          <div className="mt-4"><AdSlot ad={ad("below-player")} device={device} /></div>

          {/* About */}
          <section className="mt-5 rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
            <h2 className="text-xl font-extrabold">About {game.title}</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-[var(--text)]/90">{game.description}</p>
            {license && <p className="mt-3 rounded-xl bg-[var(--bg-soft)] px-3 py-2 text-sm font-semibold text-[var(--dim)]">License: {license}</p>}
          </section>
          <section className="mt-4 rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
            <h2 className="text-xl font-extrabold">How to Play</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-[var(--text)]/90">{game.instructions}</p>
            {controls.length > 0 && (
              <>
                <h3 className="mt-4 font-extrabold">Controls</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {controls.map(([action, keys]) => (
                    <p key={action} className="rounded-xl bg-[var(--bg-soft)] px-3 py-2 text-sm">
                      <span className="font-bold">{action}:</span> <span className="text-[var(--dim)]">{keys}</span>
                    </p>
                  ))}
                </div>
              </>
            )}
          </section>
          {game.rules && (
            <section className="mt-4 rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
              <h2 className="text-xl font-extrabold">Game Rules</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-[var(--text)]/90">{game.rules}</p>
            </section>
          )}
          {game.tips.length > 0 && (
            <section className="mt-4 rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
              <h2 className="text-xl font-extrabold">Tips &amp; Strategies</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-[var(--text)]/90">
                {game.tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </section>
          )}
          {game.features.length > 0 && (
            <section className="mt-4 rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
              <h2 className="text-xl font-extrabold">Features</h2>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {game.features.map((f, i) => (
                  <li key={i} className="rounded-xl bg-[var(--bg-soft)] px-3 py-2 text-sm font-semibold">⭐ {f}</li>
                ))}
              </ul>
            </section>
          )}
          {game.faqs.length > 0 && (
            <section className="mt-4 rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
              <h2 className="text-xl font-extrabold">Frequently Asked Questions</h2>
              <div className="mt-2 space-y-3">
                {game.faqs.map((f, i) => (
                  <div key={i}>
                    <h3 className="font-bold">{f.q}</h3>
                    <p className="mt-0.5 leading-relaxed text-[var(--text)]/90">{f.a}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <AdSlot ad={ad("game-sidebar")} device={device} />
          <div className="rounded-3xl bg-white p-4 ring-1 ring-[var(--border)]">
            <h2 className="font-extrabold">Categories</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {game.categories.map((c) => (
                <button key={c.id} type="button" onClick={() => navigate(`/category/${c.slug}`)}
                  className="rounded-full px-3 py-1.5 text-sm font-bold text-white" style={{ backgroundColor: c.color }}>
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
            <h2 className="mt-4 font-extrabold">More like this</h2>
            <div className="mt-2 space-y-2">
              {(data.data?.related ?? []).slice(0, 5).map((g) => (
                <a key={g.id} href={`#/game/${g.slug}`} onClick={() => navigate(`/game/${g.slug}`)}
                  className="flex w-full items-center gap-2 rounded-2xl bg-[var(--bg-soft)] p-2 text-left hover:ring-2 hover:ring-[var(--accent)]">
                  {g.thumbnailUrl && !g.thumbnailUrl.startsWith("pvblob:")
                    ? <img src={g.thumbnailUrl} alt="" className="h-11 w-16 shrink-0 rounded-lg object-cover" />
                    : <span className="flex h-11 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-xl">🎮</span>}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{g.title}</span>
                    <span className="block text-xs text-[var(--dim)]">▶ {g.playCount.toLocaleString()} plays</span>
                  </span>
                </a>
              ))}
              {(data.data?.related ?? []).length === 0 && <p className="text-sm text-[var(--dim)]">No related games yet.</p>}
            </div>
          </div>
        </aside>
      </div>

      <Section title={primaryCat ? `More ${primaryCat.name} Games` : "Related Games"} icon="🧩" navigate={navigate}>
        <GameGrid games={data.data?.related ?? []} navigate={navigate} site={site} emptyText="No related games yet." />
      </Section>
      <div className="mx-auto max-w-7xl px-3 sm:px-5"><AdSlot ad={ad("related-games")} device={device} /></div>
    </main>
  );
}

/* --------------------------------------------------------- Search page */
function SearchPage({ site, navigate, initialQuery }: { site: Site; navigate: (p: string) => void; initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);
  useEffect(() => { setQ(initialQuery); setSubmitted(initialQuery); }, [initialQuery]);
  const results = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => api.logSearch({ query: submitted }),
    enabled: submitted.trim().length > 0,
  });
  const suggestions = useMemo(() => site.categories.slice(0, 6), [site.categories]);
  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-5">
      <h1 className="text-3xl font-extrabold tracking-tight">🔍 Search Games</h1>
      <form
        className="mt-4 flex max-w-xl gap-2"
        role="search"
        onSubmit={(e) => { e.preventDefault(); setSubmitted(q.trim()); }}
      >
        <label className="sr-only" htmlFor="pv-search-page">Search games</label>
        <input id="pv-search-page" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “snake”, “puzzle”, “racing”…"
          className="w-full rounded-full border border-[var(--border)] bg-white px-5 py-3 outline-none focus:border-[var(--accent)]" />
        <button type="submit" className="shrink-0 rounded-full bg-[var(--accent)] px-5 py-3 font-bold text-white">Search</button>
      </form>
      {submitted.trim() === "" ? (
        <div className="mt-6">
          <p className="font-bold">Browse a category instead:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((c) => (
              <button key={c.id} type="button" onClick={() => navigate(`/category/${c.slug}`)}
                className="rounded-full px-4 py-2 font-bold text-white" style={{ backgroundColor: c.color }}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>
      ) : results.isPending ? (
        <p className="mt-8 font-semibold text-[var(--dim)]">Searching…</p>
      ) : (
        <div className="mt-6">
          <p className="mb-3 font-semibold text-[var(--dim)]">
            {results.data?.games.length ?? 0} result{(results.data?.games.length ?? 0) === 1 ? "" : "s"} for “{submitted}”
          </p>
          <GameGrid games={results.data?.games ?? []} navigate={navigate} site={site} emptyText="No games matched. Try a different word or browse the categories." />
        </div>
      )}
    </main>
  );
}

/* ------------------------------------------------------- Code files page */
function CodeFilesPage({ navigate }: { navigate: (p: string) => void }) {
  const list = useQuery({ queryKey: ["code-files"], queryFn: () => api.listCodeFiles({}) });
  const [downloading, setDownloading] = useState("");
  const [doneMsg, setDoneMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const download = async (key: string, filename: string) => {
    setDownloading(key);
    setErrorMsg("");
    setDoneMsg("");
    try {
      const r = await api.getCodeFile({ fileKey: key as "standalone" });
      const blob = new Blob([r.content], { type: `${r.mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename || filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setDoneMsg(`✅ ${r.filename} download ho gayi — apne phone/computer ke Downloads folder mein check karo.`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Download nahi ho saki. Dobara try karo.");
    } finally {
      setDownloading("");
    }
  };
  const files = list.data?.files ?? [];
  const hero = files.find((f) => f.key === "standalone");
  const rest = files.filter((f) => f.key !== "standalone");
  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-5">
      <h1 className="text-3xl font-extrabold tracking-tight">💻 PlayVerse Code Files</h1>
      <p className="mt-2 max-w-3xl leading-relaxed text-[var(--dim)]">
        Mujhay code file do — ye raha! Neeche har file ke samne <strong className="text-[var(--text)]">Download</strong> button hai.
        Tap karte hi file seedha aapke device ke <strong className="text-[var(--text)]">Downloads</strong> folder mein save ho jayegi.
        Saari files har dafa live catalog se fresh banti hain — abhi {list.data?.totals.published ?? 100} published games aur {list.data?.totals.categories ?? 12} categories ka asal data included hai.
      </p>

      {hero && (
        <div className="mt-5 rounded-3xl bg-gradient-to-br from-blue-600 via-violet-600 to-fuchsia-500 p-5 text-white shadow-lg sm:p-6">
          <p className="text-4xl" aria-hidden>🌐</p>
          <h2 className="mt-2 text-2xl font-extrabold">Sab se pehle ye lo — Single Code File</h2>
          <p className="mt-1 max-w-2xl text-white/85">
            <strong>PlayVerse-Standalone.html</strong> — poori website ek hi code file mein: search, category filter aur tamam games ki list.
            Download karke file browser mein kholo, foran chalegi — koi server, koi install nahi.
          </p>
          <button type="button" disabled={downloading === "standalone"} onClick={() => download("standalone", hero.filename)}
            className="mt-4 rounded-full bg-white px-6 py-3 font-extrabold text-blue-700 shadow-lg hover:scale-[1.03] disabled:opacity-60"
            aria-label="Download PlayVerse standalone HTML code file">
            {downloading === "standalone" ? "⏳ File ban rahi hai…" : "⬇ Download PlayVerse-Standalone.html"}
          </button>
        </div>
      )}

      {doneMsg && <p className="mt-4 rounded-2xl bg-green-50 px-4 py-3 font-bold text-green-800 ring-1 ring-green-200" role="status">{doneMsg}</p>}
      {errorMsg && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 font-bold text-red-700 ring-1 ring-red-200" role="alert">{errorMsg}</p>}
      {list.isPending && <p className="mt-6 font-semibold text-[var(--dim)]">Files ki list load ho rahi hai…</p>}
      {list.error && <p className="mt-6 font-semibold text-red-600">List load nahi ho saki — page refresh karke dobara try karo.</p>}

      <h2 className="mt-8 text-xl font-extrabold">Tamam Project Files</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((f) => (
          <article key={f.key} className="flex flex-col rounded-3xl bg-white p-5 shadow-[0_2px_14px_rgba(15,23,42,0.07)] ring-1 ring-[var(--border)]">
            <p className="text-3xl" aria-hidden>{f.icon}</p>
            <h3 className="mt-2 font-extrabold leading-snug">{f.title}</h3>
            <p className="mt-1 font-mono text-xs font-bold text-[var(--accent)]">{f.filename} · {f.language}</p>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--dim)]">{f.description}</p>
            <button type="button" disabled={downloading === f.key} onClick={() => download(f.key, f.filename)}
              className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2.5 font-bold text-white shadow hover:brightness-110 disabled:opacity-60"
              aria-label={`Download ${f.filename}`}>
              {downloading === f.key ? "⏳ Ban rahi hai…" : `⬇ Download ${f.filename}`}
            </button>
          </article>
        ))}
      </div>

      <div className="mt-8 rounded-3xl bg-[var(--bg-soft)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        <h2 className="text-lg font-extrabold">Ye files istemal kaise karun?</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 leading-relaxed text-[var(--text)]/90">
          <li><strong>Sirf dekhna/chalana hai:</strong> Standalone HTML download karo aur browser mein khol lo.</li>
          <li><strong>Apni website banana hai:</strong> README + Deployment Guide parho — schema.sql se database, games.json/csv se data, package.json + vercel.json se apni hosting (Vercel/Supabase) par deploy.</li>
          <li><strong>Data backup chahiye:</strong> games.json aur games.csv download karke rakh lo — yehi Admin mein CSV import se wapas bhi aa sakta hai.</li>
          <li><strong>Poora React source:</strong> PROJECT-STRUCTURE.txt mein har asal source file (App.tsx, Admin.tsx, games files, server actions) ki list aur uska kaam likha hai — wo files is Muse workspace ke andar hain, aur yahan ki har download unhi se live generate hoti hai.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => navigate("/games")} className="rounded-full bg-white px-4 py-2 text-sm font-bold ring-1 ring-[var(--border)]">🎮 Games khelo</button>
          <button type="button" onClick={() => navigate("/admin")} className="rounded-full bg-white px-4 py-2 text-sm font-bold ring-1 ring-[var(--border)]">🛡️ Admin Dashboard</button>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------ Favorites page */
function FavoritesPage({ site, navigate, visitorId }: { site: Site; navigate: (p: string) => void; visitorId: string }) {
  const favs = useQuery({ queryKey: ["favorites", visitorId], queryFn: () => api.listFavorites({ visitorId }) });
  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-5">
      <h1 className="text-3xl font-extrabold tracking-tight">❤️ My Favorites</h1>
      <p className="mt-1 text-[var(--dim)]">Your favorite games, saved on this device — no account needed.</p>
      <div className="mt-5">
        {favs.isPending
          ? <p className="font-semibold text-[var(--dim)]">Loading…</p>
          : <GameGrid games={favs.data?.games ?? []} navigate={navigate} site={site} emptyText="No favorites yet. Tap “Add to favorites” on any game page." />}
      </div>
    </main>
  );
}

/* -------------------------------------------------------- Static pages */
// Light markup used by the CMS page bodies: "## " section headings,
// "### " sub-headings, consecutive "- " lines form a bullet list, and
// [label](#/path) renders as an internal link. Blank lines split blocks.
function renderInline(text: string, navigate: (p: string) => void, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\[[^\]]+\]\(#[^)]+\))/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[([^\]]+)\]\((#[^)]+)\)$/);
    if (!m) return <span key={`${keyPrefix}-${i}`}>{part}</span>;
    const label = m[1]!;
    const href = m[2]!;
    return (
      <a key={`${keyPrefix}-${i}`} href={href} onClick={() => navigate(href.slice(1))}
        className="font-bold text-[var(--accent)] underline decoration-2 underline-offset-2 hover:brightness-110">
        {label}
      </a>
    );
  });
}

function PageBody({ body, navigate }: { body: string; navigate: (p: string) => void }) {
  // A heading line always starts a new block, even if the author forgot the
  // blank line before it.
  const normalized = body.replace(/\n(?=#{2,3} )/g, "\n\n");
  const blocks = normalized.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="mt-4 leading-relaxed text-[var(--text)]/90">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length === 1 && lines[0]!.startsWith("## ")) {
          return <h2 key={bi} className="mt-7 text-[22px] font-extrabold tracking-tight text-[var(--text)] first:mt-0">{renderInline(lines[0]!.slice(3), navigate, `h2-${bi}`)}</h2>;
        }
        if (lines.length === 1 && lines[0]!.startsWith("### ")) {
          return <h3 key={bi} className="mt-5 text-lg font-extrabold text-[var(--text)]">{renderInline(lines[0]!.slice(4), navigate, `h3-${bi}`)}</h3>;
        }
        if (lines.length > 0 && lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={bi} className="mt-3 list-disc space-y-1.5 pl-6">
              {lines.map((l, li) => <li key={li}>{renderInline(l.slice(2), navigate, `li-${bi}-${li}`)}</li>)}
            </ul>
          );
        }
        return (
          <p key={bi} className="mt-3 whitespace-pre-line">
            {lines.map((l, li) => (
              <span key={li}>{li > 0 && <br />}{renderInline(l, navigate, `p-${bi}-${li}`)}</span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — hidden from people
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState("");
  const send = useMutation({
    mutationFn: () => api.submitContactMessage({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim(), website }),
    onSuccess: () => { setSent(true); setServerError(""); },
    onError: (e) => setServerError(e instanceof Error ? e.message : "Something went wrong. Please try again."),
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs["name"] = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs["email"] = "Please enter a valid email address.";
    if (subject.trim().length < 3) errs["subject"] = "Please add a subject (at least 3 characters).";
    if (message.trim().length < 10) errs["message"] = "Please write a message of at least 10 characters.";
    setErrors(errs);
    if (Object.keys(errs).length === 0) send.mutate();
  };
  const inputCls = "w-full rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[var(--accent)]";
  const errText = (k: string) => errors[k] ? <p className="mt-1 text-sm font-semibold text-red-600" role="alert">{errors[k]}</p> : null;
  if (sent) {
    return (
      <div className="mt-8 rounded-3xl bg-green-50 p-6 text-center ring-1 ring-green-200" role="status">
        <p className="text-4xl" aria-hidden>✅</p>
        <h2 className="mt-2 text-xl font-extrabold">Message sent — thank you!</h2>
        <p className="mx-auto mt-1 max-w-md text-[var(--dim)]">
          Your message is in our support queue. We read messages in the order they arrive and reply to the email address you gave us.
        </p>
        <button type="button" className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2.5 font-bold text-white"
          onClick={() => { setSent(false); setName(""); setEmail(""); setSubject(""); setMessage(""); }}>
          Send another message
        </button>
      </div>
    );
  }
  return (
    <form className="mt-8 rounded-3xl bg-[var(--bg-soft)] p-5 ring-1 ring-[var(--border)] sm:p-6" onSubmit={submit} noValidate aria-label="Contact form">
      <h2 className="text-xl font-extrabold">Send Us a Message</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-bold" htmlFor="cf-name">Your name</label>
          <input id="cf-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required aria-invalid={!!errors["name"]} />
          {errText("name")}
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold" htmlFor="cf-email">Email address</label>
          <input id="cf-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required aria-invalid={!!errors["email"]} />
          {errText("email")}
        </div>
      </div>
      <div className="mt-4">
        <label className="mb-1 block text-sm font-bold" htmlFor="cf-subject">Subject</label>
        <input id="cf-subject" className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} required aria-invalid={!!errors["subject"]}
          placeholder="e.g. Game problem, Feedback, Copyright, Advertising…" />
        {errText("subject")}
      </div>
      <div className="mt-4">
        <label className="mb-1 block text-sm font-bold" htmlFor="cf-message">Message</label>
        <textarea id="cf-message" className={inputCls} rows={6} value={message} onChange={(e) => setMessage(e.target.value)} required aria-invalid={!!errors["message"]}
          placeholder="Tell us what's on your mind — the game name, your device and browser help a lot for bug reports." />
        {errText("message")}
      </div>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="cf-website">Website (leave blank)</label>
        <input id="cf-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      {serverError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{serverError}</p>}
      <button type="submit" disabled={send.isPending} className="mt-5 rounded-full bg-[var(--accent)] px-6 py-3 font-extrabold text-white shadow hover:brightness-110 disabled:opacity-50">
        {send.isPending ? "Sending…" : "✉️ Send message"}
      </button>
    </form>
  );
}

const PAGE_TITLES: Record<string, string> = {
  about: "About Us", contact: "Contact", "privacy-policy": "Privacy Policy", terms: "Terms of Service",
  "cookie-policy": "Cookie Policy", dmca: "DMCA", disclaimer: "Disclaimer",
};

// Unique SEO title + meta description for each information page.
const PAGE_SEO: Record<string, { title: string; description: string }> = {
  about: {
    title: "About PlayVerse — Free Online Games, No Downloads | PlayVerse",
    description: "What PlayVerse is, our mission, the 100 original HTML5 games and 12 categories we offer, and our commitment to free, mobile-friendly browser gaming for everyone.",
  },
  contact: {
    title: "Contact PlayVerse — Support, Feedback & Partnerships | PlayVerse",
    description: "Contact the PlayVerse team for game help and technical support, feedback and suggestions, copyright questions, and advertising or partnership inquiries.",
  },
  "privacy-policy": {
    title: "Privacy Policy — How PlayVerse Handles Information | PlayVerse",
    description: "How PlayVerse records game launches and page views, uses local storage and cookies, works with Google advertising and analytics, and protects your choices and rights.",
  },
  "cookie-policy": {
    title: "Cookie Policy — Cookies & Local Storage on PlayVerse | PlayVerse",
    description: "What cookies are, the essential local storage PlayVerse uses for favorites, analytics and Google advertising cookies when enabled, and how to manage cookies in your browser.",
  },
  dmca: {
    title: "DMCA & Copyright Policy — Takedown Requests | PlayVerse",
    description: "PlayVerse's copyright policy: how owners submit a valid DMCA takedown notice, our review and removal process, counter-notifications, and our repeat-infringement policy.",
  },
};

function StaticPage({ slug, site, navigate }: { slug: string; site: Site; navigate: (p: string) => void }) {
  const page = useQuery({ queryKey: ["page", slug], queryFn: () => api.getStaticPage({ slug }) });
  const contactEmail = site.settings["contact_email"];
  const updated = page.data?.page?.updatedAt
    ? new Date(page.data.page.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight">{page.data?.page?.title ?? PAGE_TITLES[slug] ?? slug}</h1>
      {updated && <p className="mt-1.5 text-sm font-semibold text-[var(--dim)]">Last updated: {updated}</p>}
      {page.isPending ? (
        <p className="mt-4 font-semibold text-[var(--dim)]">Loading…</p>
      ) : page.data?.page ? (
        <>
          <PageBody body={page.data.page.body} navigate={navigate} />
          {slug === "contact" && contactEmail && (
            <p className="mt-6 rounded-2xl bg-[var(--bg-soft)] px-4 py-3 font-bold">
              Prefer email? Reach us at{" "}
              <a className="text-[var(--accent)] underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>
            </p>
          )}
          {slug === "dmca" && contactEmail && (
            <p className="mt-6 rounded-2xl bg-[var(--bg-soft)] px-4 py-3 font-bold">
              Send notices to{" "}
              <a className="text-[var(--accent)] underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>
            </p>
          )}
          {slug === "contact" && <ContactForm />}
        </>
      ) : (
        <p className="mt-4 text-[var(--dim)]">This page hasn't been published yet.</p>
      )}
    </main>
  );
}

/* ------------------------------------------------------------- SEO/JSON-LD */
function JsonLd({ site, route, game }: { site: Site; route: string; game: Game | null }) {
  const base = (site.settings["base_url"] ?? "").replace(/\/$/, "");
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.settings["site_title"] || "PlayVerse",
    url: base || undefined,
    slogan: site.settings["tagline"] || "Play More. Explore More. PlayVerse.",
  };
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.settings["site_title"] || "PlayVerse",
    url: base || undefined,
    potentialAction: {
      "@type": "SearchAction",
      target: `${base}/search?q={query}`,
      "query-input": "required name=query",
    },
  };
  const crumbs = route.startsWith("/game/") && game
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
          ...(game.categories[0]
            ? [{ "@type": "ListItem", position: 2, name: game.categories[0].name, item: `${base}/category/${game.categories[0].slug}` }]
            : []),
          { "@type": "ListItem", position: game.categories[0] ? 3 : 2, name: game.title, item: `${base}/game/${game.slug}` },
        ],
      }
    : null;
  const videoGame = game
    ? {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        name: game.title,
        description: game.description,
        url: `${base}/game/${game.slug}`,
        image: game.thumbnailUrl && !game.thumbnailUrl.startsWith("pvblob:") ? game.thumbnailUrl : undefined,
        genre: game.categories.map((c) => c.name),
        playMode: game.categories.some((c) => c.slug === "multiplayer") ? "MultiPlayer" : "SinglePlayer",
        applicationCategory: "Game",
        operatingSystem: "Web browser",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      }
    : null;
  const faqPage = game && game.faqs.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: game.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;
  const blocks = [org, website, crumbs, videoGame, faqPage].filter(Boolean);
  return (
    <>
      {blocks.map((b, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(b) }} />
      ))}
    </>
  );
}

/* ----------------------------------------------------------------- App */
export function App() {
  const [route, navigate] = useHashRoute();
  // Reset every scroll container before paint on any route change —
  // including browser back/forward and plain anchor (card link) taps —
  // so a newly opened game page always starts at its player, not at the
  // previous page's scroll depth.
  useLayoutEffect(() => {
    resetAllScroll();
  }, [route]);
  const [visitorId] = useState(getVisitorId);
  const [device, setDevice] = useState(deviceType);
  useEffect(() => {
    const onResize = () => setDevice(deviceType());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  usePageView(route.startsWith("/admin") ? "/admin" : route.split("?")[0]!);

  const site = useQuery({ queryKey: ["site"], queryFn: () => api.getSite({}) });

  const path = route.split("?")[0]!;
  const query = useMemo(() => new URLSearchParams(route.split("?")[1] ?? ""), [route]);

  const gameSlug = path.startsWith("/game/") ? path.slice(6) : null;
  const categorySlug = path.startsWith("/category/") ? path.slice(10) : null;
  const gameData = useQuery({
    queryKey: ["game", gameSlug],
    queryFn: () => api.getGame({ slug: gameSlug! }),
    enabled: !!gameSlug,
  });

  // Document title / meta description per route
  useEffect(() => {
    if (!site.data) return;
    const s = site.data;
    let title = s.seo["default_title"] || "PlayVerse — Play Free Online Games";
    let desc = s.seo["default_description"] || "";
    if (gameSlug && gameData.data?.game) {
      title = gameData.data.game.seoTitle || `${gameData.data.game.title} | PlayVerse`;
      desc = gameData.data.game.seoDescription || gameData.data.game.description.slice(0, 155);
    } else if (categorySlug) {
      const cat = s.categories.find((c) => c.slug === categorySlug);
      if (cat) {
        title = `${cat.name} Games — Play Free Online | PlayVerse`;
        desc = cat.description;
      }
    } else if (PAGE_SEO[path.slice(1)]) {
      title = PAGE_SEO[path.slice(1)]!.title;
      desc = PAGE_SEO[path.slice(1)]!.description;
    } else if (PAGE_TITLES[path.slice(1)]) {
      title = `${PAGE_TITLES[path.slice(1)]} | PlayVerse`;
    } else if (path === "/games") title = "All Games — Play Free Online | PlayVerse";
    else if (path === "/popular") title = "Popular Games | PlayVerse";
    else if (path === "/trending") title = "Trending Games | PlayVerse";
    else if (path === "/new") title = "New Games | PlayVerse";
    else if (path === "/featured") title = "Featured Games | PlayVerse";
    else if (path === "/categories") title = "Game Categories | PlayVerse";
    else if (path === "/code") title = "Download Code Files — PlayVerse Source & Project Files | PlayVerse";
    document.title = title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = desc;
    // Canonical URL: only meaningful once the owner has configured the
    // site's public base URL (Admin → Settings); without a domain we do
    // not publish a canonical rather than pointing it at a preview host.
    const base = (s.settings["base_url"] ?? "").replace(/\/$/, "");
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (base) {
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }
      canonical.href = `${base}/#${path}`;
    } else if (canonical) {
      canonical.remove();
    }
  }, [site.data, path, categorySlug, gameSlug, gameData.data]);

  if (path === "/admin" || path.startsWith("/admin/")) {
    return <AdminApp navigate={navigate} />;
  }

  if (site.isPending) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
        <span className="pv-float text-6xl" aria-hidden>🎮</span>
        <p className="mt-3 text-xl font-extrabold">PlayVerse</p>
        <p className="font-semibold text-[var(--dim)]">Loading your games…</p>
      </div>
    );
  }
  if (site.error || !site.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
        <p className="text-5xl">😢</p>
        <p className="mt-3 text-xl font-extrabold">PlayVerse couldn't load</p>
        <p className="mt-1 max-w-sm text-[var(--dim)]">Something went wrong reaching the game catalog. Please try again in a moment.</p>
        <button type="button" onClick={() => site.refetch()} className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2.5 font-bold text-white">Try again</button>
      </div>
    );
  }

  const s = site.data;
  let content: React.ReactNode;
  if (path === "/") content = <HomePage site={s} navigate={navigate} device={device} />;
  else if (path === "/games") content = <ListingPage site={s} navigate={navigate} device={device} title="All Games" icon="🎮" blurb="Every game on PlayVerse, ready to play instantly — no downloads, no signup." />;
  else if (path === "/popular") content = <ListingPage site={s} navigate={navigate} device={device} collection="popular" title="Popular Games" icon="🏆" blurb="The games everyone is playing right now, ranked by real plays." />;
  else if (path === "/trending") content = <ListingPage site={s} navigate={navigate} device={device} collection="trending" title="Trending Games" icon="🔥" blurb="Hot right now — the games climbing the charts this week." />;
  else if (path === "/new") content = <ListingPage site={s} navigate={navigate} device={device} collection="new" title="New Games" icon="✨" blurb="Fresh arrivals to the PlayVerse catalog." />;
  else if (path === "/featured") content = <ListingPage site={s} navigate={navigate} device={device} collection="featured" title="Featured Games" icon="⭐" blurb="Hand-picked favorites from the PlayVerse team." />;
  else if (path === "/categories") content = <CategoriesPage site={s} navigate={navigate} />;
  else if (categorySlug) content = <CategoryPage site={s} navigate={navigate} device={device} slug={categorySlug} />;
  else if (gameSlug) content = <GamePage site={s} navigate={navigate} device={device} slug={gameSlug} visitorId={visitorId} />;
  else if (path === "/code") content = <CodeFilesPage navigate={navigate} />;
  else if (path === "/search") content = <SearchPage site={s} navigate={navigate} initialQuery={query.get("q") ?? ""} />;
  else if (path === "/favorites") content = <FavoritesPage site={s} navigate={navigate} visitorId={visitorId} />;
  else if (PAGE_TITLES[path.slice(1)]) content = <StaticPage slug={path.slice(1)} site={s} navigate={navigate} />;
  else {
    content = (
      <main className="mx-auto max-w-3xl px-4 py-14 text-center">
        <p className="text-5xl">🛸</p>
        <h1 className="mt-3 text-2xl font-extrabold">Page not found</h1>
        <p className="mt-1 text-[var(--dim)]">That page wandered off. Let's get you back to the games.</p>
        <button type="button" onClick={() => navigate("/")} className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2.5 font-bold text-white">Back to home</button>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <JsonLd site={s} route={path} game={gameSlug ? (gameData.data?.game ?? null) : null} />
      <Header site={s} navigate={navigate} route={path} />
      <div className="mx-auto max-w-7xl px-3 pt-3 sm:px-5">
        <AdSlot ad={s.ads.find((a) => a.placementKey === "header-banner")} device={device} />
      </div>
      {content}
      <div className="mx-auto max-w-7xl px-3 sm:px-5">
        <AdSlot ad={s.ads.find((a) => a.placementKey === "footer-banner")} device={device} />
      </div>
      <Footer site={s} navigate={navigate} />
    </div>
  );
}
