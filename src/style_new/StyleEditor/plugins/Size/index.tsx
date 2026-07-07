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
  DownOutlined,
  Dropdown,
} from "../../components";
import { FixedWidth } from "../../icons/FixedWidth";
import { HugContents } from "../../icons/HugContents";
import { FillContainer } from "../../icons/FillContainer";
import { AddMin } from "../../icons/AddMin";
import { AddMax } from "../../icons/AddMax";
import { AspectRatioLock } from "../../icons/AspectRatioLock";
import { AspectRatioUnlock } from "../../icons/AspectRatioUnlock";
import { useDragNumber } from "../../hooks";
import { useStyleEditorContext } from "../../context";

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
const MIN_WIDTH_UNIT_OPTIONS  = [...MAX_MIN_UNIT_OPTIONS, { label: '移除最小宽', value: 'remove', type: 'action' as const }];
const MIN_HEIGHT_UNIT_OPTIONS = [...MAX_MIN_UNIT_OPTIONS, { label: '移除最小高', value: 'remove', type: 'action' as const }];
const MAX_WIDTH_UNIT_OPTIONS  = [...MAX_MIN_UNIT_OPTIONS, { label: '移除最大宽', value: 'remove', type: 'action' as const }];
const MAX_HEIGHT_UNIT_OPTIONS = [...MAX_MIN_UNIT_OPTIONS, { label: '移除最大高', value: 'remove', type: 'action' as const }];
const UNIT_DISABLED_LIST = ["max-content", "default", "fit-content"];
const UNIT_DISPLAY_LABEL_MAP: Record<string, string> = {
  "max-content": "适应",
  "default": "默认",
  "fit-content": "Hug",
};
const SIZE_DISABLED_TIP = "由布局自动控制，修改后将改为固定值";
const SIZE_UNIT_SELECT_STYLE: React.CSSProperties = {
  background: "transparent",
};

interface SizingModeBadgeProps {
  mode: 'hug' | 'fill';
  dimension: 'width' | 'height';
  actualSize: number;
  onChange: (value: string | null) => void;
  onAddMin?: () => void;
  onAddMax?: () => void;
}

function SizingModeBadge({ mode, dimension, actualSize, onChange, onAddMin, onAddMax }: SizingModeBadgeProps) {
  const dim = dimension === 'width' ? 'width' : 'height';
  const options = [
    { label: `固定${dim === 'width' ? '宽度' : '高度'} (${actualSize}px)`, value: 'fixed', icon: <FixedWidth /> },
    { label: '适应内容',                          value: 'hug',   icon: <HugContents /> },
    { label: '填满父容器',                          value: 'fill',  icon: <FillContainer /> },
    { label: '', value: '__divider__', type: 'divider' as const },
    { label: `添加最小${dim === 'width' ? '宽度' : '高度'}...`, value: 'addMin', type: 'action' as const, icon: <AddMin />, iconSize: 'sm' as const },
    { label: `添加最大${dim === 'width' ? '宽度' : '高度'}...`, value: 'addMax', type: 'action' as const, icon: <AddMax />, iconSize: 'sm' as const },
  ];

  const handleClick = useCallback((val: string) => {
    if (val === 'fixed')      onChange(`${actualSize}px`);
    else if (val === 'hug')   onChange('fit-content');
    else if (val === 'fill')  onChange('100%');
  }, [actualSize, onChange]);

  const handleAction = useCallback((val: string) => {
    if (val === 'addMin') onAddMin?.();
    if (val === 'addMax') onAddMax?.();
  }, [onAddMin, onAddMax]);

  return (
    <Dropdown value={mode} options={options} onClick={handleClick} onAction={handleAction}>
      <span className={mode === 'fill' ? css.fillBadge : css.hugBadge}>
        <span className={css.badgeLabel}>{mode === 'fill' ? '填满' : '适应'}</span>
        <span className={css.badgeArrow}><DownOutlined /></span>
      </span>
    </Dropdown>
  );
}

/** 归一化尺寸值：auto / inherit / 未配置 → undefined，让输入框显示为空（默认状态）。fit-content 保留原值，用于区分"显式 Hug"与"未配置" */
function normalizeSizeValue(val: any): string | undefined {
  if (!val || val === 'auto' || val === 'inherit') return undefined;
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

  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  lockedRef.current = locked;
  const ratioRef = useRef<number>(1);

  // 锁定联动：拖拽中直接操作 DOM 避免闪烁，拖拽结束后用 key 做一次同步
  const [widthLockKey, setWidthLockKey] = useState(0);
  const [heightLockKey, setHeightLockKey] = useState(0);
  const heightInputWrapRef = useRef<HTMLDivElement>(null);
  const widthInputWrapRef = useRef<HTMLDivElement>(null);
  const getLockedInput = (ref: React.RefObject<HTMLDivElement>) =>
    ref.current?.querySelector<HTMLInputElement>('input') ?? null;

  const editorContext = useStyleEditorContext();
  const targetDom = editorContext?.targetDom ?? null;

  const [actualWidth, setActualWidth] = useState<number>(0);
  const [actualHeight, setActualHeight] = useState<number>(0);

  const actualWidthRef = useRef(0);
  const actualHeightRef = useRef(0);
  const targetDomRef = useRef<HTMLElement | null>(null);
  actualWidthRef.current = actualWidth;
  actualHeightRef.current = actualHeight;
  targetDomRef.current = targetDom;

  useEffect(() => {
    if (!targetDom) {
      setActualWidth(0);
      setActualHeight(0);
      return;
    }
    const measure = () => {
      if (isDraggingWidth.current || isDraggingHeight.current) return;
      const w = targetDom.offsetWidth;
      const h = targetDom.offsetHeight;
      setActualWidth(w);
      setActualHeight(h);
      if (w > 0 || h > 0) {
        setShowWidthHeight(true);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(targetDom);
    return () => observer.disconnect();
  }, [targetDom]);

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

  // Fill 检测：CSS 值为百分比（100%、50% 等），由父容器尺寸决定
  const isWidthFill = !!(widthEffective?.includes('%') && actualWidth > 0);
  const isHeightFill = !!(heightEffective?.includes('%') && actualHeight > 0);

  // 宽高比跟踪：未锁定时持续更新比例，仅对 px 值有效
  const widthPxVal = useMemo(() => {
    if (widthEffective) {
      const n = parseFloat(widthEffective);
      return widthEffective.endsWith('px') && !isNaN(n) ? n : 0;
    }
    return actualWidth > 0 ? actualWidth : 0;
  }, [widthEffective, actualWidth]);

  const heightPxVal = useMemo(() => {
    if (heightEffective) {
      const n = parseFloat(heightEffective);
      return heightEffective.endsWith('px') && !isNaN(n) ? n : 0;
    }
    return actualHeight > 0 ? actualHeight : 0;
  }, [heightEffective, actualHeight]);

  useEffect(() => {
    if (!locked && widthPxVal > 0 && heightPxVal > 0) {
      ratioRef.current = heightPxVal / widthPxVal;
    }
  }, [locked, widthPxVal, heightPxVal]);
  const minWidthEffective = normalizeSizeValue(minWidthPending ?? value.minWidth);
  const maxHeightEffective = normalizeSizeValue(maxHeightPending ?? value.maxHeight);
  const minHeightEffective = normalizeSizeValue(minHeightPending ?? value.minHeight);

  const getDragPropsWidth = useDragNumber({
    onDragStart: (currentValue, inputEl) => {
      isDraggingWidth.current = true;
      if (currentValue === 'fit-content') {
        const fallback = Math.round(actualWidthRef.current);
        if (inputEl) { inputEl.disabled = false; inputEl.value = String(fallback); }
        return fallback;
      }
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
      const dom = targetDomRef.current;
      if (dom) { setActualWidth(dom.offsetWidth); setActualHeight(dom.offsetHeight); }
      const newVal = `${finalValue}px`;
      if (lockedRef.current && ratioRef.current > 0) {
        const newH = Math.max(1, Math.round(finalValue * ratioRef.current));
        const newHVal = `${newH}px`;
        const updates: any[] = [
          { key: 'width', value: newVal },
          { key: 'height', value: newHVal },
        ];
        if (cfg.disableWidth) {
          updates.push({ key: 'flex', value: null });
          updates.push({ key: 'flexGrow', value: null });
          updates.push({ key: 'flexBasis', value: null });
        }
        onChange(updates);
        setWidthPending(newVal);
        setHeightPending(newHVal);
        setHeightLockKey(k => k + 1);
      } else if (cfg.disableWidth) {
        onChange([
          { key: 'width', value: newVal },
          { key: 'flex', value: null },
          { key: 'flexGrow', value: null },
          { key: 'flexBasis', value: null },
        ]);
        setWidthPending(newVal);
      } else {
        onChange({ key: 'width', value: newVal });
        setWidthPending(newVal);
      }
    },
    continuous: true
  });

  const getDragPropsHeight = useDragNumber({
    onDragStart: (currentValue, inputEl) => {
      isDraggingHeight.current = true;
      if (currentValue === 'fit-content') {
        const fallback = Math.round(actualHeightRef.current);
        if (inputEl) { inputEl.disabled = false; inputEl.value = String(fallback); }
        return fallback;
      }
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
      const dom = targetDomRef.current;
      if (dom) { setActualWidth(dom.offsetWidth); setActualHeight(dom.offsetHeight); }
      const newVal = `${finalValue}px`;
      if (lockedRef.current && ratioRef.current > 0) {
        const newW = Math.max(1, Math.round(finalValue / ratioRef.current));
        const newWVal = `${newW}px`;
        const updates: any[] = [
          { key: 'width', value: newWVal },
          { key: 'height', value: newVal },
        ];
        if (cfg.disableHeight) {
          updates.push({ key: 'flex', value: null });
          updates.push({ key: 'flexGrow', value: null });
          updates.push({ key: 'flexBasis', value: null });
        }
        onChange(updates);
        setWidthPending(newWVal);
        setHeightPending(newVal);
        setWidthLockKey(k => k + 1);
      } else if (cfg.disableHeight) {
        onChange([
          { key: 'height', value: newVal },
          { key: 'flex', value: null },
          { key: 'flexGrow', value: null },
          { key: 'flexBasis', value: null },
        ]);
        setHeightPending(newVal);
      } else {
        onChange({ key: 'height', value: newVal });
        setHeightPending(newVal);
      }
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
    if (locked && ratioRef.current > 0 && realVal) {
      const numVal = parseFloat(realVal);
      if (!isNaN(numVal) && realVal.endsWith('px')) {
        const newH = Math.max(1, Math.round(numVal * ratioRef.current));
        const newHVal = `${newH}px`;
        const updates: any[] = [
          { key: 'width', value: realVal },
          { key: 'height', value: newHVal },
        ];
        if (cfg.disableWidth) {
          updates.push({ key: 'flex', value: null });
          updates.push({ key: 'flexGrow', value: null });
          updates.push({ key: 'flexBasis', value: null });
        }
        onChange(updates);
        if (!isDraggingWidth.current) setWidthPending(realVal);
        setHeightPending(newHVal);
        if (isDraggingWidth.current) {
          // 拖拽中：直接操作 DOM，避免每帧重挂载导致闪烁
          const heightInput = getLockedInput(heightInputWrapRef);
          if (heightInput) heightInput.value = String(newH);
        } else {
          // 手动输入：重挂载一次以同步 React 状态
          setHeightLockKey(k => k + 1);
        }
        return;
      }
    }
    if (cfg.disableWidth) {
      onChange([
        { key: 'width', value: realVal },
        { key: 'flex', value: null },
        { key: 'flexGrow', value: null },
        { key: 'flexBasis', value: null },
      ]);
    } else {
      onChange({ key: 'width', value: realVal });
    }
    if (!isDraggingWidth.current) setWidthPending(realVal ?? undefined);
  }, [onChange, cfg.disableWidth, locked]);

  const handleHeightChange = useCallback((val: string) => {
    const realVal = val === 'default' ? null : val;
    if (locked && ratioRef.current > 0 && realVal) {
      const numVal = parseFloat(realVal);
      if (!isNaN(numVal) && realVal.endsWith('px')) {
        const newW = Math.max(1, Math.round(numVal / ratioRef.current));
        const newWVal = `${newW}px`;
        const updates: any[] = [
          { key: 'width', value: newWVal },
          { key: 'height', value: realVal },
        ];
        if (cfg.disableHeight) {
          updates.push({ key: 'flex', value: null });
          updates.push({ key: 'flexGrow', value: null });
          updates.push({ key: 'flexBasis', value: null });
        }
        onChange(updates);
        setWidthPending(newWVal);
        if (!isDraggingHeight.current) setHeightPending(realVal);
        if (isDraggingHeight.current) {
          // 拖拽中：直接操作 DOM，避免每帧重挂载导致闪烁
          const widthInput = getLockedInput(widthInputWrapRef);
          if (widthInput) widthInput.value = String(newW);
        } else {
          setWidthLockKey(k => k + 1);
        }
        return;
      }
    }
    if (cfg.disableHeight) {
      onChange([
        { key: 'height', value: realVal },
        { key: 'flex', value: null },
        { key: 'flexGrow', value: null },
        { key: 'flexBasis', value: null },
      ]);
    } else {
      onChange({ key: 'height', value: realVal });
    }
    if (!isDraggingHeight.current) setHeightPending(realVal ?? undefined);
  }, [onChange, cfg.disableHeight, locked]);

  const widthUnitOptions = useMemo(() => [
    ...BASE_UNIT_OPTIONS.filter(o => o.value !== 'max-content'),
    { label: '适应内容', value: 'hug', type: 'action' as const, icon: <HugContents /> },
    { label: '填满父容器', value: 'fill', type: 'action' as const, icon: <FillContainer /> },
    ...(!showMinWidth || !showMaxWidth ? [{ label: '', value: '__divider__', type: 'divider' as const }] : []),
    ...(!showMinWidth ? [{ label: '添加最小宽度...', value: 'addMinWidth', type: 'action' as const, icon: <AddMin />, iconSize: 'sm' as const }] : []),
    ...(!showMaxWidth ? [{ label: '添加最大宽度...', value: 'addMaxWidth', type: 'action' as const, icon: <AddMax />, iconSize: 'sm' as const }] : []),
  ], [showMinWidth, showMaxWidth]);

  const heightUnitOptions = useMemo(() => [
    ...BASE_UNIT_OPTIONS.filter(o => o.value !== 'max-content'),
    { label: '适应内容', value: 'hug', type: 'action' as const, icon: <HugContents /> },
    { label: '填满父容器', value: 'fill', type: 'action' as const, icon: <FillContainer /> },
    ...(!showMinHeight || !showMaxHeight ? [{ label: '', value: '__divider__', type: 'divider' as const }] : []),
    ...(!showMinHeight ? [{ label: '添加最小高度...', value: 'addMinHeight', type: 'action' as const, icon: <AddMin />, iconSize: 'sm' as const }] : []),
    ...(!showMaxHeight ? [{ label: '添加最大高度...', value: 'addMaxHeight', type: 'action' as const, icon: <AddMax />, iconSize: 'sm' as const }] : []),
  ], [showMinHeight, showMaxHeight]);

  const showMaxRow = showMaxWidth || showMaxHeight;
  const showMinRow = showMinWidth || showMinHeight;

  // 左列（宽度约束）按顺序堆叠，右列（高度约束）按顺序堆叠，逐行配对
  const leftConstraintStack = ([
    showMinWidth && 'minWidth',
    showMaxWidth && 'maxWidth',
  ].filter(Boolean)) as ('minWidth' | 'maxWidth')[];
  const rightConstraintStack = ([
    showMinHeight && 'minHeight',
    showMaxHeight && 'maxHeight',
  ].filter(Boolean)) as ('minHeight' | 'maxHeight')[];
  const constraintRowCount = Math.max(leftConstraintStack.length, rightConstraintStack.length);

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
      collapse={allHidden ? true : false}
      showDelete={false}
      addOptions={addOptions.length > 0 ? addOptions : undefined}
      onAddOption={handleAddOption}
      rightColumn={
        <div className={css.sizeActions}>
          {showWidthHeight && (
            <div className={css.lockBtnRow}>
              <button
                type="button"
                className={`${css.lockBtn} ${locked ? css.lockBtnActive : ''}`}
                data-mybricks-tip={JSON.stringify({ content: locked ? '解锁宽高比' : '锁定宽高比', position: 'left' })}
                onClick={() => setLocked(v => !v)}
              >
                {locked ? <AspectRatioLock /> : <AspectRatioUnlock />}
              </button>
            </div>
          )}
          {Array.from({ length: constraintRowCount }, (_, i) => {
            const leftKey = leftConstraintStack[i];
            const rightKey = rightConstraintStack[i];
            return (
              <div key={`remove-row-${i}`} className={css.sizeRemoveBtn} onClick={() => {
                const updates: any[] = [];
                if (leftKey === 'minWidth')  { updates.push({key: 'minWidth',  value: null}); setShowMinWidth(false);  setMinWidthPending(undefined); }
                if (leftKey === 'maxWidth')  { updates.push({key: 'maxWidth',  value: null}); setShowMaxWidth(false);  setMaxWidthPending(undefined); }
                if (rightKey === 'minHeight') { updates.push({key: 'minHeight', value: null}); setShowMinHeight(false); setMinHeightPending(undefined); }
                if (rightKey === 'maxHeight') { updates.push({key: 'maxHeight', value: null}); setShowMaxHeight(false); setMaxHeightPending(undefined); }
                if (updates.length) onChange(updates.length === 1 ? updates[0] : updates);
              }}>
                <MinusOutlined />
              </div>
            );
          })}
        </div>
      }
    >
      <div className={css.sizeRows}>
          {showWidthHeight && (
            <Panel.Content style={{ position: 'relative' }}>
              <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 4 }}>
                <div
                  {...getDragPropsWidth(widthEffective ?? (actualWidth > 0 ? `${Math.round(actualWidth)}px` : undefined), cfg.disableWidth ? '由布局自动控制，修改后将改为固定值' : '拖拽调整宽度')}
                  style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                >
                  <span className={css.tip} style={{ flexShrink: 0}}>宽度</span>
                </div>
                <div ref={widthInputWrapRef} style={{ flex: 1, minWidth: 0, display: 'contents' }}>
                  <InputNumber
                    key={`${isWidthFill ? `fill-w-${Math.round(actualWidth)}` : (widthEffective === 'fit-content' ? `hug-w-${Math.round(actualWidth)}` : (widthEffective ? getUnitKey(widthEffective) : (actualWidth > 0 ? `dom-w-${Math.round(actualWidth)}` : 'empty')))}-wlk${widthLockKey}`}
                    style={{ flex: 1, minWidth: 0, marginLeft: 4 }}
                    defaultValue={isWidthFill ? `${Math.round(actualWidth)}px` : (widthEffective === 'fit-content' ? (actualWidth > 0 ? `${Math.round(actualWidth)}px` : undefined) : (widthEffective ?? (actualWidth > 0 ? `${Math.round(actualWidth)}px` : undefined)))}
                    defaultUnitValue="px"
                    unitOptions={widthUnitOptions}
                    unitDisabledList={UNIT_DISABLED_LIST}
                    unitDisplayLabelMap={UNIT_DISPLAY_LABEL_MAP}
                    onChange={handleWidthChange}
                    onAction={(val) => {
                      if (val === 'hug') { setWidthPending('fit-content'); onChange({ key: 'width', value: 'fit-content' }); }
                      else if (val === 'fill') { setWidthPending('100%'); onChange({ key: 'width', value: '100%' }); }
                      else if (val === 'addMinWidth') { setShowMinWidth(true); setShowWidthHeight(true); }
                      else if (val === 'addMaxWidth') { setShowMaxWidth(true); setShowWidthHeight(true); }
                    }}
                    showIcon={true}
                    unitIconClassName={css.sizeUnitIcon}
                    unitSelectStyle={SIZE_UNIT_SELECT_STYLE}
                    tip={cfg.disableWidth ? SIZE_DISABLED_TIP : undefined}
                    badge={
                      isWidthFill ? (
                        <SizingModeBadge
                          mode="fill"
                          dimension="width"
                          actualSize={Math.round(actualWidth)}
                          onChange={(v) => { setWidthPending(v ?? 'auto'); onChange({ key: 'width', value: v }); }}
                          onAddMin={() => { setShowMinWidth(true); setShowWidthHeight(true); }}
                          onAddMax={() => { setShowMaxWidth(true); setShowWidthHeight(true); }}
                        />
                      ) : (widthEffective === 'fit-content') ? (
                        <SizingModeBadge
                          mode="hug"
                          dimension="width"
                          actualSize={Math.round(actualWidth)}
                          onChange={(v) => { setWidthPending(v ?? 'fit-content'); onChange({ key: 'width', value: v }); }}
                          onAddMin={() => { setShowMinWidth(true); setShowWidthHeight(true); }}
                          onAddMax={() => { setShowMaxWidth(true); setShowWidthHeight(true); }}
                        />
                      ) : undefined
                    }
                  />
                </div>
              </Panel.Item>
              <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 4 }}>
                <div
                  {...getDragPropsHeight(heightEffective ?? (actualHeight > 0 ? `${Math.round(actualHeight)}px` : undefined), cfg.disableHeight ? '由布局自动控制，修改后将改为固定值' : '拖拽调整高度')}
                  style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                >
                  <span className={css.tip} style={{ flexShrink: 0 }}>高度</span>
                </div>
                <div ref={heightInputWrapRef} style={{ flex: 1, minWidth: 0, display: 'contents' }}>
                  <InputNumber
                    key={`${isHeightFill ? `fill-h-${Math.round(actualHeight)}` : (heightEffective === 'fit-content' ? `hug-h-${Math.round(actualHeight)}` : (heightEffective ? getUnitKey(heightEffective) : (actualHeight > 0 ? `dom-h-${Math.round(actualHeight)}` : 'empty')))}-hlk${heightLockKey}`}
                    style={{ flex: 1, minWidth: 0, marginLeft: 4 }}
                    defaultValue={isHeightFill ? `${Math.round(actualHeight)}px` : (heightEffective === 'fit-content' ? (actualHeight > 0 ? `${Math.round(actualHeight)}px` : undefined) : (heightEffective ?? (actualHeight > 0 ? `${Math.round(actualHeight)}px` : undefined)))}
                    defaultUnitValue="px"
                    unitOptions={heightUnitOptions}
                    unitDisabledList={UNIT_DISABLED_LIST}
                    unitDisplayLabelMap={UNIT_DISPLAY_LABEL_MAP}
                    onChange={handleHeightChange}
                    onAction={(val) => {
                      if (val === 'hug') { setHeightPending('fit-content'); onChange({ key: 'height', value: 'fit-content' }); }
                      else if (val === 'fill') { setHeightPending('100%'); onChange({ key: 'height', value: '100%' }); }
                      else if (val === 'addMinHeight') { setShowMinHeight(true); setShowWidthHeight(true); }
                      else if (val === 'addMaxHeight') { setShowMaxHeight(true); setShowWidthHeight(true); }
                    }}
                    showIcon={true}
                    unitIconClassName={css.sizeUnitIcon}
                    unitSelectStyle={SIZE_UNIT_SELECT_STYLE}
                    tip={cfg.disableHeight ? SIZE_DISABLED_TIP : undefined}
                    badge={
                      isHeightFill ? (
                        <SizingModeBadge
                          mode="fill"
                          dimension="height"
                          actualSize={Math.round(actualHeight)}
                          onChange={(v) => { setHeightPending(v ?? 'auto'); onChange({ key: 'height', value: v }); }}
                          onAddMin={() => { setShowMinHeight(true); setShowWidthHeight(true); }}
                          onAddMax={() => { setShowMaxHeight(true); setShowWidthHeight(true); }}
                        />
                      ) : (heightEffective === 'fit-content') ? (
                        <SizingModeBadge
                          mode="hug"
                          dimension="height"
                          actualSize={Math.round(actualHeight)}
                          onChange={(v) => { setHeightPending(v ?? 'fit-content'); onChange({ key: 'height', value: v }); }}
                          onAddMin={() => { setShowMinHeight(true); setShowWidthHeight(true); }}
                          onAddMax={() => { setShowMaxHeight(true); setShowWidthHeight(true); }}
                        />
                      ) : undefined
                    }
                  />
                </div>
              </Panel.Item>
              {locked && <span className={css.linkDot} />}
            </Panel.Content>
          )}
          {Array.from({ length: constraintRowCount }, (_, i) => {
            const leftKey = leftConstraintStack[i];
            const rightKey = rightConstraintStack[i];
            return (
              <Panel.Content key={`cr-${i}`}>
                {leftKey === 'minWidth' ? (
                  <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 4, flex: 1 }}>
                    <div
                      {...getDragPropsMinWidth(minWidthEffective, '拖拽调整最小宽度')}
                      style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                    >
                      <span className={css.tip} style={{ flexShrink: 0 }}>最小宽</span>
                    </div>
                    <InputNumber
                      key={getUnitKey(minWidthEffective)}
                      style={{ flex: 1, minWidth: 0, marginLeft: 4 }}
                      defaultValue={minWidthEffective}
                      defaultUnitValue="px"
                      unitOptions={MIN_WIDTH_UNIT_OPTIONS}
                      onChange={(val) => onChange({key: 'minWidth', value: val})}
                      onAction={() => { onChange({key: 'minWidth', value: null}); setShowMinWidth(false); setMinWidthPending(undefined); }}
                      showIcon={true}
                      unitIconClassName={css.sizeUnitIcon}
                      unitSelectStyle={SIZE_UNIT_SELECT_STYLE}
                    />
                  </Panel.Item>
                ) : leftKey === 'maxWidth' ? (
                  <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 4, flex: 1 }}>
                    <div
                      {...getDragPropsMaxWidth(maxWidthEffective, '拖拽调整最大宽度')}
                      style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                    >
                      <span className={css.tip} style={{ flexShrink: 0 }}>最大宽</span>
                    </div>
                    <InputNumber
                      key={getUnitKey(maxWidthEffective)}
                      style={{ flex: 1, minWidth: 0, marginLeft: 4 }}
                      defaultValue={maxWidthEffective}
                      defaultUnitValue="px"
                      unitOptions={MAX_WIDTH_UNIT_OPTIONS}
                      onChange={(val) => onChange({key: 'maxWidth', value: val})}
                      onAction={() => { onChange({key: 'maxWidth', value: null}); setShowMaxWidth(false); setMaxWidthPending(undefined); }}
                      showIcon={true}
                      unitIconClassName={css.sizeUnitIcon}
                      unitSelectStyle={SIZE_UNIT_SELECT_STYLE}
                    />
                  </Panel.Item>
                ) : (rightKey ? <div style={{ flex: 1 }} /> : null)}
                {rightKey === 'minHeight' ? (
                  <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 4, flex: 1 }}>
                    <div
                      {...getDragPropsMinHeight(minHeightEffective, '拖拽调整最小高度')}
                      style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                    >
                      <span className={css.tip} style={{ flexShrink: 0 }}>最小高</span>
                    </div>
                    <InputNumber
                      key={getUnitKey(minHeightEffective)}
                      style={{ flex: 1, minWidth: 0, marginLeft: 4 }}
                      defaultValue={minHeightEffective}
                      defaultUnitValue="px"
                      unitOptions={MIN_HEIGHT_UNIT_OPTIONS}
                      onChange={(val) => onChange({key: 'minHeight', value: val})}
                      onAction={() => { onChange({key: 'minHeight', value: null}); setShowMinHeight(false); setMinHeightPending(undefined); }}
                      showIcon={true}
                      unitIconClassName={css.sizeUnitIcon}
                      unitSelectStyle={SIZE_UNIT_SELECT_STYLE}
                    />
                  </Panel.Item>
                ) : rightKey === 'maxHeight' ? (
                  <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 4, flex: 1 }}>
                    <div
                      {...getDragPropsMaxHeight(maxHeightEffective, '拖拽调整最大高度')}
                      style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                    >
                      <span className={css.tip} style={{ flexShrink: 0 }}>最大高</span>
                    </div>
                    <InputNumber
                      key={getUnitKey(maxHeightEffective)}
                      style={{ flex: 1, minWidth: 0, marginLeft: 4 }}
                      defaultValue={maxHeightEffective}
                      defaultUnitValue="px"
                      unitOptions={MAX_HEIGHT_UNIT_OPTIONS}
                      onChange={(val) => onChange({key: 'maxHeight', value: val})}
                      onAction={() => { onChange({key: 'maxHeight', value: null}); setShowMaxHeight(false); setMaxHeightPending(undefined); }}
                      showIcon={true}
                      unitIconClassName={css.sizeUnitIcon}
                      unitSelectStyle={SIZE_UNIT_SELECT_STYLE}
                    />
                  </Panel.Item>
                ) : (leftKey ? <div style={{ flex: 1, marginLeft: 4 }} /> : null)}
              </Panel.Content>
            );
          })}
        </div>
    </Panel>
  );
}
