// HugType: layout and outline algorithms, copied as-is from the plugin's ui.html.
// Do not edit the algorithms here; only the export keywords were added.

// ---- Layout (shared by preview and render) -------------------------------
// Coordinates: the text box's (0,0 = top-left of the column).
// masks: [{ x, y, w, h, iw, ih, left[], right[] }]  (left/right = first/last opaque pixel per row, -1 if empty)

function rowRange(m, y0, y1) {
  var a = Math.max(y0, m.y), b = Math.min(y1, m.y + m.h);
  if (b <= a) return null;
  var sy = m.ih / m.h;
  return [Math.max(0, Math.floor((a - m.y) * sy)), Math.min(m.ih - 1, Math.ceil((b - m.y) * sy) - 1)];
}

// AROUND --------------------------------------------------------------------
function blockedIntervals(masks, y0, y1, margin) {
  var ivs = [];
  for (var i = 0; i < masks.length; i++) {
    var m = masks[i], rr = rowRange(m, y0, y1);
    if (!rr) continue;
    var L = Infinity, R = -Infinity;
    for (var r = rr[0]; r <= rr[1]; r++) {
      if (m.left[r] < 0) continue;
      if (m.left[r] < L) L = m.left[r];
      if (m.right[r] > R) R = m.right[r];
    }
    if (L === Infinity) continue;
    var sx = m.iw / m.w;
    ivs.push([m.x + L / sx - margin, m.x + (R + 1) / sx + margin]);
  }
  return ivs;
}

// Free segments of [0, W]. lo / ro: an object touches the segment's left / right edge.
function freeSegments(ivs, W, minSeg) {
  ivs.sort(function (p, q) { return p[0] - q[0]; });
  var segs = [], cur = 0, curObs = false;
  for (var i = 0; i < ivs.length; i++) {
    var a = ivs[i][0], b = ivs[i][1];
    if (a > cur) segs.push({ l: cur, r: Math.min(a, W), lo: curObs, ro: a < W });
    if (b > cur) { cur = b; curObs = true; }
  }
  if (cur < W) segs.push({ l: cur, r: W, lo: curObs, ro: false });
  return segs.filter(function (s) { return s.r - s.l >= minSeg; });
}

// Left: the leftmost segment, as long as an object is on its right (or there is no object on the line).
// Right: the reverse. Both sides: every segment.
function pickSegments(segs, side, hasObstacle) {
  if (!segs.length) return [];
  var first = segs[0], last = segs[segs.length - 1];
  if (side === 'all') return segs;
  if (side === 'right') return (last.lo || !hasObstacle) ? [last] : [];
  return (first.ro || !hasObstacle) ? [first] : [];
}

function aroundLines(p, minSeg) {
  var m = p.settings.margin;
  return function (i) {
    var y = i * p.lh;
    if (p.maxH != null && y + p.lh > p.maxH + 0.5) return null;
    var ivs = blockedIntervals(p.masks, y - m, y + p.lh + m, m);
    var hasObs = ivs.some(function (iv) { return iv[1] > 0 && iv[0] < p.W; });
    return { y: y, segs: pickSegments(freeSegments(ivs, p.W, minSeg), p.settings.side, hasObs), forceW: p.W - 1 };
  };
}

// INSIDE --------------------------------------------------------------------
// Each line gets the part of the band that is inside the shape on every row.
function insideLines(p, minSeg) {
  var inset = p.settings.margin, slots = [];
  var shapes = p.masks.slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; });
  shapes.forEach(function (m) {
    var sx = m.iw / m.w;
    for (var y = m.y + inset; y + p.lh <= m.y + m.h - inset + 0.5; y += p.lh) {
      var rr = rowRange(m, y, y + p.lh), seg = null;
      if (rr) {
        var L = -Infinity, R = Infinity, ok = true;
        for (var r = rr[0]; r <= rr[1]; r++) {
          if (m.left[r] < 0) { ok = false; break; }
          if (m.left[r] > L) L = m.left[r];
          if (m.right[r] < R) R = m.right[r];
        }
        if (ok) {
          var l = m.x + L / sx + inset, rgt = m.x + (R + 1) / sx - inset;
          if (rgt - l >= minSeg) seg = { l: l, r: rgt, lo: true, ro: true };
        }
      }
      slots.push({ y: y, segs: seg ? [seg] : [], forceW: Infinity });
    }
  });
  return function (i) { return i < slots.length ? slots[i] : null; };
}

// FLOW ----------------------------------------------------------------------
// p = { paras: [[word]], W, maxH|null, lh, fontSize, masks, settings, wordW(word), spaceW }
function layout(p) {
  var s = p.settings, inside = s.mode === 'inside';
  var minSeg = Math.max(p.fontSize * 3, 12);
  var next = inside ? insideLines(p, minSeg) : aroundLines(p, minSeg);
  var align0 = inside ? (s.alignInside || 'center') : s.align;

  var paras = p.paras, lines = [];
  var pi = 0, wi = 0, line = 0, emptyStreak = 0, lastY = 0;

  while (pi < paras.length) {
    var slot = next(line);
    if (!slot) break;
    lastY = slot.y + p.lh;
    if (paras[pi].length === 0) { pi++; wi = 0; line++; continue; }
    var placed = false;

    for (var k = 0; k < slot.segs.length && pi < paras.length; k++) {
      var seg = slot.segs[k], segW = seg.r - seg.l, words = paras[pi], take = [], w = 0;
      while (wi < words.length) {
        var nw = w + (take.length ? p.spaceW : 0) + p.wordW(words[wi]);
        if (nw <= segW + 0.5) { take.push(words[wi]); w = nw; wi++; } else break;
      }
      if (!take.length) {
        if (segW >= slot.forceW) { take.push(words[wi]); w = p.wordW(words[wi]); wi++; } else continue;
      }
      var paraEnd = wi >= words.length;
      var isLast = paraEnd && pi === paras.length - 1;
      var align = align0;
      if (align === 'contour') align = seg.lo ? 'left' : (seg.ro ? 'right' : 'left');
      var gapExtra = 0, x = seg.l;
      if (align === 'justify') {
        if (!paraEnd && !isLast && take.length > 1) gapExtra = (segW - w) / (take.length - 1);
      } else if (align === 'right') x = seg.r - w;
      else if (align === 'center') x = (seg.l + seg.r - w) / 2;
      var xs = [], cx = x;
      for (var t = 0; t < take.length; t++) { xs.push(cx); cx += p.wordW(take[t]) + p.spaceW + gapExtra; }
      lines.push({ words: take, y: slot.y, x: x, xs: xs, gapExtra: gapExtra });
      placed = true;
      if (paraEnd) { pi++; wi = 0; break; }
    }

    line++;
    emptyStreak = placed ? 0 : emptyStreak + 1;
    if (emptyStreak > 2000 || line > 20000) break;
  }

  var remaining = 0;
  for (var q = pi; q < paras.length; q++) remaining += paras[q].length - (q === pi ? wi : 0);
  return { lines: lines, remaining: remaining, height: lastY };
}

// ---- Outline path (text that follows the silhouette) ----------------------
// objs: [{ x, y, w, h, al: { w, h, a } }] in world coords. Returns a closed, clockwise, smoothed loop
// offset by `margin` around the union of the objects, as points + an SVG path (cubic Béziers).

function edt1d(f, n, d, v, z) {
  var k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (var q = 1; q < n; q++) {
    var s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}

// Squared Euclidean distance to the nearest "inside" cell (Felzenszwalb & Huttenlocher)
function distanceField(inside, W, H) {
  var INF = 1e20, g = new Float64Array(W * H), n = Math.max(W, H);
  var f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (var i = 0; i < W * H; i++) g[i] = inside[i] ? 0 : INF;
  for (var x = 0; x < W; x++) {
    for (var y = 0; y < H; y++) f[y] = g[y * W + x];
    edt1d(f, H, d, v, z);
    for (y = 0; y < H; y++) g[y * W + x] = d[y];
  }
  for (y = 0; y < H; y++) {
    for (x = 0; x < W; x++) f[x] = g[y * W + x];
    edt1d(f, W, d, v, z);
    for (x = 0; x < W; x++) g[y * W + x] = Math.sqrt(d[x]);
  }
  return g;
}

function boxBlur(src, W, H, r) {
  if (r < 1) return src;
  var tmp = new Float64Array(W * H), out = new Float64Array(W * H), x, y, acc, n;
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    acc = 0; n = 0;
    for (var k = -r; k <= r; k++) { var xx = x + k; if (xx >= 0 && xx < W) { acc += src[y * W + xx]; n++; } }
    tmp[y * W + x] = acc / n;
  }
  for (x = 0; x < W; x++) for (y = 0; y < H; y++) {
    acc = 0; n = 0;
    for (k = -r; k <= r; k++) { var yy = y + k; if (yy >= 0 && yy < H) { acc += tmp[yy * W + x]; n++; } }
    out[y * W + x] = acc / n;
  }
  return out;
}

// Marching squares on f (value < 0 = inside). Returns the longest closed loop, in cell coordinates.
function isoLoop(f, W, H) {
  var segs = [];
  function interp(a, b) { return a / (a - b); }
  for (var y = 0; y < H - 1; y++) for (var x = 0; x < W - 1; x++) {
    var a = f[y * W + x], b = f[y * W + x + 1], c = f[(y + 1) * W + x + 1], d = f[(y + 1) * W + x];
    var idx = (a < 0 ? 8 : 0) | (b < 0 ? 4 : 0) | (c < 0 ? 2 : 0) | (d < 0 ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    var T = [x + interp(a, b), y], R = [x + 1, y + interp(b, c)], B = [x + interp(d, c), y + 1], L = [x, y + interp(a, d)];
    var map = { 1: [[L, B]], 2: [[B, R]], 3: [[L, R]], 4: [[T, R]], 5: [[L, T], [B, R]], 6: [[T, B]], 7: [[L, T]],
                8: [[L, T]], 9: [[T, B]], 10: [[T, R], [L, B]], 11: [[T, R]], 12: [[L, R]], 13: [[B, R]], 14: [[L, B]] };
    map[idx].forEach(function (s) { segs.push(s); });
  }
  var key = function (p) { return Math.round(p[0] * 1000) + ',' + Math.round(p[1] * 1000); };
  var adj = {};
  segs.forEach(function (s, i) {
    [key(s[0]), key(s[1])].forEach(function (k) { (adj[k] = adj[k] || []).push(i); });
  });
  var used = new Uint8Array(segs.length), best = null;
  for (var i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    var loop = [segs[i][0], segs[i][1]], end = key(segs[i][1]), start = key(segs[i][0]);
    while (end !== start) {
      var nx = (adj[end] || []).find(function (j) { return !used[j]; });
      if (nx == null) break;
      used[nx] = 1;
      var s2 = segs[nx], p = key(s2[0]) === end ? s2[1] : s2[0];
      loop.push(p); end = key(p);
    }
    if (!best || loop.length > best.length) best = loop;
  }
  return best;
}

function resampleLoop(pts, n) {
  var cum = [0], L = 0;
  for (var i = 1; i <= pts.length; i++) {
    var a = pts[i - 1], b = pts[i % pts.length];
    L += Math.hypot(b[0] - a[0], b[1] - a[1]); cum.push(L);
  }
  var out = [], j = 0;
  for (var k = 0; k < n; k++) {
    var t = k * L / n;
    while (cum[j + 1] < t) j++;
    var a2 = pts[j], b2 = pts[(j + 1) % pts.length], seg = cum[j + 1] - cum[j] || 1, u = (t - cum[j]) / seg;
    out.push([a2[0] + (b2[0] - a2[0]) * u, a2[1] + (b2[1] - a2[1]) * u]);
  }
  return out;
}

function smoothLoop(pts, win, passes) {
  var n = pts.length;
  for (var p = 0; p < passes; p++) {
    var nxt = [];
    for (var i = 0; i < n; i++) {
      var sx = 0, sy = 0, c = 0;
      for (var k = -win; k <= win; k++) { var q = pts[(i + k + n) % n]; sx += q[0]; sy += q[1]; c++; }
      nxt.push([sx / c, sy / c]);
    }
    pts = nxt;
  }
  return pts;
}

// Catmull-Rom point on segment i (P[i] -> P[i+1]) at u in [0,1]
function crPoint(P, i, u) {
  var n = P.length, p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
  var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
  var c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
  var v = 1 - u;
  return [v * v * v * p1[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * p2[0],
          v * v * v * p1[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * p2[1]];
}

function outlinePath(objs, opts) {
  if (!objs.length) return null;
  var margin = Math.max(0, opts.margin), smooth = opts.smooth / 100, thr = opts.threshold / 100 * 255;
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  objs.forEach(function (o) { x0 = Math.min(x0, o.x); y0 = Math.min(y0, o.y); x1 = Math.max(x1, o.x + o.w); y1 = Math.max(y1, o.y + o.h); });
  var cs = Math.max(x1 - x0, y1 - y0) / 260;              // world units per cell
  var blurR = Math.round(smooth * 18);                     // cells
  var pad = Math.ceil(margin / cs) + blurR * 2 + 4;
  var gx0 = x0 - pad * cs, gy0 = y0 - pad * cs;
  var W = Math.ceil((x1 - x0) / cs) + pad * 2, H = Math.ceil((y1 - y0) / cs) + pad * 2;
  var inside = new Uint8Array(W * H);
  objs.forEach(function (o) {
    var al = o.al;
    for (var gy = 0; gy < H; gy++) {
      var wy = gy0 + (gy + 0.5) * cs; if (wy < o.y || wy >= o.y + o.h) continue;
      var py = Math.floor((wy - o.y) / o.h * al.h);
      for (var gx = 0; gx < W; gx++) {
        var wx = gx0 + (gx + 0.5) * cs; if (wx < o.x || wx >= o.x + o.w) continue;
        var px = Math.floor((wx - o.x) / o.w * al.w);
        if (al.a[py * al.w + px] > thr) inside[gy * W + gx] = 1;
      }
    }
  });
  var dist = distanceField(inside, W, H);                  // in cells
  var f = boxBlur(boxBlur(boxBlur(dist, W, H, blurR), W, H, blurR), W, H, blurR);
  var iso = Math.max(margin / cs, 0.5);
  for (var i = 0; i < f.length; i++) f[i] -= iso;
  var loop = isoLoop(f, W, H);
  if (!loop || loop.length < 8) return null;
  var pts = loop.map(function (p) { return [gx0 + (p[0] + 0.5) * cs, gy0 + (p[1] + 0.5) * cs]; });

  var N = 96;
  pts = smoothLoop(resampleLoop(pts, 400), 1 + Math.round(smooth * 6), 2);
  pts = resampleLoop(pts, N);
  var area = 0;
  for (i = 0; i < N; i++) { var a = pts[i], b = pts[(i + 1) % N]; area += a[0] * b[1] - b[0] * a[1]; }
  if (area < 0) pts.reverse();                             // clockwise on screen: letters stand outside
  if (opts.inward) pts.reverse();                          // counter-clockwise: letters face the object
  var top = 0;
  for (i = 1; i < N; i++) if (pts[i][1] < pts[top][1]) top = i;
  pts = pts.slice(top).concat(pts.slice(0, top));

  // Dense polyline for measuring / drawing, segment by segment
  var dense = [], segStart = [], L = 0, prev = null;
  for (i = 0; i < N; i++) {
    segStart.push(L);
    for (var s = 0; s < 8; s++) {
      var p = crPoint(pts, i, s / 8);
      if (prev) L += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      dense.push({ x: p[0], y: p[1], d: L }); prev = p;
    }
  }
  var last = crPoint(pts, N - 1, 1); L += Math.hypot(last[0] - prev[0], last[1] - prev[1]);
  dense.push({ x: last[0], y: last[1], d: L });

  var mx = Infinity, my = Infinity;
  dense.forEach(function (q) { mx = Math.min(mx, q.x); my = Math.min(my, q.y); });
  var r2 = function (v) { return Math.round(v * 100) / 100; };
  var dStr = 'M ' + r2(pts[0][0] - mx) + ' ' + r2(pts[0][1] - my);
  for (i = 0; i < N; i++) {
    var p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
    dStr += ' C ' + r2(p1[0] + (p2[0] - p0[0]) / 6 - mx) + ' ' + r2(p1[1] + (p2[1] - p0[1]) / 6 - my) +
            ' ' + r2(p2[0] - (p3[0] - p1[0]) / 6 - mx) + ' ' + r2(p2[1] - (p3[1] - p1[1]) / 6 - my) +
            ' ' + r2(p2[0] - mx) + ' ' + r2(p2[1] - my);
  }
  dStr += ' Z';
  return { pts: pts, N: N, dense: dense, segStart: segStart, length: L, d: dStr, ox: mx, oy: my };
}

// Point and tangent angle at distance s along the dense polyline (wraps around the loop)
function pointAt(path, s) {
  var D = path.dense, L = path.length;
  s = ((s % L) + L) % L;
  var lo = 0, hi = D.length - 1;
  while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (D[mid].d <= s) lo = mid; else hi = mid; }
  var a = D[lo], b = D[hi], u = (s - a.d) / ((b.d - a.d) || 1);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, ang: Math.atan2(b.y - a.y, b.x - a.x) };
}

export { rowRange, blockedIntervals, freeSegments, pickSegments, aroundLines, insideLines, layout, outlinePath, pointAt };
