import { get, set } from 'idb-keyval';
import type { Assets, Doc } from '../model/types';
import { useStore } from '../store/useStore';

const KEY = 'soukanzu:current';

export interface Saved {
  doc: Doc;
  assets: Assets;
  savedAt: number;
}

/** ドキュメントから参照されている画像だけを残す */
export function usedAssets(doc: Doc, assets: Assets): Assets {
  const out: Assets = {};
  for (const e of doc.elements) {
    const id = e.type === 'card' || e.type === 'image' ? e.imageId : undefined;
    if (id && assets[id]) out[id] = assets[id];
  }
  return out;
}

export async function loadSaved(): Promise<Saved | undefined> {
  try {
    return await get<Saved>(KEY);
  } catch {
    return undefined;
  }
}

let timer: number | undefined;

/** 編集のたびに IndexedDB へ自動保存（0.8秒まとめて） */
export function startAutosave() {
  return useStore.subscribe((s, prev) => {
    const gestureEnded = !!prev.gestureBase && !s.gestureBase;
    if (s.doc === prev.doc && s.assets === prev.assets && !gestureEnded) return;
    if (s.gestureBase) return; // ドラッグ中は保存しない
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      const { doc, assets } = useStore.getState();
      try {
        await set(KEY, { doc, assets: usedAssets(doc, assets), savedAt: Date.now() } satisfies Saved);
        useStore.setState({ lastSavedAt: Date.now() });
      } catch (err) {
        console.error('自動保存に失敗しました', err);
      }
    }, 800);
  });
}
