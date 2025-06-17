import React, {useState, CSSProperties} from "react";

import {
  Panel,
  InputNumber,
  WidthOutlined,
  HeightOutlined,
  MaxWidthOutlined,
  MaxHeightOutlined,
  MinWidthOutlined,
  MinHeightOutlined,
} from "../../components";

import type {ChangeEvent, PanelBaseProps} from "../../type";
import css from './index.less'

const UNIT_OPTIONS = [
  {label: "%", value: "%"},
  {label: "px", value: "px"},
  {label: "继承", value: "inherit"},
  {label: "默认", value: "auto"},
];
const UNIT_DISABLED_LIST = ["auto", "inherit"];

interface SizeProps extends PanelBaseProps {
  value: CSSProperties;
  onChange: ChangeEvent;
}

const DEFAULT_CONFIG = {
  disableWidth: false,
  disableHeight: false,
  disableMaxWidth: true,
  disableMaxHeight: true,
  disableMinWidth: true,
  disableMinHeight: true,
};

export function Size({value, onChange, config, showTitle, collapse}: SizeProps) {
  const [cfg] = useState({...DEFAULT_CONFIG, ...config});
  // console.warn("Size", value, cfg.disableWidth, cfg.disableHeight);
  return (
    <Panel title="尺寸" showTitle={showTitle} collapse={collapse}>
      {!(cfg.disableWidth && cfg.disableHeight) && (
        <Panel.Content>
          {cfg.disableWidth ? null : (
            <InputNumber
              prefix={<span className={css.tip}>宽度</span>}
              defaultValue={value.width}
              unitOptions={UNIT_OPTIONS}
              unitDisabledList={UNIT_DISABLED_LIST}
              onChange={(value) => onChange({key: "width", value})}
              showIcon={true}
            />
          )}
          {cfg.disableHeight ? null : (
            <InputNumber
              prefix={<span className={css.tip}>高度</span>}
              defaultValue={value.height}
              unitOptions={UNIT_OPTIONS}
              unitDisabledList={UNIT_DISABLED_LIST}
              onChange={(value) => onChange({key: "height", value})}
              showIcon={true}
            />
          )}
        </Panel.Content>
      )}
      {!(cfg.disableMaxWidth && cfg.disableMaxHeight) && (
        <Panel.Content>
          {cfg.disableMaxWidth ? null : (
            <InputNumber
              prefix={<span className={css.tip}>最大宽</span>}
              defaultValue={value.maxWidth}
              unitOptions={UNIT_OPTIONS}
              unitDisabledList={UNIT_DISABLED_LIST}
              onChange={(value) => onChange({key: "max-width", value})}
              showIcon={true}
            />
          )}
          {cfg.disableMaxHeight ? null : (
            <InputNumber
              prefix={<span className={css.tip}>最大高</span>}
              defaultValue={value.maxHeight}
              unitOptions={UNIT_OPTIONS}
              unitDisabledList={UNIT_DISABLED_LIST}
              onChange={(value) => onChange({key: "max-height", value})}
              showIcon={true}
            />
          )}
        </Panel.Content>
      )}
      {!(cfg.disableMinWidth && cfg.disableMinHeight) && (
        <Panel.Content>
          {cfg.disableMinWidth ? null : (
            <InputNumber
              prefix={<span className={css.tip}>最小宽</span>}
              defaultValue={value.minWidth}
              unitOptions={UNIT_OPTIONS}
              unitDisabledList={UNIT_DISABLED_LIST}
              onChange={(value) => onChange({key: "min-width", value})}
              showIcon={true}
            />
          )}
          {cfg.disableMinHeight ? null : (
            <InputNumber
              prefix={<span className={css.tip}>最小高</span>}
              defaultValue={value.minHeight}
              unitOptions={UNIT_OPTIONS}
              unitDisabledList={UNIT_DISABLED_LIST}
              onChange={(value) => onChange({key: "min-height", value})}
              showIcon={true}
            />
          )}
        </Panel.Content>
      )}
    </Panel>
  );
}
