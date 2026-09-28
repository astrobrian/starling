
function buildRoom(map = window.ROOM_MAP) {
  const H = map.length, W = map[0].length;
  const tiles = map.map((row) => row.split(""));
  const tile = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? "#" : tiles[y][x]);
  const idx = (x, y) => y * W + x;
  const blocked = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ("#w".includes(tile(x, y))) blocked[idx(x, y)] = 1;
  let start = { x: 2, y: 4 }, door = { x: 1, y: H - 1 };
  for (let y = 0; y < H; y++) {
    if (map[y].includes("S")) start = { x: map[y].indexOf("S"), y };
    if (map[y].includes("D")) door = { x: map[y].indexOf("D"), y };
  }
  const things = [];
  for (const o of ROOM_OBJECTS) {
    const kind = ROOM_THINGS[o.type];
    const [w, h] = kind.size;
    for (let y = o.y; y < o.y + h; y++) for (let x = o.x; x < o.x + w; x++) if (kind.blocks) blocked[idx(x, y)] = 1;
    things.push({
      type: o.type, x: o.x, y: o.y, w, h, variant: o.variant || 0,
      name: kind.name, tappable: !!kind.name, blocks: kind.blocks, flat: !!kind.flat, onWall: !!kind.onWall,
      korean: kind.korean || null,
      footX: (o.x + w / 2) * TILE, footY: (o.y + h) * TILE + (kind.onDesk ? 1 : 0),     // (on the desk: drawn after it)
      bounce: 0, phase: 0,
    });
  }
  const noRiver = { at: () => ({ d: 99, fx: 0, fy: 1, t: 0, side: 1, pool: false, riffle: false }) };
  return {
    W, H, tile, tiles, blocked, things, start, door, indoors: true,
    patchOf: new Int16Array(W * H).fill(-1), clover: [], petals: [], flow: [],
    river: noRiver, isWater: () => false,
  };
}

function bakeRoom(room, tileSize) {
  const Wpx = room.W * tileSize, Hpx = room.H * tileSize;
  const b = new PixelBuffer(Wpx, Hpx);
  const floor = RAMPS.floorWood, paper = RAMPS.wallpaper, wood = RAMPS.wood, plum = RAMPS.plum;
  for (let y = 0; y < Hpx; y++) {
    for (let x = 0; x < Wpx; x++) {
      const t = room.tile(Math.floor(x / tileSize), Math.floor(y / tileSize));
      let c;
      if (t === "#") {
        c = plum[2];
        const inward = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => room.tile(Math.floor((x + dx) / tileSize), Math.floor((y + dy) / tileSize)) !== "#");
        if (inward) c = plum[1];
      } else if (t === "w") {
        const wy = y - tileSize;                       // 0 at the top of the wall
        c = paper[1];
        const sx = (x + (Math.floor(wy / 8) % 2) * 4) % 8, sy = wy % 8;
        if ((sx === 3 && sy >= 3 && sy <= 5) || (sy === 4 && sx >= 2 && sx <= 4)) c = paper[2];
        if (wy < 2) c = wood[0];
        else if (wy === 2) c = wood[2];
        if (wy >= 2 * tileSize - 6) c = wy === 2 * tileSize - 6 ? wood[0] : wy >= 2 * tileSize - 2 ? wood[2] : wood[1];
      } else {
        const row = Math.floor(y / 6), inRow = y % 6;
        const offset = Math.floor(hash2(row, 3, 9) * 40);
        const end = (x + offset) % 40 === 0;
        c = inRow === 5 || end ? floor[2] : floor[1];
        if (inRow === 0 && !end) c = floor[0];
        const grain = fractalNoise(x / 9, row * 3.1, 12);
        if (c === floor[1] && grain > 0.72) c = floor[0];
        if (c === floor[1] && grain < 0.18) c = floor[2];
        if (room.tile(Math.floor(x / tileSize), Math.floor((y - 3) / tileSize)) === "w") c = floor[2];
      }
      b.set(x, y, c);
    }
  }
  const d = room.door;
  for (let y = d.y * tileSize; y < (d.y + 1) * tileSize; y++) {
    for (let x = d.x * tileSize + 2; x < (d.x + 1) * tileSize - 2; x++) b.set(x, y, y % 6 === 5 ? floor[1] : floor[0]);
  }
  return b.toCanvas();
}

function sillFlower(fb) {
  const f = new PixelBuffer(fb.w, fb.h);
  f.polygon([[17.5, 15.5], [22.5, 15.5], [21.7, 19.2], [18.3, 19.2]], "celadon");
  f.rect(17.5, 15, 5, 1, RAMPS.celadon[0], { flat: true });                // the lit rim
  f.line(20, 15, 20, 11, 1, "leaf", { flat: false });                      // the stem
  f.rotEllipse(21.6, 12.8, 1.7, 0.8, -0.6, "leaf");                        // a leaf
  const bloom = [".PPP.", "PWPPS", "PPYPS", "PPPSS", ".PSS."];
  const col = { P: "petalPink", W: "cream", S: RAMPS.petalPink[2], Y: "beeYellow" };
  bloom.forEach((row, y) => [...row].forEach((ch, x) => { if (col[ch]) f.set(18 + x, 6 + y, col[ch]); }));
  const o = outline(f);
  for (let y = 0; y < fb.h; y++) for (let x = 0; x < fb.w; x++) {
    const c = o.get(x + 1, y + 1);
    if (c && (f.get(x, y) || fb.get(x, y))) fb.set(x, y, c);
  }
}

function sleeperHead(b, cx, cy, who) {
  const look = who === "him" ? husbandLook() : window.PLAYER_LOOK;
  if (who === "her") b.ellipse(cx, cy + 1.5, 7.2, 5.6, look.hairColor, { shadeAs: [cx, cy, 7, 6] });    // hair spread on the pillow
  b.ellipse(cx, cy, 6, 5.2, look.hairColor);
  b.ellipse(cx, cy + 2, who === "him" ? 4.6 : 4.8, 3.8, look.skin);
}
function sleeperFace(out, cx, cy, who) {
  const look = who === "him" ? husbandLook() : window.PLAYER_LOOK;
  const X = Math.round(cx) + 1, Y = Math.round(cy) + 1;
  for (const dx of [-3, -2, 2, 3]) out.set(X + dx - (dx > 0 ? 1 : 0), Y + 2, look.eyes || "plum");
  out.set(X - 4, Y + 3, "blush"); out.set(X + 3, Y + 3, "blush");
}

Object.assign(PROP_RENDERERS, {
  bed(v) {
    const W = 48;
    const b = new PixelBuffer(W, 44);
    b.rect(0, 1, W, 12, "wood");
    b.ellipse(W / 2, 2.5, W / 2 - 0.5, 2.5, "wood");
    b.rect(0, 0, 3, 14, "wood"); b.rect(W - 3, 0, 3, 14, "wood");        // posts
    b.rect(1, 12, W - 2, 27, "cream");                                     // sheet
    const pillows = [[14, 17], [34, 17]];
    for (const [px2, py] of pillows) b.ellipse(px2, py, 9.5, 4.2, "snow");
    const quilt = [1, 23, W - 2, 15], shape = [W / 2, 25, W / 2, 16];
    b.rect(...quilt, "petalPink", { shadeAs: shape });
    b.rect(1, 36, W - 2, 4, "petalPink", { flat: true });
    const sleepers = v === 2 ? [["her", 14], ["him", 34]] : v === 1 ? [["her", 24]] : [];
    for (const [, x] of sleepers) b.ellipse(x, 30, 9, 5, "petalPink", { shadeAs: shape });      // a bump under the quilt
    const cells = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) cells.push({ x: 1 + i * (W - 2) / 6, y: 23 + j * 5, w: (W - 2) / 6, h: 5, beige: (i + j) % 2 === 1 });
    for (const c of cells) if (c.beige) b.rect(c.x, c.y, c.w, c.h, "doveBreast", { onlyFilled: true, shadeAs: shape });
    for (let x = 1; x < W - 1; x++) b.set(x, 38, RAMPS.petalPink[2]);      // the quilt hangs over the edge
    for (let x = 1; x < W - 1; x++) b.set(x, 39, RAMPS.petalPink[3]);
    for (const [who, x] of sleepers) sleeperHead(b, x, 16.5, who);
    for (const c of cells) if (!c.beige) {
      const sx = Math.round(c.x + c.w / 2 - 0.5), sy = Math.round(c.y + 2);
      if (sy < 26) continue;
      b.set(sx, sy, "cream"); b.set(sx - 1, sy, RAMPS.cream[1]); b.set(sx + 1, sy, RAMPS.cream[1]);
      b.set(sx, sy - 1, RAMPS.cream[1]); b.set(sx, sy + 1, RAMPS.cream[1]);
    }
    b.rect(1, 22, W - 2, 2, "cream", { flat: true });                       // the folded sheet
    b.rect(1, 24, W - 2, 1, RAMPS.cream[2], { flat: true });
    b.rect(1, 40, 3, 4, "bark"); b.rect(W - 4, 40, 3, 4, "bark");          // legs
    for (const [x, y] of [[24, 5], [23, 6], [24, 6], [25, 6], [24, 7]]) b.set(x, y, "starlight");   // a star in the headboard
    const out = outline(b);
    for (const [who, x] of sleepers) sleeperFace(out, x, 16.5, who);
    return { canvas: out.toCanvas(), ax: 25, ay: 44 };
  },

  nightstand() {
    const b = new PixelBuffer(16, 30);
    b.rect(1, 15, 14, 14, "wood");
    b.rect(1, 13, 14, 3, "wood", { shadeAs: [8, 10, 10, 6] });
    b.rect(3, 19, 10, 1, RAMPS.wood[2], { flat: true });
    b.set(8, 22, "bark");
    b.rect(6, 9, 4, 4, "stone");
    b.polygon([[3, 10], [13, 10], [11, 2], [5, 2]], "butter");
    return finish(b, 8, 29);
  },

  desk() {
    const b = new PixelBuffer(32, 26);
    b.rect(0, 8, 32, 6, "wood", { shadeAs: [16, 4, 20, 10] });              // the top, lit
    b.rect(0, 14, 32, 7, "wood");                                           // the front
    b.rect(10, 15, 12, 5, RAMPS.wood[2], { flat: true });                   // a drawer
    b.rect(11, 16, 10, 3, "wood", { flat: true });
    b.set(15, 17, "bark"); b.set(16, 17, "bark");
    b.rect(1, 21, 2, 5, "bark"); b.rect(29, 21, 2, 5, "bark");
    b.rect(2, 7, 10, 3, "petalPink"); b.rect(3, 5, 8, 2, "pond"); b.rect(2, 3, 9, 2, "lilac");   // books
    b.rect(14, 4, 4, 6, "sheen");                                           // pencil cup
    b.line(15, 4, 14, 0, 1, "butter"); b.line(17, 4, 18, 1, 1, "coral");
    return finish(b, 16, 25);
  },

  crackers() {
    const b = new PixelBuffer(10, 13);
    b.polygon([[1, 3], [9, 3], [9.6, 12.5], [0.4, 12.5]], "path");
    for (let x = 1; x < 9; x++) b.set(x, x % 2 ? 1 : 2, "path");            // the crimped top
    b.rect(1, 2, 8, 2, "path", { flat: true });
    b.rect(1, 4, 8, 1, RAMPS.path[2], { flat: true });
    for (const [x, y] of [[5, 6], [4, 7], [5, 7], [6, 7], [5, 8], [4, 9], [6, 9]]) b.set(x, y, "starlight");
    const s = finish(b, 5, 12);
    return { ...s, ay: s.ay + 14 };           // it sits on the desk, above its tile
  },

  chair() {
    const b = new PixelBuffer(14, 22);
    b.rect(1, 11, 12, 4, "wood");
    b.rect(1, 0, 2, 15, "wood"); b.rect(11, 0, 2, 15, "wood");
    b.rect(1, 0, 12, 3, "wood"); b.rect(3, 6, 8, 2, "wood");
    b.rect(1, 15, 2, 7, "bark"); b.rect(11, 15, 2, 7, "bark");
    return finish(b, 7, 21);
  },

  bookcase(v = 0) {
    const b = new PixelBuffer(16, 38);
    b.rect(0, 6, 16, 32, "bark");
    b.rect(2, 8, 12, 28, RAMPS.bark[3], { flat: true });
    const colors = ["petalPink", "pond", "lilac", "butter", "meadowGreen", "peach", "snow"];
    for (const [shelf, seed] of [[15, 1], [25, 2], [35, 3]]) {
      b.rect(1, shelf, 14, 2, "wood");
      let x = 2;
      while (x < 13) {
        const w = hash2(x, seed, 7) > 0.6 ? 2 : 1, h = 5 + Math.floor(hash2(x, seed, 8) * 3);
        b.rect(x, shelf - h, w, h, colors[Math.floor(hash2(x, seed, 9) * colors.length)], { flat: true });
        x += w + (hash2(x, seed, 10) > 0.8 ? 1 : 0);
      }
    }
    if (v === 1) {
      b.rect(7, 17, 6, 8, RAMPS.bark[3], { flat: true });                  // (the books it stands in front of)
      b.rect(7, 17, 6, 8, "hedge");
      b.rect(7, 17, 1, 8, RAMPS.hedge[3], { flat: true });                 // its spine edge
      b.rect(8.5, 19, 3.5, 4, "cream", { flat: true });                    // the label...
      b.set(9, 20, "ink"); b.set(10, 20, "ink"); b.set(10, 21, "snow"); b.set(11, 21, "sheen");   // ...and its magpie
      b.set(9, 21, "ink");
    }
    b.ellipse(8, 3.5, 3.5, 3.5, "pond");                                   // a jar...
    b.rect(5, 0, 6, 1, "stone");
    for (const [x, y] of [[8, 2], [7, 3], [8, 3], [9, 3], [8, 4]]) b.set(x, y, "starlight");   // ...with a star in it
    return finish(b, 8, 37);
  },

  plant() {
    const b = new PixelBuffer(18, 26);
    for (const [a, len] of [[-2.4, 8], [-1.9, 10], [-1.2, 9], [-0.6, 8], [-2.9, 7], [-1.55, 7]]) {
      const x = 9 + Math.cos(a) * len * 0.6, y = 15 + Math.sin(a) * len * 0.9;
      b.rotEllipse(x, y, 4.2, 2.2, a, "leaf");
    }
    b.polygon([[4, 17], [14, 17], [12.5, 25], [5.5, 25]], "clay");
    b.rect(3, 16, 12, 2, "clay");
    return finish(b, 9, 25);
  },

  rug() {
    const b = new PixelBuffer(46, 30);
    b.ellipse(23, 15, 22.5, 14.5, "lilac", { flat: true });
    b.ellipse(23, 15, 20.5, 12.5, "cream", { flat: true });
    b.ellipse(23, 15, 18.5, 10.5, RAMPS.lilac[0], { flat: true });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      b.set(23 + Math.cos(a) * 21.5, 15 + Math.sin(a) * 13.5, RAMPS.lilac[2]);
    }
    const star = [[23, 10], [22, 11], [23, 11], [24, 11], [19, 13], [20, 13], [21, 13], [22, 13], [23, 13], [24, 13], [25, 13], [26, 13], [27, 13],
      [20, 14], [21, 14], [22, 14], [23, 14], [24, 14], [25, 14], [26, 14], [21, 15], [22, 15], [23, 15], [24, 15], [25, 15], [21, 16], [22, 16], [24, 16], [25, 16], [20, 17], [21, 17], [25, 17], [26, 17], [22, 12], [23, 12], [24, 12]];
    for (const [x, y] of star) b.set(x, y + 1, "butter");
    return { canvas: b.toCanvas(), ax: 23, ay: 30 };
  },

  doormat() {
    const b = new PixelBuffer(16, 9);
    b.rect(1, 1, 14, 7, "clay", { flat: true });
    for (let x = 2; x < 14; x += 3) b.rect(x, 2, 1, 5, RAMPS.clay[2], { flat: true });
    b.rect(1, 1, 14, 1, RAMPS.clay[0], { flat: true });
    return { canvas: b.toCanvas(), ax: 8, ay: 12 };
  },

  window(variant) {
    const v = variant % 4, flower = variant >= 4;
    const b = new PixelBuffer(30, 26);
    const sky = [["dawnGlass", "dawnGlass2"], ["noonGlass", "noonGlass2"], ["duskGlass", "duskGlass2"], ["nightGlass", "nightGlass2"]][v] || ["noonGlass", "noonGlass2"];
    b.rect(3, 3, 24, 16, sky[1], { flat: true });
    b.rect(3, 3, 24, 7, sky[0], { flat: true });
    const trees = v === 3 ? "nightLeaves" : v === 2 ? "duskLeaves" : RAMPS.leaf[1];
    for (let x = 3; x < 27; x++) {
      const h = 2 + Math.round(1.5 + Math.sin(x * 0.9) * 1.2 + hash2(x, 4, 3));
      for (let y = 19 - h; y < 19; y++) b.set(x, y, trees);
    }
    if (v === 3) for (const [x, y] of [[8, 7], [21, 8], [14, 10]]) b.set(x, y, "starlight");
    const frame = (fb) => {
      fb.rect(1, 1, 28, 2, "snow"); fb.rect(1, 1, 2, 20, "snow"); fb.rect(27, 1, 2, 20, "snow");
      fb.rect(14, 3, 2, 3, "snow"); fb.rect(3, 5, 24, 1, "snow", { flat: true });
      fb.rect(0, 19, 30, 4, "snow");
      fb.polygon([[0, 0], [7, 0], [5, 8], [3, 12], [4, 21], [0, 21]], "petalPink");
      fb.polygon([[30, 0], [23, 0], [25, 8], [27, 12], [26, 21], [30, 21]], "petalPink");
      fb.rect(1, 11, 4, 1, "berry", { flat: true }); fb.rect(25, 11, 4, 1, "berry", { flat: true });
      if (flower) sillFlower(fb);
    };
    frame(b);
    const front = new PixelBuffer(30, 26);
    frame(front);
    const s = finish(b, 15, 22);
    return { ...s, ay: s.ay + 9, front: outline(front).toCanvas() };            // it sits up on the wall
  },

  dollBench() {
    const b = new PixelBuffer(46, 12);
    b.rect(1, 3, 44, 4, "petalPink", { shadeAs: [23, 2, 23, 4] });          // the cushion
    b.rect(0, 6, 46, 3, "wood");
    b.rect(2, 9, 2, 3, "bark"); b.rect(42, 9, 2, 3, "bark"); b.rect(22, 9, 2, 3, "bark");
    for (let x = 4; x < 44; x += 6) b.set(x, 4, RAMPS.petalPink[0]);
    return finish(b, 23, 11);
  },

  picture() {
    const b = new PixelBuffer(14, 12);
    b.rect(0, 0, 14, 12, "wood");
    b.rect(2, 2, 10, 8, "duskLavender", { flat: true });
    b.rect(2, 7, 10, 3, "meadowGreen", { flat: true });
    b.ellipse(5, 7.5, 4, 1.8, RAMPS.meadowGreen[2], { flat: true, clip: (x, y) => y < 10 && x >= 2 });
    for (const [x, y] of [[8, 3], [7, 4], [8, 4], [9, 4], [8, 5]]) b.set(x, y, "starlight");
    const s = finish(b, 7, 11);
    return { ...s, ay: s.ay + 10 };           // it hangs up on the wall
  },
});
