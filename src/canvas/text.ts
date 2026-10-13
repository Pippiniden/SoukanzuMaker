import { FONT_FAMILY } from '../model/defaults';

let ctx: CanvasRenderingContext2D | null = null;

/** 文字列の描画幅を測る */
export function measureText(text: string, size: number, bold = false): number {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return text.length * size;
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT_FAMILY}`;
  return Math.max(...text.split('\n').map((l) => ctx!.measureText(l).width), 0);
}

/** 縦書き用：1文字ずつ改行した文字列 */
export const toVertical = (s: string) => [...s].join('\n');

export const dashArray = (dash: 'solid' | 'dashed' | 'dotted', w: number): number[] | undefined =>
  dash === 'dashed' ? [w * 3, w * 2] : dash === 'dotted' ? [0.001, w * 2] : undefined;
