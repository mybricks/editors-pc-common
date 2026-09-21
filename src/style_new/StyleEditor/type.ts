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
  intent?: 'clear-effective-style';
};

export type StyleChangeResult = {
  applied: boolean;
  clearApplied?: boolean;
  clearUnsupported?: boolean;
};

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
