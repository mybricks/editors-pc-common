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
  finnalExcludeOptions?: Options;
  onChange: ChangeEvent;
}

export type ChangeEvent = (
  arg: { key: string; value: any } | Array<{ key: string; value: any }>
) => void;


export interface PanelBaseProps {
  config: {
    [key: string]: any;
  };
  showTitle: boolean;
  collapse: boolean;
}