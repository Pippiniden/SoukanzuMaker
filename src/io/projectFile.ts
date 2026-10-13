import JSZip from 'jszip';
import type { Assets, Doc } from '../model/types';
import { downloadBlob } from './image';
import { usedAssets } from './persist';

export const PROJECT_EXT = '.soukanzu';

const extOf = (mime: string) =>
  ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' })[mime] ?? 'bin';
const mimeOf = (ext: string) =>
  ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' })[ext] ??
  'application/octet-stream';

/** 画像を内包した zip 形式のプロジェクトファイルを保存 */
export async function saveProjectFile(doc: Doc, assets: Assets) {
  const zip = new JSZip();
  const files: Record<string, string> = {};
  for (const [id, dataUrl] of Object.entries(usedAssets(doc, assets))) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
    if (!m) continue;
    const name = `assets/${id}.${extOf(m[1])}`;
    zip.file(name, m[2], { base64: true });
    files[id] = name;
  }
  zip.file('project.json', JSON.stringify({ app: 'soukanzu-maker', doc, assets: files }, null, 2));
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
  downloadBlob(blob, `${safeName(doc.title)}${PROJECT_EXT}`);
}

export async function loadProjectFile(file: File): Promise<{ doc: Doc; assets: Assets }> {
  if (file.name.endsWith('.json')) {
    const data = JSON.parse(await file.text());
    return { doc: data.doc, assets: data.assets ?? {} };
  }
  const zip = await JSZip.loadAsync(file);
  const json = zip.file('project.json');
  if (!json) throw new Error('project.json が見つかりません');
  const data = JSON.parse(await json.async('string')) as { doc: Doc; assets: Record<string, string> };
  const assets: Assets = {};
  for (const [id, path] of Object.entries(data.assets ?? {})) {
    const f = zip.file(path);
    if (!f) continue;
    const b64 = await f.async('base64');
    assets[id] = `data:${mimeOf(path.split('.').pop() ?? '')};base64,${b64}`;
  }
  if (!data.doc || !Array.isArray(data.doc.elements)) throw new Error('相関図データの形式が正しくありません');
  return { doc: data.doc, assets };
}

export function safeName(s: string) {
  return (s || 'soukanzu').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
}
