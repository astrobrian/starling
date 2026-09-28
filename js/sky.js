
const Sky = (() => {
  const $ = (id) => document.getElementById(id);
  let tilt = 0, tiltGoal = 0, open = false, clock = 0, onClose = null;
  let dayMode = false;           // looking up by day: a blue sky with clouds
  let review = false;            // at the telescope: her whole sky, to look around
  let porch = false;             // each night, from the porch bench: the two of them sit together at the bottom
  let skyDay = 1;                // the night being shown (for the moon, and what's new on the bridge)
  let moonInfo = null;           // the night's moon (js/moon.js)
  let bridge = { birds: [], friends: [] };      // the bridge birds and the other friends so far: [{ species, day, name? }]
  let bridgeBorn = { birds: [], friends: [] };  // when each one's star comes out (-10: already out)
  let born = {};                 // word -> when its star comes out (-10: it's already out)
  let promise = [];              // words shown as faint dots even before she starts their constellation
  let labels = [];               // words by their stars: { word, from, until }
  let tour = [];                 // where the view glides: [{ id | x, at, secs }] (x: a pan, for the arrows)
  let tourEnd = 0;               // ...and when the nightly visit is over
  let pan = 0, panGoal = null;   // the view's left edge in the wide sky (sky pixels)
  let press = null;              // a finger on the sky: { id, x0, y0, pan0, moved }
  let whisperAt = 0, whisperI = 0, sparks = [], hideBubbleDone = false;
  let startOn = null;            // the constellation the view opens on
  const TILT_SECONDS = 1.6, SKY_W = 1480;
  const EDGE = 26;               // figures keep this far from the sky's ends (game pixels: clear of the notch)
  let L = null;                  // the layout, for this screen size

  function sample(paths, n, sw, sh) {
    const segs = paths.map((p) => {
      const pts = p.points.map(([x, y]) => [x * sw, y * sh]);
      if (p.loop) pts.push(pts[0]);
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      return { pts, len, loop: !!p.loop };
    });
    const total = segs.reduce((a, s) => a + s.len, 0) || 1, least = n >= segs.length ? 1 : 0;
    const counts = segs.map((s) => Math.max(least, Math.round((n * s.len) / total)));
    let diff = n - counts.reduce((a, b) => a + b, 0);
    const longest = segs.map((_, i) => i).sort((a, b) => segs[b].len - segs[a].len);
    for (let k = 0; diff !== 0 && k < 200; k++) {
      const i = longest[k % longest.length];
      if (diff > 0) { counts[i]++; diff--; } else if (counts[i] > least) { counts[i]--; diff++; }
    }
    const points = [], lines = [];
    const near = (p) => points.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 8);
    segs.forEach((s, pi) => {
      const m = counts[pi];
      if (!m) return;
      const at = (d) => {
        for (let i = 1; i < s.pts.length; i++) {
          const a = s.pts[i - 1], b = s.pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (d <= l || i === s.pts.length - 1) { const t = l ? Math.min(1, d / l) : 0; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
          d -= l;
        }
        return s.pts[s.pts.length - 1];
      };
      let startJoin = near(s.pts[0]), endJoin = s.loop ? -1 : near(s.pts[s.pts.length - 1]);
      if (startJoin >= 0 && startJoin === endJoin) {
        const q = points[startJoin], far = (p) => Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (far(s.pts[0]) > far(s.pts[s.pts.length - 1])) startJoin = -1; else endJoin = -1;
      }
      let ds;
      if (s.loop) ds = Array.from({ length: m }, (_, k) => (s.len * (k + (startJoin >= 0 ? 0.5 : 0))) / m);
      else {
        const a = startJoin >= 0 ? 1 : 0, b = endJoin >= 0 ? 1 : 0, gaps = m - 1 + a + b;
        ds = gaps <= 0 ? [s.len / 2] : Array.from({ length: m }, (_, k) => (s.len * (k + a)) / gaps);
      }
      const first = points.length;
      ds.forEach((d, k) => {
        points.push(at(d));
        if (k > 0) lines.push([points.length - 2, points.length - 1]);
      });
      if (startJoin >= 0) lines.push([startJoin, first]);
      if (endJoin >= 0) lines.push([points.length - 1, endJoin]);
      if (s.loop && m >= 3) lines.push([points.length - 1, first]);
    });
    return { points, lines };
  }

  function closest(points) {
    let best = Infinity;
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) best = Math.min(best, Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]));
    return best;
  }

  function layout(w, h) {
    const key = `${w}x${h}x${CUE}`;
    if (L && L.key === key) return L;
    const known = new Set((window.KNOWN_WORDS || []).map((x) => x.toLowerCase()));
    const skyW = SKY_W;
    const hi = h - 36 * CUE, lo = hi - 133 * CUE, mid = (lo + hi) / 2, gap = 7 * CUE, rowH = (hi - lo) / 2 - gap;
    const cons = (window.CONSTELLATIONS || []).map((c) => {
      const words = c.words.filter((x) => !known.has(x.toLowerCase()));
      const above = c.at[1] < 0.5;                     // the top row's names sit above them, the bottom row's below
      let grow = 1, shape, sw, sh, before = -1;
      for (;;) {
        sh = Math.min(c.size[1] * CUE * grow, rowH);
        sw = Math.min(c.size[0] * CUE * grow, (1.8 * sh * c.size[0]) / c.size[1]);          // (never much flatter than its own shape)
        shape = c.points ? { points: c.points.map(([x, yy]) => [x * sw, yy * sh]), lines: c.lines || [] } : sample(c.paths, words.length, sw, sh);
        const now = closest(shape.points);
        if (now >= 10 * CUE || grow > 2.6 || c.points || now < before) break;          // (or when growing stops helping)
        before = now;
        grow *= 1.1;
      }
      const cy = above ? (lo + mid - gap) / 2 : (mid + gap + hi) / 2;
      const ox = Math.max(EDGE * CUE, Math.min(skyW - sw - EDGE * CUE, c.at[0] * skyW - sw / 2)), oy = cy - sh / 2;
      const stars = words.map((word, i) => ({ word, x: Math.round(ox + shape.points[i][0]), y: Math.round(oy + shape.points[i][1]), bright: (c.bright || []).includes(word), c: c.id }));
      return { ...c, stars, lines: shape.lines, above };
    });
    const real = (window.SKY_STARS || []).map((r) => ({ ...r, x: Math.round(r.at[0] * skyW), y: Math.round(mid + (r.at[1] < 0.5 ? 10 : 13) * CUE) }));
    relax(cons, real, skyW, mid);
    for (const c of cons) {
      if (!c.stars.length) { c.cx = Math.round(c.at[0] * skyW); c.nameY = c.nameAlt = Math.round(c.above ? lo : hi); c.box = { l: c.cx, r: c.cx, t: c.nameY, b: c.nameY }; continue; }
      const xs = c.stars.map((s) => s.x), ys = c.stars.map((s) => s.y);
      c.box = { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
      c.cx = Math.round((c.box.l + c.box.r) / 2);
      const topY = c.box.t - 5 * CUE, bottomY = c.box.b + 5 * CUE;
      c.nameY = c.above ? topY : bottomY;
      c.nameAlt = c.above ? bottomY : topY;
      c.topStar = c.stars.reduce((a, s) => (s.y < a.y ? s : a));
      c.bottomStar = c.stars.reduce((a, s) => (s.y > a.y ? s : a));
    }
    const star = {}, con = {};
    for (const c of cons) { con[c.id] = c; for (const s of c.stars) star[s.word] = s; }
    const arch = bridgeLayout(real, cons, mid);
    const back = bake(w, h, skyW, cons, arch ? [...arch.slots, ...arch.twinkles] : []);
    L = { key, w, h, skyW, cons, con, star, real, mw: milkyWay(w, h, skyW), back: back.canvas, clear: back.clear, bridge: arch };
    return L;
  }

  const BRIDGE_SLOTS = 20;
  function bridgeLayout(real, cons, mid) {
    const vega = real.find((r) => r.id === "vega"), altair = real.find((r) => r.id === "altair");
    if (!vega || !altair) return null;
    const x0 = vega.x + 12 * CUE, x1 = altair.x - 12 * CUE;
    const footY = mid + 16 * CUE, topY = mid + 7 * CUE;
    const arcY = (t) => footY - (footY - topY) * Math.sin(Math.PI * t);
    const slots = [];
    for (let i = 0; i < BRIDGE_SLOTS; i++) {
      const t = (i + 0.5) / BRIDGE_SLOTS;
      slots.push({ x: Math.round(x0 + (x1 - x0) * t), y: Math.round(arcY(t) + (i % 2 ? 3 : -2) * CUE), face: t < 0.5 ? 1 : -1 });
    }
    const order = [];
    for (let i = 0; i < BRIDGE_SLOTS / 2; i++) order.push(i, BRIDGE_SLOTS - 1 - i);
    const others = [];
    for (const c of cons) for (const s of c.stars) others.push(s);
    const free = (x, y) => others.every((s) => Math.hypot(s.x - x, s.y - y) >= 8 * CUE) && real.every((r) => Math.hypot(r.x - x, r.y - y) >= 11 * CUE);
    const spots = [];
    const n = 26;
    for (let i = 0; i < n; i++) {
      const t = 0.03 + (0.94 * i) / (n - 1), x = Math.round(x0 + (x1 - x0) * t), y = arcY(t);
      for (const [dy, side] of [[-7, -1], [8, 1]]) {
        const sy = Math.round(y + (dy + (i % 2 ? side : 0)) * CUE);
        if (free(x, sy)) spots.push({ x, y: sy, t });
      }
    }
    const twinkles = [];
    const left = spots.slice();
    while (left.length) {
      let best = 0, bestD = -1;
      left.forEach((s, i) => {
        const d = twinkles.length ? Math.min(...twinkles.map((q) => Math.hypot(q.x - s.x, (q.y - s.y) * 2))) : -Math.abs(s.t - 0.2);
        if (d > bestD) { bestD = d; best = i; }
      });
      twinkles.push(left.splice(best, 1)[0]);
    }
    return { slots, order, twinkles, cx: Math.round((x0 + x1) / 2), x0, x1, footY, topY };
  }

  const MOON_R = 7;
  let moonAt = { key: null, spot: null };
  function moonSpot(lay, info) {
    if (!lay || !info || !info.up) return null;
    const key = `${lay.key}|${info.day}`;
    if (moonAt.key === key) return moonAt.spot;
    const r = MOON_R * CUE, skyW = lay.skyW;
    const horizon = lay.h - 12 * CUE, top = 14 * CUE;
    const tx = skyW * (0.5 + ((info.az - 180) / 180) * 0.46);
    const ty = horizon - (Math.max(0, info.alt) / 60) * (horizon - top);
    const points = [], segs = [], boxes = [];
    for (const c of lay.cons) {
      if (!c.stars.length || c.box.r < tx - 280 * CUE || c.box.l > tx + 280 * CUE) continue;
      boxes.push({ l: c.box.l - 4 * CUE, r: c.box.r + 4 * CUE, t: c.box.t - 4 * CUE, b: c.box.b + 4 * CUE });     // (never inside a figure, even between its stars)
      for (const s of c.stars) points.push([s.x, s.y, r + 9 * CUE]);
      for (const [i, j] of c.lines) { const a = c.stars[i], b = c.stars[j]; if (a && b) segs.push([a.x, a.y, b.x, b.y]); }
      const half = (((c.name.length + 2) * 4.25 + 12) / 2) * CUE;
      for (const [y, up] of [[c.nameY, c.above], [c.nameAlt, !c.above]]) boxes.push({ l: c.cx - half, r: c.cx + half, t: up ? y - 11 * CUE : y, b: up ? y : y + 11 * CUE });
    }
    for (const q of lay.real) points.push([q.x, q.y, r + 26 * CUE]);
    if (lay.bridge) {
      const a = lay.bridge;
      boxes.push({ l: a.x0 - 10 * CUE, r: a.x1 + 10 * CUE, t: a.topY - 12 * CUE, b: a.footY + 12 * CUE });
      for (const s of a.twinkles) points.push([s.x, s.y, r + 5 * CUE]);
    }
    const segD = (x, y, [ax, ay, bx, by]) => {
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
      const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
      return Math.hypot(x - ax - dx * k, y - ay - dy * k);
    };
    const ok = (x, y) => points.every(([px, py, d]) => Math.hypot(px - x, py - y) >= d)
      && segs.every((s) => segD(x, y, s) >= r + 4 * CUE)
      && boxes.every((b) => x + r + 2 < b.l || x - r - 2 > b.r || y + r + 2 < b.t || y - r - 2 > b.b);
    const tries = [];
    const x0 = Math.max(EDGE * CUE + r + 2, Math.round(tx - 240 * CUE)), x1 = Math.min(skyW - EDGE * CUE - r - 2, Math.round(tx + 240 * CUE));
    for (let y = Math.round(top); y <= horizon; y++) for (let x = x0; x <= x1; x += 2) tries.push([x, y, ((x - tx) * 0.13) ** 2 + ((y - ty) * 0.2) ** 2]);
    tries.sort((a, b) => a[2] - b[2]);
    const hit = tries.find(([x, y]) => ok(x, y));
    moonAt = { key, spot: hit ? { x: hit[0], y: hit[1], r } : null };
    return moonAt.spot;
  }

  const isBridgeBird = (sp) => !!(window.BIRDS && BIRDS[sp] && BIRDS[sp].bridge) || sp === "magpie" || sp === "crow";
  function bridgeFromSave() {
    if (typeof State === "undefined") return { birds: [], friends: [] };
    const s = State.get();
    const birds = typeof State.bridgeBirds === "function" ? State.bridgeBirds() : s.bridge;
    const days = s.friendDay || {};
    const friends = (s.friends || []).filter((sp) => !isBridgeBird(sp)).map((sp) => ({ species: sp, day: days[sp] || 0 }));
    return { birds: birds || [], friends };
  }
  function setBridge(b) {
    const norm = (list) => (Array.isArray(list) ? list : []).map((e) => (typeof e === "string" ? { species: e, day: 0 } : { ...e })).filter((e) => e && e.species);
    bridge = { birds: norm(b && b.birds), friends: norm(b && b.friends) };
    const mine = bridge.birds.find((e) => e.species === "magpie" && (e.day || 0) <= 1);
    const name = typeof State !== "undefined" && State.get().magpieName;
    if (mine && !mine.name && name) mine.name = name;
  }
  const BRIDGE_AT = () => { const s = window.SKY_STARS || []; return s.length ? s.reduce((a, r) => a + r.at[0], 0) / s.length : 0.5; };

  function relax(cons, real, skyW, mid) {
    const margin = 16 * CUE, items = cons.filter((c) => c.stars.length);
    const fixed = (c) => c.id === "swan";
    const vega = real.find((r) => r.id === "vega"), altair = real.find((r) => r.id === "altair");
    const arch = vega && altair ? { l: vega.x, r: altair.x, t: mid + 3 * CUE, b: mid + 20 * CUE } : null;
    const boxOf = (c) => { let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity; for (const s of c.stars) { l = Math.min(l, s.x); r = Math.max(r, s.x); t = Math.min(t, s.y); b = Math.max(b, s.y); } return { l, r, t, b }; };
    const shift = (c, dx) => { const bx = boxOf(c); dx = Math.max(EDGE * CUE - bx.l, Math.min(skyW - EDGE * CUE - bx.r, dx)); for (const s of c.stars) s.x += dx; return dx; };
    const apart = (a, b, m) => a.l - m >= b.r || b.l - m >= a.r || a.t - m >= b.b || b.t - m >= a.b;
    for (let it = 0; it < 400; it++) {
      let moved = false;
      for (let i = 0; i < items.length; i++) {
        const A = items[i];
        for (let j = i + 1; j < items.length; j++) {
          const B = items[j], a = boxOf(A), b = boxOf(B);
          if (apart(a, b, margin) || (fixed(A) && fixed(B))) continue;
          const dir = a.l + a.r <= b.l + b.r ? 1 : -1;
          let done = 0;
          if (!fixed(A)) done += Math.abs(shift(A, -dir * (fixed(B) ? 4 : 2)));
          if (!fixed(B)) done += Math.abs(shift(B, dir * (fixed(A) ? 4 : 2)));
          if (done < 4 && !fixed(B)) done += Math.abs(shift(B, dir * (4 - done)));
          if (done < 4 && !fixed(A)) shift(A, -dir * (4 - done));
          moved = true;
        }
        if (fixed(A)) continue;
        for (const r of real) {
          const a = boxOf(A), rb = { l: r.x - 6 * CUE, r: r.x + 6 * CUE, t: r.y - 6 * CUE, b: r.y + 6 * CUE };
          if (apart(a, rb, margin / 2)) continue;
          shift(A, a.l + a.r <= 2 * r.x ? -2 : 2);
          moved = true;
        }
        if (arch && !apart(boxOf(A), arch, margin / 2)) { const a = boxOf(A); shift(A, a.l + a.r <= arch.l + arch.r ? -2 : 2); moved = true; }
      }
      if (!moved) break;
    }
  }

  function milkyWay(w, h, skyW) {
    const mw = window.MILKY_WAY || { x: 0.5, width: 0.07 };
    const mid = (yy) => mw.x * skyW + Math.sin((yy / h) * Math.PI * 1.1 + 0.3) * w * 0.06 + (fractalNoise(yy / 40, 0.3, 61) - 0.5) * 6;
    const half = (yy) => {
      const pinch = 1 - 0.35 * Math.exp(-((((yy / h) - 0.66) / 0.1) ** 2));          // (narrowest low down, under the bridge of birds)
      return ((mw.width * skyW) / 2) * (0.85 + 0.25 * Math.sin((2 * Math.PI * yy) / h + 1)) * pinch;
    };
    return { mid, half };
  }

  const bandEdge = (i, x, w, h) => (i <= 0 ? 0 : i >= 4 ? h : Math.round(((i / 4) ** 0.8) * h + ((1 + Math.cos((2 * Math.PI * x) / w)) / 2) * h * 0.07));
  const bandAt = (x, y, w, h) => { let i = 0; while (i < 3 && y >= bandEdge(i + 1, x, w, h)) i++; return i; };

  function bake(w, h, skyW, cons = [], spots = []) {
    const clear = new Set();
    const keep = (x, y, r = 2) => { for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) clear.add((y + b) * skyW + x + a); };
    for (const s of spots) keep(s.x, s.y, 4);           // (the bridge's birds and twinkles too)
    for (const c of cons) {
      for (const s of c.stars) keep(s.x, s.y);
      for (const [i, j] of c.lines) {
        const a = c.stars[i], b = c.stars[j];
        if (!a || !b) continue;
        const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)) || 1;
        for (let k = 0; k <= n; k++) keep(Math.round(a.x + ((b.x - a.x) * k) / n), Math.round(a.y + ((b.y - a.y) * k) / n), 3);
      }
    }
    const c = document.createElement("canvas");
    c.width = skyW; c.height = h;
    const g = c.getContext("2d");
    const bands = nightBands();
    for (let x = 0; x < skyW; x++) for (let i = 0; i < 4; i++) {
      g.fillStyle = bands[i];
      g.fillRect(x, bandEdge(i, x, w, h), 1, bandEdge(i + 1, x, w, h) - bandEdge(i, x, w, h));
    }
    const { mid, half } = milkyWay(w, h, skyW), lighter = nightBandsLighter(), night = nightBands();
    for (let yy = 0; yy < h; yy++) {
      const m = mid(yy), hw = half(yy), rift = Math.round(m + 1 + Math.sin(yy / 31) * 2);
      for (let x = Math.round(m - hw); x <= m + hw; x++) {
        const i = bandAt(x, yy, w, h);
        g.fillStyle = x === rift || x === rift + 1 ? night[i] : lighter[i];
        g.fillRect(x, yy, 1, 1);
      }
    }
    for (let i = 0; i < skyW * h / 120; i++) {
      const inBand = i % 3 === 0, yy = Math.floor(hash2(i, 4, 234) * h);
      const x = inBand ? Math.round(mid(yy) + (hash2(i, 1, 231) + hash2(i, 2, 232) - 1) * half(yy) * 1.6) : Math.floor(hash2(i, 3, 233) * skyW);
      const k = hash2(i, 5, 235);
      if (clear.has(yy * skyW + x)) continue;
      g.fillStyle = inBand && k < 0.35 ? PALETTE.starBright : k < 0.5 ? PALETTE.starBand : PALETTE.starFaint;
      g.fillRect(x, yy, 1, 1);
    }
    return { canvas: c, clear };
  }

  function show(day, newWords, opts = {}) {
    dayMode = !!opts.day;
    review = !!opts.review;
    porch = !!opts.porch && !review;
    if (porch) forgetTogether();
    open = true;
    tiltGoal = 1;
    clock = 0; labels = []; tour = []; press = null; panGoal = null; whisperI = 0; sparks = []; hideBubbleDone = false; reviewStops = null;
    whisperAt = TILT_SECONDS + 0.4;
    skyDay = day || (typeof State !== "undefined" && State.get().day) || 1;
    moonInfo = typeof Moon !== "undefined" ? Moon.forDay(skyDay) : null;
    setBridge(opts.bridge || bridgeFromSave());
    const learned = State.get().learned;
    born = {};
    for (const w of Object.keys(learned)) if (!newWords.includes(w)) born[w] = -10;
    const atX = (id) => { if (id === "@bridge") return BRIDGE_AT(); const c = (window.CONSTELLATIONS || []).find((x) => x.id === id); return c ? c.at[0] : 0.5; };
    const groups = [];
    for (const w of newWords) {
      const id = conOf(w);
      if (!id) continue;
      let g = groups.find((x) => x.id === id);
      if (!g) groups.push((g = { id, words: [] }));
      g.words.push(w);
    }
    groups.sort((a, b) => atX(a.id) - atX(b.id));
    let t = TILT_SECONDS + 0.3;
    groups.forEach((g, gi) => {
      const secs = gi === 0 ? 0 : glideSecs(atX(groups[gi - 1].id), atX(g.id));
      tour.push({ id: g.id, at: gi === 0 ? -10 : t, secs });
      const arrive = t + secs;
      g.words.forEach((w, i) => {
        born[w] = arrive + 0.3 + i * 0.75;
        labels.push({ word: w, from: born[w], until: born[w] + 1.5 });
      });
      t = arrive + 0.3 + g.words.length * 0.75 + 0.7;
    });
    const isNew = (e) => !review && (e.fresh !== undefined ? !!e.fresh : (e.day || 0) === skyDay);
    bridgeBorn = { birds: bridge.birds.map((e) => (isNew(e) ? null : -10)), friends: bridge.friends.map((e) => (isNew(e) ? null : -10)) };
    const tonight = [];
    bridge.birds.forEach((e, i) => { if (isNew(e)) tonight.push(["birds", i]); });
    bridge.friends.forEach((e, i) => { if (isNew(e)) tonight.push(["friends", i]); });
    if (tonight.length) {
      const first = !tour.length, secs = first ? 0 : glideSecs(atX(tour[tour.length - 1].id), atX("@bridge"));
      tour.push({ id: "@bridge", at: first ? -10 : t, secs });
      const arrive = t + secs;
      tonight.forEach(([k, i], j) => {
        bridgeBorn[k][i] = arrive + 0.3 + j * 0.75;
        labels.push({ bridge: { kind: k, i }, from: bridgeBorn[k][i], until: bridgeBorn[k][i] + 1.5 });
      });
      t = arrive + 0.3 + tonight.length * 0.75 + 0.7;
    }
    tourEnd = tour.length ? t - 0.3 : TILT_SECONDS + 0.5;
    promise = review && !Object.keys(learned).length ? ((window.CONSTELLATIONS || [])[0] || { words: [] }).words : [];
    if (review) {
      const ids = [...new Set(Object.keys(learned).map(conOf).filter(Boolean))].sort((a, b) => atX(a) - atX(b));
      const newest = newestConstellation(learned);
      if (newest && ids[ids.length - 1] !== newest) ids.push(newest);
      reviewStops = ids;
      startOn = ids[0] || ((window.CONSTELLATIONS || [])[0] || {}).id;
    } else startOn = tour[0] ? tour[0].id : null;
    return new Promise((done) => { onClose = done; });
  }
  const glideSecs = (a, b) => 0.8 + ((Math.abs(a - b) * SKY_W) / Math.max(1, (L && L.w) || 422)) * 0.5;

  const conOf = (word) => { const c = (window.CONSTELLATIONS || []).find((x) => x.words.includes(Words.base(word)) || x.words.includes(word)); return c && c.id; };
  function newestConstellation(learned) {
    let best = null, day = -1;
    for (const [w, d] of Object.entries(learned)) if (d >= day) { const id = conOf(w); if (id) { best = id; day = d; } }
    return best || ((window.CONSTELLATIONS || [])[0] || {}).id;
  }

  const settled = () => clock >= tourEnd;

  function close() {
    tiltGoal = 0;
    labels = [];
    press = null;
    closeCard();
  }

  function update(dt) {
    clock += dt;
    const step = dt / TILT_SECONDS;
    tilt = tiltGoal > tilt ? Math.min(tiltGoal, tilt + step) : Math.max(tiltGoal, tilt - step);
    for (const b of [...Object.values(born), ...bridgeBorn.birds, ...bridgeBorn.friends]) if (b > 0 && b <= clock && b > clock - dt) Sound.twinkle();
    labels = labels.filter((l) => l.until > clock);
    sparks = sparks.filter((s) => clock - s.at < 0.45);
    if (review && !hideBubbleDone && tilt > 0) { hideBubbleDone = true; UI.hideBubble(); }
    if (open && tiltGoal === 0 && tilt === 0) {
      open = false;
      born = {}; promise = []; tour = []; bridgeBorn = { birds: [], friends: [] };
      if (onClose) { const f = onClose; onClose = null; f(); }
    }
  }

  const amount = () => tilt * tilt * (3 - 2 * tilt);

  const clampPan = (x, lay) => Math.max(0, Math.min(lay.skyW - lay.w, x));
  const panOf = (stop, lay) => (stop.x !== undefined ? clampPan(stop.x, lay)
    : stop.id === "@bridge" && lay.bridge ? clampPan(lay.bridge.cx - lay.w / 2, lay)
    : lay.con[stop.id] ? clampPan(lay.con[stop.id].cx - lay.w / 2, lay) : clampPan((lay.skyW - lay.w) / 2, lay));
  const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

  let reviewStops = null;
  function buildReviewTour(lay) {
    const xs = reviewStops.map((id) => panOf({ id }, lay));
    reviewStops = null;
    const stops = [xs[0]], last = xs[xs.length - 1];
    for (const x of xs.slice(1, -1)) if (Math.abs(x - stops[stops.length - 1]) >= lay.w / 3) stops.push(x);
    if (Math.abs(last - stops[stops.length - 1]) >= lay.w / 3) stops.push(last);
    else if (stops.length > 1) stops[stops.length - 1] = last;
    else if (last !== stops[0]) stops.push(last);
    const margin = 26 * CUE, under = (x) => {
      let n = 0;
      for (const c of lay.cons) if (started(c)) for (const s of c.stars) { const sx = s.x - x; if ((sx > -4 && sx < margin) || (sx > lay.w - margin && sx < lay.w + 4)) n += lit(s.word) ? 1 : 0.3; }
      for (const r of lay.real) { const sx = r.x - x; if ((sx > -12 && sx < margin + 12) || (sx > lay.w - margin - 12 && sx < lay.w + 12)) n += 3; }
      return n;
    };
    const rest = stops[stops.length - 1];
    let best = { x: rest, n: under(rest) };
    for (let d = 4; d <= lay.w / 4 && best.n > 0; d += 4) for (const x of [clampPan(rest + d, lay), clampPan(rest - d, lay)]) { const n = under(x); if (n < best.n) best = { x, n }; }
    stops[stops.length - 1] = best.x;
    let tt = TILT_SECONDS + 0.6;
    tour = stops.map((x, i) => {
      if (i === 0) return { x, at: -10 };
      const secs = 1.2 + (Math.abs(x - stops[i - 1]) / lay.w) * 1.2;      // slowly: 1.2 s, and more a screen
      const stop = { x, at: tt, secs };
      tt += secs + 2;
      return stop;
    });
  }

  function updatePan(lay) {
    if (reviewStops && reviewStops.length) buildReviewTour(lay);
    if (panGoal === null) { pan = panOf(tour[0] || { id: startOn }, lay); panGoal = pan; }
    if (press || !tour.length) return;
    for (let i = tour.length - 1; i >= 1; i--) {
      if (clock >= tour[i].at) {
        const k = ease((clock - tour[i].at) / (tour[i].secs || 1));
        const from = tour[i].from !== undefined ? tour[i].from : panOf(tour[i - 1], lay);
        pan = Math.round(from + (panOf(tour[i], lay) - from) * k);
        return;
      }
    }
    pan = panOf(tour[0], lay);
  }

  const STAR = ["...#...", "..###..", "#######", ".#####.", "..###..", ".##.##.", ".#...#."];
  const STAR_BIG = scale2xGrid(STAR);
  const drawStar = (ctx, x, y, grid, color) => {
    const o = Math.floor(grid.length / 2);
    ctx.fillStyle = color;
    grid.forEach((row, j) => [...row].forEach((ch, i) => ch === "#" && ctx.fillRect(x + i - o, y + j - o, 1, 1)));
    ctx.fillStyle = PALETTE.cream;
    ctx.fillRect(x - CUE + 1, y - CUE + 1, CUE, CUE);
  };

  const lit = (word) => born[word] !== undefined && born[word] <= clock;
  const started = (c) => c.stars.some((s) => lit(s.word)) || c.stars.some((s) => promise.includes(s.word));

  const BIRD_STARS = {
    magpie: [["....##..", "...##o#.", "########", ".#####..", "..###..."], ["..#.##..", "..###o#.", "########", ".#####..", "..###..."]],
    crow: [[".....##.", "#..##o##", "########", ".#####..", "..###..."], ["..#..##.", "#.###o##", "########", ".#####..", "..###..."]],
  };
  const birdStarCache = {};
  function birdStar(species, face, frame) {
    const key = `${species}|${face}|${frame}`;
    if (birdStarCache[key]) return birdStarCache[key];
    const grid = (BIRD_STARS[species] || BIRD_STARS.magpie)[frame];
    const w = grid[0].length, h = grid.length;
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && grid[y][x] !== ".";
    const c = document.createElement("canvas");
    c.width = w + 2; c.height = h + 2;
    const g = c.getContext("2d");
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      const px = face > 0 ? x + 1 : w - x;
      if (on(x, y)) { g.fillStyle = grid[y][x] === "o" ? PALETTE.cream : PALETTE.starlight; g.fillRect(px, y + 1, 1, 1); }
      else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) { g.fillStyle = BIRD_EDGE(); g.fillRect(px, y + 1, 1, 1); }
    }
    return (birdStarCache[key] = c);
  }
  const BIRD_EDGE = () => mix(PALETTE.nightIndigo, PALETTE.night1, 0.5);
  const bridgeLit = (k, i) => bridgeBorn[k][i] !== null && bridgeBorn[k][i] !== undefined && bridgeBorn[k][i] <= clock;
  function bridgeSpots(lay, all = false) {
    const a = lay.bridge, out = [];
    if (!a) return out;
    bridge.birds.forEach((e, i) => { const s = a.slots[a.order[i]]; if (s && (all || bridgeLit("birds", i))) out.push({ kind: "birds", i, x: s.x, y: s.y, face: s.face, e }); });
    bridge.friends.forEach((e, i) => { const s = a.twinkles[i]; if (s && (all || bridgeLit("friends", i))) out.push({ kind: "friends", i, x: s.x, y: s.y, e }); });
    return out;
  }
  function drawBridge(ctx, lay, px, time) {
    const a = lay.bridge;
    if (!a || a.x1 - px < -20 || a.x0 - px > lay.w + 20) return;
    const spots = bridgeSpots(lay);
    const birdsOut = spots.filter((s) => s.kind === "birds");
    if (birdsOut.length && birdsOut.length < a.slots.length) {
      const w = lay.w, h = lay.h;
      for (let x = a.x0; x <= a.x1; x += 4 * CUE) {
        const t = (x - a.x0) / (a.x1 - a.x0), y = Math.round(a.footY - (a.footY - a.topY) * Math.sin(Math.PI * t));
        if (birdsOut.some((s) => Math.abs(s.x - x) < 6 * CUE)) continue;
        const onMilkyWay = bandAt(x, y, w, h) >= 2 || Math.abs(x - lay.mw.mid(y)) < lay.mw.half(y);
        ctx.fillStyle = onMilkyWay ? PALETTE.starLine : PALETTE.starFaint;
        ctx.fillRect(x - px, y, CUE, CUE);
      }
    }
    for (const s of spots) if (s.kind === "birds") {
      const age = clock - bridgeBorn[s.kind][s.i], pop = age < 0.35 ? 1 + (1 - age / 0.35) * 1.5 : 1;
      Daylight.drawLight(ctx, s.x - px, s.y, Math.round(6 * pop * CUE), "starBright", (0.25 + 0.1 * Math.sin(time * 2 + s.x)) * 2);
    }
    spots.sort((p, q) => (p.kind === "birds") - (q.kind === "birds") || (p.kind === "birds" ? Math.abs(p.x - a.cx) - Math.abs(q.x - a.cx) : 0));
    for (const s of spots) {
      const x = s.x - px, y = s.y, age = clock - bridgeBorn[s.kind][s.i];
      const pop = age < 0.35 ? 1 + (1 - age / 0.35) * 1.5 : 1;
      if (s.kind === "birds") {
        const beat = (time * 0.7 + s.i * 0.37) % 3 < 0.22 ? 1 : 0;
        const sp = birdStar(s.e.species === "crow" ? "crow" : "magpie", s.face, beat);
        ctx.drawImage(sp, Math.round(x - sp.width / 2), Math.round(y - 3));
      } else {
        const on = age < 0.6 || Math.sin(time * (1.3 + (s.i % 5) * 0.21) + s.i * 1.9) > -0.3;
        Daylight.drawLight(ctx, x, y, Math.round(4 * pop * CUE), "starBright", 0.45);
        ctx.fillStyle = PALETTE.starBright;
        if (on) { ctx.fillRect(x - CUE, y, CUE, CUE); ctx.fillRect(x + CUE, y, CUE, CUE); ctx.fillRect(x, y - CUE, CUE, CUE); ctx.fillRect(x, y + CUE, CUE, CUE); }
        ctx.fillStyle = on ? PALETTE.cream : PALETTE.starBright;
        ctx.fillRect(x, y, CUE, CUE);
      }
      if (age < 0.5) {
        const r = (3 + age * 14) * CUE;
        ctx.fillStyle = PALETTE.cream;
        for (let i = 0; i < 8; i++) ctx.fillRect(Math.round(x + Math.cos(i * 0.785) * r), Math.round(y + Math.sin(i * 0.785) * r), 1, 1);
      }
    }
  }

  function draw(ctx, w, h, time) {
    const k = amount();
    if (k <= 0) return;
    const top = Math.round(k * h) - h;
    ctx.save();
    ctx.translate(0, top);
    if (dayMode) { drawDaySky(ctx, w, h, time); ctx.restore(); return; }
    const lay = layout(w, h);
    updatePan(lay);
    const px = Math.round(pan);
    ctx.drawImage(lay.back, -px, 0);
    for (let i = 0; i < (60 * lay.skyW) / w; i++) {
      if (Math.sin(time * (0.6 + hash2(i, 4, 204)) + i) < 0.85) continue;
      const sx = Math.floor(hash2(i, 1, 201) * lay.skyW), x = sx - px, y = Math.floor(hash2(i, 2, 202) * h * 0.8);
      if (x < 0 || x >= w || lay.clear.has(y * lay.skyW + sx)) continue;          // (not on a figure)
      ctx.fillStyle = PALETTE.starBright;
      ctx.fillRect(x, y, 1, 1);
    }
    const ms = moonSpot(lay, moonInfo);
    if (ms && ms.x - px > -24 && ms.x - px < w + 24) Moon.draw(ctx, ms.x - px, ms.y, ms.r, moonInfo);
    for (const r of lay.real) {
      const x = r.x - px;
      if (x < -16 || x > w + 16) continue;
      Daylight.drawLight(ctx, x, r.y, 12 * CUE, "starBright", 0.8 + 0.2 * Math.sin(time * 1.3 + r.x));
      drawStar(ctx, x, r.y, STAR_BIG, r.id === "vega" ? PALETTE.starBright : PALETTE.starlight);
    }
    const inView = lay.cons.filter((c) => started(c) && c.cx - px > -120 * CUE && c.cx - px < w + 120 * CUE);
    ctx.fillStyle = PALETTE.starLine;
    const lighter = (sx, sy) => bandAt(sx, sy, w, h) >= 2 || Math.abs(sx - lay.mw.mid(sy)) < lay.mw.half(sy);
    for (const c of inView) for (const s of c.stars) {
      if (lit(s.word)) continue;
      const x = s.x - px, y = s.y;
      ctx.fillStyle = lighter(s.x, y) ? RAMPS.starBright[3] : PALETTE.starLine;
      ctx.fillRect(x - CUE, y, CUE, CUE); ctx.fillRect(x + CUE, y, CUE, CUE);
      ctx.fillRect(x, y - CUE, CUE, CUE); ctx.fillRect(x, y + CUE, CUE, CUE);
    }
    for (const c of inView) for (const [a, b] of c.lines) {
      const sa = c.stars[a], sb = c.stars[b];
      if (!sa || !sb) continue;
      const both = lit(sa.word) && lit(sb.word);
      const grown = both ? Math.max(0, Math.min(1, (clock - Math.max(born[sa.word], born[sb.word])) / 0.6)) : 1;
      const n = Math.ceil(Math.hypot(sb.x - sa.x, sb.y - sa.y)), gap = both ? 2 : 4;
      ctx.fillStyle = PALETTE.starLine;
      for (let i = 3 * CUE; i < n * grown - 3 * CUE; i += gap) {
        const sx = Math.round(sa.x + ((sb.x - sa.x) * i) / n), sy = Math.round(sa.y + ((sb.y - sa.y) * i) / n);
        if (!both) ctx.fillStyle = lighter(sx, sy) ? PALETTE.starLine : PALETTE.starFaint;
        ctx.fillRect(sx - px, sy, 1, 1);
      }
    }
    for (const c of inView) for (const s of c.stars) {
      if (!lit(s.word)) continue;
      const x = s.x - px, y = s.y, age = clock - born[s.word];
      const pop = age < 0.35 ? 1 + (1 - age / 0.35) * 1.5 : 1;
      Daylight.drawLight(ctx, x, y, Math.round((s.bright ? 9 : 6) * pop * CUE), "starBright", (0.25 + 0.1 * Math.sin(time * 2 + s.x)) * 2);
      drawStar(ctx, x, y, CUE > 1 || s.bright ? STAR_BIG : STAR, PALETTE.starlight);
      if (age < 0.5) {
        const r = (3 + age * 14) * CUE;
        for (let i = 0; i < 8; i++) ctx.fillRect(Math.round(x + Math.cos(i * 0.785) * r), Math.round(y + Math.sin(i * 0.785) * r), 1, 1);
      }
    }
    drawBridge(ctx, lay, px, time);
    for (const s of sparks) {
      const r = (2 + (clock - s.at) * 14) * CUE;
      ctx.fillStyle = PALETTE.starBright;
      for (let i = 0; i < 8; i++) ctx.fillRect(Math.round(s.x + Math.cos(i * 0.785) * r), Math.round(s.y - top + Math.sin(i * 0.785) * r), CUE, CUE);
    }
    drawTreeline(ctx, w, h, PALETTE.nightTrees);
    if (review) {
      const us = together(), x0 = PAIR_X * CUE, y0 = h - us.height - 13;
      for (let x = -20; x < us.width + 20; x++) {
        const f = (x + 20) / (us.width + 40), hgt = Math.round(Math.sin(f * Math.PI) * 14) + 2;
        ctx.fillStyle = RAMPS.nightTrees[0];
        ctx.fillRect(x0 + x, h - hgt, 1, hgt);
        ctx.fillStyle = PALETTE.starBand;                          // (the moon on the hill's edge)
        ctx.fillRect(x0 + x, h - hgt, 1, 1);
      }
      ctx.drawImage(us, x0, y0);
      const hb = (time % 6) / 1.4;
      if (hb < 1) ctx.drawImage(heartIcon(), x0 + Math.round(us.width / 2) - 3, Math.round(y0 - 4 - hb * 8));
      const t = clock - pairTapAt;
      if (t >= 0 && t < 1.4) for (const [dx, k] of [[-9, 1], [0, 1.3], [9, 0.9]]) {
        const y = Math.round(y0 - 2 - t * 18 * k);
        if (!(t > 1.2 && Math.floor(t * 20) % 2)) ctx.drawImage(heartIcon(), x0 + Math.round(us.width / 2) - 3 + dx, y);
      }
    }
    if (porch) drawPorch(ctx, h, time);
    ctx.restore();
  }
  const PAIR_X = 28;
  let pairTapAt = -10;
  function pairBox(w, h) {
    if (!(review || porch) || !open) return null;
    const us = porch ? onThePorch() : together();
    if (porch) return { x: PAIR_X * CUE - 6, y: h - us.height - 14, w: us.width + 12, h: us.height + 14 };
    return { x: PAIR_X * CUE - 6, y: h - us.height - 13 - 14, w: us.width + 12, h: us.height + 27 };
  }

  function drawPorch(ctx, h, time) {
    const us = onThePorch(), x0 = PAIR_X * CUE, y0 = h - us.height;
    ctx.drawImage(us, x0, y0);
    const mid = x0 + PORCH_MID - 3;
    const hb = (time % 6) / 1.4;
    if (hb < 1) ctx.drawImage(heartIcon(), mid, Math.round(y0 + 2 - hb * 8));
    const t = clock - pairTapAt;
    if (t >= 0 && t < 1.4) for (const [dx, k] of [[-9, 1], [0, 1.3], [9, 0.9]]) {
      const y = Math.round(y0 + 4 - t * 18 * k);
      if (!(t > 1.2 && Math.floor(t * 20) % 2)) ctx.drawImage(heartIcon(), mid + dx, y);
    }
  }
  const PORCH_MID = 21;              // (between them, in the picture)
  let porchCanvas = null;
  function onThePorch() {
    if (porchCanvas) return porchCanvas;
    const W = 42, H = 39;
    const night = (src) => {
      const c = document.createElement("canvas");
      c.width = src.width; c.height = src.height;
      const n = c.getContext("2d");
      n.drawImage(src, 0, 0);
      Daylight.apply(n, 0, 0, c.width, c.height, false, "night");
      n.globalCompositeOperation = "destination-in"; n.drawImage(src, 0, 0); n.globalCompositeOperation = "source-over";
      return c;
    };
    const people = document.createElement("canvas"); people.width = W; people.height = H;
    const dolls = document.createElement("canvas"); dolls.width = W; dolls.height = H;
    const p = people.getContext("2d"), d = dolls.getContext("2d");
    const inGallery = typeof PLAYER_SPRITES === "undefined";
    const hers = (inGallery ? renderPlayer() : PLAYER_SPRITES).up[0];
    const his = typeof renderHusband === "function" ? renderHusband().up[0] : null;
    const top = 4;
    if (hers) p.drawImage(hers, 0, 0, 16, 26, 4, top, 16, 26);
    if (his) p.drawImage(his, 0, 0, 16, 26, 21, top, 16, 26);
    p.fillStyle = (window.PLAYER_LOOK && PLAYER_LOOK.skin) ? paletteColor(PLAYER_LOOK.skin) : PALETTE.skin || "#F6D2B8";
    p.fillRect(PORCH_MID - 2, top + 19, 4, 2);
    const doll = typeof Dolls !== "undefined" ? Dolls.carried() || (inGallery ? "triceratops" : null) : null;
    if (doll) Dolls.drawOnBack(d, doll, 4, top + 4, "up", false);
    if (window.HUSBAND && HUSBAND.doll && typeof Dolls !== "undefined") Dolls.drawOnBack(d, HUSBAND.doll.id, 21, top + 4, "up", false);
    const bench = new PixelBuffer(W - 2, 12);
    bench.rect(0, 1, W - 2, 3, "wood");
    bench.rect(0, 6, W - 2, 3, "wood");
    for (const x of [1, (W - 2) / 2 - 1, W - 5]) bench.rect(x, 0, 2, 12, "bark", { flat: true });
    const benchC = outline(bench).toCanvas();
    const back = document.createElement("canvas"); back.width = W; back.height = H;
    back.getContext("2d").drawImage(benchC, 0, H - 13);
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.drawImage(moonlit(night(people), "left", PALETTE.starBright, { upLeft: true, maxY: top + 11 }), 0, 0);
    g.drawImage(moonWhite(dolls), 0, 0);
    const benchNight = night(back);
    g.drawImage(benchNight, 0, 0);
    g.fillStyle = PALETTE.starBand;
    for (let x = 1; x < W - 1; x++) { const a = g.getImageData(x, H - 12, 1, 1).data; if (a[3]) g.fillRect(x, H - 12, 1, 1); }
    const hp = g.getImageData(PORCH_MID, top + 19, 1, 1).data;
    if (hp[3]) { g.fillStyle = mix(rgbToHex([hp[0], hp[1], hp[2]]), PALETTE.starBright, 0.35); g.fillRect(PORCH_MID - 2, top + 19, 4, 2); }
    return (porchCanvas = c);
  }
  let heartCanvas = null;
  const heartIcon = () => heartCanvas || (heartCanvas = iconFromGrid(ICONS.heart).toCanvas());

  let usCanvas = null;
  function together() {
    if (usCanvas) return usCanvas;
    const night = (src, extra) => {
      const c = document.createElement("canvas");
      c.width = src.width; c.height = src.height;
      const n = c.getContext("2d");
      n.drawImage(src, 0, 0);
      Daylight.apply(n, 0, 0, c.width, c.height, false, "night");
      if (extra) { n.globalCompositeOperation = "multiply"; n.fillStyle = extra; n.fillRect(0, 0, c.width, c.height); n.globalCompositeOperation = "source-over"; }
      n.globalCompositeOperation = "destination-in"; n.drawImage(src, 0, 0); n.globalCompositeOperation = "source-over";
      return c;
    };
    const W = 40, H = 36;
    const people = document.createElement("canvas"); people.width = W; people.height = H;
    const dolls = document.createElement("canvas"); dolls.width = W; dolls.height = H;
    const p = people.getContext("2d"), d = dolls.getContext("2d");
    const inGallery = typeof PLAYER_SPRITES === "undefined";
    const hers = (inGallery ? renderPlayer() : PLAYER_SPRITES).up[0];
    const his = typeof renderHusband === "function" ? renderHusband().up[0] : null;
    if (hers) p.drawImage(hers, 2, 4);
    if (his) p.drawImage(his, 19, 4);
    p.fillStyle = (window.PLAYER_LOOK && PLAYER_LOOK.skin) ? paletteColor(PLAYER_LOOK.skin) : PALETTE.skin || "#F6D2B8";
    p.fillRect(17, 23, 3, 2);
    const doll = typeof Dolls !== "undefined" ? Dolls.carried() || (inGallery ? "triceratops" : null) : null;
    if (doll) Dolls.drawOnBack(d, doll, 2, 4, "up", false);
    if (window.HUSBAND && HUSBAND.doll && typeof Dolls !== "undefined") Dolls.drawOnBack(d, HUSBAND.doll.id, 19, 4, "up", false);
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.drawImage(moonlit(night(people), "left", PALETTE.starBright, { upLeft: true, maxY: 15 }), 0, 0);
    g.drawImage(moonWhite(dolls), 0, 0);
    const hp = g.getImageData(18, 23, 1, 1).data;
    if (hp[3]) { g.fillStyle = mix(rgbToHex([hp[0], hp[1], hp[2]]), PALETTE.starBright, 0.35); g.fillRect(17, 23, 3, 2); }
    return (usCanvas = c);
  }
  function moonWhite(src) {
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    const g = c.getContext("2d");
    g.drawImage(src, 0, 0);
    Daylight.apply(g, 0, 0, c.width, c.height, false, "night");
    g.globalCompositeOperation = "destination-in"; g.drawImage(src, 0, 0); g.globalCompositeOperation = "source-over";
    const orig = src.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
    const snow = RAMPS.snow.map((x) => x.toLowerCase());
    const fur = [RAMPS.starBright[2], RAMPS.starBright[3], mix(RAMPS.starBright[3], "#3A4178", 0.35), mix(RAMPS.starBright[3], "#3A4178", 0.35)];
    for (let i = 0; i < d.length; i += 4) {
      if (!orig[i + 3]) continue;
      const band = snow.indexOf(rgbToHex([orig[i], orig[i + 1], orig[i + 2]]).toLowerCase());
      if (band < 0) continue;
      const [r, gg, b] = hexToRgb(fur[band]);
      d[i] = r; d[i + 1] = gg; d[i + 2] = b;
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  const forgetTogether = () => { usCanvas = null; porchCanvas = null; };

  function drawDaySky(ctx, w, h, time) {
    const bands = [PALETTE.daySky0, PALETTE.daySky1, PALETTE.daySky2, PALETTE.daySky3];
    bands.forEach((c, i) => {
      ctx.fillStyle = c;
      const y0 = Math.floor((i / bands.length) ** 0.8 * h), y1 = Math.ceil(((i + 1) / bands.length) ** 0.8 * h);
      ctx.fillRect(0, y0, w, y1 - y0);
    });
    const sx = Math.round(w * 0.78), sy = Math.round(h * 0.26);
    Daylight.drawLight(ctx, sx, sy, 22, "butter", 1.2);
    ctx.fillStyle = PALETTE.butter;
    for (let y = -7; y < 7; y++) for (let x = -7; x < 7; x++) if ((x + 0.5) ** 2 + (y + 0.5) ** 2 <= 49) ctx.fillRect(sx + x, sy + y, 1, 1);
    ctx.fillStyle = PALETTE.cream;
    ctx.fillRect(sx - 3, sy - 4, 2, 2);
    for (let i = 0; i < 5; i++) {
      const cx = ((hash2(i, 1, 210) * w + time * (4 + i)) % (w + 80)) - 40, cy = h * (0.15 + hash2(i, 2, 211) * 0.45);
      const rw = 14 + hash2(i, 3, 212) * 12;
      for (const [dx, dy, r] of [[0, 0, rw], [-rw * 0.6, 3, rw * 0.6], [rw * 0.6, 3, rw * 0.65]]) {
        ctx.fillStyle = PALETTE.cream;
        for (let y = -r * 0.5; y <= r * 0.5; y++) for (let x = -r; x <= r; x++) if ((x / r) ** 2 + (y / (r * 0.5)) ** 2 <= 1) ctx.fillRect(Math.round(cx + dx + x), Math.round(cy + dy + y), 1, 1);
      }
      ctx.fillStyle = RAMPS.cream[2];
      ctx.fillRect(Math.round(cx - rw), Math.round(cy + rw * 0.4), Math.round(rw * 2), 1);
    }
    drawTreeline(ctx, w, h, RAMPS.leaf[2]);
  }

  function drawTreeline(ctx, w, h, color) {
    ctx.fillStyle = color;
    let x0 = -4, i = 0;
    while (x0 < w) {
      const tw = 8 + Math.floor(hash2(i, 3, 206) * 8), top = 6 + hash2(i, 1, 205) * 7;
      for (let x = x0; x < x0 + tw; x++) {
        const within = (x - x0 + 0.5) / tw;
        const hgt = top * Math.sqrt(Math.max(0, 1 - (within * 2 - 1) ** 2)) + 3;
        ctx.fillRect(x, Math.round(h - hgt), 1, Math.ceil(hgt));
      }
      x0 += tw - 1;
      i++;
    }
  }

  function whoName(who) {
    return who === "magpie" ? State.get().magpieName || (BIRDS.magpie && BIRDS.magpie.name) : who === "husband" ? (window.HUSBAND && HUSBAND.name) : who && BIRDS[who] ? BIRDS[who].name : "";
  }
  function learnedNote(word) {
    const d = State.get().learned[word];
    if (!d) return "";
    const name = whoName((State.get().learnedWith || {})[word]);
    return name ? UI_TEXT.learnedWith.replace("{day}", d).replace("{who}", name) : UI_TEXT.learnedOn.replace("{day}", d);
  }
  const pictureOf = (word) => { const i = Words.info(word); return i && i.picture ? i.picture + " " : ""; };

  function whisper(lay) {
    if (!review || press || clock < whisperAt || labels.length || tourMoving() || cardOpen()) return;
    const inView = [];
    for (const c of lay.cons) for (const s of c.stars) if (lit(s.word) && s.x - pan > 10 && s.x - pan < lay.w - 10) inView.push(s);
    if (!inView.length) return;
    inView.sort((a, b) => a.x - b.x);
    const s = inView[whisperI++ % inView.length];
    labels.push({ word: s.word, from: clock, until: clock + 1.7, quiet: true });
    whisperAt = clock + 2.4 + (whisperI % inView.length === 0 ? 5 : 0);          // (all of them once, then a rest)
  }
  const tourMoving = () => tour.length > 1 && tour.some((t) => clock >= t.at && clock < t.at + (t.secs || 0));
  const cardOpen = () => { const el = $("sky-card"); return !!el && !el.classList.contains("hidden"); };
  let glideUntil = 0;             // (an arrow's glide, and a moment after it)

  function labelSpots(w, h) {
    const lay = layout(w, h);
    whisper(lay);
    return labels.filter((l) => l.from <= clock).map((l) => {
      if (l.real) { const r = lay.real.find((x) => x.id === l.real); return r && { text: r.name, sub: r.korean || "", x: r.x - pan, y: r.y - 9, sx: r.x - pan, sy: r.y, r: 9 }; }
      if (l.moon) {
        const m = moonSpot(lay, moonInfo), T = window.MOON_TEXT || { name: "moon", korean: "달" };
        return m && { text: `${moonInfo.text.emoji} ${T.name}`, sub: `${T.korean} · ${moonInfo.text.korean}`, x: m.x - pan, y: m.y - m.r - 2, sx: m.x - pan, sy: m.y, r: m.r + 2 };
      }
      if (l.bridge) {
        const s = bridgeSpots(lay, true).find((q) => q.kind === l.bridge.kind && q.i === l.bridge.i);
        if (!s) return null;
        const b = window.BIRDS && BIRDS[s.e.species], name = b ? b.name : s.e.species;
        const day = s.e.day && (review || l.tapped) ? UI_TEXT.learnedOn.replace("{day}", s.e.day) : "";       // (when it's born tonight, just its name)
        const text = s.kind === "birds" ? name.toLowerCase() : name;
        const sub = [s.kind === "birds" ? s.e.name : "", day].filter(Boolean).join(" · ");
        return { text, sub, x: s.x - pan, y: s.y - 5, sx: s.x - pan, sy: s.y, r: 5 };
      }
      const s = lay.star[l.word];
      if (!s) return null;
      const r = s.bright || CUE > 1 ? 9 : 5;                   // (half the star, and a little)
      return { text: l.unknown ? UI_TEXT.notYet : pictureOf(l.word) + l.word, sub: l.quiet || l.unknown || !review ? "" : learnedNote(l.word), x: s.x - pan, y: s.y - r, sx: s.x - pan, sy: s.y, r, unknown: !!l.unknown };
    }).filter(Boolean);
  }

  function nameSpots(w, h) {
    if (!review || tilt < 1) return [];
    const lay = layout(w, h);
    return lay.cons.filter((c) => started(c) && c.cx - pan > 0 && c.cx - pan < lay.w)
      .map((c) => ({ id: c.id, text: c.name, x: c.cx - pan, y: c.nameY, above: c.above, altY: c.nameAlt,
        box: { l: c.box.l - pan, r: c.box.r - pan, t: c.box.t, b: c.box.b },
        ends: [c.topStar, c.bottomStar].map((s) => ({ x: s.x - pan, y: s.y })) }));
  }

  function edges(w, h) {
    if (!review || tilt < 1) return { left: false, right: false };
    const lay = layout(w, h);
    const off = (dir, s) => (dir < 0 ? s.x - pan < 6 : s.x - pan > lay.w - 6);
    const more = (dir) => lay.cons.some((c) => started(c) && c.stars.some((s) => off(dir, s))) || bridgeSpots(lay).some((s) => off(dir, s));
    return { left: more(-1), right: more(1) };
  }

  function pressAt(sx, sy, id) { press = { id, x0: sx, y0: sy, pan0: pan, moved: false }; tour = []; reviewStops = null; }
  function dragTo(sx, sy, id, perPoint) {
    if (!press || press.id !== id || !review || !L) return;
    if (Math.abs(sx - press.x0) > 8 * perPoint) press.moved = true;
    if (press.moved) { pan = clampPan(press.pan0 - (sx - press.x0), L); labels = labels.filter((l) => !l.quiet); }
  }
  function releaseAt(sx, sy, id, reach, w, h) {
    if (!press || press.id !== id) return;
    const p = press;
    press = null;
    whisperAt = clock + 1.2;
    if (!p.moved) tap(sx, sy, reach, w, h);
  }
  const cancelPress = () => { press = null; };
  function lookAt(what) {
    if (!L || !open) return;
    const m = what === "@moon" ? moonSpot(L, moonInfo) : null;
    const x = m ? m.x : what === "@bridge" ? L.bridge && L.bridge.cx : L.con[what] && L.con[what].cx;
    if (x === undefined || x === null) return;
    reviewStops = null;
    glideUntil = clock + 1.3;
    tour = [{ x: pan, at: -10 }, { x: clampPan(x - L.w / 2, L), from: pan, at: clock, secs: 0.9 }];
    labels = []; whisperAt = clock + 1.6;
  }
  function nudge(dir) {
    if (!review || !L) return;
    const to = clampPan(pan + dir * L.w * 0.6, L);
    reviewStops = null;
    glideUntil = clock + 0.9;
    tour = [{ x: pan, at: -10 }, { x: to, from: pan, at: clock, secs: 0.6 }];
    labels = []; whisperAt = clock + 1.4;
  }

  function starAt(x, y, reach, w, h) {
    const lay = layout(w, h);
    y -= Math.round(amount() * h) - h;
    let best = null;
    const consider = (item, sx, sy) => { const d = Math.hypot(sx - x, sy - y); if (d <= reach && (!best || d < best.d)) best = { ...item, d }; };
    for (const c of lay.cons) if (started(c)) for (const s of c.stars) consider({ word: s.word, lit: lit(s.word) }, s.x - pan, s.y);
    for (const r of lay.real) consider({ real: r.id }, r.x - pan, r.y);
    for (const s of bridgeSpots(lay)) consider({ bridge: { kind: s.kind, i: s.i }, species: s.e.species, lit: true }, s.x - pan, s.y);
    const m = moonSpot(lay, moonInfo);
    if (m) { const d = Math.max(0, Math.hypot(m.x - pan - x, m.y - y) - m.r); if (d <= reach && (!best || d < best.d)) best = { moon: true, lit: true, d }; }
    return best;
  }
  function tap(x, y, reach, w, h) {
    const us = pairBox(w, h);
    if (us && x >= us.x && x <= us.x + us.w && y >= us.y && y <= us.y + us.h) { pairTapAt = clock; labels = []; Sound.hearts(); return "us"; }
    const best = starAt(x, y, reach, w, h);
    if (!best) { sparks.push({ x, y, at: clock }); labels = []; return null; }
    labels = [{ word: best.word, real: best.real, moon: best.moon, bridge: best.bridge, tapped: true, unknown: best.word && !best.lit, from: clock, until: clock + (best.lit || best.real ? 2.6 : 1.4) }];
    whisperAt = clock + 2.8;
    Sound.twinkle();
    return best.word || best.real || (best.moon && "moon") || best.species;
  }

  function openCard(id) {
    const lay = L;
    const c = lay && lay.con[id];
    if (!c) return;
    $("sky-card-title").textContent = c.name;
    $("sky-card-korean").textContent = c.korean || "";
    const list = $("sky-card-words"), note = $("sky-card-note");
    list.innerHTML = "";
    note.textContent = "";
    for (const s of c.stars) {
      const b = document.createElement("button");
      const known = !!State.get().learned[s.word];
      b.className = known ? "known" : "unknown";
      b.textContent = known ? pictureOf(s.word) + s.word : "✧";
      b.addEventListener("click", () => {
        note.classList.remove("complete");
        list.querySelectorAll("button").forEach((x) => x.classList.toggle("picked", x === b));
        if (!known) { note.textContent = UI_TEXT.notYet; return; }
        const info = Words.info(s.word), line = (State.get().learnedLine || {})[s.word];
        note.textContent = [learnedNote(s.word), info && info.korean].filter(Boolean).join(" · ");
        if (line) { const q = document.createElement("span"); q.className = "line"; q.textContent = `“${line}”`; note.appendChild(q); }
        Sound.twinkle();
      });
      list.appendChild(b);
    }
    const all = c.stars.length && c.stars.every((s) => !!State.get().learned[s.word]);
    note.classList.toggle("complete", !!all);
    if (all) note.textContent = UI_TEXT.cardComplete;
    $("sky-card").classList.remove("hidden");
    labels = [];
  }
  function closeCard() { const el = $("sky-card"); if (el && !el.classList.contains("hidden")) { el.classList.add("hidden"); whisperAt = clock + 1; } }
  if ($("sky-card-done")) {
    $("sky-card-done").textContent = UI_TEXT.done;
    $("sky-card-done").addEventListener("click", closeCard);
    $("sky-card").addEventListener("pointerdown", (e) => { if (e.target === $("sky-card")) closeCard(); });
  }

  return {
    show: (...a) => { forgetTogether(); return show(...a); },
    close, update, draw, tap, starAt, amount, labelSpots, nameSpots, edges, settled, openCard, pairBox,
    gliding: () => open && (clock < glideUntil || tourMoving() || !!press),
    press: pressAt, drag: dragTo, release: releaseAt, cancelPress, nudge, lookAt,
    moon: () => (open ? moonInfo : null),
    isOpen: () => open, lookingUp: () => open && tilt > 0.5, reviewing: () => open && review,
    visibleStars(w, h) {
      if (!L || !open) return [];
      const top = Math.round(amount() * h) - h, out = [];
      for (const c of L.cons) if (started(c)) for (const s of c.stars) if (s.x - pan > 0 && s.x - pan < w) out.push({ word: s.word, lit: lit(s.word), x: s.x - pan, y: s.y + top });
      for (const r of L.real) if (r.x - pan > 0 && r.x - pan < w) out.push({ real: r.id, lit: true, big: true, x: r.x - pan, y: r.y + top });
      for (const s of bridgeSpots(L)) if (s.x - pan > 0 && s.x - pan < w) out.push({ bridge: s.e.species, lit: true, x: s.x - pan, y: s.y + top });
      const m = moonSpot(L, moonInfo);
      if (m) for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) out.push({ moon: true, lit: true, big: true, x: m.x - pan + dx * m.r, y: m.y + top + dy * m.r });
      return out;
    },
    drawAll(ctx, w, h, opts = {}) {
      const keep = { born, promise, review, porch, clock, pan, bridge, bridgeBorn, moonInfo };
      born = {}; for (const c of layout(w, h).cons) for (const s of c.stars) born[s.word] = opts.words === false ? undefined : -10;
      promise = []; review = false; porch = false; clock = 1;
      bridge = { birds: [], friends: [] }; setBridge(opts.bridge);
      bridgeBorn = { birds: bridge.birds.map(() => -10), friends: bridge.friends.map(() => -10) };
      moonInfo = opts.moonDay !== undefined && typeof Moon !== "undefined" ? Moon.forDay(opts.moonDay) : null;
      const lay = layout(w, h), from = opts.from || 0, to = opts.width ? from + opts.width : lay.skyW;
      for (let x = from; x < to; x += w) {
        pan = x; panGoal = x; tour = [];
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        tilt = 1;
        draw(c.getContext("2d"), w, h, opts.time || 0);
        ctx.drawImage(c, x - from, 0);
      }
      ({ born, promise, review, porch, clock, pan, bridge, bridgeBorn, moonInfo } = keep);
      tilt = 0; panGoal = null;
    },
    bridgeBox: (w, h) => { const a = layout(w, h).bridge; return a && { l: a.x0, r: a.x1, cx: a.cx, slots: a.slots.length, twinkles: a.twinkles.length }; },
    moonSpot: (w, h, day) => (typeof Moon === "undefined" ? null : moonSpot(layout(w, h), Moon.forDay(day))),
    pairSprite: () => { forgetTogether(); return together(); },
    porchSprite: () => { forgetTogether(); return onThePorch(); },
    width: (w, h) => layout(w, h).skyW,
    layoutOf: (w, h) => layout(w, h),
    tooClose(w, h) {
      const lay = layout(w, h), out = [];
      for (const c of lay.cons) for (let i = 0; i < c.stars.length; i++) for (let j = i + 1; j < c.stars.length; j++) {
        const a = c.stars[i], b = c.stars[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 9 * CUE) out.push(`${c.name}: ${a.word} / ${b.word}`);
      }
      for (const c of lay.cons) for (const s of c.stars) if (s.y < 10 * CUE || s.y > h - 36 * CUE) out.push(`${c.name}: ${s.word} is off the edge`);
      for (let i = 0; i < lay.cons.length; i++) for (let j = i + 1; j < lay.cons.length; j++) {
        const A = lay.cons[i], B = lay.cons[j];
        let near = null;
        for (const a of A.stars) for (const b of B.stars) if (Math.hypot(a.x - b.x, a.y - b.y) < 16 * CUE) near = near || `${a.word} / ${b.word}`;
        if (near) out.push(`${A.name} and ${B.name} touch: ${near}`);
      }
      if (lay.bridge) {
        const all = []; for (const c of lay.cons) for (const s of c.stars) all.push([c, s]);
        for (const [what, spots, d] of [["the bridge", lay.bridge.slots, 11], ["a twinkle by the bridge", lay.bridge.twinkles, 7]]) {
          for (const p of spots) for (const [c, s] of all) if (Math.hypot(p.x - s.x, p.y - s.y) < d * CUE) out.push(`${what} touches ${c.name}: ${s.word}`);
        }
        if (lay.bridge.twinkles.length < 24) out.push(`only ${lay.bridge.twinkles.length} spots for twinkles by the bridge`);
      }
      if (typeof Moon !== "undefined") for (const n of window.MOON_NIGHTS || []) {
        const info = Moon.forDay(n.day);
        if (info.up && !moonSpot(lay, info)) out.push(`Day ${n.day}: no clear spot for the moon`);
      }
      return out;
    },
  };
})();
