import { stageRef } from '../canvas/stageRef';
import { useStore } from '../store/useStore';
import { downloadBlob } from './image';
import { safeName } from './projectFile';
import { loadDocFonts } from './fontUsage';

export interface ExportOptions {
  pixelRatio: number;
  transparent: boolean;
  format: 'png' | 'jpeg';
}

/** ページ範囲を画像として書き出す（グリッド・選択枠・非表示の要素は含めない） */
export async function exportImage(opts: ExportOptions) {
  const stage = stageRef.current;
  if (!stage) return;
  const { doc } = useStore.getState();
  // フォントの読み込みを待ってから描く
  await loadDocFonts(doc);
  await document.fonts?.ready;
  stage.find('Text').forEach((t) => (t as unknown as { _setTextData?: () => void })._setTextData?.());

  const prev = { scale: stage.scaleX(), x: stage.x(), y: stage.y() };
  const uiNodes = stage.find('.ui');
  const bg = stage.findOne('#page-bg');
  const uiVisible = uiNodes.map((n) => n.visible());
  uiNodes.forEach((n) => n.visible(false));
  const transparent = opts.transparent && opts.format === 'png';
  if (transparent) bg?.visible(false);

  stage.scale({ x: 1, y: 1 });
  stage.position({ x: 0, y: 0 });
  try {
    const blob = (await stage.toBlob({
      x: 0,
      y: 0,
      width: doc.width,
      height: doc.height,
      pixelRatio: opts.pixelRatio,
      mimeType: opts.format === 'png' ? 'image/png' : 'image/jpeg',
      quality: 0.95,
    })) as Blob;
    downloadBlob(blob, `${safeName(doc.title)}.${opts.format === 'png' ? 'png' : 'jpg'}`);
  } finally {
    stage.scale({ x: prev.scale, y: prev.scale });
    stage.position({ x: prev.x, y: prev.y });
    uiNodes.forEach((n, i) => n.visible(uiVisible[i]));
    bg?.visible(true);
    stage.batchDraw();
  }
}
