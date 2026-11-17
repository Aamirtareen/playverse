// PlayVerse expansion — Puzzle, Strategy & Adventure originals.
// Grid/board games are DOM-based; all share the kit's HUD, banners, sound
// and best-score helpers.

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { ActionButton, Banner, Engine, H, ScoreBar, W, beep, clamp, rand, randi, shuffle, useBest } from "./gamekit";

/* --------------------------------------------------------------- Minefield */
type MineCell = { mine: boolean; open: boolean; flag: boolean; n: number };
function buildMines(firstSafe: number): MineCell[] {
  const cells: MineCell[] = Array.from({ length: 81 }, () => ({ mine: false, open: false, flag: false, n: 0 }));
  const safe = new Set([firstSafe, firstSafe - 1, firstSafe + 1, firstSafe - 9, firstSafe + 9, firstSafe - 10, firstSafe + 10, firstSafe - 8, firstSafe + 8]);
  let placed = 0;
  while (placed < 10) {
    const i = randi(0, 80);
    if (!cells[i]!.mine && !safe.has(i)) { cells[i]!.mine = true; placed++; }
  }
  for (let i = 0; i < 81; i++) {
    const x = i % 9, y = Math.floor(i / 9);
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < 9 && ny >= 0 && ny < 9 && cells[ny * 9 + nx]!.mine) n++;
    }
    cells[i]!.n = n;
  }
  return cells;
}
function MinefieldGame() {
  const [cells, setCells] = useState<MineCell[] | null>(null);
  const [shields, setShields] = useState(3);
  const [over, setOver] = useState<"win" | "lose" | null>(null);
  const [flagMode, setFlagMode] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [best, recordBest] = useBest("minefield");
  const startedRef = useRef(false);
  useEffect(() => {
    if (!cells || over) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [cells, over]);
  const opened = cells?.filter((c) => c.open).length ?? 0;
  const score = opened * 10 + (over === "win" ? Math.max(0, 400 - seconds * 2) : 0);
  useEffect(() => { if (over === "win") recordBest(score); }, [over, score, recordBest]);
  const start = () => { setCells(null); setShields(3); setOver(null); setSeconds(0); startedRef.current = false; };
  const reveal = (board: MineCell[], idx: number) => {
    const stack = [idx];
    while (stack.length) {
      const i = stack.pop()!;
      const c = board[i]!;
      if (c.open || c.flag || c.mine) continue;
      c.open = true;
      if (c.n === 0) {
        const x = i % 9, y = Math.floor(i / 9);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < 9 && ny >= 0 && ny < 9) stack.push(ny * 9 + nx);
        }
      }
    }
  };
  const click = (i: number) => {
    if (over) return;
    let board = cells;
    if (!board) {
      board = buildMines(i);
      startedRef.current = true;
    }
    const next = board.map((c) => ({ ...c }));
    const cell = next[i]!;
    if (flagMode) {
      if (!cell.open) { cell.flag = !cell.flag; beep(cell.flag ? 500 : 300, 0.04); }
      setCells(next);
      return;
    }
    if (cell.flag || cell.open) return;
    if (cell.mine) {
      cell.open = true;
      const ns = shields - 1;
      setShields(ns);
      beep(90, 0.3, "sawtooth");
      if (ns <= 0) { setOver("lose"); setCells(next); return; }
      setCells(next);
      return;
    }
    reveal(next, i);
    beep(640, 0.04);
    if (next.filter((c) => c.open && !c.mine).length === 71) setOver("win");
    setCells(next);
  };
  const numColors = ["", "text-blue-600", "text-green-600", "text-red-500", "text-violet-600", "text-amber-600", "text-cyan-600", "text-slate-800", "text-slate-500"];
  return (
    <div>
      <ScoreBar items={[["Opened", opened], ["Shields", "🛡️".repeat(shields) || "—"], ["Time", `${seconds}s`], ["Best", best]]} />
      {over === "win" && <Banner tone="win">🏆 Field cleared in {seconds}s — score {score}!</Banner>}
      {over === "lose" && <Banner tone="lose">💥 Third mine — the field wins this time. Score {score}.</Banner>}
      {!cells && !over && <Banner tone="info">Tap any square to start — your first tap is always safe. You have 3 shields against 10 mines.</Banner>}
      <div className="mx-auto grid max-w-[360px] grid-cols-9 gap-1" role="grid" aria-label="Minefield board">
        {(cells ?? Array.from({ length: 81 }, () => ({ mine: false, open: false, flag: false, n: 0 }))).map((c, i) => (
          <button
            key={i} type="button" role="gridcell"
            aria-label={c.open ? (c.mine ? "Mine" : `Open, ${c.n} nearby`) : c.flag ? "Flagged" : "Covered"}
            onClick={() => click(i)}
            className={`flex aspect-square items-center justify-center rounded-md text-sm font-extrabold ${
              c.open ? (c.mine ? "bg-red-200" : "bg-[var(--surface-alt)]") : "bg-emerald-500 shadow hover:bg-emerald-400"
            } ${numColors[c.n] ?? ""}`}
          >
            {c.open ? (c.mine ? "💣" : c.n > 0 ? c.n : "") : c.flag ? "🚩" : ""}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <ActionButton onClick={() => setFlagMode((f) => !f)} label={flagMode ? "🚩 Flag mode: ON" : "🚩 Flag mode: OFF"} primary={flagMode} />
        <ActionButton onClick={start} label="↻ New field" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Sudoku Sprint */
const SUDOKU_SOLUTION = [
  1, 2, 3, 4, 5, 6,
  4, 5, 6, 1, 2, 3,
  2, 3, 1, 5, 6, 4,
  5, 6, 4, 2, 3, 1,
  3, 1, 2, 6, 4, 5,
  6, 4, 5, 3, 1, 2,
];
function SudokuGame() {
  const [puzzle, setPuzzle] = useState<{ givens: boolean[]; values: number[] } | null>(null);
  const [sel, setSel] = useState(-1);
  const [mistakes, setMistakes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState<"win" | "lose" | null>(null);
  const [sol, setPuzzleSol] = useState<number[]>(SUDOKU_SOLUTION);
  const [best, recordBest] = useBest("sudoku-sprint");
  useEffect(() => {
    if (!puzzle || done) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [puzzle, done]);
  const start = useCallback(() => {
    // Permute digits, rows within bands and columns within stacks for a fresh puzzle.
    const digitMap = shuffle([1, 2, 3, 4, 5, 6]);
    const bandRows = shuffle([0, 1]);
    const rowsOrder: number[] = [];
    for (const b of bandRows) {
      const within = shuffle([0, 1, 2]);
      for (const r of within) rowsOrder.push(b * 3 + r);
    }
    const sol: number[] = new Array(36);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
      sol[r * 6 + c] = digitMap[SUDOKU_SOLUTION[rowsOrder[r]! * 6 + c]! - 1]!;
    }
    const givens = new Array(36).fill(false);
    const idxs = shuffle([...Array(36).keys()]);
    for (let i = 0; i < 17; i++) givens[idxs[i]!] = true;
    setPuzzle({ givens, values: sol.map((v, i) => (givens[i] ? v : 0)) });
    setPuzzleSol(sol);
    setSel(-1); setMistakes(0); setSeconds(0); setDone(null);
  }, []);
  useEffect(() => { start(); }, [start]);
  const filled = puzzle?.values.filter((v) => v > 0).length ?? 0;
  const score = done === "win" ? Math.max(60, 700 - seconds * 3 - mistakes * 60) : filled * 8;
  useEffect(() => { if (done === "win") recordBest(score); }, [done, score, recordBest]);
  const place = (n: number) => {
    if (!puzzle || sel < 0 || done) return;
    if (puzzle.givens[sel]) return;
    if (sol[sel] === n) {
      const values = [...puzzle.values];
      values[sel] = n;
      setPuzzle({ ...puzzle, values });
      beep(700, 0.05);
      if (values.every((v) => v > 0)) setDone("win");
    } else {
      const m = mistakes + 1;
      setMistakes(m);
      beep(140, 0.15, "sawtooth");
      if (m >= 3) setDone("lose");
    }
  };
  return (
    <div>
      <ScoreBar items={[["Filled", `${filled}/36`], ["Mistakes", `${mistakes}/3`], ["Time", `${seconds}s`], ["Best", best]]} />
      {done === "win" && <Banner tone="win">🏆 Sudoku solved in {seconds}s — score {score}!</Banner>}
      {done === "lose" && <Banner tone="lose">Three mistakes — the grid wins. Start a new puzzle to try again.</Banner>}
      <div className="mx-auto grid max-w-[330px] grid-cols-6 gap-0.5 rounded-xl bg-slate-700 p-1.5" role="grid" aria-label="Sudoku grid">
        {puzzle?.values.map((v, i) => (
          <button
            key={i} type="button" role="gridcell"
            aria-label={`Cell ${i + 1}${puzzle.givens[i] ? `, given ${v}` : v ? `, filled ${v}` : ", empty"}`}
            onClick={() => setSel(i)}
            className={`flex aspect-square items-center justify-center rounded text-lg font-extrabold ${
              sel === i ? "bg-amber-300" : puzzle.givens[i] ? "bg-slate-200 text-slate-800" : "bg-white text-blue-700"
            } ${(i % 6 === 2) ? "mr-1" : ""} ${(Math.floor(i / 6) === 1 || Math.floor(i / 6) === 3) ? "mb-1" : ""}`}
          >
            {v || ""}
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-1.5" aria-label="Number pad">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button key={n} type="button" onClick={() => place(n)} aria-label={`Place ${n}`}
            className="h-11 w-11 rounded-full bg-[var(--accent)] text-lg font-extrabold text-white shadow hover:brightness-110">
            {n}
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New puzzle" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Every row, column and 2×3 box must contain 1–6 exactly once. Wrong numbers cost a mistake — three ends the run.</p>
    </div>
  );
}

/* ----------------------------------------------------------- Sliding Puzzle */
function SlidingGame() {
  const [tiles, setTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [best, recordBest] = useBest("sliding-puzzle");
  const start = useCallback(() => {
    let t = [...Array(16).keys()];
    // Shuffle by random legal slides from solved state: always solvable.
    let blank = 15;
    for (let i = 0; i < 160; i++) {
      const x = blank % 4, y = Math.floor(blank / 4);
      const opts: number[] = [];
      if (x > 0) opts.push(blank - 1);
      if (x < 3) opts.push(blank + 1);
      if (y > 0) opts.push(blank - 4);
      if (y < 3) opts.push(blank + 4);
      const pick = opts[randi(0, opts.length - 1)]!;
      [t[blank], t[pick]] = [t[pick]!, t[blank]!];
      blank = pick;
    }
    setTiles(t); setMoves(0); setWon(false);
  }, []);
  useEffect(() => { start(); }, [start]);
  const score = won ? Math.max(50, 600 - moves * 3) : 0;
  useEffect(() => { if (won) recordBest(score); }, [won, score, recordBest]);
  const slide = (i: number) => {
    if (won) return;
    const blank = tiles.indexOf(0);
    const x = i % 4, y = Math.floor(i / 4);
    const bx = blank % 4, by = Math.floor(blank / 4);
    if (Math.abs(x - bx) + Math.abs(y - by) !== 1) return;
    const t = [...tiles];
    [t[blank], t[i]] = [t[i]!, t[blank]!];
    setTiles(t);
    setMoves((m) => m + 1);
    beep(480, 0.04);
    if (t.every((v, idx) => v === (idx + 1) % 16)) setWon(true);
  };
  return (
    <div>
      <ScoreBar items={[["Moves", moves], ["Best score", best]]} />
      {won && <Banner tone="win">🏆 Solved in {moves} moves — score {score}!</Banner>}
      <div className="mx-auto grid max-w-[320px] grid-cols-4 gap-1.5 rounded-2xl bg-slate-800 p-2" role="grid" aria-label="Sliding puzzle">
        {tiles.map((v, i) => (
          <button key={i} type="button" role="gridcell" aria-label={v === 0 ? "Empty space" : `Tile ${v}`}
            onClick={() => slide(i)}
            className={`flex aspect-square items-center justify-center rounded-xl text-xl font-extrabold ${
              v === 0 ? "bg-slate-700" : v === i + 1 ? "bg-emerald-500 text-white" : "bg-amber-400 text-amber-950"
            }`}>
            {v || ""}
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ Shuffle again" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Slide tiles into the empty space to order them 1–15. Green tiles are already home.</p>
    </div>
  );
}

/* --------------------------------------------------------------- Lights Out */
function LightsOutGame() {
  const [lights, setLights] = useState<boolean[]>([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [best, recordBest] = useBest("lights-out");
  const toggleAt = (board: boolean[], i: number) => {
    const x = i % 5, y = Math.floor(i / 5);
    const flip = (j: number) => { board[j] = !board[j]; };
    flip(i);
    if (x > 0) flip(i - 1);
    if (x < 4) flip(i + 1);
    if (y > 0) flip(i - 5);
    if (y < 4) flip(i + 5);
  };
  const start = useCallback(() => {
    const board = new Array(25).fill(false);
    // Scramble with random presses from the solved state: always solvable.
    for (let k = 0; k < 11; k++) toggleAt(board, randi(0, 24));
    if (board.every((v) => !v)) toggleAt(board, 12);
    setLights(board); setMoves(0); setWon(false);
  }, []);
  useEffect(() => { start(); }, [start]);
  const score = won ? Math.max(40, 400 - moves * 12) : 0;
  useEffect(() => { if (won) recordBest(score); }, [won, score, recordBest]);
  const press = (i: number) => {
    if (won) return;
    const board = [...lights];
    toggleAt(board, i);
    setLights(board);
    setMoves((m) => m + 1);
    beep(560, 0.04);
    if (board.every((v) => !v)) setWon(true);
  };
  return (
    <div>
      <ScoreBar items={[["Moves", moves], ["Lights on", lights.filter(Boolean).length], ["Best", best]]} />
      {won && <Banner tone="win">🏆 All lights out in {moves} presses — score {score}!</Banner>}
      <div className="mx-auto grid max-w-[300px] grid-cols-5 gap-1.5" role="grid" aria-label="Lights Out board">
        {lights.map((on, i) => (
          <button key={i} type="button" role="gridcell" aria-label={on ? `Light ${i + 1} on` : `Light ${i + 1} off`}
            onClick={() => press(i)}
            className={`flex aspect-square items-center justify-center rounded-xl text-2xl ${on ? "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.8)]" : "bg-slate-700"}`}>
            {on ? "💡" : "·"}
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New puzzle" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Pressing a light toggles it and its four neighbors. Turn every light off to win.</p>
    </div>
  );
}

/* ------------------------------------------------------------ Tower of Hanoi */
function HanoiGame() {
  const [pegs, setPegs] = useState<number[][]>([[5, 4, 3, 2, 1], [], []]);
  const [held, setHeld] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [best, recordBest] = useBest("hanoi");
  const won = pegs[2]?.length === 5;
  const score = won ? Math.max(30, 500 - (moves - 31) * 8) : 0;
  useEffect(() => { if (won) { recordBest(score); beep(620, 0.15, "triangle"); } }, [won, score, recordBest]);
  const start = () => { setPegs([[5, 4, 3, 2, 1], [], []]); setHeld(null); setMoves(0); };
  const tapPeg = (p: number) => {
    if (won) return;
    if (held === null) {
      if ((pegs[p]?.length ?? 0) > 0) { setHeld(p); beep(500, 0.04); }
      return;
    }
    if (held === p) { setHeld(null); return; }
    const from = pegs[held]!;
    const disk = from[from.length - 1]!;
    const to = pegs[p]!;
    const topTo = to[to.length - 1];
    if (topTo !== undefined && topTo < disk) { beep(140, 0.12, "sawtooth"); setHeld(null); return; }
    const next = pegs.map((peg) => [...peg]);
    next[held] = next[held]!.slice(0, -1);
    next[p] = [...next[p]!, disk];
    setPegs(next);
    setMoves((m) => m + 1);
    setHeld(null);
    beep(660, 0.05);
  };
  const diskColors = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-blue-500"];
  return (
    <div>
      <ScoreBar items={[["Moves", moves], ["Perfect game", 31], ["Best", best]]} />
      {won && <Banner tone="win">🏆 Tower moved in {moves} moves — score {score}! (31 is perfect.)</Banner>}
      <div className="mx-auto flex max-w-[420px] items-end justify-around gap-2" role="group" aria-label="Hanoi pegs">
        {pegs.map((peg, p) => (
          <button key={p} type="button" onClick={() => tapPeg(p)} aria-label={`Peg ${p + 1}${held === p ? ", holding a disk" : ""}`}
            className={`flex h-44 w-28 flex-col-reverse items-center rounded-xl pb-1 ring-2 ${held === p ? "bg-amber-100 ring-amber-400" : "bg-[var(--surface-alt)] ring-transparent"}`}>
            <span className="mb-1 h-1.5 w-full bg-slate-400" />
            {peg.map((d) => (
              <span key={d} className={`mb-1 flex h-6 items-center justify-center rounded-full text-xs font-extrabold text-white ${diskColors[d]}`} style={{ width: `${26 + d * 13}%` }}>
                {d}
              </span>
            ))}
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ Restart" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Tap a peg to pick up its top disk, tap another to drop it. A disk may never rest on a smaller disk. Move the whole tower to the third peg.</p>
    </div>
  );
}

/* -------------------------------------------------------------- Color Flood */
const FLOOD_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#ec4899"];
function FloodGame() {
  const [board, setBoard] = useState<string[]>([]);
  const [steps, setSteps] = useState(0);
  const [won, setWon] = useState(false);
  const [best, recordBest] = useBest("color-flood");
  const start = useCallback(() => {
    setBoard(Array.from({ length: 100 }, () => FLOOD_COLORS[randi(0, 5)]!));
    setSteps(0); setWon(false);
  }, []);
  useEffect(() => { start(); }, [start]);
  const score = won ? Math.max(40, 500 - steps * 18) : 0;
  useEffect(() => { if (won) recordBest(score); }, [won, score, recordBest]);
  const floodRegion = (b: string[]): Set<number> => {
    const target = b[0]!;
    const region = new Set<number>([0]);
    const stack = [0];
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % 10, y = Math.floor(i / 10);
      const nb = [x > 0 ? i - 1 : -1, x < 9 ? i + 1 : -1, y > 0 ? i - 10 : -1, y < 9 ? i + 10 : -1];
      for (const j of nb) if (j >= 0 && !region.has(j) && b[j] === target) { region.add(j); stack.push(j); }
    }
    return region;
  };
  const pick = (color: string) => {
    if (won || steps >= 18 || board[0] === color) return;
    // Recolor the current flooded region; because the region is defined by
    // same-color connectivity from the corner, the recolored region then
    // automatically touches (and visually joins) every adjacent cell that
    // already has the new color.
    const region = floodRegion(board);
    const next = [...board];
    for (const i of region) next[i] = color;
    setBoard(next);
    const ns = steps + 1;
    setSteps(ns);
    beep(520, 0.05);
    if (next.every((c) => c === color)) setWon(true);
  };
  return (
    <div>
      <ScoreBar items={[["Steps", `${steps}/18`], ["Best", best]]} />
      {won && <Banner tone="win">🏆 Board flooded in {steps} steps — score {score}!</Banner>}
      {!won && steps >= 18 && <Banner tone="lose">Out of steps! The board kept {new Set(board).size} colors. Try a new board.</Banner>}
      <div className="mx-auto grid max-w-[330px] grid-cols-10 gap-0.5" aria-label="Flood board">
        {board.map((c, i) => (
          <span key={i} className="aspect-square rounded-[3px]" style={{ backgroundColor: c }} />
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-2" aria-label="Choose flood color">
        {FLOOD_COLORS.map((c) => (
          <button key={c} type="button" aria-label={`Flood with color ${c}`} onClick={() => pick(c)}
            className="h-11 w-11 rounded-full shadow ring-2 ring-white hover:scale-110" style={{ backgroundColor: c }} />
        ))}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New board" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Your flood starts at the top-left corner. Each color choice recolors the flooded area and absorbs matching neighbors. Fill the whole board in 18 steps.</p>
    </div>
  );
}

/* ------------------------------------------------------------- Pipe Connect */
type PipeKind = "straight" | "elbow" | "tee" | "cross" | "source" | "sink";
// Openings bitmask per kind at rotation 0: N=1, E=2, S=4, W=8.
const PIPE_BASE: Record<PipeKind, number> = { straight: 5, elbow: 3, tee: 7, cross: 15, source: 2, sink: 8 };
function rotMask(mask: number, rot: number): number {
  let m = mask;
  for (let i = 0; i < rot; i++) m = ((m << 1) & 15) | ((m >> 3) & 1);
  return m;
}
type PipeCell = { kind: PipeKind; rot: number };
function buildPipes(): PipeCell[] {
  // Carve a guaranteed path from source (row 2, col 0) to sink (row 2, col 4).
  const kinds: PipeKind[][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => (["straight", "elbow", "tee"] as PipeKind[])[randi(0, 2)]!));
  const rots: number[][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => randi(0, 3)));
  // Simple guaranteed path: row 2 straight across, with pieces set to valid kinds.
  for (let c = 1; c < 4; c++) { kinds[2]![c] = "straight"; rots[2]![c] = 1; }
  kinds[2]![0] = "source"; kinds[2]![4] = "sink";
  // Then scramble every rotatable piece.
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    if (kinds[r]![c] !== "source" && kinds[r]![c] !== "sink") rots[r]![c] = randi(0, 3);
  }
  // Ensure the scramble didn't accidentally keep row 2 solved in a trivial way is fine.
  const cells: PipeCell[] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) cells.push({ kind: kinds[r]![c]!, rot: rots[r]![c]! });
  return cells;
}
function pipeFlow(cells: PipeCell[]): Set<number> {
  const open = (i: number) => rotMask(PIPE_BASE[cells[i]!.kind], cells[i]!.rot);
  const seen = new Set<number>();
  const startIdx = 2 * 5 + 0;
  const stack = [startIdx];
  seen.add(startIdx);
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % 5, y = Math.floor(i / 5);
    const m = open(i);
    const tryGo = (dir: number, nx: number, ny: number, opp: number) => {
      if (!(m & dir)) return;
      if (nx < 0 || nx > 4 || ny < 0 || ny > 4) return;
      const j = ny * 5 + nx;
      if (seen.has(j)) return;
      if (open(j) & opp) { seen.add(j); stack.push(j); }
    };
    tryGo(1, x, y - 1, 4);
    tryGo(2, x + 1, y, 8);
    tryGo(4, x, y + 1, 1);
    tryGo(8, x - 1, y, 2);
  }
  return seen;
}
function PipeGame() {
  const [cells, setCells] = useState<PipeCell[]>(() => buildPipes());
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [best, recordBest] = useBest("pipe-connect");
  const flow = pipeFlow(cells);
  const solved = flow.has(2 * 5 + 4);
  const score = solved ? Math.max(40, 500 - moves * 4 - seconds) : 0;
  useEffect(() => {
    if (solved) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [solved]);
  useEffect(() => { if (solved) { recordBest(score); beep(620, 0.15, "triangle"); } }, [solved, score, recordBest]);
  const rotate = (i: number) => {
    if (solved) return;
    const cell = cells[i]!;
    if (cell.kind === "source" || cell.kind === "sink") return;
    const next = [...cells];
    next[i] = { ...cell, rot: (cell.rot + 1) % 4 };
    setCells(next);
    setMoves((m) => m + 1);
    beep(480, 0.04);
  };
  const start = () => { setCells(buildPipes()); setMoves(0); setSeconds(0); };
  const glyph = (cell: PipeCell) => {
    if (cell.kind === "source") return "🚰";
    if (cell.kind === "sink") return "🪣";
    const m = rotMask(PIPE_BASE[cell.kind], cell.rot);
    const horiz = (m & 2 ? "─" : "") + (m & 8 ? "─" : "");
    void horiz;
    if (cell.kind === "cross") return "✚";
    if (cell.kind === "straight") return (m & 5) === 5 ? "│" : "─";
    if (cell.kind === "tee") return ["┬", "├", "┴", "┤"][cell.rot] ?? "┬";
    return ["┌", "┐", "┘", "└"][cell.rot] ?? "┌";
  };
  return (
    <div>
      <ScoreBar items={[["Rotations", moves], ["Time", `${seconds}s`], ["Best", best]]} />
      {solved && <Banner tone="win">🏆 Water flows! Solved in {moves} rotations — score {score}.</Banner>}
      <div className="mx-auto grid max-w-[300px] grid-cols-5 gap-1" role="grid" aria-label="Pipe board">
        {cells.map((cell, i) => (
          <button key={i} type="button" role="gridcell" aria-label={`Pipe ${i + 1}, ${cell.kind}`}
            onClick={() => rotate(i)}
            className={`flex aspect-square items-center justify-center rounded-lg text-2xl font-bold ${
              flow.has(i) ? "bg-sky-200 text-sky-800" : "bg-[var(--surface-alt)] text-slate-500"
            }`}>
            {glyph(cell)}
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New pipes" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Tap a pipe to rotate it 90°. Connect the tap 🚰 on the left to the bucket 🪣 on the right — connected pipes turn blue.</p>
    </div>
  );
}

/* -------------------------------------------------------------- Word Search */
const WS_WORDS = ["PLANET", "ROCKET", "OCEAN", "TIGER", "MUSIC", "CASTLE"];
function buildWordSearch() {
  const size = 10;
  const grid: string[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => ""));
  const placed: { word: string; cells: number[] }[] = [];
  const dirs = [[1, 0], [0, 1], [1, 1]] as const;
  for (const word of WS_WORDS) {
    let done = false;
    for (let tries = 0; tries < 60 && !done; tries++) {
      const [dx, dy] = dirs[randi(0, 2)]!;
      const x = randi(0, size - 1 - (dx ? word.length - 1 : 0));
      const y = randi(0, size - 1 - (dy ? word.length - 1 : 0));
      let ok = true;
      const cellsIdx: number[] = [];
      for (let i = 0; i < word.length; i++) {
        const cx = x + dx * i, cy = y + dy * i;
        const cur = grid[cy]![cx]!;
        if (cur && cur !== word[i]) { ok = false; break; }
        cellsIdx.push(cy * size + cx);
      }
      if (!ok) continue;
      for (let i = 0; i < word.length; i++) grid[y + dy * i]![x + dx * i] = word[i]!;
      placed.push({ word, cells: cellsIdx });
      done = true;
    }
  }
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!grid[y]![x]) grid[y]![x] = letters[randi(0, 25)]!;
  }
  return { flat: grid.flat(), placed };
}
function WordSearchGame() {
  const [data, setData] = useState(buildWordSearch);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [best, recordBest] = useBest("word-search");
  const won = found.size === data.placed.length && data.placed.length > 0;
  const score = won ? Math.max(60, 600 - seconds * 2) : found.size * 60;
  useEffect(() => {
    if (won) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [won]);
  useEffect(() => { if (won) recordBest(score); }, [won, score, recordBest]);
  const foundCells = new Set<number>();
  for (const p of data.placed) if (found.has(p.word)) for (const c of p.cells) foundCells.add(c);
  const tap = (i: number) => {
    if (won) return;
    if (anchor === null) { setAnchor(i); beep(500, 0.03); return; }
    const ax = anchor % 10, ay = Math.floor(anchor / 10);
    const bx = i % 10, by = Math.floor(i / 10);
    const dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
    const len = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    const cellsIdx: number[] = [];
    if ((dx === 0 || dy === 0 || Math.abs(bx - ax) === Math.abs(by - ay)) && len > 1) {
      for (let k = 0; k <= len; k++) cellsIdx.push((ay + dy * k) * 10 + (ax + dx * k));
    }
    const match = data.placed.find((p) => !found.has(p.word) && p.cells.length === cellsIdx.length && p.cells.every((c) => cellsIdx.includes(c)));
    if (match) {
      setFound((f) => new Set(f).add(match.word));
      beep(720, 0.09, "triangle");
    } else {
      beep(160, 0.1, "sawtooth");
    }
    setAnchor(null);
  };
  const start = () => { setData(buildWordSearch()); setFound(new Set()); setAnchor(null); setSeconds(0); };
  return (
    <div>
      <ScoreBar items={[["Found", `${found.size}/${data.placed.length}`], ["Time", `${seconds}s`], ["Best", best]]} />
      {won && <Banner tone="win">🏆 All words found in {seconds}s — score {score}!</Banner>}
      <p className="mb-2 text-center text-sm font-semibold">
        Find: {data.placed.map((p) => (
          <span key={p.word} className={`mx-1 rounded-full px-2 py-0.5 ${found.has(p.word) ? "bg-green-100 text-green-700 line-through" : "bg-[var(--surface-alt)]"}`}>{p.word}</span>
        ))}
      </p>
      <div className="mx-auto grid max-w-[340px] grid-cols-10 gap-0.5" role="grid" aria-label="Word search grid">
        {data.flat.map((ch, i) => (
          <button key={i} type="button" role="gridcell" aria-label={`Letter ${ch}`}
            onClick={() => tap(i)}
            className={`flex aspect-square items-center justify-center rounded text-sm font-extrabold ${
              foundCells.has(i) ? "bg-green-400 text-white" : anchor === i ? "bg-amber-300" : "bg-[var(--surface-alt)] hover:bg-amber-100"
            }`}>
            {ch}
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New puzzle" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Tap the first letter of a word, then its last letter. Words run across, down or diagonally.</p>
    </div>
  );
}

/* ---------------------------------------------------------------- Block Fit */
type Piece = { cells: [number, number][]; color: string; id: number };
const PIECE_SHAPES: { cells: [number, number][]; color: string }[] = [
  { cells: [[0, 0], [1, 0], [2, 0]], color: "#ef4444" },
  { cells: [[0, 0], [0, 1], [0, 2]], color: "#f97316" },
  { cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: "#eab308" },
  { cells: [[0, 0], [1, 0], [2, 0], [1, 1]], color: "#22c55e" },
  { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: "#06b6d4" },
  { cells: [[0, 0], [1, 0], [1, 1], [1, 2]], color: "#3b82f6" },
  { cells: [[0, 0]], color: "#a855f7" },
  { cells: [[0, 0], [1, 0]], color: "#ec4899" },
  { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], color: "#14b8a6" },
  { cells: [[0, 0], [0, 1], [1, 1]], color: "#f43f5e" },
];
let pieceId = 1;
function newPiece(): Piece {
  const s = PIECE_SHAPES[randi(0, PIECE_SHAPES.length - 1)]!;
  return { cells: s.cells, color: s.color, id: pieceId++ };
}
function BlockFitGame() {
  const [board, setBoard] = useState<(string | null)[]>(() => new Array(64).fill(null));
  const [pieces, setPieces] = useState<Piece[]>(() => [newPiece(), newPiece(), newPiece()]);
  const [selected, setSelected] = useState(0);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [best, recordBest] = useBest("block-fit");
  const canPlace = (b: (string | null)[], piece: Piece, gx: number, gy: number) =>
    piece.cells.every(([dx, dy]) => {
      const x = gx + dx, y = gy + dy;
      return x >= 0 && x < 8 && y >= 0 && y < 8 && !b[y * 8 + x];
    });
  const anyMove = (b: (string | null)[], ps: Piece[]) =>
    ps.some((p) => {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (canPlace(b, p, x, y)) return true;
      return false;
    });
  const place = (gx: number, gy: number) => {
    if (over) return;
    const piece = pieces[selected] ?? pieces[0];
    if (!piece || !canPlace(board, piece, gx, gy)) { beep(150, 0.09, "sawtooth"); return; }
    const next = [...board];
    for (const [dx, dy] of piece.cells) next[(gy + dy) * 8 + (gx + dx)] = piece.color;
    let gained = piece.cells.length;
    const rows: number[] = [], cols: number[] = [];
    for (let y = 0; y < 8; y++) if ([...Array(8).keys()].every((x) => next[y * 8 + x])) rows.push(y);
    for (let x = 0; x < 8; x++) if ([...Array(8).keys()].every((y) => next[y * 8 + x])) cols.push(x);
    for (const y of rows) for (let x = 0; x < 8; x++) next[y * 8 + x] = null;
    for (const x of cols) for (let y = 0; y < 8; y++) next[y * 8 + x] = null;
    const lines = rows.length + cols.length;
    if (lines > 0) gained += lines * 10 + (lines > 1 ? (lines - 1) * 10 : 0);
    setBoard(next);
    setScore((s) => s + gained);
    beep(lines > 0 ? 760 : 520, 0.06);
    const rest = pieces.filter((p) => p.id !== piece.id);
    const nextPieces = rest.length === 0 ? [newPiece(), newPiece(), newPiece()] : rest;
    setPieces(nextPieces);
    setSelected(0);
    if (!anyMove(next, nextPieces)) {
      setOver(true);
      recordBest(score + gained);
      beep(130, 0.25, "sawtooth");
    }
  };
  const start = () => {
    setBoard(new Array(64).fill(null));
    setPieces([newPiece(), newPiece(), newPiece()]);
    setSelected(0); setScore(0); setOver(false);
  };
  const active = pieces[Math.min(selected, pieces.length - 1)];
  return (
    <div>
      <ScoreBar items={[["Score", score], ["Best", best]]} />
      {over && <Banner tone="lose">No piece fits anywhere — game over! Final score {score}.</Banner>}
      <div className="mx-auto grid max-w-[320px] grid-cols-8 gap-0.5 rounded-xl bg-slate-800 p-1.5" role="grid" aria-label="Block fit board">
        {board.map((c, i) => (
          <button key={i} type="button" role="gridcell" aria-label={c ? "Filled cell" : "Empty cell"}
            onClick={() => place(i % 8, Math.floor(i / 8))}
            className="aspect-square rounded-[4px]"
            style={{ backgroundColor: c ?? "#334155" }} />
        ))}
      </div>
      <div className="mt-3 flex items-start justify-center gap-3" aria-label="Your pieces">
        {pieces.map((p, i) => (
          <button key={p.id} type="button" onClick={() => setSelected(i)} aria-label={`Select piece ${i + 1}`} aria-pressed={active?.id === p.id}
            className={`rounded-xl p-2 ring-2 ${active?.id === p.id ? "bg-amber-100 ring-amber-400" : "bg-[var(--surface-alt)] ring-transparent"}`}>
            <span className="grid grid-cols-4 gap-0.5">
              {Array.from({ length: 16 }, (_, k) => {
                const x = k % 4, y = Math.floor(k / 4);
                const on = p.cells.some(([cx, cy]) => cx === x && cy === y);
                return <span key={k} className="h-3.5 w-3.5 rounded-[3px]" style={{ backgroundColor: on ? p.color : "transparent" }} />;
              })}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New game" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Select a piece, then tap the board to place its top-left corner. Fill a full row or column to clear it.</p>
    </div>
  );
}

export const GAMES4A: Record<string, ComponentType> = {
  minefield: MinefieldGame,
  "sudoku-sprint": SudokuGame,
  "sliding-puzzle": SlidingGame,
  "lights-out": LightsOutGame,
  hanoi: HanoiGame,
  "color-flood": FloodGame,
  "pipe-connect": PipeGame,
  "word-search": WordSearchGame,
  "block-fit": BlockFitGame,
};

/* ------------------------------------------------------------ Connect Four */
type C4 = (0 | 1 | 2)[][];
function c4Winner(b: C4): number {
  const dirs: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let y = 0; y < 6; y++) for (let x = 0; x < 7; x++) {
    const v = b[y]![x]!;
    if (!v) continue;
    for (const [dx, dy] of dirs) {
      let ok = true;
      for (let k = 1; k < 4; k++) {
        const nx = x + dx * k, ny = y + dy * k;
        if (nx < 0 || nx > 6 || ny < 0 || ny > 5 || b[ny]![nx] !== v) { ok = false; break; }
      }
      if (ok) return v;
    }
  }
  return 0;
}
function c4Drop(b: C4, col: number, who: 1 | 2): C4 | null {
  const next = b.map((row) => [...row]) as C4;
  for (let y = 5; y >= 0; y--) {
    if (!next[y]![col]) { next[y]![col] = who; return next; }
  }
  return null;
}
function c4AiMove(b: C4): number {
  const open = [0, 1, 2, 3, 4, 5, 6].filter((c) => !b[0]![c]);
  if (!open.length) return -1;
  for (const c of open) { const nb = c4Drop(b, c, 2); if (nb && c4Winner(nb) === 2) return c; }
  for (const c of open) { const nb = c4Drop(b, c, 1); if (nb && c4Winner(nb) === 1) return c; }
  // Prefer moves that build lines, avoid handing the player an immediate win.
  let bestCol = open[Math.floor(open.length / 2)]!;
  let bestScore = -1e9;
  for (const c of open) {
    const nb = c4Drop(b, c, 2)!;
    let sc = 10 - Math.abs(3 - c) * 2;
    // Count AI 3-in-a-rows with an open end.
    for (let y = 0; y < 6; y++) for (let x = 0; x < 7; x++) {
      if (nb[y]![x] === 2) {
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]] as [number, number][]) {
          let n = 0;
          for (let k = 0; k < 3; k++) {
            const nx = x + dx * k, ny = y + dy * k;
            if (nx < 7 && ny < 6 && nb[ny]![nx] === 2) n++;
          }
          if (n === 3) sc += 14;
        }
      }
    }
    const reply = [0, 1, 2, 3, 4, 5, 6].filter((cc) => !nb[0]![cc]);
    for (const cc of reply) {
      const rb = c4Drop(nb, cc, 1);
      if (rb && c4Winner(rb) === 1) sc -= 60;
    }
    sc += Math.random() * 3;
    if (sc > bestScore) { bestScore = sc; bestCol = c; }
  }
  return bestCol;
}
function ConnectFourGame() {
  const [board, setBoard] = useState<C4>(() => Array.from({ length: 6 }, () => new Array(7).fill(0)));
  const [winner, setWinner] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [wins, setWins] = useState(0);
  const [best, recordBest] = useBest("connect-four");
  const drop = (col: number) => {
    if (winner || thinking) return;
    const nb = c4Drop(board, col, 1);
    if (!nb) return;
    beep(540, 0.05);
    const w = c4Winner(nb);
    setBoard(nb);
    if (w) { setWinner(w); if (w === 1) { setWins((v) => v + 1); recordBest(100); } return; }
    if (nb.every((row) => row.every((c) => c !== 0))) { setWinner(3); return; }
    setThinking(true);
    setTimeout(() => {
      const aiCol = c4AiMove(nb);
      const after = aiCol >= 0 ? c4Drop(nb, aiCol, 2) : null;
      if (after) {
        setBoard(after);
        const w2 = c4Winner(after);
        if (w2) setWinner(w2);
        else if (after.every((row) => row.every((c) => c !== 0))) setWinner(3);
        beep(380, 0.05);
      }
      setThinking(false);
    }, 420);
  };
  const start = () => { setBoard(Array.from({ length: 6 }, () => new Array(7).fill(0))); setWinner(0); setThinking(false); };
  const score = winner === 1 ? 100 : winner === 3 ? 40 : 0;
  return (
    <div>
      <ScoreBar items={[["Match wins", wins], ["Best", best], ["Status", winner === 1 ? "🏆 You win!" : winner === 2 ? "CPU wins" : winner === 3 ? "Draw" : thinking ? "CPU thinking…" : "Your turn"]]} />
      {winner === 1 && <Banner tone="win">🏆 Four in a row — you beat the computer! Score {score}.</Banner>}
      {winner === 2 && <Banner tone="lose">The computer connected four first. Rematch?</Banner>}
      {winner === 3 && <Banner tone="info">A full board with no winner — an honorable draw.</Banner>}
      <div className="mx-auto grid max-w-[350px] grid-cols-7 gap-1.5 rounded-2xl bg-blue-700 p-2.5" role="grid" aria-label="Connect Four board">
        {board.map((row, y) => row.map((v, x) => (
          <button key={`${x}-${y}`} type="button" role="gridcell"
            aria-label={`Column ${x + 1}, row ${y + 1}${v === 1 ? ", your disc" : v === 2 ? ", CPU disc" : ", empty"}`}
            onClick={() => drop(x)}
            className="flex aspect-square items-center justify-center rounded-full bg-blue-900">
            <span className={`h-[82%] w-[82%] rounded-full ${v === 1 ? "bg-red-500" : v === 2 ? "bg-yellow-400" : "bg-white/90"}`} />
          </button>
        )))}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New match" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Tap any cell in a column to drop your red disc. Connect four — across, down or diagonally — before the computer does.</p>
    </div>
  );
}

/* ---------------------------------------------------------- Checkers Champ */
type CheckerPiece = { who: 1 | 2; king: boolean } | null;
type ChBoard = CheckerPiece[][];
function checkerMoves(b: ChBoard, who: 1 | 2, capturesOnly: boolean): { from: number; to: number; jump?: number }[] {
  const moves: { from: number; to: number; jump?: number }[] = [];
  const dirs = (p: { who: 1 | 2; king: boolean }): [number, number][] =>
    p.king ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : who === 1 ? [[1, -1], [-1, -1]] : [[1, 1], [-1, 1]];
  for (let i = 0; i < 64; i++) {
    const p = b[Math.floor(i / 8)]![i % 8];
    if (!p || p.who !== who) continue;
    const x = i % 8, y = Math.floor(i / 8);
    for (const [dx, dy] of dirs(p)) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx > 7 || ny < 0 || ny > 7) continue;
      const target = b[ny]![nx];
      if (!target && !capturesOnly) moves.push({ from: i, to: ny * 8 + nx });
      if (target && target.who !== who) {
        const jx = x + dx * 2, jy = y + dy * 2;
        if (jx >= 0 && jx < 8 && jy >= 0 && jy < 8 && !b[jy]![jx]) {
          moves.push({ from: i, to: jy * 8 + jx, jump: ny * 8 + nx });
        }
      }
    }
  }
  return moves;
}
function CheckersGame() {
  const init = (): ChBoard => {
    const b: ChBoard = Array.from({ length: 8 }, () => new Array(8).fill(null));
    for (let y = 0; y < 3; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 1) b[y]![x] = { who: 2, king: false };
    for (let y = 5; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 1) b[y]![x] = { who: 1, king: false };
    return b;
  };
  const [board, setBoard] = useState<ChBoard>(init);
  const [sel, setSel] = useState<number | null>(null);
  const [winner, setWinner] = useState(0);
  const [busy, setBusy] = useState(false);
  const [best, recordBest] = useBest("checkers");
  const captures = checkerMoves(board, 1, true).filter((m) => m.jump !== undefined);
  const legal = captures.length ? captures : checkerMoves(board, 1, false);
  const myMoves = sel !== null ? legal.filter((m) => m.from === sel) : [];
  const applyMove = (b: ChBoard, m: { from: number; to: number; jump?: number }): ChBoard => {
    const next = b.map((row) => [...row]);
    const piece = next[Math.floor(m.from / 8)]![m.from % 8]!;
    next[Math.floor(m.from / 8)]![m.from % 8] = null;
    if (m.jump !== undefined) next[Math.floor(m.jump / 8)]![m.jump % 8] = null;
    const ty = Math.floor(m.to / 8);
    if ((piece.who === 1 && ty === 0) || (piece.who === 2 && ty === 7)) piece.king = true;
    next[ty]![m.to % 8] = { ...piece };
    return next;
  };
  const checkEnd = (b: ChBoard): number => {
    const aiCaps = checkerMoves(b, 2, true);
    const aiAny = aiCaps.length ? aiCaps : checkerMoves(b, 2, false);
    const myCaps = checkerMoves(b, 1, true);
    const myAny = myCaps.length ? myCaps : checkerMoves(b, 1, false);
    const aiPieces = b.flat().filter((p) => p?.who === 2).length;
    const myPieces = b.flat().filter((p) => p?.who === 1).length;
    if (aiPieces === 0 || aiAny.length === 0) return 1;
    if (myPieces === 0 || myAny.length === 0) return 2;
    return 0;
  };
  const tap = (i: number) => {
    if (winner || busy) return;
    const piece = board[Math.floor(i / 8)]![i % 8];
    const move = myMoves.find((m) => m.to === i);
    if (move && sel !== null) {
      const nb = applyMove(board, move);
      setBoard(nb); setSel(null);
      beep(move.jump !== undefined ? 300 : 520, 0.06);
      const w = checkEnd(nb);
      if (w) { setWinner(w); if (w === 1) recordBest(150); return; }
      setBusy(true);
      setTimeout(() => {
        const aiCaps = checkerMoves(nb, 2, true).filter((m) => m.jump !== undefined);
        const aiMoves = aiCaps.length ? aiCaps : checkerMoves(nb, 2, false);
        if (aiMoves.length) {
          const scored = aiMoves.map((m) => ({ m, s: (m.jump !== undefined ? 10 : 0) + (Math.floor(m.to / 8) === 7 ? 4 : 0) + Math.random() * 2 }));
          scored.sort((a, b) => b.s - a.s);
          const after = applyMove(nb, scored[0]!.m);
          setBoard(after);
          const w2 = checkEnd(after);
          if (w2) setWinner(w2);
          beep(360, 0.05);
        }
        setBusy(false);
      }, 480);
      return;
    }
    if (piece?.who === 1 && legal.some((m) => m.from === i)) { setSel(i); beep(600, 0.03); }
  };
  const start = () => { setBoard(init()); setSel(null); setWinner(0); setBusy(false); };
  const targets = new Set(myMoves.map((m) => m.to));
  return (
    <div>
      <ScoreBar items={[["Your pieces", board.flat().filter((p) => p?.who === 1).length], ["CPU pieces", board.flat().filter((p) => p?.who === 2).length], ["Best", best], ["Turn", winner ? "—" : busy ? "CPU…" : captures.length ? "Capture required!" : "Yours"]]} />
      {winner === 1 && <Banner tone="win">🏆 You cleared the board — checkers champion! Score 150.</Banner>}
      {winner === 2 && <Banner tone="lose">The computer took this match. Study its captures and rematch!</Banner>}
      <div className="mx-auto grid max-w-[352px] grid-cols-8 gap-0 rounded-xl bg-amber-900 p-1.5" role="grid" aria-label="Checkers board">
        {board.map((row, y) => row.map((p, x) => {
          const i = y * 8 + x;
          const dark = (x + y) % 2 === 1;
          return (
            <button key={i} type="button" role="gridcell"
              aria-label={p ? `${p.who === 1 ? "Your" : "CPU"} ${p.king ? "king" : "piece"}` : "Empty square"}
              onClick={() => tap(i)}
              className={`flex aspect-square items-center justify-center ${dark ? "bg-amber-800" : "bg-amber-100"} ${sel === i ? "ring-4 ring-sky-400" : ""} ${targets.has(i) ? "ring-4 ring-green-400" : ""}`}>
              {p && <span className={`flex h-[78%] w-[78%] items-center justify-center rounded-full text-sm shadow ${p.who === 1 ? "bg-red-500 text-white" : "bg-slate-900 text-white"}`}>{p.king ? "♛" : ""}</span>}
            </button>
          );
        }))}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New match" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Tap one of your red pieces, then a glowing square. Captures are mandatory when available; reach the far row to crown a king. House rules: one capture per turn.</p>
    </div>
  );
}

/* ------------------------------------------------------------ Tower Defense */
type TdState = {
  score: number; over?: boolean; won?: boolean;
  gold: number; lives: number; wave: number; waveLeft: number; spawnT: number; between: number;
  towers: { gx: number; gy: number; type: number; cool: number }[];
  creeps: { x: number; y: number; hp: number; maxHp: number; seg: number; sp: number; slow: number }[];
  shots: { x: number; y: number; tx: number; ty: number; life: number }[];
  selType: number;
};
const TD_PATH: [number, number][] = [[-1, 2], [8, 2], [8, 5], [3, 5], [3, 8]];
const TD_TYPES = [
  { name: "Arrow", cost: 40, range: 78, dmg: 9, rate: 0.42, color: "#22c55e", emoji: "🏹" },
  { name: "Frost", cost: 60, range: 70, dmg: 4, rate: 0.5, color: "#38bdf8", emoji: "❄️" },
  { name: "Cannon", cost: 90, range: 92, dmg: 26, rate: 1.15, color: "#f97316", emoji: "💣" },
];
function tdPathPoint(seg: number, t: number): { x: number; y: number } {
  const a = TD_PATH[seg]!;
  const b = TD_PATH[seg + 1]!;
  return { x: (a[0] + (b[0] - a[0]) * t + 0.5) * 40, y: (a[1] + (b[1] - a[1]) * t + 0.5) * 40 };
}
function isPathCell(gx: number, gy: number): boolean {
  for (let s = 0; s < TD_PATH.length - 1; s++) {
    const a = TD_PATH[s]!;
    const b = TD_PATH[s + 1]!;
    const minX = Math.min(a[0], b[0]), maxX = Math.max(a[0], b[0]);
    const minY = Math.min(a[1], b[1]), maxY = Math.max(a[1], b[1]);
    if (gx >= minX && gx <= maxX && gy >= minY && gy <= maxY) return true;
  }
  return false;
}
function TowerDefenseGame() {
  return (
    <Engine<TdState>
      id="tower-defense" label="Tower Defense"
      blurb="Build towers along the winding road and stop ten waves of creeps. Frost slows, cannons splash — leak ten creeps and the kingdom falls."
      create={() => ({ score: 0, gold: 130, lives: 10, wave: 0, waveLeft: 0, spawnT: 0, between: 2.2, towers: [], creeps: [], shots: [], selType: 0 })}
      hud={(s) => [["Gold", `🪙 ${s.gold}`], ["Lives", "❤️".repeat(Math.max(0, Math.min(10, s.lives))) || "—"], ["Wave", `${Math.min(10, s.wave)}/10`], ["Score", s.score]]}
      onTap={(s, x, y, api) => {
        if (y >= 322) {
          const idx = Math.floor((x - 60) / 120);
          if (idx >= 0 && idx < 3) { s.selType = idx; api.beep(600, 0.04); }
          return;
        }
        const gx = Math.floor(x / 40), gy = Math.floor(y / 40);
        if (gy > 7 || isPathCell(gx, gy)) { api.beep(150, 0.08, "sawtooth"); return; }
        if (s.towers.some((t) => t.gx === gx && t.gy === gy)) { api.beep(150, 0.08, "sawtooth"); return; }
        const type = TD_TYPES[s.selType]!;
        if (s.gold < type.cost) { api.beep(150, 0.08, "sawtooth"); return; }
        s.gold -= type.cost;
        s.towers.push({ gx, gy, type: s.selType, cool: 0 });
        api.beep(700, 0.06);
      }}
      step={(s, dt, _input, api) => {
        if (s.between > 0) {
          s.between -= dt;
          if (s.between <= 0 && s.wave < 10) {
            s.wave += 1;
            s.waveLeft = 6 + s.wave * 2;
            s.spawnT = 0.2;
            api.beep(560, 0.1, "triangle");
          }
        } else if (s.waveLeft > 0) {
          s.spawnT -= dt;
          if (s.spawnT <= 0) {
            s.spawnT = Math.max(0.5, 1.05 - s.wave * 0.05);
            s.waveLeft -= 1;
            const hp = 22 + s.wave * 11;
            s.creeps.push({ x: -20, y: 100, hp, maxHp: hp, seg: 0, sp: rand(26, 34), slow: 0 });
            const c = s.creeps[s.creeps.length - 1]!;
            const p = tdPathPoint(0, 0);
            c.x = p.x - 40; c.y = p.y;
          }
        } else if (s.creeps.length === 0) {
          if (s.wave >= 10) { s.score += s.lives * 25 + s.gold; api.end(true); return; }
          s.gold += 25 + s.wave * 2;
          s.between = 3;
        }
        // Move creeps along the path, segment by segment.
        for (const c of s.creeps) {
          let remain = c.sp * dt * (c.slow > 0 ? 0.55 : 1);
          c.slow = Math.max(0, c.slow - dt);
          while (remain > 0 && c.seg < TD_PATH.length - 1) {
            const target = tdPathPoint(c.seg, 1);
            const d = Math.hypot(target.x - c.x, target.y - c.y);
            if (d <= remain) {
              c.x = target.x; c.y = target.y; c.seg += 1; remain -= d;
            } else {
              c.x += ((target.x - c.x) / d) * remain;
              c.y += ((target.y - c.y) / d) * remain;
              remain = 0;
            }
          }
          if (c.seg >= TD_PATH.length - 1) {
            c.hp = -999;
            s.lives -= 1;
            api.beep(110, 0.18, "sawtooth");
            if (s.lives <= 0) { api.end(false); return; }
          }
        }
        s.creeps = s.creeps.filter((c) => c.hp !== -999);
        for (const t of s.towers) {
          t.cool -= dt;
          const type = TD_TYPES[t.type]!;
          const tx = t.gx * 40 + 20, ty = t.gy * 40 + 20;
          if (t.cool <= 0) {
            const target = s.creeps.find((c) => c.hp > 0 && Math.hypot(c.x - tx, c.y - ty) < type.range);
            if (target) {
              t.cool = type.rate;
              s.shots.push({ x: tx, y: ty, tx: target.x, ty: target.y, life: 0.09 });
              // Damage resolves instantly with a tracer visual.
              target.hp -= type.dmg;
              if (t.type === 1) target.slow = 1.2;
              if (t.type === 2) {
                for (const c2 of s.creeps) {
                  if (c2 !== target && c2.hp > 0 && Math.hypot(c2.x - target.x, c2.y - target.y) < 30) c2.hp -= Math.floor(type.dmg / 2);
                }
              }
              if (target.hp <= 0 && target.hp > -900) {
                target.hp = -901;
                s.gold += 7;
                s.score += 10;
                api.beep(300, 0.04);
              }
            }
          }
        }
        for (const c of s.creeps) {
          if (c.hp <= 0 && c.hp > -900) { c.hp = -901; s.gold += 7; s.score += 10; }
        }
        s.creeps = s.creeps.filter((c) => c.hp > 0);
        for (const sh of s.shots) sh.life -= dt;
        s.shots = s.shots.filter((sh) => sh.life > 0);
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#166534"; ctx.fillRect(0, 0, W, H);
        // Path
        ctx.strokeStyle = "#d6a860"; ctx.lineWidth = 34; ctx.lineCap = "round";
        ctx.beginPath();
        TD_PATH.forEach(([gx, gy], i) => {
          const x = (gx + 0.5) * 40, y = (gy + 0.5) * 40;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke(); ctx.lineCap = "butt";
        ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2; ctx.setLineDash([8, 10]);
        ctx.beginPath();
        TD_PATH.forEach(([gx, gy], i) => {
          const x = (gx + 0.5) * 40, y = (gy + 0.5) * 40;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke(); ctx.setLineDash([]);
        ctx.font = "22px serif"; ctx.textAlign = "center";
        ctx.fillText("🏰", 460, 348 - 8);
        for (const t of s.towers) {
          const type = TD_TYPES[t.type]!;
          ctx.fillStyle = type.color;
          ctx.beginPath(); ctx.roundRect(t.gx * 40 + 4, t.gy * 40 + 4, 32, 32, 8); ctx.fill();
          ctx.fillText(type.emoji, t.gx * 40 + 20, t.gy * 40 + 27);
        }
        for (const sh of s.shots) {
          ctx.strokeStyle = "rgba(253,224,71,0.8)"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.tx, sh.ty); ctx.stroke();
        }
        for (const c of s.creeps) {
          ctx.fillText("👹", c.x, c.y + 8);
          ctx.fillStyle = "#111827"; ctx.fillRect(c.x - 12, c.y - 18, 24, 4);
          ctx.fillStyle = "#22c55e"; ctx.fillRect(c.x - 12, c.y - 18, 24 * Math.max(0, c.hp / c.maxHp), 4);
        }
        // Shop strip
        ctx.fillStyle = "#14532d"; ctx.fillRect(0, 322, W, 38);
        TD_TYPES.forEach((t, i) => {
          const x = 60 + i * 120;
          ctx.fillStyle = s.selType === i ? "#facc15" : "#1f2937";
          ctx.beginPath(); ctx.roundRect(x, 326, 110, 30, 8); ctx.fill();
          ctx.fillStyle = s.selType === i ? "#111827" : "#fff";
          ctx.font = "bold 12px system-ui";
          ctx.fillText(`${t.emoji} ${t.name} ${t.cost}`, x + 55, 345);
          ctx.font = "22px serif";
        });
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ------------------------------------------------------------- Knight's Tour */
function KnightsTourGame() {
  const [visited, setVisited] = useState<number[]>([]);
  const [won, setWon] = useState(false);
  const [best, recordBest] = useBest("knights-tour");
  const current = visited[visited.length - 1];
  const legalNext = (from: number): number[] => {
    const x = from % 5, y = Math.floor(from / 5);
    const out: number[] = [];
    for (const [dx, dy] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]] as [number, number][]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < 5 && ny >= 0 && ny < 5 && !visited.includes(ny * 5 + nx)) out.push(ny * 5 + nx);
    }
    return out;
  };
  const stuck = visited.length > 0 && !won && legalNext(current!).length === 0;
  const score = won ? 300 : visited.length * 4;
  useEffect(() => { if (won) recordBest(300); }, [won, recordBest]);
  const tap = (i: number) => {
    if (won) return;
    if (visited.length === 0) { setVisited([i]); beep(560, 0.05); return; }
    if (legalNext(current!).includes(i)) {
      const next = [...visited, i];
      setVisited(next);
      beep(620, 0.05);
      if (next.length === 25) setWon(true);
    } else beep(150, 0.08, "sawtooth");
  };
  const undo = () => { setVisited((v) => v.slice(0, -1)); setWon(false); };
  const start = () => { setVisited([]); setWon(false); };
  const nextSet = new Set(visited.length ? legalNext(current!) : []);
  return (
    <div>
      <ScoreBar items={[["Squares visited", `${visited.length}/25`], ["Score", score], ["Best", best]]} />
      {won && <Banner tone="win">🏆 A perfect Knight's Tour — all 25 squares in one unbroken ride! Score 300.</Banner>}
      {stuck && <Banner tone="lose">No moves left with {25 - visited.length} squares unvisited. Undo a few jumps or restart.</Banner>}
      <div className="mx-auto grid max-w-[300px] grid-cols-5 gap-1" role="grid" aria-label="Knight's tour board">
        {Array.from({ length: 25 }, (_, i) => {
          const order = visited.indexOf(i);
          const isNext = nextSet.has(i);
          return (
            <button key={i} type="button" role="gridcell"
              aria-label={order >= 0 ? `Visited, step ${order + 1}` : isNext ? "Legal knight move" : "Square"}
              onClick={() => tap(i)}
              className={`flex aspect-square items-center justify-center rounded-lg text-sm font-extrabold ${
                order >= 0 ? (i === current ? "bg-amber-400 text-amber-950" : "bg-sky-200 text-sky-800") : isNext ? "bg-green-200 hover:bg-green-300" : (i % 2 === 0 ? "bg-[var(--surface-alt)]" : "bg-white")
              }`}>
              {order >= 0 ? (i === current ? "♞" : order + 1) : isNext ? "•" : ""}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-center gap-2">
        <ActionButton onClick={undo} label="↩ Undo" />
        <ActionButton onClick={start} label="↻ Restart" />
      </div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Tap any square to place the knight, then keep jumping in L-shapes to glowing squares. Visit all 25 without revisiting.</p>
    </div>
  );
}

/* --------------------------------------------------------------- Sea Battle */
function placeShips(): { grid: number[]; ships: number[][] } {
  const grid = new Array(36).fill(0);
  const ships: number[][] = [];
  const sizes = [3, 2, 2];
  for (const size of sizes) {
    for (let tries = 0; tries < 80; tries++) {
      const horiz = Math.random() < 0.5;
      const x = randi(0, horiz ? 6 - size : 5);
      const y = randi(0, horiz ? 5 : 6 - size);
      const cells: number[] = [];
      let ok = true;
      for (let k = 0; k < size; k++) {
        const cx = horiz ? x + k : x;
        const cy = horiz ? y : y + k;
        if (grid[cy * 6 + cx]) { ok = false; break; }
        cells.push(cy * 6 + cx);
      }
      if (!ok) continue;
      for (const c of cells) grid[c] = ships.length + 1;
      ships.push(cells);
      break;
    }
  }
  return { grid, ships };
}
function SeaBattleGame() {
  const [enemy, setEnemy] = useState(() => placeShips());
  const [mine, setMine] = useState(() => placeShips());
  const [shots, setShots] = useState<Set<number>>(new Set());
  const [aiShots, setAiShots] = useState<Set<number>>(new Set());
  const [winner, setWinner] = useState(0);
  const [log, setLog] = useState("Your move, Captain — fire on the enemy grid!");
  const [best, recordBest] = useBest("sea-battle");
  const enemySunk = enemy.ships.filter((s) => s.every((c) => shots.has(c))).length;
  const mySunk = mine.ships.filter((s) => s.every((c) => aiShots.has(c))).length;
  const score = winner === 1 ? 200 + (3 - mySunk) * 40 : enemySunk * 50;
  useEffect(() => { if (winner === 1) recordBest(score); }, [winner, score, recordBest]);
  const fire = (i: number) => {
    if (winner || shots.has(i)) return;
    const nextShots = new Set(shots);
    nextShots.add(i);
    setShots(nextShots);
    const hitShip = enemy.ships.find((s) => s.includes(i));
    if (hitShip) {
      const sunk = hitShip.every((c) => nextShots.has(c));
      setLog(sunk ? "💥 Enemy ship sunk!" : "🎯 Direct hit!");
      beep(240, 0.12, "sawtooth");
    } else {
      setLog("💧 Splash — a miss.");
      beep(300, 0.06);
    }
    if (enemy.ships.every((s) => s.every((c) => nextShots.has(c)))) {
      setWinner(1);
      return;
    }
    // AI fires back once.
    setTimeout(() => {
      const pool = [...Array(36).keys()].filter((c) => !aiShots.has(c));
      // Simple hunt: prefer neighbors of existing hits.
      const hits = [...aiShots].filter((c) => mine.grid[c]! > 0);
      let target = pool[randi(0, pool.length - 1)]!;
      for (const h of hits) {
        const hx = h % 6, hy = Math.floor(h / 6);
        const nb = [hx > 0 ? h - 1 : -1, hx < 5 ? h + 1 : -1, hy > 0 ? h - 6 : -1, hy < 5 ? h + 6 : -1].filter((n) => n >= 0 && !aiShots.has(n));
        const unsunk = mine.ships.some((s) => s.includes(h) && !s.every((c) => aiShots.has(c)));
        if (unsunk && nb.length) { target = nb[randi(0, nb.length - 1)]!; break; }
      }
      const nextAi = new Set(aiShots);
      nextAi.add(target);
      setAiShots(nextAi);
      if (mine.ships.every((s) => s.every((c) => nextAi.has(c)))) setWinner(2);
    }, 450);
  };
  const start = () => {
    setEnemy(placeShips()); setMine(placeShips());
    setShots(new Set()); setAiShots(new Set()); setWinner(0);
    setLog("Your move, Captain — fire on the enemy grid!");
  };
  const cellView = (gridData: { grid: number[]; ships: number[][] }, shotsSet: Set<number>, i: number, reveal: boolean) => {
    const shipId = gridData.grid[i]!;
    const shot = shotsSet.has(i);
    if (!shot) return reveal && shipId ? "🚢" : "";
    if (!shipId) return "💧";
    const ship = gridData.ships[shipId - 1]!;
    return ship.every((c) => shotsSet.has(c)) ? "💥" : "🔥";
  };
  return (
    <div>
      <ScoreBar items={[["Enemy ships sunk", `${enemySunk}/3`], ["Your ships lost", `${mySunk}/3`], ["Best", best]]} />
      {winner === 1 && <Banner tone="win">🏆 Enemy fleet destroyed! Score {score}.</Banner>}
      {winner === 2 && <Banner tone="lose">Your fleet is at the bottom of the sea. Refit and sail again!</Banner>}
      <p className="mb-2 text-center font-semibold">{log}</p>
      <div className="flex flex-wrap items-start justify-center gap-4">
        <div>
          <p className="mb-1 text-center text-sm font-bold">Enemy waters — tap to fire</p>
          <div className="grid grid-cols-6 gap-1 rounded-xl bg-sky-800 p-1.5" role="grid" aria-label="Enemy grid">
            {enemy.grid.map((_, i) => (
              <button key={i} type="button" role="gridcell" aria-label={shots.has(i) ? "Already fired here" : `Fire at cell ${i + 1}`}
                onClick={() => fire(i)}
                className="flex h-9 w-9 items-center justify-center rounded bg-sky-600 text-base hover:bg-sky-500">
                {cellView(enemy, shots, i, false)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-center text-sm font-bold">Your fleet</p>
          <div className="grid grid-cols-6 gap-1 rounded-xl bg-slate-700 p-1.5" aria-label="Your grid">
            {mine.grid.map((_, i) => (
              <span key={i} className="flex h-9 w-9 items-center justify-center rounded bg-slate-600 text-base">
                {cellView(mine, aiShots, i, true)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New battle" /></div>
    </div>
  );
}

/* ------------------------------------------------------------- Code Breaker */
const CB_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"];
const CB_NAMES = ["red", "orange", "yellow", "green", "blue", "purple"];
function CodeBreakerGame() {
  const [secret, setSecret] = useState<number[]>(() => Array.from({ length: 4 }, () => randi(0, 5)));
  const [rows, setRows] = useState<{ guess: number[]; black: number; white: number }[]>([]);
  const [current, setCurrent] = useState<number[]>([-1, -1, -1, -1]);
  const [selColor, setSelColor] = useState(0);
  const [done, setDone] = useState<"win" | "lose" | null>(null);
  const [best, recordBest] = useBest("code-breaker");
  const score = done === "win" ? Math.max(50, 320 - rows.length * 24) : rows.length * 12;
  useEffect(() => { if (done === "win") recordBest(score); }, [done, score, recordBest]);
  const check = () => {
    if (current.some((c) => c < 0) || done) return;
    let black = 0;
    const sLeft: number[] = [];
    const gLeft: number[] = [];
    current.forEach((c, i) => {
      if (c === secret[i]) black++;
      else { sLeft.push(secret[i]!); gLeft.push(c); }
    });
    let white = 0;
    for (const g of gLeft) {
      const idx = sLeft.indexOf(g);
      if (idx >= 0) { white++; sLeft.splice(idx, 1); }
    }
    const nextRows = [...rows, { guess: [...current], black, white }];
    setRows(nextRows);
    setCurrent([-1, -1, -1, -1]);
    if (black === 4) { setDone("win"); beep(680, 0.15, "triangle"); }
    else if (nextRows.length >= 10) { setDone("lose"); beep(120, 0.25, "sawtooth"); }
    else beep(480, 0.06);
  };
  const start = () => {
    setSecret(Array.from({ length: 4 }, () => randi(0, 5)));
    setRows([]); setCurrent([-1, -1, -1, -1]); setDone(null);
  };
  return (
    <div>
      <ScoreBar items={[["Guesses", `${rows.length}/10`], ["Best", best]]} />
      {done === "win" && <Banner tone="win">🏆 Code cracked in {rows.length} guesses — score {score}!</Banner>}
      {done === "lose" && (
        <Banner tone="lose">
          Out of guesses! The code was {secret.map((c) => CB_NAMES[c]).join(" · ")}.
        </Banner>
      )}
      <div className="mx-auto max-w-[340px] space-y-1.5" aria-label="Guess history">
        {rows.map((r, ri) => (
          <div key={ri} className="flex items-center gap-2 rounded-xl bg-[var(--surface-alt)] px-3 py-1.5">
            <span className="flex gap-1.5">
              {r.guess.map((c, i) => (
                <span key={i} className="h-6 w-6 rounded-full ring-1 ring-black/20" style={{ backgroundColor: CB_COLORS[c] }} />
              ))}
            </span>
            <span className="ml-auto flex gap-1" aria-label={`${r.black} exact, ${r.white} wrong place`}>
              {Array.from({ length: r.black }, (_, i) => <span key={`b${i}`} className="h-3.5 w-3.5 rounded-full bg-slate-900" />)}
              {Array.from({ length: r.white }, (_, i) => <span key={`w${i}`} className="h-3.5 w-3.5 rounded-full bg-white ring-1 ring-slate-400" />)}
            </span>
          </div>
        ))}
        {!done && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-1.5 ring-1 ring-amber-200">
            <span className="flex gap-1.5">
              {current.map((c, i) => (
                <button key={i} type="button" aria-label={`Set slot ${i + 1} to ${CB_NAMES[selColor]}`}
                  onClick={() => { const n = [...current]; n[i] = selColor; setCurrent(n); beep(540, 0.03); }}
                  className="h-6 w-6 rounded-full ring-2 ring-dashed ring-slate-400"
                  style={{ backgroundColor: c >= 0 ? CB_COLORS[c] : "transparent" }} />
              ))}
            </span>
            <button type="button" onClick={check} disabled={current.some((c) => c < 0)}
              className="ml-auto rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm font-bold text-white disabled:opacity-40">
              Check
            </button>
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-center gap-1.5" aria-label="Color palette">
        {CB_COLORS.map((c, i) => (
          <button key={c} type="button" aria-label={`Choose ${CB_NAMES[i]}`} aria-pressed={selColor === i}
            onClick={() => setSelColor(i)}
            className={`h-9 w-9 rounded-full ${selColor === i ? "ring-4 ring-slate-800" : "ring-1 ring-black/20"}`}
            style={{ backgroundColor: c }} />
        ))}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New code" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Black peg: right color, right place. White peg: right color, wrong place. Crack the 4-color code in 10 guesses — colors may repeat.</p>
    </div>
  );
}

export const GAMES4B: Record<string, ComponentType> = {
  "connect-four": ConnectFourGame,
  checkers: CheckersGame,
  "tower-defense": TowerDefenseGame,
  "knights-tour": KnightsTourGame,
  "sea-battle": SeaBattleGame,
  "code-breaker": CodeBreakerGame,
};

/* ------------------------------------------------------------ Temple Runner */
type TempleState = {
  score: number; over?: boolean; won?: boolean;
  y: number; vy: number; sliding: number; lives: number; dist: number; invuln: number;
  items: { x: number; kind: string }[];
  spawnT: number;
};
function TempleGame() {
  return (
    <Engine<TempleState>
      id="temple-runner" label="Temple Runner"
      blurb="The idol is yours — now RUN! Leap the spike pits, slide under the blades and grab the temple gold as the boulder closes in."
      create={() => ({ score: 0, y: 0, vy: 0, sliding: 0, lives: 3, dist: 0, invuln: 0, items: [], spawnT: 1 })}
      hud={(s) => [["Score", s.score], ["Lives", "❤️".repeat(Math.max(0, s.lives)) || "—"], ["Distance", `${Math.floor(s.dist)}m`]]}
      onKey={(s, key, api) => {
        if ((key === "ArrowUp" || key === "w" || key === " ") && s.y === 0) { s.vy = -430; api.beep(430, 0.06); }
        if (key === "ArrowDown" || key === "s") s.sliding = 0.55;
      }}
      onTap={(s, _x, y, api) => {
        if (y < H / 2 && s.y === 0) { s.vy = -430; api.beep(430, 0.06); }
        if (y >= H / 2) s.sliding = 0.55;
      }}
      step={(s, dt, _input, api) => {
        const speed = 165 + Math.min(120, s.dist / 14);
        s.dist += speed * dt / 9;
        s.vy += 1150 * dt;
        s.y = Math.min(0, s.y + s.vy * dt);
        if (s.y === 0) s.vy = 0;
        s.sliding = Math.max(0, s.sliding - dt);
        s.invuln = Math.max(0, s.invuln - dt);
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = rand(0.85, 1.5);
          const r = Math.random();
          s.items.push({ x: W + 30, kind: r < 0.42 ? "spike" : r < 0.72 ? "blade" : "coin" });
        }
        for (const it of s.items) {
          it.x -= speed * dt;
          if (Math.abs(it.x - 84) < 22 && it.x > 0) {
            if (it.kind === "coin" && s.y > -60) {
              it.x = -999; s.score += 15; api.beep(1150, 0.06);
            } else if (it.kind === "spike" && s.y > -26 && s.invuln <= 0) {
              it.x = -999; s.lives -= 1; s.invuln = 1.2;
              api.beep(100, 0.2, "sawtooth");
              if (s.lives <= 0) { api.end(false); return; }
            } else if (it.kind === "blade" && s.sliding <= 0 && s.y > -70 && s.invuln <= 0) {
              it.x = -999; s.lives -= 1; s.invuln = 1.2;
              api.beep(100, 0.2, "sawtooth");
              if (s.lives <= 0) { api.end(false); return; }
            }
          }
        }
        s.items = s.items.filter((it) => it.x > -40);
        s.score += dt * 3;
        s.score = Math.floor(s.score);
        if (s.dist >= 900) api.end(true);
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#fef3c7"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#d97706";
        for (let i = 0; i < 5; i++) ctx.fillRect((i * 120 - (s.dist * 9) % 120), 40, 26, 268);
        ctx.fillStyle = "#92400e"; ctx.fillRect(0, 308, W, 52);
        ctx.fillStyle = "#78350f";
        for (let x = 0; x < W; x += 32) ctx.fillRect(x - ((s.dist * 9) % 32), 308, 3, 52);
        ctx.font = "26px serif"; ctx.textAlign = "center";
        for (const it of s.items) {
          if (it.kind === "spike") ctx.fillText("🔱", it.x, 306);
          else if (it.kind === "blade") ctx.fillText("🪓", it.x, 236);
          else ctx.fillText("🪙", it.x, 268);
        }
        // The boulder!
        ctx.font = "44px serif";
        ctx.fillText("🪨", 18, 300);
        ctx.globalAlpha = s.invuln > 0 && Math.floor(s.invuln * 8) % 2 === 0 ? 0.35 : 1;
        ctx.font = "34px serif";
        ctx.fillText(s.sliding > 0 ? "🏃" : "🧍", 84, 306 + s.y + (s.sliding > 0 ? 8 : 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(15,23,42,0.65)"; ctx.fillRect(330, 12, 138, 10);
        ctx.fillStyle = "#f59e0b"; ctx.fillRect(330, 12, 138 * Math.min(1, s.dist / 900), 10);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ------------------------------------------------------------ Jungle Swing */
type SwingState = {
  score: number; over?: boolean; won?: boolean;
  mode: "swing" | "fly";
  vine: number; angle: number; angVel: number;
  x: number; y: number; vx: number; vy: number;
  camX: number; vines: number[];
};
function SwingGame() {
  const vineXs = () => {
    const xs = [70];
    for (let i = 1; i < 40; i++) xs.push(xs[i - 1]! + rand(88, 128));
    return xs;
  };
  return (
    <Engine<SwingState>
      id="jungle-swing" label="Jungle Swing"
      blurb="Swing vine to vine through the canopy! Build momentum, tap to let go at the perfect moment and catch the next vine."
      create={() => ({ score: 0, mode: "swing", vine: 0, angle: 0.5, angVel: 0, x: 70, y: 190, vx: 0, vy: 0, camX: 0, vines: vineXs() })}
      hud={(s) => [["Vines", s.vine], ["Score", s.score], ["Distance", `${Math.floor(s.x / 10)}m`]]}
      onTap={(s, _x, _y, api) => {
        if (s.mode !== "swing") return;
        const anchorX = s.vines[s.vine]!;
        s.vx = Math.cos(s.angle) * s.angVel * 118;
        s.vy = -Math.sin(Math.abs(s.angle)) * 60 - 40;
        s.x = anchorX + Math.sin(s.angle) * 118;
        s.y = 30 + Math.cos(s.angle) * 118;
        s.mode = "fly";
        api.beep(520, 0.07, "triangle");
      }}
      onKey={(s, key, api) => {
        if (key === " ") {
          if (s.mode === "swing") {
            const anchorX = s.vines[s.vine]!;
            s.vx = Math.cos(s.angle) * s.angVel * 118;
            s.vy = -Math.sin(Math.abs(s.angle)) * 60 - 40;
            s.x = anchorX + Math.sin(s.angle) * 118;
            s.y = 30 + Math.cos(s.angle) * 118;
            s.mode = "fly";
            api.beep(520, 0.07, "triangle");
          }
        }
      }}
      step={(s, dt, _input, api) => {
        if (s.mode === "swing") {
          const g = 3.4;
          const acc = -(g / 1.18) * Math.sin(s.angle);
          s.angVel += acc * dt;
          s.angVel *= Math.pow(0.35, dt);
          s.angle += s.angVel * dt;
          // Pumping: arrows add energy.
          if (_input.keys.has("ArrowRight") || _input.keys.has("d")) s.angVel += 0.55 * dt;
          if (_input.keys.has("ArrowLeft") || _input.keys.has("a")) s.angVel -= 0.55 * dt;
          const anchorX = s.vines[s.vine]!;
          s.x = anchorX + Math.sin(s.angle) * 118;
          s.y = 30 + Math.cos(s.angle) * 118;
        } else {
          s.vy += 560 * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          // Catch the next vine when passing near its rope.
          const nextIdx = s.vine + 1;
          const anchorX = s.vines[nextIdx];
          if (anchorX !== undefined && Math.abs(s.x - anchorX) < 20 && s.y > 60 && s.y < 240 && s.vy > -40) {
            s.vine = nextIdx;
            s.mode = "swing";
            s.angle = clamp(Math.asin(clamp((s.x - anchorX) / 118, -1, 1)), -0.9, 0.9);
            s.angVel = clamp(s.vx / 118, -1.6, 1.6);
            s.score += 40;
            api.beep(700, 0.09, "triangle");
            if (s.vine >= 24) { api.end(true); return; }
          }
          if (s.y > H + 30) { api.end(false); return; }
        }
        s.camX = Math.max(0, s.x - 130);
        s.score = Math.max(s.score, Math.floor(s.x / 10) + s.vine * 40);
      }}
      draw={(ctx, s) => {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#14532d"); grad.addColorStop(1, "#052e16");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#16a34a"; ctx.fillRect(0, 0, W, 26);
        ctx.strokeStyle = "#65a30d"; ctx.lineWidth = 4;
        ctx.font = "20px serif"; ctx.textAlign = "center";
        s.vines.forEach((vx, i) => {
          const sx = vx - s.camX;
          if (sx < -30 || sx > W + 30) return;
          ctx.beginPath(); ctx.moveTo(sx, 26); ctx.lineTo(sx, 148); ctx.stroke();
          ctx.fillText("🌿", sx, 24);
          if (i === s.vine + 1 && s.mode === "fly") {
            ctx.fillStyle = "rgba(250,204,21,0.9)";
            ctx.beginPath(); ctx.arc(sx, 120, 12 + Math.sin(performance.now() / 140) * 3, 0, 7); ctx.fill();
            ctx.fillStyle = "#000";
          }
        });
        const anchorX = s.vines[s.vine]! - s.camX;
        if (s.mode === "swing") {
          ctx.strokeStyle = "#84cc16"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(anchorX, 30); ctx.lineTo(s.x - s.camX, s.y); ctx.stroke();
        }
        ctx.font = "28px serif";
        ctx.fillText("🐒", s.x - s.camX, s.y + 10);
        ctx.fillStyle = "#0ea5e9"; ctx.fillRect(0, H - 14, W, 14);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ----------------------------------------------------------- Treasure Diver */
type DiverState = {
  score: number; over?: boolean; won?: boolean;
  x: number; y: number; oxygen: number; hp: number; carry: number; banked: number; time: number;
  treasures: { x: number; y: number; taken: boolean }[];
  sharks: { x: number; y: number; dir: number; sp: number }[];
  spawnT: number;
};
function DiverGame() {
  const mkTreasures = () => Array.from({ length: 5 }, () => ({ x: rand(30, W - 30), y: rand(300, 338), taken: false }));
  return (
    <Engine<DiverState>
      id="treasure-diver" label="Treasure Diver"
      blurb="Dive for sunken gold, but watch your oxygen! Haul treasure back to the boat to bank it — sharks take a bite out of careless divers."
      create={() => ({
        score: 0, x: W / 2, y: 52, oxygen: 100, hp: 3, carry: 0, banked: 0, time: 0,
        treasures: mkTreasures(),
        sharks: [{ x: 80, y: 190, dir: 1, sp: 42 }, { x: 380, y: 250, dir: -1, sp: 52 }],
        spawnT: 8,
      })}
      hud={(s) => [["Banked", `🪙 ${s.banked}`], ["Carrying", s.carry], ["Oxygen", `${Math.max(0, Math.round(s.oxygen))}%`], ["Health", "❤️".repeat(Math.max(0, s.hp)) || "—"]]}
      step={(s, dt, input, api) => {
        s.time += dt;
        const sp = 118;
        if (input.keys.has("ArrowLeft") || input.keys.has("a")) s.x -= sp * dt;
        if (input.keys.has("ArrowRight") || input.keys.has("d")) s.x += sp * dt;
        if (input.keys.has("ArrowUp") || input.keys.has("w")) s.y -= sp * dt;
        if (input.keys.has("ArrowDown") || input.keys.has("s")) s.y += sp * dt;
        if (input.pdown) {
          s.x += clamp(input.px - s.x, -130 * dt, 130 * dt);
          s.y += clamp(input.py - s.y, -130 * dt, 130 * dt);
        }
        s.x = clamp(s.x, 14, W - 14);
        s.y = clamp(s.y, 38, 342);
        if (s.y > 46) {
          s.oxygen -= dt * 5.2;
          if (s.oxygen <= 0) {
            s.hp -= 1; s.oxygen = 55; s.y = 44; s.carry = 0;
            api.beep(90, 0.3, "sawtooth");
            if (s.hp <= 0) { api.end(false); return; }
          }
        } else {
          s.oxygen = Math.min(100, s.oxygen + dt * 30);
          if (s.carry > 0) {
            s.banked += s.carry;
            s.score += s.carry * 50;
            s.carry = 0;
            api.beep(760, 0.12, "triangle");
            if (s.treasures.every((t) => t.taken)) s.treasures = mkTreasures();
          }
        }
        for (const t of s.treasures) {
          if (!t.taken && Math.hypot(t.x - s.x, t.y - s.y) < 20) {
            if (s.carry < 2) {
              t.taken = true; s.carry += 1;
              api.beep(1050, 0.07);
            }
          }
        }
        s.spawnT -= dt;
        if (s.spawnT <= 0 && s.sharks.length < 5) {
          s.spawnT = 9;
          s.sharks.push({ x: Math.random() < 0.5 ? -30 : W + 30, y: rand(120, 290), dir: Math.random() < 0.5 ? 1 : -1, sp: rand(44, 66) });
        }
        for (const sh of s.sharks) {
          sh.x += sh.dir * sh.sp * dt;
          if (sh.x < -36) { sh.x = -36; sh.dir = 1; }
          if (sh.x > W + 36) { sh.x = W + 36; sh.dir = -1; }
          if (Math.hypot(sh.x - s.x, sh.y - s.y) < 24) {
            s.hp -= 1; s.carry = 0; s.y = 44; s.oxygen = Math.max(s.oxygen, 40);
            api.beep(90, 0.3, "sawtooth");
            if (s.hp <= 0) { api.end(false); return; }
          }
        }
        if (s.banked >= 12) api.end(true);
      }}
      draw={(ctx, s) => {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#7dd3fc"); grad.addColorStop(0.14, "#0284c7"); grad.addColorStop(1, "#082f49");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#f59e0b"; ctx.fillRect(0, 344, W, 16);
        ctx.font = "26px serif"; ctx.textAlign = "center";
        ctx.fillText("⛵", W / 2, 34);
        ctx.font = "18px serif";
        for (const t of s.treasures) if (!t.taken) ctx.fillText("💰", t.x, t.y + 6);
        ctx.font = "30px serif";
        for (const sh of s.sharks) {
          ctx.save(); ctx.translate(sh.x, sh.y); ctx.scale(sh.dir, 1);
          ctx.fillText("🦈", 0, 10);
          ctx.restore();
        }
        ctx.font = "28px serif";
        ctx.fillText("🤿", s.x, s.y + 9);
        // Oxygen bar
        ctx.fillStyle = "rgba(15,23,42,0.7)"; ctx.fillRect(12, 12, 130, 11);
        ctx.fillStyle = s.oxygen < 30 ? "#ef4444" : "#38bdf8";
        ctx.fillRect(13, 13, 128 * (s.oxygen / 100), 9);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ------------------------------------------------------------ Cave Explorer */
const CAVE_W = 12;
const CAVE_H = 9;
function CaveGame() {
  type CaveData = { gems: Set<number>; bats: number[]; exit: number };
  const build = (): CaveData => {
    const cells = new Set<number>();
    while (cells.size < 6) cells.add(randi(10, CAVE_W * CAVE_H - 1));
    const bats: number[] = [];
    while (bats.length < 4) {
      const b = randi(14, CAVE_W * CAVE_H - 1);
      if (!cells.has(b) && !bats.includes(b)) bats.push(b);
    }
    return { gems: cells, bats, exit: CAVE_W * CAVE_H - 1 };
  };
  const [data, setData] = useState<CaveData>(build);
  const [pos, setPos] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(new Set([0, 1, 12, 13]));
  const [got, setGot] = useState<Set<number>>(new Set());
  const [oil, setOil] = useState(70);
  const [lives, setLives] = useState(3);
  const [status, setStatus] = useState<"play" | "win" | "lose">("play");
  const [best, recordBest] = useBest("cave-explorer");
  const score = got.size * 60 + (status === "win" ? oil * 4 + lives * 40 : 0);
  useEffect(() => { if (status === "win") recordBest(score); }, [status, score, recordBest]);
  const revealAround = (p: number, base: Set<number>): Set<number> => {
    const next = new Set(base);
    const px = p % CAVE_W, py = Math.floor(p / CAVE_W);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = px + dx, ny = py + dy;
      if (nx >= 0 && nx < CAVE_W && ny >= 0 && ny < CAVE_H && Math.abs(dx) + Math.abs(dy) <= 3) next.add(ny * CAVE_W + nx);
    }
    return next;
  };
  const move = useCallback((dx: number, dy: number) => {
    if (status !== "play") return;
    setPos((p) => {
      const x = p % CAVE_W, y = Math.floor(p / CAVE_W);
      const nx = clamp(x + dx, 0, CAVE_W - 1), ny = clamp(y + dy, 0, CAVE_H - 1);
      return ny * CAVE_W + nx;
    });
  }, [status]);
  // Resolve consequences after a move in an effect keyed on pos.
  const lastPos = useRef(0);
  useEffect(() => {
    if (pos === lastPos.current) return;
    lastPos.current = pos;
    if (status !== "play") return;
    setSeen((s) => revealAround(pos, s));
    setOil((o) => {
      const next = o - 1;
      if (next <= 0 && status === "play") setStatus("lose");
      return next;
    });
    if (data.gems.has(pos) && !got.has(pos)) {
      setGot((g) => new Set(g).add(pos));
      beep(1050, 0.08);
    }
    // Bats flutter to a random neighboring cell after each of your steps.
    setData((d) => ({
      ...d,
      bats: d.bats.map((b) => {
        if (Math.random() < 0.45) return b;
        const bx = b % CAVE_W, by = Math.floor(b / CAVE_W);
        const opts = [b, bx > 0 ? b - 1 : b, bx < CAVE_W - 1 ? b + 1 : b, by > 0 ? b - CAVE_W : b, by < CAVE_H - 1 ? b + CAVE_W : b];
        return opts[randi(0, opts.length - 1)]!;
      }),
    }));
  }, [pos, status, data.gems, got]);
  useEffect(() => {
    if (status !== "play") return;
    if (data.bats.includes(pos)) {
      const nl = lives - 1;
      setLives(nl);
      beep(100, 0.25, "sawtooth");
      if (nl <= 0) setStatus("lose");
      else { setPos(0); lastPos.current = 0; setSeen((s) => revealAround(0, s)); }
    }
    if (pos === data.exit && got.size >= 6) {
      setStatus("win");
      beep(660, 0.15, "triangle");
    }
  }, [data.bats, pos, status, lives, data.exit, got]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w") move(0, -1);
      else if (e.key === "ArrowDown" || e.key === "s") move(0, 1);
      else if (e.key === "ArrowLeft" || e.key === "a") move(-1, 0);
      else if (e.key === "ArrowRight" || e.key === "d") move(1, 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);
  const start = () => {
    const d = build();
    setData(d); setPos(0); lastPos.current = 0;
    setSeen(revealAround(0, new Set()));
    setGot(new Set()); setOil(70); setLives(3); setStatus("play");
  };
  return (
    <div>
      <ScoreBar items={[["Gems", `${got.size}/6`], ["Lantern oil", oil], ["Lives", "❤️".repeat(lives) || "—"], ["Best", best]]} />
      {status === "win" && <Banner tone="win">🏆 You escaped with every gem — score {score}!</Banner>}
      {status === "lose" && <Banner tone="lose">{lives <= 0 ? "The bats got you one too many times." : "Your lantern burned out in the dark."} Score {score}.</Banner>}
      {status === "play" && got.size >= 6 && <Banner tone="info">All gems collected — the exit 🚪 (bottom right) is open!</Banner>}
      <div className="mx-auto grid max-w-[384px] grid-cols-12 gap-0.5 rounded-xl bg-slate-950 p-1.5" role="grid" aria-label="Cave">
        {Array.from({ length: CAVE_W * CAVE_H }, (_, i) => {
          const visible = seen.has(i);
          const near = Math.abs((i % CAVE_W) - (pos % CAVE_W)) + Math.abs(Math.floor(i / CAVE_W) - Math.floor(pos / CAVE_W)) <= 3;
          let content = "";
          if (i === pos) content = "🧑";
          else if (visible && near && data.gems.has(i) && !got.has(i)) content = "💎";
          else if (visible && near && data.bats.includes(i)) content = "🦇";
          else if (i === data.exit) content = got.size >= 6 ? "🚪" : "·";
          return (
            <span key={i} role="gridcell" aria-label={i === pos ? "You" : visible ? "Cave floor" : "Darkness"}
              className={`flex aspect-square items-center justify-center rounded text-[13px] ${!visible ? "bg-slate-950" : near ? "bg-amber-100" : "bg-slate-800"}`}>
              {visible || i === pos ? content : ""}
            </span>
          );
        })}
      </div>
      <div className="mx-auto mt-3 grid w-36 grid-cols-3 gap-1 sm:hidden" aria-label="Direction pad">
        <span />
        <button type="button" aria-label="Move up" className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-alt)] text-lg font-bold" onClick={() => move(0, -1)}>▲</button>
        <span />
        <button type="button" aria-label="Move left" className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-alt)] text-lg font-bold" onClick={() => move(-1, 0)}>◀</button>
        <span />
        <button type="button" aria-label="Move right" className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-alt)] text-lg font-bold" onClick={() => move(1, 0)}>▶</button>
        <span />
        <button type="button" aria-label="Move down" className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-alt)] text-lg font-bold" onClick={() => move(0, 1)}>▼</button>
        <span />
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New cave" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Your lantern lights only the nearby dark. Gather 6 gems, dodge the bats and reach the exit before the oil runs out (70 steps).</p>
    </div>
  );
}

/* ------------------------------------------------------------ Treasure Hunt */
function TreasureHuntGame() {
  const [treasures, setTreasures] = useState<Set<number>>(() => {
    const s = new Set<number>();
    while (s.size < 3) s.add(randi(0, 63));
    return s;
  });
  const [dug, setDug] = useState<Map<number, number>>(new Map());
  const [found, setFound] = useState<Set<number>>(new Set());
  const [digs, setDigs] = useState(18);
  const [lastHint, setLastHint] = useState("Pick a square and dig — the clue tells you how far the nearest treasure lies.");
  const [best, recordBest] = useBest("treasure-hunt");
  const won = found.size === 3;
  const lost = !won && digs <= 0;
  const score = found.size * 100 + (won ? digs * 12 : 0);
  useEffect(() => { if (won) recordBest(score); }, [won, score, recordBest]);
  const dig = (i: number) => {
    if (won || lost || dug.has(i)) return;
    const nextDug = new Map(dug);
    if (treasures.has(i)) {
      nextDug.set(i, 0);
      const nf = new Set(found);
      nf.add(i);
      setFound(nf);
      setLastHint(nf.size === 3 ? "🏆 That's the last treasure — the island is yours!" : "💰 TREASURE! Buried gold uncovered!");
      beep(880, 0.12, "triangle");
    } else {
      const x = i % 8, y = Math.floor(i / 8);
      let bestD = 99;
      for (const t of treasures) {
        if (found.has(t)) continue;
        const d = Math.abs((t % 8) - x) + Math.abs(Math.floor(t / 8) - y);
        bestD = Math.min(bestD, d);
      }
      nextDug.set(i, bestD);
      setLastHint(bestD <= 2 ? `🔥 Burning hot — treasure is ${bestD} step${bestD === 1 ? "" : "s"} away!` : bestD <= 4 ? `🌡️ Warm — ${bestD} steps to the nearest treasure.` : `❄️ Cold — ${bestD} steps to the nearest treasure.`);
      beep(420, 0.05);
    }
    setDug(nextDug);
    setDigs((d) => d - 1);
  };
  const start = () => {
    const s = new Set<number>();
    while (s.size < 3) s.add(randi(0, 63));
    setTreasures(s); setDug(new Map()); setFound(new Set()); setDigs(18);
    setLastHint("Pick a square and dig — the clue tells you how far the nearest treasure lies.");
  };
  return (
    <div>
      <ScoreBar items={[["Treasures", `${found.size}/3`], ["Digs left", digs], ["Score", score], ["Best", best]]} />
      {won && <Banner tone="win">🏆 All three treasures dug up with {digs} digs to spare — score {score}!</Banner>}
      {lost && <Banner tone="lose">The shovel breaks — {3 - found.size} treasure(s) stay buried. Score {score}.</Banner>}
      <p className="mb-2 text-center font-semibold">{lastHint}</p>
      <div className="mx-auto grid max-w-[336px] grid-cols-8 gap-1" role="grid" aria-label="Digging grid">
        {Array.from({ length: 64 }, (_, i) => {
          const d = dug.get(i);
          const isTreasure = found.has(i);
          return (
            <button key={i} type="button" role="gridcell" aria-label={d === undefined ? "Undug sand" : isTreasure ? "Treasure found" : `${d} steps from treasure`}
              onClick={() => dig(i)}
              className={`flex aspect-square items-center justify-center rounded-lg text-sm font-extrabold ${
                isTreasure ? "bg-amber-300" : d !== undefined ? (d <= 2 ? "bg-orange-200 text-orange-800" : d <= 4 ? "bg-yellow-100 text-yellow-800" : "bg-sky-100 text-sky-800") : "bg-amber-100 hover:bg-amber-200"
              }`}>
              {isTreasure ? "💰" : d !== undefined ? d : "🏝️"}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New island" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Every empty dig reports the exact step-distance to the nearest remaining treasure. Triangulate the clues and spend your 18 digs wisely.</p>
    </div>
  );
}

/* ------------------------------------------------------------- Wizard Tower */
type WizState = {
  score: number; over?: boolean; won?: boolean;
  x: number; y: number; vx: number; vy: number; onGround: boolean; hp: number; camY: number; invuln: number;
  stars: { x: number; y: number; taken: boolean }[];
  bats: { x: number; y: number; dir: number; base: number }[];
};
const WPLATS = [
  { x: 150, y: 330, w: 180 }, { x: 30, y: 268, w: 100 }, { x: 210, y: 232, w: 100 }, { x: 340, y: 180, w: 100 },
  { x: 190, y: 132, w: 100 }, { x: 40, y: 92, w: 100 }, { x: 200, y: 40, w: 100 }, { x: 330, y: -6, w: 110 },
  { x: 170, y: -58, w: 100 }, { x: 30, y: -104, w: 100 }, { x: 190, y: -152, w: 100 }, { x: 320, y: -198, w: 120 },
];
function WizardGame() {
  return (
    <Engine<WizState>
      id="wizard-tower" label="Wizard's Tower"
      blurb="Climb the tower of the stars! Leap from ledge to ledge, gather the star shards and reach the glowing door at the very top."
      create={() => ({
        score: 0, x: 200, y: 300, vx: 0, vy: 0, onGround: false, hp: 3, camY: 0, invuln: 0,
        stars: WPLATS.slice(1).map((p) => ({ x: p.x + p.w / 2, y: p.y - 20, taken: false })),
        bats: WPLATS.filter((_, i) => i % 3 === 1).map((p) => ({ x: p.x + 20, y: p.y - 34, dir: 1, base: p.x })),
      })}
      hud={(s) => [["Stars", `${s.stars.filter((t) => t.taken).length}/${s.stars.length}`], ["Health", "❤️".repeat(Math.max(0, s.hp)) || "—"], ["Score", s.score], ["Height", `${Math.max(0, Math.floor((330 - s.y) / 10))}m`]]}
      step={(s, dt, input, api) => {
        if (input.keys.has("ArrowLeft") || input.keys.has("a")) s.vx = Math.max(-168, s.vx - 740 * dt);
        else if (input.keys.has("ArrowRight") || input.keys.has("d")) s.vx = Math.min(168, s.vx + 740 * dt);
        else s.vx *= Math.pow(0.0001, dt);
        if ((input.keys.has("ArrowUp") || input.keys.has("w") || input.keys.has(" ")) && s.onGround) {
          s.vy = -378; s.onGround = false; api.beep(440, 0.06);
        }
        if (input.pdown && s.onGround && input.py < s.y - s.camY - 26) { s.vy = -378; s.onGround = false; }
        if (input.pdown && input.px < s.x - 26) s.vx = Math.max(-168, s.vx - 740 * dt);
        if (input.pdown && input.px > s.x + 26) s.vx = Math.min(168, s.vx + 740 * dt);
        s.vy += 930 * dt;
        s.x = clamp(s.x + s.vx * dt, 12, W - 12);
        const prevBottom = s.y + 14 - s.vy * dt;
        s.y += s.vy * dt;
        s.onGround = false;
        if (s.vy >= 0) {
          for (const p of WPLATS) {
            if (s.x > p.x - 8 && s.x < p.x + p.w + 8 && prevBottom <= p.y + 1 && s.y + 14 >= p.y) {
              s.y = p.y - 14; s.vy = 0; s.onGround = true;
            }
          }
        }
        s.camY = Math.min(0, Math.max(s.camY, s.y - 190));
        if (s.y - s.camY > H + 24) {
          s.hp -= 1; api.beep(100, 0.22, "sawtooth");
          if (s.hp <= 0) { api.end(false); return; }
          s.x = 200; s.y = 300; s.vy = 0; s.camY = 0;
        }
        s.invuln = Math.max(0, s.invuln - dt);
        for (const b of s.bats) {
          b.x += b.dir * 44 * dt;
          if (b.x < b.base) { b.x = b.base; b.dir = 1; }
          if (b.x > b.base + 90) { b.x = b.base + 90; b.dir = -1; }
          if (s.invuln <= 0 && Math.abs(b.x - s.x) < 17 && Math.abs(b.y - s.y) < 18) {
            s.hp -= 1; s.invuln = 1.5;
            api.beep(100, 0.22, "sawtooth");
            if (s.hp <= 0) { api.end(false); return; }
          }
        }
        for (const st of s.stars) {
          if (!st.taken && Math.abs(st.x - s.x) < 15 && Math.abs(st.y - s.y) < 18) {
            st.taken = true; s.score += 30; api.beep(1180, 0.06);
          }
        }
        // The door sits on the top platform.
        if (s.y <= -198 - 14 + 2 && s.x > 330 && s.onGround) {
          s.score += 100 + s.stars.filter((t) => t.taken).length * 5;
          api.end(true);
        }
      }}
      draw={(ctx, s) => {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#1e1b4b"); grad.addColorStop(1, "#312e81");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#f8fafc";
        for (let i = 0; i < 30; i++) ctx.fillRect((i * 47) % W, ((i * 61) % 500 + s.camY * 0.3) % H, 2, 2);
        for (const p of WPLATS) {
          const wy = p.y - s.camY;
          if (wy < -20 || wy > H + 16) continue;
          ctx.fillStyle = "#6d28d9"; ctx.fillRect(p.x, wy, p.w, 10);
          ctx.fillStyle = "#a78bfa"; ctx.fillRect(p.x, wy, p.w, 3);
        }
        ctx.font = "22px serif"; ctx.textAlign = "center";
        const doorY = -198 - s.camY;
        if (doorY > -50 && doorY < H + 30) ctx.fillText("🚪", 385, doorY + 2);
        for (const st of s.stars) {
          const wy = st.y - s.camY;
          if (!st.taken && wy > -20 && wy < H + 16) ctx.fillText("⭐", st.x, wy + 7);
        }
        ctx.font = "20px serif";
        for (const b of s.bats) {
          const wy = b.y - s.camY;
          if (wy > -20 && wy < H + 16) ctx.fillText("🦇", b.x, wy + 7);
        }
        ctx.globalAlpha = s.invuln > 0 && Math.floor(s.invuln * 8) % 2 === 0 ? 0.35 : 1;
        ctx.font = "26px serif";
        ctx.fillText("🧙", s.x, s.y - s.camY + 9);
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
      }}
    />
  );
}

/* --------------------------------------------------------------- Sahara Trek */
type TrekEvent = { icon: string; title: string; water: number; treasure: number; text: string };
const TREK_EVENTS: TrekEvent[] = [
  { icon: "💧", title: "Hidden Oasis", water: 3, treasure: 0, text: "Palm shade and sweet water! +3 water." },
  { icon: "🏺", title: "Buried Ruins", water: -1, treasure: 2, text: "You dig out ancient gold. +2 treasure, −1 water." },
  { icon: "🌪️", title: "Sandstorm", water: -2, treasure: 0, text: "Hours lost sheltering behind the dunes. −2 water." },
  { icon: "🐪", title: "Trader Caravan", water: 2, treasure: -1, text: "You trade a trinket for full waterskins. +2 water, −1 treasure." },
  { icon: "🦂", title: "Scorpion Nest", water: -1, treasure: 1, text: "A frantic detour — but you spot a dropped coin pouch. −1 water, +1 treasure." },
  { icon: "🗺️", title: "Old Waymarker", water: 0, treasure: 1, text: "Carved stones point to a smuggler's cache. +1 treasure." },
  { icon: "☀️", title: "Merciless Sun", water: -2, treasure: 0, text: "No shade for miles. −2 water." },
  { icon: "🌴", title: "Date Grove", water: 1, treasure: 1, text: "Dates for the road and a traveler's lost ring. +1 water, +1 treasure." },
];
function SaharaGame() {
  const [step, setStep] = useState(0);
  const [water, setWater] = useState(6);
  const [treasure, setTreasure] = useState(0);
  const [choices, setChoices] = useState<TrekEvent[]>(() => shuffle(TREK_EVENTS).slice(0, 2) as TrekEvent[]);
  const [log, setLog] = useState("The pyramid glitters 12 marches away. Choose your fork.");
  const [status, setStatus] = useState<"play" | "win" | "lose">("play");
  const [best, recordBest] = useBest("sahara-trek");
  const score = treasure * 50 + (status === "win" ? 100 + water * 12 : step * 6);
  useEffect(() => { if (status === "win") recordBest(score); }, [status, score, recordBest]);
  const choose = (ev: TrekEvent) => {
    if (status !== "play") return;
    const nw = water + ev.water;
    const nt = Math.max(0, treasure + ev.treasure);
    setWater(nw);
    setTreasure(nt);
    const ns = step + 1;
    setStep(ns);
    beep(ev.water >= 0 ? 620 : 220, 0.08);
    if (nw < 0) {
      setStatus("lose");
      setLog(`${ev.text} Your waterskins are empty — the trek ends here.`);
      return;
    }
    if (ns >= 12) {
      setStatus("win");
      setLog(`${ev.text} 🏆 The pyramid! You arrive with ${nt} treasures and ${nw} water to spare.`);
      return;
    }
    setLog(ev.text);
    setChoices(shuffle(TREK_EVENTS).slice(0, 2) as TrekEvent[]);
  };
  const start = () => {
    setStep(0); setWater(6); setTreasure(0); setStatus("play");
    setChoices(shuffle(TREK_EVENTS).slice(0, 2) as TrekEvent[]);
    setLog("The pyramid glitters 12 marches away. Choose your fork.");
  };
  return (
    <div>
      <ScoreBar items={[["March", `${step}/12`], ["Water", "💧".repeat(Math.max(0, water)) || "Empty!"], ["Treasure", `🏺 ${treasure}`], ["Score", score], ["Best", best]]} />
      {status === "win" && <Banner tone="win">🏆 Pyramid reached — score {score}!</Banner>}
      {status === "lose" && <Banner tone="lose">The desert wins this trek. Score {score}.</Banner>}
      <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
        <div className="flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className={`h-2.5 flex-1 rounded-full ${i < step ? "bg-amber-500" : "bg-amber-200"}`} />
          ))}
          <span className="text-xl">🔺</span>
        </div>
        <p className="mt-3 text-center font-semibold">{log}</p>
        {status === "play" && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {choices.map((ev, i) => (
              <button key={`${ev.title}-${i}`} type="button" onClick={() => choose(ev)}
                className="rounded-2xl bg-white p-4 text-left shadow ring-1 ring-amber-200 hover:ring-2 hover:ring-amber-400">
                <span className="text-3xl">{ev.icon}</span>
                <span className="mt-1 block font-extrabold">{i === 0 ? "West fork" : "East fork"}: {ev.title}</span>
                <span className="mt-0.5 block text-sm text-[var(--dim)]">
                  {ev.water !== 0 && `Water ${ev.water > 0 ? "+" : ""}${ev.water} `}
                  {ev.treasure !== 0 && `Treasure ${ev.treasure > 0 ? "+" : ""}${ev.treasure}`}
                  {ev.water === 0 && ev.treasure === 0 && "A quiet march"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-center"><ActionButton onClick={start} label="↻ New trek" /></div>
      <p className="mt-2 text-center text-sm text-[var(--dim)]">Twelve marches to the pyramid. Water below zero ends the trek — balance thirst against greed at every fork.</p>
    </div>
  );
}

export const GAMES4C: Record<string, ComponentType> = {
  "temple-runner": TempleGame,
  "jungle-swing": SwingGame,
  "treasure-diver": DiverGame,
  "cave-explorer": CaveGame,
  "treasure-hunt": TreasureHuntGame,
  "wizard-tower": WizardGame,
  "sahara-trek": SaharaGame,
};
