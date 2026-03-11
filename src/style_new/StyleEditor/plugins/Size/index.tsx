import React, {useState, useEffect, useCallback, useRef, CSSProperties} from "react";

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

const BASE_UNIT_OPTIONS = [
  {label: "默认", value: "default"},
  {label: "px", value: "px"},
  {label: "%", value: "%"},
  {label: "适应", value: "max-content"},
];
const WIDTH_UNIT_OPTIONS = [
  ...BASE_UNIT_OPTIONS,
  { label: '添加最大宽度', value: 'add-max-width', type: 'action' as const },
  { label: '添加最小宽度', value: 'add-min-width', type: 'action' as const },
];
const HEIGHT_UNIT_OPTIONS = [
  ...BASE_UNIT_OPTIONS,
  { label: '添加最大高度', value: 'add-max-height', type: 'action' as const },
  { label: '添加最小高度', value: 'add-min-height', type: 'action' as const },
];
const MAX_MIN_UNIT_OPTIONS = [
  { label: 'px', value: 'px' },
  { label: '%', value: '%' },
  { label: '移除', value: 'remove', type: 'action' as const },
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

  const [showMaxWidth, setShowMaxWidth] = useState(() => !!normalizeSizeValue(value.maxWidth));
  const [showMinWidth, setShowMinWidth] = useState(() => !!normalizeSizeValue(value.minWidth));
  const [showMaxHeight, setShowMaxHeight] = useState(() => !!normalizeSizeValue(value.maxHeight));
  const [showMinHeight, setShowMinHeight] = useState(() => !!normalizeSizeValue(value.minHeight));

  const refresh = useCallback(() => {
    onChange([
      { key: 'width', value: null },
      { key: 'height', value: null },
      { key: 'maxWidth', value: null },
      { key: 'maxHeight', value: null },
      { key: 'minWidth', value: null },
      { key: 'minHeight', value: null },
    ]);
    setShowMaxWidth(false);
    setShowMinWidth(false);
    setShowMaxHeight(false);
    setShowMinHeight(false);
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

  const widthEffective = (showMaxWidth || showMinWidth) ? undefined : normalizeSizeValue(widthPending ?? value.width);
  const heightEffective = (showMaxHeight || showMinHeight) ? undefined : normalizeSizeValue(heightPending ?? value.height);
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
      const updates: any[] = [{key: 'width', value: newVal}];
      if (showMaxWidth) updates.push({key: 'maxWidth', value: null});
      if (showMinWidth) updates.push({key: 'minWidth', value: null});
      onChange(updates.length > 1 ? updates : updates[0]);
      if (showMaxWidth) setShowMaxWidth(false);
      if (showMinWidth) setShowMinWidth(false);
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
      const updates: any[] = [{key: 'height', value: newVal}];
      if (showMaxHeight) updates.push({key: 'maxHeight', value: null});
      if (showMinHeight) updates.push({key: 'minHeight', value: null});
      onChange(updates.length > 1 ? updates : updates[0]);
      if (showMaxHeight) setShowMaxHeight(false);
      if (showMinHeight) setShowMinHeight(false);
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

  const handleWidthAction = useCallback((actionValue: string) => {
    if (actionValue === 'add-max-width') {
      if (!showMaxWidth) {
        onChange([{key: 'width', value: null}, {key: 'maxWidth', value: null}]);
        setWidthPending(undefined);
      } else {
        onChange({key: 'maxWidth', value: null});
      }
      setShowMaxWidth(v => !v);
    } else if (actionValue === 'add-min-width') {
      if (!showMinWidth) {
        onChange([{key: 'width', value: null}, {key: 'minWidth', value: null}]);
        setWidthPending(undefined);
      } else {
        onChange({key: 'minWidth', value: null});
      }
      setShowMinWidth(v => !v);
    }
  }, [showMaxWidth, showMinWidth, onChange]);

  const handleHeightAction = useCallback((actionValue: string) => {
    if (actionValue === 'add-max-height') {
      if (!showMaxHeight) {
        onChange([{key: 'height', value: null}, {key: 'maxHeight', value: null}]);
        setHeightPending(undefined);
      } else {
        onChange({key: 'maxHeight', value: null});
      }
      setShowMaxHeight(v => !v);
    } else if (actionValue === 'add-min-height') {
      if (!showMinHeight) {
        onChange([{key: 'height', value: null}, {key: 'minHeight', value: null}]);
        setHeightPending(undefined);
      } else {
        onChange({key: 'minHeight', value: null});
      }
      setShowMinHeight(v => !v);
    }
  }, [showMaxHeight, showMinHeight, onChange]);

  const handleMaxWidthAction = useCallback((actionValue: string) => {
    if (actionValue === 'remove') {
      onChange({key: 'maxWidth', value: null});
      setShowMaxWidth(false);
    }
  }, [onChange]);

  const handleMinWidthAction = useCallback((actionValue: string) => {
    if (actionValue === 'remove') {
      onChange({key: 'minWidth', value: null});
      setShowMinWidth(false);
    }
  }, [onChange]);

  const handleMaxHeightAction = useCallback((actionValue: string) => {
    if (actionValue === 'remove') {
      onChange({key: 'maxHeight', value: null});
      setShowMaxHeight(false);
    }
  }, [onChange]);

  const handleMinHeightAction = useCallback((actionValue: string) => {
    if (actionValue === 'remove') {
      onChange({key: 'minHeight', value: null});
      setShowMinHeight(false);
    }
  }, [onChange]);

  const handleWidthChange = useCallback((val: string) => {
    const realVal = val === 'default' ? null : val;
    if (realVal && (showMaxWidth || showMinWidth) && !isDraggingWidth.current) {
      const updates: any[] = [{key: 'width', value: realVal}];
      if (showMaxWidth) updates.push({key: 'maxWidth', value: null});
      if (showMinWidth) updates.push({key: 'minWidth', value: null});
      onChange(updates);
      setShowMaxWidth(false);
      setShowMinWidth(false);
      setWidthPending(realVal);
    } else {
      onChange({key: 'width', value: realVal});
    }
  }, [showMaxWidth, showMinWidth, onChange]);

  const handleHeightChange = useCallback((val: string) => {
    const realVal = val === 'default' ? null : val;
    if (realVal && (showMaxHeight || showMinHeight) && !isDraggingHeight.current) {
      const updates: any[] = [{key: 'height', value: realVal}];
      if (showMaxHeight) updates.push({key: 'maxHeight', value: null});
      if (showMinHeight) updates.push({key: 'minHeight', value: null});
      onChange(updates);
      setShowMaxHeight(false);
      setShowMinHeight(false);
      setHeightPending(realVal);
    } else {
      onChange({key: 'height', value: realVal});
    }
  }, [showMaxHeight, showMinHeight, onChange]);

  const widthUnitOptions = WIDTH_UNIT_OPTIONS.filter(opt => {
    if (!('type' in opt)) return true;
    if (opt.value === 'add-max-width') return !showMaxWidth;
    if (opt.value === 'add-min-width') return !showMinWidth;
    return true;
  });
  const heightUnitOptions = HEIGHT_UNIT_OPTIONS.filter(opt => {
    if (!('type' in opt)) return true;
    if (opt.value === 'add-max-height') return !showMaxHeight;
    if (opt.value === 'add-min-height') return !showMinHeight;
    return true;
  });

  return (
    <Panel title="尺寸" showTitle={showTitle} showReset={true} resetFunction={refresh} collapse={collapse}>
      {!(cfg.disableWidth && cfg.disableHeight) && (
        <Panel.Content style={{ gap: 8 }}>
          {cfg.disableWidth ? null : (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 8 }}>
              <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 8 }}>
                <div
                  {...getDragPropsWidth(widthEffective, '拖拽调整宽度')}
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    cursor: "ew-resize"
                  }}
                >
                  <span className={css.tip} style={{ width: 30, flexShrink: 0 }}>宽度</span>
                </div>
                <InputNumber
                  key={`${getUnitKey(widthEffective)}-${showMaxWidth ? 1 : 0}-${showMinWidth ? 1 : 0}`}
                  style={{ flex: 1, marginLeft: 4 }}
                  defaultValue={widthEffective}
                  defaultUnitValue="px"
                  unitOptions={widthUnitOptions}
                  unitDisabledList={UNIT_DISABLED_LIST}
                  unitDisplayLabelMap={UNIT_DISPLAY_LABEL_MAP}
                  onChange={handleWidthChange}
                  onAction={handleWidthAction}
                  showIcon={true}
                />
              </Panel.Item>
              {showMaxWidth && (
                <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 8, marginLeft: 0 }}>
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
                    onAction={handleMaxWidthAction}
                    showIcon={true}
                  />
                </Panel.Item>
              )}
              {showMinWidth && (
                <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 8, marginLeft: 0 }}>
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
                    onAction={handleMinWidthAction}
                    showIcon={true}
                  />
                </Panel.Item>
              )}
            </div>
          )}
          {cfg.disableHeight ? null : (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 8 }}>
              <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 8 }}>
                <div
                  {...getDragPropsHeight(heightEffective, '拖拽调整高度')}
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    cursor: "ew-resize"
                  }}
                >
                  <span className={css.tip} style={{ width: 30, flexShrink: 0 }}>高度</span>
                </div>
                <InputNumber
                  key={`${getUnitKey(heightEffective)}-${showMaxHeight ? 1 : 0}-${showMinHeight ? 1 : 0}`}
                  style={{ flex: 1, marginLeft: 4 }}
                  defaultValue={heightEffective}
                  defaultUnitValue="px"
                  unitOptions={heightUnitOptions}
                  unitDisabledList={UNIT_DISABLED_LIST}
                  unitDisplayLabelMap={UNIT_DISPLAY_LABEL_MAP}
                  onChange={handleHeightChange}
                  onAction={handleHeightAction}
                  showIcon={true}
                />
              </Panel.Item>
              {showMaxHeight && (
                <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 8, marginLeft:0 }}>
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
                    onAction={handleMaxHeightAction}
                    showIcon={true}
                  />
                </Panel.Item>
              )}
              {showMinHeight && (
                <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 8, marginLeft:0 }}>
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
                    onAction={handleMinHeightAction}
                    showIcon={true}
                  />
                </Panel.Item>
              )}
            </div>
          )}
        </Panel.Content>
      )}
      {!(cfg.disableMaxWidth && cfg.disableMaxHeight) && (
        <Panel.Content style={{ gap: 8 }}>
          {cfg.disableMaxWidth ? null : (
            <InputNumber
              prefix={<span className={css.tip}>最大宽</span>}
              defaultValue={value.maxWidth}
              unitOptions={BASE_UNIT_OPTIONS}
              unitDisabledList={UNIT_DISABLED_LIST}
              onChange={(value) => onChange({key: "maxWidth", value})}
              showIcon={true}
            />
          )}
          {cfg.disableMaxHeight ? null : (
            <InputNumber
              prefix={<span className={css.tip}>最大高</span>}
              defaultValue={value.maxHeight}
              unitOptions={BASE_UNIT_OPTIONS}
              unitDisabledList={UNIT_DISABLED_LIST}
              onChange={(value) => onChange({key: "maxHeight", value})}
              showIcon={true}
            />
          )}
        </Panel.Content>
      )}
      {!(cfg.disableMinWidth && cfg.disableMinHeight) && (
        <Panel.Content style={{ gap: 8 }}>
          {cfg.disableMinWidth ? null : (
            <InputNumber
              prefix={<span className={css.tip}>最小宽</span>}
              defaultValue={value.minWidth}
              unitOptions={BASE_UNIT_OPTIONS}
              unitDisabledList={UNIT_DISABLED_LIST}
              onChange={(value) => onChange({key: "minWidth", value})}
              showIcon={true}
            />
          )}
          {cfg.disableMinHeight ? null : (
            <InputNumber
              prefix={<span className={css.tip}>最小高</span>}
              defaultValue={value.minHeight}
              unitOptions={BASE_UNIT_OPTIONS}
              unitDisabledList={UNIT_DISABLED_LIST}
              onChange={(value) => onChange({key: "minHeight", value})}
              showIcon={true}
            />
          )}
        </Panel.Content>
      )}
    </Panel>
  );
}
