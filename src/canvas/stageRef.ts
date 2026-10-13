import type Konva from 'konva';

/** エディタの Konva Stage（画像出力などで参照） */
export const stageRef: { current: Konva.Stage | null } = { current: null };
