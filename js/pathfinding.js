
function findPath(start, goal, width, height, isWalkable, stepCost = () => 1) {
  const size = width * height;
  const key = (x, y) => y * width + x;
  const dist = new Float64Array(size).fill(Infinity);
  const came = new Int32Array(size).fill(-1);
  const done = new Uint8Array(size);

  const heap = [];
  const push = (c, k) => {
    heap.push([c, k]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };

  const startKey = key(start.x, start.y), goalKey = key(goal.x, goal.y);
  dist[startKey] = 0;
  push(0, startKey);
  const score = (k) => {
    const x = k % width, y = (k - x) / width, dx = x - goal.x, dy = y - goal.y;
    return (dx * dx + dy * dy) * 1000 + dist[k];
  };
  let best = startKey;

  while (heap.length) {
    const [c, k] = pop();
    if (done[k]) continue;
    done[k] = 1;
    if (k === goalKey) { best = k; break; }
    if (score(k) < score(best)) best = k;
    const x = k % width, y = (k - x) / width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || !isWalkable(nx, ny)) continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal && !(isWalkable(x + dx, y) && isWalkable(x, y + dy))) continue;
      const nk = key(nx, ny), nc = c + stepCost(nx, ny) * (diagonal ? Math.SQRT2 : 1);
      if (nc < dist[nk]) { dist[nk] = nc; came[nk] = k; push(nc, nk); }
    }
  }

  const path = [];
  for (let k = best; k !== startKey && k !== -1; k = came[k]) path.push({ x: k % width, y: Math.floor(k / width) });
  return path.reverse();
}
