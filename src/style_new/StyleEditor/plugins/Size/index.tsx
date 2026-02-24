import React, {useState, useEffect, useCallback, CSSProperties} from "react";

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
import { useDragNumber } from "../../hooks";

import type {ChangeEvent, PanelBaseProps} from "../../type";
import css from './index.less'

const UNIT_OPTIONS = [
  {label: "%", value: "%"},
  {label: "px", value: "px"},
  {label: "继承", value: "inherit"},
  {label: "默认", value: "auto"},
];
const UNIT_DISABLED_LIST = ["auto", "inherit"];

/** 从值中提取单位，用作 InputNumber 的 key，单位变化时强制重新挂载 */
function getUnitKey(val: any): string {
  if (!val) return 'empty';
  const str = String(val);
  if (str === 'auto' || str === 'inherit') return str;
  const num = parseFloat(str);
  if (isNaN(num)) return str;
  return str.replace(String(num), '') || 'none';
}

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

  // 拖拽结束时暂存值，用于在父组件回传新值前立即让 InputNumber 以正确的值/单位重新挂载
  const [widthPending, setWidthPending] = useState<string | undefined>();
  const [heightPending, setHeightPending] = useState<string | undefined>();

  // 父组件回传新值后清除暂存
  useEffect(() => {
    if (widthPending !== undefined) setWidthPending(undefined);
  }, [value.width]);
  useEffect(() => {
    if (heightPending !== undefined) setHeightPending(undefined);
  }, [value.height]);

  const widthEffective = widthPending ?? value.width;
  const heightEffective = heightPending ?? value.height;

  const getDragPropsWidth = useDragNumber({
    onDragStart: (currentValue, inputEl) => {
      if (!currentValue || currentValue === 'auto' || currentValue === 'inherit') {
        if (inputEl) {
          inputEl.disabled = false;
          inputEl.value = '0';
        }
        return 0;
      }
    },
    onDragEnd: (finalValue: number) => {
      const newVal = `${finalValue}px`;
      onChange({key: "width", value: newVal});
      setWidthPending(newVal);
    },
    continuous: true
  });

  const getDragPropsHeight = useDragNumber({
    onDragStart: (currentValue, inputEl) => {
      if (!currentValue || currentValue === 'auto' || currentValue === 'inherit') {
        if (inputEl) {
          inputEl.disabled = false;
          inputEl.value = '0';
        }
        return 0;
      }
    },
    onDragEnd: (finalValue: number) => {
      const newVal = `${finalValue}px`;
      onChange({key: "height", value: newVal});
      setHeightPending(newVal);
    },
    continuous: true
  });

  return (
    <Panel title="尺寸" showTitle={showTitle} collapse={collapse}>
      {!(cfg.disableWidth && cfg.disableHeight) && (
        <Panel.Content>
          {cfg.disableWidth ? null : (
            <Panel.Item style={{ display: "flex", alignItems: "center", flex: 1, padding: "0 8px" }}>
              <div
                {...getDragPropsWidth(widthEffective, '拖拽调整宽度')}
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  cursor: "ew-resize"
                }}
              >
                <span className={css.tip}>宽度</span>
              </div>
              <InputNumber
                key={getUnitKey(widthEffective)}
                style={{ flex: 1, marginLeft: 4 }}
                defaultValue={widthEffective}
                unitOptions={UNIT_OPTIONS}
                unitDisabledList={UNIT_DISABLED_LIST}
                onChange={(value) => onChange({key: "width", value})}
                showIcon={true}
              />
            </Panel.Item>
          )}
          {cfg.disableHeight ? null : (
            <Panel.Item style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div
                {...getDragPropsHeight(heightEffective, '拖拽调整高度')}
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  cursor: "ew-resize"
                }}
              >
                <span className={css.tip}>高度</span>
              </div>
              <InputNumber
                key={getUnitKey(heightEffective)}
                style={{ flex: 1, marginLeft: 4 }}
                defaultValue={heightEffective}
                unitOptions={UNIT_OPTIONS}
                unitDisabledList={UNIT_DISABLED_LIST}
                onChange={(value) => onChange({key: "height", value})}
                showIcon={true}
              />
            </Panel.Item>
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
