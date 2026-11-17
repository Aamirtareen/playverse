// PlayVerse expansion — Racing, Arcade & Sports originals, each a distinct
// mechanic on the shared Engine shell.

import type { ComponentType } from "react";
import { Engine, H, W, clamp, rand, randi } from "./gamekit";

/* ------------------------------------------------------------- Drift King */
type DriftState = {
  score: number; over?: boolean; won?: boolean;
  x: number; y: number; a: number; vx: number; vy: number;
  gate: number; lap: number; time: number; best: number;
};
const GATES = [
  { x: 240, y: 46 }, { x: 420, y: 90 }, { x: 428, y: 250 }, { x: 300, y: 316 },
  { x: 120, y: 300 }, { x: 52, y: 180 }, { x: 90, y: 66 },
];
function DriftGame() {
  return (
    <Engine<DriftState>
      id="drift-king" label="Drift King"
      blurb="Floor it around the arena and thread the glowing gates in order. Three full laps against the clock — drifting is faster than braking!"
      create={() => ({ score: 0, x: 240, y: 300, a: -Math.PI / 2, vx: 0, vy: 0, gate: 0, lap: 1, time: 75, best: 0 })}
      hud={(s) => [["Score", s.score], ["Lap", `${s.lap}/3`], ["Gate", `${s.gate + 1}/${GATES.length}`], ["Time", `${Math.max(0, Math.ceil(s.time))}s`]]}
      step={(s, dt, input, api) => {
        s.time -= dt;
        if (s.time <= 0) { api.end(s.lap > 3); return; }
        const fwd = Math.hypot(s.vx, s.vy);
        if (input.keys.has("ArrowLeft") || input.keys.has("a")) s.a -= (1.9 + fwd * 0.004) * dt * (input.keys.has("ArrowDown") ? -1 : 1);
        if (input.keys.has("ArrowRight") || input.keys.has("d")) s.a += (1.9 + fwd * 0.004) * dt * (input.keys.has("ArrowDown") ? -1 : 1);
        if (input.keys.has("ArrowUp") || input.keys.has("w")) {
          s.vx += Math.cos(s.a) * 260 * dt;
          s.vy += Math.sin(s.a) * 260 * dt;
        }
        if (input.keys.has("ArrowDown") || input.keys.has("s")) {
          s.vx -= Math.cos(s.a) * 150 * dt;
          s.vy -= Math.sin(s.a) * 150 * dt;
        }
        if (input.pdown) {
          if (input.py < s.y - 10) { s.vx += Math.cos(s.a) * 260 * dt; s.vy += Math.sin(s.a) * 260 * dt; }
          if (input.px < W / 2 - 40) s.a -= 2.2 * dt;
          if (input.px > W / 2 + 40) s.a += 2.2 * dt;
        }
        // Grip: kill most lateral slide, keep some for drift feel.
        const fx = Math.cos(s.a), fy = Math.sin(s.a);
        const along = s.vx * fx + s.vy * fy;
        const latx = s.vx - fx * along, laty = s.vy - fy * along;
        const grip = input.keys.has("Shift") ? 0.55 : 0.12;
        s.vx = fx * along + latx * Math.pow(grip, dt * 4);
        s.vy = fy * along + laty * Math.pow(grip, dt * 4);
        s.vx *= Math.pow(0.35, dt); s.vy *= Math.pow(0.35, dt);
        s.x = clamp(s.x + s.vx * dt, 16, W - 16);
        s.y = clamp(s.y + s.vy * dt, 16, H - 16);
        const g = GATES[s.gate]!;
        if (Math.hypot(s.x - g.x, s.y - g.y) < 30) {
          s.score += 50 + Math.round(Math.abs(latx) + Math.abs(laty));
          s.time += 4;
          s.gate += 1;
          api.beep(740, 0.07);
          if (s.gate >= GATES.length) {
            s.gate = 0; s.lap += 1; s.score += 150;
            api.beep(560, 0.13, "triangle");
            if (s.lap > 3) { api.end(true); return; }
          }
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#525252"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#404040";
        for (let i = 0; i < 12; i++) ctx.fillRect((i * 97) % W, (i * 61) % H, 30, 18);
        GATES.forEach((g, i) => {
          const active = i === s.gate;
          const done = i < s.gate;
          ctx.fillStyle = active ? "#facc15" : done ? "#22c55e" : "rgba(255,255,255,0.35)";
          ctx.beginPath(); ctx.arc(g.x, g.y, active ? 17 : 12, 0, 7); ctx.fill();
          ctx.fillStyle = "#111827"; ctx.font = "bold 13px system-ui"; ctx.textAlign = "center";
          ctx.fillText(String(i + 1), g.x, g.y + 4.5);
        });
        const g = GATES[s.gate]!;
        ctx.strokeStyle = "rgba(250,204,21,0.8)"; ctx.setLineDash([5, 6]);
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(g.x, g.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
        ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.roundRect(-14, -8, 28, 16, 5); ctx.fill();
        ctx.fillStyle = "#111827"; ctx.fillRect(2, -6, 8, 12);
        ctx.restore();
        ctx.textAlign = "left";
      }}
    />
  );
}

/* -------------------------------------------------------------- Moto Rush */
type MotoState = {
  score: number; over?: boolean; won?: boolean;
  dist: number; speed: number; y: number; vy: number; air: boolean; rot: number;
  coins: { x: number; y: number; taken: boolean }[];
  rocks: { x: number }[];
  scroll: number;
};
function terrainY(x: number): number {
  return 268 + Math.sin(x * 0.012) * 34 + Math.sin(x * 0.031 + 2) * 12;
}
function MotoGame() {
  return (
    <Engine<MotoState>
      id="moto-rush" label="Moto Rush"
      blurb="Ride the rolling hills! Hold to accelerate, ease off on the crests, grab air off the jumps and land both wheels down."
      create={() => ({ score: 0, dist: 0, speed: 0, y: terrainY(90) - 14, vy: 0, air: false, rot: 0, coins: [], rocks: [], scroll: 0 })}
      hud={(s) => [["Score", s.score], ["Distance", `${Math.floor(s.dist)}m`], ["Speed", `${Math.round(s.speed * 3.6)} km/h`]]}
      step={(s, dt, input, api) => {
        const throttle = input.keys.has("ArrowRight") || input.keys.has("d") || input.pdown;
        const brake = input.keys.has("ArrowLeft") || input.keys.has("a");
        s.speed = clamp(s.speed + (throttle ? 26 : brake ? -34 : -7) * dt, 0, 62);
        s.dist += s.speed * dt;
        s.scroll += s.speed * dt * 3.1;
        const groundY = terrainY(90 + s.scroll) - 14;
        if (!s.air) {
          const slope = terrainY(90 + s.scroll + 26) - terrainY(90 + s.scroll);
          if (slope < -13 && s.speed > 26) {
            s.air = true; s.vy = -s.speed * 2.4; s.y = groundY;
            api.beep(500, 0.07, "triangle");
          } else {
            s.y = groundY;
          }
        }
        if (s.air) {
          s.vy += 620 * dt;
          s.y += s.vy * dt;
          s.rot = clamp(s.vy * 0.0016, -0.5, 0.85);
          if (s.y >= groundY) {
            if (s.rot > 0.62) {
              api.beep(90, 0.3, "sawtooth");
              api.end(false); return;
            }
            s.air = false; s.y = groundY; s.rot = 0;
            s.score += 25;
            api.beep(340, 0.06);
          }
        }
        if (Math.random() < dt * 0.55) s.coins.push({ x: W + 30, y: terrainY(90 + s.scroll + (W - 90)) - rand(38, 74), taken: false });
        if (Math.random() < dt * 0.32) s.rocks.push({ x: W + 30 });
        for (const c of s.coins) {
          c.x -= s.speed * dt * 3.1;
          if (!c.taken && Math.abs(c.x - 90) < 20 && Math.abs(c.y - s.y) < 26) {
            c.taken = true; s.score += 15; api.beep(1150, 0.06);
          }
        }
        s.coins = s.coins.filter((c) => c.x > -20 && !c.taken);
        for (const r of s.rocks) {
          r.x -= s.speed * dt * 3.1;
          if (!s.air && Math.abs(r.x - 90) < 17 && s.speed > 4) {
            api.beep(90, 0.3, "sawtooth");
            api.end(false); return;
          }
        }
        s.rocks = s.rocks.filter((r) => r.x > -20);
        s.score += dt * s.speed * 0.14;
        s.score = Math.floor(s.score);
        if (s.dist >= 1500) api.end(true);
      }}
      draw={(ctx, s) => {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#7dd3fc"); grad.addColorStop(1, "#fef9c3");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(430, 44, 22, 0, 7); ctx.fill();
        ctx.fillStyle = "#65a30d";
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) ctx.lineTo(x, terrainY(x + s.scroll));
        ctx.lineTo(W, H); ctx.fill();
        ctx.font = "17px serif"; ctx.textAlign = "center";
        for (const c of s.coins) ctx.fillText("🪙", c.x, c.y + 6);
        ctx.font = "22px serif";
        for (const r of s.rocks) ctx.fillText("🪨", r.x, terrainY(r.x + s.scroll) + 4);
        ctx.save(); ctx.translate(90, s.y); ctx.rotate(s.air ? s.rot : Math.atan2(terrainY(116 + s.scroll) - terrainY(64 + s.scroll), 52));
        ctx.font = "32px serif"; ctx.fillText("🏍️", 0, 8);
        ctx.restore();
        ctx.fillStyle = "rgba(15,23,42,0.65)"; ctx.fillRect(12, 12, 150, 10);
        ctx.fillStyle = "#38bdf8"; ctx.fillRect(12, 12, 150 * Math.min(1, s.dist / 1500), 10);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ------------------------------------------------------------- Kart Chaos */
type KartState = {
  score: number; over?: boolean; won?: boolean;
  prog: number; lane: number; speed: number; lap: number; pos: number;
  rivals: { prog: number; total: number; speed: number; base: number; lane: number; name: string }[];
  oils: { prog: number; lane: number }[];
  spin: number;
};
function KartGame() {
  return (
    <Engine<KartState>
      id="kart-chaos" label="Kart Chaos"
      blurb="Three laps of the oval against three rival karts. Swap lanes to dodge oil slicks and fight for first place!"
      create={() => ({
        score: 0, prog: 0, lane: 1, speed: 0, lap: 1, pos: 4, spin: 0,
        rivals: [0, 1, 2].map((i) => ({ prog: 0.02 + i * 0.012, total: 0.02 + i * 0.012, speed: 0, base: rand(0.052, 0.06), lane: i, name: ["Ruby", "Bolt", "Comet"][i]! })),
        oils: Array.from({ length: 7 }, () => ({ prog: rand(0.08, 0.97), lane: randi(0, 2) })),
      })}
      hud={(s) => [["Position", `${s.pos}/4`], ["Lap", `${Math.min(3, s.lap)}/3`], ["Score", s.score]]}
      onKey={(s, key, api) => {
        if (key === "ArrowLeft" || key === "a") { s.lane = Math.max(0, s.lane - 1); api.beep(430, 0.04); }
        if (key === "ArrowRight" || key === "d") { s.lane = Math.min(2, s.lane + 1); api.beep(430, 0.04); }
      }}
      step={(s, dt, input, api) => {
        if (s.spin > 0) {
          s.spin -= dt;
          s.speed = Math.max(0, s.speed - dt * 0.05);
        } else {
          const target = (input.keys.has("ArrowUp") || input.keys.has("w") || input.pdown) ? 0.068 : 0.045;
          s.speed += clamp(target - s.speed, -dt * 0.03, dt * 0.02);
        }
        s.prog += s.speed * dt;
        if (s.prog >= 1) {
          s.prog -= 1; s.lap += 1; s.score += 100;
          api.beep(560, 0.12, "triangle");
          if (s.lap > 3) {
            s.score += s.pos === 1 ? 300 : s.pos === 2 ? 150 : 60;
            api.end(s.pos <= 2);
            return;
          }
        }
        for (const r of s.rivals) {
          r.speed = r.base + Math.sin(r.total * 9 + r.base * 100) * 0.004;
          r.prog += r.speed * dt;
          r.total += r.speed * dt;
          if (r.prog >= 1) r.prog -= 1;
        }
        const myTotal = s.prog + (s.lap - 1);
        s.pos = 1 + s.rivals.filter((r) => r.total > myTotal).length;
        for (const o of s.oils) {
          const d = Math.abs(((o.prog - s.prog) % 1 + 1) % 1);
          if (d < 0.006 && o.lane === s.lane && s.spin <= 0) {
            s.spin = 0.9; api.beep(120, 0.2, "sawtooth");
          }
        }
        s.score += dt * 3;
        s.score = Math.floor(s.score);
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#22c55e"; ctx.fillRect(0, 0, W, H);
        const cx = W / 2, cy = H / 2;
        ctx.strokeStyle = "#78716c"; ctx.lineWidth = 118;
        ctx.beginPath(); ctx.ellipse(cx, cy, 168, 104, 0, 0, 7); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 3; ctx.setLineDash([12, 14]);
        ctx.beginPath(); ctx.ellipse(cx, cy, 168, 104, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        const kartAt = (prog: number, lane: number) => {
          const a = -Math.PI / 2 + prog * Math.PI * 2;
          const rr = 168 + (lane - 1) * 34;
          const ry = 104 + (lane - 1) * 21;
          return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * ry, a };
        };
        ctx.font = "20px serif"; ctx.textAlign = "center";
        for (const o of s.oils) {
          const p = kartAt(o.prog, o.lane);
          ctx.fillText("🛢️", p.x, p.y + 6);
        }
        ctx.font = "22px serif";
        s.rivals.forEach((r, i) => {
          const p = kartAt(r.prog, r.lane);
          ctx.fillText(["🔴", "🔵", "🟣"][i]!, p.x, p.y + 7);
        });
        const me = kartAt(s.prog, s.lane);
        ctx.save(); ctx.translate(me.x, me.y); ctx.rotate(s.spin > 0 ? s.spin * 9 : 0);
        ctx.font = "26px serif"; ctx.fillText("🏎️", 0, 8);
        ctx.restore();
        ctx.fillStyle = "rgba(15,23,42,0.7)"; ctx.fillRect(8, 8, 118, 22);
        ctx.fillStyle = "#fff"; ctx.font = "bold 13px system-ui"; ctx.textAlign = "left";
        ctx.fillText(`You are P${s.pos}`, 16, 23);
      }}
    />
  );
}

/* -------------------------------------------------------------- Drag Strip */
type DragState = {
  score: number; over?: boolean; won?: boolean;
  stage: "lights" | "race" | "heatDone";
  lights: number; lightT: number; goAt: number; falseStart: boolean;
  rpm: number; gear: number; speed: number; dist: number; aiDist: number; aiSpeed: number;
  heat: number; wins: number; message: string; shiftFlash: number;
};
function DragGame() {
  return (
    <Engine<DragState>
      id="drag-strip" label="Drag Strip"
      blurb="Watch the tree, launch on green, and shift each gear inside the green zone. Best of three heats takes the trophy."
      create={() => ({ score: 0, stage: "lights", lights: 0, lightT: 0.7, goAt: 0, falseStart: false, rpm: 0.12, gear: 1, speed: 0, dist: 0, aiDist: 0, aiSpeed: 0, heat: 1, wins: 0, message: "Stage up… wait for green!", shiftFlash: 0 })}
      hud={(s) => [["Heat", `${s.heat}/3`], ["Heats won", s.wins], ["Gear", s.stage === "race" ? s.gear : "—"], ["Speed", `${Math.round(s.speed * 2.4)} km/h`], ["Score", s.score]]}
      onKey={(s, key, api) => {
        if (key !== " " && key !== "Shift") return;
        if (s.stage === "lights") {
          if (s.lights < 4) {
            s.falseStart = true;
            s.message = "False start! You jumped the light — heat lost.";
            s.stage = "heatDone";
            api.beep(120, 0.25, "sawtooth");
          }
          return;
        }
        if (s.stage === "race" && s.gear < 5) {
          const inZone = s.rpm > 0.72 && s.rpm < 0.95;
          if (inZone) {
            s.gear += 1; s.rpm = 0.34; s.speed += 0.055; s.score += 40; s.shiftFlash = 0.4;
            api.beep(760, 0.08);
          } else {
            s.speed = Math.max(0.02, s.speed - 0.03); s.rpm = 0.3;
            api.beep(180, 0.12, "sawtooth");
          }
        }
      }}
      onTap={(s, _x, _y, api) => {
        if (s.stage === "heatDone") {
          if (s.heat >= 3) { api.end(s.wins >= 2); return; }
          s.heat += 1;
          Object.assign(s, { stage: "lights", lights: 0, lightT: 0.7, falseStart: false, rpm: 0.12, gear: 1, speed: 0, dist: 0, aiDist: 0, aiSpeed: 0, message: "Stage up… wait for green!" });
        }
      }}
      step={(s, dt, input, api) => {
        s.shiftFlash = Math.max(0, s.shiftFlash - dt);
        if (s.stage === "lights") {
          s.lightT -= dt;
          if (s.lightT <= 0 && s.lights < 4) {
            s.lights += 1;
            s.lightT = s.lights === 3 ? rand(0.3, 0.9) : 0.55;
            if (s.lights === 4) {
              s.stage = "race";
              s.goAt = performance.now();
              s.message = "GO! Hold ↑ to build revs, SHIFT in the green!";
              api.beep(880, 0.12);
            } else api.beep(440, 0.07);
          }
          return;
        }
        if (s.stage !== "race") return;
        const throttle = input.keys.has("ArrowUp") || input.keys.has("w") || input.pdown;
        if (throttle) {
          s.rpm = Math.min(1.05, s.rpm + dt * (0.62 - s.gear * 0.055));
          s.speed += dt * (0.028 + s.gear * 0.006) * (s.rpm > 1 ? 0.4 : 1);
        } else {
          s.rpm = Math.max(0.1, s.rpm - dt * 0.5);
          s.speed = Math.max(0, s.speed - dt * 0.01);
        }
        if (s.rpm >= 1.05) { s.rpm = 1.05; s.speed = Math.max(0, s.speed - dt * 0.008); }
        s.dist += s.speed * dt * 2.6;
        s.aiSpeed += dt * 0.021;
        s.aiDist += s.aiSpeed * dt * 2.6;
        if (s.dist >= 10 || s.aiDist >= 10) {
          const won = s.dist >= 10 && s.dist >= s.aiDist;
          if (won) { s.wins += 1; s.score += 150; }
          s.message = won ? "🏆 You took the heat!" : "The rival took this heat. Tap for the next one.";
          s.stage = "heatDone";
          api.beep(won ? 620 : 140, 0.15, won ? "triangle" : "sawtooth");
          if (s.heat >= 3) { /* next tap ends */ }
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#1f2937"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#374151"; ctx.fillRect(0, 120, W, 46); ctx.fillRect(0, 216, W, 46);
        ctx.strokeStyle = "#f8fafc"; ctx.setLineDash([16, 14]);
        ctx.beginPath(); ctx.moveTo(0, 143); ctx.lineTo(W, 143); ctx.moveTo(0, 239); ctx.lineTo(W, 239); ctx.stroke(); ctx.setLineDash([]);
        // Christmas tree
        ctx.fillStyle = "#111827"; ctx.fillRect(18, 26, 34, 96);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = s.lights > i ? "#f59e0b" : "#44403c";
          ctx.beginPath(); ctx.arc(35, 44 + i * 24, 8, 0, 7); ctx.fill();
        }
        ctx.fillStyle = s.stage === "race" || (s.stage === "heatDone" && !s.falseStart) ? "#22c55e" : "#44403c";
        ctx.beginPath(); ctx.arc(35, 116 - 4, 8, 0, 7); ctx.fill();
        // Cars: progress mapped to screen
        const px = 60 + (s.dist / 10) * 380;
        const ax = 60 + (s.aiDist / 10) * 380;
        ctx.font = "34px serif"; ctx.textAlign = "center";
        ctx.fillText("🏎️", ax, 152);
        ctx.fillText("🏍️", px, 248);
        // RPM gauge
        ctx.fillStyle = "#111827"; ctx.fillRect(300, 16, 168, 20);
        ctx.fillStyle = s.rpm > 0.72 && s.rpm < 0.95 ? "#22c55e" : s.rpm >= 1 ? "#ef4444" : "#f59e0b";
        ctx.fillRect(302, 18, 164 * Math.min(1, s.rpm), 16);
        ctx.fillStyle = "rgba(34,197,94,0.5)"; ctx.fillRect(300 + 168 * 0.72, 14, 168 * 0.23, 24);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "left";
        ctx.fillText("RPM — shift in the green", 300, 50);
        if (s.shiftFlash > 0) {
          ctx.fillStyle = "#22c55e"; ctx.font = "bold 22px system-ui"; ctx.textAlign = "center";
          ctx.fillText("PERFECT SHIFT!", W / 2, 84);
        }
        ctx.fillStyle = "#fff"; ctx.font = "bold 15px system-ui";
        const words = s.message.split(" ");
        let line = ""; let ly = 300;
        for (const w of words) {
          if ((line + w).length > 46) { ctx.fillText(line, W / 2, ly); ly += 19; line = ""; }
          line += w + " ";
        }
        ctx.fillText(line, W / 2, ly);
        if (s.stage === "heatDone") {
          ctx.font = "13px system-ui"; ctx.fillStyle = "#fbbf24";
          ctx.fillText(s.heat >= 3 ? "Tap to see the final result" : "Tap for the next heat", W / 2, 344);
        }
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ---------------------------------------------------------------- Boat GP */
type BoatState = {
  score: number; over?: boolean; won?: boolean;
  x: number; y: number; a: number; vx: number; vy: number;
  gate: number; lap: number; time: number;
};
const BGATES = [
  { x: 120, y: 60 }, { x: 360, y: 60 }, { x: 428, y: 180 }, { x: 330, y: 300 },
  { x: 130, y: 300 }, { x: 52, y: 180 },
];
function BoatGame() {
  return (
    <Engine<BoatState>
      id="boat-gp" label="Speedboat Grand Prix"
      blurb="Throttle up and carve through the buoy gates in order — two laps of the lake against the clock. Rocks end runs!"
      create={() => ({ score: 0, x: 240, y: 300, a: -Math.PI / 2, vx: 0, vy: 0, gate: 0, lap: 1, time: 80 })}
      hud={(s) => [["Score", s.score], ["Lap", `${s.lap}/2`], ["Gate", `${s.gate + 1}/${BGATES.length}`], ["Time", `${Math.max(0, Math.ceil(s.time))}s`]]}
      step={(s, dt, input, api) => {
        s.time -= dt;
        if (s.time <= 0) { api.end(false); return; }
        if (input.keys.has("ArrowLeft") || input.keys.has("a")) s.a -= 2.1 * dt;
        if (input.keys.has("ArrowRight") || input.keys.has("d")) s.a += 2.1 * dt;
        if (input.keys.has("ArrowUp") || input.keys.has("w") || input.pdown) {
          s.vx += Math.cos(s.a) * 210 * dt;
          s.vy += Math.sin(s.a) * 210 * dt;
        }
        if (input.pdown) {
          if (input.px < W / 2 - 40) s.a -= 2.1 * dt;
          if (input.px > W / 2 + 40) s.a += 2.1 * dt;
        }
        s.vx *= Math.pow(0.3, dt); s.vy *= Math.pow(0.3, dt);
        s.x = clamp(s.x + s.vx * dt, 14, W - 14);
        s.y = clamp(s.y + s.vy * dt, 14, H - 14);
        const rocks = [{ x: 240, y: 120 }, { x: 150, y: 190 }, { x: 330, y: 190 }, { x: 240, y: 250 }];
        for (const r of rocks) {
          if (Math.hypot(s.x - r.x, s.y - r.y) < 17) {
            api.beep(90, 0.3, "sawtooth");
            api.end(false); return;
          }
        }
        const g = BGATES[s.gate]!;
        if (Math.hypot(s.x - g.x, s.y - g.y) < 26) {
          s.score += 60; s.time += 3; s.gate += 1;
          api.beep(740, 0.07);
          if (s.gate >= BGATES.length) {
            s.gate = 0; s.lap += 1; s.score += 150;
            api.beep(560, 0.12, "triangle");
            if (s.lap > 2) { api.end(true); return; }
          }
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#0284c7"; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(0, 60 + i * 80);
          ctx.bezierCurveTo(150, 50 + i * 80, 320, 70 + i * 80, W, 60 + i * 80);
          ctx.stroke();
        }
        ctx.font = "20px serif"; ctx.textAlign = "center";
        for (const r of [{ x: 240, y: 120 }, { x: 150, y: 190 }, { x: 330, y: 190 }, { x: 240, y: 250 }]) ctx.fillText("🪨", r.x, r.y + 7);
        BGATES.forEach((g, i) => {
          ctx.fillStyle = i === s.gate ? "#facc15" : "rgba(255,255,255,0.5)";
          ctx.beginPath(); ctx.arc(g.x, g.y, i === s.gate ? 13 : 9, 0, 7); ctx.fill();
          ctx.fillStyle = "#7f1d1d"; ctx.font = "bold 11px system-ui";
          ctx.fillText(String(i + 1), g.x, g.y + 4);
          ctx.font = "20px serif";
        });
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a + Math.PI / 2);
        ctx.font = "26px serif"; ctx.fillText("🚤", 0, 8);
        ctx.restore();
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ------------------------------------------------------------- Snow Rally */
type SnowState = {
  score: number; over?: boolean; won?: boolean;
  x: number; speed: number; dist: number; gatesHit: number; gatesMissed: number;
  items: { x: number; y: number; kind: string; side: number }[];
  spawnT: number;
};
function SnowGame() {
  return (
    <Engine<SnowState>
      id="snow-rally" label="Snowboard Rush"
      blurb="Carve down the mountain! Pass each gate on its colored side, dodge the pines, and keep your speed for the finish."
      create={() => ({ score: 0, x: W / 2, speed: 120, dist: 0, gatesHit: 0, gatesMissed: 0, items: [], spawnT: 0 })}
      hud={(s) => [["Score", s.score], ["Gates", `${s.gatesHit} ✓ · ${s.gatesMissed} ✗`], ["Distance", `${Math.floor(s.dist)}m`]]}
      step={(s, dt, input, api) => {
        s.dist += s.speed * dt / 9;
        s.speed = Math.min(215, s.speed + dt * 5.5);
        if (input.keys.has("ArrowLeft") || input.keys.has("a")) s.x -= 190 * dt;
        if (input.keys.has("ArrowRight") || input.keys.has("d")) s.x += 190 * dt;
        if (input.pdown) s.x += clamp(input.px - s.x, -220 * dt, 220 * dt);
        s.x = clamp(s.x, 26, W - 26);
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = rand(0.62, 0.95);
          const gate = Math.random() < 0.62;
          s.items.push({
            x: gate ? rand(90, W - 90) : rand(30, W - 30), y: -24,
            kind: gate ? "gate" : "🌲", side: Math.random() < 0.5 ? -1 : 1,
          });
        }
        for (const it of s.items) {
          it.y += s.speed * dt;
          if (it.kind === "gate" && it.y > 292 && it.y < 306) {
            const onSide = (s.x - it.x) * it.side > 0 && Math.abs(s.x - it.x) < 78;
            if (onSide) { s.gatesHit += 1; s.score += 30; it.y = 9999; api.beep(700, 0.06); }
            else if (Math.abs(s.x - it.x) >= 78) { /* missed wide, no penalty */ }
          }
          if (it.kind === "gate" && it.y >= 306 && it.y < 9999) {
            s.gatesMissed += 1; s.score = Math.max(0, s.score - 15); it.y = 9999;
            api.beep(150, 0.12, "sawtooth");
            if (s.gatesMissed >= 5) { api.end(false); return; }
          }
          if (it.kind === "🌲" && Math.abs(it.x - s.x) < 20 && Math.abs(it.y - 296) < 18) {
            api.beep(90, 0.3, "sawtooth");
            api.end(false); return;
          }
        }
        s.items = s.items.filter((it) => it.y < H + 30);
        s.score += dt * 3;
        s.score = Math.floor(s.score);
        if (s.dist >= 1200) { s.score += s.gatesHit * 5; api.end(s.gatesHit >= 12); }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(148,163,184,0.5)"; ctx.lineWidth = 3; ctx.setLineDash([18, 22]);
        ctx.beginPath(); ctx.moveTo(W / 2 - 70, 0); ctx.lineTo(W / 2 - 70, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W / 2 + 70, 0); ctx.lineTo(W / 2 + 70, H); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "26px serif"; ctx.textAlign = "center";
        for (const it of s.items) {
          if (it.kind === "gate") {
            ctx.fillStyle = it.side < 0 ? "#dc2626" : "#2563eb";
            ctx.fillRect(it.x - 3, it.y - 16, 5, 32);
            ctx.fillStyle = it.side < 0 ? "#2563eb" : "#dc2626";
            ctx.font = "bold 15px system-ui";
            ctx.fillText(it.side < 0 ? "◀ pass left" : "pass right ▶", it.x, it.y - 22);
            ctx.font = "26px serif";
          } else {
            ctx.fillText("🌲", it.x, it.y + 9);
          }
        }
        ctx.font = "30px serif"; ctx.fillText("🏂", s.x, 308);
        ctx.fillStyle = "rgba(15,23,42,0.65)"; ctx.fillRect(12, 12, 150, 10);
        ctx.fillStyle = "#38bdf8"; ctx.fillRect(12, 12, 150 * Math.min(1, s.dist / 1200), 10);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ------------------------------------------------------------- Derby Dash */
type DerbyState = {
  score: number; over?: boolean; won?: boolean;
  prog: number; stamina: number; rhythm: number; lastTap: number; taps: number;
  rivals: { prog: number; base: number; name: string; emoji: string }[];
  finished: boolean; place: number;
};
function DerbyGame() {
  return (
    <Engine<DerbyState>
      id="derby-dash" label="Derby Dash"
      blurb="Tap in a steady gallop rhythm to race your horse — frantic tapping tires it out, a smooth beat flies. First to the line wins!"
      create={() => ({
        score: 0, prog: 0, stamina: 100, rhythm: 0, lastTap: 0, taps: 0, finished: false, place: 0,
        rivals: [
          { prog: 0, base: 0.055, name: "Comet", emoji: "🐴" },
          { prog: 0, base: 0.06, name: "Biscuit", emoji: "🐎" },
          { prog: 0, base: 0.05, name: "Pepper", emoji: "🦄" },
        ],
      })}
      hud={(s) => [["Stamina", `${Math.max(0, Math.round(s.stamina))}%`], ["Position", `${1 + s.rivals.filter((r) => r.prog > s.prog).length}/4`], ["Score", s.score]]}
      onTap={(s, _x, _y, api) => {
        const now = performance.now() / 1000;
        const gap = now - s.lastTap;
        s.lastTap = now;
        s.taps += 1;
        if (gap > 0.24 && gap < 0.62) {
          s.rhythm = Math.min(1, s.rhythm + 0.24);
          s.stamina = Math.max(0, s.stamina - 1.6);
          api.beep(500 + s.rhythm * 300, 0.05, "triangle");
        } else if (gap <= 0.24) {
          s.rhythm = Math.max(0, s.rhythm - 0.2);
          s.stamina = Math.max(0, s.stamina - 4);
        } else {
          s.rhythm = Math.max(0.25, s.rhythm);
          s.stamina = Math.max(0, s.stamina - 1);
        }
      }}
      step={(s, dt, _input, api) => {
        s.rhythm = Math.max(0, s.rhythm - dt * 0.16);
        s.stamina = Math.min(100, s.stamina + dt * (s.rhythm < 0.3 ? 5 : 1.2));
        const tired = s.stamina <= 0 ? 0.35 : 1;
        s.prog += (0.018 + s.rhythm * 0.052) * tired * dt;
        for (const r of s.rivals) {
          r.prog += (r.base + Math.sin(r.prog * 22 + r.base * 300) * 0.006) * dt;
          if (r.prog >= 1 && !s.finished) { /* rivals can finish first */ }
        }
        s.score = Math.floor(s.prog * 500);
        if (s.prog >= 1) {
          s.place = 1 + s.rivals.filter((r) => r.prog >= 1).length;
          s.score += s.place === 1 ? 300 : s.place === 2 ? 150 : 50;
          api.end(s.place <= 2);
          return;
        }
        if (s.rivals.filter((r) => r.prog >= 1).length >= 3) {
          api.end(false);
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#fef3c7"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#d97706"; ctx.fillRect(0, 300, W, 60);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(436, 40); ctx.lineTo(436, 320); ctx.stroke();
        ctx.font = "bold 12px system-ui"; ctx.fillStyle = "#92400e"; ctx.textAlign = "center";
        ctx.fillText("FINISH", 436, 32);
        const lanes = [70, 138, 206, 274];
        ctx.font = "30px serif";
        s.rivals.forEach((r, i) => {
          ctx.fillText(r.emoji, 40 + r.prog * 396, lanes[i]! + 10);
          ctx.font = "bold 11px system-ui"; ctx.fillStyle = "#57534e";
          ctx.fillText(r.name, 40 + r.prog * 396, lanes[i]! - 16);
          ctx.font = "30px serif"; ctx.fillStyle = "#000";
        });
        const bob = Math.sin(performance.now() / 90) * (s.rhythm > 0.1 ? 3 : 0);
        ctx.fillText("🏇", 40 + s.prog * 396, lanes[3]! + 10 + bob);
        ctx.font = "bold 11px system-ui"; ctx.fillStyle = "#1d4ed8";
        ctx.fillText("YOU", 40 + s.prog * 396, lanes[3]! - 16);
        // rhythm meter
        ctx.fillStyle = "rgba(15,23,42,0.7)"; ctx.fillRect(12, 330, 180, 12);
        ctx.fillStyle = s.rhythm > 0.55 ? "#22c55e" : "#f59e0b";
        ctx.fillRect(14, 332, 176 * s.rhythm, 8);
        ctx.fillStyle = "#fff"; ctx.font = "bold 11px system-ui"; ctx.textAlign = "left";
        ctx.fillText("GALLOP RHYTHM — tap steadily!", 12, 326);
      }}
    />
  );
}

/* --------------------------------------------------------- Speedway Sprint */
type SpeedwayState = {
  score: number; over?: boolean; won?: boolean;
  lane: number; x: number; dist: number; fuel: number; nitro: number; pos: number;
  cars: { lane: number; x: number; passed: boolean }[];
  pickups: { lane: number; x: number; kind: string }[];
  spawnT: number;
};
const SLANES = [92, 180, 268];
function SpeedwayGame() {
  return (
    <Engine<SpeedwayState>
      id="speedway-sprint" label="Speedway Sprint"
      blurb="A 3 km sprint through traffic: overtake for points, grab fuel cans and nitro, and don't run the tank dry."
      create={() => ({ score: 0, lane: 1, x: 64, dist: 0, fuel: 100, nitro: 50, pos: 12, cars: [], pickups: [], spawnT: 0 })}
      hud={(s) => [["Score", s.score], ["Fuel", `${Math.max(0, Math.round(s.fuel))}%`], ["Nitro", `${Math.round(s.nitro)}%`], ["Position", `P${s.pos}`], ["Distance", `${(s.dist / 1000).toFixed(1)}km`]]}
      onKey={(s, key, api) => {
        if (key === "ArrowUp" || key === "w") { s.lane = Math.max(0, s.lane - 1); api.beep(430, 0.04); }
        if (key === "ArrowDown" || key === "s") { s.lane = Math.min(2, s.lane + 1); api.beep(430, 0.04); }
      }}
      step={(s, dt, input, api) => {
        const boosting = (input.keys.has("Shift") || input.keys.has(" ")) && s.nitro > 0;
        const speed = boosting ? 250 : 168;
        if (boosting) s.nitro = Math.max(0, s.nitro - 26 * dt);
        s.dist += speed * dt;
        s.fuel -= dt * (boosting ? 3.4 : 2.1);
        if (input.pdown) {
          const lane = input.py < 138 ? 0 : input.py < 224 ? 1 : 2;
          s.lane = lane;
        }
        if (s.fuel <= 0) { api.end(false); return; }
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = rand(0.55, 1);
          if (Math.random() < 0.72) s.cars.push({ lane: randi(0, 2), x: W + 40, passed: false });
          else s.pickups.push({ lane: randi(0, 2), x: W + 40, kind: Math.random() < 0.55 ? "⛽" : "⚡" });
        }
        for (const c of s.cars) {
          c.x -= (speed - 62) * dt;
          if (!c.passed && c.x < 64) {
            c.passed = true;
            if (c.lane !== s.lane) { s.score += 20; s.pos = Math.max(1, s.pos - 1); api.beep(660, 0.05); }
          }
          if (c.lane === s.lane && Math.abs(c.x - 64) < 30) {
            api.beep(90, 0.3, "sawtooth");
            api.end(false); return;
          }
        }
        s.cars = s.cars.filter((c) => c.x > -50);
        for (const p of s.pickups) {
          p.x -= speed * dt;
          if (p.lane === s.lane && Math.abs(p.x - 64) < 26) {
            p.x = -999;
            if (p.kind === "⛽") s.fuel = Math.min(100, s.fuel + 30);
            else s.nitro = Math.min(100, s.nitro + 35);
            s.score += 10;
            api.beep(980, 0.07);
          }
        }
        s.pickups = s.pickups.filter((p) => p.x > -30);
        s.score += dt * 2;
        s.score = Math.floor(s.score);
        if (s.dist >= 3000) { s.score += s.pos <= 3 ? 250 : 100; api.end(s.pos <= 6); }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#1f2937"; ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i === s.lane ? "rgba(56,189,248,0.13)" : "rgba(255,255,255,0.03)";
          ctx.fillRect(0, SLANES[i]! - 42, W, 84);
          ctx.strokeStyle = "#4b5563"; ctx.setLineDash([16, 18]);
          ctx.beginPath(); ctx.moveTo(0, SLANES[i]! + 43); ctx.lineTo(W, SLANES[i]! + 43); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.font = "30px serif"; ctx.textAlign = "center";
        for (const c of s.cars) ctx.fillText("🚗", c.x, SLANES[c.lane]! + 10);
        ctx.font = "24px serif";
        for (const p of s.pickups) ctx.fillText(p.kind, p.x, SLANES[p.lane]! + 8);
        ctx.font = "34px serif";
        ctx.fillText("🏎️", 64, SLANES[s.lane]! + 12);
        ctx.textAlign = "left";
      }}
    />
  );
}

export const GAMES3A: Record<string, ComponentType> = {
  "drift-king": DriftGame,
  "moto-rush": MotoGame,
  "kart-chaos": KartGame,
  "drag-strip": DragGame,
  "boat-gp": BoatGame,
  "snow-rally": SnowGame,
  "derby-dash": DerbyGame,
  "speedway-sprint": SpeedwayGame,
};

/* ------------------------------------------------------------ Pong Classic */
type PongState = {
  score: number; over?: boolean; won?: boolean;
  bx: number; by: number; vx: number; vy: number;
  py: number; ay: number; aiScore: number; serveT: number;
};
function PongGame() {
  return (
    <Engine<PongState>
      id="pong-classic" label="Pong Classic"
      blurb="The original video game! Slide your paddle, angle your returns and beat the computer to seven points."
      create={() => ({ score: 0, bx: W / 2, by: H / 2, vx: 190, vy: 90, py: H / 2, ay: H / 2, aiScore: 0, serveT: 0.6 })}
      hud={(s) => [["You", s.score], ["CPU", s.aiScore], ["First to", 7]]}
      step={(s, dt, input, api) => {
        if (input.keys.has("ArrowUp") || input.keys.has("w")) s.py -= 250 * dt;
        if (input.keys.has("ArrowDown") || input.keys.has("s")) s.py += 250 * dt;
        if (input.pdown) s.py += clamp(input.py - s.py, -300 * dt, 300 * dt);
        s.py = clamp(s.py, 34, H - 34);
        const aiSpeed = 168 + s.score * 6;
        s.ay += clamp(s.by - s.ay, -aiSpeed * dt, aiSpeed * dt);
        s.ay = clamp(s.ay, 34, H - 34);
        if (s.serveT > 0) { s.serveT -= dt; return; }
        s.bx += s.vx * dt; s.by += s.vy * dt;
        if (s.by < 8) { s.by = 8; s.vy = Math.abs(s.vy); api.beep(500, 0.04); }
        if (s.by > H - 8) { s.by = H - 8; s.vy = -Math.abs(s.vy); api.beep(500, 0.04); }
        if (s.bx < 26 && Math.abs(s.by - s.py) < 40 && s.vx < 0) {
          s.vx = Math.abs(s.vx) * 1.045;
          s.vy = clamp(s.vy + (s.by - s.py) * 3.4, -260, 260);
          s.bx = 26;
          api.beep(700, 0.05);
        }
        if (s.bx > W - 26 && Math.abs(s.by - s.ay) < 40 && s.vx > 0) {
          s.vx = -Math.abs(s.vx) * 1.045;
          s.vy = clamp(s.vy + (s.by - s.ay) * 3.4, -260, 260);
          s.bx = W - 26;
          api.beep(700, 0.05);
        }
        if (s.bx < -12) {
          s.aiScore += 1; api.beep(140, 0.18, "sawtooth");
          s.bx = W / 2; s.by = H / 2; s.vx = 190; s.vy = 90; s.serveT = 0.7;
          if (s.aiScore >= 7) { api.end(false); return; }
        }
        if (s.bx > W + 12) {
          s.score += 1; api.beep(620, 0.1, "triangle");
          s.bx = W / 2; s.by = H / 2; s.vx = -190; s.vy = -90; s.serveT = 0.7;
          if (s.score >= 7) { api.end(true); return; }
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#052e16"; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.setLineDash([8, 10]);
        ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "#4ade80"; ctx.fillRect(12, s.py - 34, 9, 68);
        ctx.fillStyle = "#f87171"; ctx.fillRect(W - 21, s.ay - 34, 9, 68);
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(s.bx, s.by, 7, 0, 7); ctx.fill();
        ctx.font = "bold 44px system-ui"; ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillText(String(s.score), W / 2 - 52, 58);
        ctx.fillText(String(s.aiScore), W / 2 + 52, 58);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* -------------------------------------------------------------- Mole Mania */
type MoleState = {
  score: number; over?: boolean; won?: boolean;
  time: number; bonks: number;
  holes: { up: number; max: number; kind: string }[];
};
function MoleGame() {
  return (
    <Engine<MoleState>
      id="mole-mania" label="Mole Mania"
      blurb="Forty-five seconds of bonking! Whack the moles, grab the golden ones for triple points and never touch a bomb mole."
      create={() => ({ score: 0, time: 45, bonks: 0, holes: Array.from({ length: 9 }, () => ({ up: -rand(0.2, 1.4), max: rand(0.8, 1.5), kind: "🦔" })) })}
      hud={(s) => [["Score", s.score], ["Time", `${Math.max(0, Math.ceil(s.time))}s`], ["Bonks", s.bonks]]}
      onTap={(s, x, y, api) => {
        const col = Math.floor(x / (W / 3));
        const row = Math.floor(y / (H / 3));
        const hole = s.holes[row * 3 + col];
        if (hole && hole.up > 0) {
          if (hole.kind === "💣") {
            s.score = Math.max(0, s.score - 25); s.time = Math.max(0, s.time - 3);
            api.beep(90, 0.2, "sawtooth");
          } else {
            s.score += hole.kind === "⭐" ? 30 : 10;
            s.bonks += 1;
            api.beep(820, 0.05);
          }
          hole.up = -rand(0.3, 1.1);
        }
      }}
      step={(s, dt, _input, api) => {
        s.time -= dt;
        const rate = 1 + (45 - s.time) * 0.012;
        for (const h of s.holes) {
          h.up += dt * rate * (h.up > 0 ? 1 : 1.4);
          if (h.up > h.max) {
            h.up = -rand(0.25, 1.2);
            h.max = rand(0.75, 1.5);
            const r = Math.random();
            h.kind = r < 0.12 ? "💣" : r < 0.3 ? "⭐" : "🦔";
          }
        }
        if (s.time <= 0) api.end(s.score >= 220);
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#86efac"; ctx.fillRect(0, 0, W, H);
        ctx.font = "46px serif"; ctx.textAlign = "center";
        s.holes.forEach((h, i) => {
          const cx = (i % 3) * 160 + 80;
          const cy = Math.floor(i / 3) * 120 + 66;
          ctx.fillStyle = "#78350f";
          ctx.beginPath(); ctx.ellipse(cx, cy + 26, 46, 14, 0, 0, 7); ctx.fill();
          if (h.up > 0) ctx.fillText(h.kind === "⭐" ? "🌟" : h.kind, cx, cy + 16);
        });
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ------------------------------------------------------------- Stack Tower */
type StackState = {
  score: number; over?: boolean; won?: boolean;
  blocks: { x: number; w: number; y: number }[];
  cur: { x: number; w: number; dir: number; sp: number };
  falling: { x: number; w: number; y: number; vy: number } | null;
  camY: number;
};
function StackGame() {
  return (
    <Engine<StackState>
      id="stack-tower" label="Stack Tower"
      blurb="The block slides back and forth — tap to drop it. Whatever hangs over the edge shears off. How tall can you build?"
      create={() => ({
        score: 0,
        blocks: [{ x: 140, w: 200, y: 330 }],
        cur: { x: 0, w: 200, dir: 1, sp: 130 },
        falling: null, camY: 0,
      })}
      hud={(s) => [["Height", s.blocks.length - 1], ["Score", s.score], ["Width", Math.round(s.cur.w)]]}
      onTap={(s, _x, _y, api) => {
        if (s.falling) return;
        const top = s.blocks[s.blocks.length - 1]!;
        const left = Math.max(s.cur.x, top.x);
        const right = Math.min(s.cur.x + s.cur.w, top.x + top.w);
        const overlap = right - left;
        if (overlap <= 0) {
          s.falling = { x: s.cur.x, w: s.cur.w, y: top.y - 22, vy: 60 };
          api.beep(120, 0.2, "sawtooth");
          return;
        }
        const perfect = Math.abs(s.cur.x - top.x) < 5;
        const nx = perfect ? top.x : left;
        const nw = perfect ? top.w : overlap;
        s.blocks.push({ x: nx, w: nw, y: top.y - 22 });
        s.score += perfect ? 25 : 10;
        if (perfect) api.beep(980, 0.08, "triangle");
        else api.beep(520, 0.05);
        s.cur = { x: Math.random() < 0.5 ? 0 : W - nw, w: nw, dir: s.cur.x === 0 ? 1 : -1, sp: Math.min(300, s.cur.sp + 9) };
        if (s.blocks.length > 9) s.camY += 22;
      }}
      step={(s, dt, _input, api) => {
        if (s.falling) {
          s.falling.vy += 700 * dt;
          s.falling.y += s.falling.vy * dt;
          if (s.falling.y > H + 60) { api.end(false); return; }
          return;
        }
        s.cur.x += s.cur.dir * s.cur.sp * dt;
        if (s.cur.x < 0) { s.cur.x = 0; s.cur.dir = 1; }
        if (s.cur.x + s.cur.w > W) { s.cur.x = W - s.cur.w; s.cur.dir = -1; }
      }}
      draw={(ctx, s) => {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#312e81"); grad.addColorStop(1, "#7c3aed");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899"];
        s.blocks.forEach((b, i) => {
          ctx.fillStyle = colors[i % colors.length]!;
          ctx.fillRect(b.x, b.y + s.camY, b.w, 20);
          ctx.fillStyle = "rgba(255,255,255,0.25)";
          ctx.fillRect(b.x, b.y + s.camY, b.w, 4);
        });
        const top = s.blocks[s.blocks.length - 1]!;
        if (s.falling) {
          ctx.fillStyle = "#94a3b8";
          ctx.fillRect(s.falling.x, s.falling.y + s.camY, s.falling.w, 20);
        } else {
          ctx.fillStyle = colors[s.blocks.length % colors.length]!;
          ctx.fillRect(s.cur.x, top.y - 22 + s.camY, s.cur.w, 20);
          ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.setLineDash([4, 5]);
          ctx.strokeRect(top.x, top.y - 22 + s.camY, top.w, 20);
          ctx.setLineDash([]);
        }
      }}
    />
  );
}

/* ------------------------------------------------------------ Pinball Mini */
type PinState = {
  score: number; over?: boolean; won?: boolean;
  bx: number; by: number; vx: number; vy: number;
  balls: number; fl: number; fr: number; launched: boolean;
  bumpers: { x: number; y: number; flash: number }[];
};
function PinballGame() {
  return (
    <Engine<PinState>
      id="pinball-mini" label="Pinball Mini"
      blurb="Three balls, two flippers, five fat bumpers. Keep the ball alive, light the bumpers and chase the silver high score."
      create={() => ({
        score: 0, bx: 448, by: 300, vx: 0, vy: 0, balls: 3, fl: 0, fr: 0, launched: false,
        bumpers: [{ x: 130, y: 90, flash: 0 }, { x: 240, y: 64, flash: 0 }, { x: 350, y: 90, flash: 0 }, { x: 180, y: 160, flash: 0 }, { x: 300, y: 160, flash: 0 }],
      })}
      hud={(s) => [["Score", s.score], ["Balls", "🔮".repeat(Math.max(0, s.balls)) || "—"]]}
      onKey={(s, key, api) => {
        if (key === "z" || key === "Z" || key === "ArrowLeft") { s.fl = 1; api.beep(300, 0.03); }
        if (key === "/" || key === "ArrowRight") { s.fr = 1; api.beep(300, 0.03); }
        if ((key === " " || key === "ArrowDown") && !s.launched) {
          s.launched = true; s.vy = -430; s.vx = -60;
          api.beep(600, 0.08);
        }
      }}
      onTap={(s, x, _y, api) => {
        if (!s.launched) {
          s.launched = true; s.vy = -430; s.vx = -60;
          api.beep(600, 0.08);
          return;
        }
        if (x < W / 2) { s.fl = 1; api.beep(300, 0.03); }
        else { s.fr = 1; api.beep(300, 0.03); }
      }}
      step={(s, dt, _input, api) => {
        s.fl = Math.max(0, s.fl - dt * 7);
        s.fr = Math.max(0, s.fr - dt * 7);
        if (!s.launched) return;
        s.vy += 520 * dt;
        s.bx += s.vx * dt; s.by += s.vy * dt;
        if (s.bx < 34) { s.bx = 34; s.vx = Math.abs(s.vx); }
        if (s.bx > 462 && s.by > 130) { s.bx = 462; s.vx = -Math.abs(s.vx); }
        if (s.bx > 428 && s.by <= 130) { /* top curve into playfield */ s.bx = 428; }
        if (s.by < 12) { s.by = 12; s.vy = Math.abs(s.vy); }
        // One-way gate at top-left of the launch lane.
        if (s.bx > 428 && s.vy > 0 && s.by > 130) s.bx = 462;
        for (const b of s.bumpers) {
          b.flash = Math.max(0, b.flash - dt * 4);
          const d = Math.hypot(s.bx - b.x, s.by - b.y);
          if (d < 30 && d > 0) {
            const nx = (s.bx - b.x) / d, ny = (s.by - b.y) / d;
            s.bx = b.x + nx * 31; s.by = b.y + ny * 31;
            const sp = Math.max(190, Math.hypot(s.vx, s.vy));
            s.vx = nx * sp; s.vy = ny * sp;
            b.flash = 1; s.score += 50;
            api.beep(880, 0.06);
          }
        }
        // Sloped guides toward flippers.
        if (s.by > 252 && s.by < 300) {
          if (s.bx < 168) s.vx += 130 * dt;
          if (s.bx > 292) s.vx -= 130 * dt;
        }
        // Flippers: segments from pivots; hit when ball near and flipper swinging.
        const flipHit = (px: number, dir: number, active: number) => {
          const fx = px + dir * 34;
          const fy = 322 - active * 14;
          if (Math.hypot(s.bx - (px + fx) / 2, s.by - (322 + fy) / 2) < 24 && s.vy > 0) {
            s.vy = -(330 + active * 190);
            s.vx += dir * (90 + active * 90) + (s.bx - px) * 1.4;
            s.by = 306;
            api.beep(420, 0.05);
          }
        };
        flipHit(178, 1, s.fl);
        flipHit(282, -1, s.fr);
        if (s.by > H + 14) {
          s.balls -= 1;
          api.beep(120, 0.25, "sawtooth");
          if (s.balls <= 0) { api.end(false); return; }
          s.bx = 448; s.by = 300; s.vx = 0; s.vy = 0; s.launched = false;
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#111827"; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "#6366f1"; ctx.lineWidth = 3;
        ctx.strokeRect(26, 8, 428, 344);
        ctx.strokeStyle = "#4f46e5";
        ctx.beginPath(); ctx.moveTo(436, 130); ctx.lineTo(436, 352); ctx.stroke();
        for (const b of s.bumpers) {
          ctx.fillStyle = b.flash > 0 ? "#facc15" : "#7c3aed";
          ctx.beginPath(); ctx.arc(b.x, b.y, 20, 0, 7); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "center";
          ctx.fillText("50", b.x, b.y + 4);
        }
        // Flippers
        ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 8; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(178, 322); ctx.lineTo(178 + 36, 322 - s.fl * 16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(282, 322); ctx.lineTo(282 - 36, 322 - s.fr * 16); ctx.stroke();
        ctx.lineCap = "butt";
        const grad = ctx.createRadialGradient(s.bx - 3, s.by - 3, 1, s.bx, s.by, 10);
        grad.addColorStop(0, "#fff"); grad.addColorStop(1, "#94a3b8");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(s.bx, s.by, 9, 0, 7); ctx.fill();
        if (!s.launched) {
          ctx.fillStyle = "#fbbf24"; ctx.font = "bold 14px system-ui"; ctx.textAlign = "center";
          ctx.fillText("Tap or press Space to launch!", 240, 200);
        }
        ctx.textAlign = "left";
      }}
    />
  );
}

/* -------------------------------------------------------------- Sky Bounce */
type BounceState = {
  score: number; over?: boolean; won?: boolean;
  x: number; y: number; vy: number; camY: number; height: number;
  plats: { x: number; y: number; kind: string; vx: number }[];
};
function SkyBounceGame() {
  const mkPlats = (topY: number) =>
    Array.from({ length: 9 }, (_, i) => ({
      x: rand(10, W - 80), y: topY - i * 62,
      kind: i % 5 === 4 ? "move" : i % 7 === 6 ? "break" : "norm",
      vx: rand(30, 60) * (Math.random() < 0.5 ? -1 : 1),
    }));
  return (
    <Engine<BounceState>
      id="sky-bounce" label="Sky Bounce"
      blurb="Bounce, bounce, bounce! Steer between platforms, ride the springs, avoid the crumbling ones and climb into the clouds."
      create={() => ({
        score: 0, x: W / 2, y: 280, vy: -380, camY: 0, height: 0,
        plats: [{ x: W / 2 - 35, y: 330, kind: "norm", vx: 0 }, ...mkPlats(280)],
      })}
      hud={(s) => [["Height", `${Math.floor(s.height)}m`], ["Score", s.score]]}
      step={(s, dt, input, api) => {
        if (input.keys.has("ArrowLeft") || input.keys.has("a")) s.x -= 235 * dt;
        if (input.keys.has("ArrowRight") || input.keys.has("d")) s.x += 235 * dt;
        if (input.pdown) s.x += clamp(input.px - s.x, -260 * dt, 260 * dt);
        if (s.x < -16) s.x = W + 16;
        if (s.x > W + 16) s.x = -16;
        s.vy += 760 * dt;
        s.y += s.vy * dt;
        for (const p of s.plats) {
          if (p.kind === "move") {
            p.x += p.vx * dt;
            if (p.x < 4 || p.x > W - 74) p.vx *= -1;
          }
        }
        if (s.vy > 0) {
          for (const p of s.plats) {
            const wy = p.y - s.camY;
            if (s.x > p.x - 12 && s.x < p.x + 82 && s.y + 12 > wy && s.y + 12 < wy + 16) {
              if (p.kind === "break") {
                p.y = -99999;
                api.beep(160, 0.08, "sawtooth");
              } else {
                s.vy = -392;
                s.score += 5;
                api.beep(500, 0.05);
              }
            }
          }
        }
        if (s.y < 130) {
          const dy = 130 - s.y;
          s.y = 130;
          s.camY += dy;
          s.height += dy / 18;
          s.score = Math.max(s.score, Math.floor(s.height) * 2);
          while (s.plats.filter((p) => p.y - s.camY > -80).length < 10) {
            const top = Math.min(...s.plats.map((p) => p.y));
            s.plats.push({
              x: rand(10, W - 80), y: top - rand(48, 70),
              kind: Math.random() < 0.22 ? "move" : Math.random() < 0.14 ? "break" : "norm",
              vx: rand(30, 62) * (Math.random() < 0.5 ? -1 : 1),
            });
          }
          s.plats = s.plats.filter((p) => p.y - s.camY < H + 60 && p.y > -90000);
        }
        if (s.y > H + 30) { api.end(false); return; }
      }}
      draw={(ctx, s) => {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#38bdf8"); grad.addColorStop(1, "#bae6fd");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        for (let i = 0; i < 5; i++) {
          const cx = (i * 131 + 40) % W;
          const cy = (i * 89 + (s.camY * 0.4) % 300) % H;
          ctx.beginPath(); ctx.ellipse(cx, cy, 30, 11, 0, 0, 7); ctx.fill();
        }
        for (const p of s.plats) {
          const wy = p.y - s.camY;
          if (wy < -30 || wy > H + 20) continue;
          ctx.fillStyle = p.kind === "break" ? "#b45309" : p.kind === "move" ? "#2563eb" : "#16a34a";
          ctx.beginPath(); ctx.roundRect(p.x, wy, 70, 11, 5); ctx.fill();
        }
        ctx.font = "26px serif"; ctx.textAlign = "center";
        ctx.fillText("🐸", s.x, s.y + 9);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ------------------------------------------------------------- Road Hopper */
type HopState = {
  score: number; over?: boolean; won?: boolean;
  gx: number; gy: number; level: number; time: number; logX: number;
  cars: { lane: number; x: number; sp: number; dir: number }[];
  logs: { lane: number; x: number; sp: number; w: number }[];
};
const HOP_ROWS = 12;
function RoadHopperGame() {
  const mkTraffic = () => ({
    cars: Array.from({ length: 9 }, (_, i) => ({
      lane: [2, 3, 4, 6, 7][i % 5]!, x: rand(0, W), sp: rand(70, 150), dir: i % 2 ? 1 : -1,
    })),
    logs: Array.from({ length: 6 }, (_, i) => ({
      lane: [9, 10][i % 2]!, x: rand(0, W), sp: rand(28, 48) * (i % 2 ? 1 : -1), w: rand(84, 120),
    })),
  });
  return (
    <Engine<HopState>
      id="road-hopper" label="Road Hopper"
      blurb="Hop the highway, ride the logs, reach the far bank! Every crossing raises the traffic — and your score."
      create={() => ({ score: 0, gx: 7, gy: 0, level: 1, time: 40, logX: -1, ...mkTraffic() })}
      hud={(s) => [["Score", s.score], ["Level", s.level], ["Time", `${Math.max(0, Math.ceil(s.time))}s`]]}
      onKey={(s, key, api) => {
        let dx = 0, dy = 0;
        if (key === "ArrowUp" || key === "w") dy = 1;
        else if (key === "ArrowDown" || key === "s") dy = -1;
        else if (key === "ArrowLeft" || key === "a") dx = -1;
        else if (key === "ArrowRight" || key === "d") dx = 1;
        else return;
        s.gx = clamp(s.gx + dx, 0, 14);
        s.gy = clamp(s.gy + dy, 0, HOP_ROWS - 1);
        api.beep(560, 0.04, "triangle");
      }}
      onTap={(s, x, y, api) => {
        const px = s.gx * 32 + 16, py = H - (s.gy * 30 + 15);
        if (Math.abs(x - px) > Math.abs(y - py)) {
          s.gx = clamp(s.gx + (x > px ? 1 : -1), 0, 14);
        } else {
          s.gy = clamp(s.gy + (y < py ? 1 : -1), 0, HOP_ROWS - 1);
        }
        api.beep(560, 0.04, "triangle");
      }}
      step={(s, dt, _input, api) => {
        s.time -= dt;
        if (s.time <= 0) { api.end(false); return; }
        for (const c of s.cars) {
          c.x += c.dir * c.sp * (1 + s.level * 0.07) * dt;
          if (c.x > W + 40) c.x = -40;
          if (c.x < -40) c.x = W + 40;
        }
        for (const l of s.logs) {
          l.x += l.sp * dt;
          if (l.x > W + 130) l.x = -130;
          if (l.x < -130) l.x = W + 130;
        }
        const px = s.gx * 32 + 16;
        if ([2, 3, 4, 6, 7].includes(s.gy)) {
          for (const c of s.cars) {
            if (c.lane === s.gy && Math.abs(c.x - px) < 26) {
              api.beep(90, 0.3, "sawtooth");
              api.end(false); return;
            }
          }
        }
        if (s.gy === 9 || s.gy === 10) {
          const log = s.logs.find((l) => l.lane === s.gy && px > l.x && px < l.x + l.w);
          if (!log) {
            api.beep(120, 0.3, "sawtooth");
            api.end(false); return;
          }
          s.gx = clamp(s.gx + (log.sp * dt) / 32, 0, 14.99);
        }
        if (s.gy >= 11) {
          s.score += 100 + Math.ceil(s.time);
          s.level += 1;
          s.gx = 7; s.gy = 0; s.time = 40;
          const t = mkTraffic();
          s.cars = t.cars; s.logs = t.logs;
          api.beep(620, 0.14, "triangle");
          if (s.level > 5) { api.end(true); return; }
        }
        s.score += 0;
      }}
      draw={(ctx, s) => {
        for (let row = 0; row < HOP_ROWS; row++) {
          const y = H - (row + 1) * 30;
          if (row === 0 || row === 5 || row === 8) ctx.fillStyle = "#22c55e";
          else if (row === 11) ctx.fillStyle = "#facc15";
          else if (row === 9 || row === 10) ctx.fillStyle = "#0284c7";
          else ctx.fillStyle = "#374151";
          ctx.fillRect(0, y, W, 30);
        }
        ctx.font = "20px serif"; ctx.textAlign = "center";
        for (const l of s.logs) {
          const y = H - (l.lane + 1) * 30;
          ctx.fillStyle = "#92400e";
          ctx.beginPath(); ctx.roundRect(l.x, y + 5, l.w, 20, 9); ctx.fill();
        }
        for (const c of s.cars) {
          const y = H - (c.lane + 1) * 30 + 22;
          ctx.fillText(c.dir > 0 ? "🚗" : "🚙", c.x, y);
        }
        ctx.font = "22px serif";
        ctx.fillText("🐸", s.gx * 32 + 16, H - (s.gy * 30) + 7);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ------------------------------------------------------------- Fruit Catch */
type CatchState = {
  score: number; over?: boolean; won?: boolean;
  bx: number; lives: number; time: number; caught: number;
  items: { x: number; y: number; vy: number; kind: string }[];
  spawnT: number;
};
const CATCHABLE = ["🍎", "🍊", "🍓", "🍇", "🍑"];
function FruitCatchGame() {
  return (
    <Engine<CatchState>
      id="fruit-catch" label="Fruit Catch"
      blurb="Slide the basket and harvest the falling fruit. Golden apples are worth five — but one bomb or three misses ends the day."
      create={() => ({ score: 0, bx: W / 2, lives: 3, time: 75, caught: 0, items: [], spawnT: 0 })}
      hud={(s) => [["Score", s.score], ["Lives", "❤️".repeat(Math.max(0, s.lives)) || "—"], ["Time", `${Math.max(0, Math.ceil(s.time))}s`], ["Caught", s.caught]]}
      step={(s, dt, input, api) => {
        s.time -= dt;
        if (input.keys.has("ArrowLeft") || input.keys.has("a")) s.bx -= 265 * dt;
        if (input.keys.has("ArrowRight") || input.keys.has("d")) s.bx += 265 * dt;
        s.bx += clamp(input.px - s.bx, -300 * dt, 300 * dt);
        s.bx = clamp(s.bx, 30, W - 30);
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = Math.max(0.34, 0.8 - (75 - s.time) * 0.006);
          const r = Math.random();
          s.items.push({
            x: rand(20, W - 20), y: -20, vy: rand(120, 185) + (75 - s.time) * 1.1,
            kind: r < 0.1 ? "💣" : r < 0.2 ? "🌟" : CATCHABLE[randi(0, CATCHABLE.length - 1)]!,
          });
        }
        for (const it of s.items) {
          it.y += it.vy * dt;
          if (it.y > 316 && it.y < 336 && Math.abs(it.x - s.bx) < 36) {
            it.y = 9999;
            if (it.kind === "💣") {
              s.lives -= 1; api.beep(90, 0.25, "sawtooth");
            } else {
              s.score += it.kind === "🌟" ? 25 : 5;
              s.caught += 1;
              api.beep(760, 0.05);
            }
            if (s.lives <= 0) { api.end(false); return; }
          } else if (it.y > H + 16) {
            it.y = 9999;
            if (it.kind !== "💣") {
              s.lives -= 1;
              api.beep(150, 0.12, "sawtooth");
              if (s.lives <= 0) { api.end(false); return; }
            }
          }
        }
        s.items = s.items.filter((it) => it.y < 9000);
        if (s.time <= 0) api.end(s.score >= 150);
      }}
      draw={(ctx, s) => {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#bae6fd"); grad.addColorStop(1, "#fef9c3");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#65a30d"; ctx.fillRect(0, 336, W, 24);
        ctx.font = "24px serif"; ctx.textAlign = "center";
        for (const it of s.items) ctx.fillText(it.kind, it.x, it.y + 8);
        ctx.font = "38px serif";
        ctx.fillText("🧺", s.bx, 340);
        ctx.textAlign = "left";
      }}
    />
  );
}

export const GAMES3B: Record<string, ComponentType> = {
  "pong-classic": PongGame,
  "mole-mania": MoleGame,
  "stack-tower": StackGame,
  "pinball-mini": PinballGame,
  "sky-bounce": SkyBounceGame,
  "road-hopper": RoadHopperGame,
  "fruit-catch": FruitCatchGame,
};

/* --------------------------------------------------------- Penalty Shootout */
type PenState = {
  score: number; over?: boolean; won?: boolean;
  round: number; youGoals: number; aiGoals: number;
  mode: "aim" | "save" | "result";
  aimX: number; aimY: number; aimDir: number; ballAnim: number;
  keeperDive: number; aiTarget: number; message: string; chosenSave: number;
};
function PenaltyGame() {
  return (
    <Engine<PenState>
      id="penalty-shootout" label="Penalty Shootout"
      blurb="Five kicks each, winner takes the cup. Place your shots where the keeper isn't — then guard your own goal with a tap."
      create={() => ({ score: 0, round: 1, youGoals: 0, aiGoals: 0, mode: "aim", aimX: 240, aimY: 120, aimDir: 1, ballAnim: -1, keeperDive: 0, aiTarget: 0, message: "Pick your spot — click the goal to shoot!", chosenSave: -1 })}
      hud={(s) => [["You", s.youGoals], ["CPU", s.aiGoals], ["Kick", `${Math.min(5, s.round)}/5`], ["Score", s.score]]}
      onTap={(s, x, y, api) => {
        if (s.mode === "aim" && s.ballAnim < 0) {
          s.aimX = clamp(x, 92, 388); s.aimY = clamp(y, 62, 178);
          s.keeperDive = [110, 240, 370][randi(0, 2)]!;
          s.ballAnim = 0;
          api.beep(300, 0.08);
        } else if (s.mode === "save" && s.ballAnim < 0) {
          s.chosenSave = x < 173 ? 0 : x > 307 ? 2 : 1;
          s.aiTarget = randi(0, 2);
          s.ballAnim = 0;
          api.beep(300, 0.08);
        } else if (s.mode === "result") {
          if (s.round > 5) { api.end(s.youGoals > s.aiGoals); return; }
          s.mode = "aim";
          s.ballAnim = -1;
          s.message = "Pick your spot — click the goal to shoot!";
        }
      }}
      step={(s, dt, _input, api) => {
        if (s.ballAnim >= 0) {
          s.ballAnim += dt * 2.4;
          if (s.ballAnim >= 1) {
            s.ballAnim = -1;
            if (s.mode === "aim") {
              const saved = Math.abs(s.aimX - s.keeperDive) < 52 && s.aimY > 70;
              if (saved) {
                s.message = "Saved! The keeper read it. Now defend your goal — tap left, center or right.";
                api.beep(140, 0.18, "sawtooth");
              } else {
                s.youGoals += 1; s.score += 50;
                s.message = "GOAL! Beautifully placed. Now defend — tap where you'll dive.";
                api.beep(700, 0.14, "triangle");
              }
              s.mode = "save";
            } else if (s.mode === "save") {
              const aiScores = s.aiTarget !== s.chosenSave;
              if (aiScores) { s.aiGoals += 1; s.message = "They scored. Tap to continue."; api.beep(140, 0.15, "sawtooth"); }
              else { s.score += 30; s.message = "You saved it! Tap to continue."; api.beep(700, 0.12, "triangle"); }
              s.round += 1;
              s.mode = "result";
              if (s.round > 5) s.message = s.youGoals > s.aiGoals ? "🏆 You win the shootout! Tap for the result." : s.youGoals === s.aiGoals ? "A draw — tap for the result." : "The cup slips away — tap for the result.";
            }
          }
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#16a34a"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#15803d";
        for (let i = 0; i < 6; i++) ctx.fillRect(i * 80, 0, 40, H);
        // Goal
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 5;
        ctx.strokeRect(84, 54, 312, 132);
        ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
        for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(84 + i * 52, 54); ctx.lineTo(84 + i * 52, 186); ctx.stroke(); }
        for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(84, 54 + i * 44); ctx.lineTo(396, 54 + i * 44); ctx.stroke(); }
        ctx.font = "40px serif"; ctx.textAlign = "center";
        if (s.mode === "aim") {
          const kx = s.ballAnim >= 0 ? s.keeperDive : 240;
          ctx.fillText("🧍", kx, 150);
          if (s.ballAnim < 0) {
            ctx.strokeStyle = "#facc15"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(s.aimX, s.aimY, 13, 0, 7); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(s.aimX - 18, s.aimY); ctx.lineTo(s.aimX + 18, s.aimY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(s.aimX, s.aimY - 18); ctx.lineTo(s.aimX, s.aimY + 18); ctx.stroke();
          }
          const t = s.ballAnim < 0 ? 0 : s.ballAnim;
          const bx = 240 + (s.aimX - 240) * t;
          const by = 300 - (300 - s.aimY) * t;
          ctx.font = `${Math.round(34 - t * 12)}px serif`;
          ctx.fillText("⚽", bx, by);
        } else {
          ctx.fillText("🧍", s.ballAnim >= 0 ? [110, 240, 370][s.chosenSave]! : 240, 150);
          if (s.ballAnim >= 0) {
            const tx = [110, 240, 370][s.aiTarget]!;
            const t = s.ballAnim;
            ctx.font = `${Math.round(34 - t * 12)}px serif`;
            ctx.fillText("⚽", 240 + (tx - 240) * t, 300 - 190 * t);
          } else {
            ctx.font = "34px serif"; ctx.fillText("⚽", 240, 300);
            ctx.fillStyle = "rgba(15,23,42,0.55)"; ctx.fillRect(64, 210, 110, 34); ctx.fillRect(196, 210, 88, 34); ctx.fillRect(306, 210, 110, 34);
            ctx.fillStyle = "#fff"; ctx.font = "bold 15px system-ui";
            ctx.fillText("◀ Dive left", 119, 232); ctx.fillText("Stay 🧍", 240, 232); ctx.fillText("Dive right ▶", 361, 232);
          }
        }
        ctx.fillStyle = "rgba(15,23,42,0.72)"; ctx.fillRect(30, 316, 420, 30);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12.5px system-ui";
        ctx.fillText(s.message, W / 2, 336);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* -------------------------------------------------------------- Hoop Shots */
type HoopState = {
  score: number; over?: boolean; won?: boolean;
  time: number; makes: number; attempts: number;
  hoopX: number; hoopDir: number;
  ball: { x: number; y: number; vx: number; vy: number; live: boolean } | null;
  drag: { x: number; y: number } | null;
};
function HoopGame() {
  return (
    <Engine<HoopState>
      id="hoop-shots" label="Hoop Shots"
      blurb="Drag back and release to shoot! Sixty seconds, unlimited balls — and after ten makes the hoop starts sliding."
      create={() => ({ score: 0, time: 60, makes: 0, attempts: 0, hoopX: 330, hoopDir: 1, ball: null, drag: null })}
      hud={(s) => [["Score", s.score], ["Makes", `${s.makes}/${s.attempts}`], ["Time", `${Math.max(0, Math.ceil(s.time))}s`]]}
      onTap={(s, x, y) => {
        if (!s.ball) s.drag = { x, y };
      }}
      onDrag={(s, x, y) => {
        if (s.drag && !s.ball) s.drag = { x, y };
      }}
      step={(s, dt, input, api) => {
        s.time -= dt;
        if (s.time <= 0) { api.end(s.makes >= 8); return; }
        if (s.makes >= 10) {
          s.hoopX += s.hoopDir * 46 * dt;
          if (s.hoopX > 400 || s.hoopX < 250) s.hoopDir *= -1;
        }
        if (!input.pdown && s.drag && !s.ball) {
          const dx = 90 - s.drag.x;
          const dy = 296 - s.drag.y;
          s.ball = { x: 90, y: 296, vx: clamp(dx * 2.6, -60, 560), vy: clamp(dy * 2.6, -560, 60), live: true };
          s.attempts += 1;
          s.drag = null;
          api.beep(420, 0.06);
        }
        const b = s.ball;
        if (b) {
          b.vy += 640 * dt;
          b.x += b.vx * dt; b.y += b.vy * dt;
          // Backboard + rim physics (simple).
          if (b.x > s.hoopX + 26 && b.x < s.hoopX + 34 && b.y > 96 && b.y < 150 && b.vx > 0) b.vx = -Math.abs(b.vx) * 0.6;
          const rimY = 128;
          if (b.vy > 0 && Math.abs(b.y - rimY) < 7 && b.x > s.hoopX - 4 && b.x < s.hoopX + 24) {
            s.makes += 1;
            s.score += b.x > s.hoopX + 4 && b.x < s.hoopX + 16 ? 3 : 2;
            s.ball = null;
            api.beep(760, 0.12, "triangle");
          } else if (b.y > H + 16 || b.x > W + 16) {
            s.ball = null;
            api.beep(180, 0.08);
          }
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#1e3a8a"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#f97316"; ctx.fillRect(0, 322, W, 38);
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 322); ctx.lineTo(W, 322); ctx.stroke();
        // Hoop
        ctx.fillStyle = "#f8fafc"; ctx.fillRect(s.hoopX + 24, 92, 8, 42);
        ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(s.hoopX - 6, 128); ctx.lineTo(s.hoopX + 26, 128); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(s.hoopX - 4, 128); ctx.lineTo(s.hoopX + 4, 148); ctx.lineTo(s.hoopX + 16, 148); ctx.lineTo(s.hoopX + 24, 128); ctx.stroke();
        ctx.font = "30px serif"; ctx.textAlign = "center";
        if (s.ball) ctx.fillText("🏀", s.ball.x, s.ball.y + 10);
        else {
          ctx.fillText("🏀", 90, 306);
          if (s.drag) {
            ctx.strokeStyle = "#facc15"; ctx.setLineDash([5, 5]); ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(90, 296); ctx.lineTo(90 + (90 - s.drag.x), 296 + (296 - s.drag.y)); ctx.stroke();
            ctx.setLineDash([]);
          } else {
            ctx.fillStyle = "#fff"; ctx.font = "bold 13px system-ui";
            ctx.fillText("Drag back from the ball and release to shoot!", 240, 352);
          }
        }
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ----------------------------------------------------------- Bowling Alley */
type BowlState = {
  score: number; over?: boolean; won?: boolean;
  frame: number; throwInFrame: number; pins: { x: number; y: number; vx: number; vy: number; down: boolean }[];
  ball: { x: number; y: number; vx: number; vy: number; live: boolean } | null;
  phase2: "aim" | "power" | "roll" | "settle";
  aimX: number; power: number; powerDir: number; message: string; framePins: number; settleT: number;
};
function pinLayout(): BowlState["pins"] {
  const pins: BowlState["pins"] = [];
  const rows = [1, 2, 3, 4];
  rows.forEach((count, r) => {
    for (let i = 0; i < count; i++) {
      pins.push({ x: 240 + (i - (count - 1) / 2) * 26, y: 44 + r * 24, vx: 0, vy: 0, down: false });
    }
  });
  return pins;
}
function BowlingGame() {
  return (
    <Engine<BowlState>
      id="bowling-alley" label="Bowling Alley"
      blurb="Five frames, two throws each. Set your line, stop the power meter in the zone and watch the pins fly — strikes pay double."
      create={() => ({ score: 0, frame: 1, throwInFrame: 1, pins: pinLayout(), ball: null, phase2: "aim", aimX: 240, power: 0, powerDir: 1, message: "Move to aim, click to lock your line.", framePins: 0, settleT: 0 })}
      hud={(s) => [["Score", s.score], ["Frame", `${s.frame}/5`], ["Throw", `${s.throwInFrame}/2`], ["Pins up", s.pins.filter((p) => !p.down).length]]}
      onTap={(s, _x, _y, api) => {
        if (s.phase2 === "aim") {
          s.phase2 = "power";
          s.power = 0; s.powerDir = 1;
          s.message = "Click again to stop the power meter!";
        } else if (s.phase2 === "power") {
          s.phase2 = "roll";
          const drift = (s.aimX - 240) * 0.14;
          s.ball = { x: s.aimX, y: 330, vx: drift, vy: -(190 + s.power * 3.1), live: true };
          s.message = "Here it goes…";
          api.beep(300, 0.1);
        }
      }}
      step={(s, dt, input, api) => {
        if (s.phase2 === "aim") {
          s.aimX = clamp(input.px, 90, 390);
        }
        if (s.phase2 === "power") {
          s.power += s.powerDir * 95 * dt;
          if (s.power > 100) { s.power = 100; s.powerDir = -1; }
          if (s.power < 0) { s.power = 0; s.powerDir = 1; }
        }
        const b = s.ball;
        if (s.phase2 === "roll" && b) {
          b.x += b.vx * dt; b.y += b.vy * dt;
          b.vx *= Math.pow(0.4, dt);
          if (b.x < 92) { b.x = 92; b.vx = Math.abs(b.vx) * 0.5; }
          if (b.x > 388) { b.x = 388; b.vx = -Math.abs(b.vx) * 0.5; }
          for (const p of s.pins) {
            if (!p.down && Math.hypot(b.x - p.x, b.y - p.y) < 17) {
              p.down = true; p.vx = b.vx + rand(-30, 30); p.vy = b.vy * 0.4;
              api.beep(200, 0.05);
            }
          }
          for (const p of s.pins) {
            if (!p.down) continue;
            p.x += p.vx * dt; p.y += p.vy * dt;
            for (const q of s.pins) {
              if (!q.down && Math.hypot(p.x - q.x, p.y - q.y) < 15) {
                q.down = true; q.vx = p.vx * 0.8 + rand(-16, 16); q.vy = p.vy * 0.8;
              }
            }
          }
          if (b.y < 20 || Math.abs(b.vy) < 12) {
            s.phase2 = "settle"; s.settleT = 0.7; s.ball = null;
          }
        }
        if (s.phase2 === "settle") {
          s.settleT -= dt;
          if (s.settleT <= 0) {
            const down = s.pins.filter((p) => p.down).length;
            const gained = down - s.framePins;
            let pts = gained;
            if (s.throwInFrame === 1 && down === 10) pts = 20;
            s.score += pts;
            s.framePins = down;
            api.beep(560, 0.1, "triangle");
            if (down === 10 || s.throwInFrame === 2) {
              if (s.frame >= 5) { api.end(s.score >= 45); return; }
              s.frame += 1; s.throwInFrame = 1; s.framePins = 0;
              s.pins = pinLayout();
              s.message = `Frame ${s.frame}: fresh rack! Move to aim, click to lock.`;
            } else {
              s.throwInFrame = 2;
              s.pins = s.pins.filter((p) => !p.down);
              s.message = `${gained} down — pick up the spare!`;
            }
            s.phase2 = "aim";
          }
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#78350f"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#d6a860"; ctx.fillRect(96, 0, 288, H);
        ctx.fillStyle = "#b45309"; ctx.fillRect(96, 0, 10, H); ctx.fillRect(374, 0, 10, H);
        ctx.strokeStyle = "rgba(120,53,15,0.4)";
        for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(96 + i * 48, 0); ctx.lineTo(96 + i * 48, H); ctx.stroke(); }
        ctx.font = "17px serif"; ctx.textAlign = "center";
        for (const p of s.pins) {
          if (p.down) {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(1.4); ctx.globalAlpha = 0.75;
            ctx.fillText("🎳", 0, 6); ctx.restore(); ctx.globalAlpha = 1;
          } else ctx.fillText("🎳", p.x, p.y + 6);
        }
        if (s.ball) {
          ctx.fillStyle = "#1e3a8a";
          ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, 13, 0, 7); ctx.fill();
          ctx.fillStyle = "#93c5fd";
          ctx.beginPath(); ctx.arc(s.ball.x - 4, s.ball.y - 4, 3, 0, 7); ctx.fill();
        }
        if (s.phase2 === "aim" || s.phase2 === "power") {
          ctx.fillStyle = "#111827";
          ctx.beginPath(); ctx.arc(s.aimX, 330, 13, 0, 7); ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.65)"; ctx.setLineDash([5, 6]); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(s.aimX, 318); ctx.lineTo(s.aimX + (s.aimX - 240) * 0.14 * 2, 190); ctx.stroke();
          ctx.setLineDash([]);
        }
        if (s.phase2 === "power") {
          ctx.fillStyle = "#111827"; ctx.fillRect(140, 8, 200, 16);
          ctx.fillStyle = s.power > 55 && s.power < 85 ? "#22c55e" : "#f59e0b";
          ctx.fillRect(142, 10, 196 * (s.power / 100), 12);
          ctx.fillStyle = "rgba(34,197,94,0.45)"; ctx.fillRect(140 + 200 * 0.55, 6, 200 * 0.3, 20);
        }
        ctx.fillStyle = "rgba(15,23,42,0.75)"; ctx.fillRect(40, 332, 400, 24);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12.5px system-ui";
        ctx.fillText(s.message, W / 2, 348);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ---------------------------------------------------------------- Mini Golf */
type GolfHole = { ball: { x: number; y: number }; cup: { x: number; y: number }; walls: { x: number; y: number; w: number; h: number }[]; par: number };
type GolfState = {
  score: number; over?: boolean; won?: boolean;
  hole: number; strokes: number; totalStrokes: number; totalPar: number;
  ball: { x: number; y: number; vx: number; vy: number };
  drag: { x: number; y: number } | null; message: string; holed: boolean; holeT: number;
};
const HOLES: GolfHole[] = [
  { ball: { x: 70, y: 180 }, cup: { x: 400, y: 180 }, walls: [{ x: 220, y: 90, w: 16, h: 110 }], par: 2 },
  { ball: { x: 60, y: 290 }, cup: { x: 410, y: 70 }, walls: [{ x: 150, y: 150, w: 180, h: 16 }, { x: 300, y: 60, w: 16, h: 120 }], par: 3 },
  { ball: { x: 240, y: 320 }, cup: { x: 240, y: 46 }, walls: [{ x: 60, y: 170, w: 130, h: 16 }, { x: 290, y: 170, w: 130, h: 16 }], par: 2 },
  { ball: { x: 50, y: 60 }, cup: { x: 420, y: 300 }, walls: [{ x: 110, y: 110, w: 16, h: 140 }, { x: 230, y: 0, w: 16, h: 130 }, { x: 340, y: 160, w: 16, h: 140 }], par: 3 },
  { ball: { x: 240, y: 300 }, cup: { x: 240, y: 180 }, walls: [{ x: 190, y: 130, w: 100, h: 14 }, { x: 150, y: 230, w: 60, h: 14 }, { x: 270, y: 230, w: 60, h: 14 }], par: 2 },
  { ball: { x: 46, y: 180 }, cup: { x: 434, y: 180 }, walls: [{ x: 150, y: 60, w: 16, h: 130 }, { x: 314, y: 170, w: 16, h: 130 }, { x: 232, y: 140, w: 16, h: 80 }], par: 3 },
];
function GolfGame() {
  const startHole = (n: number) => {
    const h = HOLES[n - 1]!;
    return { ball: { x: h.ball.x, y: h.ball.y, vx: 0, vy: 0 }, strokes: 0, holed: false, holeT: 0 };
  };
  return (
    <Engine<GolfState>
      id="mini-golf" label="Mini Golf Masters"
      blurb="Six holes of banks and bounces. Drag back from the ball to aim, release to putt — finish under par to win the green jacket."
      create={() => ({ score: 0, hole: 1, totalStrokes: 0, totalPar: HOLES.reduce((a, h) => a + h.par, 0), drag: null, message: "Drag back from the ball and release to putt.", ...startHole(1) })}
      hud={(s) => [["Hole", `${s.hole}/6`], ["Par", HOLES[s.hole - 1]!.par], ["Strokes (hole)", s.strokes], ["Total vs par", s.totalStrokes === 0 && s.hole === 1 ? "E" : `${s.totalStrokes - HOLES.slice(0, s.hole - 1).reduce((a, h) => a + h.par, 0) > 0 ? "+" : ""}${s.totalStrokes - HOLES.slice(0, s.hole - 1).reduce((a, h) => a + h.par, 0)}`]]}
      onTap={(s, x, y) => {
        if (Math.hypot(s.ball.vx, s.ball.vy) < 4 && !s.holed) s.drag = { x, y };
      }}
      onDrag={(s, x, y) => {
        if (s.drag) s.drag = { x, y };
      }}
      step={(s, dt, input, api) => {
        const b = s.ball;
        const holeDef = HOLES[s.hole - 1]!;
        if (!input.pdown && s.drag) {
          const dx = b.x - s.drag.x;
          const dy = b.y - s.drag.y;
          const power = Math.min(1, Math.hypot(dx, dy) / 130);
          if (power > 0.06) {
            const a = Math.atan2(dy, dx);
            b.vx = Math.cos(a) * power * 430;
            b.vy = Math.sin(a) * power * 430;
            s.strokes += 1;
            api.beep(360, 0.05);
          }
          s.drag = null;
        }
        if (Math.hypot(b.vx, b.vy) > 0) {
          b.x += b.vx * dt; b.y += b.vy * dt;
          b.vx *= Math.pow(0.28, dt); b.vy *= Math.pow(0.28, dt);
          if (Math.hypot(b.vx, b.vy) < 7) { b.vx = 0; b.vy = 0; }
          if (b.x < 22) { b.x = 22; b.vx = Math.abs(b.vx); api.beep(240, 0.04); }
          if (b.x > W - 22) { b.x = W - 22; b.vx = -Math.abs(b.vx); api.beep(240, 0.04); }
          if (b.y < 22) { b.y = 22; b.vy = Math.abs(b.vy); api.beep(240, 0.04); }
          if (b.y > H - 22) { b.y = H - 22; b.vy = -Math.abs(b.vy); api.beep(240, 0.04); }
          for (const w of holeDef.walls) {
            if (b.x > w.x - 8 && b.x < w.x + w.w + 8 && b.y > w.y - 8 && b.y < w.y + w.h + 8) {
              const left = Math.abs(b.x - (w.x - 8));
              const right = Math.abs(b.x - (w.x + w.w + 8));
              const top = Math.abs(b.y - (w.y - 8));
              const bot = Math.abs(b.y - (w.y + w.h + 8));
              const m = Math.min(left, right, top, bot);
              if (m === left) { b.x = w.x - 8; b.vx = -Math.abs(b.vx); }
              else if (m === right) { b.x = w.x + w.w + 8; b.vx = Math.abs(b.vx); }
              else if (m === top) { b.y = w.y - 8; b.vy = -Math.abs(b.vy); }
              else { b.y = w.y + w.h + 8; b.vy = Math.abs(b.vy); }
              api.beep(240, 0.04);
            }
          }
          const dc = Math.hypot(b.x - holeDef.cup.x, b.y - holeDef.cup.y);
          if (dc < 11 && Math.hypot(b.vx, b.vy) < 190) {
            s.holed = true; s.holeT = 1.1;
            b.vx = 0; b.vy = 0; b.x = holeDef.cup.x; b.y = holeDef.cup.y;
            const diff = holeDef.par - s.strokes;
            s.score += Math.max(10, 50 + diff * 20);
            s.message = diff > 0 ? `⛳ Under par! ${s.strokes} on a par ${holeDef.par}.` : diff === 0 ? `⛳ Par! Nicely done.` : `⛳ Holed in ${s.strokes} (par ${holeDef.par}).`;
            api.beep(720, 0.14, "triangle");
          }
        }
        if (s.holed) {
          s.holeT -= dt;
          if (s.holeT <= 0) {
            s.totalStrokes += s.strokes;
            if (s.hole >= 6) { api.end(s.totalStrokes <= s.totalPar); return; }
            s.hole += 1;
            Object.assign(s, startHole(s.hole));
            s.message = `Hole ${s.hole} — par ${HOLES[s.hole - 1]!.par}.`;
          }
        }
      }}
      draw={(ctx, s) => {
        const holeDef = HOLES[s.hole - 1]!;
        ctx.fillStyle = "#15803d"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#16a34a"; ctx.fillRect(14, 14, W - 28, H - 28);
        ctx.fillStyle = "#854d0e";
        for (const w of holeDef.walls) ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = "#111827";
        ctx.beginPath(); ctx.arc(holeDef.cup.x, holeDef.cup.y, 10, 0, 7); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(holeDef.cup.x, holeDef.cup.y); ctx.lineTo(holeDef.cup.x, holeDef.cup.y - 24); ctx.stroke();
        ctx.fillStyle = "#ef4444";
        ctx.beginPath(); ctx.moveTo(holeDef.cup.x, holeDef.cup.y - 24); ctx.lineTo(holeDef.cup.x + 13, holeDef.cup.y - 19); ctx.lineTo(holeDef.cup.x, holeDef.cup.y - 14); ctx.fill();
        if (s.drag) {
          ctx.strokeStyle = "#facc15"; ctx.setLineDash([5, 5]); ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(s.ball.x, s.ball.y);
          ctx.lineTo(s.ball.x + (s.ball.x - s.drag.x), s.ball.y + (s.ball.y - s.drag.y));
          ctx.stroke(); ctx.setLineDash([]);
        }
        if (!s.holed) {
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, 8, 0, 7); ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.fillStyle = "rgba(15,23,42,0.72)"; ctx.fillRect(50, 330, 380, 24);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12.5px system-ui"; ctx.textAlign = "center";
        ctx.fillText(s.message, W / 2, 346);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* -------------------------------------------------------------- Tennis Ace */
type TennisState = {
  score: number; over?: boolean; won?: boolean;
  px: number; py: number; ax: number;
  bx: number; by: number; vx: number; vy: number; toward: boolean; aiScore: number; serveT: number; swingCd: number;
};
function TennisGame() {
  return (
    <Engine<TennisState>
      id="tennis-ace" label="Tennis Ace"
      blurb="Rally against the CPU pro: run to the ball and swing with a tap — where you strike decides the angle. First to five games-points."
      create={() => ({ score: 0, px: W / 2, py: 300, ax: W / 2, bx: W / 2, by: 60, vx: 60, vy: 170, toward: true, aiScore: 0, serveT: 0.8, swingCd: 0 })}
      hud={(s) => [["You", s.score], ["CPU", s.aiScore], ["First to", 5]]}
      step={(s, dt, input, api) => {
        if (input.keys.has("ArrowLeft") || input.keys.has("a")) s.px -= 215 * dt;
        if (input.keys.has("ArrowRight") || input.keys.has("d")) s.px += 215 * dt;
        if (input.keys.has("ArrowUp") || input.keys.has("w")) s.py -= 160 * dt;
        if (input.keys.has("ArrowDown") || input.keys.has("s")) s.py += 160 * dt;
        s.px = clamp(s.px, 44, W - 44);
        s.py = clamp(s.py, 196, 336);
        if (input.pdown) {
          s.px += clamp(input.px - s.px, -240 * dt, 240 * dt);
          s.py += clamp(input.py - s.py, -200 * dt, 200 * dt);
          s.py = clamp(s.py, 196, 336);
        }
        const aiSp = 150 + s.score * 9;
        s.ax += clamp(s.bx - s.ax, -aiSp * dt, aiSp * dt);
        s.ax = clamp(s.ax, 44, W - 44);
        s.swingCd -= dt;
        if (s.serveT > 0) { s.serveT -= dt; return; }
        s.bx += s.vx * dt; s.by += s.vy * dt;
        if (s.bx < 34) { s.bx = 34; s.vx = Math.abs(s.vx); }
        if (s.bx > W - 34) { s.bx = W - 34; s.vx = -Math.abs(s.vx); }
        // AI returns
        if (s.vy < 0 && s.by < 66 && Math.abs(s.bx - s.ax) < 34) {
          s.vy = Math.abs(s.vy) * 1.03 + 8;
          s.vx = clamp((s.bx - s.ax) * 3.2 + rand(-40, 40), -210, 210);
          s.by = 66;
          api.beep(640, 0.05);
        }
        // Player returns the ball by being in position when it arrives;
        // the offset between ball and racket decides the return angle.
        if (s.vy > 0 && s.by > s.py - 26 && s.by < s.py + 16 && Math.abs(s.bx - s.px) < 36 && s.swingCd <= 0) {
          s.vy = -(Math.abs(s.vy) * 1.03 + 10);
          s.vx = clamp((s.bx - s.px) * 4.4, -250, 250);
          s.swingCd = 0.25;
          api.beep(700, 0.05);
        }
        if (s.by < 18) {
          s.score += 1; api.beep(620, 0.12, "triangle");
          s.bx = W / 2; s.by = 300; s.vx = 40; s.vy = -180; s.serveT = 0.8;
          if (s.score >= 5) { api.end(true); return; }
        }
        if (s.by > H - 8) {
          s.aiScore += 1; api.beep(140, 0.16, "sawtooth");
          s.bx = W / 2; s.by = 60; s.vx = -40; s.vy = 180; s.serveT = 0.8;
          if (s.aiScore >= 5) { api.end(false); return; }
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#2563eb"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#1d4ed8"; ctx.fillRect(30, 24, W - 60, H - 48);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
        ctx.strokeRect(30, 24, W - 60, H - 48);
        ctx.beginPath(); ctx.moveTo(30, H / 2); ctx.lineTo(W - 30, H / 2); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(30, H / 2); ctx.lineTo(W - 30, H / 2); ctx.stroke();
        ctx.font = "28px serif"; ctx.textAlign = "center";
        ctx.fillText("🎾", s.ax, 52);
        ctx.fillText("🏸", s.px, s.py + 10);
        ctx.fillStyle = "#d9f99d";
        ctx.beginPath(); ctx.arc(s.bx, s.by, 7, 0, 7); ctx.fill();
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ----------------------------------------------------------- Archery Master */
type ArchState = {
  score: number; over?: boolean; won?: boolean;
  arrows: number; wind: number; aimX: number; aimY: number; t: number;
  shots: { x: number; y: number; pts: number }[];
  flying: { x: number; y: number; tx: number; ty: number; p: number } | null;
  message: string;
};
function ArcheryGame() {
  return (
    <Engine<ArchState>
      id="archery-master" label="Archery Master"
      blurb="Ten arrows, a wandering hand and a fickle wind. Read the banner, steady your aim and click to loose — gold is 10 points."
      create={() => ({ score: 0, arrows: 10, wind: randi(-3, 3), aimX: 0, aimY: 0, t: 0, shots: [], flying: null, message: "Click the target to loose an arrow." })}
      hud={(s) => [["Score", s.score], ["Arrows", s.arrows], ["Wind", s.wind === 0 ? "Calm" : s.wind > 0 ? `${"→".repeat(s.wind)} ${s.wind}` : `${"←".repeat(-s.wind)} ${-s.wind}`]]}
      onTap={(s, x, y, api) => {
        if (s.flying || s.arrows <= 0) return;
        s.arrows -= 1;
        s.flying = { x: 70, y: 300, tx: x + s.wind * 7, ty: y, p: 0 };
        api.beep(340, 0.07, "triangle");
      }}
      step={(s, dt, _input, api) => {
        s.t += dt;
        s.aimX = Math.sin(s.t * 1.7) * 7 + Math.sin(s.t * 4.3) * 3;
        s.aimY = Math.cos(s.t * 2.3) * 6;
        const f = s.flying;
        if (f) {
          f.p += dt * 3.4;
          f.x = 70 + (f.tx - 70) * f.p;
          f.y = 300 + (f.ty - 300) * f.p - Math.sin(f.p * Math.PI) * 26;
          if (f.p >= 1) {
            const d = Math.hypot(f.tx - 330, f.ty - 150);
            const pts = d < 13 ? 10 : d < 30 ? 8 : d < 50 ? 6 : d < 72 ? 4 : d < 96 ? 2 : 0;
            s.score += pts;
            s.shots.push({ x: f.tx, y: f.ty, pts });
            s.message = pts === 10 ? "🎯 GOLD! Perfect shot." : pts >= 6 ? `Great — ${pts} points.` : pts > 0 ? `${pts} points on the board.` : "Missed the target entirely!";
            s.wind = randi(-3, 3);
            s.flying = null;
            api.beep(pts >= 8 ? 760 : 300, 0.09, pts >= 8 ? "triangle" : "square");
            if (s.arrows <= 0) { api.end(s.score >= 55); return; }
          }
        }
      }}
      draw={(ctx, s, phase) => {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#7dd3fc"); grad.addColorStop(1, "#dcfce7");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#65a30d"; ctx.fillRect(0, 308, W, 52);
        // Target rings
        const rings: [number, string][] = [[96, "#f8fafc"], [72, "#1f2937"], [50, "#2563eb"], [30, "#dc2626"], [13, "#facc15"]];
        for (const [r, col] of rings) {
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(330, 150, r, 0, 7); ctx.fill();
        }
        ctx.fillStyle = "#78350f"; ctx.fillRect(326, 246, 8, 62);
        for (const sh of s.shots) {
          ctx.fillStyle = "#111827";
          ctx.beginPath(); ctx.arc(sh.x, sh.y, 3.5, 0, 7); ctx.fill();
        }
        // Aim wobble indicator follows pointer offset by wobble — drawn at fixed anchor near target center of mass.
        if (phase === "playing" && !s.flying) {
          ctx.strokeStyle = "rgba(220,38,38,0.85)"; ctx.lineWidth = 2;
          const ax = 330 + s.aimX * 3, ay = 150 + s.aimY * 3;
          ctx.beginPath(); ctx.arc(ax, ay, 10, 0, 7); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ax - 15, ay); ctx.lineTo(ax + 15, ay); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ax, ay - 15); ctx.lineTo(ax, ay + 15); ctx.stroke();
        }
        if (s.flying) {
          ctx.strokeStyle = "#78350f"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(s.flying.x - 12, s.flying.y + 5); ctx.lineTo(s.flying.x + 10, s.flying.y - 4); ctx.stroke();
        }
        ctx.font = "30px serif"; ctx.textAlign = "center";
        ctx.fillText("🏹", 66, 312);
        ctx.fillStyle = "rgba(15,23,42,0.72)"; ctx.fillRect(90, 326, 340, 24);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12.5px system-ui";
        ctx.fillText(s.message, 260, 342);
        ctx.textAlign = "left";
      }}
    />
  );
}

/* ------------------------------------------------------------ Boxing Champ */
type BoxState = {
  score: number; over?: boolean; won?: boolean;
  youHp: number; foeHp: number; round: number; roundT: number;
  foeState: "guard" | "open" | "punch" | "hurt";
  stateT: number; youX: number; message: string; ko: boolean;
};
function BoxingGame() {
  return (
    <Engine<BoxState>
      id="boxing-champ" label="Boxing Champ"
      blurb="Three rounds for the belt! Dodge his hooks with ◀ ▶, and strike the instant his guard drops — combos build your score."
      create={() => ({ score: 0, youHp: 100, foeHp: 100, round: 1, roundT: 45, foeState: "guard", stateT: 1, youX: 0, message: "Watch his guard… strike when it drops!", ko: false })}
      hud={(s) => [["Your health", `${Math.max(0, Math.round(s.youHp))}%`], ["Foe health", `${Math.max(0, Math.round(s.foeHp))}%`], ["Round", `${s.round}/3`], ["Score", s.score]]}
      onKey={(s, key, api) => {
        if (key === "ArrowLeft" || key === "a") { s.youX = -1; api.beep(300, 0.04); }
        if (key === "ArrowRight" || key === "d") { s.youX = 1; api.beep(300, 0.04); }
        if (key === " " || key === "ArrowUp") punch(s, api);
      }}
      onTap={(s, x, _y, api) => {
        if (x < 120) { s.youX = -1; return; }
        if (x > W - 120) { s.youX = 1; return; }
        punch(s, api);
      }}
      step={(s, dt, _input, api) => {
        s.roundT -= dt;
        s.stateT -= dt;
        s.youX *= Math.pow(0.001, dt);
        if (s.stateT <= 0) {
          if (s.foeState === "guard") {
            s.foeState = Math.random() < 0.55 ? "open" : "punch";
            s.stateT = s.foeState === "open" ? rand(0.5, 0.9) : 0.42;
            if (s.foeState === "punch") api.beep(220, 0.08, "sawtooth");
          } else if (s.foeState === "punch") {
            // Punch resolves: hits unless you dodged to a side.
            if (Math.abs(s.youX) < 0.5) {
              s.youHp -= rand(6, 11);
              s.message = "Caught you! Dodge ◀ ▶ when he winds up.";
              api.beep(110, 0.16, "sawtooth");
              if (s.youHp <= 0) { api.end(false); return; }
            } else {
              s.message = "Slipped it! Counter now — his guard is down!";
              s.score += 10;
              s.foeState = "open"; s.stateT = 0.8;
              api.beep(500, 0.07);
            }
            if (s.foeState === "punch") { s.foeState = "guard"; s.stateT = rand(0.5, 1.1); }
          } else {
            s.foeState = "guard";
            s.stateT = rand(0.45, 1) * Math.max(0.45, 1 - s.round * 0.14);
          }
        }
        if (s.roundT <= 0) {
          if (s.round >= 3) {
            api.end(s.foeHp < s.youHp);
            return;
          }
          s.round += 1; s.roundT = 45;
          s.youHp = Math.min(100, s.youHp + 18);
          s.message = `Round ${s.round}! He's quicker now.`;
          api.beep(660, 0.12, "triangle");
        }
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#7f1d1d"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#991b1b"; ctx.fillRect(40, 60, W - 80, 240);
        ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 4; ctx.strokeRect(40, 60, W - 80, 240);
        ctx.strokeStyle = "#dc2626";
        for (const y of [92, 150, 208]) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W - 40, y); ctx.stroke(); }
        ctx.font = "74px serif"; ctx.textAlign = "center";
        const foeEmoji = s.foeState === "hurt" ? "😵" : s.foeState === "punch" ? "🥊" : s.foeState === "open" ? "😮" : "😐";
        ctx.fillText("🧑", W / 2, 168);
        ctx.font = "44px serif";
        ctx.fillText(foeEmoji === "🥊" ? "🥊" : "🥊", W / 2 - 52, 150);
        ctx.fillText("🥊", W / 2 + 52, 150);
        if (s.foeState === "open") {
          ctx.fillStyle = "#facc15"; ctx.font = "bold 19px system-ui";
          ctx.fillText("GUARD DOWN — PUNCH!", W / 2, 46);
        }
        if (s.foeState === "punch") {
          ctx.fillStyle = "#f87171"; ctx.font = "bold 19px system-ui";
          ctx.fillText("DODGE!", W / 2, 46);
        }
        ctx.font = "56px serif";
        ctx.fillText("🥊", W / 2 + s.youX * 60 - 40, 300);
        ctx.fillText("🥊", W / 2 + s.youX * 60 + 40, 300);
        ctx.fillStyle = "rgba(15,23,42,0.75)"; ctx.fillRect(40, 322, 400, 26);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12.5px system-ui";
        ctx.fillText(s.message, W / 2, 339);
        ctx.textAlign = "left";
      }}
    />
  );
}
function punch(s: BoxState, api: { beep: typeof import("./gamekit").beep; end: (won?: boolean) => void }) {
  if (s.foeState === "open" || s.foeState === "hurt") {
    const dmg = rand(5, 9);
    s.foeHp -= dmg;
    s.score += 15;
    s.foeState = "hurt";
    s.stateT = 0.3;
    api.beep(180, 0.09, "sawtooth");
    if (s.foeHp <= 0) {
      s.score += 150;
      s.message = "KNOCKOUT! 🏆";
      api.end(true);
    }
  } else if (s.foeState === "guard") {
    s.score = Math.max(0, s.score - 2);
    s.message = "Blocked! Wait for the guard to drop.";
    api.beep(240, 0.05);
  } else {
    s.message = "You punched into his hook — dodge first!";
    api.beep(200, 0.06);
  }
}

/* ---------------------------------------------------------------- Darts 301 */
type DartState = {
  score: number; over?: boolean; won?: boolean;
  remaining: number; turn: number; darts: number; turnStart: number;
  wander: number; shots: { x: number; y: number; pts: number }[];
  message: string; bust: boolean;
};
function dartScore(x: number, y: number): number {
  const d = Math.hypot(x - 240, y - 148);
  if (d < 10) return 50;
  if (d < 22) return 25;
  if (d > 108) return 0;
  const seg = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  let ang = Math.atan2(-(y - 148), x - 240);
  if (ang < 0) ang += Math.PI * 2;
  const idx = Math.floor(((ang + Math.PI / 20) % (Math.PI * 2)) / (Math.PI / 10)) % 20;
  const base = seg[idx]!;
  if (d > 96) return base * 2;
  if (d > 58 && d < 70) return base * 3;
  return base;
}
function DartsGame() {
  return (
    <Engine<DartState>
      id="darts-301" label="Darts 301"
      blurb="Countdown from 301 to exactly zero. Your hand wanders — click to throw, and beware: overshooting busts the whole turn!"
      create={() => ({ score: 0, remaining: 301, turn: 1, darts: 3, turnStart: 301, wander: 0, shots: [], message: "Click to throw a dart. Outer ring doubles, thin ring trebles.", bust: false })}
      hud={(s) => [["Remaining", s.remaining], ["Turn", `${s.turn}/12`], ["Darts", "🎯".repeat(s.darts)], ["Checkout pace", s.remaining <= 170 ? "In range!" : "—"]]}
      onTap={(s, _x, _y, api) => {
        // The dart lands at the wandering crosshair relative to board center.
        const lx = 240 + Math.sin(s.wander * 2.1) * 52 + Math.sin(s.wander * 5.7) * 14;
        const ly = 148 + Math.cos(s.wander * 1.7) * 46 + Math.cos(s.wander * 4.9) * 12;
        const pts = dartScore(lx, ly);
        s.darts -= 1;
        if (pts > s.remaining) {
          s.remaining = s.turnStart;
          s.darts = 0;
          s.message = `BUST! That ${pts} overshot — turn score wiped.`;
          api.beep(110, 0.2, "sawtooth");
        } else {
          s.remaining -= pts;
          s.shots.push({ x: lx, y: ly, pts });
          s.message = pts === 50 ? "BULLSEYE! 50 points." : pts === 0 ? "Off the board!" : `Scored ${pts}.`;
          api.beep(pts >= 40 ? 740 : 420, 0.06);
        }
        if (s.remaining === 0) {
          s.score = Math.max(50, 400 - s.turn * 25);
          api.end(true);
          return;
        }
        if (s.darts <= 0) {
          if (s.turn >= 12) { api.end(false); return; }
          s.turn += 1; s.darts = 3; s.turnStart = s.remaining;
          s.message += " New turn — 3 fresh darts.";
        }
      }}
      step={(s, dt) => {
        s.wander += dt;
      }}
      draw={(ctx, s) => {
        ctx.fillStyle = "#14532d"; ctx.fillRect(0, 0, W, H);
        const cx = 240, cy = 148;
        ctx.fillStyle = "#111827"; ctx.beginPath(); ctx.arc(cx, cy, 118, 0, 7); ctx.fill();
        const seg = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
        for (let i = 0; i < 20; i++) {
          const a0 = (i / 20) * Math.PI * 2 - Math.PI / 20;
          const a1 = ((i + 1) / 20) * Math.PI * 2 - Math.PI / 20;
          ctx.fillStyle = i % 2 ? "#f5f5f4" : "#1c1917";
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 108, -a1, -a0); ctx.fill();
          const am = (a0 + a1) / 2;
          ctx.fillStyle = i % 2 ? "#1c1917" : "#f5f5f4";
          ctx.font = "bold 11px system-ui"; ctx.textAlign = "center";
          ctx.fillText(String(seg[i]), cx + Math.cos(-am) * 100, cy + Math.sin(-am) * 100 + 4);
        }
        ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.arc(cx, cy, 70, 0, 7); ctx.globalAlpha = 0.28; ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = "#16a34a"; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, 7); ctx.fill();
        ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, 7); ctx.fill();
        for (const sh of s.shots) {
          ctx.fillStyle = "#facc15";
          ctx.beginPath(); ctx.arc(sh.x, sh.y, 4, 0, 7); ctx.fill();
          ctx.strokeStyle = "#facc15"; ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x - 7, sh.y - 9); ctx.stroke();
        }
        const lx = 240 + Math.sin(s.wander * 2.1) * 52 + Math.sin(s.wander * 5.7) * 14;
        const ly = 148 + Math.cos(s.wander * 1.7) * 46 + Math.cos(s.wander * 4.9) * 12;
        ctx.strokeStyle = "#f472b6"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(lx, ly, 12, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx - 17, ly); ctx.lineTo(lx + 17, ly); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx, ly - 17); ctx.lineTo(lx, ly + 17); ctx.stroke();
        ctx.fillStyle = "rgba(15,23,42,0.75)"; ctx.fillRect(30, 322, 420, 26);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui";
        ctx.fillText(s.message, W / 2, 339);
        ctx.textAlign = "left";
      }}
    />
  );
}

export const GAMES3C: Record<string, ComponentType> = {
  "penalty-shootout": PenaltyGame,
  "hoop-shots": HoopGame,
  "bowling-alley": BowlingGame,
  "mini-golf": GolfGame,
  "tennis-ace": TennisGame,
  "archery-master": ArcheryGame,
  "boxing-champ": BoxingGame,
  "darts-301": DartsGame,
};
