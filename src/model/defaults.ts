import type {
  CardEl,
  Doc,
  EdgeEl,
  FrameEl,
  Id,
  ImageEl,
  JunctionEl,
  TextEl,
} from './types';

import { DEFAULT_FONT } from './fonts';

export const FONT_FAMILY =
  "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', Meiryo, sans-serif";

let counter = 0;
export function newId(prefix = 'e'): Id {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${counter.toString(36)}`;
}

// ---------- 多角形テンプレート（0〜1 の正規化座標） ----------

export interface PolygonTemplate {
  key: string;
  label: string;
  points: number[];
}

export const POLYGON_TEMPLATES: PolygonTemplate[] = [
  { key: 'L', label: 'L字', points: [0, 0, 0.5, 0, 0.5, 0.5, 1, 0.5, 1, 1, 0, 1] },
  { key: 'J', label: '逆L字', points: [0.5, 0, 1, 0, 1, 1, 0, 1, 0, 0.5, 0.5, 0.5] },
  {
    key: 'T',
    label: 'T字',
    points: [0, 0, 1, 0, 1, 0.4, 0.65, 0.4, 0.65, 1, 0.35, 1, 0.35, 0.4, 0, 0.4],
  },
  {
    key: 'convex',
    label: '凸字',
    points: [0.3, 0, 0.7, 0, 0.7, 0.35, 1, 0.35, 1, 1, 0, 1, 0, 0.35, 0.3, 0.35],
  },
  {
    key: 'U',
    label: 'コ字',
    points: [0, 0, 1, 0, 1, 0.3, 0.4, 0.3, 0.4, 0.7, 1, 0.7, 1, 1, 0, 1],
  },
  { key: 'step', label: '段付き', points: [0.4, 0, 1, 0, 1, 1, 0, 1, 0, 0.45, 0.4, 0.45] },
  { key: 'hex', label: '六角形', points: [0.25, 0, 0.75, 0, 1, 0.5, 0.75, 1, 0.25, 1, 0, 0.5] },
  { key: 'diamond', label: 'ひし形', points: [0.5, 0, 1, 0.5, 0.5, 1, 0, 0.5] },
  { key: 'rectPoly', label: '四角（頂点編集用）', points: [0, 0, 1, 0, 1, 1, 0, 1] },
];

// ---------- スタイルプリセット ----------

export interface Preset<T> {
  key: string;
  label: string;
  style: Partial<T>;
}

export const CARD_PRESETS: Preset<CardEl>[] = [
  {
    key: 'standard',
    label: '標準',
    style: { fill: '#ffffff', stroke: '#d9dde3', strokeWidth: 1, titleColor: '#1d2330', subtitleColor: '#6b7280', shadow: true },
  },
  {
    key: 'navy',
    label: '強調（紺）',
    style: { fill: '#1f3a68', stroke: '#1f3a68', strokeWidth: 0, titleColor: '#ffffff', subtitleColor: '#c9d5ea', shadow: true },
  },
  {
    key: 'teal',
    label: '枠線（青緑）',
    style: { fill: '#ffffff', stroke: '#27a5a0', strokeWidth: 3, titleColor: '#1d2330', subtitleColor: '#6b7280', shadow: false },
  },
  {
    key: 'plain',
    label: 'フラット',
    style: { fill: '#f3efe7', stroke: '#f3efe7', strokeWidth: 0, titleColor: '#3a3226', subtitleColor: '#8a7c66', shadow: false },
  },
];

export const FRAME_PRESETS: Preset<FrameEl>[] = [
  {
    key: 'pink',
    label: '淡ピンク',
    style: { fill: '#f9dde6', fill2: undefined, fillOpacity: 0.7, stroke: '#e6a3b9', strokeWidth: 2, dash: 'solid', titleColor: '#1f3a68', titleBg: '#ffffff' },
  },
  {
    key: 'blue',
    label: '淡ブルー',
    style: { fill: '#dceefa', fill2: undefined, fillOpacity: 0.7, stroke: '#7fb8e0', strokeWidth: 2, dash: 'solid', titleColor: '#1f3a68', titleBg: '#ffffff' },
  },
  {
    key: 'beige',
    label: 'ベージュ枠',
    style: { fill: '#fdf7ee', fill2: undefined, fillOpacity: 1, stroke: '#c79a64', strokeWidth: 2, dash: 'solid', titleColor: '#8a5a2b', titleBg: '#ffffff' },
  },
  {
    key: 'navy',
    label: '濃紺の帯',
    style: { fill: '#1f3a68', fill2: undefined, fillOpacity: 1, stroke: '#1f3a68', strokeWidth: 0, dash: 'solid', titleColor: '#ffffff', titleBg: '#1f3a68' },
  },
  {
    key: 'gradient',
    label: 'グラデーション',
    style: { fill: '#fbd3e1', fill2: '#ffffff', fillOpacity: 1, stroke: '#f0b6ca', strokeWidth: 1, dash: 'solid', titleColor: '#1f3a68', titleBg: '#ffffff' },
  },
  {
    key: 'outline',
    label: '線のみ（破線）',
    style: { fill: '#ffffff', fill2: undefined, fillOpacity: 0, stroke: '#7b8494', strokeWidth: 2, dash: 'dashed', titleColor: '#3d4554', titleBg: '#ffffff' },
  },
];

export const EDGE_PRESETS: Preset<EdgeEl>[] = [
  { key: 'teal', label: '標準（青緑）', style: { stroke: '#27a5a0', labelColor: '#27a5a0', dash: 'solid', strokeWidth: 4 } },
  { key: 'hostile', label: '敵対（赤）', style: { stroke: '#d64545', labelColor: '#d64545', dash: 'solid', strokeWidth: 4 } },
  { key: 'love', label: '好意（ピンク）', style: { stroke: '#e0629a', labelColor: '#e0629a', dash: 'solid', strokeWidth: 3 } },
  { key: 'oneway', label: '片想い（ピンク破線）', style: { stroke: '#e0629a', labelColor: '#e0629a', dash: 'dashed', strokeWidth: 3, head: 'end' } },
  { key: 'ally', label: '協力（青）', style: { stroke: '#3a74d0', labelColor: '#3a74d0', dash: 'solid', strokeWidth: 3 } },
  { key: 'past', label: '過去・不明（灰点線）', style: { stroke: '#8a919e', labelColor: '#6b7280', dash: 'dotted', strokeWidth: 3 } },
];

// ---------- 要素の生成 ----------

export function makeCard(x: number, y: number, over: Partial<CardEl> = {}): CardEl {
  return {
    id: newId('card'),
    type: 'card',
    x,
    y,
    width: 140,
    height: 180,
    layout: 'photo',
    noImage: 'nameOnly',
    imageZoom: 1,
    imageFocusX: 0.5,
    imageFocusY: 0.35,
    title: '星野 ひかり',
    subtitle: '2年A組',
    font: DEFAULT_FONT,
    textArea: 0,
    textBg: 'transparent',
    badge: '',
    badgeFill: '#27a5a0',
    badgeColor: '#ffffff',
    badgeSize: 14,
    fill: '#ffffff',
    stroke: '#d9dde3',
    strokeWidth: 1,
    cornerRadius: 2,
    titleColor: '#1d2330',
    titleSize: 17,
    subtitleColor: '#6b7280',
    subtitleSize: 11,
    shadow: true,
    ...over,
  };
}

export function makeFrame(
  x: number,
  y: number,
  shape: FrameEl['shape'],
  over: Partial<FrameEl> = {},
  templateKey?: string,
): FrameEl {
  const width = over.width ?? 360;
  const height = over.height ?? 280;
  let points: number[] = [];
  if (shape === 'polygon') {
    const tpl = POLYGON_TEMPLATES.find((t) => t.key === templateKey) ?? POLYGON_TEMPLATES[0];
    points = tpl.points.map((v, i) => Math.round(v * (i % 2 === 0 ? width : height)));
  }
  return {
    id: newId('frame'),
    type: 'frame',
    x,
    y,
    shape,
    width,
    height,
    points,
    fill: '#dceefa',
    fillOpacity: 0.7,
    stroke: '#7fb8e0',
    strokeWidth: 2,
    dash: 'solid',
    cornerRadius: 0,
    title: '2年A組',
    subtitle: 'CLASS 2-A',
    titlePos: 'insideTopLeft',
    titleAlign: 'left',
    titleDx: 0,
    titleDy: 0,
    subtitleSize: 10,
    font: DEFAULT_FONT,
    titleColor: '#1f3a68',
    titleSize: 20,
    titleBg: '#ffffff',
    ...over,
  };
}

export function makeText(x: number, y: number, over: Partial<TextEl> = {}): TextEl {
  return {
    id: newId('text'),
    type: 'text',
    x,
    y,
    text: '学園 人物相関図',
    font: DEFAULT_FONT,
    width: 200,
    fontSize: 20,
    fill: '#1d2330',
    bold: true,
    vertical: false,
    align: 'left',
    strokeColor: '#ffffff',
    strokeWidth: 0,
    ...over,
  };
}

export function makeImage(x: number, y: number, imageId: Id, width: number, height: number): ImageEl {
  return { id: newId('img'), type: 'image', x, y, imageId, width, height };
}

export function makeEdge(from: Id, to: Id, over: Partial<EdgeEl> = {}): EdgeEl {
  return {
    id: newId('edge'),
    type: 'edge',
    from,
    to,
    fromSide: 'auto',
    toSide: 'auto',
    fromOffset: 0.5,
    toOffset: 0.5,
    waypoints: [],
    routing: 'orthogonal',
    bend: 0.5,
    stroke: '#27a5a0',
    strokeWidth: 4,
    taper: false,
    endWidth: 10,
    dash: 'solid',
    head: 'end',
    headSize: 12,
    label: '',
    labelColor: '#27a5a0',
    labelSize: 15,
    labelFont: DEFAULT_FONT,
    labelBg: '#ffffff',
    labelPos: 0.5,
    labelVertical: false,
    ...over,
  };
}

export function makeJunction(x: number, y: number, over: Partial<JunctionEl> = {}): JunctionEl {
  return { id: newId('jct'), type: 'junction', x, y, dot: false, dotSize: 10, dotColor: '#27a5a0', ...over };
}

/** 古い保存データに新しい項目の既定値を補う */
export function migrateDoc(doc: Doc): Doc {
  return {
    ...doc,
    settings: { ...emptyDoc().settings, ...doc.settings },
    elements: doc.elements.map((e) => {
      if (e.type === 'edge') {
        return {
          ...e,
          fromOffset: e.fromOffset ?? 0.5,
          toOffset: e.toOffset ?? 0.5,
          waypoints: e.waypoints ?? [],
          taper: e.taper ?? false,
          endWidth: e.endWidth ?? e.strokeWidth * 2.5,
          labelFont: e.labelFont ?? DEFAULT_FONT,
        };
      }
      if (e.type === 'card')
        return {
          ...e,
          noImage: e.noImage ?? 'nameOnly',
          font: e.font ?? DEFAULT_FONT,
          textArea: e.textArea ?? 0,
          textBg: e.textBg ?? 'transparent',
          badgeSize: e.badgeSize ?? 14,
        };
      if (e.type === 'frame')
        return {
          ...e,
          titleAlign: e.titleAlign ?? 'left',
          titleDx: e.titleDx ?? 0,
          titleDy: e.titleDy ?? 0,
          subtitleSize: e.subtitleSize ?? Math.max(9, Math.round(e.titleSize * 0.5)),
          font: e.font ?? DEFAULT_FONT,
        };
      if (e.type === 'text') return { ...e, font: e.font ?? DEFAULT_FONT };
      return e;
    }),
  };
}

export const CANVAS_PRESETS = [
  { label: '縦長 1200×1500', width: 1200, height: 1500 },
  { label: 'A4縦 1240×1754', width: 1240, height: 1754 },
  { label: 'A4横 1754×1240', width: 1754, height: 1240 },
  { label: '正方形 1080×1080', width: 1080, height: 1080 },
  { label: 'SNS縦 1080×1350', width: 1080, height: 1350 },
  { label: '16:9 1920×1080', width: 1920, height: 1080 },
];

export function emptyDoc(): Doc {
  return {
    version: 1,
    title: '学園 人物相関図',
    width: 1200,
    height: 1500,
    background: '#ffffff',
    elements: [],
    settings: { gridSize: 20, showGrid: true, snap: true, majorEvery: 5, guides: true, font: DEFAULT_FONT },
  };
}
