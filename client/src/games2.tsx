// PlayVerse expansion — Action & Shooting originals.
// Every game here is a distinct mechanic built on the shared Engine shell
// (start / pause / restart / game-over / best score / sound).

import type { ComponentType } from "react";
import { Engine, H, W, circleHit, clamp, rand, randi } from "./gamekit";

/* ------------------------------------------------------- Asteroid Blaster */
type Ast = { x: number; y: number; vx: number; vy: number; r: number };
type AstState = {
  score: number; over?: boolean; won?: boolean;
  ship: { x: number; y: number; a: number; vx: number; vy: number };
  bullets: { x: number; y: number; vx: number; vy: number; life: number }[];
  rocks: Ast[]; lives: number; wave: number; invuln: number; cool: number;
};
function spawnRocks(n: number, ship: { x: number; y: number }): Ast[] {
  const rocks: Ast[] = [];
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0;
    do { x = rand(0, W); y = rand(0, H); } while (Math.hypot(x - ship.x, y - ship.y) < 110);
    const a = rand(0, Math.PI * 2);
    const sp = rand(18, 42);
    rocks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 30 });
  }
  return rocks;
}
function AsteroidGame() {
  return (
    <Engine<AstState>
      id="asteroids" label="Asteroid Blaster"
      blurb="Rotate and thrust your ship, blast the asteroids before they smash you. Big rocks split in two!"
      create={() => {
        const ship = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0 };
        return { score: 0, ship, bullets: [], rocks: spawnRocks(4, ship), lives: 3, wave: 1, invuln: 2, cool: 0 };
      }}
      hud={(s) => [["Score", s.score], ["Lives", "❤️".repeat(Math.max(0, s.lives)) || "—"], ["Wave", s.wave]]}
      step={(s, dt, input, api) => {
        const sh = s.ship;
        if (input.keys.has("ArrowLeft") || input.keys.has("a")) sh.a -= 3.4 * dt;
        if (input.keys.has("ArrowRight") || input.keys.has("d")) sh.a += 3.4 * dt;
        if (input.keys.has("ArrowUp") || input.keys.has("w")) {
          sh.vx += Math.cos(sh.a) * 190 * dt;
          sh.vy += Math.sin(sh.a) * 190 * dt;
        }
        sh.vx *= 0.995; sh.vy *= 0.995;
        sh.x = (sh.x + sh.vx * dt + W) % W;
        sh.y = (sh.y + sh.vy * dt + H) % H;
        s.cool -= dt;
        if ((input.keys.has(" ") || input.pdown) && s.cool <= 0) {
          s.cool = 0.22;
          s.bullets.push({ x: sh.x + Math.cos(sh.a) * 14, y: sh.y + Math.sin(sh.a) * 14, vx: Math.cos(sh.a) * 330 + sh.vx, vy: Math.sin(sh.a) * 330 + sh.vy, life: 0.9 });
          api.beep(880, 0.05);
        }
        s.invuln = Math.max(0, s.invuln - dt);
        for (const b of s.bullets) { b.x = (b.x + b.vx * dt + W) % W; b.y = (b.y + b.vy * dt + H) % H; b.life -= dt; }
        s.bullets = s.bullets.filter((b) => b.life > 0);
        for (const r of s.rocks) { r.x = (r.x + r.vx * dt + W) % W; r.y = (r.y + r.vy * dt + H) % H; }
        const dead = new Set<Ast>();
        for (const b of s.bullets) {
          for (const r of s.rocks) {
            if (dead.has(r)) continue;
            if (circleHit(b.x, b.y, 3, r.x, r.y, r.r)) {
              dead.add(r); b.life = 0;
              s.score += r.r > 20 ? 20 : r.r > 12 ? 50 : 100;
              api.beep(r.r > 12 ? 220 : 330, 0.08, "sawtooth");
              if (r.r > 13) {
                for (let i = 0; i < 2; i++) {
                  const a = rand(0, Math.PI * 2); const sp = rand(30, 70);
                  s.rocks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: r.r / 1.8 });
                }
              }
            }
          }
        }
        s.rocks = s.rocks.filter((r) => !dead.has(r));
        if (s.invuln <= 0) {
          for (const r of s.rocks) {
            if (circleHit(sh.x, sh.y, 10, r.x, r.y, r.r - 3)) {
              s.lives -= 1; s.invuln = 2.5;
              sh.x = W / 2; sh.y = H / 2; sh.vx = 0; sh.vy = 0;
              api.beep(110, 0.25, "sawtooth");
              if (s.lives <= 0) { api.end(false); return; }
              break;
            }
          }
        }
        if (s.rocks.length === 0) {
          s.wave += 1;
          s.rocks = spawnRocks(3 + s.wave, sh);
          api.beep(520, 0.12, "triangle");
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        for (let i = 0; i < 40; i++) ctx.fillRect((i * 67) % W, (i * 41) % H, 2, 2);
        for (const r of s.rocks) {
          ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const rr = r.r * (0.8 + ((i * 37) % 10) / 40);
            const x = r.x + Math.cos(a) * rr, y = r.y + Math.sin(a) * rr;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath(); ctx.stroke();
        }
        ctx.fillStyle = "#fbbf24";
        for (const b of s.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, 7); ctx.fill(); }
        const sh = s.ship;
        if (!(s.invuln > 0 && Math.floor(s.invuln * 8) % 2 === 0)) {
          ctx.save(); ctx.translate(sh.x, sh.y); ctx.rotate(sh.a);
          ctx.fillStyle = "#38bdf8";
          ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -8); ctx.lineTo(-6, 0); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }}
    />
  );
}

/* ------------------------------------------------------- Zombie Survival */
type ZState = {
  score: number; over?: boolean; won?: boolean;
  px: number; py: number; hp: number; wave: number; cool: number; spawnT: number; kills: number;
  zombies: { x: number; y: number; hp: number; sp: number }[];
  shots: { x: number; y: number; vx: number; vy: number }[];
};
function ZombieGame() {
  return (
    <Engine<ZState>
      id="zombie-survival" label="Zombie Survival"
      blurb="Run, aim with the pointer and hold the horde back. Every wave is faster and hungrier than the last."
      create={() => ({ score: 0, px: W / 2, py: H / 2, hp: 5, wave: 1, cool: 0, spawnT: 0, kills: 0, zombies: [], shots: [] })}
      hud={(s) => [["Score", s.score], ["Health", "❤️".repeat(Math.max(0, s.hp)) || "—"], ["Wave", s.wave]]}
      step={(s, dt, input, api) => {
        const sp = 130;
        if (input.keys.has("ArrowLeft") || input.keys.has("a")) s.px -= sp * dt;
        if (input.keys.has("ArrowRight") || input.keys.has("d")) s.px += sp * dt;
        if (input.keys.has("ArrowUp") || input.keys.has("w")) s.py -= sp * dt;
        if (input.keys.has("ArrowDown") || input.keys.has("s")) s.py += sp * dt;
        s.px = clamp(s.px, 16, W - 16); s.py = clamp(s.py, 16, H - 16);
        s.spawnT -= dt;
        const waveSize = 4 + s.wave * 2;
        if (s.spawnT <= 0 && s.kills + s.zombies.length < waveSize + Math.floor(s.kills / 1)) {
          s.spawnT = Math.max(0.35, 1.1 - s.wave * 0.08);
          const side = randi(0, 3);
          const x = side === 0 ? -20 : side === 1 ? W + 20 : rand(0, W);
          const y = side === 2 ? -20 : side === 3 ? H + 20 : rand(0, H);
          s.zombies.push({ x, y, hp: s.wave >= 4 ? 2 : 1, sp: rand(26, 40) + s.wave * 3 });
        }
        s.cool -= dt;
        if (input.pdown && s.cool <= 0) {
          s.cool = 0.16;
          const a = Math.atan2(input.py - s.py, input.px - s.px);
          s.shots.push({ x: s.px, y: s.py, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420 });
          api.beep(920, 0.04);
        }
        for (const sh of s.shots) { sh.x += sh.vx * dt; sh.y += sh.vy * dt; }
        s.shots = s.shots.filter((sh) => sh.x > -10 && sh.x < W + 10 && sh.y > -10 && sh.y < H + 10);
        for (const z of s.zombies) {
          const a = Math.atan2(s.py - z.y, s.px - z.x);
          z.x += Math.cos(a) * z.sp * dt; z.y += Math.sin(a) * z.sp * dt;
        }
        for (const sh of s.shots) {
          for (const z of s.zombies) {
            if (z.hp > 0 && circleHit(sh.x, sh.y, 3, z.x, z.y, 13)) {
              z.hp -= 1; sh.x = -999;
              if (z.hp <= 0) { s.kills += 1; s.score += 25; api.beep(180, 0.07, "sawtooth"); }
            }
          }
        }
        s.zombies = s.zombies.filter((z) => z.hp > 0);
        for (const z of s.zombies) {
          if (circleHit(s.px, s.py, 12, z.x, z.y, 13)) {
            s.hp -= 1; z.hp = 0; api.beep(90, 0.2, "sawtooth");
            if (s.hp <= 0) { api.end(false); return; }
          }
        }
        s.zombies = s.zombies.filter((z) => z.hp > 0);
        if (s.kills >= 4 + s.wave * 2) {
          s.wave += 1; s.kills = 0; s.score += 50; s.hp = Math.min(5, s.hp + 1);
          api.beep(540, 0.12, "triangle");
        }
      }}
      draw={(ctx, s, phase) => {
        ctx.fillStyle = "#14532d"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        for (let i = 0; i < 8; i++) ctx.fillRect((i * 113) % W, (i * 71) % H, 34, 22);
        ctx.font = "24px serif"; ctx.textAlign = "center";
        for (const z of s.zombies) ctx.fillText("🧟", z.x, z.y + 8);
        ctx.fillStyle = "#fde047";
        for (const sh of s.shots) { ctx.beginPath(); ctx.arc(sh.x, sh.y, 3, 0, 7); ctx.fill(); }
        ctx.font = "26px serif";
        ctx.fillText("🧍", s.px, s.py + 9);
        if (phase === "playing") {
          ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(240, 0, 1, 0, 7); ctx.stroke();
        }
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ---------------------------------------------------------- Tank Battle */
type TankState = {
  score: number; over?: boolean; won?: boolean;
  px: number; py: number; pa: number; cool: number; hp: number; round: number;
  foes: { x: number; y: number; a: number; cool: number; hp: number; moveT: number }[];
  shots: { x: number; y: number; vx: number; vy: number; foe: boolean }[];
};
const WALLS = [
  { x: 110, y: 60, w: 16, h: 90 }, { x: 354, y: 60, w: 16, h: 90 },
  { x: 110, y: 210, w: 16, h: 90 }, { x: 354, y: 210, w: 16, h: 90 },
  { x: 200, y: 160, w: 80, h: 16 }, { x: 232, y: 90, w: 16, h: 50 }, { x: 232, y: 220, w: 16, h: 50 },
];
function wallHit(x: number, y: number, r: number): boolean {
  return WALLS.some((w) => x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h);
}
function TankGame() {
  const spawnFoes = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      x: [50, W - 50, 50, W - 50][i % 4]!, y: [45, 45, H - 45, H - 45][i % 4]!,
      a: rand(0, 6.28), cool: rand(1, 2), hp: 2, moveT: 0,
    }));
  return (
    <Engine<TankState>
      id="tank-battle" label="Tank Battle"
      blurb="Roll through the arena, use the walls as cover and knock out every enemy tank. Clear the round to advance."
      create={() => ({ score: 0, px: W / 2, py: H - 50, pa: -Math.PI / 2, cool: 0, hp: 3, round: 1, foes: spawnFoes(2), shots: [] })}
      hud={(s) => [["Score", s.score], ["Armor", "❤️".repeat(Math.max(0, s.hp)) || "—"], ["Round", s.round], ["Tanks left", s.foes.filter((f) => f.hp > 0).length]]}
      step={(s, dt, input, api) => {
        const sp = 95;
        let mx = 0, my = 0;
        if (input.keys.has("ArrowLeft") || input.keys.has("a")) mx -= 1;
        if (input.keys.has("ArrowRight") || input.keys.has("d")) mx += 1;
        if (input.keys.has("ArrowUp") || input.keys.has("w")) my -= 1;
        if (input.keys.has("ArrowDown") || input.keys.has("s")) my += 1;
        if (mx || my) {
          s.pa = Math.atan2(my, mx);
          const nx = clamp(s.px + mx * sp * dt, 18, W - 18);
          const ny = clamp(s.py + my * sp * dt, 18, H - 18);
          if (!wallHit(nx, s.py, 13)) s.px = nx;
          if (!wallHit(s.px, ny, 13)) s.py = ny;
        }
        s.cool -= dt;
        if ((input.keys.has(" ") || input.pdown) && s.cool <= 0) {
          s.cool = 0.45;
          const a = input.pdown ? Math.atan2(input.py - s.py, input.px - s.px) : s.pa;
          s.shots.push({ x: s.px + Math.cos(a) * 16, y: s.py + Math.sin(a) * 16, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, foe: false });
          api.beep(300, 0.07, "sawtooth");
        }
        for (const f of s.foes) {
          if (f.hp <= 0) continue;
          f.moveT -= dt;
          if (f.moveT <= 0) { f.moveT = rand(0.8, 1.8); f.a = Math.atan2(s.py - f.y, s.px - f.x) + rand(-0.7, 0.7); }
          const nx = f.x + Math.cos(f.a) * 42 * dt, ny = f.y + Math.sin(f.a) * 42 * dt;
          if (!wallHit(nx, ny, 13) && nx > 16 && nx < W - 16 && ny > 16 && ny < H - 16) { f.x = nx; f.y = ny; }
          else f.moveT = 0;
          f.cool -= dt;
          if (f.cool <= 0 && Math.hypot(s.px - f.x, s.py - f.y) < 260) {
            f.cool = rand(1.4, 2.2) - Math.min(0.7, s.round * 0.06);
            const a = Math.atan2(s.py - f.y, s.px - f.x);
            s.shots.push({ x: f.x + Math.cos(a) * 16, y: f.y + Math.sin(a) * 16, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, foe: true });
          }
        }
        for (const sh of s.shots) {
          sh.x += sh.vx * dt; sh.y += sh.vy * dt;
          if (wallHit(sh.x, sh.y, 3) || sh.x < 0 || sh.x > W || sh.y < 0 || sh.y > H) { sh.x = -999; continue; }
          if (sh.foe) {
            if (circleHit(sh.x, sh.y, 4, s.px, s.py, 13)) {
              sh.x = -999; s.hp -= 1; api.beep(100, 0.2, "sawtooth");
              if (s.hp <= 0) { api.end(false); return; }
            }
          } else {
            for (const f of s.foes) {
              if (f.hp > 0 && circleHit(sh.x, sh.y, 4, f.x, f.y, 13)) {
                sh.x = -999; f.hp -= 1;
                if (f.hp <= 0) { s.score += 100; api.beep(160, 0.12, "sawtooth"); }
              }
            }
          }
        }
        s.shots = s.shots.filter((sh) => sh.x !== -999);
        if (s.foes.every((f) => f.hp <= 0)) {
          s.round += 1; s.score += 150; s.hp = Math.min(3, s.hp + 1);
          s.foes = spawnFoes(Math.min(4, 1 + s.round));
          api.beep(560, 0.12, "triangle");
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#3f3f46"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#78716c";
        for (const w of WALLS) ctx.fillRect(w.x, w.y, w.w, w.h);
        const drawTank = (x: number, y: number, a: number, body: string) => {
          ctx.save(); ctx.translate(x, y);
          ctx.fillStyle = body; ctx.fillRect(-13, -10, 26, 20);
          ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(-13, -13, 26, 5); ctx.fillRect(-13, 8, 26, 5);
          ctx.rotate(a); ctx.fillStyle = "#1c1917"; ctx.fillRect(0, -3, 24, 6);
          ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
          ctx.restore();
        };
        for (const f of s.foes) if (f.hp > 0) drawTank(f.x, f.y, Math.atan2(s.py - f.y, s.px - f.x), "#b91c1c");
        drawTank(s.px, s.py, s.pa, "#16a34a");
        ctx.fillStyle = "#fbbf24";
        for (const sh of s.shots) { ctx.beginPath(); ctx.arc(sh.x, sh.y, 4, 0, 7); ctx.fill(); }
      }}
    />
  );
}

/* --------------------------------------------------------- Dragon Flight */
type DragonState = {
  score: number; over?: boolean; won?: boolean;
  y: number; vy: number; dist: number; cool: number; hp: number;
  towers: { x: number; h: number; shot: boolean; cool: number }[];
  fires: { x: number; y: number }[];
  bolts: { x: number; y: number; vx: number; vy: number }[];
  coins: { x: number; y: number }[];
};
function DragonGame() {
  return (
    <Engine<DragonState>
      id="dragon-flight" label="Dragon Flight"
      blurb="Hold to climb, release to dive. Breathe fire on the knight towers and grab coins — three hits and you're grounded."
      create={() => ({ score: 0, y: H / 2, vy: 0, dist: 0, cool: 0, hp: 3, towers: [], fires: [], bolts: [], coins: [] })}
      hud={(s) => [["Score", s.score], ["Health", "❤️".repeat(Math.max(0, s.hp)) || "—"], ["Distance", `${Math.floor(s.dist)}m`]]}
      step={(s, dt, input, api) => {
        const speed = 130 + Math.min(90, s.dist / 25);
        s.dist += speed * dt / 10;
        s.vy += (input.pdown || input.keys.has(" ") || input.keys.has("ArrowUp") ? -620 : 480) * dt;
        s.vy = clamp(s.vy, -230, 260);
        s.y += s.vy * dt;
        if (s.y < 18) { s.y = 18; s.vy = 0; }
        if (s.y > H - 40) {
          s.hp -= 1; s.y = H - 90; s.vy = -160; api.beep(100, 0.2, "sawtooth");
          if (s.hp <= 0) { api.end(false); return; }
        }
        if (s.towers.length === 0 || s.towers[s.towers.length - 1]!.x < W - rand(170, 260)) {
          s.towers.push({ x: W + 40, h: rand(60, 130), shot: false, cool: rand(0.5, 1.5) });
          if (Math.random() < 0.7) s.coins.push({ x: W + 60, y: rand(40, H - 110) });
        }
        s.cool -= dt;
        if (s.cool <= 0) {
          s.cool = 0.28;
          s.fires.push({ x: 78, y: s.y + 6 });
        }
        for (const f of s.fires) f.x += 320 * dt;
        s.fires = s.fires.filter((f) => f.x < W + 20);
        for (const t of s.towers) {
          t.x -= speed * dt;
          t.cool -= dt;
          if (!t.shot && t.cool <= 0 && t.x > 90 && t.x < W) {
            t.cool = rand(1.2, 2.1);
            const a = Math.atan2(s.y - (H - t.h), 60 - t.x);
            s.bolts.push({ x: t.x, y: H - t.h, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200 });
          }
          for (const f of s.fires) {
            if (Math.abs(f.x - t.x) < 16 && f.y > H - t.h - 6) { t.shot = true; f.x = W + 99; s.score += 40; api.beep(190, 0.1, "sawtooth"); }
          }
          if (!t.shot && t.x < 66 && t.x > 30 && s.y > H - t.h - 16) {
            s.hp -= 1; t.shot = true; api.beep(100, 0.2, "sawtooth");
            if (s.hp <= 0) { api.end(false); return; }
          }
        }
        s.towers = s.towers.filter((t) => t.x > -50);
        for (const b of s.bolts) {
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (circleHit(b.x, b.y, 4, 58, s.y, 15)) {
            b.x = -999; s.hp -= 1; api.beep(100, 0.2, "sawtooth");
            if (s.hp <= 0) { api.end(false); return; }
          }
        }
        s.bolts = s.bolts.filter((b) => b.x !== -999 && b.y < H + 10);
        for (const c of s.coins) {
          c.x -= speed * dt;
          if (circleHit(c.x, c.y, 10, 58, s.y, 16)) { c.x = -999; s.score += 15; api.beep(1180, 0.06); }
        }
        s.coins = s.coins.filter((c) => c.x > -20);
        s.score += dt * 2;
        s.score = Math.floor(s.score);
      }}
      draw={(ctx, s) => {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#7dd3fc"); grad.addColorStop(1, "#e0f2fe");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#166534";
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H - 18 - ((x * 13) % 17));
        ctx.lineTo(W, H); ctx.fill();
        for (const t of s.towers) {
          ctx.fillStyle = t.shot ? "#78716c" : "#57534e";
          ctx.fillRect(t.x - 13, H - t.h, 26, t.h);
          ctx.fillStyle = "#b91c1c"; ctx.fillRect(t.x - 16, H - t.h - 8, 32, 8);
          if (!t.shot) { ctx.font = "13px serif"; ctx.fillText("🏹", t.x - 7, H - t.h - 10); }
        }
        ctx.font = "17px serif";
        for (const c of s.coins) ctx.fillText("🪙", c.x - 8, c.y + 6);
        ctx.fillStyle = "#f97316";
        for (const f of s.fires) { ctx.beginPath(); ctx.arc(f.x, f.y, 5, 0, 7); ctx.fill(); }
        ctx.fillStyle = "#111827";
        for (const b of s.bolts) { ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, 7); ctx.fill(); }
        ctx.font = "34px serif"; ctx.fillText("🐉", 38, s.y + 12);
      }}
    />
  );
}

/* ---------------------------------------------------------- Blade Master */
type BladeState = {
  score: number; over?: boolean; won?: boolean;
  items: { x: number; y: number; vx: number; vy: number; kind: string; sliced: boolean; rot: number }[];
  lives: number; spawnT: number; time: number;
  trail: { x: number; y: number }[];
};
const FRUITS = ["🍉", "🍊", "🍋", "🍎", "🥝", "🍓"];
function BladeGame() {
  return (
    <Engine<BladeState>
      id="blade-master" label="Blade Master"
      blurb="Drag your blade through the flying fruit to slice it. Miss three fruits or slice one bomb and it's over."
      create={() => ({ score: 0, items: [], lives: 3, spawnT: 0, time: 0, trail: [] })}
      hud={(s) => [["Score", s.score], ["Lives", "❤️".repeat(Math.max(0, s.lives)) || "—"]]}
      step={(s, dt, input, api) => {
        s.time += dt;
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = Math.max(0.4, 0.95 - s.time * 0.008);
          const bomb = Math.random() < 0.16;
          s.items.push({
            x: rand(60, W - 60), y: H + 24, vx: rand(-40, 40), vy: -rand(330, 420),
            kind: bomb ? "💣" : FRUITS[randi(0, FRUITS.length - 1)]!, sliced: false, rot: rand(0, 6),
          });
        }
        for (const it of s.items) {
          it.vy += 620 * dt;
          it.x += it.vx * dt; it.y += it.vy * dt; it.rot += dt * 2;
          if (input.pdown && !it.sliced && Math.hypot(input.px - it.x, input.py - it.y) < 27) {
            it.sliced = true;
            if (it.kind === "💣") {
              s.lives = 0; api.beep(80, 0.35, "sawtooth"); api.end(false); return;
            }
            s.score += 10; api.beep(700 + Math.random() * 300, 0.05);
          }
          if (it.y > H + 30 && !it.sliced && it.kind !== "💣") {
            it.sliced = true; s.lives -= 1; api.beep(140, 0.15, "sawtooth");
            if (s.lives <= 0) { api.end(false); return; }
          }
        }
        s.items = s.items.filter((it) => it.y < H + 40);
        if (input.pdown) {
          s.trail.push({ x: input.px, y: input.py });
          if (s.trail.length > 14) s.trail.shift();
        } else s.trail = [];
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#fef3c7"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#f59e0b"; ctx.fillRect(0, H - 26, W, 26);
        ctx.font = "30px serif"; ctx.textAlign = "center";
        for (const it of s.items) {
          if (it.sliced && it.kind !== "💣") {
            ctx.globalAlpha = 0.55;
            ctx.fillText(it.kind, it.x - 10, it.y + 12);
            ctx.fillText(it.kind, it.x + 10, it.y + 16);
            ctx.globalAlpha = 1;
          } else {
            ctx.fillText(it.kind, it.x, it.y + 10);
          }
        }
        if (s.trail.length > 1) {
          ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 4; ctx.beginPath();
          ctx.moveTo(s.trail[0]!.x, s.trail[0]!.y);
          for (const p of s.trail) ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
        ctx.textAlign = "left";
      }}
    />
  );
}

/* -------------------------------------------------------- Robot Rampage */
type RobotState = {
  score: number; over?: boolean; won?: boolean;
  x: number; y: number; vx: number; vy: number; face: number; onGround: boolean; cool: number; hp: number;
  bots: { x: number; y: number; dir: number; hp: number; min: number; max: number }[];
  shots: { x: number; y: number; vx: number }[];
  coins: { x: number; y: number; taken: boolean }[];
  level: number;
};
const PLATS = [
  { x: 0, y: 330, w: 480 }, { x: 30, y: 262, w: 110 }, { x: 190, y: 218, w: 110 },
  { x: 340, y: 262, w: 110 }, { x: 120, y: 150, w: 100 }, { x: 290, y: 118, w: 100 }, { x: 30, y: 84, w: 90 },
];
function RobotGame() {
  const mkBots = (level: number) =>
    PLATS.slice(1, 4 + Math.min(3, level)).map((p, i) => ({
      x: p.x + 30, y: p.y - 14, dir: i % 2 ? 1 : -1, hp: 1, min: p.x + 12, max: p.x + p.w - 12,
    }));
  const mkCoins = () => PLATS.slice(1).map((p) => ({ x: p.x + p.w / 2, y: p.y - 22, taken: false }));
  return (
    <Engine<RobotState>
      id="robot-rampage" label="Robot Rampage"
      blurb="Run and jump across the factory platforms, blast the patrol robots and grab every coin to clear the level."
      create={() => ({ score: 0, x: 30, y: 290, vx: 0, vy: 0, face: 1, onGround: false, cool: 0, hp: 3, bots: mkBots(1), shots: [], coins: mkCoins(), level: 1 })}
      hud={(s) => [["Score", s.score], ["Health", "❤️".repeat(Math.max(0, s.hp)) || "—"], ["Level", s.level], ["Coins", `${s.coins.filter((c) => c.taken).length}/${s.coins.length}`]]}
      step={(s, dt, input, api) => {
        const accel = 700;
        if (input.keys.has("ArrowLeft") || input.keys.has("a")) { s.vx = Math.max(-170, s.vx - accel * dt); s.face = -1; }
        else if (input.keys.has("ArrowRight") || input.keys.has("d")) { s.vx = Math.min(170, s.vx + accel * dt); s.face = 1; }
        else s.vx *= Math.pow(0.0001, dt);
        if ((input.keys.has("ArrowUp") || input.keys.has("w") || input.keys.has(" ")) && s.onGround) {
          s.vy = -355; s.onGround = false; api.beep(420, 0.06);
        }
        s.vy += 900 * dt;
        s.x = clamp(s.x + s.vx * dt, 12, W - 12);
        const prevBottom = s.y + 14 - s.vy * dt;
        s.y += s.vy * dt;
        s.onGround = false;
        if (s.vy >= 0) {
          for (const p of PLATS) {
            if (s.x > p.x - 8 && s.x < p.x + p.w + 8 && prevBottom <= p.y + 1 && s.y + 14 >= p.y) {
              s.y = p.y - 14; s.vy = 0; s.onGround = true;
            }
          }
        }
        if (s.y > H + 30) {
          s.hp -= 1; api.beep(100, 0.2, "sawtooth");
          if (s.hp <= 0) { api.end(false); return; }
          s.x = 30; s.y = 290; s.vy = 0;
        }
        s.cool -= dt;
        if (input.pdown && s.cool <= 0) {
          s.cool = 0.25;
          s.face = input.px >= s.x ? 1 : -1;
          s.shots.push({ x: s.x + s.face * 14, y: s.y, vx: s.face * 340 });
          api.beep(840, 0.05);
        }
        for (const sh of s.shots) sh.x += sh.vx * dt;
        s.shots = s.shots.filter((sh) => sh.x > 0 && sh.x < W);
        for (const b of s.bots) {
          if (b.hp <= 0) continue;
          b.x += b.dir * (34 + s.level * 4) * dt;
          if (b.x < b.min) { b.x = b.min; b.dir = 1; }
          if (b.x > b.max) { b.x = b.max; b.dir = -1; }
          for (const sh of s.shots) {
            if (Math.abs(sh.x - b.x) < 14 && Math.abs(sh.y - b.y) < 14) {
              b.hp = 0; sh.x = -999; s.score += 50; api.beep(170, 0.1, "sawtooth");
            }
          }
          if (Math.abs(b.x - s.x) < 17 && Math.abs(b.y - s.y) < 20) {
            s.hp -= 1; b.hp = 0; api.beep(100, 0.2, "sawtooth");
            if (s.hp <= 0) { api.end(false); return; }
          }
        }
        s.shots = s.shots.filter((sh) => sh.x !== -999);
        for (const c of s.coins) {
          if (!c.taken && Math.abs(c.x - s.x) < 15 && Math.abs(c.y - s.y) < 18) {
            c.taken = true; s.score += 25; api.beep(1150, 0.06);
          }
        }
        if (s.coins.every((c) => c.taken) && s.bots.every((b) => b.hp <= 0)) {
          s.level += 1; s.score += 100;
          s.bots = mkBots(s.level); s.coins = mkCoins();
          s.x = 30; s.y = 290; s.vy = 0;
          api.beep(600, 0.14, "triangle");
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#1e293b"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#334155";
        for (let i = 0; i < 6; i++) ctx.fillRect(20 + i * 80, 30, 44, 30);
        for (const p of PLATS) {
          ctx.fillStyle = "#64748b"; ctx.fillRect(p.x, p.y, p.w, 10);
          ctx.fillStyle = "#94a3b8"; ctx.fillRect(p.x, p.y, p.w, 3);
        }
        ctx.font = "16px serif"; ctx.textAlign = "center";
        for (const c of s.coins) if (!c.taken) ctx.fillText("🪙", c.x, c.y + 6);
        ctx.font = "24px serif";
        for (const b of s.bots) if (b.hp > 0) ctx.fillText("🤖", b.x, b.y + 8);
        ctx.fillStyle = "#fbbf24";
        for (const sh of s.shots) { ctx.beginPath(); ctx.arc(sh.x, sh.y, 3.5, 0, 7); ctx.fill(); }
        ctx.font = "26px serif";
        ctx.fillText("🦸", s.x, s.y + 9);
        ctx.textAlign = "left";
      }}
    />
  );
}

export const GAMES2A: Record<string, ComponentType> = {
  asteroids: AsteroidGame,
  "zombie-survival": ZombieGame,
  "tank-battle": TankGame,
  "dragon-flight": DragonGame,
  "blade-master": BladeGame,
  "robot-rampage": RobotGame,
};

/* --------------------------------------------------------- Pirate Cannon */
type PirateState = {
  score: number; over?: boolean; won?: boolean;
  angle: number; power: number; charging: boolean; balls: number; hits: number; misses: number;
  ball: { x: number; y: number; vx: number; vy: number } | null;
  ships: { x: number; y: number; dir: number; sp: number; hp: number }[];
  spawnT: number;
};
function PirateGame() {
  return (
    <Engine<PirateState>
      id="pirate-cannon" label="Pirate Cannon"
      blurb="Aim the cliff cannon with your pointer, hold to charge power, release to fire. Sink five ships before three slip past."
      create={() => ({ score: 0, angle: -0.6, power: 40, charging: false, balls: 0, hits: 0, misses: 0, ball: null, ships: [], spawnT: 0 })}
      hud={(s) => [["Score", s.score], ["Ships sunk", s.hits], ["Escaped", `${s.misses}/3`], ["Power", `${Math.round(s.power)}%`]]}
      step={(s, dt, input, api) => {
        s.angle = clamp(Math.atan2(input.py - 300, input.px - 44), -1.35, -0.08);
        if (input.pdown && !s.ball) {
          s.charging = true;
          s.power = Math.min(100, s.power + 55 * dt);
        }
        if (!input.pdown && s.charging && !s.ball) {
          s.charging = false;
          const sp = 240 + s.power * 3.4;
          s.ball = { x: 52, y: 296, vx: Math.cos(s.angle) * sp, vy: Math.sin(s.angle) * sp };
          s.power = 40;
          api.beep(240, 0.12, "sawtooth");
        }
        if (s.ball) {
          const b = s.ball;
          b.vy += 520 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
          for (const sh of s.ships) {
            if (sh.hp > 0 && Math.abs(b.x - sh.x) < 24 && Math.abs(b.y - sh.y) < 14) {
              sh.hp = 0; s.hits += 1; s.score += 60; s.ball = null; api.beep(150, 0.15, "sawtooth"); break;
            }
          }
          if (s.ball && (b.y > H + 10 || b.x > W + 10)) s.ball = null;
        }
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = rand(1.6, 2.8);
          const dir = Math.random() < 0.5 ? 1 : -1;
          s.ships.push({ x: dir > 0 ? -30 : W + 30, y: rand(292, 322), dir, sp: rand(22, 40) + s.hits * 2, hp: 1 });
        }
        for (const sh of s.ships) {
          sh.x += sh.dir * sh.sp * dt;
          if (sh.hp > 0 && ((sh.dir > 0 && sh.x > W + 34) || (sh.dir < 0 && sh.x < -34))) {
            sh.hp = -1; s.misses += 1; api.beep(130, 0.18, "sawtooth");
            if (s.misses >= 3) { api.end(false); return; }
          }
        }
        s.ships = s.ships.filter((sh) => sh.hp !== -1 && sh.x > -60 && sh.x < W + 60);
        if (s.hits >= 12) api.end(true);
      }}
      draw={(ctx, s) => {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#bae6fd"); grad.addColorStop(0.75, "#7dd3fc"); grad.addColorStop(0.76, "#0284c7"); grad.addColorStop(1, "#0369a1");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#a16207"; ctx.fillRect(0, 268, 84, 92);
        ctx.font = "30px serif"; ctx.textAlign = "center";
        for (const sh of s.ships) if (sh.hp > 0) ctx.fillText("⛵", sh.x, sh.y + 10);
        ctx.save();
        ctx.translate(44, 300); ctx.rotate(s.angle);
        ctx.fillStyle = "#1f2937"; ctx.fillRect(0, -6, 40, 12);
        ctx.restore();
        ctx.font = "30px serif"; ctx.fillText("💣", 30, 318);
        if (s.ball) { ctx.fillStyle = "#111827"; ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, 6, 0, 7); ctx.fill(); }
        if (s.charging) {
          ctx.fillStyle = "#ef4444"; ctx.fillRect(90, 330, s.power * 1.6, 10);
          ctx.strokeStyle = "#fff"; ctx.strokeRect(90, 330, 160, 10);
        }
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ------------------------------------------------------------ Sky Turret */
type TurretSkyState = {
  score: number; over?: boolean; won?: boolean;
  cool: number; landed: number; kills: number;
  planes: { x: number; y: number; dir: number; sp: number; hp: number; dropped: boolean }[];
  jumpers: { x: number; y: number; vy: number }[];
  shots: { x: number; y: number; vx: number; vy: number }[];
  spawnT: number;
};
function SkyTurretGame() {
  return (
    <Engine<TurretSkyState>
      id="sky-turret" label="Sky Turret"
      blurb="Man the anti-air turret. Blast the planes — and the paratroopers they drop. If five troopers land, the base falls."
      create={() => ({ score: 0, cool: 0, landed: 0, kills: 0, planes: [], jumpers: [], shots: [], spawnT: 0 })}
      hud={(s) => [["Score", s.score], ["Planes down", s.kills], ["Troopers landed", `${s.landed}/5`]]}
      step={(s, dt, input, api) => {
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = Math.max(0.8, 2 - s.kills * 0.03);
          const dir = Math.random() < 0.5 ? 1 : -1;
          s.planes.push({ x: dir > 0 ? -30 : W + 30, y: rand(30, 120), dir, sp: rand(55, 95), hp: 1, dropped: false });
        }
        s.cool -= dt;
        if (input.pdown && s.cool <= 0) {
          s.cool = 0.18;
          const a = Math.atan2(input.py - 336, input.px - W / 2);
          s.shots.push({ x: W / 2, y: 330, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430 });
          api.beep(900, 0.04);
        }
        for (const sh of s.shots) { sh.x += sh.vx * dt; sh.y += sh.vy * dt; }
        s.shots = s.shots.filter((sh) => sh.y > -10 && sh.x > -10 && sh.x < W + 10);
        for (const p of s.planes) {
          p.x += p.dir * p.sp * dt;
          if (!p.dropped && p.x > 60 && p.x < W - 60 && Math.random() < dt * 0.5) {
            p.dropped = true;
            s.jumpers.push({ x: p.x, y: p.y + 12, vy: 34 });
          }
          for (const sh of s.shots) {
            if (p.hp > 0 && Math.abs(sh.x - p.x) < 22 && Math.abs(sh.y - p.y) < 11) {
              p.hp = 0; sh.x = -999; s.kills += 1; s.score += 40; api.beep(170, 0.12, "sawtooth");
            }
          }
        }
        s.planes = s.planes.filter((p) => p.hp > 0 && p.x > -50 && p.x < W + 50);
        for (const j of s.jumpers) {
          j.y += j.vy * dt;
          for (const sh of s.shots) {
            if (Math.abs(sh.x - j.x) < 11 && Math.abs(sh.y - j.y) < 13) {
              j.y = -999; sh.x = -999; s.score += 30; api.beep(500, 0.08);
            }
          }
          if (j.y >= 330) {
            j.y = -999; s.landed += 1; api.beep(120, 0.2, "sawtooth");
            if (s.landed >= 5) { api.end(false); return; }
          }
        }
        s.jumpers = s.jumpers.filter((j) => j.y !== -999);
        s.shots = s.shots.filter((sh) => sh.x !== -999);
      }}
      draw={(ctx, s) => {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#38bdf8"); grad.addColorStop(1, "#e0f2fe");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#65a30d"; ctx.fillRect(0, 336, W, 24);
        ctx.font = "26px serif"; ctx.textAlign = "center";
        for (const p of s.planes) ctx.fillText(p.dir > 0 ? "🛩️" : "🛩️", p.x, p.y + 8);
        ctx.font = "18px serif";
        for (const j of s.jumpers) { ctx.fillText("🪂", j.x, j.y); }
        ctx.fillStyle = "#f59e0b";
        for (const sh of s.shots) { ctx.beginPath(); ctx.arc(sh.x, sh.y, 3, 0, 7); ctx.fill(); }
        ctx.font = "30px serif"; ctx.fillText("🏰", W / 2, 344);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ----------------------------------------------------------- Viking Raid */
type VikingState = {
  score: number; over?: boolean; won?: boolean;
  y: number; hp: number; cool: number; dist: number;
  rocks: { x: number; y: number }[];
  serpents: { x: number; y: number; hp: number; ph: number }[];
  axes: { x: number; y: number; vx: number; rot: number }[];
  spawnT: number;
};
function VikingGame() {
  return (
    <Engine<VikingState>
      id="viking-raid" label="Viking Raid"
      blurb="Steer the longship up and down the channel, dodge the rocks and hurl axes at the sea serpents blocking your raid."
      create={() => ({ score: 0, y: H / 2, hp: 3, cool: 0, dist: 0, rocks: [], serpents: [], axes: [], spawnT: 0 })}
      hud={(s) => [["Score", s.score], ["Hull", "❤️".repeat(Math.max(0, s.hp)) || "—"], ["Distance", `${Math.floor(s.dist)}m`]]}
      step={(s, dt, input, api) => {
        const speed = 120 + Math.min(80, s.dist / 30);
        s.dist += speed * dt / 10;
        if (input.keys.has("ArrowUp") || input.keys.has("w")) s.y -= 150 * dt;
        if (input.keys.has("ArrowDown") || input.keys.has("s")) s.y += 150 * dt;
        if (input.pdown) s.y += clamp(input.py - s.y, -160 * dt, 160 * dt);
        s.y = clamp(s.y, 26, H - 26);
        s.cool -= dt;
        if ((input.keys.has(" ") || input.pdown) && s.cool <= 0) {
          s.cool = 0.34;
          s.axes.push({ x: 92, y: s.y, vx: 330, rot: 0 });
          api.beep(500, 0.05, "triangle");
        }
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = rand(0.8, 1.5);
          if (Math.random() < 0.45) s.rocks.push({ x: W + 30, y: rand(24, H - 24) });
          else s.serpents.push({ x: W + 30, y: rand(30, H - 30), hp: 2, ph: rand(0, 6) });
        }
        for (const r of s.rocks) {
          r.x -= speed * dt;
          if (circleHit(r.x, r.y, 15, 66, s.y, 17)) {
            r.x = -999; s.hp -= 1; api.beep(100, 0.2, "sawtooth");
            if (s.hp <= 0) { api.end(false); return; }
          }
        }
        s.rocks = s.rocks.filter((r) => r.x > -30);
        for (const sp of s.serpents) {
          sp.x -= speed * 0.82 * dt;
          sp.ph += dt * 3;
          const yy = sp.y + Math.sin(sp.ph) * 12;
          for (const ax of s.axes) {
            if (Math.abs(ax.x - sp.x) < 18 && Math.abs(ax.y - yy) < 18) {
              ax.x = W + 999; sp.hp -= 1;
              if (sp.hp <= 0) { s.score += 50; api.beep(180, 0.1, "sawtooth"); }
            }
          }
          if (sp.hp > 0 && circleHit(sp.x, yy, 16, 66, s.y, 17)) {
            sp.hp = 0; s.hp -= 1; api.beep(100, 0.2, "sawtooth");
            if (s.hp <= 0) { api.end(false); return; }
          }
        }
        s.serpents = s.serpents.filter((sp) => sp.hp > 0 && sp.x > -30);
        for (const ax of s.axes) { ax.x += ax.vx * dt; ax.rot += dt * 9; }
        s.axes = s.axes.filter((ax) => ax.x < W + 30);
        s.score += dt * 2;
        s.score = Math.floor(s.score);
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#0e7490"; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          const yy = 40 + i * 70;
          ctx.moveTo(0, yy); ctx.bezierCurveTo(120, yy + 8, 300, yy - 8, W, yy); ctx.stroke();
        }
        ctx.font = "30px serif"; ctx.textAlign = "center";
        for (const r of s.rocks) ctx.fillText("🪨", r.x, r.y + 10);
        for (const sp of s.serpents) ctx.fillText("🐍", sp.x, sp.y + Math.sin(sp.ph) * 12 + 10);
        ctx.font = "20px serif";
        for (const ax of s.axes) {
          ctx.save(); ctx.translate(ax.x, ax.y); ctx.rotate(ax.rot); ctx.fillText("🪓", 0, 7); ctx.restore();
        }
        ctx.font = "36px serif"; ctx.fillText("⛵", 66, s.y + 12);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ------------------------------------------------------------ Cyber Chase */
type CyberState = {
  score: number; over?: boolean; won?: boolean;
  lane: number; x: number; hp: number; cool: number; dist: number; boost: number;
  foes: { lane: number; x: number; kind: string; hp: number }[];
  shots: { x: number; lane: number }[];
  spawnT: number;
};
const LANE_Y = [96, 180, 264];
function CyberGame() {
  return (
    <Engine<CyberState>
      id="cyber-chase" label="Cyber Chase"
      blurb="Weave your hover bike between three lanes, blast the rogue drones and smash through the data barriers — carefully."
      create={() => ({ score: 0, lane: 1, x: 70, hp: 3, cool: 0, dist: 0, boost: 100, foes: [], shots: [], spawnT: 0 })}
      hud={(s) => [["Score", s.score], ["Hull", "❤️".repeat(Math.max(0, s.hp)) || "—"], ["Distance", `${Math.floor(s.dist)}m`]]}
      onKey={(s, key, api) => {
        if (key === "ArrowUp" || key === "w") { s.lane = Math.max(0, s.lane - 1); api.beep(440, 0.04); }
        if (key === "ArrowDown" || key === "s") { s.lane = Math.min(2, s.lane + 1); api.beep(440, 0.04); }
      }}
      step={(s, dt, input, api) => {
        const speed = 150 + Math.min(110, s.dist / 22);
        s.dist += speed * dt / 10;
        const targetY = LANE_Y[s.lane]!;
        s.x = 70;
        void targetY;
        if (input.pdown) {
          const lane = input.py < 138 ? 0 : input.py < 222 ? 1 : 2;
          if (lane !== s.lane) { s.lane = lane; }
        }
        s.cool -= dt;
        if ((input.keys.has(" ") || input.pdown) && s.cool <= 0) {
          s.cool = 0.22;
          s.shots.push({ x: 96, lane: s.lane });
          api.beep(880, 0.04);
        }
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = Math.max(0.55, 1.15 - s.dist * 0.002);
          const drone = Math.random() < 0.55;
          s.foes.push({ lane: randi(0, 2), x: W + 30, kind: drone ? "🤖" : "🧱", hp: drone ? 1 : 99 });
        }
        for (const sh of s.shots) sh.x += 360 * dt;
        s.shots = s.shots.filter((sh) => sh.x < W + 10);
        const y = LANE_Y[s.lane]!;
        for (const f of s.foes) {
          f.x -= speed * dt;
          for (const sh of s.shots) {
            if (f.kind === "🤖" && f.hp > 0 && sh.lane === f.lane && Math.abs(sh.x - f.x) < 16) {
              f.hp = 0; sh.x = W + 99; s.score += 30; api.beep(200, 0.08, "sawtooth");
            }
          }
          if (f.hp > 0 && f.lane === s.lane && Math.abs(f.x - 76) < 24) {
            f.hp = 0; s.hp -= 1; api.beep(100, 0.2, "sawtooth");
            if (s.hp <= 0) { api.end(false); return; }
          }
          void y;
        }
        s.foes = s.foes.filter((f) => f.hp > 0 && f.x > -40);
        s.score += dt * 2.5;
        s.score = Math.floor(s.score);
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#111827"; ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i === s.lane ? "rgba(56,189,248,0.16)" : "rgba(255,255,255,0.04)";
          ctx.fillRect(0, LANE_Y[i]! - 40, W, 80);
          ctx.strokeStyle = "#334155"; ctx.setLineDash([14, 18]);
          ctx.beginPath(); ctx.moveTo(0, LANE_Y[i]! + 42); ctx.lineTo(W, LANE_Y[i]! + 42); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.font = "28px serif"; ctx.textAlign = "center";
        for (const f of s.foes) ctx.fillText(f.kind, f.x, LANE_Y[f.lane]! + 10);
        ctx.fillStyle = "#f472b6";
        for (const sh of s.shots) { ctx.beginPath(); ctx.arc(sh.x, LANE_Y[sh.lane]!, 4, 0, 7); ctx.fill(); }
        ctx.font = "32px serif";
        ctx.fillText("🏍️", 70, LANE_Y[s.lane]! + 11);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* --------------------------------------------------------- Gladiator Arena */
type GladState = {
  score: number; over?: boolean; won?: boolean;
  x: number; y: number; hp: number; wave: number; kills: number; swingT: number; dashT: number;
  foes: { x: number; y: number; hp: number; sp: number }[];
  spawnT: number;
};
function GladiatorGame() {
  return (
    <Engine<GladState>
      id="gladiator-arena" label="Gladiator Arena"
      blurb="The crowd roars! Dash around the arena and swing your sword — every foe you fell raises the next wave."
      create={() => ({ score: 0, x: W / 2, y: H / 2, hp: 5, wave: 1, kills: 0, swingT: 0, dashT: 0, foes: [], spawnT: 0 })}
      hud={(s) => [["Score", s.score], ["Health", "❤️".repeat(Math.max(0, s.hp)) || "—"], ["Wave", s.wave]]}
      step={(s, dt, input, api) => {
        let mx = 0, my = 0;
        if (input.keys.has("ArrowLeft") || input.keys.has("a")) mx -= 1;
        if (input.keys.has("ArrowRight") || input.keys.has("d")) mx += 1;
        if (input.keys.has("ArrowUp") || input.keys.has("w")) my -= 1;
        if (input.keys.has("ArrowDown") || input.keys.has("s")) my += 1;
        if (input.pdown) {
          const dx = input.px - s.x, dy = input.py - s.y;
          const d = Math.hypot(dx, dy);
          if (d > 26) { mx = dx / d; my = dy / d; }
        }
        const sp = input.keys.has("Shift") && (mx || my) ? 230 : 135;
        s.x = clamp(s.x + mx * sp * dt, 24, W - 24);
        s.y = clamp(s.y + my * sp * dt, 24, H - 24);
        // Keep the fighter inside the arena ring.
        const dc = Math.hypot(s.x - W / 2, s.y - H / 2);
        if (dc > 148) {
          s.x = W / 2 + ((s.x - W / 2) / dc) * 148;
          s.y = H / 2 + ((s.y - H / 2) / dc) * 148;
        }
        s.swingT -= dt;
        if ((input.pdown || input.keys.has(" ")) && s.swingT <= 0) {
          s.swingT = 0.32;
          api.beep(300, 0.06, "triangle");
          for (const f of s.foes) {
            if (Math.hypot(f.x - s.x, f.y - s.y) < 46) {
              f.hp -= 1;
              if (f.hp <= 0) { s.kills += 1; s.score += 30; api.beep(170, 0.09, "sawtooth"); }
            }
          }
        }
        s.spawnT -= dt;
        if (s.spawnT <= 0 && s.foes.length < 3 + s.wave) {
          s.spawnT = Math.max(0.5, 1.3 - s.wave * 0.1);
          const a = rand(0, Math.PI * 2);
          s.foes.push({ x: W / 2 + Math.cos(a) * 160, y: H / 2 + Math.sin(a) * 160, hp: s.wave >= 3 ? 2 : 1, sp: rand(30, 46) + s.wave * 3 });
        }
        for (const f of s.foes) {
          if (f.hp <= 0) continue;
          const a = Math.atan2(s.y - f.y, s.x - f.x);
          f.x += Math.cos(a) * f.sp * dt; f.y += Math.sin(a) * f.sp * dt;
          if (Math.hypot(f.x - s.x, f.y - s.y) < 22) {
            f.hp = 0; s.hp -= 1; api.beep(100, 0.2, "sawtooth");
            if (s.hp <= 0) { api.end(false); return; }
          }
        }
        s.foes = s.foes.filter((f) => f.hp > 0);
        if (s.kills >= s.wave * 5) {
          s.wave += 1; s.kills = 0; s.score += 75; s.hp = Math.min(5, s.hp + 1);
          api.beep(560, 0.12, "triangle");
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#fef3c7"; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "#b45309"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(W / 2, H / 2, 152, 0, 7); ctx.stroke();
        ctx.strokeStyle = "rgba(180,83,9,0.3)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(W / 2, H / 2, 90, 0, 7); ctx.stroke();
        ctx.font = "24px serif"; ctx.textAlign = "center";
        for (const f of s.foes) ctx.fillText(f.hp > 1 ? "🦹" : "🥷", f.x, f.y + 8);
        if (s.swingT > 0.16) {
          ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(s.x, s.y, 40, -0.6, 1.1); ctx.stroke();
        }
        ctx.font = "28px serif"; ctx.fillText("⚔️", s.x, s.y + 9);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ---------------------------------------------------------- Knight's Quest */
type KnightState = {
  score: number; over?: boolean; won?: boolean;
  x: number; y: number; vx: number; vy: number; onGround: boolean; hp: number; level: number; invuln: number;
  coins: { x: number; y: number; taken: boolean }[];
  foes: { x: number; y: number; dir: number; min: number; max: number; alive: boolean }[];
};
const KPLATS = [
  { x: 0, y: 332, w: 480 }, { x: 40, y: 268, w: 96 }, { x: 176, y: 232, w: 96 },
  { x: 312, y: 268, w: 96 }, { x: 96, y: 164, w: 96 }, { x: 256, y: 128, w: 96 }, { x: 368, y: 84, w: 84 },
];
function KnightGame() {
  const setup = (level: number) => ({
    coins: KPLATS.slice(1).map((p) => ({ x: p.x + p.w / 2, y: p.y - 20, taken: false })),
    foes: KPLATS.slice(1, 3 + Math.min(3, level)).map((p, i) => ({
      x: p.x + 24, y: p.y - 13, dir: i % 2 ? 1 : -1, min: p.x + 10, max: p.x + p.w - 10, alive: true,
    })),
  });
  return (
    <Engine<KnightState>
      id="knights-quest" label="Knight's Quest"
      blurb="Leap between the castle platforms, stomp the goblins, gather every coin and plant your flag at the top tower."
      create={() => ({ score: 0, x: 26, y: 300, vx: 0, vy: 0, onGround: false, hp: 3, level: 1, invuln: 0, ...setup(1) })}
      hud={(s) => [["Score", s.score], ["Health", "❤️".repeat(Math.max(0, s.hp)) || "—"], ["Level", s.level], ["Coins", `${s.coins.filter((c) => c.taken).length}/${s.coins.length}`]]}
      step={(s, dt, input, api) => {
        if (input.keys.has("ArrowLeft") || input.keys.has("a")) s.vx = Math.max(-165, s.vx - 720 * dt);
        else if (input.keys.has("ArrowRight") || input.keys.has("d")) s.vx = Math.min(165, s.vx + 720 * dt);
        else s.vx *= Math.pow(0.0001, dt);
        if ((input.keys.has("ArrowUp") || input.keys.has("w") || input.keys.has(" ")) && s.onGround) {
          s.vy = -368; s.onGround = false; api.beep(430, 0.06);
        }
        if (input.pdown && s.onGround && input.py < s.y - 30) { s.vy = -368; s.onGround = false; }
        if (input.pdown && input.px < s.x - 24) s.vx = Math.max(-165, s.vx - 720 * dt);
        if (input.pdown && input.px > s.x + 24) s.vx = Math.min(165, s.vx + 720 * dt);
        s.vy += 920 * dt;
        s.x = clamp(s.x + s.vx * dt, 12, W - 12);
        const prevBottom = s.y + 14 - s.vy * dt;
        s.y += s.vy * dt;
        s.onGround = false;
        if (s.vy >= 0) {
          for (const p of KPLATS) {
            if (s.x > p.x - 8 && s.x < p.x + p.w + 8 && prevBottom <= p.y + 1 && s.y + 14 >= p.y) {
              s.y = p.y - 14; s.vy = 0; s.onGround = true;
            }
          }
        }
        s.invuln = Math.max(0, s.invuln - dt);
        if (s.y > H + 26) {
          s.hp -= 1; api.beep(100, 0.2, "sawtooth");
          if (s.hp <= 0) { api.end(false); return; }
          s.x = 26; s.y = 300; s.vy = 0;
        }
        for (const f of s.foes) {
          if (!f.alive) continue;
          f.x += f.dir * (30 + s.level * 5) * dt;
          if (f.x < f.min) { f.x = f.min; f.dir = 1; }
          if (f.x > f.max) { f.x = f.max; f.dir = -1; }
          if (Math.abs(f.x - s.x) < 16 && Math.abs(f.y - s.y) < 20) {
            if (s.vy > 60 && s.y < f.y - 6) {
              f.alive = false; s.score += 40; s.vy = -220; api.beep(200, 0.09, "sawtooth");
            } else if (s.invuln <= 0) {
              s.hp -= 1; s.invuln = 1.4; api.beep(100, 0.2, "sawtooth");
              if (s.hp <= 0) { api.end(false); return; }
            }
          }
        }
        for (const c of s.coins) {
          if (!c.taken && Math.abs(c.x - s.x) < 15 && Math.abs(c.y - s.y) < 18) {
            c.taken = true; s.score += 20; api.beep(1150, 0.06);
          }
        }
        // Flag on the top platform: reach it with every coin to clear the level.
        if (s.coins.every((c) => c.taken) && s.x > 380 && s.y < 84) {
          s.level += 1; s.score += 120;
          const nx = setup(s.level);
          s.coins = nx.coins; s.foes = nx.foes;
          s.x = 26; s.y = 300; s.vy = 0;
          api.beep(620, 0.14, "triangle");
          if (s.level > 5) { api.end(true); return; }
        }
      }}
      draw={(ctx, s) => {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#312e81"); grad.addColorStop(1, "#1e293b");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#f8fafc";
        for (let i = 0; i < 26; i++) ctx.fillRect((i * 53) % W, (i * 37) % 130, 2, 2);
        for (const p of KPLATS) {
          ctx.fillStyle = "#78716c"; ctx.fillRect(p.x, p.y, p.w, 10);
          ctx.fillStyle = "#a8a29e"; ctx.fillRect(p.x, p.y, p.w, 3);
        }
        ctx.font = "20px serif"; ctx.textAlign = "center";
        ctx.fillText("🚩", 410, 76);
        for (const c of s.coins) if (!c.taken) ctx.fillText("🪙", c.x, c.y + 6);
        ctx.font = "22px serif";
        for (const f of s.foes) if (f.alive) ctx.fillText("👺", f.x, f.y + 7);
        ctx.globalAlpha = s.invuln > 0 && Math.floor(s.invuln * 8) % 2 === 0 ? 0.35 : 1;
        ctx.font = "26px serif"; ctx.fillText("🛡️", s.x, s.y + 9);
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
      }}
    />
  );
}

export const GAMES2B: Record<string, ComponentType> = {
  "pirate-cannon": PirateGame,
  "sky-turret": SkyTurretGame,
  "viking-raid": VikingGame,
  "cyber-chase": CyberGame,
  "gladiator-arena": GladiatorGame,
  "knights-quest": KnightGame,
};

/* -------------------------------------------------------- Galaxy Invaders */
type InvState = {
  score: number; over?: boolean; won?: boolean;
  px: number; cool: number; lives: number; wave: number; dir: number; dropT: number; fireT: number;
  aliens: { x: number; y: number; alive: boolean; row: number }[];
  shots: { x: number; y: number; foe: boolean }[];
  ox: number; oy: number;
};
function InvadersGame() {
  const mkWave = (wave: number) => {
    const aliens: InvState["aliens"] = [];
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 8; c++)
        aliens.push({ x: 70 + c * 42, y: 44 + r * 34, alive: true, row: r });
    return { aliens, ox: 0, oy: 0, dir: 1, dropT: 0, fireT: 1.2, wave };
  };
  return (
    <Engine<InvState>
      id="galaxy-invaders" label="Galaxy Invaders"
      blurb="The swarm is descending! Slide your cannon, blast every invader and don't let a single one touch the ground."
      create={() => ({ score: 0, px: W / 2, cool: 0, lives: 3, shots: [], ...mkWave(1) })}
      hud={(s) => [["Score", s.score], ["Lives", "❤️".repeat(Math.max(0, s.lives)) || "—"], ["Wave", s.wave], ["Invaders", s.aliens.filter((a) => a.alive).length]]}
      step={(s, dt, input, api) => {
        if (input.keys.has("ArrowLeft") || input.keys.has("a")) s.px -= 210 * dt;
        if (input.keys.has("ArrowRight") || input.keys.has("d")) s.px += 210 * dt;
        if (input.pdown) s.px += clamp(input.px - s.px, -260 * dt, 260 * dt);
        s.px = clamp(s.px, 18, W - 18);
        s.cool -= dt;
        if ((input.keys.has(" ") || input.pdown) && s.cool <= 0) {
          s.cool = 0.3;
          s.shots.push({ x: s.px, y: 322, foe: false });
          api.beep(880, 0.04);
        }
        const alive = s.aliens.filter((a) => a.alive);
        const speed = 14 + s.wave * 3 + (40 - alive.length) * 0.5;
        s.ox += s.dir * speed * dt;
        const xs = alive.map((a) => a.x + s.ox);
        if (xs.length && (Math.max(...xs) > W - 26 || Math.min(...xs) < 26)) {
          s.dir *= -1;
          s.oy += 16;
          if (alive.some((a) => a.y + s.oy > 292)) { api.end(false); return; }
        }
        s.fireT -= dt;
        if (s.fireT <= 0 && alive.length) {
          s.fireT = Math.max(0.4, 1.3 - s.wave * 0.12);
          const shooter = alive[randi(0, alive.length - 1)]!;
          s.shots.push({ x: shooter.x + s.ox, y: shooter.y + s.oy + 12, foe: true });
        }
        for (const sh of s.shots) {
          sh.y += (sh.foe ? 165 : -330) * dt;
          if (!sh.foe) {
            for (const a of s.aliens) {
              if (a.alive && Math.abs(sh.x - (a.x + s.ox)) < 15 && Math.abs(sh.y - (a.y + s.oy)) < 12) {
                a.alive = false; sh.y = -999;
                s.score += (4 - a.row) * 10;
                api.beep(240, 0.07, "sawtooth");
              }
            }
          } else if (Math.abs(sh.x - s.px) < 13 && sh.y > 318 && sh.y < 340) {
            sh.y = H + 999; s.lives -= 1; api.beep(100, 0.2, "sawtooth");
            if (s.lives <= 0) { api.end(false); return; }
          }
        }
        s.shots = s.shots.filter((sh) => sh.y > -20 && sh.y < H + 20);
        if (s.aliens.every((a) => !a.alive)) {
          const w = mkWave(s.wave + 1);
          s.aliens = w.aliens; s.ox = 0; s.oy = 0; s.dir = 1; s.wave += 1;
          s.score += 100; s.shots = [];
          api.beep(580, 0.12, "triangle");
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        for (let i = 0; i < 34; i++) ctx.fillRect((i * 71) % W, (i * 43) % H, 2, 2);
        ctx.font = "22px serif"; ctx.textAlign = "center";
        const glyphs = ["👾", "🛸", "👽", "🦑"];
        for (const a of s.aliens) if (a.alive) ctx.fillText(glyphs[a.row]!, a.x + s.ox, a.y + s.oy + 8);
        for (const sh of s.shots) {
          ctx.fillStyle = sh.foe ? "#f87171" : "#fde047";
          ctx.fillRect(sh.x - 2, sh.y - 6, 4, 12);
        }
        ctx.font = "26px serif"; ctx.fillText("🚀", s.px, 342);
        ctx.strokeStyle = "rgba(248,113,113,0.5)"; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(0, 306); ctx.lineTo(W, 306); ctx.stroke(); ctx.setLineDash([]);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ------------------------------------------------------------ Duck Gallery */
type DuckState = {
  score: number; over?: boolean; won?: boolean;
  time: number; hits: number; shotsFired: number;
  slots: { kind: string; up: number; max: number }[];
};
const DUCK_KINDS = ["🦆", "🐥", "🎯", "💣", "⭐"];
function DuckGalleryGame() {
  return (
    <Engine<DuckState>
      id="duck-gallery" label="Duck Hunt Gallery"
      blurb="Sixty seconds at the fairground booth! Tap the ducks and targets, leave the bombs alone, and chase a perfect score."
      create={() => ({ score: 0, time: 60, hits: 0, shotsFired: 0, slots: Array.from({ length: 9 }, () => ({ kind: "🦆", up: -rand(0.2, 1.6), max: rand(1, 1.9) })) })}
      hud={(s) => [["Score", s.score], ["Time", `${Math.max(0, Math.ceil(s.time))}s`], ["Hits", `${s.hits}/${s.shotsFired}`]]}
      onTap={(s, x, y, api) => {
        s.shotsFired += 1;
        const col = Math.floor(x / (W / 3));
        const row = Math.floor(y / (H / 3));
        const idx = row * 3 + col;
        const slot = s.slots[idx];
        if (slot && slot.up > 0) {
          if (slot.kind === "💣") {
            s.score = Math.max(0, s.score - 30); slot.up = -rand(0.4, 1.2);
            api.beep(90, 0.2, "sawtooth");
          } else {
            const pts = slot.kind === "⭐" ? 30 : slot.kind === "🎯" ? 20 : 10;
            s.score += pts; s.hits += 1; slot.up = -rand(0.3, 1);
            api.beep(760, 0.06);
          }
        } else {
          api.beep(220, 0.04);
        }
      }}
      step={(s, dt, _input, api) => {
        s.time -= dt;
        for (const slot of s.slots) {
          slot.up += dt * (slot.up > 0 ? 1 : 1);
          if (slot.up > slot.max) {
            slot.up = -rand(0.25, 1.3);
            slot.max = rand(0.9, 1.9);
            slot.kind = DUCK_KINDS[randi(0, DUCK_KINDS.length - 1)]!;
          }
        }
        if (s.time <= 0) { s.score += 0; api.end(s.score >= 250); }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#7f1d1d"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#991b1b";
        for (let r = 0; r < 3; r++) ctx.fillRect(0, r * 120 + 84, W, 36);
        ctx.font = "44px serif"; ctx.textAlign = "center";
        s.slots.forEach((slot, i) => {
          const cx = (i % 3) * 160 + 80;
          const cy = Math.floor(i / 3) * 120 + 62;
          ctx.fillStyle = "#450a0a";
          ctx.beginPath(); ctx.arc(cx, cy + 16, 34, 0, 7); ctx.fill();
          if (slot.up > 0) ctx.fillText(slot.kind, cx, cy + 16);
        });
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ------------------------------------------------------------- Sniper Range */
type SniperState = {
  score: number; over?: boolean; won?: boolean;
  time: number; ammo: number; reloading: number; hits: number; fired: number;
  targets: { x: number; y: number; dir: number; sp: number; ring: number }[];
  spawnT: number;
};
function SniperGame() {
  return (
    <Engine<SniperState>
      id="sniper-range" label="Sniper Range"
      blurb="Your scope follows the pointer. Click to fire on the moving range targets — bullseyes pay triple. R reloads."
      create={() => ({ score: 0, time: 60, ammo: 6, reloading: 0, hits: 0, fired: 0, targets: [], spawnT: 0 })}
      hud={(s) => [["Score", s.score], ["Time", `${Math.max(0, Math.ceil(s.time))}s`], ["Ammo", s.reloading > 0 ? "Reloading…" : "🔫".repeat(s.ammo) || "Empty — R"], ["Hits", `${s.hits}/${s.fired}`]]}
      onKey={(s, key) => {
        if ((key === "r" || key === "R") && s.ammo < 6 && s.reloading <= 0) s.reloading = 1.1;
      }}
      onTap={(s, x, y, api) => {
        if (s.reloading > 0) return;
        if (s.ammo <= 0) { s.reloading = 1.1; api.beep(160, 0.08); return; }
        s.ammo -= 1; s.fired += 1;
        api.beep(140, 0.14, "sawtooth");
        let bestHit: { t: SniperState["targets"][number]; d: number } | null = null;
        for (const t of s.targets) {
          const d = Math.hypot(x - t.x, y - t.y);
          if (d < 26 && (!bestHit || d < bestHit.d)) bestHit = { t, d };
        }
        if (bestHit) {
          const d = bestHit.d;
          const pts = d < 8 ? 30 : d < 17 ? 20 : 10;
          s.score += pts; s.hits += 1;
          bestHit.t.x = -999;
          api.beep(700, 0.07);
        }
        if (s.ammo === 0) s.reloading = 1.1;
      }}
      step={(s, dt, _input, api) => {
        s.time -= dt;
        if (s.reloading > 0) {
          s.reloading -= dt;
          if (s.reloading <= 0) s.ammo = 6;
        }
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = rand(0.7, 1.4);
          const dir = Math.random() < 0.5 ? 1 : -1;
          s.targets.push({ x: dir > 0 ? -26 : W + 26, y: [86, 168, 250][randi(0, 2)]!, dir, sp: rand(46, 92), ring: 0 });
        }
        for (const t of s.targets) t.x += t.dir * t.sp * dt;
        s.targets = s.targets.filter((t) => t.x > -40 && t.x < W + 40);
        if (s.time <= 0) api.end(s.score >= 300);
      }}
      draw={(ctx, s, phase) => {
        ctx.fillStyle = "#365314"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#4d7c0f";
        for (const y of [86, 168, 250]) ctx.fillRect(0, y + 22, W, 8);
        for (const t of s.targets) {
          ctx.fillStyle = "#f8fafc"; ctx.beginPath(); ctx.arc(t.x, t.y, 24, 0, 7); ctx.fill();
          ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.arc(t.x, t.y, 16, 0, 7); ctx.fill();
          ctx.fillStyle = "#f8fafc"; ctx.beginPath(); ctx.arc(t.x, t.y, 8, 0, 7); ctx.fill();
          ctx.fillStyle = "#7f1d1d"; ctx.fillRect(t.x - 2, t.y + 24, 4, 14);
        }
        void phase;
      }}
    />
  );
}

/* ---------------------------------------------------------- Missile Command */
type MissileState = {
  score: number; over?: boolean; won?: boolean;
  cities: boolean[]; ammo: number; regen: number; wave: number; spawnT: number; kills: number;
  missiles: { x: number; y: number; tx: number; speed: number; sx: number }[];
  booms: { x: number; y: number; r: number; max: number }[];
};
function MissileCommandGame() {
  return (
    <Engine<MissileState>
      id="missile-command" label="Missile Command"
      blurb="Enemy missiles are raining on your four cities! Tap the sky to detonate interceptors and catch them in the blast."
      create={() => ({ score: 0, cities: [true, true, true, true], ammo: 10, regen: 0, wave: 1, spawnT: 0.5, kills: 0, missiles: [], booms: [] })}
      hud={(s) => [["Score", s.score], ["Cities", s.cities.filter(Boolean).length], ["Interceptors", s.ammo], ["Wave", s.wave]]}
      onTap={(s, x, y, api) => {
        if (s.ammo <= 0) { api.beep(150, 0.07); return; }
        s.ammo -= 1;
        s.booms.push({ x, y: Math.min(y, 320), r: 4, max: 34 });
        api.beep(120, 0.16, "sawtooth");
      }}
      step={(s, dt, _input, api) => {
        s.regen -= dt;
        if (s.regen <= 0) { s.regen = 0.55; s.ammo = Math.min(10, s.ammo + 1); }
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = Math.max(0.45, 1.25 - s.wave * 0.09);
          const targets = [52, 168, 312, 428];
          s.missiles.push({ x: rand(0, W), y: -8, tx: targets[randi(0, 3)]! + rand(-14, 14), speed: rand(34, 52) + s.wave * 4, sx: 0 });
          const m = s.missiles[s.missiles.length - 1]!;
          m.sx = m.x;
        }
        for (const b of s.booms) b.r = Math.min(b.max, b.r + 95 * dt);
        for (let i = s.booms.length - 1; i >= 0; i--) {
          const b = s.booms[i]!;
          if (b.r >= b.max) {
            b.max -= dt * 60;
            if (b.max <= 2) s.booms.splice(i, 1);
          }
        }
        for (const m of s.missiles) {
          const total = 336;
          const p = (m.y + 8) / total;
          m.y += m.speed * dt;
          m.x = m.sx + (m.tx - m.sx) * Math.min(1, p);
          for (const b of s.booms) {
            if (Math.hypot(m.x - b.x, m.y - b.y) < b.r) {
              m.y = -999; s.kills += 1; s.score += 25; api.beep(300, 0.06);
            }
          }
          if (m.y >= 334) {
            const idx = [52, 168, 312, 428].findIndex((cx) => Math.abs(cx - m.tx) < 40);
            if (idx >= 0 && s.cities[idx]) {
              s.cities[idx] = false;
              api.beep(80, 0.3, "sawtooth");
            }
            m.y = -999;
            if (s.cities.every((c) => !c)) { api.end(false); return; }
          }
        }
        s.missiles = s.missiles.filter((m) => m.y !== -999);
        if (s.kills >= s.wave * 8) {
          s.wave += 1; s.kills = 0; s.score += 100;
          s.ammo = 10;
          api.beep(560, 0.12, "triangle");
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        for (let i = 0; i < 30; i++) ctx.fillRect((i * 61) % W, (i * 29) % 200, 2, 2);
        ctx.fillStyle = "#78350f"; ctx.fillRect(0, 336, W, 24);
        ctx.font = "26px serif"; ctx.textAlign = "center";
        [52, 168, 312, 428].forEach((cx, i) => {
          ctx.fillText(s.cities[i] ? "🏙️" : "💥", cx, 356);
        });
        ctx.font = "24px serif"; ctx.fillText("🗼", W / 2, 356);
        for (const m of s.missiles) {
          ctx.strokeStyle = "rgba(248,113,113,0.55)";
          ctx.beginPath(); ctx.moveTo(m.sx, 0); ctx.lineTo(m.x, m.y); ctx.stroke();
          ctx.fillStyle = "#f87171"; ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, 7); ctx.fill();
        }
        for (const b of s.booms) {
          ctx.fillStyle = "rgba(249,115,22,0.75)";
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
          ctx.fillStyle = "rgba(253,224,71,0.8)";
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55, 0, 7); ctx.fill();
        }
        ctx.textAlign = "left";
      }}
    />
  );
}

/* -------------------------------------------------------------- West Duel */
type DuelState = {
  score: number; over?: boolean; won?: boolean;
  phase2: "wait" | "draw" | "done";
  waitT: number; drawAt: number; reaction: number; round: number; wins: number; foul: boolean;
  message: string;
};
function WestDuelGame() {
  return (
    <Engine<DuelState>
      id="west-duel" label="Wild West Duel"
      blurb="Stare down the outlaw. The instant you see DRAW! click him — shoot early and it's a foul, shoot late and you're done."
      create={() => ({ score: 0, phase2: "wait", waitT: rand(1.2, 3.2), drawAt: 0, reaction: 0, round: 1, wins: 0, foul: false, message: "Wait for it…" })}
      hud={(s) => [["Score", s.score], ["Duels won", `${s.wins}/5`], ["Round", s.round], ["Last draw", s.reaction ? `${Math.round(s.reaction * 1000)}ms` : "—"]]}
      onTap={(s, _x, _y, api) => {
        if (s.phase2 === "wait") {
          s.foul = true; s.message = "Too soon! That's a foul — the outlaw wins this round.";
          s.phase2 = "done"; s.round += 1;
          api.beep(120, 0.2, "sawtooth");
          if (s.round > 5) api.end(s.wins >= 3);
        } else if (s.phase2 === "draw") {
          s.reaction = performance.now() / 1000 - s.drawAt;
          const limit = Math.max(0.28, 0.62 - s.round * 0.05);
          if (s.reaction <= limit) {
            s.wins += 1;
            const pts = Math.max(20, Math.round(120 - s.reaction * 160));
            s.score += pts;
            s.message = `Got him in ${Math.round(s.reaction * 1000)}ms! +${pts} points.`;
            api.beep(700, 0.1);
          } else {
            s.message = `Too slow — ${Math.round(s.reaction * 1000)}ms. The outlaw was faster.`;
            api.beep(120, 0.2, "sawtooth");
          }
          s.phase2 = "done"; s.round += 1;
          if (s.round > 5) api.end(s.wins >= 3);
        } else {
          s.phase2 = "wait"; s.waitT = rand(1.2, 3.2); s.foul = false; s.message = "Wait for it…";
        }
      }}
      step={(s, dt, _input, api) => {
        if (s.phase2 === "wait") {
          s.waitT -= dt;
          if (s.waitT <= 0) {
            s.phase2 = "draw";
            s.drawAt = performance.now() / 1000;
            api.beep(980, 0.09);
          }
        } else if (s.phase2 === "draw") {
          const limit = Math.max(0.28, 0.62 - (s.round - 1) * 0.05);
          if (performance.now() / 1000 - s.drawAt > limit + 0.45) {
            s.message = "He drew first! Round lost.";
            s.phase2 = "done"; s.round += 1;
            api.beep(120, 0.2, "sawtooth");
            if (s.round > 5) api.end(s.wins >= 3);
          }
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#fde68a"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#d97706"; ctx.fillRect(0, 286, W, 74);
        ctx.font = "64px serif"; ctx.textAlign = "center";
        ctx.fillText("🤠", 110, 240);
        ctx.fillText("😠", 370, 240);
        ctx.font = "bold 30px system-ui";
        if (s.phase2 === "draw") {
          ctx.fillStyle = "#dc2626";
          ctx.fillText("DRAW!", W / 2, 90);
        } else if (s.phase2 === "done") {
          ctx.fillStyle = "#1f2937";
          ctx.font = "bold 16px system-ui";
          const words = s.message.split(" ");
          let line = ""; let ly = 66;
          for (const w of words) {
            if ((line + w).length > 42) { ctx.fillText(line, W / 2, ly); ly += 20; line = ""; }
            line += w + " ";
          }
          ctx.fillText(line, W / 2, ly);
          ctx.font = "14px system-ui"; ctx.fillStyle = "#92400e";
          ctx.fillText(s.round > 5 ? "" : "Click anywhere for the next duel", W / 2, 330);
        } else {
          ctx.fillStyle = "#92400e";
          ctx.font = "bold 20px system-ui";
          ctx.fillText("Wait for it…", W / 2, 90);
        }
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ----------------------------------------------------------- Bubble Shooter */
type BubbleState = {
  score: number; over?: boolean; won?: boolean;
  grid: (string | null)[][]; current: string; next: string; flying: { x: number; y: number; vx: number; vy: number; color: string } | null;
  shots: number; ceilDrop: number; message: string;
};
const BCOLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"];
const COLS_B = 10;
const ROWS_B = 11;
function bubblePos(r: number, c: number) {
  return { x: 24 + c * 48 + (r % 2 ? 24 : 0), y: 30 + r * 30 };
}
function BubbleShooterGame() {
  const newBubble = (grid: (string | null)[][]) => {
    const present = new Set<string>();
    grid.flat().forEach((g) => { if (g) present.add(g); });
    const pool = [...present];
    return pool.length ? pool[randi(0, pool.length - 1)]! : BCOLORS[0]!;
  };
  const mkGrid = (): (string | null)[][] => {
    const grid: (string | null)[][] = [];
    for (let r = 0; r < ROWS_B; r++) {
      grid.push(Array.from({ length: COLS_B }, () => (r < 4 ? BCOLORS[randi(0, 4)]! : null)));
    }
    return grid;
  };
  return (
    <Engine<BubbleState>
      id="bubble-shooter" label="Bubble Shooter"
      blurb="Aim the cannon and fire bubbles to match three or more of a color. Clear the board before it crushes down to the line."
      create={() => {
        const grid = mkGrid();
        return { score: 0, grid, current: newBubble(grid), next: newBubble(grid), flying: null, shots: 0, ceilDrop: 0, message: "" };
      }}
      hud={(s) => [["Score", s.score], ["Shots", s.shots], ["Bubbles left", s.grid.flat().filter(Boolean).length]]}
      step={(s, dt, input, api) => {
        if (input.pdown && !s.flying) {
          const a = Math.atan2(input.py - 336, input.px - W / 2);
          if (a < -0.15 && a > -Math.PI + 0.15) {
            s.flying = { x: W / 2, y: 336, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, color: s.current };
            s.current = s.next;
            s.next = newBubble(s.grid);
            s.shots += 1;
            api.beep(660, 0.05);
          }
        }
        const f = s.flying;
        if (f) {
          f.x += f.vx * dt; f.y += f.vy * dt;
          if (f.x < 22) { f.x = 22; f.vx *= -1; }
          if (f.x > W - 22) { f.x = W - 22; f.vx *= -1; }
          let landed: { r: number; c: number } | null = null;
          if (f.y < 34) landed = { r: 0, c: clamp(Math.round((f.x - 24) / 48), 0, COLS_B - 1) };
          else {
            outer: for (let r = 0; r < ROWS_B; r++) {
              for (let c = 0; c < COLS_B; c++) {
                if (!s.grid[r]![c]) continue;
                const p = bubblePos(r, c);
                if (Math.hypot(f.x - p.x, f.y - (p.y + s.ceilDrop)) < 40) {
                  // Find nearest empty neighbor cell.
                  let bestCell: { r: number; c: number } | null = null; let bd = 1e9;
                  for (let rr = 0; rr < ROWS_B; rr++) for (let cc = 0; cc < COLS_B; cc++) {
                    if (s.grid[rr]![cc]) continue;
                    const pp = bubblePos(rr, cc);
                    const d = Math.hypot(f.x - pp.x, f.y - (pp.y + s.ceilDrop));
                    if (d < bd) { bd = d; bestCell = { r: rr, c: cc }; }
                  }
                  landed = bestCell;
                  break outer;
                }
              }
            }
          }
          if (landed) {
            const { r, c } = landed;
            if (r >= ROWS_B - 1 || bubblePos(r, c).y + s.ceilDrop > 306) {
              s.flying = null;
              api.end(false);
              return;
            }
            s.grid[r]![c] = f.color;
            s.flying = null;
            // Flood fill same color.
            const group: [number, number][] = [];
            const seen = new Set<string>([`${r},${c}`]);
            const stack: [number, number][] = [[r, c]];
            while (stack.length) {
              const [cr, cc] = stack.pop()!;
              group.push([cr, cc]);
              const offs: [number, number][] = cr % 2 ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
              for (const [dr, dc] of offs) {
                const nr = cr + dr, nc = cc + dc;
                if (nr < 0 || nr >= ROWS_B || nc < 0 || nc >= COLS_B) continue;
                const key = `${nr},${nc}`;
                if (!seen.has(key) && s.grid[nr]![nc] === f.color) { seen.add(key); stack.push([nr, nc]); }
              }
            }
            if (group.length >= 3) {
              for (const [gr, gc] of group) s.grid[gr]![gc] = null;
              s.score += group.length * 10 + (group.length > 3 ? (group.length - 3) * 15 : 0);
              api.beep(520, 0.09, "triangle");
              // Drop floaters.
              const anchored = new Set<string>();
              const stack2: [number, number][] = [];
              for (let c = 0; c < COLS_B; c++) if (s.grid[0]![c]) { anchored.add(`0,${c}`); stack2.push([0, c]); }
              while (stack2.length) {
                const [cr, cc] = stack2.pop()!;
                const offs: [number, number][] = cr % 2 ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
                for (const [dr, dc] of offs) {
                  const nr = cr + dr, nc = cc + dc;
                  if (nr < 0 || nr >= ROWS_B || nc < 0 || nc >= COLS_B) continue;
                  const key = `${nr},${nc}`;
                  if (!anchored.has(key) && s.grid[nr]![nc]) { anchored.add(key); stack2.push([nr, nc]); }
                }
              }
              let dropped = 0;
              for (let rr = 0; rr < ROWS_B; rr++) for (let cc = 0; cc < COLS_B; cc++) {
                if (s.grid[rr]![cc] && !anchored.has(`${rr},${cc}`)) { s.grid[rr]![cc] = null; dropped += 1; }
              }
              if (dropped) s.score += dropped * 15;
            }
            if (s.grid.flat().every((g) => !g)) { s.score += 200; api.end(true); return; }
            if (s.shots % 6 === 0) {
              s.ceilDrop += 15;
              if (s.ceilDrop >= 60) {
                // Push a fresh row in at the top instead of endless offset.
                s.grid.pop();
                s.grid.unshift(Array.from({ length: COLS_B }, () => BCOLORS[randi(0, 4)]!));
                s.ceilDrop = 0;
              }
            }
          }
        }
      }}
      draw={(ctx, s, phase) => {
        ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "#ef4444"; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(0, 318); ctx.lineTo(W, 318); ctx.stroke(); ctx.setLineDash([]);
        for (let r = 0; r < ROWS_B; r++) {
          for (let c = 0; c < COLS_B; c++) {
            const col = s.grid[r]![c];
            if (!col) continue;
            const p = bubblePos(r, c);
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.arc(p.x, p.y + s.ceilDrop, 20, 0, 7); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.35)";
            ctx.beginPath(); ctx.arc(p.x - 6, p.y + s.ceilDrop - 6, 6, 0, 7); ctx.fill();
          }
        }
        if (s.flying) {
          ctx.fillStyle = s.flying.color;
          ctx.beginPath(); ctx.arc(s.flying.x, s.flying.y, 20, 0, 7); ctx.fill();
        }
        ctx.fillStyle = "#334155"; ctx.fillRect(W / 2 - 30, 340, 60, 14);
        ctx.fillStyle = s.current;
        ctx.beginPath(); ctx.arc(W / 2, 336, 20, 0, 7); ctx.fill();
        ctx.fillStyle = s.next;
        ctx.beginPath(); ctx.arc(W / 2 + 52, 342, 12, 0, 7); ctx.fill();
        if (phase === "playing") {
          ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.setLineDash([4, 6]);
          ctx.beginPath(); ctx.moveTo(W / 2, 336); ctx.lineTo(W / 2 + 60, 250); ctx.stroke(); ctx.setLineDash([]);
        }
      }}
    />
  );
}

/* ----------------------------------------------------------- Turret Defense */
type TurretDefState = {
  score: number; over?: boolean; won?: boolean;
  hp: number; cool: number; wave: number; kills: number; spawnT: number;
  foes: { x: number; y: number; hp: number; sp: number }[];
  shots: { x: number; y: number; vx: number; vy: number }[];
};
function TurretDefenseGame() {
  return (
    <Engine<TurretDefState>
      id="turret-defense" label="Turret Defense"
      blurb="You are the last turret. Enemies converge from every direction — swivel, fire, and hold the core as waves intensify."
      create={() => ({ score: 0, hp: 6, cool: 0, wave: 1, kills: 0, spawnT: 0, foes: [], shots: [] })}
      hud={(s) => [["Score", s.score], ["Core", "❤️".repeat(Math.max(0, s.hp)) || "—"], ["Wave", s.wave]]}
      step={(s, dt, input, api) => {
        s.cool -= dt;
        if (input.pdown && s.cool <= 0) {
          s.cool = 0.15;
          const a = Math.atan2(input.py - H / 2, input.px - W / 2);
          s.shots.push({ x: W / 2 + Math.cos(a) * 22, y: H / 2 + Math.sin(a) * 22, vx: Math.cos(a) * 460, vy: Math.sin(a) * 460 });
          api.beep(900, 0.04);
        }
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = Math.max(0.4, 1.15 - s.wave * 0.09);
          const a = rand(0, Math.PI * 2);
          const d = 265;
          s.foes.push({ x: W / 2 + Math.cos(a) * d, y: H / 2 + Math.sin(a) * d, hp: s.wave >= 4 ? 2 : 1, sp: rand(24, 40) + s.wave * 3 });
        }
        for (const sh of s.shots) { sh.x += sh.vx * dt; sh.y += sh.vy * dt; }
        s.shots = s.shots.filter((sh) => sh.x > -12 && sh.x < W + 12 && sh.y > -12 && sh.y < H + 12);
        for (const f of s.foes) {
          if (f.hp <= 0) continue;
          const a = Math.atan2(H / 2 - f.y, W / 2 - f.x);
          f.x += Math.cos(a) * f.sp * dt; f.y += Math.sin(a) * f.sp * dt;
          for (const sh of s.shots) {
            if (circleHit(sh.x, sh.y, 4, f.x, f.y, 13)) {
              sh.x = -999; f.hp -= 1;
              if (f.hp <= 0) { s.kills += 1; s.score += 25; api.beep(200, 0.08, "sawtooth"); }
            }
          }
          if (f.hp > 0 && Math.hypot(f.x - W / 2, f.y - H / 2) < 30) {
            f.hp = 0; s.hp -= 1; api.beep(95, 0.22, "sawtooth");
            if (s.hp <= 0) { api.end(false); return; }
          }
        }
        s.foes = s.foes.filter((f) => f.hp > 0);
        s.shots = s.shots.filter((sh) => sh.x !== -999);
        if (s.kills >= 6 + s.wave * 3) {
          s.wave += 1; s.kills = 0; s.score += 60; s.hp = Math.min(6, s.hp + 1);
          api.beep(560, 0.12, "triangle");
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#18181b"; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(244,114,182,0.4)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(W / 2, H / 2, 30, 0, 7); ctx.stroke();
        ctx.font = "24px serif"; ctx.textAlign = "center";
        for (const f of s.foes) ctx.fillText(f.hp > 1 ? "🦠" : "👾", f.x, f.y + 8);
        ctx.fillStyle = "#fde047";
        for (const sh of s.shots) { ctx.beginPath(); ctx.arc(sh.x, sh.y, 3.5, 0, 7); ctx.fill(); }
        ctx.font = "30px serif"; ctx.fillText("🔫", W / 2, H / 2 + 10);
        ctx.textAlign = "left";
      }}
    />
  );
}

export const GAMES2C: Record<string, ComponentType> = {
  "galaxy-invaders": InvadersGame,
  "duck-gallery": DuckGalleryGame,
  "sniper-range": SniperGame,
  "missile-command": MissileCommandGame,
  "west-duel": WestDuelGame,
  "bubble-shooter": BubbleShooterGame,
  "turret-defense": TurretDefenseGame,
};
