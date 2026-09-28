
const Daylight = (() => {
  const LOOKS = {
    morning: { multiply: "#FFF0D6", glow: "#FFD68A", glowAlpha: 0.12, floor: "#000000" },
    noon:    { multiply: "#FFFFFF", glow: "#FFFFFF", glowAlpha: 0, floor: "#000000" },
    sunset:  { multiply: "#FFD9C4", glow: "#FF8FA0", glowAlpha: 0.16, floor: "#000000" },
    night:   { multiply: "#5360A0", glow: "#FFFFFF", glowAlpha: 0, floor: "#1B2140" },
  };
  const INDOOR_NIGHT = { multiply: "#8C86B0", glow: "#FFD68A", glowAlpha: 0.05, floor: "#140F1C" };
  const RED_NIGHT = { multiply: "#B4889C", glow: "#FF8A86", glowAlpha: 0.08, floor: "#1C1222" };

  let from = "morning", to = "morning", t = 1, seconds = 3;

  function set(phase, glide = 3) {
    if (phase === to && t >= 1) return;
    from = t >= 1 ? to : (t < 0.5 ? from : to);
    to = phase;
    seconds = glide;
    t = glide > 0 ? 0 : 1;
  }

  function update(dt) {
    if (t < 1) t = Math.min(1, t + dt / seconds);
  }

  const lerpColor = (a, b, k) => mix(a, b, k);

  function look(indoors) {
    const pick = (p) => (indoors && p === "night" ? INDOOR_NIGHT : LOOKS[p]);
    const a = pick(from), b = pick(to), k = t * t * (3 - 2 * t);
    return {
      multiply: lerpColor(a.multiply, b.multiply, k),
      glow: lerpColor(a.glow, b.glow, k),
      glowAlpha: a.glowAlpha + (b.glowAlpha - a.glowAlpha) * k,
      floor: lerpColor(a.floor, b.floor, k),
    };
  }

  function nightAmount() {
    const n = (p) => (p === "night" ? 1 : p === "sunset" ? 0.15 : 0);
    const k = t * t * (3 - 2 * t);
    return n(from) + (n(to) - n(from)) * k;
  }

  function apply(ctx, x, y, w, h, indoors = false, force = null) {
    const L = force === "redNight" ? RED_NIGHT : force === "night" ? LOOKS.night : look(indoors);
    if (L.multiply.toLowerCase() !== "#ffffff") {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = L.multiply;
      ctx.fillRect(x, y, w, h);
    }
    if (L.glowAlpha > 0.001) {
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = L.glowAlpha;
      ctx.fillStyle = L.glow;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
    }
    if (L.floor !== "#000000") {
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = L.floor;
      ctx.fillRect(x, y, w, h);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  const glowCache = {};
  function glowSprite(r, color) {
    const key = `${r}/${color}`;
    if (glowCache[key]) return glowCache[key];
    const c = document.createElement("canvas");
    c.width = c.height = r * 2 + 1;
    const g = c.getContext("2d");
    const [cr, cg, cb] = hexToRgb(paletteColor(color));
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const d = Math.hypot(x - r, y - r) / r;
        if (d > 1) continue;
        const a = d < 0.35 ? 0.3 : d < 0.65 ? 0.18 : 0.08;
        g.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
        g.fillRect(x, y, 1, 1);
      }
    }
    return (glowCache[key] = c);
  }

  function drawLight(ctx, x, y, r, color = "starlight", amount = 1) {
    if (amount <= 0.01) return;
    ctx.globalAlpha = Math.min(1, amount);
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(glowSprite(r, color), Math.round(x - r), Math.round(y - r));
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  return { set, update, apply, drawLight, nightAmount, phase: () => to, settled: () => t >= 1 };
})();

const Fireflies = (() => {
  let flies = [];

  function spawn(world, view) {
    flies = [];
    const spots = world.things.filter((t) => ["flower", "bush", "berryBush", "reeds", "willow", "tallGrass"].includes(t.type) &&
      t.footX > view.x && t.footX < view.x + view.w && t.footY > view.y && t.footY < view.y + view.h + 10);
    for (let i = 0; i < 26 && spots.length; i++) {
      const t = spots[Math.floor(hash2(i, spots.length, 77) * spots.length)];
      flies.push({ home: { x: t.footX + (hash2(i, 1, 78) - 0.5) * 20, y: t.footY - 6 - hash2(i, 2, 79) * 14 }, phase: hash2(i, 3, 80) * 6.28, speed: 0.5 + hash2(i, 4, 81) * 0.7 });
    }
  }

  function update(dt, time, world, view) {
    const out = (f) => f.home.x < view.x - 10 || f.home.x > view.x + view.w + 10 || f.home.y < view.y - 10 || f.home.y > view.y + view.h + 10;
    if (!flies.length || flies.filter(out).length > flies.length / 2) spawn(world, view);
    for (const f of flies) {
      f.x = f.home.x + Math.sin(time * 0.5 * f.speed + f.phase) * 10;
      f.y = f.home.y + Math.sin(time * 0.37 * f.speed + f.phase * 2) * 5;
    }
  }

  function draw(ctx, time, amount) {
    if (amount < 0.3) return;
    for (const f of flies) {
      const glow = (Math.sin(time * 1.4 * f.speed + f.phase) + 1) / 2;
      if (glow < 0.2) continue;
      drawOne(ctx, f.x, f.y, glow, amount);
    }
  }

  function drawOne(ctx, fx, fy, glow, amount = 1) {
    Daylight.drawLight(ctx, fx, fy, 6, "firefly", glow * amount);
    const x = Math.round(fx), y = Math.round(fy);
    ctx.fillStyle = PALETTE.firefly;
    if (glow > 0.55) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    ctx.fillStyle = PALETTE.fireflyBright;
    ctx.fillRect(x, y, 1, 1);
  }

  function sprite(glow) {
    const c = document.createElement("canvas");
    c.width = c.height = 15;
    const g = c.getContext("2d");
    g.fillStyle = PALETTE.nightIndigo; g.fillRect(0, 0, 15, 15);
    drawOne(g, 7, 7, glow);
    return c;
  }

  return { update, draw, drawOne, sprite, reset: () => { flies = []; } };
})();
