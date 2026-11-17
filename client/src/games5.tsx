// PlayVerse expansion — Casual, Kids & Educational, Multiplayer and
// Simulation originals.

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { ActionButton, Banner, Engine, H, ScoreBar, W, beep, clamp, rand, randi, shuffle, useBest } from "./gamekit";

/* ------------------------------------------------------------ Cookie Bakery */
type BakeryUpgrade = { name: string; emoji: string; base: number; cps: number; owned: number };
function CookieGame() {
  const [cookies, setCookies] = useState(0);
  const [total, setTotal] = useState(0);
  const [clickPower, setClickPower] = useState(1);
  const [upgrades, setUpgrades] = useState<BakeryUpgrade[]>([
    { name: "Helper Hands", emoji: "🧤", base: 15, cps: 0.2, owned: 0 },
    { name: "Home Oven", emoji: "🔥", base: 60, cps: 1, owned: 0 },
    { name: "Bakery Truck", emoji: "🚚", base: 240, cps: 5, owned: 0 },
    { name: "Cookie Factory", emoji: "🏭", base: 900, cps: 22, owned: 0 },
  ]);
  const [won, setWon] = useState(false);
  const [best, recordBest] = useBest("cookie-bakery");
  const cps = upgrades.reduce((a, u) => a + u.cps * u.owned, 0);
  useEffect(() => {
    const id = setInterval(() => {
      setCookies((c) => c + cps / 10);
      setTotal((t) => t + cps / 10);
    }, 100);
    return () => clearInterval(id);
  }, [cps]);
  useEffect(() => {
    if (total >= 5000 && !won) {
      setWon(true);
      recordBest(Math.floor(total));
      beep(700, 0.2, "triangle");
    }
  }, [total, won, recordBest]);
  const clickCookie = () => {
    setCookies((c) => c + clickPower);
    setTotal((t) => t + clickPower);
    beep(500 + Math.random() * 200, 0.04);
  };
  const buy = (i: number) => {
    const u = upgrades[i]!;
    const cost = Math.ceil(u.base * Math.pow(1.55, u.owned));
    if (cookies < cost) { beep(150, 0.09, "sawtooth"); return; }
    setCookies((c) => c - cost);
    setUpgrades((us) => us.map((x, xi) => (xi === i ? { ...x, owned: x.owned + 1 } : x)));
    beep(760, 0.07);
  };
  const buyClick = () => {
    const cost = 100 * clickPower;
    if (cookies < cost) { beep(150, 0.09, "sawtooth"); return; }
    setCookies((c) => c - cost);
    setClickPower((p) => p + 1);
    beep(820, 0.07);
  };
  const start = () => {
    setCookies(0); setTotal(0); setClickPower(1); setWon(false);
    setUpgrades([
      { name: "Helper Hands", emoji: "🧤", base: 15, cps: 0.2, owned: 0 },
      { name: "Home Oven", emoji: "🔥", base: 60, cps: 1, owned: 0 },
      { name: "Bakery Truck", emoji: "🚚", base: 240, cps: 5, owned: 0 },
      { name: "Cookie Factory", emoji: "🏭", base: 900, cps: 22, owned: 0 },
    ]);
  };
  return (
    <div>
      <ScoreBar items={[["Cookies", Math.floor(cookies)], ["Per second", cps.toFixed(1)], ["Total baked", Math.floor(total)], ["Goal", "5,000"], ["Best", best]]} />
      {won && <Banner tone="win">🏆 Cookie empire! You baked 5,000 cookies — the bakery is officially a franchise. Keep going for a bigger best!</Banner>}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="text-center">
          <button type="button" onClick={clickCookie} aria-label="Bake a cookie"
            className="pv-pop text-[92px] leading-none transition hover:scale-105 active:scale-95">
            🍪
          </button>
          <p className="font-bold">Tap the cookie! +{clickPower} per tap</p>
          <button type="button" onClick={buyClick} disabled={cookies < 100 * clickPower}
            className="mt-2 rounded-full bg-[var(--surface-alt)] px-4 py-2 text-sm font-bold disabled:opacity-40">
            👆 Stronger taps (+1) — {100 * clickPower} cookies
          </button>
        </div>
        <div className="grid flex-1 gap-2">
          {upgrades.map((u, i) => {
            const cost = Math.ceil(u.base * Math.pow(1.55, u.owned));
            return (
              <button key={u.name} type="button" onClick={() => buy(i)} disabled={cookies < cost}
                className="flex items-center gap-3 rounded-2xl bg-[var(--surface-alt)] px-4 py-2.5 text-left disabled:opacity-45">
                <span className="text-3xl">{u.emoji}</span>
                <span className="flex-1">
                  <span className="block font-extrabold">{u.name} × {u.owned}</span>
                  <span className="block text-sm text-[var(--dim)]">+{u.cps}/sec each</span>
                </span>
                <span className="font-extrabold text-[var(--accent)]">{cost} 🍪</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ Fresh bakery" /></div>
    </div>
  );
}

/* -------------------------------------------------------------- Happy Puppy */
type PupNeed = { kind: string; emoji: string; label: string; left: number; max: number } | null;
const PUP_CARE = [
  { kind: "food", emoji: "🍖", label: "Feed" },
  { kind: "play", emoji: "🎾", label: "Play" },
  { kind: "bath", emoji: "🛁", label: "Bath" },
  { kind: "nap", emoji: "🛏️", label: "Nap" },
];
function PuppyGame() {
  const [need, setNeed] = useState<PupNeed>(null);
  const [happy, setHappy] = useState(0);
  const [misses, setMisses] = useState(0);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [best, recordBest] = useBest("happy-puppy");
  const spawnIn = useRef(1.2);
  useEffect(() => {
    if (!running || over) return;
    const id = setInterval(() => {
      setNeed((n) => {
        if (n) {
          const left = n.left - 0.1;
          if (left <= 0) {
            setMisses((m) => {
              const nm = m + 1;
              if (nm >= 3) { setOver(true); recordBest(happy); }
              return nm;
            });
            beep(130, 0.18, "sawtooth");
            spawnIn.current = 0.8;
            return null;
          }
          return { ...n, left };
        }
        spawnIn.current -= 0.1;
        if (spawnIn.current <= 0) {
          const c = PUP_CARE[randi(0, PUP_CARE.length - 1)]!;
          const max = Math.max(3.2, 6 - happy * 0.06);
          return { kind: c.kind, emoji: c.emoji, label: c.label, left: max, max };
        }
        return n;
      });
    }, 100);
    return () => clearInterval(id);
  }, [running, over, happy, recordBest]);
  const care = (kind: string) => {
    if (!need || over) return;
    if (need.kind === kind) {
      setHappy((h) => h + 1);
      setNeed(null);
      spawnIn.current = rand(0.7, 1.4);
      beep(760, 0.08, "triangle");
    } else {
      beep(160, 0.1, "sawtooth");
      setNeed((n) => (n ? { ...n, left: Math.max(0.4, n.left - 0.8) } : n));
    }
  };
  const start = () => { setNeed(null); setHappy(0); setMisses(0); setOver(false); setRunning(true); spawnIn.current = 0.8; };
  const score = happy * 10;
  return (
    <div>
      <ScoreBar items={[["Happiness", `${happy} ❤️`], ["Score", score], ["Missed", `${misses}/3`], ["Best", best]]} />
      {over && <Banner tone="lose">The puppy needs a break — you kept it happy {happy} times. Final score {score}.</Banner>}
      {!running && !over && (
        <div className="py-6 text-center">
          <p className="text-6xl">🐶</p>
          <p className="mx-auto mt-2 max-w-sm font-semibold">Your puppy will ask for food, play, baths and naps. Tap the matching care button before the bubble empties!</p>
          <div className="mt-3"><ActionButton onClick={start} label="▶ Start caring" primary /></div>
        </div>
      )}
      {(running || over) && (
        <div className="py-2 text-center">
          <div className="relative mx-auto h-36 w-40">
            <span className="absolute inset-x-0 bottom-0 text-[84px] leading-none">{misses >= 2 ? "😟" : happy > 12 ? "🤩" : "🐶"}</span>
            {need && (
              <span className="pv-pop absolute -top-1 right-0 rounded-2xl bg-white px-3 py-1.5 text-2xl shadow ring-1 ring-[var(--border)]">
                {need.emoji}
              </span>
            )}
          </div>
          {need && (
            <div className="mx-auto mt-1 h-3 w-52 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full ${need.left / need.max < 0.3 ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${(need.left / need.max) * 100}%` }} />
            </div>
          )}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {PUP_CARE.map((c) => (
              <button key={c.kind} type="button" onClick={() => care(c.kind)}
                className={`rounded-full px-4 py-2.5 font-extrabold shadow ${need?.kind === c.kind ? "bg-amber-400 text-amber-950" : "bg-[var(--surface-alt)]"}`}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
          {over && <div className="mt-3"><ActionButton onClick={start} label="↻ Play again" primary /></div>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Fishing Relax */
type FishState = {
  score: number; over?: boolean; won?: boolean;
  phase2: "idle" | "waiting" | "bite" | "reeled";
  waitT: number; biteT: number; bar: number; barDir: number; caught: number; time: number;
  fish: string; message: string;
};
const FISH_TABLE = [
  { emoji: "🐟", name: "Bluegill", pts: 10, zone: 0.16 },
  { emoji: "🐠", name: "Reef Fish", pts: 20, zone: 0.13 },
  { emoji: "🦈", name: "Baby Shark", pts: 45, zone: 0.09 },
  { emoji: "🐡", name: "Puffer", pts: 30, zone: 0.11 },
  { emoji: "🦑", name: "Squid", pts: 35, zone: 0.1 },
];
function FishingGame() {
  return (
    <Engine<FishState>
      id="fishing-relax" label="Fishing Relax"
      blurb="Cast, wait for the bobber to dip, then stop the reel bar inside the green zone. Five fish fills your bucket before sunset."
      create={() => ({ score: 0, phase2: "idle", waitT: 0, biteT: 0, bar: 0, barDir: 1, caught: 0, time: 150, fish: "", message: "Tap the water to cast your line." })}
      hud={(s) => [["Score", s.score], ["Caught", `${s.caught}/5`], ["Time", `${Math.max(0, Math.ceil(s.time))}s`]]}
      onTap={(s, _x, _y, api) => {
        if (s.phase2 === "idle") {
          s.phase2 = "waiting";
          s.waitT = rand(1.4, 3.6);
          s.message = "Line's out… watch the bobber.";
          api.beep(420, 0.06);
        } else if (s.phase2 === "bite") {
          s.phase2 = "reeled";
          s.bar = 0; s.barDir = 1;
          const f = FISH_TABLE[randi(0, FISH_TABLE.length - 1)]!;
          s.fish = `${f.emoji} ${f.name}|${f.pts}|${f.zone}`;
          s.message = "A bite! Stop the bar in the green zone to land it!";
          api.beep(700, 0.08);
        } else if (s.phase2 === "reeled") {
          const parts = s.fish.split("|");
          const zone = Number(parts[2]);
          const center = 0.62;
          if (Math.abs(s.bar - center) <= zone) {
            const pts = Number(parts[1]);
            s.score += pts;
            s.caught += 1;
            s.message = `🎣 Caught ${parts[0]} — +${pts} points!`;
            api.beep(760, 0.12, "triangle");
            if (s.caught >= 5) { api.end(true); return; }
          } else {
            s.message = "It slipped the hook! Cast again.";
            api.beep(150, 0.15, "sawtooth");
          }
          s.phase2 = "idle";
        } else if (s.phase2 === "waiting") {
          s.message = "Too eager — wait for the dip!";
          s.waitT += 0.5;
          api.beep(200, 0.06);
        }
      }}
      step={(s, dt, _input, api) => {
        s.time -= dt;
        if (s.time <= 0) { api.end(s.caught >= 5); return; }
        if (s.phase2 === "waiting") {
          s.waitT -= dt;
          if (s.waitT <= 0) {
            s.phase2 = "bite";
            s.biteT = 0.9;
            api.beep(980, 0.09);
          }
        } else if (s.phase2 === "bite") {
          s.biteT -= dt;
          if (s.biteT <= 0) {
            s.phase2 = "idle";
            s.message = "It got away… cast again.";
            api.beep(150, 0.12, "sawtooth");
          }
        } else if (s.phase2 === "reeled") {
          s.bar += s.barDir * dt * 1.25;
          if (s.bar > 1) { s.bar = 1; s.barDir = -1; }
          if (s.bar < 0) { s.bar = 0; s.barDir = 1; }
        }
      }}
      draw={(ctx, s) => {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#fde68a"); grad.addColorStop(0.42, "#7dd3fc"); grad.addColorStop(0.43, "#0284c7"); grad.addColorStop(1, "#075985");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.arc(52, 44, 20, 0, 7); ctx.fill();
        ctx.fillStyle = "#65a30d"; ctx.fillRect(0, 128, 130, 26);
        ctx.font = "34px serif"; ctx.textAlign = "center";
        ctx.fillText("🎣", 96, 142);
        if (s.phase2 !== "idle") {
          ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(112, 116); ctx.quadraticCurveTo(220, 90, 316, 168); ctx.stroke();
          const bobY = s.phase2 === "bite" ? 182 + Math.sin(performance.now() / 60) * 4 : 176;
          ctx.fillStyle = "#ef4444";
          ctx.beginPath(); ctx.arc(318, bobY, 7, 0, 7); ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(318, bobY - 4, 7, 0, Math.PI, true); ctx.fill();
        }
        if (s.phase2 === "bite") {
          ctx.fillStyle = "#dc2626"; ctx.font = "bold 26px system-ui";
          ctx.fillText("BITE! TAP!", 330, 90);
        }
        ctx.font = "24px serif";
        ctx.fillText("🪣", 440, 330);
        ctx.fillStyle = "rgba(15,23,42,0.72)"; ctx.fillRect(40, 322, 320, 26);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12.5px system-ui";
        ctx.fillText(s.message, 200, 339);
        if (s.phase2 === "reeled") {
          ctx.fillStyle = "#111827"; ctx.fillRect(90, 250, 300, 20);
          ctx.fillStyle = "rgba(34,197,94,0.85)";
          const parts = s.fish.split("|");
          const zone = Number(parts[2] ?? 0.13);
          ctx.fillRect(90 + 300 * (0.62 - zone), 250, 300 * zone * 2, 20);
          ctx.fillStyle = "#facc15";
          ctx.fillRect(90 + 300 * s.bar - 3, 246, 6, 28);
        }
        ctx.textAlign = "left";
      }}
    />
  );
}

/* --------------------------------------------------------------- Echo Beats */
const ECHO_PADS = [
  { color: "#22c55e", freq: 392, name: "Green pad" },
  { color: "#ef4444", freq: 440, name: "Red pad" },
  { color: "#eab308", freq: 494, name: "Yellow pad" },
  { color: "#3b82f6", freq: 523, name: "Blue pad" },
];
function EchoGame() {
  const [seq, setSeq] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "show" | "input" | "over">("idle");
  const [lit, setLit] = useState(-1);
  const [lives, setLives] = useState(2);
  const [best, recordBest] = useBest("echo-beats");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  const score = Math.max(0, (seq.length - 1) * 20);
  const playSequence = useCallback((s: number[]) => {
    setPhase("show");
    setProgress(0);
    s.forEach((pad, i) => {
      timers.current.push(setTimeout(() => {
        setLit(pad);
        beep(ECHO_PADS[pad]!.freq, 0.22, "sine", 0.08);
      }, 500 + i * 480));
      timers.current.push(setTimeout(() => setLit(-1), 500 + i * 480 + 300));
    });
    timers.current.push(setTimeout(() => setPhase("input"), 500 + s.length * 480 + 120));
  }, []);
  const start = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const s = [randi(0, 3)];
    setSeq(s); setLives(2); setPhase("show");
    playSequence(s);
  };
  const tapPad = (pad: number) => {
    if (phase !== "input") return;
    setLit(pad);
    beep(ECHO_PADS[pad]!.freq, 0.18, "sine", 0.08);
    setTimeout(() => setLit(-1), 180);
    if (pad === seq[progress]) {
      const np = progress + 1;
      if (np === seq.length) {
        const ns = [...seq, randi(0, 3)];
        setSeq(ns);
        setProgress(0);
        setPhase("show");
        timers.current.push(setTimeout(() => playSequence(ns), 650));
      } else setProgress(np);
    } else {
      const nl = lives - 1;
      setLives(nl);
      beep(130, 0.25, "sawtooth");
      if (nl <= 0) {
        setPhase("over");
        recordBest(score);
      } else {
        setProgress(0);
        setPhase("show");
        timers.current.push(setTimeout(() => playSequence(seq), 800));
      }
    }
  };
  return (
    <div>
      <ScoreBar items={[["Round", Math.max(0, seq.length)], ["Score", score], ["Lives", "❤️".repeat(lives) || "—"], ["Best", best]]} />
      {phase === "over" && <Banner tone="lose">The echo fades at round {seq.length}. Final score {score}.</Banner>}
      {phase === "idle" && (
        <div className="py-4 text-center">
          <p className="mx-auto max-w-sm font-semibold">Watch the pads sing their pattern, then repeat it back. Each round adds one note. Two mistakes end the song.</p>
          <div className="mt-3"><ActionButton onClick={start} label="▶ Start listening" primary /></div>
        </div>
      )}
      {phase !== "idle" && (
        <>
          <p className="mb-2 text-center font-bold">
            {phase === "show" ? "👀 Watch and listen…" : phase === "input" ? `🎵 Your turn — note ${progress + 1} of ${seq.length}` : "🎵 Game over"}
          </p>
          <div className="mx-auto grid max-w-[280px] grid-cols-2 gap-2.5" role="group" aria-label="Echo pads">
            {ECHO_PADS.map((p, i) => (
              <button key={p.name} type="button" aria-label={p.name} onClick={() => tapPad(i)}
                className="aspect-square rounded-3xl shadow transition"
                style={{ backgroundColor: p.color, opacity: lit === i ? 1 : 0.45, transform: lit === i ? "scale(1.05)" : "scale(1)" }} />
            ))}
          </div>
          {phase === "over" && <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ Play again" primary /></div>}
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- Garden Grow */
type Crop = { name: string; emoji: string; cost: number; sell: number; grow: number };
const CROPS: Crop[] = [
  { name: "Carrot", emoji: "🥕", cost: 5, sell: 11, grow: 12 },
  { name: "Berry Bush", emoji: "🫐", cost: 12, sell: 27, grow: 24 },
  { name: "Pumpkin", emoji: "🎃", cost: 22, sell: 55, grow: 40 },
];
type Plot = { crop: Crop; progress: number } | null;
function GardenGame() {
  const [plots, setPlots] = useState<Plot[]>(() => new Array(9).fill(null));
  const [coins, setCoins] = useState(30);
  const [selCrop, setSelCrop] = useState(0);
  const [won, setWon] = useState(false);
  const [best, recordBest] = useBest("garden-grow");
  useEffect(() => {
    const id = setInterval(() => {
      setPlots((ps) => ps.map((p) => (p ? { ...p, progress: Math.min(1.3, p.progress + 0.5 / p.crop.grow) } : p)));
    }, 500);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (coins >= 200 && !won) { setWon(true); recordBest(coins); beep(700, 0.18, "triangle"); }
  }, [coins, won, recordBest]);
  const tapPlot = (i: number) => {
    const p = plots[i];
    if (!p) {
      const crop = CROPS[selCrop]!;
      if (coins < crop.cost) { beep(150, 0.09, "sawtooth"); return; }
      setCoins((c) => c - crop.cost);
      setPlots((ps) => ps.map((x, xi) => (xi === i ? { crop, progress: 0 } : x)));
      beep(520, 0.05);
    } else if (p.progress >= 1) {
      const withered = p.progress > 1.22;
      const pay = withered ? Math.floor(p.crop.sell / 2) : p.crop.sell;
      setCoins((c) => c + pay);
      setPlots((ps) => ps.map((x, xi) => (xi === i ? null : x)));
      beep(withered ? 240 : 880, 0.08);
    }
  };
  const start = () => { setPlots(new Array(9).fill(null)); setCoins(30); setWon(false); };
  return (
    <div>
      <ScoreBar items={[["Coins", `🪙 ${coins}`], ["Goal", "🪙 200"], ["Best", best]]} />
      {won && <Banner tone="win">🏆 A thriving garden worth 200 coins — green fingers indeed!</Banner>}
      <div className="mb-3 flex justify-center gap-2" aria-label="Choose seeds">
        {CROPS.map((c, i) => (
          <button key={c.name} type="button" onClick={() => setSelCrop(i)} aria-pressed={selCrop === i}
            className={`rounded-2xl px-3 py-2 text-sm font-bold ring-2 ${selCrop === i ? "bg-amber-100 ring-amber-400" : "bg-[var(--surface-alt)] ring-transparent"}`}>
            {c.emoji} {c.name}<br /><span className="text-[var(--dim)]">Cost {c.cost} · sells {c.sell} · {c.grow}s</span>
          </button>
        ))}
      </div>
      <div className="mx-auto grid max-w-[330px] grid-cols-3 gap-2" role="grid" aria-label="Garden plots">
        {plots.map((p, i) => (
          <button key={i} type="button" role="gridcell" onClick={() => tapPlot(i)}
            aria-label={!p ? "Empty plot — tap to plant" : p.progress >= 1 ? `${p.crop.name} ready — tap to harvest` : `${p.crop.name} growing, ${Math.round(p.progress * 100)} percent`}
            className={`flex aspect-square flex-col items-center justify-center rounded-2xl ${!p ? "bg-amber-900/85 text-amber-100" : p.progress >= 1 ? "bg-green-100 ring-2 ring-green-400" : "bg-amber-800/80"}`}>
            {!p ? <span className="text-2xl opacity-60">🟫</span> : (
              <>
                <span className="text-4xl">{p.progress < 0.4 ? "🌱" : p.progress < 1 ? "🌿" : p.crop.emoji}</span>
                <span className="mt-1 h-2 w-16 overflow-hidden rounded-full bg-black/25">
                  <span className={`block h-full ${p.progress > 1.22 ? "bg-red-400" : "bg-green-400"}`} style={{ width: `${Math.min(100, p.progress * 100)}%` }} />
                </span>
                {p.progress >= 1 && <span className="text-xs font-extrabold text-green-700">{p.progress > 1.22 ? "Withering — half price!" : "Harvest!"}</span>}
              </>
            )}
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New garden" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Plant seeds, wait for them to ripen, tap to harvest and sell. Leave ripe crops too long and they wither to half price. Reach 200 coins to win.</p>
    </div>
  );
}

export const GAMES5A: Record<string, ComponentType> = {
  "cookie-bakery": CookieGame,
  "happy-puppy": PuppyGame,
  "fishing-relax": FishingGame,
  "echo-beats": EchoGame,
  "garden-grow": GardenGame,
};

/* --------------------------------------------------------------- Math Quest */
type MathQ = { text: string; answer: number; choices: number[] };
function makeMathQ(level: number): MathQ {
  const ops = level >= 3 ? ["+", "−", "×"] : level === 2 ? ["+", "−"] : ["+"];
  const op = ops[randi(0, ops.length - 1)]!;
  let a = randi(2, 5 + level * 3);
  let b = randi(2, 5 + level * 3);
  let answer = 0;
  if (op === "+") answer = a + b;
  else if (op === "−") { if (b > a) [a, b] = [b, a]; answer = a - b; }
  else { a = randi(2, 2 + level); b = randi(2, 9); answer = a * b; }
  const choices = new Set<number>([answer]);
  while (choices.size < 3) choices.add(Math.max(0, answer + randi(-6, 6)));
  return { text: `${a} ${op} ${b} = ?`, answer, choices: shuffle([...choices]) };
}
function MathQuestGame() {
  const [level, setLevel] = useState(1);
  const [qNum, setQNum] = useState(1);
  const [q, setQ] = useState<MathQ>(() => makeMathQ(1));
  const [hearts, setHearts] = useState(3);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<"play" | "win" | "lose">("play");
  const [feedback, setFeedback] = useState("");
  const [best, recordBest] = useBest("math-quest");
  useEffect(() => { if (status !== "play") recordBest(score); }, [status, score, recordBest]);
  const answer = (n: number) => {
    if (status !== "play") return;
    if (n === q.answer) {
      const gained = 10 + streak * 2;
      setScore((s) => s + gained);
      setStreak((s) => s + 1);
      setFeedback(`⭐ Correct! +${gained}`);
      beep(760, 0.09, "triangle");
      if (qNum >= 10) {
        if (level >= 3) { setStatus("win"); return; }
        setLevel((l) => l + 1);
        setQNum(1);
        setQ(makeMathQ(level + 1));
        setFeedback(`🎉 Level ${level} cleared! Level ${level + 1} begins — new operation unlocked!`);
      } else {
        setQNum((v) => v + 1);
        setQ(makeMathQ(level));
      }
    } else {
      const h = hearts - 1;
      setHearts(h);
      setStreak(0);
      setFeedback(`💡 Not quite — ${q.text.replace("?", "")} ${q.answer}. ${h > 0 ? "Try the next one!" : ""}`);
      beep(150, 0.15, "sawtooth");
      if (h <= 0) { setStatus("lose"); return; }
      if (qNum >= 10) {
        if (level >= 3) { setStatus("win"); return; }
        setLevel((l) => l + 1); setQNum(1); setQ(makeMathQ(level + 1));
      } else {
        setQNum((v) => v + 1);
        setQ(makeMathQ(level));
      }
    }
  };
  const start = () => {
    setLevel(1); setQNum(1); setQ(makeMathQ(1)); setHearts(3); setStreak(0); setScore(0); setStatus("play"); setFeedback("");
  };
  return (
    <div>
      <ScoreBar items={[["Level", `${level}/3`], ["Question", `${qNum}/10`], ["Hearts", "❤️".repeat(hearts) || "—"], ["Streak", `🔥 ${streak}`], ["Score", score], ["Best", best]]} />
      {status === "win" && <Banner tone="win">🏆 Math Quest complete — you're a Number Knight! Final score {score}.</Banner>}
      {status === "lose" && <Banner tone="lose">Out of hearts at level {level}. Final score {score} — every knight trains again!</Banner>}
      <div className="rounded-3xl bg-gradient-to-br from-violet-100 to-sky-100 p-5 text-center ring-1 ring-[var(--border)]">
        <p className="text-sm font-bold text-[var(--dim)]">⚔️ Solve the scroll's riddle:</p>
        <p className="mt-1 text-5xl font-extrabold tracking-wide">{q.text}</p>
        <div className="mt-4 flex justify-center gap-2.5">
          {q.choices.map((c) => (
            <button key={c} type="button" onClick={() => answer(c)} aria-label={`Answer ${c}`}
              className="h-14 w-14 rounded-2xl bg-white text-2xl font-extrabold shadow ring-1 ring-[var(--border)] hover:ring-2 hover:ring-[var(--accent)]">
              {c}
            </button>
          ))}
        </div>
        {feedback && <p className="pv-pop mt-3 font-bold">{feedback}</p>}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New quest" /></div>
    </div>
  );
}

/* ------------------------------------------------------------- Spelling Bee */
const SPELL_WORDS = [
  { word: "CAT", emoji: "🐱", hint: "A furry pet that meows" },
  { word: "SUN", emoji: "☀️", hint: "It lights up the daytime sky" },
  { word: "FISH", emoji: "🐟", hint: "It swims in the sea" },
  { word: "BIRD", emoji: "🐦", hint: "It flies and sings" },
  { word: "CAKE", emoji: "🎂", hint: "A birthday treat with candles" },
  { word: "TREE", emoji: "🌳", hint: "It grows tall with leaves" },
  { word: "FROG", emoji: "🐸", hint: "A green jumper that croaks" },
  { word: "STAR", emoji: "⭐", hint: "It twinkles at night" },
];
function SpellingGame() {
  const [order] = useState(() => shuffle(SPELL_WORDS));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [tiles, setTiles] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState(false);
  const [best, recordBest] = useBest("spelling-bee");
  const current = order[idx]!;
  const setupTiles = useCallback((word: string) => {
    const extra = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[randi(0, 25)]!;
    setTiles(shuffle([...word.split(""), extra]));
    setPicked([]);
  }, []);
  useEffect(() => { setupTiles(order[0]!.word); }, [order, setupTiles]);
  const score = Math.max(0, idx * 60 - mistakes * 10 + (done ? 40 : 0));
  useEffect(() => { if (done) recordBest(score); }, [done, score, recordBest]);
  const tapTile = (t: string, ti: number) => {
    if (done) return;
    const expected = current.word[picked.length];
    if (t === expected) {
      const np = [...picked, t];
      setPicked(np);
      setTiles((ts) => ts.filter((_, i) => i !== ti));
      beep(700, 0.06);
      if (np.length === current.word.length) {
        beep(760, 0.14, "triangle");
        if (idx + 1 >= order.length) setDone(true);
        else {
          const ni = idx + 1;
          setIdx(ni);
          setupTiles(order[ni]!.word);
        }
      }
    } else {
      setMistakes((m) => m + 1);
      beep(150, 0.12, "sawtooth");
    }
  };
  const start = () => {
    setIdx(0); setMistakes(0); setDone(false);
    setupTiles(order[0]!.word);
  };
  return (
    <div>
      <ScoreBar items={[["Word", `${Math.min(idx + 1, order.length)}/${order.length}`], ["Mistakes", mistakes], ["Score", score], ["Best", best]]} />
      {done && <Banner tone="win">🏆 Every word spelled — you're the Spelling Bee champion! Score {score}.</Banner>}
      <div className="rounded-3xl bg-amber-50 p-5 text-center ring-1 ring-amber-200">
        <p className="text-6xl">{current.emoji}</p>
        <p className="mt-1 font-semibold text-[var(--dim)]">{current.hint}</p>
        <p className="mt-3 flex justify-center gap-1.5" aria-label="Your spelling so far">
          {current.word.split("").map((_, i) => (
            <span key={i} className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl font-extrabold ${picked[i] ? "bg-green-500 text-white" : "bg-white ring-2 ring-dashed ring-amber-300"}`}>
              {picked[i] ?? ""}
            </span>
          ))}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Letter tiles">
          {tiles.map((t, ti) => (
            <button key={`${t}-${ti}`} type="button" onClick={() => tapTile(t, ti)} aria-label={`Letter ${t}`}
              className="h-12 w-12 rounded-2xl bg-amber-400 text-2xl font-extrabold text-amber-950 shadow hover:scale-105">
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ Start over" /></div>
    </div>
  );
}

/* --------------------------------------------------------- Counting Carnival */
const COUNT_EMOJIS = ["🎈", "🍎", "⭐", "🦋", "🚗", "🐥"];
function CountingGame() {
  const [round, setRound] = useState(1);
  const [emoji, setEmoji] = useState("🎈");
  const [count, setCount] = useState(7);
  const [choices, setChoices] = useState<number[]>([6, 7, 8]);
  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [status, setStatus] = useState<"play" | "win" | "lose">("play");
  const [feedback, setFeedback] = useState("");
  const [positions] = useState(() => new Map<number, { x: number; y: number }>());
  const [best, recordBest] = useBest("counting-carnival");
  const newRound = useCallback((r: number) => {
    const c = randi(3, 9 + r);
    setCount(c);
    setEmoji(COUNT_EMOJIS[randi(0, COUNT_EMOJIS.length - 1)]!);
    const set = new Set<number>([c]);
    while (set.size < 3) set.add(Math.max(1, c + randi(-3, 3)));
    setChoices(shuffle([...set]));
    positions.clear();
    for (let i = 0; i < c; i++) {
      positions.set(i, { x: rand(4, 88), y: rand(6, 78) });
    }
  }, [positions]);
  useEffect(() => { newRound(1); }, [newRound]);
  useEffect(() => { if (status !== "play") recordBest(score); }, [status, score, recordBest]);
  const answer = (n: number) => {
    if (status !== "play") return;
    if (n === count) {
      setScore((s) => s + 15);
      setFeedback("🎉 That's right! Great counting!");
      beep(760, 0.09, "triangle");
      if (round >= 10) { setStatus("win"); return; }
      setRound((r) => r + 1);
      newRound(round + 1);
    } else {
      const h = hearts - 1;
      setHearts(h);
      setFeedback(`🔢 Count again slowly — there are ${count}.`);
      beep(150, 0.13, "sawtooth");
      if (h <= 0) { setStatus("lose"); return; }
      if (round >= 10) { setStatus("win"); return; }
      setRound((r) => r + 1);
      newRound(round + 1);
    }
  };
  const start = () => {
    setRound(1); setScore(0); setHearts(3); setStatus("play"); setFeedback("");
    newRound(1);
  };
  return (
    <div>
      <ScoreBar items={[["Round", `${round}/10`], ["Hearts", "❤️".repeat(hearts) || "—"], ["Score", score], ["Best", best]]} />
      {status === "win" && <Banner tone="win">🏆 Ten rounds done — Counting Carnival champion! Score {score}.</Banner>}
      {status === "lose" && <Banner tone="lose">Out of hearts — but counting is a superpower you build one try at a time. Score {score}.</Banner>}
      <p className="mb-2 text-center text-lg font-extrabold">How many {emoji} can you count?</p>
      <div className="relative mx-auto h-44 max-w-[420px] rounded-3xl bg-sky-50 ring-1 ring-[var(--border)]" aria-label="Counting area">
        {Array.from({ length: count }, (_, i) => {
          const p = positions.get(i) ?? { x: 8 + (i % 5) * 19, y: 10 + Math.floor(i / 5) * 34 };
          return <span key={i} className="absolute text-3xl" style={{ left: `${p.x}%`, top: `${p.y}%` }}>{emoji}</span>;
        })}
      </div>
      <div className="mt-3 flex justify-center gap-2.5">
        {choices.map((c) => (
          <button key={c} type="button" onClick={() => answer(c)} aria-label={`Answer ${c}`}
            className="h-14 w-14 rounded-2xl bg-[var(--accent)] text-2xl font-extrabold text-white shadow hover:brightness-110">
            {c}
          </button>
        ))}
      </div>
      {feedback && <p className="pv-pop mt-2 text-center font-bold">{feedback}</p>}
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New carnival" /></div>
    </div>
  );
}

/* ------------------------------------------------------------- Shape Sorter */
const SHAPES = [
  { name: "Circle", emoji: "🔴" },
  { name: "Square", emoji: "🟦" },
  { name: "Triangle", emoji: "🔺" },
  { name: "Star", emoji: "⭐" },
  { name: "Heart", emoji: "❤️" },
  { name: "Diamond", emoji: "🔶" },
];
function ShapeSorterGame() {
  const [target, setTarget] = useState(() => SHAPES[randi(0, SHAPES.length - 1)]!);
  const [options, setOptions] = useState<typeof SHAPES>(() => shuffle(SHAPES).slice(0, 4));
  const [round, setRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(6);
  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [status, setStatus] = useState<"play" | "win" | "lose">("play");
  const [feedback, setFeedback] = useState("");
  const [best, recordBest] = useBest("shape-sorter");
  const nextRound = useCallback((r: number) => {
    const t = SHAPES[randi(0, SHAPES.length - 1)]!;
    setTarget(t);
    const others = shuffle(SHAPES.filter((s) => s.name !== t.name)).slice(0, 3);
    setOptions(shuffle([t, ...others]));
    setTimeLeft(Math.max(3, 6 - r * 0.2));
  }, []);
  useEffect(() => {
    if (status !== "play") return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0.1) {
          const h = hearts - 1;
          setHearts(h);
          setFeedback(`⏰ Time's up! That was the ${target.name}.`);
          beep(150, 0.14, "sawtooth");
          if (h <= 0) { setStatus("lose"); return 0; }
          if (round >= 15) { setStatus("win"); return 0; }
          setRound((r) => r + 1);
          nextRound(round + 1);
          return Math.max(3, 6 - (round + 1) * 0.2);
        }
        return t - 0.1;
      });
    }, 100);
    return () => clearInterval(id);
  }, [status, hearts, round, target, nextRound]);
  useEffect(() => { if (status !== "play") recordBest(score); }, [status, score, recordBest]);
  const pick = (s: (typeof SHAPES)[number]) => {
    if (status !== "play") return;
    if (s.name === target.name) {
      const gained = 10 + Math.round(timeLeft * 2);
      setScore((v) => v + gained);
      setFeedback(`✅ Yes! That's the ${target.name}! +${gained}`);
      beep(760, 0.08, "triangle");
    } else {
      const h = hearts - 1;
      setHearts(h);
      setFeedback(`💡 That's the ${s.name} — we need the ${target.name}.`);
      beep(150, 0.13, "sawtooth");
      if (h <= 0) { setStatus("lose"); return; }
    }
    if (round >= 15) { setStatus("win"); return; }
    setRound((r) => r + 1);
    nextRound(round + 1);
  };
  const start = () => {
    setRound(1); setScore(0); setHearts(3); setStatus("play"); setFeedback("");
    nextRound(1);
  };
  return (
    <div>
      <ScoreBar items={[["Round", `${round}/15`], ["Hearts", "❤️".repeat(hearts) || "—"], ["Time", `${Math.max(0, timeLeft).toFixed(0)}s`], ["Score", score], ["Best", best]]} />
      {status === "win" && <Banner tone="win">🏆 Fifteen shapes sorted — you're a Shape Master! Score {score}.</Banner>}
      {status === "lose" && <Banner tone="lose">Out of hearts. Shapes are everywhere — practice makes perfect! Score {score}.</Banner>}
      <div className="rounded-3xl bg-violet-50 p-5 text-center ring-1 ring-violet-200">
        <p className="font-bold text-[var(--dim)]">Find the…</p>
        <p className="mt-1 text-3xl font-extrabold">{target.name}!</p>
        <div className="mx-auto mt-2 h-2.5 w-52 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full ${timeLeft < 2 ? "bg-red-500" : "bg-violet-500"}`} style={{ width: `${(timeLeft / 6) * 100}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {options.map((s) => (
            <button key={s.name} type="button" onClick={() => pick(s)} aria-label={`Choose the ${s.name}`}
              className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-5xl shadow ring-1 ring-[var(--border)] hover:scale-105">
              {s.emoji}
            </button>
          ))}
        </div>
        {feedback && <p className="pv-pop mt-3 font-bold">{feedback}</p>}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ Play again" /></div>
    </div>
  );
}

/* -------------------------------------------------------------- Animal Quiz */
const ANIMAL_QS = [
  { q: "Which animal is the largest land animal in the world?", options: ["🐘 African Elephant", "🦒 Giraffe", "🐴 Horse"], answer: 0, fact: "An African elephant can weigh as much as six small cars!" },
  { q: "Which animal says 'moo' and gives us milk?", options: ["🐷 Pig", "🐄 Cow", "🐑 Sheep"], answer: 1, fact: "A cow's stomach has four parts to help it digest grass." },
  { q: "Which bird cannot fly but swims beautifully?", options: ["🦅 Eagle", "🦉 Owl", "🐧 Penguin"], answer: 2, fact: "Penguins 'fly' through the water with their flippers." },
  { q: "Which animal has black and white stripes?", options: ["🦓 Zebra", "🐯 Tiger", "🐼 Panda"], answer: 0, fact: "Every zebra's stripe pattern is unique, like a fingerprint." },
  { q: "Which animal hops and carries babies in a pouch?", options: ["🐰 Rabbit", "🦘 Kangaroo", "🐿️ Squirrel"], answer: 1, fact: "A baby kangaroo is called a joey and is born the size of a jellybean." },
  { q: "Which animal is called the 'King of the Jungle'?", options: ["🐯 Tiger", "🦁 Lion", "🐆 Leopard"], answer: 1, fact: "A lion's roar can be heard 8 kilometers away." },
  { q: "Which sea animal has eight arms?", options: ["🦀 Crab", "🐙 Octopus", "🦐 Shrimp"], answer: 1, fact: "An octopus has three hearts and blue blood." },
  { q: "Which animal changes its skin color to hide?", options: ["🦎 Chameleon", "🐸 Frog", "🐢 Turtle"], answer: 0, fact: "A chameleon's tongue can be longer than its whole body." },
  { q: "Which animal is the fastest runner on land?", options: ["🐎 Horse", "🐆 Cheetah", "🦌 Deer"], answer: 1, fact: "A cheetah can reach 60 km/h in just three seconds." },
  { q: "Which animal sleeps hanging upside down?", options: ["🦇 Bat", "🦥 Sloth", "🐨 Koala"], answer: 0, fact: "Bats are the only mammals that can truly fly." },
];
function AnimalQuizGame() {
  const [order] = useState(() => shuffle(ANIMAL_QS));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [best, recordBest] = useBest("animal-quiz");
  const q = order[idx]!;
  useEffect(() => { if (done) recordBest(score); }, [done, score, recordBest]);
  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.answer) {
      setScore((s) => s + 20);
      beep(760, 0.1, "triangle");
    } else beep(150, 0.13, "sawtooth");
  };
  const next = () => {
    if (idx + 1 >= order.length) { setDone(true); return; }
    setIdx((v) => v + 1);
    setPicked(null);
  };
  const start = () => { setIdx(0); setPicked(null); setScore(0); setDone(false); };
  return (
    <div>
      <ScoreBar items={[["Question", `${Math.min(idx + 1, order.length)}/${order.length}`], ["Score", score], ["Best", best]]} />
      {done && <Banner tone="win">🏆 Quiz complete — you scored {score} out of {order.length * 20}! You're a true Animal Expert.</Banner>}
      {!done && (
        <div className="rounded-3xl bg-green-50 p-5 ring-1 ring-green-200">
          <p className="text-center text-xl font-extrabold">{q.q}</p>
          <div className="mt-4 grid gap-2">
            {q.options.map((opt, i) => {
              const isAnswer = picked !== null && i === q.answer;
              const isWrongPick = picked === i && i !== q.answer;
              return (
                <button key={opt} type="button" onClick={() => choose(i)} disabled={picked !== null}
                  className={`rounded-2xl px-4 py-3 text-left text-lg font-bold ring-1 ${
                    isAnswer ? "bg-green-500 text-white ring-green-600" : isWrongPick ? "bg-red-100 ring-red-300" : "bg-white ring-[var(--border)] hover:ring-2 hover:ring-[var(--accent)]"
                  }`}>
                  {opt} {isAnswer ? "✓" : isWrongPick ? "✗" : ""}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className="pv-pop mt-3 text-center">
              <p className="font-semibold">💡 {q.fact}</p>
              <div className="mt-2"><ActionButton onClick={next} label={idx + 1 >= order.length ? "See my result →" : "Next animal →"} primary /></div>
            </div>
          )}
        </div>
      )}
      {(done || idx > 0) && <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New quiz" /></div>}
    </div>
  );
}

export const GAMES5B: Record<string, ComponentType> = {
  "math-quest": MathQuestGame,
  "spelling-bee": SpellingGame,
  "counting-carnival": CountingGame,
  "shape-sorter": ShapeSorterGame,
  "animal-quiz": AnimalQuizGame,
};

/* --------------------------------------------------------------- Pong Duel */
type PongDuelState = {
  score: number; over?: boolean; won?: boolean;
  bx: number; by: number; vx: number; vy: number;
  p1: number; p2: number; p2Score: number; serveT: number;
};
function PongDuelGame() {
  return (
    <Engine<PongDuelState>
      id="pong-duel" label="Pong Duel — 2 Players"
      blurb="Same screen, two paddles! Player 1 uses W/S, Player 2 uses ↑/↓ — or drag your half of the screen. First to 7 takes the crown."
      create={() => ({ score: 0, bx: W / 2, by: H / 2, vx: 200, vy: 100, p1: H / 2, p2: H / 2, p2Score: 0, serveT: 0.7 })}
      hud={(s) => [["Player 1", s.score], ["Player 2", s.p2Score], ["First to", 7]]}
      step={(s, dt, input, api) => {
        if (input.keys.has("w") || input.keys.has("W")) s.p1 -= 260 * dt;
        if (input.keys.has("s") || input.keys.has("S")) s.p1 += 260 * dt;
        if (input.keys.has("ArrowUp")) s.p2 -= 260 * dt;
        if (input.keys.has("ArrowDown")) s.p2 += 260 * dt;
        if (input.pdown) {
          if (input.px < W / 2) s.p1 += clamp(input.py - s.p1, -300 * dt, 300 * dt);
          else s.p2 += clamp(input.py - s.p2, -300 * dt, 300 * dt);
        }
        s.p1 = clamp(s.p1, 34, H - 34);
        s.p2 = clamp(s.p2, 34, H - 34);
        if (s.serveT > 0) { s.serveT -= dt; return; }
        s.bx += s.vx * dt; s.by += s.vy * dt;
        if (s.by < 8) { s.by = 8; s.vy = Math.abs(s.vy); api.beep(500, 0.04); }
        if (s.by > H - 8) { s.by = H - 8; s.vy = -Math.abs(s.vy); api.beep(500, 0.04); }
        if (s.bx < 26 && Math.abs(s.by - s.p1) < 40 && s.vx < 0) {
          s.vx = Math.abs(s.vx) * 1.04; s.vy = clamp(s.vy + (s.by - s.p1) * 3.4, -270, 270); s.bx = 26;
          api.beep(700, 0.05);
        }
        if (s.bx > W - 26 && Math.abs(s.by - s.p2) < 40 && s.vx > 0) {
          s.vx = -Math.abs(s.vx) * 1.04; s.vy = clamp(s.vy + (s.by - s.p2) * 3.4, -270, 270); s.bx = W - 26;
          api.beep(700, 0.05);
        }
        if (s.bx < -12) {
          s.p2Score += 1; api.beep(200, 0.12, "triangle");
          s.bx = W / 2; s.by = H / 2; s.vx = 200; s.vy = 90; s.serveT = 0.8;
          if (s.p2Score >= 7) { api.end(false); return; }
        }
        if (s.bx > W + 12) {
          s.score += 1; api.beep(620, 0.12, "triangle");
          s.bx = W / 2; s.by = H / 2; s.vx = -200; s.vy = -90; s.serveT = 0.8;
          if (s.score >= 7) { api.end(true); return; }
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#172554"; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.setLineDash([8, 10]);
        ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "#38bdf8"; ctx.fillRect(12, s.p1 - 34, 9, 68);
        ctx.fillStyle = "#fb7185"; ctx.fillRect(W - 21, s.p2 - 34, 9, 68);
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(s.bx, s.by, 7, 0, 7); ctx.fill();
        ctx.font = "bold 40px system-ui"; ctx.textAlign = "center";
        ctx.fillStyle = "rgba(56,189,248,0.5)";
        ctx.fillText(String(s.score), W / 2 - 52, 56);
        ctx.fillStyle = "rgba(251,113,133,0.5)";
        ctx.fillText(String(s.p2Score), W / 2 + 52, 56);
        ctx.font = "bold 12px system-ui"; ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.fillText("P1: W/S", 60, H - 12);
        ctx.fillText("P2: ↑/↓", W - 60, H - 12);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* --------------------------------------------------------------- Tank Duel */
type TankDuelState = {
  score: number; over?: boolean; won?: boolean;
  turn: 1 | 2; angle: number; power: number; charging: boolean;
  hp1: number; hp2: number; wind: number;
  shell: { x: number; y: number; vx: number; vy: number } | null;
  message: string; flash: number;
};
const DUEL_HILLS = [296, 268, 288, 252, 276, 262, 290, 300];
function hillY(x: number): number {
  const seg = clamp(Math.floor(x / 60), 0, 7);
  const next = DUEL_HILLS[Math.min(7, seg + 1)]!;
  const cur = DUEL_HILLS[seg]!;
  const t = (x - seg * 60) / 60;
  return cur + (next - cur) * t;
}
function TankDuelGame() {
  return (
    <Engine<TankDuelState>
      id="tank-duel" label="Tank Duel — 2 Players"
      blurb="Pass-and-play artillery! Aim with ↑/↓, hold Space (or press and hold the screen) to charge, release to fire. Mind the wind!"
      create={() => ({ score: 0, turn: 1, angle: 45, power: 30, charging: false, hp1: 100, hp2: 100, wind: randi(-4, 4), shell: null, message: "Player 1's shot — aim with ↑ ↓, hold Space to charge!", flash: 0 })}
      hud={(s) => [["P1 health", `${Math.max(0, Math.round(s.hp1))}%`], ["P2 health", `${Math.max(0, Math.round(s.hp2))}%`], ["Turn", `Player ${s.turn}`], ["Wind", s.wind === 0 ? "Calm" : s.wind > 0 ? `→ ${s.wind}` : `← ${-s.wind}`], ["Angle", `${Math.round(s.turn === 1 ? s.angle : 180 - s.angle)}°`], ["Power", `${Math.round(s.power)}%`]]}
      onKey={(s, key, api) => {
        if (s.shell) return;
        if (key === "ArrowUp") s.angle = clamp(s.angle + 2, 8, 84);
        if (key === "ArrowDown") s.angle = clamp(s.angle - 2, 8, 84);
        if (key === " " && !s.charging) { s.charging = true; s.power = 12; }
        if (key === "Enter") fireDuel(s, api);
      }}
      onTap={(s, _x, _y, api) => {
        if (!s.shell && !s.charging) { s.charging = true; s.power = 12; void api; }
      }}
      step={(s, dt, input, api) => {
        s.flash = Math.max(0, s.flash - dt);
        if (s.charging) {
          s.power = Math.min(100, s.power + 62 * dt);
          const released = s.turn === 1 || s.turn === 2 ? !(input.keys.has(" ") || input.pdown) : false;
          if (released) fireDuel(s, api);
        }
        const sh = s.shell;
        if (sh) {
          sh.vy += 300 * dt;
          sh.vx += s.wind * 6 * dt;
          sh.x += sh.vx * dt;
          sh.y += sh.vy * dt;
          const targets = [
            { x: 52, hp: "hp1" as const }, { x: 428, hp: "hp2" as const },
          ];
          let resolved = false;
          for (const t of targets) {
            const ty = hillY(t.x) - 10;
            if (Math.hypot(sh.x - t.x, sh.y - ty) < 21) {
              const dmg = 34;
              s[t.hp] -= dmg;
              s.flash = 0.5;
              s.message = `💥 Direct hit! −${dmg} health.`;
              api.beep(110, 0.25, "sawtooth");
              resolved = true;
            }
          }
          if (!resolved && (sh.y >= hillY(sh.x) || sh.x < -10 || sh.x > W + 10 || sh.y > H + 6)) {
            const near1 = Math.abs(sh.x - 52);
            const near2 = Math.abs(sh.x - 428);
            if (sh.y >= hillY(sh.x) && Math.min(near1, near2) < 42) {
              const hpKey = near1 < near2 ? "hp1" : "hp2";
              s[hpKey] -= 14;
              s.flash = 0.4;
              s.message = "Splash damage from a near miss! −14 health.";
              api.beep(150, 0.18, "sawtooth");
            } else {
              s.message = "Missed! The shell plows into the hills.";
              api.beep(200, 0.08);
            }
            resolved = true;
          }
          if (resolved) {
            s.shell = null;
            if (s.hp1 <= 0 || s.hp2 <= 0) {
              s.score = s.hp2 <= 0 ? 100 : 0;
              api.end(s.hp2 <= 0);
              return;
            }
            s.turn = s.turn === 1 ? 2 : 1;
            s.angle = 45;
            s.wind = randi(-4, 4);
            s.message = `Player ${s.turn}'s shot — aim with ↑ ↓, hold Space to charge!`;
          }
        }
      }}
      draw={(ctx, s) => {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#7dd3fc"); grad.addColorStop(1, "#fef3c7");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#65a30d";
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 10) ctx.lineTo(x, hillY(x));
        ctx.lineTo(W, H); ctx.fill();
        const drawTank = (x: number, flip: boolean, color: string, active: boolean) => {
          const y = hillY(x);
          ctx.save(); ctx.translate(x, y - 8); ctx.scale(flip ? -1 : 1, 1);
          ctx.fillStyle = color; ctx.fillRect(-14, -8, 28, 10);
          ctx.beginPath(); ctx.arc(0, -8, 8, Math.PI, 0); ctx.fill();
          const a = (-s.angle * Math.PI) / 180;
          ctx.strokeStyle = "#1f2937"; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(Math.cos(a) * 20, -10 + Math.sin(a) * 20); ctx.stroke();
          ctx.restore();
          if (active) {
            ctx.fillStyle = "#111827"; ctx.font = "bold 11px system-ui"; ctx.textAlign = "center";
            ctx.fillText("▼ YOUR TURN", x, y - 44);
          }
        };
        drawTank(52, false, "#2563eb", s.turn === 1);
        drawTank(428, true, "#dc2626", s.turn === 2);
        if (s.shell) {
          ctx.fillStyle = "#111827";
          ctx.beginPath(); ctx.arc(s.shell.x, s.shell.y, 4.5, 0, 7); ctx.fill();
        }
        if (s.flash > 0) {
          ctx.fillStyle = `rgba(249,115,22,${s.flash})`;
          ctx.beginPath(); ctx.arc(s.turn === 1 ? 428 : 52, hillY(s.turn === 1 ? 428 : 52) - 12, 30, 0, 7); ctx.fill();
        }
        if (s.charging) {
          ctx.fillStyle = "#111827"; ctx.fillRect(150, 14, 180, 14);
          ctx.fillStyle = s.power > 80 ? "#ef4444" : "#22c55e";
          ctx.fillRect(152, 16, 176 * (s.power / 100), 10);
        }
        ctx.fillStyle = "rgba(15,23,42,0.72)"; ctx.fillRect(30, 326, 420, 24);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "center";
        ctx.fillText(s.message, W / 2, 342);
        ctx.textAlign = "left";
      }}
    />
  );
}
function fireDuel(s: TankDuelState, api: { beep: typeof beep }) {
  if (s.shell || !s.charging) return;
  s.charging = false;
  const fromLeft = s.turn === 1;
  const x = fromLeft ? 52 : 428;
  const y = hillY(x) - 16;
  const rad = (s.angle * Math.PI) / 180;
  const sp = 130 + s.power * 2.6;
  const dir = fromLeft ? 1 : -1;
  s.shell = { x, y, vx: Math.cos(rad) * sp * dir, vy: -Math.sin(rad) * sp };
  s.power = 30;
  api.beep(260, 0.12, "sawtooth");
}

/* ---------------------------------------------------------------- Duo Dash */
type DuoState = {
  score: number; over?: boolean; won?: boolean;
  p1: { prog: number; total: number; lane: number; speed: number };
  p2: { prog: number; total: number; lane: number; speed: number };
  oils: { prog: number; lane: number }[];
  message: string;
};
function DuoDashGame() {
  const mkCar = (lane: number) => ({ prog: 0, total: 0, lane, speed: 0.03 });
  return (
    <Engine<DuoState>
      id="duo-dash" label="Duo Dash — 2 Players"
      blurb="Two karts, one screen, three laps! Player 1 steers with A/D and boosts with W; Player 2 uses ←/→ and ↑. Oil slicks spin you out!"
      create={() => ({
        score: 0, p1: mkCar(0), p2: mkCar(2), message: "First to finish 3 laps wins!",
        oils: Array.from({ length: 6 }, () => ({ prog: rand(0.1, 0.95), lane: randi(0, 2) })),
      })}
      hud={(s) => [["P1 lap", `${Math.min(3, Math.floor(s.p1.total) + 1)}/3`], ["P2 lap", `${Math.min(3, Math.floor(s.p2.total) + 1)}/3`], ["Leader", s.p1.total === s.p2.total ? "Tied!" : s.p1.total > s.p2.total ? "🔵 P1" : "🔴 P2"]]}
      onKey={(s, key, api) => {
        if (key === "a" || key === "A") { s.p1.lane = Math.max(0, s.p1.lane - 1); api.beep(420, 0.03); }
        if (key === "d" || key === "D") { s.p1.lane = Math.min(2, s.p1.lane + 1); api.beep(420, 0.03); }
        if (key === "ArrowLeft") { s.p2.lane = Math.max(0, s.p2.lane - 1); api.beep(460, 0.03); }
        if (key === "ArrowRight") { s.p2.lane = Math.min(2, s.p2.lane + 1); api.beep(460, 0.03); }
      }}
      step={(s, dt, input, api) => {
        const drive = (car: DuoState["p1"], boost: boolean) => {
          const target = boost ? 0.072 : 0.05;
          car.speed += clamp(target - car.speed, -dt * 0.03, dt * 0.025);
          car.prog += car.speed * dt;
          car.total += car.speed * dt;
          if (car.prog >= 1) car.prog -= 1;
        };
        drive(s.p1, input.keys.has("w") || input.keys.has("W"));
        drive(s.p2, input.keys.has("ArrowUp"));
        for (const car of [s.p1, s.p2]) {
          for (const o of s.oils) {
            const d = Math.abs(((o.prog - car.prog) % 1 + 1) % 1);
            if (d < 0.005 && o.lane === car.lane) {
              car.speed = 0.012;
              o.prog = -10;
              api.beep(120, 0.16, "sawtooth");
            }
          }
        }
        if (s.p1.total >= 3 || s.p2.total >= 3) {
          s.score = s.p1.total > s.p2.total ? 100 : 50;
          s.message = s.p1.total > s.p2.total ? "🔵 Player 1 wins the Duo Dash!" : "🔴 Player 2 wins the Duo Dash!";
          api.end(s.p1.total > s.p2.total);
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#22c55e"; ctx.fillRect(0, 0, W, H);
        const cx = W / 2, cy = H / 2;
        ctx.strokeStyle = "#78716c"; ctx.lineWidth = 118;
        ctx.beginPath(); ctx.ellipse(cx, cy, 168, 104, 0, 0, 7); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 3; ctx.setLineDash([12, 14]);
        ctx.beginPath(); ctx.ellipse(cx, cy, 168, 104, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        const kartAt = (prog: number, lane: number) => {
          const a = -Math.PI / 2 + prog * Math.PI * 2;
          return { x: cx + Math.cos(a) * (168 + (lane - 1) * 34), y: cy + Math.sin(a) * (104 + (lane - 1) * 21) };
        };
        ctx.font = "20px serif"; ctx.textAlign = "center";
        for (const o of s.oils) {
          if (o.prog < 0) continue;
          const p = kartAt(o.prog, o.lane);
          ctx.fillText("🛢️", p.x, p.y + 6);
        }
        const a = kartAt(s.p1.prog, s.p1.lane);
        const b = kartAt(s.p2.prog, s.p2.lane);
        ctx.font = "26px serif";
        ctx.fillText("🔵", a.x, a.y + 8);
        ctx.fillText("🔴", b.x, b.y + 8);
        ctx.fillStyle = "rgba(15,23,42,0.7)"; ctx.fillRect(120, 8, 240, 24);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12.5px system-ui";
        ctx.fillText(s.message, W / 2, 24);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* -------------------------------------------------------------- Air Hockey */
type HockeyState = {
  score: number; over?: boolean; won?: boolean;
  puck: { x: number; y: number; vx: number; vy: number };
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  p2Score: number; serveT: number;
};
function AirHockeyGame() {
  return (
    <Engine<HockeyState>
      id="air-hockey" label="Air Hockey — 2 Players"
      blurb="Player 1 guards the bottom goal with the pointer; Player 2 defends the top with the arrow keys. First to 5 goals!"
      create={() => ({ score: 0, puck: { x: W / 2, y: H / 2, vx: 90, vy: 130 }, p1: { x: W / 2, y: 300 }, p2: { x: W / 2, y: 60 }, p2Score: 0, serveT: 0.6 })}
      hud={(s) => [["Player 1", s.score], ["Player 2", s.p2Score], ["First to", 5]]}
      step={(s, dt, input, api) => {
        s.p1.x += clamp(input.px - s.p1.x, -420 * dt, 420 * dt);
        s.p1.y += clamp(input.py - s.p1.y, -420 * dt, 420 * dt);
        s.p1.x = clamp(s.p1.x, 24, W - 24);
        s.p1.y = clamp(s.p1.y, H / 2 + 18, H - 24);
        const p2sp = 250;
        if (input.keys.has("ArrowLeft")) s.p2.x -= p2sp * dt;
        if (input.keys.has("ArrowRight")) s.p2.x += p2sp * dt;
        if (input.keys.has("ArrowUp")) s.p2.y -= p2sp * dt;
        if (input.keys.has("ArrowDown")) s.p2.y += p2sp * dt;
        s.p2.x = clamp(s.p2.x, 24, W - 24);
        s.p2.y = clamp(s.p2.y, 24, H / 2 - 18);
        if (s.serveT > 0) { s.serveT -= dt; return; }
        const p = s.puck;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 12) { p.x = 12; p.vx = Math.abs(p.vx); api.beep(480, 0.03); }
        if (p.x > W - 12) { p.x = W - 12; p.vx = -Math.abs(p.vx); api.beep(480, 0.03); }
        const malletHit = (m: { x: number; y: number }) => {
          const d = Math.hypot(p.x - m.x, p.y - m.y);
          if (d < 26 && d > 0) {
            const nx = (p.x - m.x) / d, ny = (p.y - m.y) / d;
            const sp = Math.max(210, Math.hypot(p.vx, p.vy) * 1.05);
            p.vx = nx * sp; p.vy = ny * sp;
            p.x = m.x + nx * 27; p.y = m.y + ny * 27;
            api.beep(680, 0.04);
          }
        };
        malletHit(s.p1);
        malletHit(s.p2);
        if (p.y < 6) {
          if (p.x > W / 2 - 52 && p.x < W / 2 + 52) {
            s.score += 1;
            api.beep(700, 0.14, "triangle");
            s.puck = { x: W / 2, y: H / 2, vx: 80, vy: -120 };
            s.serveT = 0.8;
            if (s.score >= 5) { api.end(true); return; }
          } else { p.y = 6; p.vy = Math.abs(p.vy); }
        }
        if (p.y > H - 6) {
          if (p.x > W / 2 - 52 && p.x < W / 2 + 52) {
            s.p2Score += 1;
            api.beep(220, 0.14, "triangle");
            s.puck = { x: W / 2, y: H / 2, vx: -80, vy: 120 };
            s.serveT = 0.8;
            if (s.p2Score >= 5) { api.end(false); return; }
          } else { p.y = H - 6; p.vy = -Math.abs(p.vy); }
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#e0f2fe"; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "#0284c7"; ctx.lineWidth = 3;
        ctx.strokeRect(6, 6, W - 12, H - 12);
        ctx.beginPath(); ctx.moveTo(6, H / 2); ctx.lineTo(W - 6, H / 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(W / 2, H / 2, 40, 0, 7); ctx.stroke();
        ctx.fillStyle = "#dc2626"; ctx.fillRect(W / 2 - 52, 0, 104, 8);
        ctx.fillStyle = "#2563eb"; ctx.fillRect(W / 2 - 52, H - 8, 104, 8);
        ctx.fillStyle = "#f97316";
        ctx.beginPath(); ctx.arc(s.puck.x, s.puck.y, 10, 0, 7); ctx.fill();
        ctx.fillStyle = "#2563eb";
        ctx.beginPath(); ctx.arc(s.p1.x, s.p1.y, 16, 0, 7); ctx.fill();
        ctx.fillStyle = "#93c5fd"; ctx.beginPath(); ctx.arc(s.p1.x, s.p1.y, 7, 0, 7); ctx.fill();
        ctx.fillStyle = "#dc2626";
        ctx.beginPath(); ctx.arc(s.p2.x, s.p2.y, 16, 0, 7); ctx.fill();
        ctx.fillStyle = "#fca5a5"; ctx.beginPath(); ctx.arc(s.p2.x, s.p2.y, 7, 0, 7); ctx.fill();
        ctx.fillStyle = "#0c4a6e"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "center";
        ctx.fillText("P2 defends here (arrow keys)", W / 2, 26);
        ctx.fillText("P1 defends here (pointer)", W / 2, H - 16);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* -------------------------------------------------------------- Tug of War */
function TugGame() {
  const [pos, setPos] = useState(0);
  const [time, setTime] = useState(45);
  const [status, setStatus] = useState<"idle" | "play" | "done">("idle");
  const [winner, setWinner] = useState("");
  const [best, recordBest] = useBest("tug-of-war");
  useEffect(() => {
    if (status !== "play") return;
    const id = setInterval(() => {
      setTime((t) => {
        if (t <= 0.1) {
          setStatus("done");
          setWinner(pos === 0 ? "A dead heat — it's a draw!" : pos < 0 ? "🔵 Player 1 wins on points!" : "🔴 Player 2 wins on points!");
          if (pos < 0) recordBest(100);
          return 0;
        }
        return t - 0.1;
      });
      setPos((p) => p * 0.995);
    }, 100);
    return () => clearInterval(id);
  }, [status, pos, recordBest]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (status !== "play") return;
      if (e.key === "a" || e.key === "A") pull(-1);
      if (e.key === "l" || e.key === "L") pull(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const pull = (dir: -1 | 1) => {
    if (status !== "play") return;
    setPos((p) => {
      const np = clamp(p + dir * 3.4, -50, 50);
      if (np <= -50 || np >= 50) {
        setStatus("done");
        setWinner(dir < 0 ? "🔵 Player 1 pulls it home!" : "🔴 Player 2 pulls it home!");
        if (dir < 0) recordBest(100);
      }
      return np;
    });
    beep(dir < 0 ? 420 : 460, 0.04);
  };
  const start = () => { setPos(0); setTime(45); setStatus("play"); setWinner(""); };
  const score = status === "done" && pos < 0 ? 100 : status === "done" ? 40 : Math.max(0, Math.round(50 - pos));
  return (
    <div>
      <ScoreBar items={[["Time", status === "play" ? `${Math.max(0, time).toFixed(0)}s` : "—"], ["Best", best]]} />
      {status === "done" && <Banner tone={pos < 0 ? "win" : "info"}>{winner} Score {score}.</Banner>}
      {status === "idle" && (
        <div className="py-4 text-center">
          <p className="mx-auto max-w-md font-semibold">Two players, one rope! Player 1 mashes <b>A</b> (or taps the blue button), Player 2 mashes <b>L</b> (or the red button). Drag the knot past your line before 45 seconds run out!</p>
          <div className="mt-3"><ActionButton onClick={start} label="▶ Start the tug" primary /></div>
        </div>
      )}
      {status !== "idle" && (
        <div className="py-2">
          <div className="relative mx-auto h-28 max-w-[440px] rounded-3xl bg-amber-50 ring-1 ring-amber-200">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-4xl">🧑</span>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-4xl">🧑</span>
            <span className="absolute left-[16%] right-[16%] top-1/2 h-2 -translate-y-1/2 rounded bg-amber-700" />
            <span className="absolute top-1/2 h-8 w-1.5 -translate-y-1/2 bg-slate-400" style={{ left: "8%" }} />
            <span className="absolute top-1/2 h-8 w-1.5 -translate-y-1/2 bg-slate-400" style={{ right: "8%" }} />
            <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl transition-all duration-100" style={{ left: `${50 + pos}%` }}>🪢</span>
            <span className="absolute left-1/2 top-2 -translate-x-1/2 text-lg">🚩</span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" onClick={() => pull(-1)} aria-label="Player 1 pull"
              className="flex-1 rounded-2xl bg-blue-600 py-4 text-lg font-extrabold text-white shadow active:scale-95">
              🔵 P1 — TAP! (A)
            </button>
            <button type="button" onClick={() => pull(1)} aria-label="Player 2 pull"
              className="flex-1 rounded-2xl bg-red-500 py-4 text-lg font-extrabold text-white shadow active:scale-95">
              🔴 P2 — TAP! (L)
            </button>
          </div>
          {status === "done" && <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ Tug again" primary /></div>}
        </div>
      )}
    </div>
  );
}

export const GAMES5C: Record<string, ComponentType> = {
  "pong-duel": PongDuelGame,
  "tank-duel": TankDuelGame,
  "duo-dash": DuoDashGame,
  "air-hockey": AirHockeyGame,
  "tug-of-war": TugGame,
};

/* ---------------------------------------------------------------- Tiny Farm */
type FarmPlot = { crop: number; progress: number; watered: boolean } | null;
const FARM_CROPS = [
  { name: "Wheat", emoji: "🌾", seed: 8, sell: 16, grow: 16 },
  { name: "Tomato", emoji: "🍅", seed: 16, sell: 34, grow: 28 },
  { name: "Melon", emoji: "🍈", seed: 30, sell: 68, grow: 44 },
];
const FARM_ANIMALS = [
  { name: "Chicken", emoji: "🐔", cost: 40, product: "🥚 eggs", rate: 6, every: 8 },
  { name: "Cow", emoji: "🐄", cost: 120, product: "🥛 milk", rate: 16, every: 12 },
];
function TinyFarmGame() {
  const [plots, setPlots] = useState<FarmPlot[]>(() => new Array(9).fill(null));
  const [coins, setCoins] = useState(60);
  const [selCrop, setSelCrop] = useState(0);
  const [animals, setAnimals] = useState<number[]>([0, 0]);
  const [goods, setGoods] = useState(0);
  const [day, setDay] = useState(1);
  const [weather, setWeather] = useState<"☀️ Sunny" | "🌧️ Rainy">("☀️ Sunny");
  const [won, setWon] = useState(false);
  const [best, recordBest] = useBest("tiny-farm");
  const tickRef = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      const t = tickRef.current;
      if (t % 40 === 0) {
        setDay((d) => d + 1);
        setWeather(Math.random() < 0.35 ? "🌧️ Rainy" : "☀️ Sunny");
      }
      setPlots((ps) => ps.map((p) => {
        if (!p) return p;
        const crop = FARM_CROPS[p.crop]!;
        const rate = (weather === "🌧️ Rainy" ? 1.5 : 1) * (p.watered ? 1 : 0.55);
        return { ...p, progress: Math.min(1, p.progress + (0.5 * rate) / crop.grow) };
      }));
      setAnimals((owned) => {
        owned.forEach((count, ai) => {
          const a = FARM_ANIMALS[ai]!;
          if (count > 0 && t % (a.every * 2) === 0) setGoods((g) => g + count);
        });
        return owned;
      });
    }, 500);
    return () => clearInterval(id);
  }, [weather]);
  useEffect(() => {
    if (coins >= 400 && !won) { setWon(true); recordBest(coins); beep(700, 0.18, "triangle"); }
  }, [coins, won, recordBest]);
  const tapPlot = (i: number) => {
    const p = plots[i];
    if (!p) {
      const crop = FARM_CROPS[selCrop]!;
      if (coins < crop.seed) { beep(150, 0.09, "sawtooth"); return; }
      setCoins((c) => c - crop.seed);
      setPlots((ps) => ps.map((x, xi) => (xi === i ? { crop: selCrop, progress: 0, watered: weather === "🌧️ Rainy" } : x)));
      beep(520, 0.05);
    } else if (p.progress >= 1) {
      setCoins((c) => c + FARM_CROPS[p.crop]!.sell);
      setPlots((ps) => ps.map((x, xi) => (xi === i ? null : x)));
      beep(880, 0.08);
    } else if (!p.watered) {
      setPlots((ps) => ps.map((x, xi) => (xi === i ? { ...x!, watered: true } : x)));
      beep(600, 0.05);
    }
  };
  const buyAnimal = (ai: number) => {
    const a = FARM_ANIMALS[ai]!;
    if (coins < a.cost) { beep(150, 0.09, "sawtooth"); return; }
    setCoins((c) => c - a.cost);
    setAnimals((owned) => owned.map((n, i) => (i === ai ? n + 1 : n)));
    beep(700, 0.07);
  };
  const sellGoods = () => {
    if (goods <= 0) return;
    setCoins((c) => c + goods * 7);
    setGoods(0);
    beep(820, 0.07);
  };
  const start = () => {
    setPlots(new Array(9).fill(null)); setCoins(60); setAnimals([0, 0]); setGoods(0); setDay(1); setWon(false);
    tickRef.current = 0;
  };
  return (
    <div>
      <ScoreBar items={[["Coins", `🪙 ${coins}`], ["Goal", "🪙 400"], ["Day", day], ["Weather", weather], ["Goods", `📦 ${goods}`], ["Best", best]]} />
      {won && <Banner tone="win">🏆 Farm tycoon! Your little farm is worth 400 coins — time to buy the big red barn!</Banner>}
      <div className="mb-2 flex flex-wrap justify-center gap-2" aria-label="Seed shop">
        {FARM_CROPS.map((c, i) => (
          <button key={c.name} type="button" onClick={() => setSelCrop(i)} aria-pressed={selCrop === i}
            className={`rounded-2xl px-3 py-1.5 text-sm font-bold ring-2 ${selCrop === i ? "bg-green-100 ring-green-500" : "bg-[var(--surface-alt)] ring-transparent"}`}>
            {c.emoji} {c.name} · seed {c.seed} → sell {c.sell}
          </button>
        ))}
      </div>
      <div className="mx-auto grid max-w-[330px] grid-cols-3 gap-2" role="grid" aria-label="Farm plots">
        {plots.map((p, i) => (
          <button key={i} type="button" role="gridcell" onClick={() => tapPlot(i)}
            aria-label={!p ? "Empty plot — tap to sow" : p.progress >= 1 ? `${FARM_CROPS[p.crop]!.name} ready — tap to harvest` : p.watered ? `${FARM_CROPS[p.crop]!.name} growing` : `${FARM_CROPS[p.crop]!.name} thirsty — tap to water`}
            className={`flex aspect-square flex-col items-center justify-center rounded-2xl ${!p ? "bg-amber-900/85" : p.progress >= 1 ? "bg-green-100 ring-2 ring-green-400" : "bg-amber-800/80"}`}>
            {!p ? <span className="text-2xl opacity-60">🟫</span> : (
              <>
                <span className="text-4xl">{p.progress < 0.35 ? "🌱" : p.progress < 1 ? "🌿" : FARM_CROPS[p.crop]!.emoji}</span>
                <span className="mt-1 h-2 w-16 overflow-hidden rounded-full bg-black/25">
                  <span className="block h-full bg-green-400" style={{ width: `${p.progress * 100}%` }} />
                </span>
                <span className="text-[11px] font-bold text-white">{p.progress >= 1 ? "Harvest!" : p.watered ? "Growing…" : "💧 Tap to water"}</span>
              </>
            )}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {FARM_ANIMALS.map((a, ai) => (
          <button key={a.name} type="button" onClick={() => buyAnimal(ai)}
            className="rounded-2xl bg-[var(--surface-alt)] px-3 py-2 text-sm font-bold">
            {a.emoji} {a.name} × {animals[ai]} — buy {a.cost} 🪙<br />
            <span className="text-[var(--dim)]">Makes {a.product} worth {a.rate} 🪙</span>
          </button>
        ))}
        <button type="button" onClick={sellGoods} disabled={goods <= 0}
          className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          Sell goods 📦 {goods} → {goods * 7} 🪙
        </button>
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New farm" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Sow, water (rain does it free), harvest, and invest in animals whose eggs and milk you sell at market. First to 400 coins wins.</p>
    </div>
  );
}

/* ------------------------------------------------------------- City Builder */
type BuildingKind = "house" | "shop" | "park" | "factory" | "power";
const BUILDINGS: Record<BuildingKind, { name: string; emoji: string; cost: number; desc: string }> = {
  house: { name: "House", emoji: "🏠", cost: 40, desc: "+5 residents, needs power" },
  shop: { name: "Shop", emoji: "🏪", cost: 70, desc: "+9 coins/day, needs power" },
  park: { name: "Park", emoji: "🌳", cost: 50, desc: "+9 happiness" },
  factory: { name: "Factory", emoji: "🏭", cost: 100, desc: "+16 coins/day, −5 happiness, needs power" },
  power: { name: "Power Plant", emoji: "⚡", cost: 90, desc: "Powers 5 buildings" },
};
function CityGame() {
  const [cells, setCells] = useState<(BuildingKind | null)[]>(() => new Array(20).fill(null));
  const [money, setMoney] = useState(150);
  const [sel, setSel] = useState<BuildingKind>("house");
  const [demolish, setDemolish] = useState(false);
  const [day, setDay] = useState(1);
  const [won, setWon] = useState(false);
  const [notice, setNotice] = useState("Build houses for residents — but every home needs power and happy streets fill faster!");
  const [best, recordBest] = useBest("city-builder");
  const counts = {
    house: cells.filter((c) => c === "house").length,
    shop: cells.filter((c) => c === "shop").length,
    park: cells.filter((c) => c === "park").length,
    factory: cells.filter((c) => c === "factory").length,
    power: cells.filter((c) => c === "power").length,
  };
  const powerSupply = counts.power * 5;
  const powerDemand = counts.house + counts.shop + counts.factory;
  const powered = powerDemand <= powerSupply;
  const happiness = clamp(50 + counts.park * 9 - counts.factory * 5, 5, 100);
  const population = Math.round(counts.house * 5 * (powered ? 1 : 0.3) * (happiness >= 40 ? 1 : 0.5));
  const income = powered ? counts.shop * 9 + counts.factory * 16 : Math.floor((counts.shop * 9 + counts.factory * 16) / 3);
  useEffect(() => {
    const id = setInterval(() => {
      setDay((d) => d + 1);
      setMoney((m) => m + income);
      if (!powered && powerDemand > 0) setNotice("⚠️ Brownouts! Buildings need more power plants — income is cut to a third.");
    }, 2600);
    return () => clearInterval(id);
  }, [income, powered, powerDemand]);
  useEffect(() => {
    if (population >= 100 && !won) { setWon(true); recordBest(population); beep(700, 0.18, "triangle"); }
  }, [population, won, recordBest]);
  const tapCell = (i: number) => {
    if (won) return;
    const existing = cells[i];
    if (demolish) {
      if (!existing) return;
      setMoney((m) => m + Math.floor(BUILDINGS[existing].cost / 2));
      setCells((cs) => cs.map((c, ci) => (ci === i ? null : c)));
      beep(300, 0.06);
      return;
    }
    if (existing) return;
    const b = BUILDINGS[sel];
    if (money < b.cost) { beep(150, 0.09, "sawtooth"); setNotice(`Not enough coins for a ${b.name} (needs ${b.cost}).`); return; }
    setMoney((m) => m - b.cost);
    setCells((cs) => cs.map((c, ci) => (ci === i ? sel : c)));
    beep(600, 0.05);
  };
  const start = () => {
    setCells(new Array(20).fill(null)); setMoney(150); setDay(1); setWon(false); setDemolish(false);
    setNotice("Build houses for residents — but every home needs power and happy streets fill faster!");
  };
  return (
    <div>
      <ScoreBar items={[["Coins", `🪙 ${money}`], ["Population", `${population}/100`], ["Happiness", `${happiness}%`], ["Power", `${powerSupply - powerDemand >= 0 ? "+" : ""}${powerSupply - powerDemand}`], ["Income/day", `+${income}`], ["Day", day], ["Best pop.", best]]} />
      {won && <Banner tone="win">🏆 A city of 100 residents! From empty plots to a thriving little metropolis — Mayor, take a bow.</Banner>}
      <p className="mb-2 text-center text-sm font-semibold">{notice}</p>
      <div className="mb-2 flex flex-wrap justify-center gap-1.5" aria-label="Building palette">
        {(Object.keys(BUILDINGS) as BuildingKind[]).map((k) => (
          <button key={k} type="button" onClick={() => { setSel(k); setDemolish(false); }} aria-pressed={sel === k && !demolish}
            className={`rounded-xl px-2.5 py-1.5 text-sm font-bold ring-2 ${sel === k && !demolish ? "bg-sky-100 ring-sky-500" : "bg-[var(--surface-alt)] ring-transparent"}`}>
            {BUILDINGS[k].emoji} {BUILDINGS[k].name} · {BUILDINGS[k].cost}
          </button>
        ))}
        <button type="button" onClick={() => setDemolish((d) => !d)} aria-pressed={demolish}
          className={`rounded-xl px-2.5 py-1.5 text-sm font-bold ring-2 ${demolish ? "bg-red-100 ring-red-400" : "bg-[var(--surface-alt)] ring-transparent"}`}>
          🧨 Demolish (50% refund)
        </button>
      </div>
      <p className="mb-2 text-center text-xs text-[var(--dim)]">{BUILDINGS[sel].desc}</p>
      <div className="mx-auto grid max-w-[380px] grid-cols-5 gap-1.5" role="grid" aria-label="City grid">
        {cells.map((c, i) => (
          <button key={i} type="button" role="gridcell" onClick={() => tapCell(i)}
            aria-label={c ? `${BUILDINGS[c].name} plot` : "Empty plot"}
            className={`flex aspect-square items-center justify-center rounded-xl text-3xl ${c ? "bg-sky-50 ring-1 ring-sky-200" : "bg-green-100 hover:bg-green-200"}`}>
            {c ? BUILDINGS[c].emoji : "·"}
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New city" /></div>
    </div>
  );
}

/* ----------------------------------------------------------- Lemonade Stand */
const WEATHERS = [
  { name: "☀️ Sunny", base: 55 },
  { name: "🔥 Heatwave", base: 85 },
  { name: "⛅ Cloudy", base: 38 },
  { name: "🌧️ Rainy", base: 16 },
];
function LemonadeGame() {
  const [day, setDay] = useState(1);
  const [cash, setCash] = useState(20);
  const [weather, setWeather] = useState(() => WEATHERS[randi(0, 3)]!);
  const [price, setPrice] = useState(50);
  const [cups, setCups] = useState(30);
  const [ads, setAds] = useState(false);
  const [report, setReport] = useState("Day 1: set your price and brew count, then open the stand!");
  const [done, setDone] = useState<"win" | "lose" | null>(null);
  const [best, recordBest] = useBest("lemonade-stand");
  useEffect(() => { if (done === "win") recordBest(Math.round(cash * 10)); }, [done, cash, recordBest]);
  const openStand = () => {
    if (done) return;
    const brewCost = cups * 0.08 + (ads ? 3 : 0);
    if (brewCost > cash) {
      setReport(`You can't afford that plan — brewing ${cups} cups${ads ? " plus flyers" : ""} costs $${brewCost.toFixed(2)} and you have $${cash.toFixed(2)}.`);
      beep(150, 0.1, "sawtooth");
      return;
    }
    const priceFactor = price <= 30 ? 1.35 : price <= 50 ? 1.05 : price <= 75 ? 0.72 : 0.42;
    const demand = Math.round(weather.base * priceFactor * (ads ? 1.3 : 1) * rand(0.85, 1.15));
    const sold = Math.min(cups, demand);
    const revenue = sold * (price / 100);
    const profit = revenue - brewCost;
    const newCash = cash + profit;
    setCash(newCash);
    beep(profit >= 0 ? 720 : 180, 0.1, profit >= 0 ? "triangle" : "sawtooth");
    if (newCash < 0.5 && day >= 10) { setDone(newCash >= 50 ? "win" : "lose"); }
    if (day >= 10) {
      setDone(newCash >= 50 ? "win" : "lose");
      setReport(`Final day! Sold ${sold} of ${cups} cups for $${revenue.toFixed(2)} (profit ${profit >= 0 ? "+" : ""}$${profit.toFixed(2)}). ${newCash >= 50 ? "🏆 You beat the $50 goal!" : "The stand closes under the $50 goal."}`);
      return;
    }
    setReport(`Day ${day} done: ${weather.name} brought ${demand} thirsty customers; you sold ${sold} of ${cups} cups. Profit ${profit >= 0 ? "+" : ""}$${profit.toFixed(2)}.`);
    setDay((d) => d + 1);
    setWeather(WEATHERS[randi(0, 3)]!);
  };
  const start = () => {
    setDay(1); setCash(20); setWeather(WEATHERS[randi(0, 3)]!);
    setPrice(50); setCups(30); setAds(false); setDone(null);
    setReport("Day 1: set your price and brew count, then open the stand!");
  };
  const score = Math.round(cash * 10);
  return (
    <div>
      <ScoreBar items={[["Day", `${day}/10`], ["Cash", `$${cash.toFixed(2)}`], ["Goal", "$50"], ["Score", score], ["Best", best]]} />
      {done === "win" && <Banner tone="win">🏆 Lemonade legend! You turned $20 into ${cash.toFixed(2)} in ten days.</Banner>}
      {done === "lose" && <Banner tone="lose">Ten days up with ${cash.toFixed(2)} — the stand folds. Watch the weather and don't overbrew!</Banner>}
      <div className="rounded-3xl bg-yellow-50 p-4 ring-1 ring-yellow-200">
        <p className="text-center text-lg font-extrabold">Today's weather: {weather.name}</p>
        <p className="mt-1 text-center font-semibold">{report}</p>
        {!done && (
          <div className="mx-auto mt-3 grid max-w-[420px] gap-3">
            <label className="block">
              <span className="font-bold">Price per cup: {price}¢</span>
              <input type="range" min={10} max={100} step={5} value={price} onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full" aria-label="Price per cup in cents" />
              <span className="flex justify-between text-xs text-[var(--dim)]"><span>10¢ (crowds!)</span><span>$1.00 (premium)</span></span>
            </label>
            <label className="block">
              <span className="font-bold">Cups to brew: {cups} (costs ${(cups * 0.08).toFixed(2)})</span>
              <input type="range" min={0} max={100} step={5} value={cups} onChange={(e) => setCups(Number(e.target.value))}
                className="w-full" aria-label="Cups to brew" />
            </label>
            <label className="flex cursor-pointer items-center gap-2 font-semibold">
              <input type="checkbox" className="h-5 w-5" checked={ads} onChange={(e) => setAds(e.target.checked)} />
              📣 Print flyers (+30% customers, $3.00)
            </label>
            <button type="button" onClick={openStand} className="rounded-full bg-[var(--accent)] py-3 font-extrabold text-white shadow hover:brightness-110">
              🍋 Open the stand for day {day}!
            </button>
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New season" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Hot days thirst for more lemonade; rain empties the street. Unsold cups are poured away, so brew close to demand.</p>
    </div>
  );
}

/* ---------------------------------------------------------- Aquarium Keeper */
type Fish = { species: number; hunger: number; x: number; y: number; dir: number };
const FISH_SPECIES = [
  { name: "Guppy", emoji: "🐟", cost: 15 },
  { name: "Goldfish", emoji: "🐠", cost: 30 },
  { name: "Angelfish", emoji: "🐡", cost: 60 },
];
function AquariumGame() {
  const [fish, setFish] = useState<Fish[]>([{ species: 0, hunger: 20, x: 20, y: 40, dir: 1 }]);
  const [coins, setCoins] = useState(50);
  const [dirt, setDirt] = useState(10);
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const [notice, setNotice] = useState("Happy fish draw paying visitors. Feed them, keep the water clean!");
  const [best, recordBest] = useBest("aquarium-keeper");
  useEffect(() => {
    const id = setInterval(() => {
      setFish((fs) => fs.map((f) => ({
        ...f,
        hunger: Math.min(110, f.hunger + 1.6),
        x: clamp(f.x + f.dir * rand(0.4, 1.4), 4, 92),
        dir: Math.random() < 0.02 ? (f.dir === 1 ? -1 : 1) : f.dir,
        y: clamp(f.y + rand(-1.2, 1.2), 12, 80),
      })));
      setDirt((d) => Math.min(100, d + 0.55));
      setFish((fs) => {
        const happy = fs.filter((f) => f.hunger < 70).length;
        if (happy > 0 && dirtRef.current < 70) setCoins((c) => c + happy);
        return fs;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const dirtRef = useRef(dirt);
  dirtRef.current = dirt;
  useEffect(() => {
    setFish((fs) => {
      const survivors = fs.filter((f) => f.hunger < 110);
      if (survivors.length < fs.length) setNotice("A hungry fish was rehomed to a bigger tank. Feed on time!");
      return survivors;
    });
  }, [fish.length]);
  useEffect(() => {
    if (fish.length === 0 && coins < 15 && !won) setLost(true);
    if (coins >= 250 && !won) { setWon(true); recordBest(coins); beep(700, 0.18, "triangle"); }
  }, [fish.length, coins, won, recordBest]);
  const feed = () => {
    if (coins < 5 || fish.length === 0) { beep(150, 0.09, "sawtooth"); return; }
    setCoins((c) => c - 5);
    setFish((fs) => fs.map((f) => ({ ...f, hunger: Math.max(0, f.hunger - 45) })));
    beep(640, 0.06);
  };
  const clean = () => {
    if (coins < 8) { beep(150, 0.09, "sawtooth"); return; }
    setCoins((c) => c - 8);
    setDirt(4);
    beep(700, 0.06);
  };
  const buyFish = (si: number) => {
    const sp = FISH_SPECIES[si]!;
    if (coins < sp.cost) { beep(150, 0.09, "sawtooth"); return; }
    setCoins((c) => c - sp.cost);
    setFish((fs) => [...fs, { species: si, hunger: 15, x: rand(10, 85), y: rand(20, 70), dir: Math.random() < 0.5 ? 1 : -1 }]);
    beep(760, 0.06);
  };
  const start = () => {
    setFish([{ species: 0, hunger: 20, x: 20, y: 40, dir: 1 }]);
    setCoins(50); setDirt(10); setWon(false); setLost(false);
    setNotice("Happy fish draw paying visitors. Feed them, keep the water clean!");
  };
  return (
    <div>
      <ScoreBar items={[["Coins", `🪙 ${coins}`], ["Goal", "🪙 250"], ["Fish", fish.length], ["Water dirt", `${Math.round(dirt)}%`], ["Best", best]]} />
      {won && <Banner tone="win">🏆 A beloved aquarium worth 250 coins — the fish throw you a bubble parade!</Banner>}
      {lost && <Banner tone="lose">No fish and no coins for a guppy — the aquarium closes. Keep hunger down next time!</Banner>}
      <p className="mb-2 text-center text-sm font-semibold">{notice}</p>
      <div className="relative mx-auto h-52 max-w-[440px] overflow-hidden rounded-3xl ring-1 ring-sky-300"
        style={{ background: `linear-gradient(180deg, rgba(56,189,248,${0.55 - dirt * 0.003}) 0%, rgba(2,132,199,${0.75 - dirt * 0.002}) 100%)` }}
        aria-label="Aquarium tank">
        {fish.map((f, i) => (
          <span key={i} className="absolute text-3xl transition-all duration-1000"
            style={{ left: `${f.x}%`, top: `${f.y}%`, transform: `scaleX(${f.dir})` }}>
            {FISH_SPECIES[f.species]!.emoji}
            {f.hunger > 70 && <span className="absolute -top-4 left-1 text-sm">🍽️</span>}
          </span>
        ))}
        {fish.length === 0 && <p className="absolute inset-0 flex items-center justify-center font-bold text-white">The tank is empty…</p>}
        <span className="absolute bottom-1 left-3 text-xl">🪸</span>
        <span className="absolute bottom-1 right-4 text-xl">🐚</span>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={feed} className="rounded-full bg-[var(--surface-alt)] px-4 py-2 text-sm font-bold">🍽️ Feed all (5 🪙)</button>
        <button type="button" onClick={clean} className="rounded-full bg-[var(--surface-alt)] px-4 py-2 text-sm font-bold">🧽 Clean tank (8 🪙)</button>
        {FISH_SPECIES.map((sp, si) => (
          <button key={sp.name} type="button" onClick={() => buyFish(si)} className="rounded-full bg-[var(--surface-alt)] px-4 py-2 text-sm font-bold">
            {sp.emoji} Buy {sp.name} ({sp.cost} 🪙)
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New aquarium" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Visitors pay 1 coin per happy fish each second. Fish get hungry, dirt clouds the water, and a starving fish is rehomed. Reach 250 coins.</p>
    </div>
  );
}

/* ------------------------------------------------------------- Café Manager */
const CAFE_MENU = [
  { name: "Coffee", emoji: "☕", price: 4 },
  { name: "Cake", emoji: "🍰", price: 5 },
  { name: "Croissant", emoji: "🥐", price: 4 },
  { name: "Cupcake", emoji: "🧁", price: 5 },
  { name: "Juice", emoji: "🥤", price: 3 },
];
type Customer = { id: number; order: number[]; patience: number; max: number };
let custId = 1;
function CafeGame() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tray, setTray] = useState<number[]>([]);
  const [coins, setCoins] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [time, setTime] = useState(90);
  const [status, setStatus] = useState<"idle" | "play" | "win" | "lose">("idle");
  const [best, recordBest] = useBest("cafe-manager");
  const spawnRef = useRef(0.5);
  useEffect(() => {
    if (status !== "play") return;
    const id = setInterval(() => {
      setTime((t) => {
        if (t <= 0.25) {
          setStatus(coins >= 120 ? "win" : "lose");
          recordBest(coins);
          return 0;
        }
        return t - 0.25;
      });
      spawnRef.current -= 0.25;
      setCustomers((cs) => {
        let next = cs.map((c) => ({ ...c, patience: c.patience - 0.25 }));
        const walked = next.filter((c) => c.patience <= 0);
        if (walked.length) {
          setHearts((h) => {
            const nh = h - walked.length;
            if (nh <= 0) { setStatus("lose"); recordBest(coins); }
            return nh;
          });
          beep(130, 0.16, "sawtooth");
          next = next.filter((c) => c.patience > 0);
        }
        if (spawnRef.current <= 0 && next.length < 3) {
          spawnRef.current = rand(2.6, 4.6);
          const items = Array.from({ length: randi(1, 3) }, () => randi(0, CAFE_MENU.length - 1));
          const max = rand(11, 16);
          next = [...next, { id: custId++, order: items, patience: max, max }];
        }
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [status, coins, recordBest]);
  const addToTray = (mi: number) => {
    if (status !== "play") return;
    setTray((t) => [...t, mi]);
    beep(560, 0.04);
  };
  const serve = () => {
    const target = customers[0];
    if (!target || tray.length === 0) return;
    const want = [...target.order].sort().join(",");
    const got = [...tray].sort().join(",");
    if (want === got) {
      const base = target.order.reduce((a, mi) => a + CAFE_MENU[mi]!.price, 0);
      const tip = target.patience / target.max > 0.6 ? 4 : target.patience / target.max > 0.3 ? 2 : 0;
      setCoins((c) => c + base + tip);
      setCustomers((cs) => cs.slice(1));
      setTray([]);
      beep(780, 0.1, "triangle");
      if (coins + base + tip >= 120) { setStatus("win"); recordBest(coins + base + tip); }
    } else {
      setTray([]);
      beep(160, 0.12, "sawtooth");
    }
  };
  const start = () => {
    setCustomers([]); setTray([]); setCoins(0); setHearts(3); setTime(90); setStatus("play");
    spawnRef.current = 0.4;
  };
  return (
    <div>
      <ScoreBar items={[["Coins", `🪙 ${coins}`], ["Goal", "🪙 120"], ["Time", status === "play" ? `${Math.ceil(time)}s` : "—"], ["Walk-aways", `${3 - hearts}/3`], ["Best", best]]} />
      {status === "win" && <Banner tone="win">🏆 Café goal smashed — {coins} coins before closing! The regulars applaud.</Banner>}
      {status === "lose" && <Banner tone="lose">{hearts <= 0 ? "Three customers walked away — the café closes early." : `Closing time with ${coins} coins — short of the 120 goal.`} Best today: {coins}.</Banner>}
      {status === "idle" && (
        <div className="py-4 text-center">
          <p className="mx-auto max-w-md font-semibold">Customers order from the menu — tap items to build the front customer's order on your tray, then serve it. Fast service earns tips; three walk-aways close the café.</p>
          <div className="mt-3"><ActionButton onClick={start} label="▶ Open the café" primary /></div>
        </div>
      )}
      {status !== "idle" && (
        <div>
          <div className="flex flex-wrap gap-2" aria-label="Waiting customers">
            {customers.map((c, ci) => (
              <div key={c.id} className={`min-w-[128px] flex-1 rounded-2xl p-2.5 ring-2 ${ci === 0 ? "bg-amber-50 ring-amber-400" : "bg-[var(--surface-alt)] ring-transparent"}`}>
                <p className="text-2xl">🧑 {ci === 0 && <span className="text-xs font-extrabold text-amber-600">NEXT</span>}</p>
                <p className="text-xl">{c.order.map((mi) => CAFE_MENU[mi]!.emoji).join(" ")}</p>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full ${c.patience / c.max < 0.3 ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${(c.patience / c.max) * 100}%` }} />
                </div>
              </div>
            ))}
            {customers.length === 0 && <p className="font-semibold text-[var(--dim)]">No customers right now — breathe!</p>}
          </div>
          <p className="mt-3 font-bold">Your tray: {tray.length ? tray.map((mi) => CAFE_MENU[mi]!.emoji).join(" ") : "empty"}</p>
          <div className="mt-1.5 flex flex-wrap gap-2" aria-label="Menu">
            {CAFE_MENU.map((m, mi) => (
              <button key={m.name} type="button" onClick={() => addToTray(mi)}
                className="rounded-2xl bg-[var(--surface-alt)] px-3 py-2 font-bold">
                {m.emoji} {m.name} · {m.price}🪙
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={serve} disabled={!customers[0] || tray.length === 0}
              className="rounded-full bg-[var(--accent)] px-5 py-2.5 font-extrabold text-white disabled:opacity-40">
              🔔 Serve front customer
            </button>
            <button type="button" onClick={() => setTray([])} className="rounded-full bg-[var(--surface-alt)] px-4 py-2.5 font-bold">
              🗑️ Clear tray
            </button>
          </div>
          {(status === "win" || status === "lose") && <div className="mt-3"><ActionButton onClick={start} label="↻ New day" primary /></div>}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- Airport Control */
type Plane = { id: number; fuel: number; max: number; name: string };
let planeId = 1;
function AirportGame() {
  const [planes, setPlanes] = useState<Plane[]>([]);
  const [runways, setRunways] = useState<(number | null)[]>([null, null]);
  const [selected, setSelected] = useState<number | null>(null);
  const [landed, setLanded] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [status, setStatus] = useState<"idle" | "play" | "win" | "lose">("idle");
  const [best, recordBest] = useBest("airport-control");
  const spawnRef = useRef(1);
  useEffect(() => {
    if (status !== "play") return;
    const id = setInterval(() => {
      spawnRef.current -= 0.5;
      setPlanes((ps) => {
        let next = ps.map((p) => ({ ...p, fuel: p.fuel - 0.5 }));
        const crashed = next.filter((p) => p.fuel <= 0);
        if (crashed.length) {
          setHearts((h) => {
            const nh = h - crashed.length;
            if (nh <= 0) { setStatus("lose"); recordBest(landed * 40); }
            return nh;
          });
          beep(90, 0.3, "sawtooth");
          next = next.filter((p) => p.fuel > 0);
        }
        if (spawnRef.current <= 0 && next.length < 5) {
          spawnRef.current = rand(4.5, 7.5);
          const max = randi(26, 44);
          next = [...next, { id: planeId++, fuel: max, max, name: `Flight ${randi(100, 999)}` }];
        }
        return next;
      });
      setRunways((rs) => rs.map((r) => (r === null ? null : r - 0.5 <= 0 ? null : r - 0.5)));
    }, 500);
    return () => clearInterval(id);
  }, [status, landed, recordBest]);
  const assign = (ri: number) => {
    if (selected === null || runways[ri] !== null) return;
    setPlanes((ps) => ps.filter((p) => p.id !== selected));
    setRunways((rs) => rs.map((r, i) => (i === ri ? 5 : r)));
    const nl = landed + 1;
    setLanded(nl);
    setSelected(null);
    beep(700, 0.1, "triangle");
    if (nl >= 12) { setStatus("win"); recordBest(nl * 40); }
  };
  const start = () => {
    setPlanes([]); setRunways([null, null]); setSelected(null);
    setLanded(0); setHearts(3); setStatus("play");
    spawnRef.current = 0.6;
  };
  const score = landed * 40;
  return (
    <div>
      <ScoreBar items={[["Landed", `${landed}/12`], ["Score", score], ["Incidents", `${3 - hearts}/3`], ["Best", best]]} />
      {status === "win" && <Banner tone="win">🏆 Twelve safe landings — the tower throws you a party! Score {score}.</Banner>}
      {status === "lose" && <Banner tone="lose">Three fuel emergencies — the airport is closed for review. Score {score}.</Banner>}
      {status === "idle" && (
        <div className="py-4 text-center">
          <p className="mx-auto max-w-md font-semibold">Planes circle with burning fuel. Select a flight, then tap a free runway to bring it down. A runway stays busy for 5 seconds per landing — and an empty tank is an emergency.</p>
          <div className="mt-3"><ActionButton onClick={start} label="▶ Take the tower" primary /></div>
        </div>
      )}
      {status !== "idle" && (
        <div>
          <p className="mb-1.5 font-extrabold">🛬 Incoming flights — tap one to select it</p>
          <div className="flex flex-wrap gap-2">
            {planes.map((p) => (
              <button key={p.id} type="button" onClick={() => setSelected(p.id)} aria-pressed={selected === p.id}
                className={`min-w-[118px] rounded-2xl p-2.5 text-left ring-2 ${selected === p.id ? "bg-sky-100 ring-sky-500" : "bg-[var(--surface-alt)] ring-transparent"}`}>
                <span className="block font-extrabold">✈️ {p.name}</span>
                <span className="mt-1 block h-2 overflow-hidden rounded-full bg-slate-300">
                  <span className={`block h-full ${p.fuel / p.max < 0.3 ? "bg-red-500" : "bg-sky-500"}`} style={{ width: `${(p.fuel / p.max) * 100}%` }} />
                </span>
                <span className="text-xs font-bold text-[var(--dim)]">Fuel {Math.ceil(p.fuel)}s</span>
              </button>
            ))}
            {planes.length === 0 && <p className="font-semibold text-[var(--dim)]">Skies are clear… for now.</p>}
          </div>
          <p className="mb-1.5 mt-4 font-extrabold">Runways</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {runways.map((r, ri) => (
              <button key={ri} type="button" onClick={() => assign(ri)} disabled={r !== null || selected === null}
                className={`rounded-2xl py-4 font-extrabold ${r !== null ? "bg-slate-300 text-slate-500" : selected !== null ? "bg-green-500 text-white hover:bg-green-400" : "bg-[var(--surface-alt)]"}`}>
                {r !== null ? `🛬 Runway ${ri + 1} busy (${Math.ceil(r)}s)` : `Runway ${ri + 1} — ${selected !== null ? "tap to land selected flight" : "free"}`}
              </button>
            ))}
          </div>
          {(status === "win" || status === "lose") && <div className="mt-3"><ActionButton onClick={start} label="↻ New shift" primary /></div>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Train Master */
type TrainState = {
  score: number; over?: boolean; won?: boolean;
  hearts: number; delivered: number;
  trains: { x: number; track: number; color: number; id: number }[];
  sw1: boolean; sw2: boolean;
  spawnT: number;
};
const TRAIN_COLORS = ["#ef4444", "#3b82f6", "#22c55e"];
const TRAIN_EMOJI = ["🔴", "🔵", "🟢"];
let trainId = 1;
function TrainGame() {
  return (
    <Engine<TrainState>
      id="train-master" label="Train Station Master"
      blurb="Trains roll in on three tracks — flip the two junctions to route each train to the station of its color. Wrong platform or a crash costs a heart!"
      create={() => ({ score: 0, hearts: 3, delivered: 0, trains: [], sw1: false, sw2: false, spawnT: 0.6 })}
      hud={(s) => [["Delivered", `${s.delivered}/10`], ["Hearts", "❤️".repeat(Math.max(0, s.hearts)) || "—"], ["Score", s.score], ["Junction A", s.sw1 ? "Swap ↕" : "Straight"], ["Junction B", s.sw2 ? "Swap ↕" : "Straight"]]}
      onTap={(s, x, y, api) => {
        if (Math.abs(x - 190) < 34 && Math.abs(y - 120) < 52) { s.sw1 = !s.sw1; api.beep(600, 0.05); }
        if (Math.abs(x - 320) < 34 && Math.abs(y - 190) < 52) { s.sw2 = !s.sw2; api.beep(600, 0.05); }
      }}
      onKey={(s, key, api) => {
        if (key === "a" || key === "A" || key === "1") { s.sw1 = !s.sw1; api.beep(600, 0.05); }
        if (key === "b" || key === "B" || key === "2") { s.sw2 = !s.sw2; api.beep(600, 0.05); }
      }}
      step={(s, dt, _input, api) => {
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = rand(2.2, 3.4);
          const track = randi(0, 2);
          if (!s.trains.some((t) => t.track === track && t.x < 60)) {
            s.trains.push({ x: -24, track, color: randi(0, 2), id: trainId++ });
          }
        }
        for (const t of s.trains) {
          const prevX = t.x;
          t.x += 62 * dt;
          // Junction A at x=190 swaps tracks 0<->1.
          if (prevX < 190 && t.x >= 190 && s.sw1 && t.track < 2) {
            t.track = t.track === 0 ? 1 : 0;
          }
          // Junction B at x=320 swaps tracks 1<->2.
          if (prevX < 320 && t.x >= 320 && s.sw2 && t.track > 0) {
            t.track = t.track === 1 ? 2 : 1;
          }
          // Collision: same track, overlapping.
          for (const o of s.trains) {
            if (o.id !== t.id && o.track === t.track && Math.abs(o.x - t.x) < 30 && t.x > 0) {
              t.x = -9999; o.x = -9999;
              s.hearts -= 1;
              api.beep(90, 0.3, "sawtooth");
              if (s.hearts <= 0) { api.end(false); return; }
            }
          }
          if (t.x >= 452) {
            if (t.track === t.color) {
              s.delivered += 1;
              s.score += 30;
              api.beep(720, 0.09, "triangle");
              if (s.delivered >= 10) { api.end(true); return; }
            } else {
              s.hearts -= 1;
              api.beep(120, 0.22, "sawtooth");
              if (s.hearts <= 0) { api.end(false); return; }
            }
            t.x = -9999;
          }
        }
        s.trains = s.trains.filter((t) => t.x > -9000);
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#e7e5e4"; ctx.fillRect(0, 0, W, H);
        const trackY = [70, 150, 230];
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = "#78716c"; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(0, trackY[i]! - 6); ctx.lineTo(W, trackY[i]! - 6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, trackY[i]! + 8); ctx.lineTo(W, trackY[i]! + 8); ctx.stroke();
          ctx.fillStyle = TRAIN_COLORS[i]!;
          ctx.fillRect(448, trackY[i]! - 22, 32, 48);
          ctx.font = "20px serif"; ctx.textAlign = "center";
          ctx.fillText("🚉", 464, trackY[i]! + 7);
        }
        // Junctions
        const drawSwitch = (x: number, y: number, on: boolean, label: string) => {
          ctx.fillStyle = on ? "#f59e0b" : "#a8a29e";
          ctx.beginPath(); ctx.arc(x, y, 17, 0, 7); ctx.fill();
          ctx.fillStyle = "#111827"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "center";
          ctx.fillText(on ? "⇅" : "➡", x, y + 4);
          ctx.font = "bold 10px system-ui";
          ctx.fillText(label, x, y + 30);
        };
        drawSwitch(190, 110, s.sw1, "A (key 1)");
        drawSwitch(320, 190, s.sw2, "B (key 2)");
        ctx.font = "30px serif";
        for (const t of s.trains) {
          ctx.fillText("🚂", t.x, trackY[t.track]! + 10);
          ctx.font = "15px serif";
          ctx.fillText(TRAIN_EMOJI[t.color]!, t.x, trackY[t.track]! - 16);
          ctx.font = "30px serif";
        }
        ctx.fillStyle = "rgba(15,23,42,0.7)"; ctx.fillRect(60, 322, 360, 24);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui";
        ctx.fillText("Tap junction A/B (or keys 1/2) to swap tracks", W / 2, 338);
        ctx.textAlign = "left";
      }}
    />
  );
}

export const GAMES5D: Record<string, ComponentType> = {
  "tiny-farm": TinyFarmGame,
  "city-builder": CityGame,
  "lemonade-stand": LemonadeGame,
  "aquarium-keeper": AquariumGame,
  "cafe-manager": CafeGame,
  "airport-control": AirportGame,
  "train-master": TrainGame,
};
