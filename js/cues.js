
const Cues = (() => {
  const iconCache = {};
  const cueIcon = (name, big = false) => {
    const key = name + (big ? "/big" : "/cue" + CUE);
    return iconCache[key] || (iconCache[key] = iconFromGrid(ICONS[name], big || CUE > 1).toCanvas());
  };

  function guides(ctx, list, time) {
    for (const g of list) {
      if (!((scene.name === "room" || scene.name === "garden") && (scene.name === "room") === !!g.room && (!Speech.isOpen() || g.talking) && !Sky.isOpen())) continue;
      const icon = cueIcon("sparkle");
      const bob = Math.round(Math.sin(time * 3) * 2) * CUE;
      if (list.length === 1 && edge(ctx, g, "sparkle", time)) continue;
      if (g.edgeOnly) continue;
      const blink = g.soft ? Math.sin(time * 2.2) > -0.2 : true;
      if (blink) ctx.drawImage(icon, Math.round(g.x - icon.width / 2), Math.round(g.y - icon.height - 4 * CUE + bob));
    }
  }

  function edge(ctx, g, name, time) {
    const icon = cueIcon(name);
    const bob = Math.round(Math.sin(time * 3) * 2) * CUE;
    const m = 12 * CUE, safe = safeEdges(), k = (window.devicePixelRatio || 1) / scale;   // k: game pixels per point
    const x0 = camera.x + m + safe.left * k, x1 = camera.x + canvas.width - m - safe.right * k;
    const boxTop = speechBoxTop(), bottomEdge = Math.min(canvas.height - safe.bottom * k, boxTop === null ? Infinity : boxTop);
    const y0 = camera.y + m + icon.height + safe.top * k, y1 = camera.y + bottomEdge - m;
    const sprite = g.top !== undefined;
    const hi = sprite ? g.top : g.y - icon.height - 4 * CUE, lo = sprite ? (g.bottom !== undefined ? g.bottom : g.y) : g.y - 4 * CUE;
    const seen = Math.min(lo, camera.y + canvas.height - safe.bottom * k) - Math.max(hi, camera.y + safe.top * k);
    const off = g.x < camera.x + safe.left * k - 6 || g.x > camera.x + canvas.width - safe.right * k + 6
      || seen < (sprite ? Math.min(6 * CUE, (lo - hi) / 2) : lo - hi);
    if (!off) return false;
    let x = Math.max(x0, Math.min(x1, g.x));
    let y = Math.max(y0, Math.min(y1, g.y));
    const onSide = x === x0 || x === x1;
    if (onSide) y = Math.max(camera.y + canvas.height * 0.3, Math.min(camera.y + canvas.height * 0.7, y));   // (the middle of a side edge)
    const place = () => {
      const a = Math.atan2(g.y - y, g.x - x), dir = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
      const arrow = arrowSprite(dir);
      const sx = Math.round(x - icon.width / 2), sy = Math.round(y - icon.height);
      const ax = Math.round(x + Math.cos(dir * Math.PI / 4) * 8 * CUE - arrow.width / 2);
      const ay = Math.round(y - icon.height / 2 + Math.sin(dir * Math.PI / 4) * 8 * CUE - arrow.height / 2);
      const l = Math.min(sx, ax), t = Math.min(sy, ay) - 2 * CUE;
      const box = { x: l, y: t, w: Math.max(sx + icon.width, ax + arrow.width) - l, h: Math.max(sy + icon.height, ay + arrow.height) + 2 * CUE - t };
      return { arrow, sx, sy, ax, ay, box };
    };
    const gap = 3 * CUE, buttons = buttonBoxes("#evening-skip");
    const under = (p) => buttons.find((b) => p.box.x < b.x + b.w + gap && p.box.x + p.box.w > b.x - gap && p.box.y < b.y + b.h + gap && p.box.y + p.box.h > b.y - gap);
    let p = place();
    for (let i = 0, b; i < 8 && (b = under(p)); i++) {
      if (onSide) y = Math.min(y1, y + (b.y + b.h / 2 < camera.y + canvas.height / 2 ? b.y + b.h + gap - p.box.y : b.y - gap - (p.box.y + p.box.h)));
      else x = Math.max(x0, Math.min(x1, x + (b.x + b.w / 2 > camera.x + canvas.width / 2 ? b.x - gap - (p.box.x + p.box.w) : b.x + b.w + gap - p.box.x)));
      p = place();
    }
    ctx.drawImage(icon, p.sx, p.sy + bob);
    ctx.drawImage(p.arrow, p.ax, p.ay + bob);
    shown[name] = { box: { ...p.box, x: p.box.x - camera.x, y: p.box.y - camera.y }, g: { ...g }, at: performance.now() };
    return true;
  }

  const shown = {};
  const drawnNow = (e) => performance.now() - e.at < 250;
  function edgeAt(sx, sy, reach) {
    let best = null;
    for (const name of Object.keys(shown)) {
      const e = shown[name], cx = e.box.x + e.box.w / 2, cy = e.box.y + e.box.h / 2;
      if (!drawnNow(e) || Math.abs(sx - cx) > Math.max(e.box.w, reach) / 2 || Math.abs(sy - cy) > Math.max(e.box.h, reach) / 2) continue;
      const d = Math.hypot(sx - cx, sy - cy);
      if (!best || d < best.d) best = { name, g: e.g, d };
    }
    return best;
  }
  function edgeRects() {
    const cr = canvas.getBoundingClientRect(), k = scale / (window.devicePixelRatio || 1);
    return Object.keys(shown).filter((n) => drawnNow(shown[n])).map((n) => {
      const b = shown[n].box;
      return { name: n, left: cr.left + b.x * k, top: cr.top + b.y * k, right: cr.left + (b.x + b.w) * k, bottom: cr.top + (b.y + b.h) * k };
    });
  }

  const ARROW_STRAIGHT = ["X...", "XX..", "XXX.", "XXXX", "XXX.", "XX..", "X..."];   // pointing right
  const ARROW_SLANT = ["....X", "...XX", "..XXX", ".XXXX", "XXXXX"];                  // pointing down-right
  const arrowCache = {};
  function arrowSprite(dir) {
    const key = dir + "/" + CUE;
    if (arrowCache[key]) return arrowCache[key];
    const turn = (g) => [...g[0]].map((_, x) => g.map((row) => row[x]).reverse().join(""));
    let grid = dir % 2 ? ARROW_SLANT : ARROW_STRAIGHT;
    for (let i = 0; i < Math.floor(dir / 2); i++) grid = turn(grid);
    if (CUE > 1) grid = scale2xGrid(grid);
    const b = new PixelBuffer(grid[0].length, grid.length);
    grid.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "X") b.set(x, y, "starlight"); }));
    return (arrowCache[key] = outline(b).toCanvas());
  }

  let thoughtShown = null;            // where it was drawn last: { box (world pixels), at }
  function thought(ctx, icon, time) {
    const h = companionHeadTop(), her = playerPixelPos(), side = h.x < her.x + 8 ? -1 : 1;
    const room = h.y - (17 * CUE + 2) - camera.y;
    const low = room < 2 ? 2 - room : 0;
    const at = low ? { side, dx: side * 11 * CUE, dy: low } : Wildlife.thoughtSpot(h.x, h.y, side);
    Wildlife.drawThoughtAt(ctx, h.x + (low ? at.dx : 0), h.y + (low ? at.dy : 0), icon, time, at.side, low ? 0 : at.dx, low ? 0 : at.dy);
    const w = 20 * CUE + 2, bh = 17 * CUE + 2, x = h.x + at.dx, y = h.y + at.dy;
    thoughtShown = { box: at.box || { x: at.side < 0 ? x + 2 * CUE - w : x - 2 * CUE, y: y - bh - 1, w, h: bh }, at: performance.now() };
  }
  const thoughtBox = () => (thoughtShown && drawnNow(thoughtShown) ? thoughtShown.box : null);

  return { icon: cueIcon, guides, edge, edgeAt, edgeRects, thought, thoughtBox };
})();
