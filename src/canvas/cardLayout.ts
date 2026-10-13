import type { CardEl } from '../model/types';
import { measureText } from './text';

export interface Rect4 {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CardLayoutResult {
  layout: CardEl['layout'];
  /** 写真の領域（nameOnly のときは null） */
  photo: (Rect4 & { round: boolean }) | null;
  /** 名前・サブテキストの領域 */
  text: Rect4;
  align: 'left' | 'center';
  title: { x: number; y: number; w: number; h: number; lines: number };
  subtitle: { x: number; y: number; w: number } | null;
  lineT: number;
}

const PAD = 4;

/** 文字エリアの自動の高さ */
export function autoTextArea(el: CardEl) {
  return el.titleSize * 1.25 + (el.subtitle ? el.subtitleSize * 1.35 : 0) + 12;
}

export function cardLayout(el: CardEl, hasImage: boolean): CardLayoutResult {
  const { width: w, height: h } = el;
  const layout = !hasImage && el.noImage === 'nameOnly' ? 'nameOnly' : el.layout;
  const ta = Math.max(10, Math.min(h - 10, el.textArea > 0 ? el.textArea : autoTextArea(el)));

  let photo: CardLayoutResult['photo'] = null;
  let text: Rect4;
  let align: 'left' | 'center' = 'center';

  if (layout === 'photo') {
    photo = { x: 0, y: 0, w, h: h - ta, round: false };
    text = { x: 0, y: h - ta, w, h: ta };
  } else if (layout === 'circle') {
    const d = Math.max(10, Math.min(w - 12, h - ta - 12));
    photo = { x: (w - d) / 2, y: (h - ta - d) / 2, w: d, h: d, round: true };
    text = { x: 0, y: h - ta, w, h: ta };
  } else if (layout === 'inline') {
    const s = Math.max(10, h - 10);
    photo = { x: 5, y: 5, w: s, h: s, round: false };
    text = { x: s + 10, y: 0, w: Math.max(10, w - s - 14), h };
    align = 'left';
  } else {
    text = { x: 0, y: 0, w, h };
  }

  const lineT = el.titleSize * 1.25;
  const subH = el.subtitle ? el.subtitleSize * 1.35 : 0;
  const innerW = Math.max(10, text.w - PAD * 2);
  const maxLines = Math.max(1, Math.floor((text.h - 6 - subH) / lineT));
  const need = Math.max(1, Math.ceil(measureText(el.title || ' ', el.titleSize, true, el.font) / innerW - 0.02));
  const lines = Math.min(maxLines, need);
  const blockH = lines * lineT + subH;
  const y0 = text.y + (text.h - blockH) / 2;

  return {
    layout,
    photo,
    text,
    align,
    title: { x: text.x + PAD, y: y0, w: innerW, h: lines * lineT, lines },
    subtitle: el.subtitle ? { x: text.x + PAD, y: y0 + lines * lineT + el.subtitleSize * 0.1, w: innerW } : null,
    lineT,
  };
}
