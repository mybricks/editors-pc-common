import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { parseCssVar } from "../../../core/css-var";
import type { CssVarOption } from "../../../core/css-var";
import { formatLengthDisplay } from "../../utils";
import { Search } from "../../icons/Search";
import { VariableNumber } from "../../icons/VariableNumber";
import { SketchCloseIcon } from "../SketchPopup";

import css from "./index.less";

/** 归一化成 --name，便于对比「当前已绑定的变量」 */
export const getCssVarName = (value?: string): string | undefined => {
  const normalized = value?.trim().replace(/\s*!important\s*$/i, '');
  if (!normalized) return undefined;
  return parseCssVar(normalized)?.varName || (normalized.startsWith('--') ? normalized : undefined);
};

/** 颜色变量的类型标识：色块 */
export const VariableColorPreview = ({ color }: { color: string }) => (
  <div className={css.colorBlock} style={{ backgroundColor: color }} />
);

interface VariableListProps<T extends CssVarOption> {
  list: T[];
  /** 当前已绑定的变量，支持 var(--x) 或 --x */
  selectedName?: string;
  /** 弹层是否打开：打开时把选中项滚动到可视区中部 */
  open: boolean;
  onSelect: (item: T) => void;
  /** 传入后展示搜索行右侧的关闭按钮，并支持 Esc 关闭 */
  onClose?: () => void;
  /** 左侧类型图标，默认为数值型标识 */
  renderIcon?: (item: T) => ReactNode;
  /** 右侧值文案，默认展示变量当前值（省略 px 单位） */
  renderValue?: (item: T) => ReactNode;
  filterPlaceholder?: string;
  emptyText?: string;
  autoFocus?: boolean;
}

export function VariableList<T extends CssVarOption>({
  list,
  selectedName,
  open,
  onSelect,
  onClose,
  renderIcon,
  renderValue,
  filterPlaceholder = '搜索',
  emptyText = '当前画布没有可用变量',
  autoFocus = true,
}: VariableListProps<T>) {
  const [keyword, setKeyword] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const normalizedSelectedName = getCssVarName(selectedName);
  const filteredList = useMemo(
    () => list.filter((item) => item.name.toLowerCase().includes(keyword.trim().toLowerCase())),
    [keyword, list]
  );

  useEffect(() => {
    if (!open || !selectedName) return;
    let centerFrame: number | undefined;
    const renderFrame = window.requestAnimationFrame(() => {
      // 等变量筛选与列表布局完成后，再根据容器实际边界计算居中位置。
      centerFrame = window.requestAnimationFrame(() => {
        const container = listRef.current;
        const selected = container?.querySelector<HTMLElement>('[data-selected="true"]');
        if (!container || !selected) return;

        const containerRect = container.getBoundingClientRect();
        const selectedRect = selected.getBoundingClientRect();
        const nextScrollTop = container.scrollTop + selectedRect.top - containerRect.top
          - (container.clientHeight - selectedRect.height) / 2;
        container.scrollTo({ top: Math.max(0, nextScrollTop) });
      });
    });
    return () => {
      window.cancelAnimationFrame(renderFrame);
      if (centerFrame != null) window.cancelAnimationFrame(centerFrame);
    };
  }, [open, selectedName, filteredList]);

  return (
    <div className={css.variableListContainer}>
      <div className={css.searchBar}>
        <span className={css.searchIcon}>
          <Search />
        </span>
        <input
          value={keyword}
          placeholder={filterPlaceholder}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose?.();
          }}
          autoFocus={autoFocus}
        />
        {onClose && (
          <span className={css.closeIcon} onClick={onClose} data-mybricks-tip="关闭">
            {SketchCloseIcon}
          </span>
        )}
      </div>
      <div ref={listRef} className={css.variableList}>
        {filteredList.length === 0 && <div className={css.empty}>{emptyText}</div>}
        {filteredList.map((item) => (
          <div
            key={item.name}
            className={css.item}
            data-selected={getCssVarName(item.name) === normalizedSelectedName || undefined}
            onClick={() => onSelect(item)}
          >
            <span className={css.itemIcon}>
              {renderIcon ? renderIcon(item) : <VariableNumber />}
            </span>
            <span className={css.itemName}>{item.name}</span>
            <span className={css.itemValue}>
              {renderValue ? renderValue(item) : formatLengthDisplay(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
