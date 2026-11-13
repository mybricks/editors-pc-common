import React, { CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import Direction from "./Direction";
import AlignItems from "./AlignItems";
import JustifyContent from "./JustifyContent";
import Padding, { PaddingProps } from "./Padding";
import Gap, { GapProps } from "./Gap";
import { applyInlineGapChange } from "./core/inline-gap";
import Grid from "./Grid";
import type { Layout } from "./types";
import { Panel } from "../../components";
import type { ChangeEvent, PanelBaseProps } from "../../type";
import { useEffectiveStyleValue, useStyleChange, useStyleEditorContext } from "../../context";
import { useStyleDisplayValue } from "../../hooks/useStyleDisplayValue";
import { createStyleResolution, isSourceInline, resolveEffectiveStyleSource } from "../../../core/style-property";
import { excludeSoloSources } from "../../../core/zone-tab";
import type { ZoneTab } from "../../../core/zone-tab";
import { buildFreedomPlan } from '../../../core/freedom-plan';
import { isInlineFreedomTarget } from '../../../core/freedom-inline-plan';
import type { FreedomPlanOptions } from '../../../core/freedom-plan';
import styles from "./index.less";
import lang from '../../../index.i18n'

interface LayoutEditorProps extends PanelBaseProps {
  value: Record<string, any>;
  onChange: ChangeEvent;
}

interface LayoutModel {
  display?: CSSProperties["display"];
  // Grid 保留完整 CSS 字符串（如 repeat(3, 1fr)、25% 1fr），交给 Grid 解析层；历史 flex 字段类型不变。
  gridTemplateColumns?: string | null;
  gridTemplateRows?: string | null;
  gridAutoRows?: string | null;
  gridAutoFlow?: string | null;
  position?: CSSProperties["position"] | "default";
  flexDirection: CSSProperties["flexDirection"];
  alignItems: CSSProperties["alignItems"];
  justifyContent: CSSProperties["justifyContent"];
  flexWrap: CSSProperties["flexWrap"];
  gap?: CSSProperties["gap"] | null;
  rowGap: CSSProperties["rowGap"] | null;
  columnGap: CSSProperties["columnGap"] | null;
  overflow?: CSSProperties["overflow"] | "visible" | "hidden";
  paddingType?: "independentPadding" | "dependentPadding";
  padding?: CSSProperties["padding"];
  paddingTop?: CSSProperties["paddingTop"] | null;
  paddingRight?: CSSProperties["paddingRight"] | null;
  paddingBottom?: CSSProperties["paddingBottom"] | null;
  paddingLeft?: CSSProperties["paddingLeft"] | null;
}

function isFlexLikeDisplay(display?: CSSProperties["display"]) {
  return display === "flex" || display === "inline-flex";
}

// 仅 grid/inline-grid 进入网格面板与退出清理，其他 display 继续走原布局分支。
function isGridLikeDisplay(display?: CSSProperties["display"]) {
  return display === "grid" || display === "inline-grid";
}

/**
 * 用户点击“横向排列”或“纵向排列”时，决定新的 display 应该是 flex 还是 inline-flex。
 * 例：文字旁有一个 inline-grid 容器，里面的两个按钮原本按网格排列。
 * 点击“横向排列”后，本方法返回 inline-flex，调用方再设置 flexDirection: row：
 * 两个按钮改用 Flex 横排，容器本身仍可以和旁边的文字排在同一行。
 * 如果原来是 grid，则返回 flex。
 * 返回值表示切换后的布局，不能用它判断原来是不是 inline-grid。
 */
function getDisplayAfterEnablingFlex(display?: CSSProperties["display"]) {
  if (display === "inline-flex" || display === "inline-block" || display === "inline-grid") {
    return "inline-flex";
  }
  return "flex";
}

// Grid 面板读写、重置及退出清理仅补充这四项；纳入已有布局字段白名单，继续复用原 onChange 样式提交链路。
const GRID_KEYS = ['gridTemplateColumns', 'gridTemplateRows', 'gridAutoRows', 'gridAutoFlow'];
const LAYOUT_KEYS = new Set([
  'display', 'position', 'flexDirection', 'alignItems', 'justifyContent',
  'flexWrap', 'gap', 'rowGap', 'columnGap', 'overflow',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  ...GRID_KEYS,
]);

const NON_CSS_KEYS = new Set(['paddingType']);
const GAP_KEYS = ['rowGap', 'columnGap'] as const;
type GapKey = typeof GAP_KEYS[number];

function hasPresentValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

/** 判断当前选择器的原始样式是否声明过 gap，避免把 computed 的 0px 当成显式配置。 */
function hasAuthoredGap(style: Record<string, any> | undefined, key: GapKey): boolean {
  if (!style) return false;
  const kebabKey = key === 'rowGap' ? 'row-gap' : 'column-gap';
  return hasPresentValue(style[key]) || hasPresentValue(style[kebabKey]) || hasPresentValue(style.gap);
}

/** 编辑器内置的 position 语义；其余为真实 CSS 值（fixed/relative 等），读入时需原样保留，避免被当成 inherit 后写出为 null 而丢失 */
function isPreservedCssPosition(pos: unknown): pos is CSSProperties['position'] {
  if (pos == null || typeof pos !== 'string') return false;
  if (pos === 'absolute' || pos === 'default' || pos === 'inherit') return false;
  if (pos === 'row' || pos === 'column') return false;
  return true;
}

/** 写出：将样式对象中的裸数字值补上 px 单位（仅 number 类型触发，字符串原样保留） */
function normalizePx(style: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(style)) {
    result[key] = typeof val === "number" ? `${val}px` : val;
  }
  return result;
}

/** 读入：将 "11px" 形式的 px 字符串还原为数字，供内部 InputNumber 组件正常回显 */
function parsePxValues(style: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(style)) {
    // 单列 100px 也须作为 CSS 字符串交给 Grid 解析；非 Grid 字段（如间距 11px）继续按原规则转数字。
    result[key] =
      !GRID_KEYS.includes(key) && typeof val === "string" && /^-?\d+(\.\d+)?px$/.test(val)
        ? parseFloat(val)
        : val;
  }
  return result;
}

const defaultValue: LayoutModel = {
  display: "flex",
  position: "inherit",
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  flexWrap: "nowrap",
  rowGap: 0,
  columnGap: 0,
};

// freeform 标记属于当前实例；即使批量面板排除了单独规则，也要读取它的真实布局状态。
function readFreeformMode(zoneTab: ZoneTab | null | undefined, targetDom: Element | null | undefined) {
  try {
    if (targetDom && isInlineFreedomTarget(targetDom)) {
      return (targetDom as HTMLElement).style.getPropertyValue('--layout-mode').trim() || undefined;
    }
    const freeformMode = zoneTab && [
      ...zoneTab.sourceRules.map(source => source.rule), ...(zoneTab.excludedRules ?? []),
    ].find(rule => rule.style.getPropertyValue('--layout-mode') && targetDom?.matches(rule.selectorText))
      ?.style.getPropertyValue('--layout-mode').trim();

    return freeformMode;
  } catch {
    return undefined;
  }
}

export function Layout({ value: panelValue, onChange: fallbackOnChange, showTitle, config }: LayoutEditorProps) {
  const context = useStyleEditorContext();
  const effectiveValue = useEffectiveStyleValue();
  const options = context?.editConfig.options;
  const zoneTab = options && !Array.isArray(options) && "zoneTab" in options ? options.zoneTab : null;
  const hasZoneTab = !!zoneTab;
  // 非 Zone 模式（如单独编辑）的回显值来自 props，effectiveStyle 在此模式下为空。
  const value = hasZoneTab ? effectiveValue : panelValue;
  // 仅挂载时读取；后续由布局操作更新，普通属性引发的 CSS 重编译不重新扫描。
  const [freeformMode, setFreeformMode] = useState(() => readFreeformMode(zoneTab, context?.targetDom));

  const displayField = useStyleDisplayValue('display');
  const positionField = useStyleDisplayValue('position');
  const directionField = useStyleDisplayValue('flexDirection');
  const alignField = useStyleDisplayValue('alignItems');
  const justifyField = useStyleDisplayValue('justifyContent');
  const wrapField = useStyleDisplayValue('flexWrap');
  const overflowField = useStyleDisplayValue('overflow');
  const inlineDisplayPreview = useMemo(() => {
    const target = context?.targetDom;
    if (!zoneTab?.pseudo || zoneTab.pseudo.startsWith('::') || displayField.hasDeclaration ||
      !target?.isConnected || !options || Array.isArray(options)) return undefined;
    // computed 会将 flex/grid 子项的 inline-flex 等块化；从共享常规态读取声明，不改动共享 Tab。
    const baseTab = options.mergedTabs?.find(tab => !tab.pseudo);
    if (!baseTab) return undefined;
    const value = createStyleResolution(
      excludeSoloSources(baseTab, zoneTab.excludedSourceSelectors ?? []), target
    ).get('display').winner?.value;
    return /^inline(?:-|$)/.test(value || '') ? value : undefined;
  }, [context, zoneTab, options, displayField.hasDeclaration]);
  // 预览仅用于展示模型，不进入 editValue、重置属性列表或样式写入。
  const previewValue = zoneTab?.pseudo && !zoneTab.pseudo.startsWith('::')
    ? Object.fromEntries(Object.entries({
        display: inlineDisplayPreview ?? displayField.computedPreview,
        position: positionField.computedPreview,
        flexDirection: directionField.computedPreview,
        alignItems: alignField.computedPreview,
        justifyContent: justifyField.computedPreview,
        flexWrap: wrapField.computedPreview,
        overflow: overflowField.computedPreview,
      }).filter(([, value]) => value != null))
    : undefined;
  const onChange = useStyleChange(fallbackOnChange);
  /** 替换元素（如 img）：面板只提供 display 切换，不提供 flex 容器能力 */
  const displayOnly = !!config?.displayOnly;
  const authoredStyle = context?.authoredStyle;
  const canInspectAuthoredGap = !!context?.targetDom;
  const [clearedGapKeys, setClearedGapKeys] = useState<Record<GapKey, boolean>>(() => ({
    rowGap: canInspectAuthoredGap && !hasAuthoredGap(authoredStyle, 'rowGap'),
    columnGap: canInspectAuthoredGap && !hasAuthoredGap(authoredStyle, 'columnGap'),
  }));
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random());
  const [isReset, setIsReset] = useState(false);

  const currentValue = isReset ? {} : (value ?? {});

  const overflowXField = useStyleDisplayValue('overflowX');
  const overflowYField = useStyleDisplayValue('overflowY');

  const overflowX = context?.getStyleProperty?.('overflowX').winner?.value
    ?? overflowXField.displayValue ?? value?.overflowX ?? value?.overflow;
  const overflowY = context?.getStyleProperty?.('overflowY').winner?.value
    ?? overflowYField.displayValue ?? value?.overflowY ?? value?.overflow;
  const overflowHidden = !isReset && overflowX === 'hidden' && overflowY === 'hidden';

  const editValue = Object.fromEntries(
    Object.entries(currentValue).filter(([key, v]) => v != null && LAYOUT_KEYS.has(key))
  );

  const refresh = useCallback(() => {
    const keys = Object.keys(value ?? {}).filter(key => LAYOUT_KEYS.has(key));
    const result = onChange([...keys, '--layout-mode'].map(key => ({ key, value: null })));
    if (!result || result.applied) setFreeformMode(undefined);
    setClearedGapKeys({rowGap: true, columnGap: true});
    setIsReset(true);
    setForceRenderKey(prev => prev + 1);
  }, [value, onChange]);

  useEffect(() => {
    if (isReset && value && Object.keys(value).some(k => value[k] != null)) {
      setIsReset(false);
    }
  }, [value, isReset]);

  const handleFreedomSelect = () => {
    const plan = buildFreedomPlan(context!.targetDom!, value, options as FreedomPlanOptions);
    (window as any).__mybricks_applyStylePlan(plan);
    setFreeformMode('freedom');
  };

  return (
    <Panel title={lang.layoutPanelTitle} showTitle={showTitle} showReset={true} showDelete={false} resetFunction={refresh} collapse={false} keepTopBorder>
      <React.Fragment key={forceRenderKey}>
        <LayoutEditor
          editValue={editValue}
          previewValue={previewValue}
          overflowHidden={overflowHidden}
          clearedGapKeys={clearedGapKeys}
          displayOnly={displayOnly}
          freedomValue={!isReset && freeformMode === 'freedom'}
          onFreedomSelect={handleFreedomSelect}
          onChangeValue={(newVal) => {
            setClearedGapKeys((previous) => {
              const next = {...previous};
              let changed = false;
              GAP_KEYS.forEach((key) => {
                if (!Object.prototype.hasOwnProperty.call(newVal, key)) return;
                const nextCleared = !hasPresentValue(newVal[key]);
                if (next[key] !== nextCleared) {
                  next[key] = nextCleared;
                  changed = true;
                }
              });
              return changed ? next : previous;
            });
            // 布局切换的补丁都带 flexDirection，统一清除 freeform 标记。
            const nextValue = 'flexDirection' in newVal
              ? { ...newVal, '--layout-mode': null }
              : newVal;
            // 默认布局会清空 flexDirection，也要先恢复父子样式，不能只移除布局标记。
            if (freeformMode === 'freedom' && 'flexDirection' in newVal
              && (isFlexLikeDisplay(newVal.display) || newVal.flexDirection === null)) {
              const plan = buildFreedomPlan(context!.targetDom!, newVal, options as FreedomPlanOptions, 'flex');
              (window as any).__mybricks_applyStylePlan(plan);
              setFreeformMode(undefined);
              return;
            }
            const target = context?.targetDom;
            const changes = Object.entries(nextValue);
            const getStyleProperty = context?.getStyleProperty;
            const isInlineGapChange = zoneTab && !zoneTab.pseudo && getStyleProperty && target && changes.length &&
              changes.every(([key]) => GAP_KEYS.includes(key as GapKey)) &&
              changes.every(([key]) => !getStyleProperty(key).winner || isSourceInline(getStyleProperty(key).winner)) &&
              changes.some(([key]) => isSourceInline(getStyleProperty(key).winner));
            if (isInlineGapChange && target && zoneTab) {
              if (applyInlineGapChange(target, zoneTab, changes)) return;
            }
            const result = onChange(
              Object.entries(nextValue)
                .filter(([key]) => !NON_CSS_KEYS.has(key))
                .map(([key, val]) => ({ key, value: val }))
            );
            if ('flexDirection' in newVal && (!result || result.applied)) {
              setFreeformMode(undefined);
            }
          }}
        />
      </React.Fragment>
    </Panel>
  );
}

interface LayoutEditorInternalProps {
  editValue: Record<string, any>;
  previewValue?: Record<string, any>;
  overflowHidden: boolean;
  clearedGapKeys: Record<GapKey, boolean>;
  onChangeValue: (val: Record<string, any>) => void;
  displayOnly?: boolean;
  freedomValue: boolean;
  onFreedomSelect: () => void;
}

function LayoutEditor({ editValue, previewValue, overflowHidden, clearedGapKeys, onChangeValue, displayOnly, freedomValue, onFreedomSelect }: LayoutEditorInternalProps): JSX.Element {
  const targetDom = useStyleEditorContext()?.targetDom;
  const _value = parsePxValues({ ...previewValue, ...editValue });

  if ((_value as any).alignItems === "normal") (_value as any).alignItems = "flex-start";
  if ((_value as any).justifyContent === "normal") (_value as any).justifyContent = "flex-start";

  // Grid 与 Flex 一样不因缺少 position 被识别成默认布局；显式 absolute/relative 等定位仍按原优先级保留。
  const _position: string = ["absolute", "default"].includes(_value.position as string)
    ? (_value.position as string)
    : isPreservedCssPosition(_value.position)
      ? (_value.position as string)
      : (isFlexLikeDisplay(_value.display as CSSProperties["display"]) || isGridLikeDisplay(_value.display as CSSProperties["display"]) ? "inherit" : "default");

  const initialModel: LayoutModel = {
    ...defaultValue,
    ..._value,
    flexDirection: ((_value as any).flexDirection ?? defaultValue.flexDirection) as CSSProperties["flexDirection"],
    position: _position as any,
  };
  if (clearedGapKeys.rowGap) initialModel.rowGap = null;
  if (clearedGapKeys.columnGap) initialModel.columnGap = null;

  const [model, setModel] = useState<LayoutModel>(initialModel);
  const [freedom, setFreedom] = useState(freedomValue);
  useLayoutEffect(() => {
    setFreedom(freedomValue);
  }, [freedomValue, targetDom]);

  const initialFlexDirection = ((_value as any).flexDirection ?? defaultValue.flexDirection) as string;
  const [rowFlexWrap, setRowFlexWrap] = useState<CSSProperties["flexWrap"]>(
    initialFlexDirection === "row" ? ((_value as any).flexWrap || defaultValue.flexWrap) as CSSProperties["flexWrap"] : "nowrap"
  );
  const [columnFlexWrap, setColumnFlexWrap] = useState<CSSProperties["flexWrap"]>(
    initialFlexDirection === "column" ? ((_value as any).flexWrap || defaultValue.flexWrap) as CSSProperties["flexWrap"] : "nowrap"
  );

  const syncDisplay = !!previewValue;
  const { display, position, flexDirection, alignItems, justifyContent, flexWrap, overflow } = initialModel;
  useLayoutEffect(() => {
    if (!syncDisplay) return;
    setModel(previous => ({ ...previous, display, position, flexDirection, alignItems, justifyContent, flexWrap, overflow }));
    if (flexDirection === 'row') setRowFlexWrap(flexWrap);
    if (flexDirection === 'column') setColumnFlexWrap(flexWrap);
  }, [syncDisplay, display, position, flexDirection, alignItems, justifyContent, flexWrap, overflow]);

  const emitValue = useCallback(
    (style: Partial<LayoutModel>) => {
      // 切换到默认沿用原 flex 清理；新增 inline-grid → inline-block，并仅在退出 Grid 时清理 GRID_KEYS，容器 position 不动。
      if (style.position === "default") {
        const resetDisplay = model.display === "inline-flex" || model.display === "inline-block" || model.display === "inline-grid"
          ? "inline-block"
          : null;
        onChangeValue({
          display: resetDisplay,
          flexDirection: null,
          alignItems: null,
          justifyContent: null,
          flexWrap: null,
          rowGap: null,
          columnGap: null,
          // 非 Grid 布局不附加网格删除字段，保留历史默认按钮的提交内容。
          ...(isGridLikeDisplay(model.display) ? Object.fromEntries(GRID_KEYS.map(key => [key, null])) : {}),
        });
        return;
      }
      // 处于默认状态时，只写出本次变化的非 flex 属性（如 overflow、padding）
      // 注意：style.display 有值说明正在切换到 flex 布局，需要放行
      if (model.position === "default" && style.position === undefined && style.display === undefined) {
        const FLEX_KEYS = new Set(['display', 'flexDirection', 'alignItems', 'justifyContent', 'flexWrap', 'rowGap', 'columnGap', 'position']);
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(style)) {
          if (!FLEX_KEYS.has(k)) out[k] = v;
        }
        onChangeValue(normalizePx(out));
        return;
      }
      // 仅按 patch 写出，不合并 model
      onChangeValue(normalizePx(style as Record<string, unknown>));
    },
    [model, onChangeValue]
  );

  // isFlexActive：当前是否处于 flex/inline-flex 横/纵布局（与容器 position 无关）
  const isFlexActive =
    !freedom &&
    isFlexLikeDisplay(model.display) &&
    (model.flexDirection === "row" || model.flexDirection === "column");
  const isGridActive = !freedom && isGridLikeDisplay(model.display);

  // Grid 删除最后一列/行（如仅剩 1 列时点减号）复用默认按钮提交；原默认按钮的状态重置保留，仅当前 Grid 增加四项清理。
  const resetToDefault = () => {
    const clearGrid = isGridLikeDisplay(model.display) ? Object.fromEntries(GRID_KEYS.map(key => [key, null])) : {};
    setModel(prev => ({
      ...prev,
      ...clearGrid,
      flexDirection: model.flexDirection,
      display: undefined,
      position: "default",
      flexWrap: defaultValue.flexWrap,
      alignItems: defaultValue.alignItems,
      justifyContent: defaultValue.justifyContent,
      rowGap: null,
      columnGap: null,
    }));
    setRowFlexWrap(defaultValue.flexWrap);
    setColumnFlexWrap(defaultValue.flexWrap);
    emitValue({ position: "default" });
  };

  // 渲染布局模式选择器，统一处理默认、内联、自由布局、横向、纵向和网格按钮的切换。
  const renderLayoutModeSelector = () => {
    const onSelect = (layout: Layout) => {
      if (layout === 'freedom') {
        // 已选中时不重复转换，避免覆盖首次进入时记录的原始样式。
        if (freedom) return;
        onFreedomSelect();
        setFreedom(true);
        return;
      }
      setFreedom(false);
      // 点击网格按钮时切换 display，原来的行内布局对应 inline-grid。
      // Grid 需要单独处理并返回，避免下面的横/纵逻辑把 'grid' 当成 flexDirection 写出。
      if (layout === 'grid') {
        const sourceDisplay = model.display ?? editValue.display;
        const display = sourceDisplay?.startsWith('inline') ? 'inline-grid' : 'grid';
        // 仅显式启用时补缺省行列（如未配置列时用 1fr）；已有声明优先保留，单纯打开面板不写入这些初始值。
        const patch = {
          display,
          flexDirection: null,
          flexWrap: null,
          gridTemplateColumns: model.gridTemplateColumns && model.gridTemplateColumns !== 'none' ? model.gridTemplateColumns : '1fr',
          gridTemplateRows: model.gridTemplateRows || 'none',
          gridAutoRows: model.gridAutoRows || '1fr',
          gridAutoFlow: model.gridAutoFlow || 'row',
        };
        // 写出的样式清除 Flex 方向和换行；面板仍记住之前的值，供切回 Flex 时使用。
        setModel(prev => ({ ...prev, ...patch, flexDirection: prev.flexDirection, flexWrap: prev.flexWrap, position: 'inherit' }));
        emitValue(patch);
        return;
      }
      // Grid → inline/flex 时附加清理，避免残留网格声明；当前非 Grid 则为空，不增加历史切换的写入字段。
      const clearGrid = isGridLikeDisplay(model.display) ? Object.fromEntries(GRID_KEYS.map(key => [key, null])) : {};
      const isAbsolute = layout === "absolute";
      const isDefault = layout === "default";
      const isInline = layout === "inline";
      const flexDirection = (isAbsolute || isDefault || isInline) ? model.flexDirection : layout;

      let flexWrap = model.flexWrap;
      if (layout === "column" && model.flexDirection === "row") {
        setRowFlexWrap(model.flexWrap);
        flexWrap = columnFlexWrap;
      } else if (layout === "row" && model.flexDirection === "column") {
        setColumnFlexWrap(model.flexWrap);
        flexWrap = rowFlexWrap;
      }

      // 替换元素的 UA 默认 display 就是 inline，清空 display 会与「内联」重合，需显式写 block
      if (isDefault && displayOnly) {
        setModel(prev => ({ ...prev, display: "block" }));
        emitValue({
          display: "block",
          flexDirection: null,
          alignItems: null,
          justifyContent: null,
          flexWrap: null,
          rowGap: null,
          columnGap: null,
        });
        return;
      }

      if (isDefault) {
        resetToDefault();
        return;
      }

      if (isAbsolute) {
        setModel(prev => ({ ...prev, flexDirection, display: "block", position: "absolute", flexWrap }));
        emitValue({ display: "block", flexDirection, position: "absolute", flexWrap });
        return;
      }

      if (isInline) {
        setModel(prev => ({ ...prev, ...clearGrid, display: "inline", flexDirection, position: "inherit" }));
        emitValue({
          display: "inline",
          flexDirection: null,
          alignItems: null,
          justifyContent: null,
          flexWrap: null,
          rowGap: null,
          columnGap: null,
          ...clearGrid,
        });
        return;
      }

      // 横/纵切换时写入 display 和 flex 方向，不自动修改对齐方式。
      // 当前 Grid 优先使用面板模型，保证 inline-grid → inline-flex；非 Grid 仍优先 editValue，保留历史取值顺序。
      const sourceDisplay = isGridLikeDisplay(model.display) ? model.display : (editValue.display as CSSProperties["display"] | undefined) ?? model.display;
      const nextDisplay = getDisplayAfterEnablingFlex(sourceDisplay);
      setModel(prev => ({ ...prev, ...clearGrid, flexDirection, display: nextDisplay, position: "inherit", flexWrap }));
      emitValue({ display: nextDisplay, flexDirection, flexWrap, ...clearGrid });
    };
    return (
      <Direction
        defaultDirection={displayOnly ? ["default", "inline"] : undefined}
        position={model.position}
        flexDirection={model.flexDirection}
        display={model.display}
        freedom={freedom}
        onSelect={onSelect}
      />
    );
  };

  const renderJustifyContent = () => {
    const onSelect = (justifyContent: CSSProperties["justifyContent"]) => {
      if (justifyContent == "normal") {
        justifyContent = "flex-start";
      }
      setModel((pre) => ({ ...pre, justifyContent }));
      emitValue({ justifyContent });
    };
    const onWrapToggle = (flexWrap: CSSProperties["flexWrap"]) => {
      setModel((pre) => ({ ...pre, flexWrap }));
      emitValue({ flexWrap });
      if (model.flexDirection === "row") {
        setRowFlexWrap(flexWrap);
      } else if (model.flexDirection === "column") {
        setColumnFlexWrap(flexWrap);
      }
    };
    return isFlexActive ? (
      <JustifyContent
        flexDirection={model.flexDirection}
        justifyContent={model.justifyContent}
        flexWrap={model.flexWrap}
        onSelect={onSelect}
        onWrapToggle={onWrapToggle}
      />
    ) : null;
  };

  const renderAlignItems = () => {
    const onSelectFlexItem = ({
      alignItems,
      justifyContent,
    }: Pick<CSSProperties, "justifyContent" | "alignItems">) => {
      setModel((pre) => ({
        ...pre,
        alignItems,
        justifyContent,
      }));
      emitValue({ justifyContent, alignItems });
    };
    return isFlexActive ? (
      <AlignItems
        flexDirection={model?.flexDirection}
        justifyContent={model.justifyContent}
        alignItems={model.alignItems}
        onSelected={onSelectFlexItem}
      />
    ) : null;
  };

  const renderGap = () => {
    const onGapChange = (val: GapProps["value"]) => {
      setModel((pre) => ({ ...pre, ...val }));
      emitValue({ ...val });
    };
    // Grid 复用原 Gap 读写，只按 row 固定展示行列间距；Flex 仍传原 flexDirection，保留横/纵布局的字段顺序。
    return isFlexActive || isGridActive ? (
      <Gap
        value={{ rowGap: model.rowGap, columnGap: model.columnGap }}
        cleared={clearedGapKeys}
        onChange={onGapChange}
        flexDirection={isGridActive ? "row" : model.flexDirection}
      />
    ) : null;
  };

  const renderOverflow = () => {
    // 替换元素无内容可裁剪；「内联显示」写的是 inline-block，会与方向上的「内联」语义冲突
    if (displayOnly) return null;

    const isHidden = overflowHidden;
    const toggle = () => {
      const overflow = isHidden ? "visible" : "hidden";
      setModel((pre) => ({ ...pre, overflow }));
      emitValue({ overflow });
    };
    return (
      <div className={styles.overflowRow}>
        <div className={`${styles.checkbox} ${isHidden ? styles.checkboxChecked : ""}`} onClick={toggle}>
          {isHidden && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 3.5L3.8 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <span
          className={styles.overflowLabel}
          onClick={toggle}
          style={{ marginRight: 12 }}
          data-mybricks-tip={lang.overflowHiddenTip}
        >
          {lang.overflowHiddenLabel}
        </span>
        {renderInlineBlock()}
      </div>
    );
  };

  const renderInlineBlock = () => {
    if (model.display === "inline") return null;

    // 内联开关新增 grid ↔ inline-grid，仅切 display、保留行列定义；原 block/flex 的往返映射保持不变。
    const isInlineBlock = model.display === "inline-block" || model.display === "inline-flex" || model.display === "inline-grid";
    const toggle = () => {
      let display = '';

      if (isInlineBlock) {
        if (model.display === "inline-block") {
          display = 'block';
        } else if (model.display === "inline-flex") {
          display = 'flex';
        } else if (model.display === "inline-grid") {
          display = 'grid';
        }
      } else {
        if (model.display === "flex") {
          display = 'inline-flex';
        } else if (model.display === "grid") {
          display = 'inline-grid';
        } else {
          display = 'inline-block';
        }
      }

      if (!display) {
        return;
      }
      setModel((pre) => ({ ...pre, display }));
      emitValue({ display });
    };

    return (
      <>
        <div className={`${styles.checkbox} ${isInlineBlock ? styles.checkboxChecked : ""}`} onClick={toggle}>
          {isInlineBlock && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 3.5L3.8 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <span
          className={styles.overflowLabel}
          onClick={toggle}
          data-mybricks-tip={lang.inlineTip}
        >
          {lang.inlineLabel}
        </span>
      </>
    );
  };

  const renderPadding = () => {
    const onPaddingToggle = (paddingType: "independentPadding" | "dependentPadding") => {
      setModel((pre) => ({ ...pre, paddingType }));
      emitValue({ paddingType });
    };
    const onPaddingChange = (val: PaddingProps["value"]) => {
      setModel((pre) => ({ ...pre, ...val }));
      emitValue({ ...val });
    };

    if (!isFlexActive) return null;
    return (
      <Padding
        value={{
          paddingTop: model.paddingTop,
          paddingRight: model.paddingRight,
          paddingBottom: model.paddingBottom,
          paddingLeft: model.paddingLeft,
        }}
        paddingType={model.paddingType ?? "dependentPadding"}
        onPaddingToggle={onPaddingToggle}
        onChange={onPaddingChange}
      />
    );
  };

  return (
    <div>
      {renderLayoutModeSelector()}
      {/* 仅当前 Grid 挂载网格编辑器；修改继续走 emitValue，末项删除复用默认入口，原 Flex 面板保留独立条件。 */}
      {isGridActive && <div className={styles.gridLayout}>
        <Grid value={model} onRemoveLayout={resetToDefault} onChange={patch => {
          setModel(previous => ({ ...previous, ...patch }));
          emitValue(patch);
        }} />
        <div className={styles.gridGap}>
          {renderGap()}
        </div>
      </div>}
      {isFlexActive && (
        <div className={styles.layout}>
          <div className={styles.centerLayout}>
            <div
              className={styles.right}
              style={{
                display: isFlexActive ? void 0 : "none",
              }}
            >
              {renderAlignItems()}
            </div>
          </div>
          <div className={styles.left}>
            {renderGap()}
            {renderJustifyContent()}
          </div>
        </div>
      )}
      {renderOverflow()}
    </div>
  );
}
