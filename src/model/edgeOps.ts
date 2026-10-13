import type { BoxElement, Doc, EdgeEl, Element, Id, Side } from './types';
import { edgeGeometry, polylineLength, projectOnPolyline, snap, type Pt } from './geometry';
import { makeJunction, newId } from './defaults';

const findBox = (doc: Doc, id: Id) => doc.elements.find((e) => e.id === id) as BoxElement | undefined;

/**
 * 矢印を点 p で2本に分け、そこに分岐点を置く。
 * 見た目の経路が変わらないよう、直角線では出入りの向きを引き継ぐ。
 */
export function splitEdge(doc: Doc, edgeId: Id, p: Pt, grid: number | null): { doc: Doc; junctionId: Id } | null {
  const idx = doc.elements.findIndex((e) => e.id === edgeId);
  const edge = doc.elements[idx] as EdgeEl | undefined;
  if (!edge || edge.type !== 'edge') return null;
  const from = findBox(doc, edge.from),
    to = findBox(doc, edge.to);
  if (!from || !to) return null;

  const geo = edgeGeometry(edge, from, to);
  const pts = geo.points;
  const proj = projectOnPolyline(pts, p);
  const i = proj.seg * 2;
  const dx = pts[i + 2] - pts[i],
    dy = pts[i + 3] - pts[i + 1];
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  let q = proj.point;

  // 水平・垂直の線上ではグリッドに合わせる（線から外れない向きだけ）
  if (grid) {
    if (Math.abs(dy) < 0.01) {
      const lo = Math.min(pts[i], pts[i + 2]),
        hi = Math.max(pts[i], pts[i + 2]);
      q = { x: Math.max(lo, Math.min(hi, snap(q.x, grid))), y: q.y };
    } else if (Math.abs(dx) < 0.01) {
      const lo = Math.min(pts[i + 1], pts[i + 3]),
        hi = Math.max(pts[i + 1], pts[i + 3]);
      q = { x: q.x, y: Math.max(lo, Math.min(hi, snap(q.y, grid))) };
    }
  }

  const junction = makeJunction(q.x, q.y);
  const total = polylineLength(pts);
  const at = proj.along;

  // 中継点を分割位置の前後に振り分ける
  const before: Pt[] = [],
    after: Pt[] = [];
  for (const w of edge.waypoints ?? []) (projectOnPolyline(pts, w).along < at ? before : after).push(w);

  // 分岐点への入り口・出口の向き（直角線の形を保つため）
  const enter: Side = horizontal ? (dx >= 0 ? 'left' : 'right') : dy >= 0 ? 'top' : 'bottom';
  const exit: Side = horizontal ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top';
  const ortho = edge.routing === 'orthogonal';

  const labelAt = edge.labelPos * total;
  const labelFirst = labelAt <= at;

  const first: EdgeEl = {
    ...edge,
    id: newId('edge'),
    to: junction.id,
    toSide: ortho ? enter : 'auto',
    toOffset: 0.5,
    fromSide: ortho ? geo.sides[0] : edge.fromSide,
    waypoints: before,
    head: edge.head === 'both' || edge.head === 'start' ? 'start' : 'none',
    label: labelFirst ? edge.label : '',
    labelPos: labelFirst && at > 0 ? Math.min(1, labelAt / at) : 0.5,
    endWidth: edge.taper ? edge.strokeWidth + (edge.endWidth - edge.strokeWidth) * (at / (total || 1)) : edge.endWidth,
  };
  const second: EdgeEl = {
    ...edge,
    id: newId('edge'),
    from: junction.id,
    fromSide: ortho ? exit : 'auto',
    fromOffset: 0.5,
    toSide: ortho ? geo.sides[1] : edge.toSide,
    waypoints: after,
    head: edge.head === 'both' || edge.head === 'end' ? 'end' : 'none',
    label: labelFirst ? '' : edge.label,
    labelPos: !labelFirst && total > at ? Math.max(0, (labelAt - at) / (total - at)) : 0.5,
    strokeWidth: edge.taper ? first.endWidth : edge.strokeWidth,
  };

  const elements: Element[] = [...doc.elements.slice(0, idx), first, second, ...doc.elements.slice(idx + 1), junction];
  return { doc: { ...doc, elements }, junctionId: junction.id };
}

/** 両端が動いた矢印の中継点を一緒に動かすための対象 */
export function waypointStarts(doc: Doc, moving: Set<Id>): Map<Id, Pt[]> {
  const out = new Map<Id, Pt[]>();
  for (const e of doc.elements) {
    if (e.type === 'edge' && e.waypoints?.length && moving.has(e.from) && moving.has(e.to)) out.set(e.id, e.waypoints);
  }
  return out;
}

export function shiftWaypoints(el: Element, starts: Map<Id, Pt[]>, dx: number, dy: number): Element {
  const s = starts.get(el.id);
  if (!s || el.type !== 'edge') return el;
  return { ...el, waypoints: s.map((w) => ({ x: w.x + dx, y: w.y + dy })) };
}

/** 新しい中継点を、経路に沿った順番の位置に差し込む */
export function insertWaypointIndex(points: number[], waypoints: Pt[], p: Pt): number {
  const at = projectOnPolyline(points, p).along;
  return waypoints.filter((w) => projectOnPolyline(points, w).along < at).length;
}
