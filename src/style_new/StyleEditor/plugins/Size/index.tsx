import React, {useState, useEffect, useCallback, useMemo, useRef, CSSProperties} from "react";

import {
  Panel,
  InputNumber,
  WidthOutlined,
  HeightOutlined,
  MaxWidthOutlined,
  MaxHeightOutlined,
  MinWidthOutlined,
  MinHeightOutlined,
  MinusOutlined,
} from "../../components";
import { useDragNumber } from "../../hooks";

import type {ChangeEvent, PanelBaseProps} from "../../type";
import css from './index.less'

const BASE_UNIT_OPTIONS = [
  {label: "默认", value: "default"},
  {label: "px", value: "px"},
  {label: "%", value: "%"},
  {label: "适应", value: "max-content"},
];
const MAX_MIN_UNIT_OPTIONS = [
  { label: 'px', value: 'px' },
  { label: '%', value: '%' },
];
const UNIT_DISABLED_LIST = ["max-content", "default"];
const UNIT_DISPLAY_LABEL_MAP: Record<string, string> = {
  "max-content": "适应",
  "default": "默认",
};

/** 归一化尺寸值：auto / inherit / fit-content / 未配置 → undefined，让输入框显示为空（默认状态） */
function normalizeSizeValue(val: any): string | undefined {
  if (!val || val === 'auto' || val === 'inherit' || val === 'fit-content') return undefined;
  return val as string;
}

/** 从值中提取单位，用作 InputNumber 的 key，单位变化时强制重新挂载 */
function getUnitKey(val: any): string {
  if (!val) return 'empty';
  const str = String(val);
  if (str === 'max-content') return str;
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

  const hasInitWidthHeight = !!normalizeSizeValue(value.width) || !!normalizeSizeValue(value.height);
  const hasInitMax = !!normalizeSizeValue(value.maxWidth) || !!normalizeSizeValue(value.maxHeight);
  const hasInitMin = !!normalizeSizeValue(value.minWidth) || !!normalizeSizeValue(value.minHeight);

  const [showWidthHeight, setShowWidthHeight] = useState(() => hasInitWidthHeight);
  const [showMaxWidth, setShowMaxWidth] = useState(() => hasInitMax);
  const [showMinWidth, setShowMinWidth] = useState(() => hasInitMin);
  const [showMaxHeight, setShowMaxHeight] = useState(() => hasInitMax);
  const [showMinHeight, setShowMinHeight] = useState(() => hasInitMin);

  const refresh = useCallback(() => {
    onChange([
      { key: 'width', value: null },
      { key: 'height', value: null },
      { key: 'maxWidth', value: null },
      { key: 'maxHeight', value: null },
      { key: 'minWidth', value: null },
      { key: 'minHeight', value: null },
    ]);
    setShowWidthHeight(false);
    setShowMaxWidth(false);
    setShowMinWidth(false);
    setShowMaxHeight(false);
    setShowMinHeight(false);
    setWidthPending(undefined);
    setHeightPending(undefined);
    setMaxWidthPending(undefined);
    setMaxHeightPending(undefined);
    setMinWidthPending(undefined);
    setMinHeightPending(undefined);
  }, [onChange]);

  const handleDeleteWidthHeight = useCallback(() => {
    onChange([
      { key: 'width', value: null },
      { key: 'height', value: null },
    ]);
    setShowWidthHeight(false);
    setWidthPending(undefined);
    setHeightPending(undefined);
  }, [onChange]);

  const isDraggingWidth = useRef(false);
  const isDraggingHeight = useRef(false);

  const [widthPending, setWidthPending] = useState<string | undefined>();
  const [heightPending, setHeightPending] = useState<string | undefined>();
  const [maxWidthPending, setMaxWidthPending] = useState<string | undefined>();
  const [minWidthPending, setMinWidthPending] = useState<string | undefined>();
  const [maxHeightPending, setMaxHeightPending] = useState<string | undefined>();
  const [minHeightPending, setMinHeightPending] = useState<string | undefined>();

  useEffect(() => {
    if (widthPending !== undefined) setWidthPending(undefined);
  }, [value.width]);
  useEffect(() => {
    if (heightPending !== undefined) setHeightPending(undefined);
  }, [value.height]);
  useEffect(() => {
    if (maxWidthPending !== undefined) setMaxWidthPending(undefined);
  }, [value.maxWidth]);
  useEffect(() => {
    if (minWidthPending !== undefined) setMinWidthPending(undefined);
  }, [value.minWidth]);
  useEffect(() => {
    if (maxHeightPending !== undefined) setMaxHeightPending(undefined);
  }, [value.maxHeight]);
  useEffect(() => {
    if (minHeightPending !== undefined) setMinHeightPending(undefined);
  }, [value.minHeight]);

  const widthEffective = normalizeSizeValue(widthPending ?? value.width);
  const heightEffective = normalizeSizeValue(heightPending ?? value.height);
  const maxWidthEffective = normalizeSizeValue(maxWidthPending ?? value.maxWidth);
  const minWidthEffective = normalizeSizeValue(minWidthPending ?? value.minWidth);
  const maxHeightEffective = normalizeSizeValue(maxHeightPending ?? value.maxHeight);
  const minHeightEffective = normalizeSizeValue(minHeightPending ?? value.minHeight);

  const getDragPropsWidth = useDragNumber({
    onDragStart: (currentValue, inputEl) => {
      isDraggingWidth.current = true;
      const parsed = parseFloat(currentValue);
      if (!currentValue || currentValue === 'max-content' || isNaN(parsed)) {
        if (inputEl) {
          inputEl.disabled = false;
          inputEl.value = '0';
        }
        return 0;
      }
      return parsed;
    },
    onDragEnd: (finalValue: number) => {
      isDraggingWidth.current = false;
      const newVal = `${finalValue}px`;
      onChange({key: 'width', value: newVal});
      setWidthPending(newVal);
    },
    continuous: true
  });

  const getDragPropsHeight = useDragNumber({
    onDragStart: (currentValue, inputEl) => {
      isDraggingHeight.current = true;
      const parsed = parseFloat(currentValue);
      if (!currentValue || currentValue === 'max-content' || isNaN(parsed)) {
        if (inputEl) {
          inputEl.disabled = false;
          inputEl.value = '0';
        }
        return 0;
      }
      return parsed;
    },
    onDragEnd: (finalValue: number) => {
      isDraggingHeight.current = false;
      const newVal = `${finalValue}px`;
      onChange({key: 'height', value: newVal});
      setHeightPending(newVal);
    },
    continuous: true
  });

  const getDragPropsMaxWidth = useDragNumber({
    onDragStart: (currentValue, inputEl) => {
      if (!currentValue) {
        if (inputEl) { inputEl.disabled = false; inputEl.value = '0'; }
        return 0;
      }
    },
    onDragEnd: (finalValue: number) => {
      const newVal = `${finalValue}px`;
      onChange({key: 'maxWidth', value: newVal});
      setMaxWidthPending(newVal);
    },
    continuous: true
  });

  const getDragPropsMinWidth = useDragNumber({
    onDragStart: (currentValue, inputEl) => {
      if (!currentValue) {
        if (inputEl) { inputEl.disabled = false; inputEl.value = '0'; }
        return 0;
      }
    },
    onDragEnd: (finalValue: number) => {
      const newVal = `${finalValue}px`;
      onChange({key: 'minWidth', value: newVal});
      setMinWidthPending(newVal);
    },
    continuous: true
  });

  const getDragPropsMaxHeight = useDragNumber({
    onDragStart: (currentValue, inputEl) => {
      if (!currentValue) {
        if (inputEl) { inputEl.disabled = false; inputEl.value = '0'; }
        return 0;
      }
    },
    onDragEnd: (finalValue: number) => {
      const newVal = `${finalValue}px`;
      onChange({key: 'maxHeight', value: newVal});
      setMaxHeightPending(newVal);
    },
    continuous: true
  });

  const getDragPropsMinHeight = useDragNumber({
    onDragStart: (currentValue, inputEl) => {
      if (!currentValue) {
        if (inputEl) { inputEl.disabled = false; inputEl.value = '0'; }
        return 0;
      }
    },
    onDragEnd: (finalValue: number) => {
      const newVal = `${finalValue}px`;
      onChange({key: 'minHeight', value: newVal});
      setMinHeightPending(newVal);
    },
    continuous: true
  });


  const handleWidthChange = useCallback((val: string) => {
    const realVal = val === 'default' ? null : val;
    onChange({key: 'width', value: realVal});
  }, [onChange]);

  const handleHeightChange = useCallback((val: string) => {
    const realVal = val === 'default' ? null : val;
    onChange({key: 'height', value: realVal});
  }, [onChange]);

  const widthUnitOptions = BASE_UNIT_OPTIONS;
  const heightUnitOptions = BASE_UNIT_OPTIONS;

  const showMaxRow = showMaxWidth || showMaxHeight;
  const showMinRow = showMinWidth || showMinHeight;

  const addOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = [];
    if (!showWidthHeight) opts.push({ label: '普通宽/高', value: 'add-normal' });
    if (!showMinRow) opts.push({ label: '最小宽/高', value: 'add-min' });
    if (!showMaxRow) opts.push({ label: '最大宽/高', value: 'add-max' });
    return opts;
  }, [showWidthHeight, showMinRow, showMaxRow]);

  const handleAddOption = useCallback((val: string) => {
    if (val === 'add-normal') {
      setShowWidthHeight(true);
    } else if (val === 'add-min') {
      const updates: any[] = [];
      if (!showMinWidth) { updates.push({key: 'minWidth', value: null}); setShowMinWidth(true); }
      if (!showMinHeight) { updates.push({key: 'minHeight', value: null}); setShowMinHeight(true); }
      if (updates.length) onChange(updates.length === 1 ? updates[0] : updates);
    } else if (val === 'add-max') {
      const updates: any[] = [];
      if (!showMaxWidth) { updates.push({key: 'maxWidth', value: null}); setShowMaxWidth(true); }
      if (!showMaxHeight) { updates.push({key: 'maxHeight', value: null}); setShowMaxHeight(true); }
      if (updates.length) onChange(updates.length === 1 ? updates[0] : updates);
    }
  }, [showMinWidth, showMinHeight, showMaxWidth, showMaxHeight, onChange]);

  const handleRemoveMax = useCallback(() => {
    const updates: any[] = [];
    if (showMaxWidth) { updates.push({key: 'maxWidth', value: null}); setShowMaxWidth(false); setMaxWidthPending(undefined); }
    if (showMaxHeight) { updates.push({key: 'maxHeight', value: null}); setShowMaxHeight(false); setMaxHeightPending(undefined); }
    if (updates.length) onChange(updates.length === 1 ? updates[0] : updates);
  }, [showMaxWidth, showMaxHeight, onChange]);

  const handleRemoveMin = useCallback(() => {
    const updates: any[] = [];
    if (showMinWidth) { updates.push({key: 'minWidth', value: null}); setShowMinWidth(false); setMinWidthPending(undefined); }
    if (showMinHeight) { updates.push({key: 'minHeight', value: null}); setShowMinHeight(false); setMinHeightPending(undefined); }
    if (updates.length) onChange(updates.length === 1 ? updates[0] : updates);
  }, [showMinWidth, showMinHeight, onChange]);

  const allHidden = !showWidthHeight && !showMinRow && !showMaxRow;

  return (
    <Panel
      title="尺寸"
      showTitle={showTitle}
      showReset={true}
      resetFunction={refresh}
      collapse={allHidden ? true : (collapse || false)}
      showDelete={false}
      addOptions={addOptions.length > 0 ? addOptions : undefined}
      onAddOption={handleAddOption}
      rightColumn={
        <div className={css.sizeActions}>
          {showWidthHeight && !(cfg.disableWidth && cfg.disableHeight) && (
            <div className={css.sizeRemoveBtn} onClick={handleDeleteWidthHeight}>
              <MinusOutlined />
            </div>
          )}
          {showMinRow && (
            <div className={css.sizeRemoveBtn} onClick={handleRemoveMin}>
              <MinusOutlined />
            </div>
          )}
          {showMaxRow && (
            <div className={css.sizeRemoveBtn} onClick={handleRemoveMax}>
              <MinusOutlined />
            </div>
          )}
        </div>
      }
    >
      <div className={css.sizeRows}>
          {showWidthHeight && !(cfg.disableWidth && cfg.disableHeight) && (
            <Panel.Content style={{ gap: 8 }}>
              {cfg.disableWidth ? null : (
                <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 8 }}>
                  <div
                    {...getDragPropsWidth(widthEffective, '拖拽调整宽度')}
                    style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                  >
                    <span className={css.tip} style={{ width: 30, flexShrink: 0 }}>宽度</span>
                  </div>
                  <InputNumber
                    key={getUnitKey(widthEffective)}
                    style={{ flex: 1, marginLeft: 4 }}
                    defaultValue={widthEffective}
                    defaultUnitValue="px"
                    unitOptions={widthUnitOptions}
                    unitDisabledList={UNIT_DISABLED_LIST}
                    unitDisplayLabelMap={UNIT_DISPLAY_LABEL_MAP}
                    onChange={handleWidthChange}
                    showIcon={true}
                  />
                </Panel.Item>
              )}
              {cfg.disableHeight ? null : (
                <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 8 }}>
                  <div
                    {...getDragPropsHeight(heightEffective, '拖拽调整高度')}
                    style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                  >
                    <span className={css.tip} style={{ width: 30, flexShrink: 0 }}>高度</span>
                  </div>
                  <InputNumber
                    key={getUnitKey(heightEffective)}
                    style={{ flex: 1, marginLeft: 4 }}
                    defaultValue={heightEffective}
                    defaultUnitValue="px"
                    unitOptions={heightUnitOptions}
                    unitDisabledList={UNIT_DISABLED_LIST}
                    unitDisplayLabelMap={UNIT_DISPLAY_LABEL_MAP}
                    onChange={handleHeightChange}
                    showIcon={true}
                  />
                </Panel.Item>
              )}
            </Panel.Content>
          )}
          {showMinRow && (
            <Panel.Content style={{ gap: 8 }}>
              {showMinWidth && !cfg.disableWidth ? (
                <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 8 }}>
                  <div
                    {...getDragPropsMinWidth(minWidthEffective, '拖拽调整最小宽度')}
                    style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                  >
                    <span className={css.tip} style={{ width: 30, flexShrink: 0 }}>最小宽</span>
                  </div>
                  <InputNumber
                    key={getUnitKey(minWidthEffective)}
                    style={{ flex: 1, marginLeft: 4 }}
                    defaultValue={minWidthEffective}
                    defaultUnitValue="px"
                    unitOptions={MAX_MIN_UNIT_OPTIONS}
                    onChange={(val) => onChange({key: 'minWidth', value: val})}
                    showIcon={true}
                  />
                </Panel.Item>
              ) : <div style={{ flex: 1 }} />}
              {showMinHeight && !cfg.disableHeight ? (
                <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 8 }}>
                  <div
                    {...getDragPropsMinHeight(minHeightEffective, '拖拽调整最小高度')}
                    style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                  >
                    <span className={css.tip} style={{ width: 30, flexShrink: 0 }}>最小高</span>
                  </div>
                  <InputNumber
                    key={getUnitKey(minHeightEffective)}
                    style={{ flex: 1, marginLeft: 4 }}
                    defaultValue={minHeightEffective}
                    defaultUnitValue="px"
                    unitOptions={MAX_MIN_UNIT_OPTIONS}
                    onChange={(val) => onChange({key: 'minHeight', value: val})}
                    showIcon={true}
                  />
                </Panel.Item>
              ) : <div style={{ flex: 1 }} />}
            </Panel.Content>
          )}
          {showMaxRow && (
            <Panel.Content style={{ gap: 8 }}>
              {showMaxWidth && !cfg.disableWidth ? (
                <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 8 }}>
                  <div
                    {...getDragPropsMaxWidth(maxWidthEffective, '拖拽调整最大宽度')}
                    style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                  >
                    <span className={css.tip} style={{ width: 30, flexShrink: 0 }}>最大宽</span>
                  </div>
                  <InputNumber
                    key={getUnitKey(maxWidthEffective)}
                    style={{ flex: 1, marginLeft: 4 }}
                    defaultValue={maxWidthEffective}
                    defaultUnitValue="px"
                    unitOptions={MAX_MIN_UNIT_OPTIONS}
                    onChange={(val) => onChange({key: 'maxWidth', value: val})}
                    showIcon={true}
                  />
                </Panel.Item>
              ) : <div style={{ flex: 1 }} />}
              {showMaxHeight && !cfg.disableHeight ? (
                <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 8 }}>
                  <div
                    {...getDragPropsMaxHeight(maxHeightEffective, '拖拽调整最大高度')}
                    style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                  >
                    <span className={css.tip} style={{ width: 30, flexShrink: 0 }}>最大高</span>
                  </div>
                  <InputNumber
                    key={getUnitKey(maxHeightEffective)}
                    style={{ flex: 1, marginLeft: 4 }}
                    defaultValue={maxHeightEffective}
                    defaultUnitValue="px"
                    unitOptions={MAX_MIN_UNIT_OPTIONS}
                    onChange={(val) => onChange({key: 'maxHeight', value: val})}
                    showIcon={true}
                  />
                </Panel.Item>
              ) : <div style={{ flex: 1 }} />}
            </Panel.Content>
          )}
        </div>
    </Panel>
  );
}
