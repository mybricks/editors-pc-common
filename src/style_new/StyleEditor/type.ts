import { CSSProperties } from "react";

import { DEFAULT_OPTIONS } from "./constans";

export type Style = {
  [key: string]: any;
};

export type Type = (typeof DEFAULT_OPTIONS)[number];

export type Option =
  | Type
  | {
      type: Type;
      config: {
        [key: string]: any;
      };
    };

export type Options = Array<Option>;

export interface StyleEditorProps {
  defaultValue: CSSProperties;
  options: Options;
  collapsedOptions: Options;
  readonlyExpandedOptions?: string[];
  finnalExcludeOptions?: Options;
  onChange: ChangeEvent;
}

export type StyleChangeItem = {
  key: string;
  value: any;
  intent?: 'clear-effective-style' | 'set-effective-style';
  /** 统一间距落到当前 Tab 的最高权重默认目标；省略时先跟随属性生效来源。 */
  target?: 'current-rule';
  /** 单独配置固定按边写入，不因四边相同而跨边合并。 */
  borderMode?: 'all' | 'split';
};

export type StyleChangeResult = {
  applied: boolean;
  clearApplied?: boolean;
  clearUnsupported?: boolean;
};

/** 属性编辑器只表达修改意图；selector 以及 clear 的 null/unset 由公共层解析。 */
export type StyleMutation =
  | {
      type: 'set';
      key: string;
      value: any;
      target?: 'current-rule';
      borderMode?: 'all' | 'split';
    }
  | {
      type: 'clear';
      key: string;
      borderMode?: 'all' | 'split';
    };

export type ApplyStyleMutations = (
  mutations: StyleMutation[]
) => StyleChangeResult | void;

export type ChangeEvent = (
  arg: StyleChangeItem | StyleChangeItem[]
) => StyleChangeResult | void;


export interface PanelBaseProps {
  config: {
    [key: string]: any;
  };
  showTitle: boolean;
  collapse: boolean | 'inherited';
}
