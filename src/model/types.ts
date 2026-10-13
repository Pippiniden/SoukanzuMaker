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
  /** 名前・サブテキストのフォント */
  font: string;
  /** 文字エリアの高さ（px、0 = 自動） */
  textArea: number;
  /** 文字エリアの背景（名札の帯）。transparent でカードの背景のまま */
  textBg: string;
  badge: string;
  badgeFill: string;
  badgeColor: string;
  badgeSize: number;
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
/** 見出しの縦位置（名前は互換のため旧名を残している） */
export type FrameTitlePos = 'insideTopLeft' | 'onTopEdge' | 'outsideTopLeft' | 'insideBottom' | 'none';
export type Align = 'left' | 'center' | 'right';

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
  titleAlign: Align;
  /** 見出し位置の微調整（px） */
  titleDx: number;
  titleDy: number;
  titleColor: string;
  titleSize: number;
  subtitleSize: number;
  titleBg: string;
  font: string;
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
  /** 辺上の接続位置（0〜1、0.5 = 中央）。辺を指定したときだけ有効 */
  fromOffset: number;
  toOffset: number;
  /** 手動で追加した中継点（ページ座標） */
  waypoints: { x: number; y: number }[];
  routing: Routing;
  /** 直角線の折れ位置（0〜1）／曲線の曲がり具合（-1〜1） */
  bend: number;
  stroke: string;
  /** 始点側の太さ */
  strokeWidth: number;
  /** 太さを変える（始点 strokeWidth → 終点 endWidth） */
  taper: boolean;
  endWidth: number;
  dash: Dash;
  head: ArrowHead;
  headSize: number;
  label: string;
  labelColor: string;
  labelSize: number;
  labelFont: string;
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
  font: string;
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

/** 矢印の分岐・合流点 */
export interface JunctionEl extends BaseEl {
  type: 'junction';
  /** 点を描くか（描かない場合は画像に出ない） */
  dot: boolean;
  dotSize: number;
  dotColor: string;
}

export type Element = CardEl | FrameEl | EdgeEl | TextEl | ImageEl | JunctionEl;
export type BoxElement = CardEl | FrameEl | TextEl | ImageEl | JunctionEl;

export interface DocSettings {
  gridSize: number;
  showGrid: boolean;
  snap: boolean;
  /** 何マスごとに太線を引くか（0 = 引かない） */
  majorEvery: number;
  /** ドラッグ中に他の要素と揃う位置へ吸い付け、ガイド線を出す */
  guides: boolean;
  /** 新しく作る要素のフォント */
  font: string;
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
