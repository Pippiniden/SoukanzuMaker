import type { Pt } from '../model/geometry';
import { pointAtDistance, polylineLength } from '../model/geometry';

export interface EdgeDrawOptions {
  color: string;
  /** 始点・終点の太さ（同じなら一定の太さ） */
  w0: number;
  w1: number;
  dash: 'solid' | 'dashed' | 'dotted';
  headStart: boolean;
  headEnd: boolean;
  headSize: number;
  /** 線の端を丸めて、分岐点で線がきれいにつながるようにする */
  roundStart: boolean;
  roundEnd: boolean;
  miter: boolean;
}

interface Head {
  len: number;
  width: number;
}

/** 矢じりの大きさ（太い線でも先端が埋もれないよう、線幅に合わせて大きくする） */
export function headFor(size: number, lineWidth: number, taper: boolean): Head {
  const width = Math.max(size, lineWidth * (taper ? 2.4 : 2));
  return { width, len: width * 0.95 };
}

function toPts(points: number[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points.length; i += 2) out.push({ x: points[i], y: points[i + 1] });
  return out;
}

/** 始点から a、終点から b だけ短くした折れ線 */
function trim(points: number[], a: number, b: number): number[] {
  const total = polylineLength(points);
  if (a + b >= total - 0.5) {
    const m = pointAtDistance(points, total / 2);
    return [m.x, m.y, m.x + 0.01, m.y];
  }
  const out: number[] = [];
  const s = pointAtDistance(points, a);
  out.push(s.x, s.y);
  let acc = 0;
  for (let i = 0; i < points.length - 2; i += 2) {
    acc += Math.hypot(points[i + 2] - points[i], points[i + 3] - points[i + 1]);
    if (acc > a && acc < total - b) out.push(points[i + 2], points[i + 3]);
  }
  const e = pointAtDistance(points, total - b);
  out.push(e.x, e.y);
  return out;
}

function drawHead(c: CanvasRenderingContext2D, points: number[], atEnd: boolean, head: Head) {
  const total = polylineLength(points);
  const tip = atEnd ? pointAtDistance(points, total) : pointAtDistance(points, 0);
  const back = atEnd ? pointAtDistance(points, Math.max(0, total - head.len)) : pointAtDistance(points, Math.min(total, head.len));
  let dx = tip.x - back.x,
    dy = tip.y - back.y;
  const l = Math.hypot(dx, dy) || 1;
  dx /= l;
  dy /= l;
  const bx = tip.x - dx * head.len,
    by = tip.y - dy * head.len;
  const nx = -dy * (head.width / 2),
    ny = dx * (head.width / 2);
  c.beginPath();
  c.moveTo(tip.x, tip.y);
  c.lineTo(bx + nx, by + ny);
  c.lineTo(bx - nx, by - ny);
  c.closePath();
  c.fill();
}

/** 太さが変わる線を、輪郭の多角形として塗る */
function drawTapered(c: CanvasRenderingContext2D, points: number[], fromD: number, total: number, w0: number, w1: number, miter: boolean) {
  const pts = toPts(points);
  const n = pts.length;
  const widths: number[] = [];
  let acc = fromD;
  for (let i = 0; i < n; i++) {
    if (i > 0) acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    widths.push(w0 + (w1 - w0) * Math.min(1, acc / (total || 1)));
  }
  const left: Pt[] = [],
    right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)],
      next = pts[Math.min(n - 1, i + 1)];
    let d1x = p.x - prev.x,
      d1y = p.y - prev.y;
    let d2x = next.x - p.x,
      d2y = next.y - p.y;
    const l1 = Math.hypot(d1x, d1y),
      l2 = Math.hypot(d2x, d2y);
    if (l1 < 1e-6) {
      d1x = d2x;
      d1y = d2y;
    }
    if (l2 < 1e-6) {
      d2x = d1x;
      d2y = d1y;
    }
    const n1 = norm(-d1y, d1x),
      n2 = norm(-d2y, d2x);
    let mx = n1.x + n2.x,
      my = n1.y + n2.y;
    const ml = Math.hypot(mx, my) || 1;
    mx /= ml;
    my /= ml;
    const cos = mx * n1.x + my * n1.y;
    const scale = miter ? Math.min(4, 1 / Math.max(0.25, cos)) : 1;
    const hw = (widths[i] / 2) * scale;
    left.push({ x: p.x + mx * hw, y: p.y + my * hw });
    right.push({ x: p.x - mx * hw, y: p.y - my * hw });
  }
  c.beginPath();
  c.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < n; i++) c.lineTo(left[i].x, left[i].y);
  for (let i = n - 1; i >= 0; i--) c.lineTo(right[i].x, right[i].y);
  c.closePath();
  c.fill();
}

function norm(x: number, y: number): Pt {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
}

export function drawEdge(c: CanvasRenderingContext2D, points: number[], o: EdgeDrawOptions) {
  const total = polylineLength(points);
  if (total < 0.5) return;
  const taper = Math.abs(o.w0 - o.w1) > 0.01;
  const hs = headFor(o.headSize, o.w0, taper);
  const he = headFor(o.headSize, o.w1, taper);
  // 線は矢じりの中ほどまでで止める（先端から線がはみ出さないように）
  const cutS = o.headStart ? hs.len * 0.7 : 0;
  const cutE = o.headEnd ? he.len * 0.7 : 0;
  const shaft = trim(points, cutS, cutE);

  c.save();
  c.fillStyle = o.color;
  c.strokeStyle = o.color;
  if (taper) {
    drawTapered(c, shaft, cutS, total, o.w0, o.w1, o.miter);
  } else {
    c.lineWidth = o.w0;
    c.lineJoin = o.miter ? 'miter' : 'round';
    c.miterLimit = 4;
    c.lineCap = o.dash === 'dotted' ? 'round' : 'butt';
    c.setLineDash(o.dash === 'dashed' ? [o.w0 * 3, o.w0 * 2] : o.dash === 'dotted' ? [0.001, o.w0 * 2] : []);
    c.beginPath();
    c.moveTo(shaft[0], shaft[1]);
    for (let i = 2; i < shaft.length; i += 2) c.lineTo(shaft[i], shaft[i + 1]);
    c.stroke();
    c.setLineDash([]);
  }
  // 分岐点側の端を丸めて継ぎ目をなくす
  if (o.roundStart && !o.headStart) dot(c, points[0], points[1], o.w0 / 2);
  if (o.roundEnd && !o.headEnd) dot(c, points[points.length - 2], points[points.length - 1], o.w1 / 2);
  if (o.headEnd) drawHead(c, points, true, he);
  if (o.headStart) drawHead(c, points, false, hs);
  c.restore();
}

function dot(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}
