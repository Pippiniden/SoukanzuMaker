// 使えるフォントの一覧
// アプリに同梱しているので、どの端末でも同じ見た目で画像に出力できる。
// （文字ごとに分割されたファイルを、使う文字の分だけ読み込む）

export interface FontDef {
  key: string;
  label: string;
  /** CSS の font-family 名 */
  family: string;
  /** 太字に使う太さ（太字がないフォントは null：ブラウザが太く描く） */
  bold: number | null;
  /** 端末に入っているフォントを使う（同梱しない） */
  system?: boolean;
}

export const FONTS: FontDef[] = [
  { key: 'gothic', label: 'ゴシック（Noto Sans JP）', family: 'Noto Sans JP', bold: 700 },
  { key: 'mincho', label: '明朝（Noto Serif JP）', family: 'Noto Serif JP', bold: 700 },
  { key: 'rounded', label: '丸ゴシック（M PLUS Rounded 1c）', family: 'M PLUS Rounded 1c', bold: 700 },
  { key: 'zenmaru', label: 'やわらか丸ゴ（Zen Maru Gothic）', family: 'Zen Maru Gothic', bold: 700 },
  { key: 'klee', label: '手書き風（Klee One）', family: 'Klee One', bold: 600 },
  { key: 'yusei', label: 'マジック風（Yusei Magic）', family: 'Yusei Magic', bold: null },
  { key: 'dela', label: '極太（Dela Gothic One）', family: 'Dela Gothic One', bold: null },
  { key: 'pop', label: 'ポップ（Mochiy Pop One）', family: 'Mochiy Pop One', bold: null },
  { key: 'sys-gothic', label: '端末のゴシック', family: 'Hiragino Sans', bold: 700, system: true },
  { key: 'sys-mincho', label: '端末の明朝', family: 'Hiragino Mincho ProN', bold: 700, system: true },
];

export const DEFAULT_FONT = 'gothic';

const FALLBACK = "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', Meiryo, sans-serif";
const SYSTEM_STACK: Record<string, string> = {
  'sys-gothic': "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', YuGothic, Meiryo, sans-serif",
  'sys-mincho': "'Hiragino Mincho ProN', 'Yu Mincho', YuMincho, 'MS PMincho', serif",
};

export function fontDef(key: string | undefined): FontDef {
  return FONTS.find((f) => f.key === key) ?? FONTS[0];
}

/** キャンバスで使う font-family（見つからないときの代替つき） */
export function fontStack(key: string | undefined): string {
  if (key && SYSTEM_STACK[key]) return SYSTEM_STACK[key];
  const f = fontDef(key);
  return `'${f.family}', ${FALLBACK}`;
}

/** 太字指定（Konva の fontStyle） */
export function boldStyle(key: string | undefined, bold: boolean): string {
  if (!bold) return 'normal';
  const f = fontDef(key);
  return f.bold ? String(f.bold) : 'bold';
}

/**
 * 使っている文字だけフォントファイルを読み込む。
 * 読み込み完了で 'loadingdone' が発生し、キャンバスが描き直される。
 */
export function loadFonts(uses: { font?: string; bold: boolean; text: string }[]): Promise<unknown> {
  if (!document.fonts) return Promise.resolve();
  const byKey = new Map<string, Set<string>>();
  for (const u of uses) {
    if (!u.text) continue;
    const f = fontDef(u.font);
    if (f.system) continue;
    const weight = u.bold && f.bold ? f.bold : 400;
    const k = `${weight}|${f.family}`;
    if (!byKey.has(k)) byKey.set(k, new Set());
    const set = byKey.get(k)!;
    for (const ch of u.text) set.add(ch);
  }
  const jobs: Promise<unknown>[] = [];
  for (const [k, chars] of byKey) {
    const [weight, family] = k.split('|');
    jobs.push(document.fonts.load(`${weight} 16px '${family}'`, [...chars].join('')).catch(() => undefined));
  }
  return Promise.all(jobs);
}
