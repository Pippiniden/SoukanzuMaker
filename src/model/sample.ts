import type { CardEl, Doc, EdgeEl, Element } from './types';
import { CARD_PRESETS, EDGE_PRESETS, FRAME_PRESETS, emptyDoc, makeCard, makeEdge, makeFrame, makeJunction, makeText } from './defaults';

/** 初回起動時に表示するサンプル（登場人物はすべて架空） */
export function sampleDoc(): Doc {
  const navy = CARD_PRESETS.find((p) => p.key === 'navy')!.style;
  const card = (x: number, y: number, title: string, subtitle: string, over: Partial<CardEl> = {}) =>
    makeCard(x, y, { width: 130, height: 160, title, subtitle, noImage: 'initial', ...over });

  const it = makeFrame(40, 120, 'rect', {
    ...FRAME_PRESETS.find((p) => p.key === 'beige')!.style,
    width: 200,
    height: 440,
    title: 'IT企業',
    subtitle: 'NEXT INC.',
    titlePos: 'onTopEdge',
  });
  const law = makeFrame(280, 100, 'rect', {
    ...FRAME_PRESETS.find((p) => p.key === 'gradient')!.style,
    width: 540,
    height: 460,
    title: '桐生法律事務所',
    subtitle: 'KIRYU LAW OFFICE',
    titlePos: 'insideTopLeft',
  });
  const band = makeFrame(300, 320, 'rect', {
    ...FRAME_PRESETS.find((p) => p.key === 'navy')!.style,
    width: 500,
    height: 220,
    title: '',
    titlePos: 'none',
  });
  const school = makeFrame(280, 100, 'polygon', {
    ...FRAME_PRESETS.find((p) => p.key === 'blue')!.style,
    width: 880,
    height: 1360,
    title: '青葉学園高等学校',
    subtitle: 'AOBA GAKUEN',
    titlePos: 'insideTopLeft',
  });
  school.points = [580, 0, 880, 0, 880, 1360, 0, 1360, 0, 500, 580, 500];

  const sakaguchi = card(75, 160, '坂口 智也', 'IT企業社長');
  const yonekura = card(75, 370, '米倉 翔', 'エンジニア');
  const kishida = card(640, 140, '岸田 沙耶', '弁護士');
  const kiryu = card(340, 350, '桐生 誠', '主人公・弁護士', { ...navy, width: 150, height: 170 });
  const miyashita = card(610, 350, '宮下 遥', '弁護士', { ...navy, width: 150, height: 170 });

  const takamura = card(875, 180, '高村 浩', '教頭');
  const nose = card(1015, 180, '能勢 久美子', '理事長');
  const okuda = card(875, 370, '奥田 義彦', '教師');
  const tamura = card(1015, 370, '田村 梨花', '教師');
  const tsuji = card(875, 560, '辻 圭介', '教師');
  const oyama = card(1015, 560, '大山 将', '体育教師');
  const iwai = card(875, 750, '岩井 匠', '3年');
  const kohashi = card(1015, 750, '小橋 陸', '3年');

  const segawa = card(320, 640, '瀬川 輝', '3年');
  const hayami = card(480, 640, '早見 菜緒', '3年');
  const kaede = card(320, 860, '岩田 楓', '3年');
  const amano = card(480, 860, '天野 晃一郎', '3年', { stroke: '#1f3a68', strokeWidth: 4 });
  const fujii = card(320, 1100, '藤井 遼', '3年');
  const kosugi = card(480, 1100, '小杉 麻里', '3年');
  const hara = card(640, 1100, '原 健太', '3年');

  const father = card(30, 640, '岩田 明人', '楓の父', { width: 110, height: 140, badge: '父', titleSize: 15 });
  const mother = card(150, 640, '岩田 裕子', '楓の母', { width: 110, height: 140, badge: '母', titleSize: 15 });
  const brother = card(70, 1100, '天野 裕太', '晃一郎の弟', { badge: '弟' });

  const title = makeText(40, 30, { text: '青葉学園 人物相関図', fontSize: 40, fill: '#1f3a68', width: 600 });
  const note = makeText(40, 1420, {
    text: '※サンプルです。カードに画像ファイルをドラッグ＆ドロップすると写真が入ります',
    fontSize: 16,
    bold: false,
    fill: '#6b7280',
    width: 820,
  });

  const branch = makeJunction(840, 310);
  const oneway = EDGE_PRESETS.find((p) => p.key === 'oneway')!.style;
  const e = (from: { id: string }, to: { id: string }, label: string, over: Partial<EdgeEl> = {}) =>
    makeEdge(from.id, to.id, { label, ...over });

  const edges: EdgeEl[] = [
    e(kiryu, kishida, '信頼', { fromSide: 'top', fromOffset: 0.27, toSide: 'left', labelPos: 0.3 }),
    // 分岐：教頭 → 分岐点 → 二人の弁護士
    e(takamura, branch, '再建依頼', { fromSide: 'left', toSide: 'right', head: 'none', labelVertical: true, labelPos: 0.5 }),
    e(branch, kiryu, '', { fromSide: 'left', toSide: 'top' }),
    e(branch, miyashita, '', { fromSide: 'left', toSide: 'top' }),
    e(kiryu, miyashita, '元教え子', { fromSide: 'right', toSide: 'left', labelPos: 0.5, labelBg: '#1f3a68', labelColor: '#7fe0d8' }),
    e(miyashita, kiryu, '感謝', { routing: 'curved', bend: 0.2, fromSide: 'bottom', toSide: 'bottom', labelBg: '#1f3a68', labelColor: '#7fe0d8' }),
    // 太さが変わる矢印
    e(kiryu, yonekura, '元教え子', { fromSide: 'left', toSide: 'right', bend: 0.3, taper: true, strokeWidth: 3, endWidth: 9 }),
    e(father, kaede, '親子', { head: 'both', fromSide: 'bottom', toSide: 'left' }),
    // 折れ点を手で置いた矢印
    e(amano, brother, '兄弟', { fromSide: 'bottom', toSide: 'top', labelPos: 0.45, waypoints: [{ x: 300, y: 1060 }] }),
    e(takamura, nose, '親子', { head: 'both', fromSide: 'bottom', toSide: 'bottom', bend: 0.5, routing: 'curved' }),
    e(hayami, segawa, '片想い', { ...oneway, routing: 'curved', bend: 0.8, fromSide: 'top', toSide: 'top' }),
  ];

  const elements: Element[] = [
    school,
    law,
    it,
    band,
    title,
    sakaguchi,
    yonekura,
    kishida,
    kiryu,
    miyashita,
    takamura,
    nose,
    okuda,
    tamura,
    tsuji,
    oyama,
    iwai,
    kohashi,
    segawa,
    hayami,
    kaede,
    amano,
    fujii,
    kosugi,
    hara,
    father,
    mother,
    brother,
    note,
    ...edges,
    branch,
  ];

  return { ...emptyDoc(), title: '青葉学園 人物相関図', background: '#fff7fa', background2: '#ffffff', elements };
}
