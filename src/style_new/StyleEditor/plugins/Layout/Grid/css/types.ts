// CSS 语义模型不依赖 Fixed/Fill/Hug 控件；raw 只用于保留未编辑的原文。
export type Dimension = { kind: 'dimension'; value: number; unit: string; raw?: string };
export type Breadth = Dimension
  | { kind: 'keyword'; value: 'auto' | 'min-content' | 'max-content'; raw?: string }
  | { kind: 'expression'; raw: string };
export type Track = Breadth
  | { kind: 'minmax'; min: Breadth; max: Breadth; raw?: string };

export type TrackListResult = {
  kind: 'empty' | 'tracks' | 'readonly';
  source: string;
  tracks: Track[];
};

export type TrackWriteResult =
  | { kind: 'change'; value: string }
  | { kind: 'unsupported' };

// 限制一次可视化展开的资源量；超过此范围保留整条声明，不截断源码。
export const MAX_EDITABLE_TRACKS = 1000;
