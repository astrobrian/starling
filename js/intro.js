
function makeIntroPictures(W, H) {
  const skyBase = document.createElement("canvas");
  skyBase.width = W; skyBase.height = H;
  drawSkyBands(skyBase.getContext("2d"), W, H, nightBands());
  const bands = (g) => g.drawImage(skyBase, 0, 0);

  const faint = [];
  for (let i = 0; i < W * H / 300; i++) faint.push({ x: Math.floor(hash2(i, 1, 501) * W), y: Math.floor(hash2(i, 2, 502) * H), rate: 0.5 + hash2(i, 3, 503), phase: hash2(i, 4, 504) * 6.28 });
  const drawFaint = (g, t) => {
    for (const s of faint) { g.fillStyle = Math.sin(t * s.rate + s.phase) > 0.8 ? PALETTE.starBright : PALETTE.starFaint; g.fillRect(s.x, s.y, 1, 1); }
  };

  function river(horizontal, mid, width, count, seed, bodyWidth = width * 0.45) {
    const dots = [];
    for (let i = 0; i < count; i++) {
      const core = i % 3 === 0;                       // a third of them crowd the middle
      const a = (hash2(i, 1, seed) + hash2(i, 2, seed) + hash2(i, 3, seed) - 1.5) * width * (core ? 0.35 : 1);
      const c = hash2(i, 5, seed);
      dots.push({ k: hash2(i, 4, seed), a, phase: hash2(i, 6, seed) * 6.28, color: core && c < 0.5 ? PALETTE.starBright : c < 0.55 ? PALETTE.starBand : PALETTE.starFaint });
    }
    const night = nightBands(), lighter = nightBandsLighter();
    const body = document.createElement("canvas");
    body.width = W; body.height = H;
    const b = body.getContext("2d"), len0 = horizontal ? W : H;
    for (let a = 0; a < len0; a++) {
      const swell = 0.8 + 0.3 * Math.sin((2 * Math.PI * a) / len0 + 1);          // wider here, narrower there
      const c = mid(a), w = bodyWidth * swell + Math.sin(a / 23) * 1.5 + (fractalNoise(a / 30, 0.3, seed) - 0.5) * 4;
      const rift = Math.round(c + 1 + Math.sin(a / 37) * 2);
      for (let v = Math.round(c - w); v <= c + w; v++) {
        const [x, y] = horizontal ? [a, v] : [v, a];
        const i = skyBandAt(x, y, W, H);
        b.fillStyle = v === rift || v === rift + 1 ? night[i] : lighter[i];
        b.fillRect(x, y, 1, 1);
      }
    }
    return (g, t, flow = 0.012) => {
      g.drawImage(body, 0, 0);
      const len = horizontal ? W : H;
      for (const d of dots) {
        const along = ((d.k + t * flow) % 1) * len, across = mid(along) + d.a;
        g.fillStyle = Math.sin(t * 1.6 + d.phase) > 0.94 ? PALETTE.cream : d.color;
        if (horizontal) g.fillRect(Math.floor(along), Math.floor(across), 1, 1);
        else g.fillRect(Math.floor(across), Math.floor(along), 1, 1);
      }
    };
  }
  const acrossSky = river(true, (x) => H * 0.36 + Math.sin(x / W * Math.PI * 1.3 + 0.4) * H * 0.1, H * 0.15, Math.round(W * H / 60), 511);
  const cx = Math.round(W / 2);
  const downSky = river(false, (y) => cx + Math.sin(y / H * Math.PI * 1.1) * W * 0.05, W * 0.1, Math.round(W * H / 55), 512, W * 0.09);

  function starFolk(color, flower, surprised, look = 0, big = 0) {
    const b = new PixelBuffer(21 + 2 * big, 21 + 2 * big);
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 5 + big * 0.5 : 10 + big, a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push([10.5 + big + Math.cos(a) * r, 11.2 + big + Math.sin(a) * r]);
    }
    b.polygon(pts, color, { flat: true });                      // flat, like light
    b.circle(10.5 + big, 11.6 + big, 5.6 + big * 0.5, color, { flat: true });
    for (const [x, y] of [[10, 2], [10, 3], [9, 4], [10, 4], [9, 5]]) b.set(x + big, y + big - (big ? 1 : 0), "cream");     // a shine on its top point
    const out = outline(b);
    const set = (x, y, c) => out.set(x + 1 + big, y + 1 + big, c);
    for (const ex0 of [7, 12]) {
      const ex = surprised ? ex0 : ex0 + look;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]) set(ex + dx, 10 + dy - (surprised ? 1 : 0), dx === 0 && dy === 0 ? "cream" : "plum");
      if (surprised) { set(ex, 12, "plum"); set(ex + 1, 12, "plum"); }
    }
    for (const bx of [5, 14]) { set(bx, 13, "blush"); set(bx + 1, 13, "blush"); }
    if (surprised) { set(10, 14, "plum"); set(9, 15, "plum"); set(11, 15, "plum"); set(10, 16, "plum"); }
    else { set(9, 14, "plum"); set(10, 15, "plum"); set(11, 14, "plum"); }
    if (flower) {
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) set(4 + dx, 6 + dy, "petalPink");
      set(4, 6, "butter");
    }
    return out.toCanvas();
  }
  const weaver = { happy: starFolk("starBright", true, false, -1, 1), surprised: starFolk("starBright", true, true, 0, 1) };       // she looks left, at him (a size bigger: the brighter star)
  const cowherd = { happy: starFolk("starlight", false, false, 1), surprised: starFolk("starlight", false, true) };      // he looks right, at her
  const bankY = Math.round(H * 0.3), weaverX = Math.round(cx + W * 0.2), cowherdX = Math.round(cx - W * 0.2);
  const weaverY = bankY - 3;
  const exclaim = iconFromGrid(ICONS.exclaim).toCanvas();
  const drawFolk = (g, who, x, y, mood = "happy") => {
    Daylight.drawLight(g, Math.round(x), Math.round(y), who === weaver ? 17 : 11, "starBright", who === weaver ? 0.9 : 0.45);
    const c = who[mood], top = Math.round(y) - Math.floor(c.height / 2) - 1;
    g.drawImage(c, Math.round(x) - Math.floor(c.width / 2), top);
    if (mood === "surprised") g.drawImage(exclaim, Math.round(x) - Math.floor(exclaim.width / 2), top - exclaim.height);   // a "!" over each
  };

  const wings = (id) => ["fly1", "fly2"].map((pose) => {
    const s = renderBird(BIRDS[id] || BIRDS.magpie, pose);
    return { right: moonlit(nightBird(s.canvas)), left: moonlit(nightBird(flipCanvas(s.canvas))), w: s.canvas.width, h: s.canvas.height };
  });
  const flyers = { magpie: wings("magpie"), crow: wings("crow") };
  const N = 7, arcTop = Math.round(H * 0.3), arcEnd = Math.round(H * 0.4), span = Math.round(W * 0.2);
  const arcY = (x) => arcEnd - Math.sin(Math.max(0, Math.min(1, (x - (cx - span)) / (2 * span))) * Math.PI) * (arcEnd - arcTop);
  const slots = Array.from({ length: N }, (_, i) => {
    const x = Math.round(cx - span + (2 * span * i) / (N - 1));
    return { x, y: Math.round(arcY(x)), kind: i % 2 ? "crow" : "magpie", from: i < N / 2 ? -1 : 1, at: 0.1 + [0, 2, 4, 6, 5, 3, 1][i] * 0.12 };
  });
  const drawBird = (g, kind, x, y, facing, t, fast = false, seed = 0, still = false) => {
    const beat = still ? ((t + seed * 0.37) % 1.5 < 0.18 ? 1 : 0) : Math.abs(Math.floor(t * (fast ? 12 : 6) + seed)) % 2;
    const f = flyers[kind][beat];
    g.drawImage(f[facing], Math.round(x - f.w / 2), Math.round(y - f.h / 2));
  };
  const ease = (k) => 1 - (1 - Math.max(0, Math.min(1, k))) ** 2;

  const heart = iconFromGrid(ICONS.heart).toCanvas();
  const drawHeart = (g, x, y) => g.drawImage(heart, Math.round(x - heart.width / 2), Math.round(y - heart.height / 2));

  function drawWind(g, t, curls = 4) {
    for (let i = 0; i < curls; i++) {
      const x0 = -60 + (t - i * 0.25) * W * 0.7, y0 = H * (0.18 + i * 0.13);
      if (x0 < -60 || x0 > W + 60) continue;
      g.fillStyle = i % 2 ? PALETTE.starBright : PALETTE.duskLavender;
      for (let s = 0; s < 1; s += 0.02) {                   // a curl...
        const a = s * Math.PI * 2.4, r = 2 + s * 7;
        g.fillRect(Math.round(x0 + Math.cos(a) * r), Math.round(y0 + Math.sin(a) * r), 1, 1);
      }
      for (let x = 0; x < 36; x += 1) g.fillRect(Math.round(x0 - 7 - x), Math.round(y0 + 9 + Math.sin(x / 6) * 1.5), 1, 1);   // ...and its tail
    }
  }

  function fallingStar(g, x, y, dx, dy, big = false) {
    const n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
    for (let i = 1; i < (big ? 12 : 7); i++) {
      g.fillStyle = i < 3 ? PALETTE.starBright : PALETTE.starBand;
      g.fillRect(Math.round(x - ux * i * 1.5), Math.round(y - uy * i * 1.5), 1, 1);
    }
    if (big) Daylight.drawLight(g, x, y, 8, "starBright", 1);
    g.fillStyle = PALETTE.starlight;
    g.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
    g.fillRect(Math.round(x), Math.round(y) - 1, 1, 3);
    g.fillStyle = PALETTE.cream;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  const HH = Math.round(H * 0.74);
  const home = makeTitleScene(W, HH, { magpie: false, fireflyMaxX: W * 0.42, moonX: 0.7, day: 0 });     // (the night before Day 1: its moon)
  const dawn = makeTitleScene(W, HH, { morning: true, magpie: false });
  const veil = (src, light) => {
    if (light !== "night") return src;
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    const g = c.getContext("2d");
    g.drawImage(src, 0, 0);
    Daylight.apply(g, 0, 0, c.width, c.height, false, "night");
    g.globalCompositeOperation = "destination-in"; g.drawImage(src, 0, 0); g.globalCompositeOperation = "source-over";
    return c;
  };
  const meadowBand = (light) => {
    const c = document.createElement("canvas");
    c.width = W; c.height = H - HH;
    const g = c.getContext("2d");
    g.fillStyle = PALETTE.grass; g.fillRect(0, 0, W, H - HH);
    for (let i = 0; i < W / 2.5; i++) {                        // tufts of grass
      const x = Math.floor(hash2(i, 1, 541) * W), y = 2 + Math.floor(hash2(i, 2, 542) * (H - HH - 3));
      g.fillStyle = RAMPS.grass[hash2(i, 3, 543) < 0.55 ? 2 : 0];
      g.fillRect(x, y, 1, 2); g.fillRect(x + 1, y - 1, 1, 2); if (hash2(i, 4, 544) < 0.5) g.fillRect(x - 1, y, 1, 1);
    }
    if (light === "morning") { g.globalCompositeOperation = "multiply"; g.fillStyle = "#FFF0D6"; g.fillRect(0, 0, W, H - HH); g.globalCompositeOperation = "source-over"; }
    return veil(c, light);
  };
  const nightMeadow = meadowBand("night"), morningMeadow = meadowBand("morning");

  const littleStar = (() => {
    const b = new PixelBuffer(9, 9), pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 2 : 4.6; pts.push([4.5 + Math.cos(a) * r, 4.9 + Math.sin(a) * r]); }
    b.polygon(pts, "starlight", { flat: true });
    b.set(4, 4, "cream"); b.set(4, 5, "cream");
    return outline(b).toCanvas();
  })();
  const kinds = ((window.FLOWER_PATCHES && FLOWER_PATCHES[0] && FLOWER_PATCHES[0].flowers) || [["daisy", "snow"]]).filter(([sp, col]) => FLOWERS[sp] && FLOWERS[sp].size !== "tall" && col !== "butter");   // (no yellow: the star is yellow)
  const flowerBed = (light) => {
    const c = document.createElement("canvas");
    c.width = 44; c.height = 22;
    const g = c.getContext("2d");
    [[-15, 0], [-8, 3], [-1, -1], [8, 2], [14, -1]].forEach(([dx, dy], i) => {
      const [sp, col] = kinds[i % kinds.length] || ["daisy", "snow"];
      g.drawImage(renderFlower(sp, col, i).frames[1], 22 + dx - 8, 18 + dy - 16);
    });
    return veil(c, light);
  };
  const bedNight = flowerBed("night"), bedDay = flowerBed("day");
  const landAt = { x: home.house.x - 22, y: home.ground + 3 };
  function drawLittleStar(g, t, night) {
    const glow = night ? 0.7 + 0.3 * Math.sin(t * 3) : 0.35 + 0.15 * Math.sin(t * 3);
    Daylight.drawLight(g, landAt.x, landAt.y - 4, 16, night ? "starBright" : "starlight", glow);
    if (night) Daylight.drawLight(g, landAt.x, landAt.y - 4, 9, "starlight", 0.8);        // the flowers nearest it catch its light
    g.drawImage(night ? bedNight : bedDay, landAt.x - 22, landAt.y - 16);
    g.drawImage(littleStar, landAt.x - 5, landAt.y - 9);
    if (!night && t % 1.2 < 0.6) {                               // by day, two little twinkles beside it
      g.fillStyle = PALETTE.cream;
      for (const dx of [-6, 6]) { const x = landAt.x + dx, y = landAt.y - 10; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
    }
  }

  const magpieDay = ["fly1", "fly2", "stand", "peck"].map((pose) => {
    const s = renderBird(BIRDS.magpie, pose);
    return { canvas: flipCanvas(s.canvas), footX: s.canvas.width - s.footX, footY: s.footY };
  });

  return {
    folk: { weaver, cowherd },

    card(g, t) { bands(g); drawFaint(g, t); },

    sky(g, t) { bands(g); drawFaint(g, t); acrossSky(g, t, 0.01); },

    two(g, t) {
      bands(g); drawFaint(g, t); downSky(g, t);
      drawFolk(g, weaver, weaverX, weaverY + Math.round(Math.sin(t * 2) * 1));
      drawFolk(g, cowherd, cowherdX, bankY + Math.round(Math.sin(t * 2 + 1.5) * 1));
      const k = (t % 2.2) / 1.4;
      if (t > 0.6 && k < 1) drawHeart(g, cx, bankY - 2 - Math.floor(k * 16));
    },

    bridge(g, t) {
      bands(g); drawFaint(g, t); downSky(g, t);
      for (const s of slots) {
        const k = ease((t - s.at) / 1.0);
        if (t < s.at) continue;
        const x = s.x + s.from * (1 - k) * W * 0.45, y = s.y + (1 - k) * H * 0.5 + Math.round(Math.sin(t * 5 + s.x) * (k >= 1 ? 1 : 0));
        if (k >= 1) Daylight.drawLight(g, x, y, 12, "starBright", 0.4);
        drawBird(g, s.kind, x, y, s.from < 0 ? "right" : "left", t, false, s.x, k >= 1);
      }
      const k = ease((t - 1.4) / 1.2);
      const wx = weaverX + (cx + 8 - weaverX) * k, hx = cowherdX + (cx - 8 - cowherdX) * k;
      const lift = (x) => (k > 0 ? arcY(x) - 11 : bankY);
      drawFolk(g, weaver, wx, Math.min(weaverY, lift(wx)));
      drawFolk(g, cowherd, hx, Math.min(bankY, lift(hx)));
      if (t > 2.7) { const h = ((t - 2.7) % 2) / 1.2; if (h < 1) drawHeart(g, cx, arcTop - 20 - Math.floor(h * 10)); }
    },

    wind(g, t) {
      bands(g); drawFaint(g, t); downSky(g, t, 0.03);
      slots.forEach((s, i) => {
        const k = Math.max(0, t - 0.4) * (0.9 + hash2(i, 1, 521) * 0.5);
        const ang = -Math.PI / 2 + (i - (N - 1) / 2) * 0.55 + (hash2(i, 2, 522) - 0.5) * 0.6;
        const x = s.x + Math.cos(ang) * k * W * 0.5 + Math.sin(k * 9 + i) * 3, y = s.y + Math.sin(ang) * k * H * 0.6 + k * k * 30;
        if (x > -20 && x < W + 20 && y > -20 && y < H + 20) drawBird(g, s.kind, x, y, Math.cos(ang) < 0 ? "left" : "right", t, true, s.x);
      });
      const k = ease((t - 0.5) / 1.1);
      drawFolk(g, weaver, cx + 8 + (weaverX - cx - 8) * k, arcTop - 11 + (weaverY - arcTop + 11) * k, k > 0.3 ? "surprised" : "happy");
      drawFolk(g, cowherd, cx - 8 + (cowherdX - cx + 8) * k, arcTop - 11 + (bankY - arcTop + 11) * k, k > 0.3 ? "surprised" : "happy");
      for (let i = 0; i < 4; i++) {
        const s = t - 0.9 - i * 0.35;
        if (s < 0 || s > 1.6) continue;
        const x0 = cx + (hash2(i, 3, 523) - 0.5) * W * 0.3, y0 = H * 0.25;
        fallingStar(g, x0 + s * (i % 2 ? 40 : -40), y0 + s * s * 120, i % 2 ? 40 : -40, 240 * s);
      }
      drawWind(g, t);
      if (t > 1.6) drawWind(g, (t - 1.6) % 2.6, 2);          // and a soft breeze keeps blowing
    },

    fall(g, t) {
      home.draw(g, t + 3);
      g.drawImage(nightMeadow, 0, HH);
      g.drawImage(bedNight, landAt.x - 22, landAt.y - 16);
      const land = { x: landAt.x, y: landAt.y - 5 };
      const k = (t - 0.4) / 1.8;
      if (k > 0 && k < 1) {
        const x = W * 0.3 + (land.x - W * 0.3) * k, y = -6 + (land.y + 6) * (k * k);
        fallingStar(g, x, y, land.x - W * 0.3, (land.y + 6) * 2 * k, true);
      } else if (k >= 1) {
        const a = t - 2.2;
        drawLittleStar(g, t, true);
        if (a < 1.2) {                                             // a burst of sparkle as it lands
          g.fillStyle = PALETTE.cream;
          for (let i = 0; i < 8; i++) {
            const r = 4 + a * 12, ang = i * Math.PI / 4;
            g.fillRect(Math.round(land.x + Math.cos(ang) * r), Math.round(land.y + Math.sin(ang) * r), 1, 1);
          }
        }
      }
    },

    morning(g, t) {
      dawn.draw(g, t);
      g.drawImage(morningMeadow, 0, HH);
      drawLittleStar(g, t, false);                                // the little star, still waiting in the flowers
      const win = { x: dawn.house.x + 73, y: dawn.house.y + 68 };
      const k = ease((t - 0.3) / 1.8);
      if (k < 1) {
        const f = magpieDay[Math.floor(t * 8) % 2];
        const x = win.x + (W + 24 - win.x) * (1 - k), y = win.y - 6 - Math.sin(k * Math.PI) * 18 - (1 - k) * 40;
        if (t > 0.3) g.drawImage(f.canvas, Math.round(x - f.footX), Math.round(y - f.footY));
      } else {
        const f = magpieDay[(t * 2.5) % 1 < 0.5 ? 3 : 2];
        g.drawImage(f.canvas, win.x - f.footX, win.y - f.footY);
      }
    },
  };
}

const Intro = !document.getElementById("intro") ? null : (() => {
  const $ = (id) => document.getElementById(id);
  const root = $("intro"), canvas = $("intro-sky"), ctx = canvas.getContext("2d");
  const SKY_H = 200;
  let W = 0, H = 0, open = false, clock = 0, last = 0, pageAt = 0, token = 0;
  let pictures = null, picture = "card", finish = null, onTap = null, page = null, heldAt = -9;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth * dpr, vh = window.innerHeight * dpr;
    const scale = Math.max(1, Math.round(vh / SKY_H));
    W = Math.ceil(vw / scale);
    H = Math.ceil(vh / scale);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = (W * scale) / dpr + "px";
    canvas.style.height = (H * scale) / dpr + "px";
    ctx.imageSmoothingEnabled = false;
    pictures = makeIntroPictures(W, H);
  }

  function loop(now) {
    if (!open) return;
    clock += Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    pictures[picture](ctx, clock - pageAt);
    requestAnimationFrame(loop);
  }

  function turnTo(name) {
    canvas.classList.add("turning");
    return new Promise((ok) => setTimeout(() => {
      picture = name;
      pageAt = clock;
      canvas.classList.remove("turning");
      ok();
    }, 200));
  }

  const nextTap = () => new Promise((ok) => { onTap = ok; });
  root.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#intro-skip")) return;
    e.preventDefault();
    Sound.start(); Sound.playMusic("night");          // (opened fresh after a new game, the first tap starts the sound)
    if (onTap) { const f = onTap; onTap = null; f(); return; }
    Speech.tap();
  });
  $("intro-skip").addEventListener("click", () => end());

  async function play(onDone) {
    if (open) return;
    const my = ++token;
    finish = onDone;
    open = true;
    $("intro-skip").textContent = INTRO.skip;
    if (INTRO.skipKorean) {                                   // (a small Korean word beside it, as in Settings: "Save 저장")
      const k = document.createElement("small");
      k.className = "korean";
      k.lang = "ko";
      k.textContent = INTRO.skipKorean;
      $("intro-skip").appendChild(k);
    }
    $("intro-skip").classList.add("waiting");                  // (Skip comes a moment after the first card)
    root.classList.remove("hidden", "leaving");
    resize();
    picture = "card"; pageAt = clock = 0;
    last = performance.now();
    requestAnimationFrame(loop);
    Sound.playMusic("night");
    const d = window.DEDICATION || {};
    $("intro-card-text").textContent = INTRO.dedication.replace("{for}", d.for || INTRO.forAnyone);
    $("intro-card-korean").textContent = (INTRO.dedicationKorean || "").replace("{for}", d.forKorean || d.for || INTRO.forAnyoneKorean);
    $("intro-card-korean").classList.remove("shown");
    $("intro-card").classList.remove("hidden");
    $("intro-next").classList.remove("shown");
    setTimeout(() => $("intro-card-korean").classList.add("shown"), 500);
    setTimeout(() => $("intro-next").classList.add("shown"), 1000);
    setTimeout(() => $("intro-skip").classList.remove("waiting"), 1500);
    await nextTap();
    if (my !== token) return;
    $("intro-card").classList.add("hidden");
    for (const p of INTRO.pages) {
      page = null;
      await turnTo(p.picture);
      if (my !== token) return;
      page = p;
      await Speech.say(null, {
        who: "narrator", text: p.text, under: p.korean,         // (its Korean under it)
        early: () => { if (p.beat && clock - pageAt < p.beat) { pageAt = clock - p.beat; heldAt = clock; } },
        ready: () => !p.beat || (clock - pageAt >= p.beat && clock - heldAt >= 0.8),
      });
      if (my !== token) return;
    }
    page = null;
    end();
  }

  function end() {
    if (!open) return;
    try { localStorage.setItem("starling.introSeen", "1"); } catch (e) { /* private mode */ }     // (Skip counts too)
    token++;
    onTap = null;
    Speech.close();
    root.classList.add("leaving");
    setTimeout(() => {
      open = false;
      root.classList.add("hidden");
      root.classList.remove("leaving");
      $("intro-card").classList.add("hidden");
      const f = finish; finish = null;
      if (f) f();
    }, 450);
  }

  const seen = () => { try { return !!localStorage.getItem("starling.introSeen"); } catch (e) { return true; } };
  return { play, seen, isOpen: () => open };
})();
