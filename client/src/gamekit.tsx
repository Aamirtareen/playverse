// Shared kit for the PlayVerse expansion games: a canvas engine shell with
// start / pause / restart / game-over flow, persistent best scores and tiny
// WebAudio sound effects, plus the DOM helpers used by grid/board games.
// Every game built on this kit gets the full control set the catalog
// promises: start button, pause/resume, restart, game-over screen, sound
// toggle and a locally stored high score.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export const W = 480;
export const H = 360;

/* ------------------------------------------------------------------ sound */
let audioCtx: AudioContext | null = null;
// This read runs while the bundle is still evaluating, before React mounts.
// Merely touching localStorage throws a SecurityError in storage-blocked
// contexts (sandboxed/opaque-origin iframes, strict privacy modes), which
// aborted the whole module graph and left the app on a permanent blank
// white panel. It must never throw: default to sound on when storage is
// unreachable.
let soundEnabled = (() => {
  try {
    return localStorage.getItem("pv-sound") !== "off";
  } catch {
    return true;
  }
})();

export function isSoundOn(): boolean {
  return soundEnabled;
}
export function setSoundOn(on: boolean) {
  soundEnabled = on;
  try {
    localStorage.setItem("pv-sound", on ? "on" : "off");
  } catch {
    /* storage unavailable */
  }
}
export function beep(freq = 440, dur = 0.07, type: OscillatorType = "square", vol = 0.05) {
  if (!soundEnabled) return;
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch {
    /* audio unavailable */
  }
}

/* ------------------------------------------------------------------ hooks */
export function useKeys(handler: (key: string) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      ref.current(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function useBest(id: string): [number, (score: number) => void] {
  const key = `pv-best-${id}`;
  const [best, setBest] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(key) ?? 0) || 0;
    } catch {
      return 0;
    }
  });
  const record = useCallback(
    (score: number) => {
      setBest((b) => {
        const next = Math.max(b, score);
        try {
          localStorage.setItem(key, String(next));
        } catch {
          /* storage unavailable */
        }
        return next;
      });
    },
    [key],
  );
  return [best, record];
}

/* ------------------------------------------------------------- DOM pieces */
export function ScoreBar({ items }: { items: [string, string | number][] }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {items.map(([k, v]) => (
        <span key={k} className="rounded-full bg-[var(--surface-alt)] px-3 py-1 text-sm font-bold">
          {k}: <span className="text-[var(--accent)]">{v}</span>
        </span>
      ))}
    </div>
  );
}

export function ActionButton({ onClick, label, primary = false }: { onClick: () => void; label: string; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-bold shadow hover:brightness-110 ${
        primary ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-alt)] text-[var(--text)]"
      }`}
    >
      {label}
    </button>
  );
}

export function DPad({ onDir }: { onDir: (dx: number, dy: number) => void }) {
  const btn =
    "flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-alt)] text-lg font-bold active:bg-[var(--accent)] active:text-white";
  return (
    <div className="mx-auto mt-3 grid w-36 grid-cols-3 gap-1 sm:hidden" aria-label="Direction pad">
      <span />
      <button type="button" aria-label="Move up" className={btn} onClick={() => onDir(0, -1)}>▲</button>
      <span />
      <button type="button" aria-label="Move left" className={btn} onClick={() => onDir(-1, 0)}>◀</button>
      <span />
      <button type="button" aria-label="Move right" className={btn} onClick={() => onDir(1, 0)}>▶</button>
      <span />
      <button type="button" aria-label="Move down" className={btn} onClick={() => onDir(0, 1)}>▼</button>
      <span />
    </div>
  );
}

export function Banner({ tone, children }: { tone: "win" | "lose" | "info"; children: ReactNode }) {
  const cls =
    tone === "win"
      ? "bg-green-100 text-green-800"
      : tone === "lose"
        ? "bg-red-100 text-red-800"
        : "bg-blue-100 text-blue-800";
  return <p className={`pv-pop mb-2 rounded-xl px-4 py-2 text-center font-bold ${cls}`}>{children}</p>;
}

/* --------------------------------------------------------- canvas engine */
export type Phase = "ready" | "playing" | "paused" | "over";

export interface EngineInput {
  keys: Set<string>;
  px: number;
  py: number;
  pdown: boolean;
}

export interface EngineApi {
  beep: typeof beep;
  end: (won?: boolean) => void;
}

export interface EngineState {
  score: number;
  over?: boolean;
  won?: boolean;
}

export function Engine<S extends EngineState>(props: {
  id: string;
  label: string;
  create: () => S;
  step?: (s: S, dt: number, input: EngineInput, api: EngineApi) => void;
  draw: (ctx: CanvasRenderingContext2D, s: S, phase: Phase) => void;
  hud?: (s: S) => [string, string | number][];
  onKey?: (s: S, key: string, api: EngineApi) => void;
  onTap?: (s: S, x: number, y: number, api: EngineApi) => void;
  onDrag?: (s: S, x: number, y: number, api: EngineApi) => void;
  width?: number;
  height?: number;
  blurb?: string;
}) {
  const width = props.width ?? W;
  const height = props.height ?? H;
  const stateRef = useRef<S | null>(null);
  if (stateRef.current === null) stateRef.current = props.create();
  const [phase, setPhase] = useState<Phase>("ready");
  const phaseRef = useRef<Phase>("ready");
  const [hudItems, setHudItems] = useState<[string, string | number][]>([]);
  const hudSig = useRef("");
  const [sound, setSound] = useState(isSoundOn());
  const [best, recordBest] = useBest(props.id);
  const inputRef = useRef<EngineInput>({ keys: new Set(), px: width / 2, py: height / 2, pdown: false });
  const propsRef = useRef(props);
  propsRef.current = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const apiRef = useRef<EngineApi>({
    beep,
    end: () => undefined,
  });
  apiRef.current.end = (won?: boolean) => {
    const s = stateRef.current;
    if (!s || phaseRef.current !== "playing") return;
    s.over = true;
    if (won !== undefined) s.won = won;
    recordBest(s.score);
    setPhaseBoth("over");
  };

  const start = useCallback(() => {
    stateRef.current = propsRef.current.create();
    hudSig.current = "";
    setHudItems([]);
    setPhaseBoth("playing");
    beep(660, 0.06);
  }, [setPhaseBoth]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "playing") setPhaseBoth("paused");
    else if (phaseRef.current === "paused") setPhaseBoth("playing");
  }, [setPhaseBoth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = propsRef.current;
      const s = stateRef.current;
      if (s) {
        if (phaseRef.current === "playing" && p.step) {
          p.step(s, dt, inputRef.current, apiRef.current);
          if (s.over && phaseRef.current === "playing") {
            recordBest(s.score);
            setPhaseBoth("over");
          }
        }
        p.draw(ctx, s, phaseRef.current);
        if (p.hud) {
          const items = p.hud(s);
          const sig = JSON.stringify(items);
          if (sig !== hudSig.current) {
            hudSig.current = sig;
            setHudItems(items);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [recordBest, setPhaseBoth]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      inputRef.current.keys.add(e.key);
      const s = stateRef.current;
      if (!s) return;
      if ((e.key === "p" || e.key === "P" || e.key === "Escape") && (phaseRef.current === "playing" || phaseRef.current === "paused")) {
        togglePause();
        return;
      }
      if (phaseRef.current === "playing") propsRef.current.onKey?.(s, e.key, apiRef.current);
    };
    const up = (e: KeyboardEvent) => {
      inputRef.current.keys.delete(e.key);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [togglePause]);

  const pointerPos = (e: React.PointerEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * width,
      y: ((e.clientY - rect.top) / rect.height) * height,
    };
  };

  const s = stateRef.current;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {hudItems.map(([k, v]) => (
          <span key={k} className="rounded-full bg-[var(--surface-alt)] px-3 py-1 text-sm font-bold">
            {k}: <span className="text-[var(--accent)]">{v}</span>
          </span>
        ))}
        <span className="rounded-full bg-[var(--surface-alt)] px-3 py-1 text-sm font-bold">
          Best: <span className="text-[var(--accent)]">{best}</span>
        </span>
        <span className="ml-auto flex gap-1.5">
          {phase === "playing" && (
            <button type="button" onClick={togglePause} aria-label="Pause game" className="rounded-full bg-[var(--surface-alt)] px-3 py-1 text-sm font-bold">⏸ Pause</button>
          )}
          {phase === "paused" && (
            <button type="button" onClick={togglePause} aria-label="Resume game" className="rounded-full bg-[var(--accent)] px-3 py-1 text-sm font-bold text-white">▶ Resume</button>
          )}
          {(phase === "playing" || phase === "paused" || phase === "over") && (
            <button type="button" onClick={start} aria-label="Restart game" className="rounded-full bg-[var(--surface-alt)] px-3 py-1 text-sm font-bold">↻ Restart</button>
          )}
          <button
            type="button"
            onClick={() => {
              const next = !sound;
              setSoundOn(next);
              setSound(next);
            }}
            aria-label={sound ? "Mute sound" : "Unmute sound"}
            className="rounded-full bg-[var(--surface-alt)] px-3 py-1 text-sm font-bold"
          >
            {sound ? "🔊" : "🔇"}
          </button>
        </span>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          aria-label={props.label}
          className="block h-auto w-full touch-none rounded-xl bg-slate-900"
          onPointerDown={(e) => {
            const p = pointerPos(e);
            inputRef.current.px = p.x;
            inputRef.current.py = p.y;
            inputRef.current.pdown = true;
            const st = stateRef.current;
            if (st && phaseRef.current === "playing") propsRef.current.onTap?.(st, p.x, p.y, apiRef.current);
          }}
          onPointerMove={(e) => {
            const p = pointerPos(e);
            inputRef.current.px = p.x;
            inputRef.current.py = p.y;
            const st = stateRef.current;
            if (st && phaseRef.current === "playing" && (inputRef.current.pdown || e.pointerType === "mouse")) {
              propsRef.current.onDrag?.(st, p.x, p.y, apiRef.current);
            }
          }}
          onPointerUp={() => {
            inputRef.current.pdown = false;
          }}
          onPointerLeave={() => {
            inputRef.current.pdown = false;
          }}
        />
        {phase === "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/55 px-6 text-center">
            <p className="text-2xl font-extrabold text-white">{props.label}</p>
            {props.blurb && <p className="mt-1 max-w-sm text-sm text-white/85">{props.blurb}</p>}
            <button
              type="button"
              onClick={start}
              aria-label={`Start ${props.label}`}
              className="pv-pop mt-4 rounded-full bg-white px-6 py-3 text-lg font-extrabold text-slate-900 shadow-2xl hover:scale-105"
            >
              ▶ Start Game
            </button>
          </div>
        )}
        {phase === "paused" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/55 px-6 text-center">
            <p className="text-2xl font-extrabold text-white">Paused</p>
            <button
              type="button"
              onClick={togglePause}
              aria-label="Resume game"
              className="mt-4 rounded-full bg-white px-6 py-3 text-lg font-extrabold text-slate-900 shadow-2xl hover:scale-105"
            >
              ▶ Resume
            </button>
          </div>
        )}
        {phase === "over" && s && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/60 px-6 text-center">
            <p className="text-3xl font-extrabold text-white">{s.won ? "🏆 You Win!" : "Game Over"}</p>
            <p className="mt-1 font-bold text-white/90">
              Score: {s.score} · Best: {best}
            </p>
            <button
              type="button"
              onClick={start}
              aria-label="Play again"
              className="pv-pop mt-4 rounded-full bg-white px-6 py-3 text-lg font-extrabold text-slate-900 shadow-2xl hover:scale-105"
            >
              ↻ Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ utilities */
export const rand = (min: number, max: number) => min + Math.random() * (max - min);
export const randi = (min: number, max: number) => Math.floor(rand(min, max + 1));
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export function circleHit(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy < (ar + br) * (ar + br);
}
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}
