// PlayVerse Originals — real, playable games implemented for the portal.
// Each component is self-contained: canvas or DOM based, touch + keyboard.

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { GAMES2A, GAMES2B, GAMES2C } from "./games2";
import { GAMES3A, GAMES3B, GAMES3C } from "./games3";
import { GAMES4A, GAMES4B, GAMES4C } from "./games4";
import { GAMES5A, GAMES5B, GAMES5C, GAMES5D } from "./games5";

const EXPANSION_GAMES: Record<string, ComponentType> = {
  ...GAMES2A, ...GAMES2B, ...GAMES2C,
  ...GAMES3A, ...GAMES3B, ...GAMES3C,
  ...GAMES4A, ...GAMES4B, ...GAMES4C,
  ...GAMES5A, ...GAMES5B, ...GAMES5C, ...GAMES5D,
};

const W = 480;
const H = 360;

function useKeys(handler: (key: string) => void) {
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

function CanvasGame(props: {
  label: string;
  draw: (ctx: CanvasRenderingContext2D) => void;
  onPointer?: (x: number, y: number, type: "down" | "move") => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(props.draw);
  drawRef.current = props.draw;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const loop = () => {
      drawRef.current(ctx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const pos = (e: React.PointerEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };
  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      aria-label={props.label}
      className="block h-auto w-full touch-none rounded-xl bg-slate-900"
      onPointerDown={(e) => {
        const p = pos(e);
        props.onPointer?.(p.x, p.y, "down");
      }}
      onPointerMove={(e) => {
        if (e.buttons > 0 || e.pointerType === "mouse") {
          const p = pos(e);
          props.onPointer?.(p.x, p.y, "move");
        }
      }}
    />
  );
}

function ScoreBar({ items }: { items: [string, string | number][] }) {
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

function RestartButton({ onClick, label = "↻ Restart" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white shadow hover:brightness-110"
    >
      {label}
    </button>
  );
}

function DPad({ onDir }: { onDir: (dx: number, dy: number) => void }) {
  const btn = "flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-alt)] text-lg font-bold active:bg-[var(--accent)] active:text-white";
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

/* ------------------------------------------------------------------ Snake */
function SnakeGame() {
  const CELL = 20;
  const COLS = 24;
  const ROWS = 18;
  const [tick, setTick] = useState(0);
  const state = useRef({
    snake: [{ x: 12, y: 9 }, { x: 11, y: 9 }, { x: 10, y: 9 }],
    dir: { x: 1, y: 0 },
    next: { x: 1, y: 0 },
    food: { x: 16, y: 9 },
    score: 0,
    best: 0,
    over: false,
    paused: false,
  });
  const reset = useCallback(() => {
    const s = state.current;
    s.snake = [{ x: 12, y: 9 }, { x: 11, y: 9 }, { x: 10, y: 9 }];
    s.dir = { x: 1, y: 0 };
    s.next = { x: 1, y: 0 };
    s.food = { x: 16, y: 9 };
    s.score = 0;
    s.over = false;
    s.paused = false;
    setTick((t) => t + 1);
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      const s = state.current;
      if (s.over || s.paused) return;
      s.dir = s.next;
      const head = { x: s.snake[0]!.x + s.dir.x, y: s.snake[0]!.y + s.dir.y };
      if (
        head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS ||
        s.snake.some((p) => p.x === head.x && p.y === head.y)
      ) {
        s.over = true;
        s.best = Math.max(s.best, s.score);
        setTick((t) => t + 1);
        return;
      }
      s.snake.unshift(head);
      if (head.x === s.food.x && head.y === s.food.y) {
        s.score += 10;
        let f = { x: 0, y: 0 };
        do {
          f = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
        } while (s.snake.some((p) => p.x === f.x && p.y === f.y));
        s.food = f;
      } else {
        s.snake.pop();
      }
      setTick((t) => t + 1);
    }, 110);
    return () => clearInterval(id);
  }, []);
  const setDir = useCallback((dx: number, dy: number) => {
    const s = state.current;
    if (s.dir.x === -dx && s.dir.y === -dy) return;
    if (s.dir.x === dx && s.dir.y === dy) return;
    s.next = { x: dx, y: dy };
  }, []);
  useKeys((key) => {
    const s = state.current;
    if (key === "ArrowUp" || key === "w" || key === "W") setDir(0, -1);
    else if (key === "ArrowDown" || key === "s" || key === "S") setDir(0, 1);
    else if (key === "ArrowLeft" || key === "a" || key === "A") setDir(-1, 0);
    else if (key === "ArrowRight" || key === "d" || key === "D") setDir(1, 0);
    else if (key === "p" || key === "P") { s.paused = !s.paused; setTick((t) => t + 1); }
  });
  const s = state.current;
  void tick;
  return (
    <div>
      <ScoreBar items={[["Score", s.score], ["Best", s.best], ["Length", s.snake.length]]} />
      <CanvasGame
        label="Neon Snake game board"
        draw={(ctx) => {
          ctx.fillStyle = "#052e16";
          ctx.fillRect(0, 0, W, H);
          ctx.strokeStyle = "rgba(255,255,255,0.05)";
          for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); ctx.stroke(); }
          for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL); ctx.stroke(); }
          ctx.font = "16px serif";
          ctx.fillText("🍎", s.food.x * CELL + 2, s.food.y * CELL + 16);
          s.snake.forEach((p, i) => {
            ctx.fillStyle = i === 0 ? "#4ade80" : `hsl(140 70% ${55 - Math.min(i, 20)}%)`;
            ctx.beginPath();
            ctx.roundRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2, 5);
            ctx.fill();
          });
          if (s.over || s.paused) {
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "#fff";
            ctx.font = "bold 26px system-ui";
            ctx.textAlign = "center";
            ctx.fillText(s.over ? `Game over — score ${s.score}` : "Paused", W / 2, H / 2);
            ctx.font = "15px system-ui";
            ctx.fillText(s.over ? "Press Restart to play again" : "Press P to resume", W / 2, H / 2 + 28);
            ctx.textAlign = "left";
          }
        }}
      />
      <div className="mt-3 flex justify-center"><RestartButton onClick={reset} /></div>
      <DPad onDir={setDir} />
    </div>
  );
}

/* ----------------------------------------------------------------- Memory */
const MEMORY_EMOJIS = ["🦊", "🐼", "🦁", "🐸", "🦄", "🐙", "🦋", "🍕"];
function MemoryGame() {
  const [deck, setDeck] = useState<{ emoji: string; matched: boolean }[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [flips, setFlips] = useState(0);
  const [lock, setLock] = useState(false);
  const start = useCallback(() => {
    const cards = [...MEMORY_EMOJIS, ...MEMORY_EMOJIS]
      .map((emoji) => ({ emoji, matched: false, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ emoji, matched }) => ({ emoji, matched }));
    setDeck(cards);
    setFlipped([]);
    setFlips(0);
    setLock(false);
  }, []);
  useEffect(start, [start]);
  const won = deck.length > 0 && deck.every((c) => c.matched);
  const flip = (i: number) => {
    if (lock || flipped.includes(i) || deck[i]?.matched) return;
    const next = [...flipped, i];
    setFlipped(next);
    if (next.length === 2) {
      setFlips((f) => f + 1);
      const [a, b] = next as [number, number];
      if (deck[a]?.emoji === deck[b]?.emoji) {
        setDeck((d) => d.map((c, idx) => (idx === a || idx === b ? { ...c, matched: true } : c)));
        setFlipped([]);
      } else {
        setLock(true);
        setTimeout(() => { setFlipped([]); setLock(false); }, 750);
      }
    }
  };
  return (
    <div>
      <ScoreBar items={[["Flips", flips], ["Pairs", `${deck.filter((c) => c.matched).length / 2} / 8`]]} />
      {won && <p className="pv-pop mb-2 rounded-xl bg-green-100 px-4 py-2 text-center font-bold text-green-800">🎉 You matched all pairs in {flips} flips!</p>}
      <div className="grid grid-cols-4 gap-2" role="grid" aria-label="Memory cards">
        {deck.map((card, i) => {
          const up = flipped.includes(i) || card.matched;
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              aria-label={up ? `Card showing ${card.emoji}` : "Face-down card"}
              onClick={() => flip(i)}
              className={`flex aspect-[4/3] items-center justify-center rounded-2xl text-3xl shadow transition sm:text-4xl ${
                up ? "bg-white ring-2 ring-[var(--accent)]" : "bg-gradient-to-br from-violet-500 to-blue-600 text-white hover:brightness-110"
              }`}
            >
              {up ? card.emoji : "★"}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-center"><RestartButton onClick={start} label="↻ New game" /></div>
    </div>
  );
}

/* --------------------------------------------------------------- Breakout */
function BreakoutGame() {
  const state = useRef({
    paddleX: W / 2 - 45, ball: { x: W / 2, y: H - 60, vx: 3.2, vy: -3.6 },
    bricks: [] as { x: number; y: number; alive: boolean; color: string }[],
    score: 0, lives: 3, started: false, over: false, won: false,
  });
  const [, setTick] = useState(0);
  const reset = useCallback(() => {
    const s = state.current;
    const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#2563eb", "#7c3aed"];
    s.bricks = [];
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 9; c++)
        s.bricks.push({ x: 12 + c * 51, y: 36 + r * 22, alive: true, color: colors[r]! });
    s.ball = { x: W / 2, y: H - 60, vx: 3.2, vy: -3.6 };
    s.paddleX = W / 2 - 45;
    s.score = 0; s.lives = 3; s.started = false; s.over = false; s.won = false;
    setTick((t) => t + 1);
  }, []);
  useEffect(reset, [reset]);
  useKeys((key) => {
    const s = state.current;
    if (key === "ArrowLeft" || key === "a") s.paddleX = Math.max(0, s.paddleX - 28);
    if (key === "ArrowRight" || key === "d") s.paddleX = Math.min(W - 90, s.paddleX + 28);
    if (key === " ") s.started = true;
  });
  const s = state.current;
  return (
    <div>
      <ScoreBar items={[["Score", s.score], ["Balls", s.lives]]} />
      <CanvasGame
        label="Block Breaker game board"
        onPointer={(x, _y, type) => {
          state.current.paddleX = Math.min(W - 90, Math.max(0, x - 45));
          if (type === "down") state.current.started = true;
        }}
        draw={(ctx) => {
          const st = state.current;
          ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, W, H);
          for (const b of st.bricks) {
            if (!b.alive) continue;
            ctx.fillStyle = b.color;
            ctx.beginPath(); ctx.roundRect(b.x, b.y, 45, 16, 4); ctx.fill();
          }
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.roundRect(st.paddleX, H - 24, 90, 12, 6); ctx.fill();
          ctx.beginPath(); ctx.arc(st.ball.x, st.ball.y, 7, 0, Math.PI * 2); ctx.fill();
          if (st.started && !st.over && !st.won) {
            const b = st.ball;
            b.x += b.vx; b.y += b.vy;
            if (b.x < 7 || b.x > W - 7) b.vx *= -1;
            if (b.y < 7) b.vy *= -1;
            if (b.y > H - 31 && b.y < H - 10 && b.x > st.paddleX && b.x < st.paddleX + 90 && b.vy > 0) {
              b.vy = -Math.abs(b.vy);
              b.vx = ((b.x - (st.paddleX + 45)) / 45) * 4.2;
            }
            if (b.y > H + 10) {
              st.lives -= 1;
              if (st.lives <= 0) { st.over = true; }
              else { b.x = W / 2; b.y = H - 60; b.vx = 3.2; b.vy = -3.6; st.started = false; }
              setTick((t) => t + 1);
            }
            for (const brick of st.bricks) {
              if (!brick.alive) continue;
              if (b.x > brick.x && b.x < brick.x + 45 && b.y > brick.y && b.y < brick.y + 16) {
                brick.alive = false; b.vy *= -1; st.score += 10;
                setTick((t) => t + 1);
                break;
              }
            }
            if (st.bricks.every((br) => !br.alive)) st.won = true;
          }
          if (!st.started && !st.over && !st.won) {
            ctx.fillStyle = "#e2e8f0"; ctx.font = "16px system-ui"; ctx.textAlign = "center";
            ctx.fillText("Click, tap or press Space to launch the ball", W / 2, H / 2 + 60); ctx.textAlign = "left";
          }
          if (st.over || st.won) {
            ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "#fff"; ctx.font = "bold 26px system-ui"; ctx.textAlign = "center";
            ctx.fillText(st.won ? `You cleared the wall! Score ${st.score}` : `Game over — score ${st.score}`, W / 2, H / 2);
            ctx.textAlign = "left";
          }
        }}
      />
      <div className="mt-3 flex justify-center"><RestartButton onClick={reset} /></div>
    </div>
  );
}

/* --------------------------------------------------------------- Reaction */
function ReactionGame() {
  const [phase, setPhase] = useState<"idle" | "waiting" | "ready" | "early" | "done">("idle");
  const [times, setTimes] = useState<number[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startAt = useRef(0);
  const begin = () => {
    setPhase("waiting");
    setLast(null);
    timer.current = setTimeout(() => {
      startAt.current = performance.now();
      setPhase("ready");
    }, 900 + Math.random() * 2600);
  };
  const tap = () => {
    if (phase === "waiting") {
      if (timer.current) clearTimeout(timer.current);
      setPhase("early");
    } else if (phase === "ready") {
      const ms = Math.round(performance.now() - startAt.current);
      setLast(ms);
      const next = [...times, ms];
      setTimes(next);
      setPhase(next.length >= 5 ? "done" : "idle");
    } else if (phase === "idle" || phase === "early") {
      begin();
    }
  };
  const resetAll = () => { setTimes([]); setLast(null); setPhase("idle"); };
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  const bg = phase === "ready" ? "bg-green-500" : phase === "waiting" ? "bg-red-500" : phase === "early" ? "bg-amber-400" : "bg-gradient-to-br from-blue-600 to-violet-600";
  return (
    <div>
      <ScoreBar items={[["Round", `${Math.min(times.length + (phase === "done" ? 0 : 1), 5)} / 5`], ["Average", avg ? `${avg} ms` : "—"]]} />
      <button
        type="button"
        onClick={tap}
        aria-label="Reaction test panel"
        className={`flex h-64 w-full flex-col items-center justify-center rounded-2xl text-white shadow transition-colors ${bg}`}
      >
        {phase === "idle" && <><span className="text-4xl">⚡</span><span className="mt-2 text-xl font-bold">Tap to start the round</span></>}
        {phase === "waiting" && <><span className="text-4xl">🔴</span><span className="mt-2 text-xl font-bold">Wait for green…</span></>}
        {phase === "ready" && <><span className="text-4xl">🟢</span><span className="mt-2 text-2xl font-extrabold">TAP NOW!</span></>}
        {phase === "early" && <><span className="text-4xl">😅</span><span className="mt-2 text-xl font-bold text-slate-900">Too soon! Tap to try the round again</span></>}
        {phase === "done" && <><span className="text-4xl">🏆</span><span className="mt-2 text-xl font-bold">Your average reaction: {avg} ms</span><span className="text-sm opacity-90">Rounds: {times.map((t) => `${t}ms`).join(" · ")}</span></>}
      </button>
      {last !== null && phase === "idle" && <p className="pv-pop mt-2 text-center text-lg font-bold">That tap: {last} ms — tap the panel for the next round</p>}
      <div className="mt-3 flex justify-center"><RestartButton onClick={resetAll} label="↻ Start over" /></div>
    </div>
  );
}

/* -------------------------------------------------------------- Merge2048 */
type Grid = number[][];
function mergeLine(line: number[]): { line: number[]; gained: number } {
  const nums = line.filter((n) => n !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] === nums[i + 1]) {
      const v = nums[i]! * 2;
      out.push(v);
      gained += v;
      i++;
    } else out.push(nums[i]!);
  }
  while (out.length < 4) out.push(0);
  return { line: out, gained };
}
function MergeGame() {
  const [grid, setGrid] = useState<Grid>([]);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const spawn = useCallback((g: Grid): Grid => {
    const empty: [number, number][] = [];
    g.forEach((row, r) => row.forEach((v, c) => { if (v === 0) empty.push([r, c]); }));
    if (empty.length === 0) return g;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)]!;
    const next = g.map((row) => [...row]);
    next[r]![c] = Math.random() < 0.9 ? 2 : 4;
    return next;
  }, []);
  const start = useCallback(() => {
    let g: Grid = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    g = spawn(g); g = spawn(g);
    setGrid(g); setScore(0); setOver(false); setWon(false);
  }, [spawn]);
  useEffect(start, [start]);
  const move = useCallback((dir: "up" | "down" | "left" | "right") => {
    setGrid((g) => {
      if (g.length === 0) return g;
      let gained = 0;
      const work: Grid = g.map((row) => [...row]);
      const getLine = (i: number): number[] => {
        if (dir === "left") return [...work[i]!];
        if (dir === "right") return [...work[i]!].reverse();
        if (dir === "up") return [work[0]![i]!, work[1]![i]!, work[2]![i]!, work[3]![i]!];
        return [work[3]![i]!, work[2]![i]!, work[1]![i]!, work[0]![i]!];
      };
      const setLine = (i: number, line: number[]) => {
        if (dir === "left") work[i] = line;
        else if (dir === "right") work[i] = [...line].reverse();
        else if (dir === "up") line.forEach((v, r) => { work[r]![i] = v; });
        else line.forEach((v, r) => { work[3 - r]![i] = v; });
      };
      for (let i = 0; i < 4; i++) {
        const { line, gained: gt } = mergeLine(getLine(i));
        gained += gt;
        setLine(i, line);
      }
      if (JSON.stringify(work) === JSON.stringify(g)) return g;
      if (gained) setScore((s) => s + gained);
      const next = spawn(work);
      if (next.flat().includes(2048)) setWon(true);
      const canMove = next.some((row, r) => row.some((v, c) =>
        v === 0 || (c < 3 && next[r]![c + 1] === v) || (r < 3 && next[r + 1]![c] === v)));
      if (!canMove) setOver(true);
      return next;
    });
  }, [spawn]);
  useKeys((key) => {
    if (key === "ArrowUp" || key === "w") move("up");
    else if (key === "ArrowDown" || key === "s") move("down");
    else if (key === "ArrowLeft" || key === "a") move("left");
    else if (key === "ArrowRight" || key === "d") move("right");
  });
  const colors: Record<number, string> = {
    0: "bg-slate-100 text-transparent", 2: "bg-amber-100 text-amber-900", 4: "bg-amber-200 text-amber-900",
    8: "bg-orange-400 text-white", 16: "bg-orange-500 text-white", 32: "bg-red-400 text-white",
    64: "bg-red-500 text-white", 128: "bg-yellow-300 text-yellow-900", 256: "bg-yellow-400 text-yellow-900",
    512: "bg-green-400 text-white", 1024: "bg-green-500 text-white", 2048: "bg-violet-600 text-white",
  };
  return (
    <div>
      <ScoreBar items={[["Score", score]]} />
      {won && <p className="pv-pop mb-2 rounded-xl bg-violet-100 px-4 py-2 text-center font-bold text-violet-800">🎉 You built the 2048 tile! Keep going for a bigger score.</p>}
      {over && <p className="pv-pop mb-2 rounded-xl bg-red-100 px-4 py-2 text-center font-bold text-red-800">No moves left — game over at {score} points.</p>}
      <div className="mx-auto grid max-w-sm grid-cols-4 gap-2 rounded-2xl bg-amber-900/10 p-2" aria-label="Number Merge board">
        {grid.flat().map((v, i) => (
          <div key={i} className={`flex aspect-square items-center justify-center rounded-xl text-xl font-extrabold sm:text-2xl ${colors[v] ?? "bg-violet-700 text-white"}`}>
            {v === 0 ? "·" : v}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        <button type="button" aria-label="Move up" className="rounded-full bg-[var(--surface-alt)] px-4 py-2 font-bold" onClick={() => move("up")}>▲</button>
        <button type="button" aria-label="Move left" className="rounded-full bg-[var(--surface-alt)] px-4 py-2 font-bold" onClick={() => move("left")}>◀</button>
        <button type="button" aria-label="Move down" className="rounded-full bg-[var(--surface-alt)] px-4 py-2 font-bold" onClick={() => move("down")}>▼</button>
        <button type="button" aria-label="Move right" className="rounded-full bg-[var(--surface-alt)] px-4 py-2 font-bold" onClick={() => move("right")}>▶</button>
        <RestartButton onClick={start} label="↻ New game" />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Flappy */
function FlappyGame() {
  const state = useRef({ y: 170, vy: 0, pipes: [] as { x: number; gapY: number }[], score: 0, started: false, over: false, frame: 0 });
  const [, setTick] = useState(0);
  const reset = useCallback(() => {
    state.current = { y: 170, vy: 0, pipes: [], score: 0, started: false, over: false, frame: 0 };
    setTick((t) => t + 1);
  }, []);
  const flap = useCallback(() => {
    const s = state.current;
    if (s.over) return;
    s.started = true;
    s.vy = -7.4;
  }, []);
  useKeys((key) => { if (key === " " || key === "ArrowUp") flap(); });
  return (
    <div>
      <ScoreBar items={[["Score", state.current.score]]} />
      <CanvasGame
        label="Sky Hopper game board"
        onPointer={(_x, _y, type) => { if (type === "down") flap(); }}
        draw={(ctx) => {
          const s = state.current;
          const grad = ctx.createLinearGradient(0, 0, 0, H);
          grad.addColorStop(0, "#7dd3fc"); grad.addColorStop(1, "#dbeafe");
          ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
          if (s.started && !s.over) {
            s.frame++;
            s.vy += 0.42; s.y += s.vy;
            if (s.frame % 95 === 0) s.pipes.push({ x: W + 20, gapY: 70 + Math.random() * 170 });
            for (const p of s.pipes) {
              p.x -= 2.6;
              if (p.x === W - 130) { /* noop */ }
            }
            const before = s.pipes.length;
            s.pipes = s.pipes.filter((p) => p.x > -60);
            if (s.pipes.length !== before) { /* scored below */ }
            for (const p of s.pipes) {
              if (!("counted" in p)) (p as { counted?: boolean }).counted = false;
              if (p.x + 52 < W / 2 - 14 && !(p as { counted?: boolean }).counted) {
                (p as { counted?: boolean }).counted = true;
                s.score++;
                setTick((t) => t + 1);
              }
              const inX = W / 2 + 14 > p.x && W / 2 - 14 < p.x + 52;
              const inGap = s.y - 11 > p.gapY && s.y + 11 < p.gapY + 108;
              if (inX && !inGap) s.over = true;
            }
            if (s.y > H - 24 || s.y < 0) s.over = true;
          }
          ctx.fillStyle = "#22c55e";
          for (const p of s.pipes) {
            ctx.fillRect(p.x, 0, 52, p.gapY);
            ctx.fillRect(p.x, p.gapY + 108, 52, H - p.gapY - 108);
            ctx.fillStyle = "#16a34a";
            ctx.fillRect(p.x - 3, p.gapY - 18, 58, 18);
            ctx.fillRect(p.x - 3, p.gapY + 108, 58, 18);
            ctx.fillStyle = "#22c55e";
          }
          ctx.fillStyle = "#84cc16"; ctx.fillRect(0, H - 14, W, 14);
          ctx.font = "30px serif";
          ctx.fillText("🐤", W / 2 - 15, s.y + 11);
          ctx.fillStyle = "#0f172a"; ctx.font = "bold 22px system-ui"; ctx.textAlign = "center";
          ctx.fillText(String(s.score), W / 2, 34);
          if (!s.started) { ctx.font = "16px system-ui"; ctx.fillText("Tap, click or press Space to flap", W / 2, H / 2 + 70); }
          if (s.over) {
            ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "#fff"; ctx.font = "bold 26px system-ui";
            ctx.fillText(`Game over — score ${s.score}`, W / 2, H / 2);
          }
          ctx.textAlign = "left";
        }}
      />
      <div className="mt-3 flex justify-center gap-2">
        <button type="button" onClick={flap} className="rounded-full bg-[var(--surface-alt)] px-5 py-2 font-bold">🪽 Flap</button>
        <RestartButton onClick={reset} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- TicTacToe */
function bestMove(board: (string | null)[], player: string, foe: string): number {
  const lines: [number, number, number][] = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const winner = (b: (string | null)[]): string | null => {
    for (const [a, c, d] of lines) {
      const v = b[a];
      if (v && v === b[c] && v === b[d]) return v;
    }
    return null;
  };
  const minimax = (b: (string | null)[], isMax: boolean, depth: number): number => {
    const w = winner(b);
    if (w === player) return 10 - depth;
    if (w === foe) return depth - 10;
    if (b.every((c) => c)) return 0;
    let best = isMax ? -Infinity : Infinity;
    b.forEach((cell, i) => {
      if (cell) return;
      b[i] = isMax ? player : foe;
      const score = minimax(b, !isMax, depth + 1);
      b[i] = null;
      best = isMax ? Math.max(best, score) : Math.min(best, score);
    });
    return best;
  };
  let bestScore = -Infinity;
  let move = -1;
  board.forEach((cell, i) => {
    if (cell) return;
    board[i] = player;
    const score = minimax(board, false, 0);
    board[i] = null;
    if (score > bestScore) { bestScore = score; move = i; }
  });
  return move;
}
function TicTacToeGame() {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<"X" | "O">("X");
  const [mode, setMode] = useState<"easy" | "medium" | "hard" | "2p">("medium");
  const [scores, setScores] = useState({ X: 0, O: 0, draws: 0 });
  const lines: [number, number, number][] = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const winLine = lines.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
  const winner = winLine ? board[winLine[0]] : null;
  const full = board.every((c) => c);
  const finished = !!winner || full;
  useEffect(() => {
    if (finished) {
      setScores((s) => winner === "X" ? { ...s, X: s.X + 1 } : winner === "O" ? { ...s, O: s.O + 1 } : { ...s, draws: s.draws + 1 });
      return;
    }
    if (mode !== "2p" && turn === "O") {
      const t = setTimeout(() => {
        const empty = board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
        if (empty.length === 0) return;
        let pick: number;
        if (mode === "easy" || (mode === "medium" && Math.random() < 0.5)) {
          pick = empty[Math.floor(Math.random() * empty.length)]!;
        } else {
          pick = bestMove([...board], "O", "X");
          if (pick < 0) pick = empty[0]!;
        }
        setBoard((b) => b.map((c, i) => (i === pick ? "O" : c)));
        setTurn("X");
      }, 420);
      return () => clearTimeout(t);
    }
  }, [board, turn, mode, finished, winner]);
  const play = (i: number) => {
    if (finished || board[i]) return;
    if (mode !== "2p" && turn === "O") return;
    setBoard((b) => b.map((c, idx) => (idx === i ? turn : c)));
    setTurn(turn === "X" ? "O" : "X");
  };
  const reset = () => { setBoard(Array(9).fill(null)); setTurn("X"); };
  return (
    <div>
      <ScoreBar items={[["❌ X", scores.X], ["⭕ O", scores.O], ["Draws", scores.draws]]} />
      <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Game mode">
        {(["easy", "medium", "hard", "2p"] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); reset(); }}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${mode === m ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-alt)]"}`}>
            {m === "2p" ? "👥 2 Players" : m === "easy" ? "😊 Easy" : m === "medium" ? "😐 Medium" : "😤 Hard"}
          </button>
        ))}
      </div>
      <p className="mb-2 text-center font-bold" aria-live="polite">
        {winner ? `🎉 ${winner === "X" ? "❌ X" : "⭕ O"} wins!` : full ? "🤝 It's a draw!" : mode !== "2p" && turn === "O" ? "Computer is thinking…" : `${turn === "X" ? "❌ X" : "⭕ O"} to move`}
      </p>
      <div className="mx-auto grid max-w-xs grid-cols-3 gap-2" aria-label="Tic Tac Tactics board">
        {board.map((cell, i) => (
          <button key={i} type="button" onClick={() => play(i)} aria-label={`Cell ${i + 1}${cell ? `, ${cell}` : ""}`}
            className={`flex aspect-square items-center justify-center rounded-2xl text-4xl font-extrabold shadow ${
              winLine?.includes(i) ? "bg-green-400 text-white" : "bg-white ring-1 ring-[var(--border)] hover:bg-[var(--bg-soft)]"
            } ${cell === "X" ? "text-blue-600" : "text-red-500"}`}>
            {cell === "X" ? "✕" : cell === "O" ? "○" : ""}
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-center"><RestartButton onClick={reset} label="↻ Next round" /></div>
    </div>
  );
}

/* ----------------------------------------------------------------- Racer */
function RacerGame() {
  const state = useRef({
    lane: 1, speed: 3, dist: 0, score: 0, over: false, started: false,
    cars: [] as { lane: number; y: number; color: string }[], frame: 0,
  });
  const [, setTick] = useState(0);
  const reset = useCallback(() => {
    state.current = { lane: 1, speed: 3, dist: 0, score: 0, over: false, started: false, cars: [], frame: 0 };
    setTick((t) => t + 1);
  }, []);
  const steer = useCallback((d: number) => {
    const s = state.current;
    s.started = true;
    s.lane = Math.min(2, Math.max(0, s.lane + d));
    setTick((t) => t + 1);
  }, []);
  useKeys((key) => {
    if (key === "ArrowLeft" || key === "a") steer(-1);
    if (key === "ArrowRight" || key === "d") steer(1);
  });
  const laneX = (lane: number) => 120 + lane * 100;
  return (
    <div>
      <ScoreBar items={[["Score", state.current.score], ["Speed", `${Math.round(state.current.speed * 22)} km/h`]]} />
      <CanvasGame
        label="Pixel Racer game board"
        onPointer={(x, _y, type) => {
          if (type !== "down") return;
          const s = state.current;
          const target = x < 170 ? 0 : x > 310 ? 2 : 1;
          s.lane = target; s.started = true;
          setTick((t) => t + 1);
        }}
        draw={(ctx) => {
          const s = state.current;
          ctx.fillStyle = "#334155"; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#1e293b"; ctx.fillRect(0, 0, 70, H); ctx.fillRect(W - 70, 0, 70, H);
          ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.setLineDash([18, 22]); ctx.lineWidth = 4;
          const off = s.started && !s.over ? (s.dist % 40) : 0;
          for (const lx of [170, 310]) {
            ctx.beginPath(); ctx.moveTo(lx, -40 + off); ctx.lineTo(lx, H); ctx.stroke();
          }
          ctx.setLineDash([]);
          if (s.started && !s.over) {
            s.frame++;
            s.dist += s.speed;
            s.speed = Math.min(9, 3 + s.dist / 2600);
            if (s.frame % 55 === 0) {
              const lane = Math.floor(Math.random() * 3);
              if (!s.cars.some((c) => c.lane === lane && c.y < 90)) {
                s.cars.push({ lane, y: -70, color: ["#f59e0b", "#a78bfa", "#34d399", "#f472b6"][Math.floor(Math.random() * 4)]! });
              }
            }
            for (const c of s.cars) {
              c.y += s.speed * 0.62 + 1.4;
              if (c.y > H + 60 && !("passed" in c)) {
                (c as { passed?: boolean }).passed = true;
                s.score += 10;
                setTick((t) => t + 1);
              }
              if (c.lane === s.lane && c.y > H - 108 && c.y < H - 28) s.over = true;
            }
            s.cars = s.cars.filter((c) => c.y < H + 80);
          }
          const car = (x: number, y: number, color: string, player = false) => {
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.roundRect(x - 21, y, 42, 62, 9); ctx.fill();
            ctx.fillStyle = "#e0f2fe";
            ctx.beginPath(); ctx.roundRect(x - 15, y + 10, 30, 14, 4); ctx.fill();
            ctx.beginPath(); ctx.roundRect(x - 15, y + 38, 30, 10, 4); ctx.fill();
            if (player) { ctx.fillStyle = "#fff"; ctx.font = "bold 11px system-ui"; ctx.textAlign = "center"; ctx.fillText("YOU", x, y + 34); ctx.textAlign = "left"; }
          };
          for (const c of s.cars) car(laneX(c.lane), c.y, c.color);
          car(laneX(s.lane), H - 84, "#ef4444", true);
          if (!s.started) {
            ctx.fillStyle = "#e2e8f0"; ctx.font = "16px system-ui"; ctx.textAlign = "center";
            ctx.fillText("Steer with ◀ ▶ or tap a lane to start", W / 2, 40); ctx.textAlign = "left";
          }
          if (s.over) {
            ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "#fff"; ctx.font = "bold 26px system-ui"; ctx.textAlign = "center";
            ctx.fillText(`Crash! Score ${s.score}`, W / 2, H / 2); ctx.textAlign = "left";
          }
        }}
      />
      <div className="mt-3 flex justify-center gap-2">
        <button type="button" aria-label="Steer left" className="rounded-full bg-[var(--surface-alt)] px-5 py-2 text-lg font-bold" onClick={() => steer(-1)}>◀</button>
        <button type="button" aria-label="Steer right" className="rounded-full bg-[var(--surface-alt)] px-5 py-2 text-lg font-bold" onClick={() => steer(1)}>▶</button>
        <RestartButton onClick={reset} />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Shooter */
function ShooterGame() {
  const state = useRef({
    shipX: W / 2, bullets: [] as { x: number; y: number }[],
    enemies: [] as { x: number; y: number; hp: number }[],
    score: 0, wave: 1, over: false, won: false, started: false, frame: 0, leaked: 0,
  });
  const [, setTick] = useState(0);
  const spawnWave = useCallback((wave: number) => {
    const s = state.current;
    s.enemies = [];
    const count = 5 + wave * 2;
    for (let i = 0; i < count; i++) {
      s.enemies.push({ x: 50 + (i % 7) * 62, y: 30 + Math.floor(i / 7) * 44, hp: wave > 2 ? 2 : 1 });
    }
  }, []);
  const reset = useCallback(() => {
    state.current = { shipX: W / 2, bullets: [], enemies: [], score: 0, wave: 1, over: false, won: false, started: false, frame: 0, leaked: 0 };
    spawnWave(1);
    setTick((t) => t + 1);
  }, [spawnWave]);
  useEffect(reset, [reset]);
  useKeys((key) => {
    const s = state.current;
    if (key === "ArrowLeft" || key === "a") s.shipX = Math.max(24, s.shipX - 22);
    if (key === "ArrowRight" || key === "d") s.shipX = Math.min(W - 24, s.shipX + 22);
    if (key === " ") s.started = true;
  });
  const s = state.current;
  return (
    <div>
      <ScoreBar items={[["Score", s.score], ["Wave", s.wave], ["Drones through", `${s.leaked} / 3`]]} />
      <CanvasGame
        label="Star Defender game board"
        onPointer={(x, _y, type) => {
          state.current.shipX = Math.min(W - 24, Math.max(24, x));
          if (type === "down") state.current.started = true;
        }}
        draw={(ctx) => {
          const st = state.current;
          ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "rgba(255,255,255,0.8)";
          for (let i = 0; i < 40; i++) {
            const sx = (i * 97) % W; const sy = (i * 57 + (st.frame * 0.4) % H) % H;
            ctx.fillRect(sx, sy, 2, 2);
          }
          ctx.strokeStyle = "#ef4444"; ctx.setLineDash([6, 6]);
          ctx.beginPath(); ctx.moveTo(0, H - 56); ctx.lineTo(W, H - 56); ctx.stroke(); ctx.setLineDash([]);
          if (st.started && !st.over) {
            st.frame++;
            if (st.frame % 11 === 0) st.bullets.push({ x: st.shipX, y: H - 66 });
            for (const b of st.bullets) b.y -= 7.5;
            st.bullets = st.bullets.filter((b) => b.y > -10);
            const descend = 0.14 + st.wave * 0.05;
            for (const e of st.enemies) {
              e.y += descend;
              if (e.y > H - 62) {
                e.y = -999;
                st.leaked++;
                if (st.leaked >= 3) st.over = true;
                setTick((t) => t + 1);
              }
            }
            st.enemies = st.enemies.filter((e) => e.y > -100);
            for (const b of st.bullets) {
              for (const e of st.enemies) {
                if (Math.abs(b.x - e.x) < 20 && Math.abs(b.y - e.y) < 16) {
                  e.hp--; b.y = -999;
                  if (e.hp <= 0) { e.y = -999; st.score += 25; }
                  setTick((t) => t + 1);
                  break;
                }
              }
            }
            st.bullets = st.bullets.filter((b) => b.y > -50);
            st.enemies = st.enemies.filter((e) => e.y > -100);
            if (st.enemies.length === 0 && !st.over) {
              st.wave++;
              if (st.wave > 5) { st.won = true; st.over = true; }
              else spawnWave(st.wave);
              setTick((t) => t + 1);
            }
          }
          for (const e of st.enemies) {
            ctx.font = "26px serif";
            ctx.fillText(e.hp > 1 ? "🛸" : "👾", e.x - 14, e.y + 10);
          }
          ctx.fillStyle = "#facc15";
          for (const b of st.bullets) ctx.fillRect(b.x - 2, b.y, 4, 12);
          ctx.font = "30px serif";
          ctx.fillText("🚀", st.shipX - 15, H - 22);
          if (!st.started) {
            ctx.fillStyle = "#e2e8f0"; ctx.font = "16px system-ui"; ctx.textAlign = "center";
            ctx.fillText("Move with mouse, touch or ◀ ▶ — tap or press Space to launch", W / 2, 40);
            ctx.textAlign = "left";
          }
          if (st.over) {
            ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "#fff"; ctx.font = "bold 25px system-ui"; ctx.textAlign = "center";
            ctx.fillText(st.won ? `Sector defended! Score ${st.score}` : `Sector lost — score ${st.score}`, W / 2, H / 2);
            ctx.textAlign = "left";
          }
        }}
      />
      <div className="mt-3 flex justify-center"><RestartButton onClick={reset} /></div>
    </div>
  );
}

/* ------------------------------------------------------------- WordGuess */
const WORDS: { word: string; hint: string }[] = [
  { word: "ELEPHANT", hint: "Animal with a trunk" },
  { word: "RAINBOW", hint: "Colors after the rain" },
  { word: "ASTRONAUT", hint: "Travels to space" },
  { word: "GUITAR", hint: "Six-string instrument" },
  { word: "PENGUIN", hint: "Bird that cannot fly" },
  { word: "VOLCANO", hint: "Mountain that erupts" },
  { word: "BICYCLE", hint: "Two-wheeled ride" },
  { word: "DIAMOND", hint: "Sparkling gem" },
  { word: "OCTOPUS", hint: "Eight-armed sea creature" },
  { word: "CASTLE", hint: "A king's home" },
];
function WordGuessGame() {
  const [round, setRound] = useState(0);
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [misses, setMisses] = useState(0);
  const [streak, setStreak] = useState(0);
  const [solved, setSolved] = useState(0);
  const entry = WORDS[round % WORDS.length]!;
  const word = entry.word;
  const revealed = word.split("").every((ch) => guessed.has(ch));
  const lost = misses >= 6;
  const pick = (letter: string) => {
    if (guessed.has(letter) || revealed || lost) return;
    const next = new Set(guessed);
    next.add(letter);
    setGuessed(next);
    if (!word.includes(letter)) setMisses((m) => m + 1);
    else if (word.split("").every((ch) => next.has(ch))) {
      setSolved((s) => s + 1);
      setStreak((s) => s + 1);
    }
  };
  const nextRound = (keepStreak: boolean) => {
    if (!keepStreak) setStreak(0);
    setRound((r) => r + 1);
    setGuessed(new Set());
    setMisses(0);
  };
  const balloons = ["🎈", "🎈", "🎈", "🎈", "🎈", "🎈"];
  return (
    <div>
      <ScoreBar items={[["Solved", solved], ["Streak", streak], ["Balloons left", 6 - misses]]} />
      <p className="mb-1 text-center text-3xl" aria-label={`${6 - misses} balloons remaining`}>
        {balloons.slice(0, 6 - misses).join(" ") || "💥"}
      </p>
      <p className="mb-2 text-center text-[var(--dim)]">Hint: {entry.hint}</p>
      <div className="mb-3 flex flex-wrap justify-center gap-1.5" aria-label="Hidden word">
        {word.split("").map((ch, i) => (
          <span key={i} className={`flex h-11 w-9 items-center justify-center rounded-lg text-xl font-extrabold ${
            guessed.has(ch) || lost ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-alt)] text-transparent"}`}>
            {ch}
          </span>
        ))}
      </div>
      {revealed && <p className="pv-pop mb-2 text-center font-bold text-green-700">🎉 You got it! The word was {word}.</p>}
      {lost && <p className="pv-pop mb-2 text-center font-bold text-red-700">The balloon popped! The word was {word}.</p>}
      <div className="flex flex-wrap justify-center gap-1" role="group" aria-label="Letter keyboard">
        {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => {
          const used = guessed.has(letter);
          const right = used && word.includes(letter);
          return (
            <button key={letter} type="button" disabled={used || revealed || lost} onClick={() => pick(letter)}
              aria-label={`Guess letter ${letter}`}
              className={`h-10 w-9 rounded-lg text-sm font-bold ${
                right ? "bg-green-500 text-white" : used ? "bg-red-200 text-red-800" : "bg-white ring-1 ring-[var(--border)] hover:bg-[var(--bg-soft)]"}`}>
              {letter}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-center">
        {(revealed || lost)
          ? <RestartButton onClick={() => nextRound(revealed)} label="Next word →" />
          : <RestartButton onClick={() => nextRound(false)} label="Skip word" />}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Match-3 */
const GEMS = ["🔴", "🔵", "🟢", "🟡", "🟣", "🟠"];
function findMatches(board: (number | null)[][]): Set<string> {
  const found = new Set<string>();
  for (let r = 0; r < 8; r++) {
    let run = 1;
    for (let c = 1; c <= 8; c++) {
      if (c < 8 && board[r]![c] !== null && board[r]![c] === board[r]![c - 1]) run++;
      else {
        if (run >= 3 && board[r]![c - 1] !== null) for (let k = 1; k <= run; k++) found.add(`${r},${c - k}`);
        run = 1;
      }
    }
  }
  for (let c = 0; c < 8; c++) {
    let run = 1;
    for (let r = 1; r <= 8; r++) {
      if (r < 8 && board[r]![c] !== null && board[r]![c] === board[r - 1]![c]) run++;
      else {
        if (run >= 3 && board[r - 1]![c] !== null) for (let k = 1; k <= run; k++) found.add(`${r - k},${c}`);
        run = 1;
      }
    }
  }
  return found;
}
function settleBoard(board: (number | null)[][], matches: Set<string>): { board: (number | null)[][]; gained: number } {
  const b = board.map((row) => [...row]);
  let gained = 0;
  let current = matches;
  let guard = 0;
  while (current.size > 0 && guard++ < 12) {
    gained += current.size * 10;
    for (const key of current) {
      const [r, c] = key.split(",").map(Number) as [number, number];
      b[r]![c] = null;
    }
    for (let c = 0; c < 8; c++) {
      const stack: number[] = [];
      for (let r = 7; r >= 0; r--) if (b[r]![c] !== null) stack.push(b[r]![c]!);
      for (let r = 7; r >= 0; r--) b[r]![c] = stack[7 - r] ?? Math.floor(Math.random() * GEMS.length);
      // fill remaining empties from the top
      for (let r = 0; r < 8; r++) if (b[r]![c] === null) b[r]![c] = Math.floor(Math.random() * GEMS.length);
    }
    current = findMatches(b);
  }
  return { board: b, gained };
}
function Match3Game() {
  const [board, setBoard] = useState<(number | null)[][]>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(25);
  const [message, setMessage] = useState("");
  const start = useCallback(() => {
    let b: (number | null)[][] = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => Math.floor(Math.random() * GEMS.length)));
    let guard = 0;
    while (findMatches(b).size > 0 && guard++ < 20) {
      b = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => Math.floor(Math.random() * GEMS.length)));
    }
    setBoard(b); setScore(0); setMoves(25); setSelected(null); setMessage("");
  }, []);
  useEffect(start, [start]);
  const tap = (r: number, c: number) => {
    if (moves <= 0) return;
    if (!selected) { setSelected([r, c]); return; }
    const [sr, sc] = selected;
    if (sr === r && sc === c) { setSelected(null); return; }
    if (Math.abs(sr - r) + Math.abs(sc - c) !== 1) { setSelected([r, c]); return; }
    const swapped = board.map((row) => [...row]);
    const tmp = swapped[sr]![sc]!;
    swapped[sr]![sc] = swapped[r]![c]!;
    swapped[r]![c] = tmp;
    const matches = findMatches(swapped);
    if (matches.size === 0) {
      setMessage("No match — try another swap.");
      setSelected(null);
      return;
    }
    const { board: settled, gained } = settleBoard(swapped, matches);
    setBoard(settled);
    setScore((s) => s + gained);
    setMoves((m) => m - 1);
    setMessage(`+${gained} points!`);
    setSelected(null);
  };
  return (
    <div>
      <ScoreBar items={[["Score", score], ["Moves left", moves]]} />
      {message && <p className="mb-2 text-center font-bold text-[var(--accent)]" aria-live="polite">{message}</p>}
      {moves <= 0 && <p className="pv-pop mb-2 rounded-xl bg-violet-100 px-4 py-2 text-center font-bold text-violet-800">Time's up — final score {score}!</p>}
      <div className="mx-auto grid max-w-sm grid-cols-8 gap-1 rounded-2xl bg-slate-900 p-2" aria-label="Gem Cascade board">
        {board.map((row, r) => row.map((gem, c) => (
          <button key={`${r}-${c}`} type="button" onClick={() => tap(r, c)}
            aria-label={`Gem at row ${r + 1}, column ${c + 1}`}
            className={`flex aspect-square items-center justify-center rounded-lg text-lg sm:text-2xl ${
              selected?.[0] === r && selected?.[1] === c ? "bg-white ring-4 ring-yellow-300" : "bg-white/10 hover:bg-white/25"}`}>
            {gem !== null ? GEMS[gem] : ""}
          </button>
        )))}
      </div>
      <div className="mt-3 flex justify-center"><RestartButton onClick={start} label="↻ New game" /></div>
    </div>
  );
}

/* --------------------------------------------------------------- Traffic */
type CarT = { dir: number; pos: number; speed: number; color: string; stopped: boolean };
function TrafficGame() {
  const state = useRef({
    cars: [] as CarT[], lights: [true, false], time: 0, passed: 0, over: false, started: false, frame: 0,
  });
  const [, setTick] = useState(0);
  const reset = useCallback(() => {
    state.current = { cars: [], lights: [true, false], time: 0, passed: 0, over: false, started: false, frame: 0 };
    setTick((t) => t + 1);
  }, []);
  // car coordinates: dir 0 = eastbound (left→right, y=196), 1 = westbound (right→left, y=164),
  // 2 = southbound (top→bottom, x=256), 3 = northbound (bottom→top, x=224)
  const carXY = (car: CarT): [number, number] => {
    if (car.dir === 0) return [car.pos, 196];
    if (car.dir === 1) return [W - car.pos, 164];
    if (car.dir === 2) return [256, car.pos];
    return [224, H - car.pos];
  };
  const stopLine = 168;
  return (
    <div>
      <ScoreBar items={[["Cars through", state.current.passed], ["Survived", `${Math.floor(state.current.time)}s`]]} />
      <CanvasGame
        label="Turbo Traffic intersection"
        onPointer={(x, y, type) => {
          if (type !== "down") return;
          const s = state.current;
          s.started = true;
          // light buttons: NS at top-right area, EW at bottom-left area
          if (x > 380 && y < 80) { s.lights[0] = !s.lights[0]; }
          else if (x < 100 && y > 280) { s.lights[1] = !s.lights[1]; }
          setTick((t) => t + 1);
        }}
        draw={(ctx) => {
          const s = state.current;
          ctx.fillStyle = "#86c98a"; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#475569";
          ctx.fillRect(0, 148, W, 64); // horizontal road
          ctx.fillRect(208, 0, 64, H); // vertical road
          ctx.strokeStyle = "#fbbf24"; ctx.setLineDash([10, 10]); ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(0, 180); ctx.lineTo(208, 180); ctx.moveTo(272, 180); ctx.lineTo(W, 180); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(240, 0); ctx.lineTo(240, 148); ctx.moveTo(240, 212); ctx.lineTo(240, H); ctx.stroke();
          ctx.setLineDash([]);
          if (s.started && !s.over) {
            s.frame++;
            s.time += 1 / 60;
            if (s.frame % 70 === 0) {
              const dir = Math.floor(Math.random() * 4);
              const colors = ["#ef4444", "#2563eb", "#f59e0b", "#a78bfa", "#f472b6", "#34d399"];
              if (!s.cars.some((c) => c.dir === dir && c.pos < 50)) {
                s.cars.push({ dir, pos: -30, speed: 1.5 + Math.random() * 0.9, color: colors[Math.floor(Math.random() * colors.length)]!, stopped: false });
              }
            }
            const greenFor = (dir: number) => (dir <= 1 ? s.lights[1] : s.lights[0]);
            for (const car of s.cars) {
              const approaching = car.pos < stopLine && car.pos > stopLine - 46;
              const carAhead = s.cars.some((o) => o !== car && o.dir === car.dir && o.pos > car.pos && o.pos - car.pos < 40);
              car.stopped = carAhead || (approaching && !greenFor(car.dir) && car.pos < stopLine - 4);
              if (!car.stopped) car.pos += car.speed;
            }
            const done = s.cars.filter((c) => c.pos > W + 40 || (c.dir >= 2 && c.pos > H + 40));
            if (done.length) { s.passed += done.length; setTick((t) => t + 1); }
            s.cars = s.cars.filter((c) => !(c.pos > W + 40 || (c.dir >= 2 && c.pos > H + 40)));
            // collision: two cars from crossing directions inside the box
            const inBox = s.cars.filter((c) => {
              const [x, y] = carXY(c);
              return x > 196 && x < 284 && y > 136 && y < 224;
            });
            outer: for (let i = 0; i < inBox.length; i++) {
              for (let j = i + 1; j < inBox.length; j++) {
                const a = inBox[i]!, b = inBox[j]!;
                if ((a.dir <= 1) !== (b.dir <= 1)) {
                  const [ax, ay] = carXY(a); const [bx, by] = carXY(b);
                  if (Math.abs(ax - bx) < 26 && Math.abs(ay - by) < 26) { s.over = true; break outer; }
                }
              }
            }
          }
          for (const car of s.cars) {
            const [x, y] = carXY(car);
            ctx.fillStyle = car.color;
            const horiz = car.dir <= 1;
            ctx.beginPath();
            ctx.roundRect(x - (horiz ? 17 : 12), y - (horiz ? 12 : 17), horiz ? 34 : 24, horiz ? 24 : 34, 6);
            ctx.fill();
            ctx.fillStyle = "#e0f2fe";
            ctx.fillRect(x - 4, y - 4, 8, 8);
          }
          const light = (x: number, y: number, green: boolean, label: string) => {
            ctx.fillStyle = "#1e293b";
            ctx.beginPath(); ctx.roundRect(x - 13, y - 24, 26, 48, 7); ctx.fill();
            ctx.fillStyle = green ? "#475569" : "#ef4444";
            ctx.beginPath(); ctx.arc(x, y - 11, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = green ? "#22c55e" : "#475569";
            ctx.beginPath(); ctx.arc(x, y + 11, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#0f172a"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "center";
            ctx.fillText(label, x, y - 32); ctx.textAlign = "left";
          };
          light(424, 52, !!s.lights[0], "N–S");
          light(56, 316, !!s.lights[1], "E–W");
          if (!s.started) {
            ctx.fillStyle = "#0f172a"; ctx.font = "15px system-ui"; ctx.textAlign = "center";
            ctx.fillText("Tap the N–S or E–W light boxes to switch them", W / 2, 30);
            ctx.fillText("Keep traffic flowing — don't let cars crash!", W / 2, 52);
            ctx.textAlign = "left";
          }
          if (s.over) {
            ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "#fff"; ctx.font = "bold 24px system-ui"; ctx.textAlign = "center";
            ctx.fillText(`Crash! You lasted ${Math.floor(s.time)}s, ${s.passed} cars through`, W / 2, H / 2);
            ctx.textAlign = "left";
          }
        }}
      />
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button type="button" className="rounded-full bg-[var(--surface-alt)] px-4 py-2 font-bold"
          onClick={() => { state.current.lights[0] = !state.current.lights[0]; state.current.started = true; setTick((t) => t + 1); }}>
          🚦 N–S light: {state.current.lights[0] ? "🟢 Green" : "🔴 Red"}
        </button>
        <button type="button" className="rounded-full bg-[var(--surface-alt)] px-4 py-2 font-bold"
          onClick={() => { state.current.lights[1] = !state.current.lights[1]; state.current.started = true; setTick((t) => t + 1); }}>
          🚦 E–W light: {state.current.lights[1] ? "🟢 Green" : "🔴 Red"}
        </button>
        <RestartButton onClick={reset} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Bubble Pop */
type Bubble = { id: number; x: number; size: number; kind: "normal" | "gold" | "spiky"; born: number; drift: number };
function BubblePopGame() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [running, setRunning] = useState(false);
  const idRef = useRef(0);
  useEffect(() => {
    if (!running) return;
    const spawn = setInterval(() => {
      setBubbles((b) => {
        const now = Date.now();
        const alive = b.filter((x) => now - x.born < 4200);
        if (alive.length > 14) return alive;
        const roll = Math.random();
        return [...alive, {
          id: ++idRef.current,
          x: 4 + Math.random() * 88,
          size: 40 + Math.random() * 34,
          kind: roll < 0.12 ? "gold" : roll < 0.24 ? "spiky" : "normal",
          born: now,
          drift: Math.random() * 30 - 15,
        }];
      });
    }, 480);
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { setRunning(false); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { clearInterval(spawn); clearInterval(timer); };
  }, [running]);
  const start = () => { setBubbles([]); setScore(0); setTimeLeft(60); setRunning(true); };
  const pop = (b: Bubble) => {
    setBubbles((list) => list.filter((x) => x.id !== b.id));
    if (b.kind === "gold") setScore((s) => s + 5);
    else if (b.kind === "spiky") setTimeLeft((t) => Math.max(0, t - 3));
    else setScore((s) => s + 1);
  };
  return (
    <div>
      <ScoreBar items={[["Score", score], ["Time", `${timeLeft}s`]]} />
      <div className="relative h-80 overflow-hidden rounded-2xl bg-gradient-to-b from-sky-300 to-blue-500" aria-label="Bubble popping area">
        {bubbles.map((b) => (
          <button
            key={b.id}
            type="button"
            aria-label={b.kind === "gold" ? "Golden bubble, bonus points" : b.kind === "spiky" ? "Spiky bubble, avoid" : "Bubble"}
            onClick={() => pop(b)}
            className="pv-pop absolute flex items-center justify-center rounded-full text-2xl"
            style={{
              left: `${b.x}%`, bottom: "6%", width: b.size, height: b.size,
              transform: `translateX(${b.drift}px)`,
              background: b.kind === "gold"
                ? "radial-gradient(circle at 32% 30%, #fef9c3, #facc15)"
                : b.kind === "spiky"
                  ? "radial-gradient(circle at 32% 30%, #64748b, #1e293b)"
                  : "radial-gradient(circle at 32% 30%, rgba(255,255,255,0.95), rgba(125,211,252,0.55))",
              boxShadow: "inset 0 0 12px rgba(255,255,255,0.7)",
            }}
          >
            {b.kind === "spiky" ? "🦔" : b.kind === "gold" ? "⭐" : ""}
          </button>
        ))}
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 text-white">
            <p className="text-xl font-extrabold">{timeLeft === 60 ? "Ready to pop?" : `Time! Final score: ${score}`}</p>
            <button type="button" onClick={start} className="mt-3 rounded-full bg-white px-5 py-2 font-bold text-blue-700 shadow">
              {timeLeft === 60 ? "▶ Start popping" : "↻ Play again"}
            </button>
          </div>
        )}
      </div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">⭐ Golden bubbles: +5 · 🦔 Spiky bubbles: −3 seconds</p>
    </div>
  );
}

/* ------------------------------------------------------------- Maze Dash */
function generateMaze(cols: number, rows: number): boolean[][] {
  // walls[r][c] for cell grid; use visited carving on a (2*rows+1)x(2*cols+1) grid
  const gw = cols * 2 + 1;
  const gh = rows * 2 + 1;
  const walls: boolean[][] = Array.from({ length: gh }, () => Array(gw).fill(true));
  const stack: [number, number][] = [[0, 0]];
  walls[1]![1] = false;
  const visited = new Set(["0,0"]);
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1]!;
    const neighbors: [number, number][] = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, ny = cy + dy;
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !visited.has(`${nx},${ny}`)) neighbors.push([nx, ny]);
    }
    if (neighbors.length === 0) { stack.pop(); continue; }
    const [nx, ny] = neighbors[Math.floor(Math.random() * neighbors.length)]!;
    visited.add(`${nx},${ny}`);
    walls[cy * 2 + 1 + (ny - cy)]![cx * 2 + 1 + (nx - cx)] = false;
    walls[ny * 2 + 1]![nx * 2 + 1] = false;
    stack.push([nx, ny]);
  }
  return walls;
}
function MazeDashGame() {
  const COLS = 11;
  const ROWS = 8;
  const [walls, setWalls] = useState<boolean[][]>([]);
  const [player, setPlayer] = useState<[number, number]>([1, 1]);
  const [guard, setGuard] = useState<[number, number]>([19, 13]);
  const [keyPos] = useState<[number, number]>([19, 1]);
  const [hasKey, setHasKey] = useState(false);
  const [lives, setLives] = useState(3);
  const [steps, setSteps] = useState(0);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const exit: [number, number] = [19, 13];
  const start = useCallback(() => {
    setWalls(generateMaze(COLS, ROWS));
    setPlayer([1, 1]);
    setGuard([19, 13]);
    setHasKey(false);
    setLives(3);
    setSteps(0);
    setStatus("playing");
  }, []);
  useEffect(start, [start]);
  const move = useCallback((dx: number, dy: number) => {
    if (status !== "playing" || walls.length === 0) return;
    setPlayer(([x, y]) => {
      const nx = x + dx, ny = y + dy;
      if (walls[ny]?.[nx]) return [x, y];
      setSteps((s) => s + 1);
      if (nx === keyPos[0] && ny === keyPos[1]) setHasKey(true);
      return [nx, ny];
    });
    // guard drifts toward the player through open cells
    setGuard(([gx, gy]) => {
      const options: [number, number][] = [];
      for (const [dx2, dy2] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (!walls[gy + dy2]?.[gx + dx2]) options.push([gx + dx2, gy + dy2]);
      }
      if (options.length === 0) return [gx, gy];
      options.sort((a, b) =>
        (Math.abs(a[0] - player[0]) + Math.abs(a[1] - player[1])) -
        (Math.abs(b[0] - player[0]) + Math.abs(b[1] - player[1])));
      return Math.random() < 0.75 ? options[0]! : options[Math.floor(Math.random() * options.length)]!;
    });
  }, [status, walls, keyPos, hasKey, player, exit]);
  useEffect(() => {
    if (status !== "playing") return;
    if (player[0] === guard[0] && player[1] === guard[1]) {
      if (lives <= 1) { setStatus("lost"); setLives(0); }
      else {
        setLives((l) => l - 1);
        setPlayer([1, 1]);
        setGuard([19, 13]);
      }
    }
    if (player[0] === exit[0] && player[1] === exit[1] && hasKey) setStatus("won");
  }, [player, guard, lives, status, hasKey, exit]);
  useKeys((key) => {
    if (key === "ArrowUp" || key === "w") move(0, -1);
    else if (key === "ArrowDown" || key === "s") move(0, 1);
    else if (key === "ArrowLeft" || key === "a") move(-1, 0);
    else if (key === "ArrowRight" || key === "d") move(1, 0);
  });
  const cell = 480 / 23;
  return (
    <div>
      <ScoreBar items={[["Lives", "❤️".repeat(lives) || "—"], ["Steps", steps], ["Key", hasKey ? "🔑 Got it!" : "Find the 🔑"]]} />
      {status === "won" && <p className="pv-pop mb-2 rounded-xl bg-green-100 px-4 py-2 text-center font-bold text-green-800">🏆 You escaped the dungeon in {steps} steps!</p>}
      {status === "lost" && <p className="pv-pop mb-2 rounded-xl bg-red-100 px-4 py-2 text-center font-bold text-red-800">The guard caught you one too many times — game over.</p>}
      <div className="relative mx-auto w-full max-w-[480px] overflow-hidden rounded-xl bg-amber-100" style={{ aspectRatio: "23 / 17" }} aria-label="Dungeon maze">
        {walls.map((row, y) => row.map((wall, x) => wall ? (
          <div key={`${x}-${y}`} className="absolute bg-slate-700" style={{ left: `${(x / 23) * 100}%`, top: `${(y / 17) * 100}%`, width: `${100 / 23}%`, height: `${100 / 17}%` }} />
        ) : null))}
        <span className="absolute flex items-center justify-center" style={{ left: `${(keyPos[0] / 23) * 100}%`, top: `${(keyPos[1] / 17) * 100}%`, width: `${100 / 23}%`, height: `${100 / 17}%`, fontSize: cell * 0.8 }}>{hasKey ? "" : "🔑"}</span>
        <span className="absolute flex items-center justify-center" style={{ left: `${(exit[0] / 23) * 100}%`, top: `${(exit[1] / 17) * 100}%`, width: `${100 / 23}%`, height: `${100 / 17}%`, fontSize: cell * 0.8 }}>🚪</span>
        <span className="absolute flex items-center justify-center transition-all duration-150" style={{ left: `${(guard[0] / 23) * 100}%`, top: `${(guard[1] / 17) * 100}%`, width: `${100 / 23}%`, height: `${100 / 17}%`, fontSize: cell * 0.85 }}>👹</span>
        <span className="absolute flex items-center justify-center transition-all duration-150" style={{ left: `${(player[0] / 23) * 100}%`, top: `${(player[1] / 17) * 100}%`, width: `${100 / 23}%`, height: `${100 / 17}%`, fontSize: cell * 0.85 }}>🧙</span>
      </div>
      <div className="mt-3 flex justify-center"><RestartButton onClick={start} label="↻ New dungeon" /></div>
      <DPad onDir={move} />
    </div>
  );
}

/* -------------------------------------------------------------- dispatch */
export function BuiltinGame({ gameKey }: { gameKey: string }) {
  switch (gameKey) {
    case "snake": return <SnakeGame />;
    case "memory": return <MemoryGame />;
    case "breakout": return <BreakoutGame />;
    case "reaction": return <ReactionGame />;
    case "merge2048": return <MergeGame />;
    case "flappy": return <FlappyGame />;
    case "tictactoe": return <TicTacToeGame />;
    case "racer": return <RacerGame />;
    case "shooter": return <ShooterGame />;
    case "wordguess": return <WordGuessGame />;
    case "match3": return <Match3Game />;
    case "traffic": return <TrafficGame />;
    case "bubblepop": return <BubblePopGame />;
    case "mazedash": return <MazeDashGame />;
    default: {
      const Expansion = EXPANSION_GAMES[gameKey];
      if (Expansion) return <Expansion />;
      return <p className="rounded-xl bg-amber-50 px-4 py-3 text-amber-800">This built-in game is not available in this build.</p>;
    }
  }
}
