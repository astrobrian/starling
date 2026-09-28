
const SMALL_FLOWERS = () => Object.keys(FLOWERS).filter((k) => FLOWERS[k].size === "small" && !FLOWERS[k].sown);

function makeRiver(R) {
  const P = [], Wd = [], T = [];
  const n = R.points.length, SAMPLES = 8;
  const pick = (a, i) => a[Math.max(0, Math.min(n - 1, i))];
  const cr = (p0, p1, p2, p3, u) => 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u);
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < SAMPLES; k++) {
      const u = k / SAMPLES;
      const p0 = pick(R.points, i - 1), p1 = pick(R.points, i), p2 = pick(R.points, i + 1), p3 = pick(R.points, i + 2);
      P.push([cr(p0[0], p1[0], p2[0], p3[0], u), cr(p0[1], p1[1], p2[1], p3[1], u)]);
      Wd.push(pick(R.widths, i) + (pick(R.widths, i + 1) - pick(R.widths, i)) * u);
      T.push(i + u);
    }
  }
  P.push(R.points[n - 1]); Wd.push(R.widths[n - 1]); T.push(n - 1);
  function at(x, y) {
    let d = 1e9, fx = 0, fy = 1, t = 0, side = 0, pool = false;
    for (let i = 0; i < P.length - 1; i++) {
      const ax = P[i][0], ay = P[i][1], dx = P[i + 1][0] - ax, dy = P[i + 1][1] - ay;
      const L2 = dx * dx + dy * dy;
      const s = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
      const px = ax + dx * s, py = ay + dy * s;
      const dd = Math.hypot(x - px, y - py) - (Wd[i] + (Wd[i + 1] - Wd[i]) * s) / 2;
      if (dd < d) {
        const L = Math.sqrt(L2);
        d = dd; fx = dx / L; fy = dy / L; t = T[i] + (T[i + 1] - T[i]) * s;
        side = dx * (y - py) - dy * (x - px);      // > 0: the west bank (right of the flow)
      }
    }
    for (const p of R.pools || []) {
      const dd = Math.hypot(x - p.x, y - p.y) - p.r;
      if (dd < d) { d = dd; pool = true; }
    }
    const riffle = !pool && (R.riffles || []).some(([a, b]) => t >= a && t <= b);
    return { d, fx, fy, t, side, pool, riffle };
  }
  function pointAt(t) {
    t = Math.max(0, Math.min(T[T.length - 1], t));
    let i = 0;
    while (i < T.length - 2 && T[i + 1] < t) i++;
    const k = (t - T[i]) / (T[i + 1] - T[i] || 1);
    return { x: P[i][0] + (P[i + 1][0] - P[i][0]) * k, y: P[i][1] + (P[i + 1][1] - P[i][1]) * k };
  }
  return { at, pointAt };
}

function buildWorld(map) {
  const H = map.length, W = map[0].length;
  const tiles = map.map((row) => row.split(""));
  const tile = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? "E" : tiles[y][x]);
  const idx = (x, y) => y * W + x;
  const river = makeRiver(window.RIVER);

  const flow = new Array(W * H).fill(null);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = river.at(x + 0.5, y + 0.5);
      if (r.d < 0.2 && tiles[y][x] !== "H") {
        tiles[y][x] = r.riffle ? "r" : "~";
        flow[idx(x, y)] = { fx: r.fx, fy: r.fy, speed: r.pool ? 0.25 : r.riffle ? 1.7 : 1 };
      }
    }
  }
  const pathWidth = RIVER.pathWidth || 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!".S".includes(tiles[y][x])) continue;
      const r = river.at(x + 0.5, y + 0.5);
      if (r.d > 0.35 && r.d < 0.35 + pathWidth && r.side > 0) tiles[y][x] = "=";
    }
  }
  for (let x = 0; x < W; x++) {
    if ("~r".includes(tile(x, RIVER.bridgeRow))) tiles[RIVER.bridgeRow][x] = "b";
    if ("~r".includes(tile(x, RIVER.stonesRow))) tiles[RIVER.stonesRow][x] = "o";
  }

  const blocked = new Uint8Array(W * H);   // she can't walk here
  const feature = new Uint8Array(W * H);   // not plain grass
  const patchOf = new Int16Array(W * H).fill(-1);
  const things = [];
  const clover = [];                       // tiles with clover (baked into the ground)
  const petals = [];                       // fallen petals (baked into the ground)
  const isGrass = (x, y) => ".S".includes(tile(x, y));
  const isWater = (x, y) => "~r".includes(tile(x, y));

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if ("E~rH".includes(tile(x, y))) blocked[idx(x, y)] = 1;
      if (!isGrass(x, y)) feature[idx(x, y)] = 1;
    }
  }

  const start = (() => {
    for (let y = 0; y < H; y++) { const x = map[y].indexOf("S"); if (x >= 0) return { x, y }; }
    return { x: 2, y: 2 };
  })();
  const nearStart = (x, y) => Math.abs(x - start.x) <= 1 && Math.abs(y - start.y) <= 1;
  const inClearing = (x, y) => (window.CLEARINGS || []).some((c) => ((x - c.x) / c.rx) ** 2 + ((y - c.y) / c.ry) ** 2 <= 1);

  const woodsDist = new Int16Array(W * H).fill(999);
  const queue = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tile(x, y) === "E") { woodsDist[idx(x, y)] = 0; queue.push([x, y]); }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || woodsDist[idx(nx, ny)] <= woodsDist[idx(x, y)] + 1) continue;
      woodsDist[idx(nx, ny)] = woodsDist[idx(x, y)] + 1;
      queue.push([nx, ny]);
    }
  }
  const nearWoods = (x, y) => woodsDist[idx(x, y)] <= 3;

  function place(o) {
    const kind = THINGS[o.type];
    if (!kind) { console.warn("unknown thing", o.type); return; }
    const [w, h] = kind.size;
    for (let y = o.y; y < o.y + h; y++) {
      for (let x = o.x; x < o.x + w; x++) {
        if (kind.blocks) blocked[idx(x, y)] = 1;
        feature[idx(x, y)] = 1;
      }
    }
    const thing = {
      type: o.type, x: o.x, y: o.y, w, h, variant: o.variant || 0,
      name: kind.name, tappable: !!kind.name, blocks: kind.blocks, wet: !!kind.wet,
      footX: (o.x + w / 2) * TILE + (o.dx || 0), footY: (o.y + h) * TILE + (o.dy || 0),
      bounce: 0, phase: hash2(o.x, o.y, 5) * 6.28,
    };
    things.push(thing);
    return thing;
  }

  for (const o of WORLD_OBJECTS) {
    if (o.type === "fence") {
      for (let i = 0; i < (o.length || 1); i++) {
        const down = o.direction === "down";
        place({ type: "fence", x: o.x + (down ? 0 : i), y: o.y + (down ? i : 0), variant: down ? 1 : 0 });
      }
    } else {
      place(o);
    }
  }

  const bridgeTiles = [];
  for (let x = 0; x < W; x++) if (tile(x, RIVER.bridgeRow) === "b") bridgeTiles.push(x);
  if (bridgeTiles.length) {
    const x0 = bridgeTiles[0], x1 = bridgeTiles[bridgeTiles.length - 1];
    things.push({
      type: "bridgeRail", variant: x1 - x0 + 1, x: x0, y: RIVER.bridgeRow, w: x1 - x0 + 1, h: 1,
      footX: (x0 + (x1 - x0 + 1) / 2) * TILE, footY: (RIVER.bridgeRow + 1) * TILE + 1,
      name: "bridge", tappable: true, blocks: false, bounce: 0, phase: 0, noShadow: true,
    });
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (tile(x, y) !== "E") continue;
      let edge = false;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!"E".includes(tile(x + i, y + j))) edge = true;
      if (!edge && (x + y) % 2) continue;
      if (river.at(x + 0.5, y + 0.5).d < 0.6) continue;
      let open = 99;
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (tile(x + i, y + j) !== "E") open = Math.min(open, Math.max(Math.abs(i), Math.abs(j)));
      const back = open >= 2, pine = back && hash2(x, y, 43) < 0.3;
      let variant = pine ? 8 + Math.floor(hash2(x, y, 40) * 2) : Math.floor(hash2(x, y, 40) * 4) + (back ? 4 : 0);
      if (y <= 2 && !pine) variant += 16;
      things.push({
        type: "woodsTree", variant, x, y, w: 1, h: 1,
        footX: x * TILE + 8 + Math.round((hash2(x, y, 41) - 0.5) * 8),
        footY: y * TILE + 14 + Math.round((hash2(x, y, 42) - 0.5) * 6),
        name: null, tappable: false, bounce: 0, phase: 0,
      });
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (tile(x, y) !== "E" || river.at(x + 0.5, y + 0.5).d < 1) continue;
      const below = ".S=".includes(tile(x, y + 1)), side = ".S=".includes(tile(x + 1, y)) || ".S=".includes(tile(x - 1, y));
      if (!below && !side) continue;
      for (let k = 0; k < (below ? 2 : 1); k++) {
        things.push({
          type: "fern", variant: Math.floor(hash2(x, y + k, 44) * 2), x, y, w: 1, h: 1,
          footX: x * TILE + 4 + k * 8 + Math.round((hash2(x, y, 45 + k) - 0.5) * 6),
          footY: (y + 1) * TILE + (below ? 2 : -2) + Math.round(hash2(x, y, 47 + k) * 3),
          name: null, tappable: false, bounce: 0, phase: 0,
        });
      }
    }
  }

  const plantFlower = (x, y, species, color, px, py, patchIndex) => {
    const f = place({ type: "flower", x, y, dx: px, dy: py });
    Object.assign(f, {
      type: "flower", species, color, name: flowerName(species, color), tappable: true,
      blocks: false, variant: Math.floor(hash2(x * 7 + px, y, 60) * 4), patch: patchIndex,
    });
    return f;
  };
  THINGS.flower = THINGS.flower || { name: "flower", size: [1, 1], blocks: false };

  FLOWER_PATCHES.forEach((p, i) => {
    const small = p.flowers.filter(([s]) => FLOWERS[s].size === "small");
    for (let y = Math.floor(p.y - p.ry - 2); y <= Math.ceil(p.y + p.ry + 2); y++) {
      for (let x = Math.floor(p.x - p.rx - 2); x <= Math.ceil(p.x + p.rx + 2); x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const d = Math.hypot((x - p.x) / p.rx, (y - p.y) / p.ry);
        const free = isGrass(x, y) && !feature[idx(x, y)] && !nearStart(x, y);
        if (d <= 1.05 && isGrass(x, y)) patchOf[idx(x, y)] = i;
        if (d > 1.05) {
          if (d < 1.7 && isGrass(x, y) && hash2(x, y, 61) < 0.6) {
            for (let k = 0; k < 3; k++) {
              const [, color] = p.flowers[Math.floor(hash2(x, y, 62 + k) * p.flowers.length)];
              petals.push({ x: x * TILE + Math.floor(hash2(x, y, 63 + k) * 15), y: y * TILE + Math.floor(hash2(x, y, 66 + k) * 15), color });
            }
          }
          continue;
        }
        if (!free) continue;
        const chance = d < 0.6 ? 1 : 1 - ((d - 0.6) / 0.45) * 0.8;
        if (hash2(x, y, 64) > chance) continue;
        let pick = p.flowers[(x * 3 + y * 5 + Math.floor(hash2(x, y, 65) * 2)) % p.flowers.length];
        if (FLOWERS[pick[0]].size === "tall" && d > 0.75 && small.length) pick = small[Math.floor(hash2(x, y, 66) * small.length)];
        plantFlower(x, y, pick[0], pick[1], Math.round((hash2(x, y, 67) - 0.5) * 5), Math.round((hash2(x, y, 68) - 0.5) * 3), i);
        if (d < 0.55 && small.length && hash2(x, y, 69) > 0.35) {
          const [s, c] = small[Math.floor(hash2(x, y, 70) * small.length)];
          plantFlower(x, y, s, c, Math.round((hash2(x, y, 71) - 0.5) * 10), 5, i);
        }
      }
    }
  });

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isGrass(x, y) || feature[idx(x, y)] || nearStart(x, y) || inClearing(x, y)) continue;
      const byWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isWater(x + dx, y + dy));
      const threshold = nearWoods(x, y) || byWater ? 0.6 : 0.76;
      if (fractalNoise(x / 4, y / 4, 80) > threshold && hash2(x, y, 81) > 0.35) {
        const g = place({ type: "tallGrass", x, y, variant: Math.floor(hash2(x, y, 82) * 3),
          dx: Math.round((hash2(x, y, 83) - 0.5) * 6), dy: -Math.floor(hash2(x, y, 84) * 5) });
        g.phase = x * 0.7 + y * 0.3;
      }
    }
  }

  const plain = (x, y) => isGrass(x, y) && !feature[idx(x, y)];
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (let y = 0; y < H - 2; y++) {
      for (let x = 0; x < W - 2; x++) {
        const cx = x + 1, cy = y + 1;
        if (!nearWoods(cx, cy) || inClearing(cx, cy)) continue;
        let all = true;
        for (let j = 0; j < 3 && all; j++) for (let i = 0; i < 3 && all; i++) if (!plain(x + i, y + j)) all = false;
        if (!all) continue;
        const r = hash2(cx, cy, 90 + pass);
        const canBlock = !nearStart(cx, cy);
        if (r < 0.38) {
          place({ type: "tallGrass", x: cx, y: cy, variant: Math.floor(hash2(cx, cy, 91) * 3) });
        } else if (r < 0.6) {
          clover.push({ x: cx, y: cy });
          feature[idx(cx, cy)] = 1;
        } else if (r < 0.84) {
          const kinds = SMALL_FLOWERS();
          const s = kinds[Math.floor(hash2(cx, cy, 92) * kinds.length)];
          const c = FLOWERS[s].colors[Math.floor(hash2(cx, cy, 93) * FLOWERS[s].colors.length)];
          const spots = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]].slice(0, 3 + Math.floor(hash2(cx, cy, 94) * 3));
          for (const [dx, dy] of spots) {
            if (plain(cx + dx, cy + dy) && !nearStart(cx + dx, cy + dy)) {
              plantFlower(cx + dx, cy + dy, s, c, Math.round((hash2(cx + dx, cy + dy, 95) - 0.5) * 6), 0, -1);
            }
          }
        } else if (r < 0.93 && canBlock) {
          place({ type: "rock", x: cx, y: cy, variant: Math.floor(hash2(cx, cy, 96) * 2) });
        } else if (canBlock) {
          place({ type: "bush", x: cx, y: cy, variant: Math.floor(hash2(cx, cy, 97) * 3) });
        } else {
          place({ type: "tallGrass", x: cx, y: cy });
        }
        changed = true;
      }
    }
    if (!changed) break;
  }

  for (const t of things) {
    if (["woodsTree", "flower", "bridgeRail", "house"].includes(t.type)) continue;
    const ground = tile(t.x, t.y);
    if (t.wet ? !isWater(t.x, t.y) : !".S".includes(ground)) console.warn(`${t.type} at ${t.x},${t.y} is on "${ground}"`);
  }

  return { W, H, tile, tiles, blocked, patchOf, things, clover, petals, start, river, flow, isWater };
}
