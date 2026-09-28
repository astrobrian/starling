
const dollCache = {};

function renderDoll(id, view = "sit") {
  const key = `${id}/${view}`;
  if (!dollCache[key]) dollCache[key] = drawDoll(id, view);
  return dollCache[key];
}

const DOLL_LOOKS = {
  moose: { body: "bark", belly: "wood", head: "bark", feet: "hair", extraTop: 8 },
  triceratops: { body: "skyBlue", belly: "cream", head: "skyBlue", feet: "skyBlue", extraTop: 5 },
  lion: { body: "butter", belly: "cream", head: "butter", feet: "butter", extraTop: 3 },
  tiger: { body: "snow", belly: "cream", head: "snow", feet: "snow", extraTop: 1 },
  rabbit: { body: "petalPink", belly: "petalPink", head: "snow", feet: "snow", paws: "snow", extraTop: 7 },
};

function drawDoll(id, view) {
  const look = DOLL_LOOKS[id] || DOLL_LOOKS.lion;
  const side = view === "side", back = view === "back";
  const W = id === "moose" ? 20 : 18, top = look.extraTop;
  const H = 14 + top;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, hy = top + 4.6, by = top + 10.6;
  const head = [side ? cx + 1 : cx, hy, 4.6, 4.3];

  if (id === "lion") {
    const mx = side ? cx + 0.5 : cx;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
      b.circle(mx + Math.cos(a) * 4.9, hy + 0.2 + Math.sin(a) * 4.6, 2.0, "peach", { shadeAs: [mx, hy - 1, 8, 7.5] });
    }
  }
  if (id === "triceratops") {
    const fx = side ? cx - 1.5 : cx, frill = side ? [fx, hy - 1.2, 4, 5.8] : [fx, hy - 1.4, 7.4, 5.8];
    b.ellipse(...frill, RAMPS.skyBlue[3], { flat: true, clip: (x, y) => y < hy + 1.5 });
    const n = side ? 4 : 7;
    for (let i = 0; i < n; i++) {
      if (!side && !back && i >= 2 && i <= 4) continue;      // the top of the frill stays clear for the horns
      const a = side ? Math.PI * (0.55 + i * 0.28) : Math.PI * (1 + i / (n - 1));
      b.set(frill[0] + Math.cos(a) * (frill[2] - 0.8), frill[1] + Math.sin(a) * (frill[3] - 0.8), "cream");
    }
  }
  if (!back && !side && id === "lion") { b.line(cx + 4.5, by + 2, cx + 6.8, by - 1, 1, "butter"); b.circle(cx + 7, by - 1.6, 1.2, "clay"); }
  if (side) {
    const tail = { moose: null, triceratops: "skyBlue", lion: "butter", tiger: "snow" }[id];
    if (id === "rabbit") b.circle(cx - 4.4, by + 1.2, 1.5, "snow");
    if (tail) b.line(cx - 4.5, by + 1.5, cx - 7, by + 0.5, 2, tail, { flat: false });
    if (id === "lion") b.circle(cx - 7.2, by, 1.3, "clay");
  }

  const body = side ? [cx - 0.5, by, 3.8, 3.2] : [cx, by, 4.2, 3.4];
  b.ellipse(...body, look.body);
  if (!back && !side) b.ellipse(cx, by + 0.6, 2.6, 2.2, look.belly, { onlyFilled: true, shadeAs: body });
  if (id === "rabbit") {
    for (let x = 0; x < W; x += 2) if (b.get(x, Math.round(by + 2.6))) b.set(x, Math.round(by + 2.6), RAMPS.petalPink[0]);
  }
  const paws = look.paws || look.body;
  if (!side) {
    b.ellipse(cx - 4.2, by, 1.5, 1.8, paws);
    if (view === "wave") b.ellipse(cx + 4.6, by - 4.2, 1.5, 1.9, paws);
    else b.ellipse(cx + 4.2, by, 1.5, 1.8, paws);
    b.ellipse(cx - 2.3, by + 3, 1.7, 1.2, look.feet);
    b.ellipse(cx + 2.3, by + 3, 1.7, 1.2, look.feet);
  } else {
    b.ellipse(cx + 1.6, by + 3, 1.9, 1.2, look.feet);
    b.ellipse(cx + 2.4, by + 0.4, 1.4, 1.6, paws);
  }

  b.ellipse(...head, look.head);
  if (id === "moose") {
    if (!back) b.ellipse(side ? head[0] + 2.6 : cx, hy + 2, side ? 2.6 : 3, 2, "path", { onlyFilled: side ? false : true, shadeAs: head });
    for (const s of side ? [-1, 1] : [-1, 1]) {
      if (!side || s < 0) b.ellipse(cx + s * 4.8, hy - 0.2, 1.6, 1, "bark");
      const px0 = (side ? head[0] : cx) + s * 5.6;
      b.line(cx + s * 1.5, top + 1.5, px0 - s * 1.5, top - 2.5, 1.4, "wood");
      b.ellipse(px0, top - 3.2, 3.4, 1.7, "wood", { shadeAs: [px0 - 1, top - 4.2, 3.4, 2] });
      for (const dx of [3.5, 5.5, 7.5]) b.rect((side ? head[0] : cx) + s * dx - 0.5, top - 6.2, 1, 2, "wood", { flat: true });
    }
  }
  if (id === "triceratops") {
    if (!back) {
      if (side) {
        b.triangle(head[0] + 0.2, hy - 3, head[0] + 2, hy - 3, head[0] + 2.9, hy - 8.6, "cream");
        b.triangle(head[0] + 4, hy + 0.5, head[0] + 4, hy + 2, head[0] + 6, hy + 0.3, "cream");
      } else {
        for (const s of [-1, 1]) {
          const bx = s < 0 ? cx - 3 : cx + 1;
          b.rect(bx, hy - 5.1, 2, 2, "cream", { shadeAs: [cx, hy - 5, 4, 3] });
          b.rect(s < 0 ? bx : bx + 1, hy - 8.1, 1, 3, "cream", { shadeAs: [cx, hy - 5, 4, 3] });
        }
        b.rect(cx - 1, hy + 1.4, 2, 1, "cream", { flat: true });
      }
    }
    const fx = side ? cx - 3 : cx + 5.6, fy = side ? hy - 4.4 : hy - 1.2;
    for (const [dx, dy] of [[-1.3, 0], [1.3, 0], [0, -1.3], [0, 1.3]]) b.circle(fx + dx, fy + dy, 1.05, "petalPink", { flat: true });
    b.set(fx, fy, "butter");
  }
  if (id === "lion") {
    for (const s of side ? [-1] : [-1, 1]) b.circle(cx + s * 3.4, hy - 5.6, 1.4, "butter");
  }
  if (id === "rabbit") {
    for (const s of side ? [1] : [-1, 1]) {
      const ex = side ? head[0] + 0.6 : cx + s * 2.2;
      b.rotEllipse(ex, hy - 6.4, 1.4, 3.6, side ? 0.12 : s * 0.25, "snow");
      b.ellipse(ex + s * 1.9, hy - 9.6, 1.3, 1, "snow");
      if (!back && !side) b.line(ex + s * 0.2, hy - 8.4, ex, hy - 4.2, 1, "petalPink");
    }
  }
  if (id === "tiger") {
    for (const s of side ? [-1] : [-1, 1]) {
      b.circle(cx + s * 3.6, hy - 3.8, 1.6, "snow");
      b.set(cx + s * 3.6 - 0.5, hy - 3.8, "petalPink");
    }
    for (const [dx, dy] of [[-3.4, -0.5], [-2.8, -0.5], [3.4, -0.5], [2.8, -0.5], [-3, 1], [3, 1]]) b.set(body[0] + dx, by + dy, PALETTE.plum);
  }

  const out = outline(b);
  if (id === "tiger") {
    const ex = Math.round(head[0]) + 1, ey = Math.round(hy) + 1;
    if (back || side) {
      const marks = back ? [[-1.5, -3], [-1.5, -2], [0, -3.6], [0, -2.6], [1.5, -3], [1.5, -2], [-3.4, 0], [-2.6, 0], [3.4, 0], [2.6, 0]]
        : [[0, -3.6], [0, -2.6], [-1.5, -3.2], [-1.5, -2.2], [-3.2, 0], [-2.4, 0.2]];
      for (const [dx, dy] of marks) out.set(head[0] + dx + 1, hy + dy + 1, "plum");
    } else {
      for (const [dx, dy] of [[-1, -5], [0, -5], [-3, -4], [-3, -3], [2, -4], [2, -3], [-5, -1], [-5, 0], [4, -1], [4, 0]]) out.set(ex + dx, ey + dy, "plum");
    }
  }
  if (!back) {
    const ex = Math.round(head[0]) + 1, ey = Math.round(hy) + 1;
    const eyes = side ? [ex + 2] : [ex - 2, ex + 1];
    for (const x of eyes) { out.set(x, ey - 1, "plum"); out.set(x, ey, "plum"); }
    const blushAt = side ? [[ex + 1, ey + 2]] : [[ex - 3, ey + 2], [ex + 2, ey + 2]];
    for (const [x, y] of blushAt) out.set(x, y, "blush");
    if (id === "lion" || id === "tiger" || id === "rabbit") out.set(side ? ex + 4 : ex - 0.5, ey + 1, id === "lion" ? "bark" : "petalPink");
    if (id === "moose" && !side) { out.set(ex - 1, ey + 2, RAMPS.path[3]); out.set(ex, ey + 2, RAMPS.path[3]); }
  }
  if (view === "head") {
    const cut = Math.round(hy + 3.2) + 1;
    for (let y = cut; y < out.h; y++) for (let x = 0; x < out.w; x++) out.set(x, y, null);
    return { canvas: out.toCanvas(), ax: Math.round(W / 2) + 1, ay: cut };
  }
  return { canvas: out.toCanvas(), ax: Math.round(W / 2) + 1, ay: H + 1 };
}

function dollText(key, id) {
  const his = window.HUSBAND && HUSBAND.doll;
  const d = (window.DOLLS || []).find((x) => x.id === id) || (his && his.id === id ? his : null);
  if (!d) return "";
  const he = d.he === "she" ? "she" : "he";
  return (DOLL_TEXT[key] || "").replace(/\{name\}/g, d.name).replace(/\{kind\}/g, d.kind)
    .replace(/\{He\}/g, he[0].toUpperCase() + he.slice(1)).replace(/\{he\}/g, he);
}

const Dolls = (() => {
  const where = {};                 // id -> "bench" | "back" | "bed" | "snuggled"
  const hops = {};                  // id -> { from, to, t, dur, then }
  let wave = 0;                     // seconds left of waving goodbye
  const liftTrail = [];             // her body's lift over the last moments (for the bob)

  const ids = () => (window.DOLLS || []).map((d) => d.id);
  const room = () => ensureScene("room").world;
  const carried = () => ids().find((id) => where[id] === "back") || null;

  function reset(pickedToday = null) {
    for (const id of ids()) where[id] = pickedToday ? (id === pickedToday ? "back" : "bed") : "bench";
    for (const k of Object.keys(hops)) delete hops[k];
    wave = 0;
  }

  function spot(id, place) {
    const i = ids().indexOf(id);
    const t = (type) => room().things.find((x) => x.type === type);
    if (place === "bench") {
      const bench = t("dollBench");
      return bench ? { x: bench.footX - 18 + i * 12, y: bench.footY - 7, sortY: bench.footY + 0.4 + (3 - i) * 0.01 } : null;
    }
    const bed = t("bed");
    if (!bed) return null;
    const wide = bed.w * TILE, left = bed.footX - wide / 2 - 1, topY = bed.footY - 44;
    if (place === "bed") {
      const others = ids().filter((d) => where[d] !== "back" && !(hops[d] && hops[d].place === "back"));
      const k = Math.max(0, others.indexOf(id)) % 3;
      return { x: left + [0.25, 0.5, 0.75][k] * wide + 1, y: topY + 36 - (k % 2) * 3, sortY: bed.footY + 0.6 + [0.02, 0.01, 0.03][k] };
    }
    if (place === "snuggled") {
      const [sx, sy] = SNUGGLE[i] || SNUGGLE[0];
      const order = i === 0 ? 0.09 : i * 0.01;
      return { x: left + sx, y: topY + sy, sortY: bed.footY + 0.7 + order };
    }
    return null;
  }
  const SNUGGLE = [[8, 43], [17, 44], [34, 44], [43, 43]], STRAWBERRY_SNUGGLE = [25.5, 43];

  function hopTo(id, place, delay = 0, then = null) {
    const from = where[id] === "back" ? herBackPoint() : spot(id, where[id]);
    const to = place === "back" ? herBackPoint() : spot(id, place);
    if (!from || !to) { where[id] = place; if (then) then(); return; }
    hops[id] = { from, to, place, t: -delay, dur: 0.55, then };
  }

  function herBackPoint() {
    const p = playerPixelPos();
    return { x: p.x + 8, y: p.y - TILE + 26, sortY: p.y + TILE + 0.3 };
  }

  function update(dt) {
    wave = Math.max(0, wave - dt);
    const now = performance.now() / 1000;
    liftTrail.push({ t: now, lift: playerPose().lift });
    while (liftTrail.length > 30) liftTrail.shift();
    for (const [id, h] of Object.entries(hops)) {
      h.t += dt;
      if (h.t >= h.dur) {
        delete hops[id];
        where[id] = h.place;
        if (h.place !== "back") Sound.tap(900);
        if (h.then) h.then();
      }
    }
  }

  function laggingLift() {
    const now = performance.now() / 1000;
    for (let i = liftTrail.length - 1; i >= 0; i--) if (now - liftTrail[i].t >= 0.12) return liftTrail[i].lift;
    return 0;
  }

  function items() {
    const out = [];
    for (const id of ids()) {
      const h = hops[id];
      if (h) {
        if (h.t < 0) { if (where[id] !== "back") out.push(itemAt(id, spot(id, where[id]), "sit")); continue; }
        const k = Math.max(0, h.t / h.dur), e = k * k * (3 - 2 * k);
        const behindHer = h.place === "back" && k > 0.5 && player.facing !== "up";
        const p = { x: h.from.x + (h.to.x - h.from.x) * e, y: h.from.y + (h.to.y - h.from.y) * e - Math.sin(k * Math.PI) * 12,
          sortY: behindHer ? playerPixelPos().y + TILE - 0.3 : 1e6 };
        out.push(itemAt(id, p, "sit"));
        continue;
      }
      const place = where[id];
      if (place === "back") continue;
      const s = spot(id, place);
      if (!s) continue;
      const view = place === "snuggled" ? "head" : place === "bench" && wave > 0 && Math.floor(wave * 5) % 2 ? "wave" : "sit";
      const bob = place === "bed" ? Math.round(Math.abs(Math.sin(performance.now() / 380 + ids().indexOf(id)))) : 0;
      out.push(itemAt(id, { ...s, y: s.y - bob }, view));
    }
    const bed = room().things.find((t) => t.type === "bed");
    const rabbit = window.HUSBAND && HUSBAND.doll && HUSBAND.doll.id;
    if (bed && bed.variant === 2 && rabbit && scene.name === "room") {
      const [sx, sy] = STRAWBERRY_SNUGGLE, wide = bed.w * TILE;
      out.push(itemAt(rabbit, { x: bed.footX - wide / 2 - 1 + sx, y: bed.footY - 44 + sy, sortY: bed.footY + 0.75 }, "head"));
    }
    return out;
  }

  function itemAt(id, p, view) {
    const sp = renderDoll(id, view);
    return { bottom: p.sortY, draw: () => ctx.drawImage(sp.canvas, Math.round(p.x - sp.ax), Math.round(p.y - sp.ay)), doll: id, box: { x: p.x - sp.ax, y: p.y - sp.ay, sp } };
  }

  function at(gx, gy, minTapPx) {
    let hit = null;
    for (const it of items()) {
      if (!it.box) continue;                   // her sleeping face, not a doll
      const { x, y, sp } = it.box;
      if (isSolid(sp.canvas, gx - Math.round(x), gy - Math.round(y)) && (!hit || it.bottom > hit.bottom)) hit = it;
    }
    if (hit) return { id: hit.doll, x: hit.box.x + hit.box.sp.canvas.width / 2, y: hit.box.y };
    let near = null;
    for (const it of items()) {
      if (!it.box) continue;
      const { x, y, sp } = it.box;
      const cx = x + sp.canvas.width / 2, cy = y + sp.canvas.height / 2;
      if (Math.abs(gx - cx) > Math.max(sp.canvas.width, minTapPx) / 2 || Math.abs(gy - cy) > Math.max(sp.canvas.height, minTapPx) / 2) continue;
      const d = Math.hypot(gx - cx, gy - cy);
      if (!near || d < near.d) near = { id: it.doll, x: cx, y, d };
    }
    return near;
  }

  const CARRY = {
    moose: { back: [11, 21], front: [16, 20], side: [16, 20] },
    other: { back: [11, 28], front: [16, 23], side: [16, 26] },        // from behind: low and to one side, so its face isn't under her hair
    rabbit: { back: [11, 28], front: [16, 23], side: [18, 26] },       // Strawberry, on his back (her ear clears his hair in profile)
  };

  function drawOnHer(ctx2, herX, herTop, facing, behind, bob = null) {
    const id = carried();
    const him = typeof Husband !== "undefined" && ["together", "coming", "leaving", "routine"].includes(Husband.state()) ? Husband.pos() : null;
    if (id) drawOnBack(ctx2, id, herX, herTop, facing, behind, bob === null ? laggingLift() : bob, him && him.x > herX ? "left" : "right");
  }

  function drawOnBack(ctx2, id, herX, herTop, facing, behind, bob = 0, peek = "right") {
    const front = facing === "down", backView = facing === "up";
    if (behind !== !backView) return;
    const pos = (CARRY[id] || CARRY.other)[backView ? "back" : front ? "front" : "side"];
    const sp = renderDoll(id, backView || front ? "sit" : "side");
    const y = Math.round(herTop + pos[1] - bob - sp.ay);
    if (facing === "right" || (front && peek === "left")) {
      const x = Math.round(herX + 16 - pos[0]);
      ctx2.save();
      ctx2.translate(x + sp.ax, y);
      ctx2.scale(-1, 1);
      ctx2.drawImage(sp.canvas, 0, 0);
      ctx2.restore();
    } else {
      const x = Math.round(herX + pos[0] - sp.ax);
      ctx2.drawImage(sp.canvas, x, y);
    }
  }

  return {
    reset, hopTo, update, items, at, drawOnHer, drawOnBack, carried, laggingLift,
    where: (id) => where[id],
    goingTo: (id) => (hops[id] ? hops[id].place : where[id]),     // where it is, or where it's hopping to
    set: (id, place) => { where[id] = place; },
    snuggleSpots: () => ({ dolls: SNUGGLE, strawberry: STRAWBERRY_SNUGGLE }),
    waveGoodbye: (seconds = 1.4) => { wave = seconds; },
    ids,
  };
})();
