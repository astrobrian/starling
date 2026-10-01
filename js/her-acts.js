
const Player = (() => {
  const TIME = { sing: 2.6, drink: 1.6, pour: 2.2, throw: THROW.dur, kiss: 1.5 };
  const TURN = { down: "left", left: "up", up: "right", right: "down" };        // spinning round to her right
  const HOP = 0.3, JUMP = 0.42;

  function act(name, opts = {}) {
    stop();
    if (!name) return Promise.resolve();
    let wait = 0;
    if (player.sitting && !["sing", "drink"].includes(name)) { standUp(); wait = 0.25; }
    const a = { name, opts, t: -wait, n: 0, facing: player.sitting ? "down" : player.facing, resolve: null };
    a.dur = name === "jump" ? (opts.count || 2) * JUMP : name === "dance" ? 4 * HOP + 0.55 : opts.seconds || TIME[name] || 1.5;
    if ((name === "sing" || name === "drink") && a.facing === "up") a.facing = "down";      // (she turns to us)
    if (name === "kiss") a.facing = opts.face || (a.facing === "left" ? "left" : "right");
    const holding = State.get().holding;
    if (name === "drink") a.item = [opts.item, "cup", holding, "water", "berry"].find((i) => i && ICONS[i]);
    if (name === "pour") {
      const p = playerPixelPos();
      a.facing = opts.to ? (opts.to.x < p.x + 8 ? "left" : "right") : a.facing === "left" ? "left" : "right";
      a.item = opts.item || holding || "wateringCan";
      a.high = !!opts.to && opts.to.y < p.y + 14 - POUR_HIGH_ABOVE;
      if (!/^seeds(:|$)/.test(a.item)) Sound.splash();
    }
    if (name === "throw") {
      const p = playerPixelPos();
      a.facing = opts.to ? (opts.to.x < p.x + 8 ? "left" : "right") : a.facing === "left" ? "left" : "right";
    }
    player.act = a;
    return new Promise((resolve) => { a.resolve = resolve; });
  }

  function stop() {
    const a = player.act;
    if (!a) return;
    player.act = null;
    if (a.resolve) a.resolve();
  }

  function update(dt) {
    const a = player.act;
    if (!a) return;
    if (a.t >= 0 && (isMoving() || player.path.length)) { stop(); return; }     // she walked off
    a.t += dt;
    if (a.name === "sing" && a.t >= 0 && a.t >= (a.nextNote || 0) && a.t < a.dur - 0.3) {
      const side = a.facing === "left" ? -1 : a.facing === "right" ? 1 : 0, dir = side || (a.n % 2 ? 1 : -1);
      (player.cueQueue || (player.cueQueue = [])).push({ kind: "note", dir, dx: side ? side * 3 : dir * 9 });
      Sound.note(a.n);
      a.n++;
      a.nextNote = a.t + 0.5;
    }
    if (a.name === "dance" && !a.hearted && a.t >= 4 * HOP) { a.hearted = true; showEmote("player", "heart"); }
    if (a.name === "throw" && !a.released && a.t >= THROW.release) {
      a.released = true;                                                          // the stone leaves her hand
      const p = playerPixelPos(), hx = a.facing === "left" ? THROW_HAND.x : 16 - 1 - THROW_HAND.x;
      if (a.opts.onRelease) a.opts.onRelease({ x: Math.round(p.x) + hx, y: Math.round(p.y) - TILE + THROW_HAND.y });
    }
    if (a.t >= a.dur) stop();
  }

  function frame() {
    const a = player.act;
    if (!a || a.t < 0) return null;
    const S = PLAYER_SPRITES, A = S.acts, t = a.t, f = a.facing;
    const ease = Math.max(0, Math.min(1, t / 0.25, (a.dur - t) / 0.3));        // lifting up, then down again
    if (a.name === "sing") {
      const k = Math.floor(t / 0.4) % 2;
      if (player.sitting) return { sprite: A.sing.sit[k], lift: 0, facing: "down" };
      return { sprite: (A.sing[f] || S[f])[k] || S[f][0], lift: 0, facing: f };
    }
    if (a.name === "dance") {
      const i = Math.floor(t / HOP);
      if (i < 4) {
        let face = f;
        for (let j = 0; j <= i; j++) face = TURN[face];
        const lift = Math.round(Math.sin(((t % HOP) / HOP) * Math.PI) * 3);
        return { sprite: lift > 0 ? S[face][1 + (i % 2)] : S[face][0], lift, facing: face };
      }
      const cf = A.cheer[f] ? f : "down";
      return { sprite: A.cheer[cf], lift: 0, facing: cf };
    }
    if (a.name === "jump") {
      const jf = A.cheer[f] ? f : "down";
      const k = t % JUMP, lift = k < 0.34 ? Math.round(Math.sin((k / 0.34) * Math.PI) * 5) : 0;
      return { sprite: lift > 1 ? A.cheer[jf] : S[jf][0], lift, facing: jf };
    }
    if (a.name === "drink") {
      const closed = ease > 0.9;                                                    // (eyes closed while she sips)
      const sprite = player.sitting ? (closed ? S.blink.sit : S.sit) : (closed && S.blink[f]) || S[f][0];
      return { sprite, lift: 0, facing: player.sitting ? "down" : f, raise: ease };
    }
    if (a.name === "pour") return { sprite: ((a.high ? A.pourHigh : A.pour) || {})[f] || S[f][0], lift: 0, facing: f, tip: ease };
    if (a.name === "throw") return { sprite: renderPlayerThrow()[f][throwStep(t)], lift: 0, facing: f };
    if (a.name === "kiss") return { sprite: (t > 0.15 && A.kiss && A.kiss[f]) || S[f][0], lift: 0, facing: f };
    return null;
  }

  function drawHeld(ctx2, p, pose) {
    const a = player.act;
    if (!a || !pose || (a.name !== "drink" && a.name !== "pour")) return false;
    const side = pose.facing === "left" ? -1 : pose.facing === "right" ? 1 : 0;
    const herTop = Math.round(p.y) - TILE - pose.lift;
    if (a.name === "drink") {
      if (!a.item) return true;
      const name = a.item === "cup" && ICONS.cupSip ? "cupSip" : a.item, flip = name === "cupSip" && side > 0;
      const key = name + (flip ? "~flip" : "");
      const icon = heldIcons[key] || (heldIcons[key] = iconFromGrid(flip ? { ...ICONS[name], grid: ICONS[name].grid.map((r) => [...r].reverse().join("")) } : ICONS[name]).toCanvas());
      const y = herTop + 20 - Math.round(pose.raise * 4);                         // from her chest up to her lips
      ctx2.drawImage(icon, Math.round(p.x + 8 + side * 8 - icon.width / 2), Math.round(y - icon.height / 2));
      return true;
    }
    const dir = side || 1, steps = Math.min(a.high ? 1 : 3, Math.round(pose.tip * 3));
    const can = tiltedHeld(a.item, steps, dir), H = a.high ? POUR_HAND_HIGH : POUR_HAND;
    const hx = Math.round(p.x) + (dir > 0 ? 16 - H.x : H.x), hy = herTop + H.y;
    const x = Math.round(hx - can.grip.x), y = Math.round(hy - can.grip.y);
    ctx2.drawImage(can.canvas, x, y);
    a.spout = steps >= (a.high ? 1 : 2) && pose.tip > 0.5 && can.spout ? { x: x + can.spout.x, y: y + can.spout.y, dir } : null;
    return true;
  }

  function drawOver(ctx2, time) {
    const a = player.act;
    if (!a || a.name !== "pour" || !a.spout) return;
    const p = playerPixelPos();
    const to = a.opts.to || { x: a.spout.x + a.spout.dir * 6, y: p.y + 13 };
    drawPourStream(ctx2, a.item, a.spout, { x: to.x, y: a.high ? to.y : Math.max(to.y, a.spout.y + 4) }, time, a.t);
  }

  function drawCues(ctx2) {
    if (!(player.cues && player.cues.length) && !(player.cueQueue && player.cueQueue.length)) return;
    const p = playerPixelPos(), pose = playerPose(), f = pose.facing || player.facing;
    const mouth = { x: Math.round(p.x) + (f === "left" ? 2 : f === "right" ? 14 : 8), y: Math.round(p.y) - TILE + 14 - pose.lift };
    Wildlife.drawCues(ctx2, player, { mouth, head: { x: mouth.x, y: Math.round(p.y) - TILE } }, { big: true, icon: "herNote" });
  }

  return { act, stop, update, frame, drawHeld, drawOver, drawCues, busy: () => !!player.act };
})();
window.Player = Player;

const PLAYER_SPRITES = renderPlayer();
window.ICONS.herNote = herNoteIcon();

let herBlinkAt = 0, herBlinkUntil = 0;
function playerPose() {
  const acting = Player.frame() || Quirks.herFrame();          // (an action, or one of their little moments: js/quirks.js)
  if (acting) return acting;
  const now = performance.now() / 1000;
  if (!isMoving() && now > herBlinkAt) { herBlinkUntil = now + 0.14; herBlinkAt = now + 3 + Math.random() * 3; }
  const blinking = !isMoving() && now < herBlinkUntil && PLAYER_SPRITES.blink;
  if (player.sitting) return { sprite: blinking ? PLAYER_SPRITES.blink.sit : PLAYER_SPRITES.sit, lift: 0 };
  const frames = PLAYER_SPRITES[player.facing];
  if (!isMoving()) return { sprite: (blinking && PLAYER_SPRITES.blink[player.facing]) || frames[0], lift: 0 };
  const stone = WORLD.tile(player.nx, player.ny) === "o" || WORLD.tile(player.tx, player.ty) === "o";
  const u = player.progress;
  if (stone) return { sprite: frames[1 + (player.steps % 2)], lift: Math.round(Math.sin(u * Math.PI) * 3) };
  return u < 0.5 ? { sprite: frames[1 + (player.steps % 2)], lift: 0 } : { sprite: frames[0], lift: 1 };
}

const heldIcons = {};
const HELD_LOOKS = { seeds: "seedPouch" };
function drawPlayer() {
  if (player.hidden) return;
  const p = playerPixelPos();
  const pose = playerPose(), { sprite, lift } = pose;
  if (!player.sitting) drawShadow(p.x + 9, p.y + 16, 7, 2);
  const herTop = Math.round(p.y) - TILE, facing = pose.facing || (player.sitting ? "down" : player.facing);
  const bob = pose.facing ? lift + Math.max(-1, Math.min(1, Dolls.laggingLift() - lift)) : null;
  Dolls.drawOnHer(ctx, Math.round(p.x), herTop, facing, true, bob);
  Quirks.drawHair(ctx, Math.round(p.x), herTop - lift, facing, true, pose);        // (a flower he tucked behind her ear, on her far side)
  ctx.drawImage(sprite, Math.round(p.x) - (sprite.ox || 0), herTop - lift - (sprite.oy || 0));
  Dolls.drawOnHer(ctx, Math.round(p.x), herTop, facing, false, bob);
  Quirks.drawHair(ctx, Math.round(p.x), herTop - lift, facing, false, pose);
  const item = State.get().holding;
  if (Player.drawHeld(ctx, p, pose)) { /* (raised to drink, or tipped to pour) */ }
  else if (item && (ICONS[item] || HELD_LOOKS[item]) && facing !== "up") {
    const icon = heldIcons[item] || (heldIcons[item] = HELD_LOOKS[item] ? prop(HELD_LOOKS[item]).canvas : iconFromGrid(ICONS[item]).toCanvas());
    const side = player.facing === "left" ? -5 : player.facing === "right" ? 5 : 0;
    ctx.drawImage(icon, Math.round(p.x + 8 + side - icon.width / 2), Math.round(p.y) - TILE + 21 - lift - Math.round(icon.height / 2));
  }
}

const HER_POINTS = [[8, 6], [5, 10], [11, 10], [8, 14], [8, 19], [5, 21], [11, 21], [8, 25], [6, 28], [10, 28]];
function herHidden(inFront) {
  const p = playerPixelPos(), { lift } = playerPose();
  const x0 = Math.round(p.x), y0 = Math.round(p.y) - TILE - lift;
  const blockers = inFront.map((it) => it.thing).filter(Boolean);
  if (!blockers.length) return false;
  let hidden = 0;
  for (const [px, py] of HER_POINTS) {
    const x = x0 + px, y = y0 + py;
    if (blockers.some((t) => { const s = thingSprite(t, 1); return isSolid(s.canvas, x - (t.footX - s.ax), y - (t.footY - s.ay)); })) hidden++;
  }
  return hidden >= HER_POINTS.length * 0.4;
}

const outlineCache = new WeakMap();
function drawHerOutline() {
  const p = playerPixelPos(), { sprite, lift } = playerPose();
  let ring = outlineCache.get(sprite);
  if (!ring) {
    ring = document.createElement("canvas");
    ring.width = sprite.width; ring.height = sprite.height;
    const g = ring.getContext("2d");
    g.fillStyle = PALETTE.cream;
    for (let y = 0; y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        if (!isSolid(sprite, x, y)) continue;
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !isSolid(sprite, x + dx, y + dy));
        if (edge) g.fillRect(x, y, 1, 1);
      }
    }
    outlineCache.set(sprite, ring);
  }
  ctx.drawImage(ring, Math.round(p.x) - (sprite.ox || 0), Math.round(p.y) - TILE - lift - (sprite.oy || 0));
}
