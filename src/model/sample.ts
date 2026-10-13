import type { CardEl, Doc, EdgeEl, Element, FrameEl } from './types';
import { CARD_PRESETS, EDGE_PRESETS, FRAME_PRESETS, emptyDoc, makeCard, makeEdge, makeFrame, makeJunction, makeText } from './defaults';

/** 初回起動時に表示するサンプル（学校・人物はすべて架空） */
export function sampleDoc(): Doc {
  const navy = CARD_PRESETS.find((p) => p.key === 'navy')!.style;
  const preset = (k: string) => FRAME_PRESETS.find((p) => p.key === k)!.style;
  const card = (x: number, y: number, title: string, subtitle: string, over: Partial<CardEl> = {}) =>
    makeCard(x, y, { width: 130, height: 170, title, subtitle, noImage: 'initial', ...over });
  const frame = (x: number, y: number, w: number, h: number, style: string, over: Partial<FrameEl>) =>
    makeFrame(x, y, over.shape ?? 'rect', { ...preset(style), width: w, height: h, font: 'rounded', titleSize: 22, subtitleSize: 10, ...over });

  // ---------- 枠 ----------
  const council = frame(40, 120, 520, 300, 'pink', {
    title: '生徒会',
    subtitle: 'STUDENT COUNCIL',
    titlePos: 'onTopEdge',
    titleAlign: 'center',
    cornerRadius: 16,
  });
  const faculty = frame(600, 120, 560, 300, 'beige', {
    title: '職員室',
    subtitle: 'FACULTY ROOM',
    titlePos: 'onTopEdge',
    titleAlign: 'right',
  });
  const classA = frame(40, 480, 800, 620, 'blue', {
    title: '2年A組',
    subtitle: 'CLASS 2-A',
    titlePos: 'onTopEdge',
    titleAlign: 'right',
  });
  const band = frame(80, 560, 720, 240, 'navy', { title: '', titlePos: 'none' });
  const brass = frame(880, 480, 280, 560, 'gradient', {
    title: '吹奏楽部',
    subtitle: 'BRASS BAND',
    titlePos: 'insideTopLeft',
    titleAlign: 'center',
    fill: '#fde6c8',
    fill2: '#fffaf2',
    stroke: '#e3b071',
    titleColor: '#8a5420',
  });
  const home = frame(40, 1140, 300, 260, 'outline', {
    title: '天宮家',
    subtitle: 'AMAMIYA FAMILY',
    titlePos: 'insideBottom',
    titleAlign: 'right',
    dash: 'dashed',
  });

  // ---------- 人物 ----------
  const ichijo = card(80, 190, '一条 玲奈', '3年・生徒会長');
  const sakuraba = card(230, 190, '桜庭 蒼', '3年・副会長');
  const nanase = card(380, 190, '七瀬 ひより', '2年・書記');

  const saotome = card(660, 190, '早乙女 京子', '2年A組 担任');
  const kumagai = card(810, 190, '熊谷 剛', '体育教師');
  const saionji = card(960, 190, '西園寺 宗一郎', '校長', { textArea: 52 });

  const plate = { ...navy, width: 150, height: 190, textBg: '#16294a', titleSize: 18 };
  const hinata = card(140, 585, '天宮 陽向', '主人公', plate);
  const minato = card(540, 585, '結城 湊', '幼なじみ', plate);

  const shiraishi = card(480, 880, '白石 莉子', '転校生');
  const takanashi = card(300, 880, '小鳥遊 まひる', '親友', { textArea: 52 });
  const kurokawa = card(660, 880, '黒川 蓮', 'ライバル');

  const amamiya = card(945, 560, '雨宮 詩織', '3年・部長', { layout: 'circle' });
  const haruno = card(945, 790, '春野 つばさ', '1年', { layout: 'circle' });

  const father = card(60, 1170, '天宮 誠', '父', { width: 110, height: 140, badge: '父', titleSize: 15 });
  const sister = card(200, 1170, '天宮 そら', '妹・中学1年', { width: 110, height: 140, badge: '妹', badgeFill: '#e0629a', titleSize: 15 });

  // ---------- 文字 ----------
  const title = makeText(40, 26, {
    text: '私立星蘭学園 人物相関図',
    font: 'mincho',
    fontSize: 44,
    fill: '#1f3a68',
    width: 1120,
    align: 'center',
  });
  const caption = makeText(380, 1170, {
    text: '※サンプルです。登場人物はすべて架空です。\nカードに画像をドラッグ＆ドロップすると写真が入り、\n写真をダブルクリックすると位置を合わせられます。',
    font: 'klee',
    fontSize: 16,
    bold: false,
    fill: '#5b6475',
    width: 760,
  });

  // ---------- 矢印 ----------
  const e = (from: { id: string }, to: { id: string }, label: string, over: Partial<EdgeEl> = {}) =>
    makeEdge(from.id, to.id, { label, labelFont: 'rounded', ...over });
  const style = (k: string) => EDGE_PRESETS.find((p) => p.key === k)!.style;

  // 担任 → 分岐点 → 陽向・湊
  const branch = makeJunction(725, 440);
  const edges: EdgeEl[] = [
    e(saotome, branch, '担任', { fromSide: 'bottom', toSide: 'top', head: 'none', labelPos: 0.45 }),
    e(branch, hinata, '', { fromSide: 'left', toSide: 'top', toOffset: 0.6 }),
    e(branch, minato, '', { fromSide: 'left', toSide: 'top', toOffset: 0.6 }),

    e(hinata, minato, '幼なじみ', { head: 'both', fromSide: 'right', toSide: 'left', labelBg: '#1f3a68', labelColor: '#7fe0d8' }),
    e(ichijo, hinata, 'スカウト', { ...style('ally'), fromSide: 'bottom', toSide: 'top', toOffset: 0.25, bend: 0.62, labelPos: 0.2 }),
    e(sakuraba, ichijo, '憧れ', { ...style('love'), routing: 'curved', bend: 0.82, fromSide: 'top', toSide: 'top' }),
    e(takanashi, hinata, '親友', { head: 'both', fromSide: 'top', toSide: 'bottom', toOffset: 0.85, bend: 0.7 }),
    e(shiraishi, minato, '片想い', { ...style('oneway'), fromSide: 'top', toSide: 'bottom', toOffset: 0.3, bend: 0.3 }),
    e(kurokawa, minato, 'ライバル', { ...style('hostile'), fromSide: 'top', toSide: 'bottom', toOffset: 0.8 }),
    // 太さが変わる矢印
    e(amamiya, minato, '勧誘', { fromSide: 'left', toSide: 'right', bend: 0.48, taper: true, strokeWidth: 2, endWidth: 9, stroke: '#d4892e', labelColor: '#b8701c' }),
    e(haruno, amamiya, '尊敬', { ...style('love'), routing: 'curved', bend: 0.2, fromSide: 'left', toSide: 'left' }),
    e(kumagai, kurokawa, '期待', { ...style('past'), fromSide: 'bottom', fromOffset: 0.385, toSide: 'right', labelPos: 0.15 }),
    e(father, hinata, '親子', { head: 'both', fromSide: 'top', toSide: 'left', toOffset: 0.7, labelPos: 0.3 }),
    e(sister, hinata, 'きょうだい', { head: 'both', fromSide: 'top', toSide: 'bottom', toOffset: 0.25, labelPos: 0.2 }),
  ];

  const elements: Element[] = [
    council,
    faculty,
    classA,
    band,
    brass,
    home,
    title,
    caption,
    ichijo,
    sakuraba,
    nanase,
    saotome,
    kumagai,
    saionji,
    hinata,
    minato,
    shiraishi,
    takanashi,
    kurokawa,
    amamiya,
    haruno,
    father,
    sister,
    ...edges,
    branch,
  ];

  return {
    ...emptyDoc(),
    title: '私立星蘭学園 人物相関図',
    background: '#fdf2f6',
    background2: '#eef5fd',
    elements,
  };
}
