
const starLabels = [];
const LABEL_SIDES = ["above", "below", "right", "left", "aboveRight", "aboveLeft", "belowRight", "belowLeft"];
const LABEL_ORIGIN = { above: "50% 100%", below: "50% 0", right: "0 50%", left: "100% 50%",     // (it grows out of its star)
  aboveRight: "0 100%", aboveLeft: "100% 100%", belowRight: "0 0", belowLeft: "100% 0" };
const LABEL_FARTHER = [0, 10, 22];               // (points farther out from its star, when the spots next to it are taken)
function placeStarLabels() {
  skipStepsBack();
  const spots = Sky.isOpen() ? Sky.labelSpots(canvas.width, canvas.height) : [];
  const avoid = placeSkyNames();                  // (the names first: the words keep clear of them)
  for (const id of ["sky-left", "sky-right", "menu-button", "back-button", "music-button"]) {
    const el = document.getElementById(id);
    if (!el || el.classList.contains("hidden") || !el.getClientRects().length) continue;
    const r = el.getBoundingClientRect();
    avoid.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  }
  const pt = spots.length ? gameToScreen(1, 0, false).x - gameToScreen(0, 0, false).x : 0;
  const stars = spots.length ? Sky.visibleStars(canvas.width, canvas.height).map((s) => ({ ...gameToScreen(s.x, s.y, false), lit: s.lit, m: (s.big ? 8 : s.lit ? 4.5 : 2.5) * pt })) : [];
  while (starLabels.length < spots.length) {
    const el = document.createElement("div");
    el.className = "star-label";
    document.getElementById("app").appendChild(el);
    starLabels.push(el);
  }
  starLabels.forEach((el, i) => {
    const s = spots[i];
    el.classList.toggle("hidden", !s);
    if (!s) return;
    const key = s.text + "|" + s.sub;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.dataset.spot = "";
      el.textContent = s.text;
      const icon = s.icon && Sky.wordIcon(s.icon, 22);              // (a word with its own pixel picture: the plum)
      if (icon) el.prepend(icon);
      if (s.sub) { const small = document.createElement("small"); small.textContent = s.sub; el.appendChild(small); }
      el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
    }
    el.classList.toggle("unknown", !!s.unknown);
    const at = gameToScreen(s.sx, s.sy, false), gap = gameToScreen(s.sx, s.sy + s.r, false).y - at.y;
    if (at.x < -4 || at.x > window.innerWidth + 4) { el.classList.add("hidden"); return; }      // (its star is off the screen)
    let box = labelSpot(at, el.offsetWidth, el.offsetHeight, gap, stars, avoid, el.dataset.spot, s.tapped);
    const note = el.querySelector("small");
    if (s.tapped && note && note.style.display !== "none" && box.cost >= 100) {
      note.style.display = "none";
      const smaller = labelSpot(at, el.offsetWidth, el.offsetHeight, gap, stars, avoid, el.dataset.spot, s.tapped);
      if (smaller.cost < box.cost) box = smaller; else note.style.display = "";
    }
    if (box.cost >= (s.tapped ? 1000 : 100)) { el.classList.add("hidden"); el.dataset.spot = ""; return; }      // (nowhere free: it waits for its turn)
    el.dataset.spot = box.id;
    el.style.left = `${Math.round(box.l)}px`;
    el.style.top = `${Math.round(box.t)}px`;
    el.style.transformOrigin = LABEL_ORIGIN[box.side];
    avoid.push(box);
  });
}
function labelSpot(at, w, h, gap, stars, avoid, was, tapped) {
  const safe = safeEdges();
  const minX = 8 + safe.left, maxX = window.innerWidth - 8 - safe.right, minY = 6 + safe.top, maxY = window.innerHeight - 6 - safe.bottom;
  const boxes = [];
  LABEL_FARTHER.forEach((more, far) => LABEL_SIDES.forEach((side, i) => {
    if (far > 1 && i > 3 && !tapped) return;        // (at a slant only nearby)
    const g = gap + more, d = g * Math.SQRT1_2;
    const up = side.startsWith("above"), down = side.startsWith("below");
    let l = side === "right" ? at.x + g : side === "left" ? at.x - g - w : side.endsWith("Right") ? at.x + d : side.endsWith("Left") ? at.x - d - w : at.x - w / 2;
    let t = side === "above" ? at.y - g - h : side === "below" ? at.y + g : up ? at.y - d - h : down ? at.y + d : at.y - h / 2;
    const l2 = Math.max(minX, Math.min(maxX - w, l)), t2 = Math.max(minY, Math.min(maxY - h, t));
    let cost = i + far * 8 + (l2 !== l || t2 !== t ? 0.5 : 0);
    l = l2; t = t2;
    const box = { l, t, r: l + w, b: t + h, side, id: side + far };
    if (w > maxX - minX || h > maxY - minY) cost += 1000;
    if (at.x > l - 4 && at.x < l + w + 4 && at.y > t - 4 && at.y < t + h + 4) cost += 300;        // (slid over its own star)
    for (const a of avoid) if (box.l < a.r && box.r > a.l && box.t < a.b && box.b > a.t) cost += 300;          // (a name, a button or a label: worse than a star)
    for (const s of stars) {
      if (Math.hypot(s.x - at.x, s.y - at.y) < gap - 1) continue;            // (its own star: the moon's edge too)
      if (s.x > l - s.m && s.x < l + w + s.m && s.y > t - s.m && s.y < t + h + s.m) cost += s.lit ? 100 : 30;
    }
    box.cost = cost;
    boxes.push(box);
  }));
  const kept = boxes.find((b) => b.id === was && b.cost < 30);
  const best = kept || boxes.reduce((a, b) => (b.cost < a.cost ? b : a));
  const dx = best.l < minX ? minX - best.l : best.r > maxX ? maxX - best.r : 0;
  const dy = best.t < minY ? minY - best.t : best.b > maxY ? maxY - best.b : 0;
  return { ...best, l: best.l + dx, r: best.r + dx, t: best.t + dy, b: best.b + dy };
}
function placeSkyNames() {
  const boxes = [];
  const names = Sky.isOpen() ? Sky.nameSpots(canvas.width, canvas.height) : [];
  while (nameLabels.length < names.length) {
    const el = document.createElement("button");
    el.className = "sky-name";
    const toSky = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * canvas.width, (e.clientY - r.top) / r.height * canvas.height]; };
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation(); e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* (not a live pointer) */ }
      el._down = { x: e.clientX, y: e.clientY };
      Sky.press(...toSky(e), e.pointerId);
    });
    el.addEventListener("pointermove", (e) => { if (el._down) Sky.drag(...toSky(e), e.pointerId, (window.devicePixelRatio || 1) / scale); });
    el.addEventListener("pointerup", (e) => {
      const d = el._down;
      el._down = null;
      if (!d) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) { Sky.release(...toSky(e), e.pointerId, 0, canvas.width, canvas.height); return; }
      Sky.cancelPress();
      Sky.openCard(el.dataset.id);
      Sound.tap(900);
    });
    document.getElementById("app").appendChild(el);
    nameLabels.push(el);
  }
  const avoid = [];
  for (const id of ["menu-button", "back-button", "music-button"]) {
    const el = document.getElementById(id);
    if (!el || el.classList.contains("hidden") || !el.getClientRects().length) continue;
    const r = el.getBoundingClientRect();
    avoid.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  }
  const pb = Sky.isOpen() && Sky.pairBox(canvas.width, canvas.height);
  const pair = pb && (() => { const a = gameToScreen(pb.x, pb.y, false), b = gameToScreen(pb.x + pb.w, pb.y + pb.h, false); return { l: a.x, t: a.y, r: b.x, b: b.y }; })();
  if (pair) { avoid.push(pair); boxes.push(pair); }
  const hits = (box) => avoid.some((a) => box.l < a.r && box.r > a.l && box.t < a.b && box.b > a.t);
  const skyStars = names.length ? Sky.visibleStars(canvas.width, canvas.height).map((s) => gameToScreen(s.x, s.y, false)) : [];
  const onStar = (b) => skyStars.some((s) => s.x > b.l - 6 && s.x < b.r + 6 && s.y > b.tapT - 6 && s.y < b.tapB + 6);
  nameLabels.forEach((el, i) => {
    const n = names[i];
    el.classList.toggle("hidden", !n);
    if (!n) return;
    if (el.dataset.id !== n.id) { el.dataset.id = n.id; el.textContent = n.text; }
    const w = el.offsetWidth, h = el.offsetHeight;
    const place = (x, y, above) => {
      const p = keepOnScreen({ x, y }, w, h, above), top = above ? p.y - h : p.y;
      return { x: p.x, y: p.y, above, l: p.x - w / 2, r: p.x + w / 2, t: above ? top + h - 24 : top, b: above ? top + h : top + 24, tapT: top, tapB: top + h };      // (t, b: its words, at the edge by its figure)
    };
    const beside = (x, y) => {
      const p = keepOnScreen({ x, y: y - h / 2 }, w, h, false);
      return { x: p.x, y: p.y, above: false, side: true, l: p.x - w / 2, r: p.x + w / 2, t: p.y + h / 2 - 12, b: p.y + h / 2 + 12, tapT: p.y, tapB: p.y + h };
    };
    const at = gameToScreen(n.x, n.y, false), alt = gameToScreen(n.x, n.altY, false);
    const tries = [place(at.x, at.y, n.above), place(alt.x, alt.y, !n.above)];
    for (const e of n.ends) { const p = gameToScreen(e.x, e.y, false), dx = w / 2 + 10; tries.push(beside(p.x - dx, p.y), beside(p.x + dx, p.y)); }
    const fig = { l: gameToScreen(n.box.l, 0, false).x, r: gameToScreen(n.box.r, 0, false).x };
    const near = (b) => b.l < fig.r + 12 && b.r > fig.l - 12;                   // (it still belongs to its figure)
    const ok = (b) => !hits(b) && !onStar(b) && near(b), was = tries[+el.dataset.pick];
    const moving = Sky.gliding();                   // (at rest, a name goes home to its own side when that's clear)
    const pick = (moving && was && el.dataset.for === n.id && ok(was) && was) || tries.find(ok);
    if (!pick) { el.classList.add("hidden"); el.dataset.pick = ""; return; }      // (nowhere by its figure: until the view moves)
    el.dataset.pick = tries.indexOf(pick);
    el.dataset.for = n.id;
    el.style.left = `${Math.round(pick.x)}px`;
    el.style.top = `${Math.round(pick.y)}px`;
    el.classList.toggle("above", !!pick.above);
    el.classList.toggle("side", !!pick.side);
    const box = { l: pick.l, t: pick.t, r: pick.r, b: pick.b };
    avoid.push(box);
    boxes.push(box);
  });
  const ed = Sky.isOpen() ? Sky.edges(canvas.width, canvas.height) : { left: false, right: false };
  const stars = ed.left || ed.right ? Sky.visibleStars(canvas.width, canvas.height).filter((s) => s.lit).map((s) => ({ ...gameToScreen(s.x, s.y, false), big: s.big })) : [];
  for (const [id, show] of [["sky-left", ed.left], ["sky-right", ed.right]]) {
    const el = document.getElementById(id);
    el.classList.toggle("hidden", !show);
    if (!show) continue;
    const icon = el.firstChild, dpr = window.devicePixelRatio || 1, k = Math.round(scale);          // (a doubled icon on the sky's pixel grid: a cue)
    if (icon && icon.dataset.k !== String(k)) { icon.dataset.k = k; icon.style.width = (icon.width * k) / dpr + "px"; icon.style.height = (icon.height * k) / dpr + "px"; }
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2;
    const clear = (f) => !stars.some((s) => Math.hypot(s.x - cx, s.y - window.innerHeight * f) < (s.big ? 48 : 44));
    const was = parseFloat(el.dataset.f) || 0.5;
    if (el.dataset.f && Sky.gliding()) continue;              // (it stays under her thumb while the sky glides from its tap)
    const f = clear(was) ? was : [0.5, 0.7, 0.3, 0.62, 0.38].find(clear) || was;
    if (f !== was || !el.dataset.f) { el.dataset.f = f; el.style.top = `${2 * Math.round((window.innerHeight * f) / 2)}px`; }       // (on an even point: the sky's grid)
  }
  return boxes;
}
const nameLabels = [];
function skipStepsBack() {
  const el = document.getElementById("evening-skip");
  if (!el) return;
  let under = false;
  if (Sky.isOpen() && !el.classList.contains("hidden")) {
    const r = el.getBoundingClientRect();
    under = Sky.visibleStars(canvas.width, canvas.height).some((s) => {
      if (!s.lit) return false;
      const p = gameToScreen(s.x, s.y, false), pad = gameToScreen(s.x + (s.big ? 8 : 5), s.y, false).x - p.x;     // (half the star, and a little)
      return p.x > r.left - pad && p.x < r.right + pad && p.y > r.top - pad && p.y < r.bottom + pad;
    });
  }
  if (under === (el.dataset.stepsBack === "1")) return;
  el.dataset.stepsBack = under ? "1" : "";
  el.style.transition = "opacity 0.3s";
  el.style.opacity = under ? "0" : "";
  el.style.pointerEvents = under ? "none" : "";
}
function keepOnScreen(p, w, h, up) {
  const top = up ? p.y - h : p.y, corner = top < 64 ? 64 : 0, safe = safeEdges();
  const x = Math.max(w / 2 + 8 + corner, Math.min(window.innerWidth - w / 2 - 8 - corner, p.x));
  const y = up ? Math.max(h + safe.top, p.y) : Math.min(window.innerHeight - safe.bottom - h + 6, p.y);     // (clear of the home bar)
  return { x, y };
}
for (const [id, dir] of [["sky-left", -1], ["sky-right", 1]]) {
  const el = document.getElementById(id);
  el.textContent = "";
  const icon = iconFromGrid(dir < 0 ? ICONS.chevronLeft : ICONS.chevronRight, true).toCanvas();
  el.appendChild(icon);                       // (sized on the sky's pixel grid when it shows)
  el.addEventListener("pointerdown", (e) => {
    e.stopPropagation(); e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * canvas.width, sy = ((e.clientY - r.top) / r.height) * canvas.height;
    const reach = Math.max(8, minTap() / 2);
    const hit = Sky.starAt(sx, sy, reach, canvas.width, canvas.height);
    if (hit && (hit.lit || hit.real)) { Sky.tap(sx, sy, reach, canvas.width, canvas.height); return; }          // (not a faint dot)
    Sky.nudge(dir); Sound.tap(800);
  });
}
