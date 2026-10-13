// 相関図ドキュメントのデータモデル
// すべての座標はキャンバス（ページ）左上を原点とした px 単位

export type Id = string;

export type Side = 'auto' | 'top' | 'right' | 'bottom' | 'left';
export type Dash = 'solid' | 'dashed' | 'dotted';

interface BaseEl {
  id: Id;
  /** レイヤー一覧に出す名前（未指定なら内容から自動） */
  name?: string;
  x: number;
  y: number;
  hidden?: boolean;
  locked?: boolean;
}

/** カードの表示形式 */
export type CardLayout =
  | 'photo' // 写真＋名前＋サブテキスト（公式相関図の形）
  | 'nameOnly' // 名前だけ
  | 'circle' // 丸アイコン＋名前
  | 'inline'; // 左に小アイコン、右に名前

export interface CardEl extends BaseEl {
  type: 'card';
  width: number;
  height: number;
  layout: CardLayout;
  imageId?: Id;
  /** 写真がないときの表示：名前だけのカードにする／頭文字アイコンで代替 */
  noImage: 'nameOnly' | 'initial';
  /** 写真の拡大率（1 = 枠に合わせて切り抜き） */
  imageZoom: number;
  /** 写真の表示位置（0〜1、0.5 = 中央） */
  imageFocusX: number;
  imageFocusY: number;
  title: string;
  subtitle: string;
  badge: string;
  badgeFill: string;
  badgeColor: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  titleColor: string;
  titleSize: number;
  subtitleColor: string;
  subtitleSize: number;
  shadow: boolean;
}

export type FrameShape = 'rect' | 'ellipse' | 'polygon';
export type FrameTitlePos = 'insideTopLeft' | 'onTopEdge' | 'outsideTopLeft' | 'none';

export interface FrameEl extends BaseEl {
  type: 'frame';
  shape: FrameShape;
  width: number;
  height: number;
  /** polygon のときの頂点（x, y からの相対座標の平坦配列） */
  points: number[];
  fill: string;
  fillOpacity: number;
  /** グラデーション（未指定なら単色） */
  fill2?: string;
  stroke: string;
  strokeWidth: number;
  dash: Dash;
  cornerRadius: number;
  title: string;
  subtitle: string;
  titlePos: FrameTitlePos;
  titleColor: string;
  titleSize: number;
  titleBg: string;
}

export type Routing = 'straight' | 'orthogonal' | 'curved';
export type ArrowHead = 'end' | 'start' | 'both' | 'none';

export interface EdgeEl {
  id: Id;
  type: 'edge';
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  from: Id;
  to: Id;
  fromSide: Side;
  toSide: Side;
  routing: Routing;
  /** 直角線の折れ位置（0〜1）／曲線の曲がり具合（-1〜1） */
  bend: number;
  stroke: string;
  strokeWidth: number;
  dash: Dash;
  head: ArrowHead;
  headSize: number;
  label: string;
  labelColor: string;
  labelSize: number;
  labelBg: string;
  /** ラベルの位置（線の長さに対する割合 0〜1） */
  labelPos: number;
  labelVertical: boolean;
}

export interface TextEl extends BaseEl {
  type: 'text';
  text: string;
  width: number;
  fontSize: number;
  fill: string;
  bold: boolean;
  vertical: boolean;
  align: 'left' | 'center' | 'right';
  strokeColor: string;
  strokeWidth: number;
}

export interface ImageEl extends BaseEl {
  type: 'image';
  imageId: Id;
  width: number;
  height: number;
}

export type Element = CardEl | FrameEl | EdgeEl | TextEl | ImageEl;
export type BoxElement = CardEl | FrameEl | TextEl | ImageEl;

export interface DocSettings {
  gridSize: number;
  showGrid: boolean;
  snap: boolean;
}

export interface Doc {
  version: 1;
  title: string;
  width: number;
  height: number;
  background: string;
  background2?: string;
  elements: Element[];
  settings: DocSettings;
}

/** 画像素材（id → dataURL）。履歴には含めない */
export type Assets = Record<Id, string>;
