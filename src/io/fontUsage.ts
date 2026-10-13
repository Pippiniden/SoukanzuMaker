import type { Doc } from '../model/types';
import { loadFonts } from '../model/fonts';

/** ドキュメントで使っている「フォント・太さ・文字」を集めて読み込む */
export function loadDocFonts(doc: Doc) {
  const uses: { font?: string; bold: boolean; text: string }[] = [];
  for (const e of doc.elements) {
    switch (e.type) {
      case 'card':
        uses.push({ font: e.font, bold: true, text: e.title + e.badge + [...(e.title || '?')][0] });
        uses.push({ font: e.font, bold: false, text: e.subtitle });
        break;
      case 'frame':
        uses.push({ font: e.font, bold: true, text: e.title + e.subtitle });
        break;
      case 'edge':
        uses.push({ font: e.labelFont, bold: true, text: e.label });
        break;
      case 'text':
        uses.push({ font: e.font, bold: e.bold, text: e.text });
        break;
    }
  }
  return loadFonts(uses);
}
