import React, {useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, CSSProperties} from "react";

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
  SketchPopup,
  VariableChip,
  VariableList,
  getApplyVariableOption,
  APPLY_VARIABLE_ACTION,
} from "../../components";
import { FixedWidth } from "../../icons/FixedWidth";
import { HugContents } from "../../icons/HugContents";
import { FillContainer } from "../../icons/FillContainer";
import { AddMin } from "../../icons/AddMin";
import { AddMax } from "../../icons/AddMax";
import { AspectRatioLock } from "../../icons/AspectRatioLock";
import { AspectRatioUnlock } from "../../icons/AspectRatioUnlock";
import { useDragNumber, useCanvasLengthVariables, isCssVarValue } from "../../hooks";
import { useStyleEditorContext } from "../../context";
import { resolveCssVarLength } from "../../../core/resolve-css-var-length";
import { formatLengthDisplay } from "../../utils";

import type {ChangeEvent, PanelBaseProps} from "../../type";
import css from './index.less'

/** 将当前实测尺寸换算为相对父级的百分比，避免直接拿 px 数字当 % */
function sizeToPercent(actualSize: number, parentSize: number): string {
  if (parentSize > 0 && actualSize >= 0) {
    return `${Math.max(1, Math.round((actualSize / parentSize) * 100))}%`;
  }
  return '50%';
}

/** 将百分比按父级尺寸换算为 px，避免 50% → 50px */
function percentToPx(percentVal: string, parentSize: number, fallbackPx: number): string {
  const pct = parseFloat(percentVal);
  if (!isNaN(pct) && parentSize > 0) {
    return `${Math.max(1, Math.round((pct / 100) * parentSize))}px`;
  }
  return `${Math.max(1, Math.round(fallbackPx) || 1)}px`;
}

const VIEWPORT_UNIT_RE = /^-?[\d.]+(?:vw|vh|vmin|vmax|dvw|dvh|svw|svh|lvw|lvh)$/i;

function isViewportSize(val: string | undefined): boolean {
  return !!val && VIEWPORT_UNIT_RE.test(val.trim());
}

/** vw/vh 等视口单位换算为实测 px，避免 InputNumber 把 100vw 显示成 100 */
function resolveViewportToPx(val: string | undefined, actualSize: number): string | undefined {
  if (!val || !isViewportSize(val)) return val;
  if (actualSize > 0) {
    return `${Math.max(0, Math.round(actualSize))}px`;
  }
  return val;
}

const BASE_UNIT_OPTIONS = [
  {label: "px", value: "px"},
  {label: "%", value: "%"},
  {label: "适应", value: "max-content"},
];
const MAX_MIN_UNIT_OPTIONS = [
  { label: 'px', value: 'px' },
  { label: '%', value: '%' },
];
const UNIT_DISABLED_LIST = ["max-content", "fit-content"];
const UNIT_DISPLAY_LABEL_MAP: Record<string, string> = {
  "max-content": "适应",
  "fit-content": "Hug",
};
const SIZE_DISABLED_TIP = "由布局自动控制，修改后将改为固定值";
const SIZE_UNIT_SELECT_STYLE: React.CSSProperties = {
  background: "transparent",
};
/** 尺寸面板不展示 px 文案，仅保留下拉箭头；% 等其他单位仍正常显示 */
const SIZE_UNIT_HIDE_LABEL_LIST = ['px'];
const SIZE_PROPERTY_KEYS = new Set([
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
]);

type SizeFieldKey = 'width' | 'height' | 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight';

const DETACH_VARIABLE_ACTION = 'detachVariable';

const CONSTRAINT_REMOVE_LABEL: Record<'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight', string> = {
  minWidth: '移除最小宽',
  maxWidth: '移除最大宽',
  minHeight: '移除最小高',
  maxHeight: '移除最大高',
};

/** 宽向字段取实测宽度兜底，高向字段取实测高度 */
function isWidthField(field: SizeFieldKey): boolean {
  return field === 'width' || field === 'minWidth' || field === 'maxWidth';
}

interface SizingModeBadgeProps {
  mode: 'hug' | 'fill';
  compactDisplay?: boolean;
  dimension: 'width' | 'height';
  actualSize: number;
  parentSize?: number;
  onChange: (value: string | null) => void;
  /** 用户显式选择 % 单位时置 true，避免换算成 100% 后被误判为「填满」 */
  onPreferPercent?: (prefer: boolean) => void;
  onAddMin?: () => void;
  onAddMax?: () => void;
  hasVariables?: boolean;
  onApplyVariable?: () => void;
}

function SizingModeBadge({ mode, compactDisplay = false, dimension, actualSize, parentSize = 0, onChange, onPreferPercent, onAddMin, onAddMax, hasVariables = false, onApplyVariable }: SizingModeBadgeProps) {
  const dim = dimension === 'width' ? 'width' : 'height';
  const options = [
    { label: `固定${dim === 'width' ? '宽度' : '高度'} (${actualSize}px)`, value: 'fixed', icon: <FixedWidth /> },
    { label: '%', value: '%' },
    { label: '适应内容',                          value: 'hug',   icon: <HugContents /> },
    { label: '填满父容器',                          value: 'fill',  icon: <FillContainer /> },
    { label: '', value: '__divider__', type: 'divider' as const },
    { label: `添加最小${dim === 'width' ? '宽度' : '高度'}...`, value: 'addMin', type: 'action' as const, icon: <AddMin />, iconSize: 'sm' as const },
    { label: `添加最大${dim === 'width' ? '宽度' : '高度'}...`, value: 'addMax', type: 'action' as const, icon: <AddMax />, iconSize: 'sm' as const },
    { label: '', value: '__variableDivider__', type: 'divider' as const },
    getApplyVariableOption(hasVariables),
  ];

  const handleClick = useCallback((val: string) => {
    if (val === 'fixed') {
      onPreferPercent?.(false);
      onChange(`${actualSize}px`);
    } else if (val === '%') {
      onPreferPercent?.(true);
      onChange(sizeToPercent(actualSize, parentSize));
    } else if (val === 'hug') {
      onPreferPercent?.(false);
      onChange('fit-content');
    } else if (val === 'fill') {
      onPreferPercent?.(false);
      onChange('100%');
    }
  }, [actualSize, parentSize, onChange, onPreferPercent]);

  const handleAction = useCallback((val: string) => {
    if (val === 'addMin') onAddMin?.();
    if (val === 'addMax') onAddMax?.();
    if (val === APPLY_VARIABLE_ACTION) onApplyVariable?.();
  }, [onAddMin, onAddMax, onApplyVariable]);

  return (
    <Dropdown value={mode} options={options} onClick={handleClick} onAction={handleAction}>
      <span className={compactDisplay ? css.defaultBadgeArrow : (mode === 'fill' ? css.fillBadge : css.hugBadge)} data-mybricks-tip="单位">
        {compactDisplay ? <DownOutlined /> : <>
          <span className={css.badgeLabel}>{mode === 'fill' ? '填满' : '适应'}</span>
          <span className={css.badgeArrow}><DownOutlined /></span>
        </>}
      </span>
    </Dropdown>
  );
}

interface DefaultModeBadgeProps {
  dimension: 'width' | 'height';
  actualSize: number;
  parentSize?: number;
  onChange: (value: string | null) => void;
  /** 用户显式选择 % 单位时置 true，避免换算成 100% 后被误判为「填满」 */
  onPreferPercent?: (prefer: boolean) => void;
  onAddMin?: () => void;
  onAddMax?: () => void;
  showAddMin?: boolean;
  showAddMax?: boolean;
  hasVariables?: boolean;
  onApplyVariable?: () => void;
}

/** 未配置宽/高：placeholder 显示「默认（N）」，右侧只保留下拉箭头 */
function DefaultModeBadge({
  dimension,
  actualSize,
  parentSize = 0,
  onChange,
  onPreferPercent,
  onAddMin,
  onAddMax,
  showAddMin = true,
  showAddMax = true,
  hasVariables = false,
  onApplyVariable,
}: DefaultModeBadgeProps) {
  const dimLabel = dimension === 'width' ? '宽度' : '高度';
  const options = useMemo(() => [
    { label: 'px', value: 'px' },
    { label: '%', value: '%' },
    { label: '适应内容', value: 'hug', type: 'action' as const, icon: <HugContents /> },
    { label: '填满父容器', value: 'fill', type: 'action' as const, icon: <FillContainer /> },
    ...((showAddMin || showAddMax) ? [{ label: '', value: '__divider__', type: 'divider' as const }] : []),
    ...(showAddMin ? [{ label: `添加最小${dimLabel}...`, value: 'addMin', type: 'action' as const, icon: <AddMin />, iconSize: 'sm' as const }] : []),
    ...(showAddMax ? [{ label: `添加最大${dimLabel}...`, value: 'addMax', type: 'action' as const, icon: <AddMax />, iconSize: 'sm' as const }] : []),
    { label: '', value: '__variableDivider__', type: 'divider' as const },
    getApplyVariableOption(hasVariables),
  ], [dimension, dimLabel, showAddMin, showAddMax, hasVariables]);

  const handleClick = useCallback((val: string) => {
    if (val === 'px') {
      onPreferPercent?.(false);
      onChange(`${Math.max(0, actualSize)}px`);
    } else if (val === '%') {
      onPreferPercent?.(true);
      onChange(sizeToPercent(actualSize, parentSize));
    }
  }, [actualSize, parentSize, onChange, onPreferPercent]);

  const handleAction = useCallback((val: string) => {
    if (val === 'hug') {
      onPreferPercent?.(false);
      onChange('fit-content');
    } else if (val === 'fill') {
      onPreferPercent?.(false);
      onChange('100%');
    } else if (val === 'addMin') onAddMin?.();
    else if (val === 'addMax') onAddMax?.();
    else if (val === APPLY_VARIABLE_ACTION) onApplyVariable?.();
  }, [onChange, onPreferPercent, onAddMin, onAddMax, onApplyVariable]);

  return (
    <Dropdown value="default" options={options} onClick={handleClick} onAction={handleAction}>
      <span className={css.defaultBadgeArrow} data-mybricks-tip="单位">
        <DownOutlined />
      </span>
    </Dropdown>
  );
}

/** 归一化尺寸值：auto / inherit / default / 未配置 → undefined。fit-content 保留原值，用于区分"显式 Hug"与"未配置" */
function normalizeSizeValue(val: any): string | undefined {
  if (!val || val === 'auto' || val === 'inherit' || val === 'default') return undefined;
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

export function Size({value, onChange: rawOnChange, config, showTitle, collapse}: SizeProps) {
  const [cfg] = useState({...DEFAULT_CONFIG, ...config});

  // const hasInitWidthHeight = !!normalizeSizeValue(value.width) || !!normalizeSizeValue(value.height);

  const [showWidthHeight, setShowWidthHeight] = useState(true);
  // 最大/最小宽高各自独立显示：只配置了最小高时，不展示空的最小宽
  const [showMaxWidth, setShowMaxWidth] = useState(() => !!normalizeSizeValue(value.maxWidth));
  const [showMinWidth, setShowMinWidth] = useState(() => !!normalizeSizeValue(value.minWidth));
  const [showMaxHeight, setShowMaxHeight] = useState(() => !!normalizeSizeValue(value.maxHeight));
  const [showMinHeight, setShowMinHeight] = useState(() => !!normalizeSizeValue(value.minHeight));

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

  // 有「弹性」面板时（父为 flex 子项），尺寸恢复顶部分割线；否则与布局合并视觉分组
  const hideSizeTopBorder = useMemo(() => {
    if (!targetDom) return true;
    const selfPos = window.getComputedStyle(targetDom).position;
    if (selfPos === 'absolute' || selfPos === 'fixed') return true;
    const parent = targetDom.parentElement;
    if (!parent) return true;
    const display = window.getComputedStyle(parent).display;
    return !(display === 'flex' || display === 'inline-flex');
  }, [targetDom]);

  // 切换选中元素时，按实际配置重置显示（避免上一元素的空「未配置」残留）
  useEffect(() => {
    setShowMaxWidth(!!normalizeSizeValue(value.maxWidth));
    setShowMinWidth(!!normalizeSizeValue(value.minWidth));
    setShowMaxHeight(!!normalizeSizeValue(value.maxHeight));
    setShowMinHeight(!!normalizeSizeValue(value.minHeight));
  }, [targetDom]);

  // 外部写入了具体值时自动展开对应项（用户通过 + 展开的空项不受影响）
  useEffect(() => {
    if (normalizeSizeValue(value.maxWidth)) setShowMaxWidth(true);
  }, [value.maxWidth]);
  useEffect(() => {
    if (normalizeSizeValue(value.minWidth)) setShowMinWidth(true);
  }, [value.minWidth]);
  useEffect(() => {
    if (normalizeSizeValue(value.maxHeight)) setShowMaxHeight(true);
  }, [value.maxHeight]);
  useEffect(() => {
    if (normalizeSizeValue(value.minHeight)) setShowMinHeight(true);
  }, [value.minHeight]);
  const onChange: ChangeEvent = useCallback((change) => {
    const changes = Array.isArray(change) ? change : [change];
    const changesToFixedSize = changes.some(
      ({ key, value }) => SIZE_PROPERTY_KEYS.has(key) && value !== null && value !== undefined,
    );
    const isInline = targetDom && window.getComputedStyle(targetDom).display === 'inline';

    if (changesToFixedSize && isInline && !changes.some(({ key }) => key === 'display')) {
      rawOnChange([...changes, { key: 'display', value: 'block' }]);
      return;
    }

    rawOnChange(change);
  }, [rawOnChange, targetDom]);

  const [actualWidth, setActualWidth] = useState<number>(0);
  const [actualHeight, setActualHeight] = useState<number>(0);

  const actualWidthRef = useRef(0);
  const actualHeightRef = useRef(0);
  const targetDomRef = useRef<HTMLElement | null>(null);
  actualWidthRef.current = actualWidth;
  actualHeightRef.current = actualHeight;
  targetDomRef.current = targetDom;

  // 选中目标切换时先测量，避免首帧沿用上一组件的默认宽高。
  useLayoutEffect(() => {
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
      // if (w > 0 || h > 0) {
      //   setShowWidthHeight(true);
      // }
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
    // setShowWidthHeight(false);
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
    setWidthPreferPercent(false);
    setHeightPreferPercent(false);
  }, [onChange]);

  const isDraggingWidth = useRef(false);
  const isDraggingHeight = useRef(false);

  /** undefined=无覆盖；null=乐观清空（勿用 ?? 回退到旧 value，否则清空回车无法立即显示默认态） */
  const [widthPending, setWidthPending] = useState<string | null | undefined>();
  const [heightPending, setHeightPending] = useState<string | null | undefined>();
  const [maxWidthPending, setMaxWidthPending] = useState<string | null | undefined>();
  const [minWidthPending, setMinWidthPending] = useState<string | null | undefined>();
  const [maxHeightPending, setMaxHeightPending] = useState<string | null | undefined>();
  const [minHeightPending, setMinHeightPending] = useState<string | null | undefined>();
  // 用户显式选了 % 单位：即使换算结果是 100% 也按百分比展示，不落入「填满」
  const [widthPreferPercent, setWidthPreferPercent] = useState(false);
  const [heightPreferPercent, setHeightPreferPercent] = useState(false);

  useEffect(() => {
    setWidthPreferPercent(false);
    setHeightPreferPercent(false);
    setWidthPending(undefined);
    setHeightPending(undefined);
    setMaxWidthPending(undefined);
    setMinWidthPending(undefined);
    setMaxHeightPending(undefined);
    setMinHeightPending(undefined);
  }, [targetDom]);

  // 乐观 pending 仅在外部 value 追上时解除：
  // - pending=null（清空）：外部也未配置才解除，避免删属性未回传时被旧值盖回
  // - pending=具体值：外部等于 pending 后解除
  useEffect(() => {
    if (widthPending === undefined) return;
    const external = normalizeSizeValue(value.width);
    if (widthPending === null) {
      if (!external) setWidthPending(undefined);
      return;
    }
    if (normalizeSizeValue(widthPending) === external) setWidthPending(undefined);
  }, [value.width]);
  useEffect(() => {
    if (heightPending === undefined) return;
    const external = normalizeSizeValue(value.height);
    if (heightPending === null) {
      if (!external) setHeightPending(undefined);
      return;
    }
    if (normalizeSizeValue(heightPending) === external) setHeightPending(undefined);
  }, [value.height]);
  useEffect(() => {
    if (maxWidthPending === undefined) return;
    const external = normalizeSizeValue(value.maxWidth);
    if (maxWidthPending === null) {
      if (!external) setMaxWidthPending(undefined);
      return;
    }
    if (normalizeSizeValue(maxWidthPending) === external) setMaxWidthPending(undefined);
  }, [value.maxWidth]);
  useEffect(() => {
    if (minWidthPending === undefined) return;
    const external = normalizeSizeValue(value.minWidth);
    if (minWidthPending === null) {
      if (!external) setMinWidthPending(undefined);
      return;
    }
    if (normalizeSizeValue(minWidthPending) === external) setMinWidthPending(undefined);
  }, [value.minWidth]);
  useEffect(() => {
    if (maxHeightPending === undefined) return;
    const external = normalizeSizeValue(value.maxHeight);
    if (maxHeightPending === null) {
      if (!external) setMaxHeightPending(undefined);
      return;
    }
    if (normalizeSizeValue(maxHeightPending) === external) setMaxHeightPending(undefined);
  }, [value.maxHeight]);
  useEffect(() => {
    if (minHeightPending === undefined) return;
    const external = normalizeSizeValue(value.minHeight);
    if (minHeightPending === null) {
      if (!external) setMinHeightPending(undefined);
      return;
    }
    if (normalizeSizeValue(minHeightPending) === external) setMinHeightPending(undefined);
  }, [value.minHeight]);

  const widthEffective = normalizeSizeValue(widthPending !== undefined ? widthPending : value.width);
  const heightEffective = normalizeSizeValue(heightPending !== undefined ? heightPending : value.height);
  // 首帧同步读 offset，避免等 ResizeObserver 才把 100vw 换成 px
  const measuredWidth = targetDom?.offsetWidth || actualWidth;
  const measuredHeight = targetDom?.offsetHeight || actualHeight;
  const widthResolved = resolveViewportToPx(widthEffective, measuredWidth);
  const heightResolved = resolveViewportToPx(heightEffective, measuredHeight);
  const maxWidthEffective = normalizeSizeValue(maxWidthPending !== undefined ? maxWidthPending : value.maxWidth);

  // Fill 仅对应「填满父容器」写入的 100%；用户显式选 %（含换算成 100%）走普通 % 单位展示
  const isWidthFill = !!(widthEffective?.includes('%') && parseFloat(widthEffective) === 100 && actualWidth > 0 && !widthPreferPercent);
  const isHeightFill = !!(heightEffective?.includes('%') && parseFloat(heightEffective) === 100 && actualHeight > 0 && !heightPreferPercent);
  const isWidthDefault = !isWidthFill && widthEffective !== 'fit-content' && !widthEffective;
  const isHeightDefault = !isHeightFill && heightEffective !== 'fit-content' && !heightEffective;
  const widthDefaultPx = actualWidth > 0 ? Math.round(actualWidth) : null;
  const heightDefaultPx = actualHeight > 0 ? Math.round(actualHeight) : null;

  // 宽高比跟踪：px 用配置值；填满/%/适应/未配置用 DOM 实测值，避免比例停在初始 1
  const widthPxVal = useMemo(() => {
    if (widthEffective?.endsWith('px')) {
      const n = parseFloat(widthEffective);
      if (!isNaN(n)) return n;
    }
    return actualWidth > 0 ? actualWidth : 0;
  }, [widthEffective, actualWidth]);

  const heightPxVal = useMemo(() => {
    if (heightEffective?.endsWith('px')) {
      const n = parseFloat(heightEffective);
      if (!isNaN(n)) return n;
    }
    return actualHeight > 0 ? actualHeight : 0;
  }, [heightEffective, actualHeight]);

  useEffect(() => {
    if (!locked && widthPxVal > 0 && heightPxVal > 0) {
      ratioRef.current = heightPxVal / widthPxVal;
    }
  }, [locked, widthPxVal, heightPxVal]);
  const minWidthEffective = normalizeSizeValue(minWidthPending !== undefined ? minWidthPending : value.minWidth);
  const maxHeightEffective = normalizeSizeValue(maxHeightPending !== undefined ? maxHeightPending : value.maxHeight);
  const minHeightEffective = normalizeSizeValue(minHeightPending !== undefined ? minHeightPending : value.minHeight);

  const { variableOptions: lengthVariables } = useCanvasLengthVariables();
  const hasLengthVariables = lengthVariables.length > 0;
  /** 正在为哪个字段挑选变量；null 表示弹层关闭。整个面板只有这一个变量弹层 */
  const [variablePickerField, setVariablePickerField] = useState<SizeFieldKey | null>(null);
  const [variablePickerMounted, setVariablePickerMounted] = useState(false);
  const sizeRowsRef = useRef<HTMLDivElement>(null);
  /** 各字段所在行的锚点，打开弹层时对齐到该行 */
  const fieldAnchors = useRef<Partial<Record<SizeFieldKey, HTMLElement | null>>>({});
  const variablePickerAnchorRef = useRef<HTMLElement | null>(null);
  const setFieldAnchor = useCallback((field: SizeFieldKey) => (el: HTMLDivElement | null) => {
    fieldAnchors.current[field] = el;
  }, []);

  const widthVarRef = isCssVarValue(widthEffective) ? widthEffective : undefined;
  const heightVarRef = isCssVarValue(heightEffective) ? heightEffective : undefined;
  const minWidthVarRef = isCssVarValue(minWidthEffective) ? minWidthEffective : undefined;
  const maxWidthVarRef = isCssVarValue(maxWidthEffective) ? maxWidthEffective : undefined;
  const minHeightVarRef = isCssVarValue(minHeightEffective) ? minHeightEffective : undefined;
  const maxHeightVarRef = isCssVarValue(maxHeightEffective) ? maxHeightEffective : undefined;

  const boundVarRefs = useMemo<Partial<Record<SizeFieldKey, string>>>(() => ({
    width: widthVarRef,
    height: heightVarRef,
    minWidth: minWidthVarRef,
    maxWidth: maxWidthVarRef,
    minHeight: minHeightVarRef,
    maxHeight: maxHeightVarRef,
  }), [widthVarRef, heightVarRef, minWidthVarRef, maxWidthVarRef, minHeightVarRef, maxHeightVarRef]);

  /** 变量解析成具体长度，用于胶囊提示与「固定值」文案 */
  const resolvedVarLengths = useMemo(() => {
    const resolved: Partial<Record<SizeFieldKey, string | null>> = {};
    (Object.keys(boundVarRefs) as SizeFieldKey[]).forEach((field) => {
      const varRef = boundVarRefs[field];
      if (varRef) resolved[field] = resolveCssVarLength(varRef, targetDom);
    });
    return resolved;
  }, [boundVarRefs, targetDom]);

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
      if (lockedRef.current && !heightVarRef && ratioRef.current > 0) {
        const newH = Math.max(1, Math.round(finalValue * ratioRef.current));
        const newHVal = `${newH}px`;
        const updates: any[] = [
          { key: 'width', value: newVal },
          { key: 'height', value: newHVal },
        ];
        if (cfg.disableWidth) {
          updates.push({ key: 'flex', value: null });
          updates.push({ key: 'flexGrow', value: null });
          updates.push({ key: 'flexShrink', value: null });
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
          { key: 'flexShrink', value: null },
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
      if (lockedRef.current && !widthVarRef && ratioRef.current > 0) {
        const newW = Math.max(1, Math.round(finalValue / ratioRef.current));
        const newWVal = `${newW}px`;
        const updates: any[] = [
          { key: 'width', value: newWVal },
          { key: 'height', value: newVal },
        ];
        if (cfg.disableHeight) {
          updates.push({ key: 'flex', value: null });
          updates.push({ key: 'flexGrow', value: null });
          updates.push({ key: 'flexShrink', value: null });
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
          { key: 'flexShrink', value: null },
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


  const handleWidthChange = useCallback((val: string | null) => {
    let realVal: string | null = val === 'default' || val == null ? null : val;
    const rawPrevWidth = normalizeSizeValue(widthPending !== undefined ? widthPending : value.width);
    const prevWidth = resolveViewportToPx(rawPrevWidth, targetDomRef.current?.offsetWidth || actualWidthRef.current);
    const parentW = targetDomRef.current?.parentElement?.clientWidth ?? 0;
    if (realVal === null || realVal === 'fit-content' || realVal?.endsWith('px')) {
      setWidthPreferPercent(false);
    }
    // 未配置时切到具体单位：数字为 0 则用实测尺寸填充（对齐 Font 行高）；用户输入 >0 原样采用
    if (!prevWidth && realVal && (realVal.endsWith('px') || realVal.endsWith('%'))) {
      const num = parseFloat(realVal);
      if (!isNaN(num) && num === 0) {
        const actual = actualWidthRef.current;
        if (realVal.endsWith('%')) {
          realVal = sizeToPercent(actual, parentW);
          setWidthPreferPercent(true);
        } else {
          realVal = `${Math.max(0, Math.round(actual))}px`;
        }
        setWidthLockKey(k => k + 1);
      }
    }
    // px → %：按相对父级换算（InputNumber 默认会沿用同一数字，如 162px → 162%）
    if (realVal?.endsWith('%') && prevWidth?.endsWith('px')) {
      realVal = sizeToPercent(parseFloat(prevWidth), parentW);
      setWidthPreferPercent(true);
      setWidthLockKey(k => k + 1);
    } else if (realVal?.endsWith('%')) {
      // 已是 % 或从其它状态切到 %：按百分比单位展示
      setWidthPreferPercent(true);
    }
    // % → px：仅单位切换（数字未变，如 50%→50px）时按父级反算；
    // 填满(100%)下用户新输入 11px 时数字已变，应直接采用，勿覆盖成父级宽度。
    if (realVal?.endsWith('px') && prevWidth?.endsWith('%')) {
      const incomingNum = parseFloat(realVal);
      const prevNum = parseFloat(prevWidth);
      if (!isNaN(incomingNum) && !isNaN(prevNum) && incomingNum === prevNum) {
        realVal = percentToPx(prevWidth, parentW, actualWidthRef.current);
        setWidthLockKey(k => k + 1);
      }
    }
    // 高度绑定了变量时不做等比联动，避免覆盖用户的变量绑定
    if (locked && !heightVarRef && ratioRef.current > 0 && realVal) {
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
          updates.push({ key: 'flexShrink', value: null });
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
        { key: 'flexShrink', value: null },
        { key: 'flexBasis', value: null },
      ]);
    } else {
      onChange({ key: 'width', value: realVal });
    }
    // null 表示乐观清空，保留 pending 覆盖，避免回退到尚未更新的 value.width
    if (!isDraggingWidth.current) setWidthPending(realVal);
  }, [onChange, cfg.disableWidth, locked, value.width, widthPending, heightVarRef]);

  const handleHeightChange = useCallback((val: string | null) => {
    let realVal: string | null = val === 'default' || val == null ? null : val;
    const rawPrevHeight = normalizeSizeValue(heightPending !== undefined ? heightPending : value.height);
    const prevHeight = resolveViewportToPx(rawPrevHeight, targetDomRef.current?.offsetHeight || actualHeightRef.current);
    const parentH = targetDomRef.current?.parentElement?.clientHeight ?? 0;
    if (realVal === null || realVal === 'fit-content' || realVal?.endsWith('px')) {
      setHeightPreferPercent(false);
    }
    // 未配置时切到具体单位：数字为 0 则用实测尺寸填充（对齐 Font 行高）；用户输入 >0 原样采用
    if (!prevHeight && realVal && (realVal.endsWith('px') || realVal.endsWith('%'))) {
      const num = parseFloat(realVal);
      if (!isNaN(num) && num === 0) {
        const actual = actualHeightRef.current;
        if (realVal.endsWith('%')) {
          realVal = sizeToPercent(actual, parentH);
          setHeightPreferPercent(true);
        } else {
          realVal = `${Math.max(0, Math.round(actual))}px`;
        }
        setHeightLockKey(k => k + 1);
      }
    }
    // px → %：按相对父级换算
    if (realVal?.endsWith('%') && prevHeight?.endsWith('px')) {
      realVal = sizeToPercent(parseFloat(prevHeight), parentH);
      setHeightPreferPercent(true);
      setHeightLockKey(k => k + 1);
    } else if (realVal?.endsWith('%')) {
      // 已是 % 或从其它状态切到 %：按百分比单位展示
      setHeightPreferPercent(true);
    }
    // % → px：仅单位切换（数字未变）时按父级反算；用户新输入不同数字则直接采用。
    if (realVal?.endsWith('px') && prevHeight?.endsWith('%')) {
      const incomingNum = parseFloat(realVal);
      const prevNum = parseFloat(prevHeight);
      if (!isNaN(incomingNum) && !isNaN(prevNum) && incomingNum === prevNum) {
        realVal = percentToPx(prevHeight, parentH, actualHeightRef.current);
        setHeightLockKey(k => k + 1);
      }
    }
    // 宽度绑定了变量时不做等比联动，避免覆盖用户的变量绑定
    if (locked && !widthVarRef && ratioRef.current > 0 && realVal) {
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
          updates.push({ key: 'flexShrink', value: null });
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
        { key: 'flexShrink', value: null },
        { key: 'flexBasis', value: null },
      ]);
    } else {
      onChange({ key: 'height', value: realVal });
    }
    // null 表示乐观清空，保留 pending 覆盖，避免回退到尚未更新的 value.height
    if (!isDraggingHeight.current) setHeightPending(realVal);
  }, [onChange, cfg.disableHeight, locked, value.height, heightPending, widthVarRef]);

  const constraintPendingSetters = useMemo(() => ({
    minWidth: setMinWidthPending,
    maxWidth: setMaxWidthPending,
    minHeight: setMinHeightPending,
    maxHeight: setMaxHeightPending,
  }), []);

  /** 适应内容 / 填满父容器：100% 需保持 preferPercent=false，才会显示成「填满」而非 % */
  const applySizingMode = useCallback((field: 'width' | 'height', mode: 'hug' | 'fill') => {
    const val = mode === 'hug' ? 'fit-content' : '100%';
    if (field === 'width') {
      setWidthPreferPercent(false);
      setWidthPending(val);
    } else {
      setHeightPreferPercent(false);
      setHeightPending(val);
    }
    onChange({ key: field, value: val });
  }, [onChange]);

  const removeConstraint = useCallback((field: 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight') => {
    onChange({ key: field, value: null });
    constraintPendingSetters[field](undefined);
    if (field === 'minWidth') setShowMinWidth(false);
    else if (field === 'maxWidth') setShowMaxWidth(false);
    else if (field === 'minHeight') setShowMinHeight(false);
    else setShowMaxHeight(false);
  }, [onChange, constraintPendingSetters]);

  /** 统一写入尺寸：宽/高复用带单位换算的处理函数，约束字段直写 */
  const writeSizeValue = useCallback((field: SizeFieldKey, val: string) => {
    if (field === 'width') {
      handleWidthChange(val);
      return;
    }
    if (field === 'height') {
      handleHeightChange(val);
      return;
    }
    constraintPendingSetters[field](val);
    onChange({ key: field, value: val });
  }, [handleWidthChange, handleHeightChange, constraintPendingSetters, onChange]);

  const openVariablePicker = useCallback((field: SizeFieldKey) => {
    if (!hasLengthVariables) return;
    variablePickerAnchorRef.current = fieldAnchors.current[field] ?? sizeRowsRef.current;
    setVariablePickerMounted(true);
    setVariablePickerField(field);
  }, [hasLengthVariables]);

  const closeVariablePicker = useCallback(() => setVariablePickerField(null), []);

  /** 解绑变量：落成变量当前解析值，解析不到时退回实测尺寸 */
  const detachVariable = useCallback((field: SizeFieldKey) => {
    const measured = isWidthField(field) ? actualWidthRef.current : actualHeightRef.current;
    writeSizeValue(field, resolvedVarLengths[field] || `${Math.max(0, Math.round(measured))}px`);
  }, [resolvedVarLengths, writeSizeValue]);

  /** 变量胶囊右侧下拉：解绑 + 该字段原有的快捷模式 */
  const getVariableMenuOptions = useCallback((field: SizeFieldKey) => {
    const measured = Math.round(isWidthField(field) ? actualWidth : actualHeight);
    const options: Array<{ label: string; value: string; type?: 'action' | 'divider'; icon?: React.ReactNode; iconSize?: 'sm' | 'md' }> = [
      {
        label: `固定值 (${resolvedVarLengths[field] || `${measured}px`})`,
        value: DETACH_VARIABLE_ACTION,
        type: 'action',
        icon: <FixedWidth />,
      },
    ];
    if (field === 'width' || field === 'height') {
      options.push(
        { label: '适应内容', value: 'hug', type: 'action', icon: <HugContents /> },
        { label: '填满父容器', value: 'fill', type: 'action', icon: <FillContainer /> },
      );
    } else {
      options.push({ label: CONSTRAINT_REMOVE_LABEL[field], value: 'remove', type: 'action' });
    }
    return options;
  }, [actualWidth, actualHeight, resolvedVarLengths]);

  const handleVariableMenuAction = useCallback((field: SizeFieldKey, action: string) => {
    if (action === DETACH_VARIABLE_ACTION) {
      detachVariable(field);
    } else if (action === 'hug' || action === 'fill') {
      applySizingMode(field as 'width' | 'height', action);
    } else if (action === 'remove') {
      removeConstraint(field as 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight');
    }
  }, [detachVariable, applySizingMode, removeConstraint]);

  /**
   * 变量态的拖拽：从变量当前值起步，一动就落成 px 数值（即自动解绑），
   * 与 Figma 一致。六个字段共用一个 hook 实例，靠 ref 记住拖的是谁。
   */
  const draggingVarFieldRef = useRef<SizeFieldKey | null>(null);
  const varDragStartValueRef = useRef(0);
  const getDragPropsVariable = useDragNumber({
    onDragStart: (currentValue) => {
      const parsed = parseFloat(currentValue);
      const startValue = isNaN(parsed) ? 0 : Math.round(parsed);
      varDragStartValueRef.current = startValue;
      return startValue;
    },
    onDragChange: (val: number) => {
      const field = draggingVarFieldRef.current;
      if (field && val !== varDragStartValueRef.current) writeSizeValue(field, `${val}px`);
    },
    onDragEnd: (finalValue: number) => {
      const field = draggingVarFieldRef.current;
      draggingVarFieldRef.current = null;
      // 只点击不拖动时值没变，保持变量绑定不动
      if (field && finalValue !== varDragStartValueRef.current) writeSizeValue(field, `${finalValue}px`);
    },
  });

  const getVariableDragProps = useCallback((field: SizeFieldKey, tip: string) => {
    const measured = Math.round(isWidthField(field) ? actualWidthRef.current : actualHeightRef.current);
    // calc() 等无法直接取数的变量值，退回实测尺寸作为起点
    const resolved = resolvedVarLengths[field];
    const startValue = resolved && !isNaN(parseFloat(resolved)) ? resolved : `${Math.max(0, measured)}px`;
    const { onMouseDown, ...rest } = getDragPropsVariable(startValue, tip);
    return {
      ...rest,
      onMouseDown: (e: React.MouseEvent) => {
        draggingVarFieldRef.current = field;
        onMouseDown(e);
      },
    };
  }, [getDragPropsVariable, resolvedVarLengths]);

  /** 变量态的行：胶囊替代输入框，公共参数一次收敛 */
  const renderVariableChip = useCallback((field: SizeFieldKey, varRef: string) => (
    <VariableChip
      value={varRef}
      resolvedValue={resolvedVarLengths[field]}
      display={formatLengthDisplay(resolvedVarLengths[field])}
      onRequestPicker={() => openVariablePicker(field)}
      menuOptions={getVariableMenuOptions(field)}
      onMenuAction={(action) => handleVariableMenuAction(field, action)}
      onInputValue={(val) => writeSizeValue(field, val)}
      onDetach={() => detachVariable(field)}
      // flex-basis 显式为 0：胶囊与输入区都不能把列宽撑开，否则会挤掉相邻的高度列
      style={{ flex: '1 1 0', minWidth: 0, width: 0, marginLeft: 4 }}
    />
  ), [resolvedVarLengths, openVariablePicker, writeSizeValue, getVariableMenuOptions, handleVariableMenuAction, detachVariable]);

  const widthUnitOptions = useMemo(() => [
    ...BASE_UNIT_OPTIONS.filter(o => o.value !== 'max-content'),
    { label: '适应内容', value: 'hug', type: 'action' as const, icon: <HugContents /> },
    { label: '填满父容器', value: 'fill', type: 'action' as const, icon: <FillContainer /> },
    ...(!showMinWidth || !showMaxWidth ? [{ label: '', value: '__divider__', type: 'divider' as const }] : []),
    ...(!showMinWidth ? [{ label: '添加最小宽度...', value: 'addMinWidth', type: 'action' as const, icon: <AddMin />, iconSize: 'sm' as const }] : []),
    ...(!showMaxWidth ? [{ label: '添加最大宽度...', value: 'addMaxWidth', type: 'action' as const, icon: <AddMax />, iconSize: 'sm' as const }] : []),
    { label: '', value: '__variableDivider__', type: 'divider' as const },
    getApplyVariableOption(hasLengthVariables),
  ], [showMinWidth, showMaxWidth, hasLengthVariables]);

  const heightUnitOptions = useMemo(() => [
    ...BASE_UNIT_OPTIONS.filter(o => o.value !== 'max-content'),
    { label: '适应内容', value: 'hug', type: 'action' as const, icon: <HugContents /> },
    { label: '填满父容器', value: 'fill', type: 'action' as const, icon: <FillContainer /> },
    ...(!showMinHeight || !showMaxHeight ? [{ label: '', value: '__divider__', type: 'divider' as const }] : []),
    ...(!showMinHeight ? [{ label: '添加最小高度...', value: 'addMinHeight', type: 'action' as const, icon: <AddMin />, iconSize: 'sm' as const }] : []),
    ...(!showMaxHeight ? [{ label: '添加最大高度...', value: 'addMaxHeight', type: 'action' as const, icon: <AddMax />, iconSize: 'sm' as const }] : []),
    { label: '', value: '__variableDivider__', type: 'divider' as const },
    getApplyVariableOption(hasLengthVariables),
  ], [showMinHeight, showMaxHeight, hasLengthVariables]);

  /** 最小/最大宽高的单位菜单：px/% + 应用变量 + 移除 */
  const constraintUnitOptions = useMemo(() => {
    const build = (field: 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight') => [
      ...MAX_MIN_UNIT_OPTIONS,
      { label: '', value: '__divider__', type: 'divider' as const },
      { label: CONSTRAINT_REMOVE_LABEL[field], value: 'remove', type: 'action' as const },
      { label: '', value: '__variableDivider__', type: 'divider' as const },
      getApplyVariableOption(hasLengthVariables),
    ];
    return {
      minWidth: build('minWidth'),
      maxWidth: build('maxWidth'),
      minHeight: build('minHeight'),
      maxHeight: build('maxHeight'),
    };
  }, [hasLengthVariables]);

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

  const parentWidth = targetDom?.parentElement?.clientWidth ?? 0;
  const parentHeight = targetDom?.parentElement?.clientHeight ?? 0;

  return (
    <Panel
      title="尺寸"
      showTitle={showTitle}
      showReset={true}
      resetFunction={refresh}
      collapse={allHidden ? true : false}
      showDelete={false}
      hideTopBorder={hideSizeTopBorder}
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
                onClick={() => setLocked(v => {
                  const next = !v;
                  // 锁定瞬间按当前视觉尺寸固化比例（填满/% 也要用实测宽高）
                  if (next) {
                    const w = actualWidthRef.current || widthPxVal;
                    const h = actualHeightRef.current || heightPxVal;
                    if (w > 0 && h > 0) ratioRef.current = h / w;
                  }
                  return next;
                })}
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
      <div className={css.sizeRows} ref={sizeRowsRef}>
          {showWidthHeight && (
            <Panel.Content style={{ position: 'relative' }}>
              <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 4, minWidth: 0 }}>
                <div
                  ref={setFieldAnchor('width')}
                  {...(widthVarRef
                    ? getVariableDragProps('width', '拖拽调整宽度（将解除变量绑定）')
                    : getDragPropsWidth(widthResolved ?? (actualWidth > 0 ? `${Math.round(actualWidth)}px` : undefined), cfg.disableWidth ? '由布局自动控制，修改后将改为固定值' : '拖拽调整宽度'))}
                  style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                >
                  <span className={css.tip} style={{ flexShrink: 0}}>宽度</span>
                </div>
                <div ref={widthInputWrapRef} style={{ flex: 1, minWidth: 0, display: 'contents' }}>
                  {widthVarRef ? renderVariableChip('width', widthVarRef) : (
                  <InputNumber
                    key={`${isWidthFill ? 'fill-w' : (widthEffective === 'fit-content' ? 'hug-w' : (isWidthDefault ? 'default-w' : getUnitKey(widthResolved)))}-wlk${widthLockKey}`}
                    style={{ flex: 1, minWidth: 0, marginLeft: 4 }}
                    {...(isWidthFill || isWidthDefault ? { value: null as any } : {})}
                    defaultValue={
                      isWidthFill || isWidthDefault
                        ? undefined
                        : (widthEffective === 'fit-content'
                            ? (actualWidth > 0 ? `${Math.round(actualWidth)}px` : undefined)
                            : widthResolved)
                    }
                    defaultUnitValue="px"
                    unitOptions={widthUnitOptions}
                    unitDisabledList={UNIT_DISABLED_LIST}
                    unitDisplayLabelMap={UNIT_DISPLAY_LABEL_MAP}
                    placeholder={
                      isWidthFill
                        ? (widthDefaultPx != null ? `填满(${widthDefaultPx})` : '填满')
                        : isWidthDefault
                          ? (widthDefaultPx != null ? `默认(${widthDefaultPx})` : '默认')
                          : ''
                    }
                    onChange={handleWidthChange}
                    onAction={(val) => {
                      if (val === 'hug' || val === 'fill') applySizingMode('width', val);
                      else if (val === 'addMinWidth') { setShowMinWidth(true); setShowWidthHeight(true); }
                      else if (val === 'addMaxWidth') { setShowMaxWidth(true); setShowWidthHeight(true); }
                      else if (val === APPLY_VARIABLE_ACTION) openVariablePicker('width');
                    }}
                    showIcon={true}
                    showIconOnHover
                    unitIconClassName={css.sizeUnitIcon}
                    unitSelectStyle={SIZE_UNIT_SELECT_STYLE}
                    unitHideLabelList={SIZE_UNIT_HIDE_LABEL_LIST}
                    tip={
                      cfg.disableWidth
                        ? SIZE_DISABLED_TIP
                        : isWidthFill && widthDefaultPx != null
                          ? `当前宽度填满父容器，${widthDefaultPx}为计算值`
                          : isWidthDefault && widthDefaultPx != null
                            ? `未配置宽度，${widthDefaultPx}为计算值`
                            : undefined
                    }
                    badge={
                      isWidthFill ? (
                        <SizingModeBadge
                          mode="fill"
                          compactDisplay
                          dimension="width"
                          actualSize={Math.round(actualWidth)}
                          parentSize={parentWidth}
                          onPreferPercent={setWidthPreferPercent}
                          onChange={(v) => { setWidthPending(v ?? 'auto'); onChange({ key: 'width', value: v }); }}
                          onAddMin={() => { setShowMinWidth(true); setShowWidthHeight(true); }}
                          onAddMax={() => { setShowMaxWidth(true); setShowWidthHeight(true); }}
                          hasVariables={hasLengthVariables}
                          onApplyVariable={() => openVariablePicker('width')}
                        />
                      ) : (widthEffective === 'fit-content') ? (
                        <SizingModeBadge
                          mode="hug"
                          dimension="width"
                          actualSize={Math.round(actualWidth)}
                          parentSize={parentWidth}
                          onPreferPercent={setWidthPreferPercent}
                          onChange={(v) => { setWidthPending(v); onChange({ key: 'width', value: v }); }}
                          onAddMin={() => { setShowMinWidth(true); setShowWidthHeight(true); }}
                          onAddMax={() => { setShowMaxWidth(true); setShowWidthHeight(true); }}
                          hasVariables={hasLengthVariables}
                          onApplyVariable={() => openVariablePicker('width')}
                        />
                      ) : isWidthDefault ? (
                        <DefaultModeBadge
                          dimension="width"
                          actualSize={Math.round(actualWidth)}
                          parentSize={parentWidth}
                          onPreferPercent={setWidthPreferPercent}
                          onChange={(v) => { setWidthPending(v); onChange({ key: 'width', value: v }); }}
                          onAddMin={() => { setShowMinWidth(true); setShowWidthHeight(true); }}
                          onAddMax={() => { setShowMaxWidth(true); setShowWidthHeight(true); }}
                          showAddMin={!showMinWidth}
                          showAddMax={!showMaxWidth}
                          hasVariables={hasLengthVariables}
                          onApplyVariable={() => openVariablePicker('width')}
                        />
                      ) : undefined
                    }
                  />
                  )}
                </div>
              </Panel.Item>
              <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 4, minWidth: 0 }}>
                <div
                  ref={setFieldAnchor('height')}
                  {...(heightVarRef
                    ? getVariableDragProps('height', '拖拽调整高度（将解除变量绑定）')
                    : getDragPropsHeight(heightResolved ?? (actualHeight > 0 ? `${Math.round(actualHeight)}px` : undefined), cfg.disableHeight ? '由布局自动控制，修改后将改为固定值' : '拖拽调整高度'))}
                  style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                >
                  <span className={css.tip} style={{ flexShrink: 0 }}>高度</span>
                </div>
                <div ref={heightInputWrapRef} style={{ flex: 1, minWidth: 0, display: 'contents' }}>
                  {heightVarRef ? renderVariableChip('height', heightVarRef) : (
                  <InputNumber
                    key={`${isHeightFill ? 'fill-h' : (heightEffective === 'fit-content' ? 'hug-h' : (isHeightDefault ? 'default-h' : getUnitKey(heightResolved)))}-hlk${heightLockKey}`}
                    style={{ flex: 1, minWidth: 0, marginLeft: 4 }}
                    {...(isHeightFill || isHeightDefault ? { value: null as any } : {})}
                    defaultValue={
                      isHeightFill || isHeightDefault
                        ? undefined
                        : (heightEffective === 'fit-content'
                            ? (actualHeight > 0 ? `${Math.round(actualHeight)}px` : undefined)
                            : heightResolved)
                    }
                    defaultUnitValue="px"
                    unitOptions={heightUnitOptions}
                    unitDisabledList={UNIT_DISABLED_LIST}
                    unitDisplayLabelMap={UNIT_DISPLAY_LABEL_MAP}
                    placeholder={
                      isHeightFill
                        ? (heightDefaultPx != null ? `填满(${heightDefaultPx})` : '填满')
                        : isHeightDefault
                          ? (heightDefaultPx != null ? `默认(${heightDefaultPx})` : '默认')
                          : ''
                    }
                    onChange={handleHeightChange}
                    onAction={(val) => {
                      if (val === 'hug' || val === 'fill') applySizingMode('height', val);
                      else if (val === 'addMinHeight') { setShowMinHeight(true); setShowWidthHeight(true); }
                      else if (val === 'addMaxHeight') { setShowMaxHeight(true); setShowWidthHeight(true); }
                      else if (val === APPLY_VARIABLE_ACTION) openVariablePicker('height');
                    }}
                    showIcon={true}
                    showIconOnHover
                    unitIconClassName={css.sizeUnitIcon}
                    unitSelectStyle={SIZE_UNIT_SELECT_STYLE}
                    unitHideLabelList={SIZE_UNIT_HIDE_LABEL_LIST}
                    tip={
                      cfg.disableHeight
                        ? SIZE_DISABLED_TIP
                        : isHeightFill && heightDefaultPx != null
                          ? `当前高度填满父容器，${heightDefaultPx}为计算值`
                          : isHeightDefault && heightDefaultPx != null
                            ? `未配置高度，${heightDefaultPx}为计算值`
                            : undefined
                    }
                    badge={
                      isHeightFill ? (
                        <SizingModeBadge
                          mode="fill"
                          compactDisplay
                          dimension="height"
                          actualSize={Math.round(actualHeight)}
                          parentSize={parentHeight}
                          onPreferPercent={setHeightPreferPercent}
                          onChange={(v) => { setHeightPending(v ?? 'auto'); onChange({ key: 'height', value: v }); }}
                          onAddMin={() => { setShowMinHeight(true); setShowWidthHeight(true); }}
                          onAddMax={() => { setShowMaxHeight(true); setShowWidthHeight(true); }}
                          hasVariables={hasLengthVariables}
                          onApplyVariable={() => openVariablePicker('height')}
                        />
                      ) : (heightEffective === 'fit-content') ? (
                        <SizingModeBadge
                          mode="hug"
                          dimension="height"
                          actualSize={Math.round(actualHeight)}
                          parentSize={parentHeight}
                          onPreferPercent={setHeightPreferPercent}
                          onChange={(v) => { setHeightPending(v); onChange({ key: 'height', value: v }); }}
                          onAddMin={() => { setShowMinHeight(true); setShowWidthHeight(true); }}
                          onAddMax={() => { setShowMaxHeight(true); setShowWidthHeight(true); }}
                          hasVariables={hasLengthVariables}
                          onApplyVariable={() => openVariablePicker('height')}
                        />
                      ) : isHeightDefault ? (
                        <DefaultModeBadge
                          dimension="height"
                          actualSize={Math.round(actualHeight)}
                          parentSize={parentHeight}
                          onPreferPercent={setHeightPreferPercent}
                          onChange={(v) => { setHeightPending(v); onChange({ key: 'height', value: v }); }}
                          onAddMin={() => { setShowMinHeight(true); setShowWidthHeight(true); }}
                          onAddMax={() => { setShowMaxHeight(true); setShowWidthHeight(true); }}
                          showAddMin={!showMinHeight}
                          showAddMax={!showMaxHeight}
                          hasVariables={hasLengthVariables}
                          onApplyVariable={() => openVariablePicker('height')}
                        />
                      ) : undefined
                    }
                  />
                  )}
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
                  <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 4, minWidth: 0 }}>
                    <div
                      ref={setFieldAnchor('minWidth')}
                      {...(minWidthVarRef
                        ? getVariableDragProps('minWidth', '拖拽调整最小宽度（将解除变量绑定）')
                        : getDragPropsMinWidth(minWidthEffective, '拖拽调整最小宽度'))}
                      style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                    >
                      <span className={css.tip} style={{ flexShrink: 0 }}>最小宽</span>
                    </div>
                    {minWidthVarRef ? renderVariableChip('minWidth', minWidthVarRef) : (
                    <InputNumber
                      key={getUnitKey(minWidthEffective)}
                      style={{ flex: 1, minWidth: 0, marginLeft: 4 }}
                      defaultValue={minWidthEffective}
                      defaultUnitValue="px"
                      unitOptions={constraintUnitOptions.minWidth}
                      placeholder="未配置"
                      hideUnitWhenEmpty
                      onChange={(val) => onChange({key: 'minWidth', value: val})}
                      onAction={(val) => {
                        if (val === APPLY_VARIABLE_ACTION) openVariablePicker('minWidth');
                        else removeConstraint('minWidth');
                      }}
                      showIcon={true}
                      showIconOnHover
                      unitIconClassName={css.sizeUnitIcon}
                      unitSelectStyle={SIZE_UNIT_SELECT_STYLE}
                      unitHideLabelList={SIZE_UNIT_HIDE_LABEL_LIST}
                    />
                    )}
                  </Panel.Item>
                ) : leftKey === 'maxWidth' ? (
                  <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 4, minWidth: 0 }}>
                    <div
                      ref={setFieldAnchor('maxWidth')}
                      {...(maxWidthVarRef
                        ? getVariableDragProps('maxWidth', '拖拽调整最大宽度（将解除变量绑定）')
                        : getDragPropsMaxWidth(maxWidthEffective, '拖拽调整最大宽度'))}
                      style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                    >
                      <span className={css.tip} style={{ flexShrink: 0 }}>最大宽</span>
                    </div>
                    {maxWidthVarRef ? renderVariableChip('maxWidth', maxWidthVarRef) : (
                    <InputNumber
                      key={getUnitKey(maxWidthEffective)}
                      style={{ flex: 1, minWidth: 0, marginLeft: 4 }}
                      defaultValue={maxWidthEffective}
                      defaultUnitValue="px"
                      unitOptions={constraintUnitOptions.maxWidth}
                      placeholder="未配置"
                      hideUnitWhenEmpty
                      onChange={(val) => onChange({key: 'maxWidth', value: val})}
                      onAction={(val) => {
                        if (val === APPLY_VARIABLE_ACTION) openVariablePicker('maxWidth');
                        else removeConstraint('maxWidth');
                      }}
                      showIcon={true}
                      showIconOnHover
                      unitIconClassName={css.sizeUnitIcon}
                      unitSelectStyle={SIZE_UNIT_SELECT_STYLE}
                      unitHideLabelList={SIZE_UNIT_HIDE_LABEL_LIST}
                    />
                    )}
                  </Panel.Item>
                ) : (
                  // 与宽高行同结构占位，保证仅右侧有值时与上方「高度」列对齐
                  <Panel.Item className={css.constraintSpacer} />
                )}
                {rightKey === 'minHeight' ? (
                  <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 4, minWidth: 0 }}>
                    <div
                      ref={setFieldAnchor('minHeight')}
                      {...(minHeightVarRef
                        ? getVariableDragProps('minHeight', '拖拽调整最小高度（将解除变量绑定）')
                        : getDragPropsMinHeight(minHeightEffective, '拖拽调整最小高度'))}
                      style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                    >
                      <span className={css.tip} style={{ flexShrink: 0 }}>最小高</span>
                    </div>
                    {minHeightVarRef ? renderVariableChip('minHeight', minHeightVarRef) : (
                    <InputNumber
                      key={getUnitKey(minHeightEffective)}
                      style={{ flex: 1, minWidth: 0, marginLeft: 4 }}
                      defaultValue={minHeightEffective}
                      defaultUnitValue="px"
                      unitOptions={constraintUnitOptions.minHeight}
                      placeholder="未配置"
                      hideUnitWhenEmpty
                      onChange={(val) => onChange({key: 'minHeight', value: val})}
                      onAction={(val) => {
                        if (val === APPLY_VARIABLE_ACTION) openVariablePicker('minHeight');
                        else removeConstraint('minHeight');
                      }}
                      showIcon={true}
                      showIconOnHover
                      unitIconClassName={css.sizeUnitIcon}
                      unitSelectStyle={SIZE_UNIT_SELECT_STYLE}
                      unitHideLabelList={SIZE_UNIT_HIDE_LABEL_LIST}
                    />
                    )}
                  </Panel.Item>
                ) : rightKey === 'maxHeight' ? (
                  <Panel.Item style={{ display: "flex", alignItems: "center", paddingLeft: 4, minWidth: 0 }}>
                    <div
                      ref={setFieldAnchor('maxHeight')}
                      {...(maxHeightVarRef
                        ? getVariableDragProps('maxHeight', '拖拽调整最大高度（将解除变量绑定）')
                        : getDragPropsMaxHeight(maxHeightEffective, '拖拽调整最大高度'))}
                      style={{ height: "100%", display: "flex", alignItems: "center", cursor: "ew-resize" }}
                    >
                      <span className={css.tip} style={{ flexShrink: 0 }}>最大高</span>
                    </div>
                    {maxHeightVarRef ? renderVariableChip('maxHeight', maxHeightVarRef) : (
                    <InputNumber
                      key={getUnitKey(maxHeightEffective)}
                      style={{ flex: 1, minWidth: 0, marginLeft: 4 }}
                      defaultValue={maxHeightEffective}
                      defaultUnitValue="px"
                      unitOptions={constraintUnitOptions.maxHeight}
                      placeholder="未配置"
                      hideUnitWhenEmpty
                      onChange={(val) => onChange({key: 'maxHeight', value: val})}
                      onAction={(val) => {
                        if (val === APPLY_VARIABLE_ACTION) openVariablePicker('maxHeight');
                        else removeConstraint('maxHeight');
                      }}
                      showIcon={true}
                      showIconOnHover
                      unitIconClassName={css.sizeUnitIcon}
                      unitSelectStyle={SIZE_UNIT_SELECT_STYLE}
                      unitHideLabelList={SIZE_UNIT_HIDE_LABEL_LIST}
                    />
                    )}
                  </Panel.Item>
                ) : (
                  <Panel.Item className={css.constraintSpacer} />
                )}
              </Panel.Content>
            );
          })}
          <SketchPopup
            open={!!variablePickerField}
            mounted={variablePickerMounted}
            anchorRef={variablePickerAnchorRef}
            onClose={closeVariablePicker}
            className={css.variablePopup}
            repositionKey={variablePickerField ?? ''}
          >
            <VariableList
              list={lengthVariables}
              open={!!variablePickerField}
              selectedName={variablePickerField ? boundVarRefs[variablePickerField] : undefined}
              onClose={closeVariablePicker}
              onSelect={(item) => {
                if (variablePickerField) writeSizeValue(variablePickerField, `var(${item.name})`);
                closeVariablePicker();
              }}
              emptyText="当前画布没有可用的尺寸变量"
            />
          </SketchPopup>
        </div>
    </Panel>
  );
}
