import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { parseCssVar, formatCssVarTitle } from "../../../core/css-var";
import type { CssVarOption, ThemeVar } from "../../../core/css-var";
import { useThemeVars } from "../../hooks/useThemeVars";
import { formatLengthDisplay } from "../../utils";
import { Search } from "../../icons/Search";
import { VariableNumber } from "../../icons/VariableNumber";
import { Dropdown } from "../DropDown";
import { DownOutlined } from "../Icon";

import css from "./index.less";
import lang from "../../../index.i18n";

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

type VariableLibrary = 'design' | 'other';
type VariableLibraryValue = VariableLibrary | undefined;

interface VariableDisplayItem<T extends CssVarOption> {
  item: T;
  title: string;
  category: string;
  itemName: string;
  library: VariableLibraryValue;
}

function getLibraryLabels(): Record<VariableLibrary | 'all', string> {
  return {
    all: lang.allLibraries,
    design: lang.designVariables,
    other: lang.otherVariables,
  };
}

const libraryOrder: Array<VariableLibrary> = ['design', 'other'];

/**
 * 如果变量在themeVars中，归入‘自定义库’，如果不在归入‘其它库’。
 * themeVars则返回undefined，代表不分类
 */
function getVariableLibrary(name: string, themeVars: ThemeVar[]): VariableLibraryValue {
  if (!themeVars.length) return undefined;
  if (themeVars.some((variable) => variable.propertyName === name)) return 'design';
  return 'other';
}

function getVariableParts(title: string): { category: string; itemName: string } {
  const parts = title.split('/').filter(Boolean);
  let targetCategoryPartCount = 2;

  const categoryPartCount = Math.min(targetCategoryPartCount, Math.max(parts.length - 1, 0));
  return {
    category: parts.slice(0, categoryPartCount).join('/'),
    itemName: parts.slice(categoryPartCount).join('/') || title,
  };
}

interface VariableListProps<T extends CssVarOption> {
  list: T[];
  /** 当前已绑定的变量，支持 var(--x) 或 --x */
  selectedName?: string;
  /** 弹层是否打开：打开时把选中项滚动到可视区中部 */
  open: boolean;
  onSelect: (item: T) => void;
  /** 传入后支持 Esc 关闭 */
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
  filterPlaceholder = lang.searchPlaceholder,
  emptyText = lang.noVariables,
  autoFocus = true,
}: VariableListProps<T>) {
  const [keyword, setKeyword] = useState('');
  const [selectedLibrary, setSelectedLibrary] = useState<VariableLibrary | 'all'>('all');
  const libraryLabels = getLibraryLabels();
  const listRef = useRef<HTMLDivElement>(null);
  const normalizedSelectedName = getCssVarName(selectedName);
  const themeVars = useThemeVars();
  const hasThemeVars = themeVars.length > 0;
  const displayItems = useMemo<VariableDisplayItem<T>[]>(() => {
    const displayTitleMap = new Map<string, string>();
    const deduped = new Map<string, T>();
    list.forEach((item) => {
      const title = formatCssVarTitle(item.name, themeVars);
      displayTitleMap.set(item.name, title);
      if (!deduped.has(item.name)) deduped.set(item.name, item);
    });

    return Array.from(deduped.values()).map((item) => {
      const title = displayTitleMap.get(item.name) ?? item.name;
      const library = getVariableLibrary(item.name, themeVars);
      return { item, title, ...getVariableParts(title), library };
    }).sort((left, right) => {
      const libraryResult = libraryOrder.indexOf(left.library) - libraryOrder.indexOf(right.library);
      if (libraryResult !== 0) return libraryResult;
      return left.category.localeCompare(right.category);
    });
  }, [list, themeVars]);

  const selectedItem = useMemo(
    () => displayItems.find(({ item }) => getCssVarName(item.name) === normalizedSelectedName),
    [displayItems, normalizedSelectedName]
  );

  useEffect(() => {
    if (!hasThemeVars) {
      setSelectedLibrary('all');
    } else if (open && selectedItem) {
      setSelectedLibrary(selectedItem.library);
    }
  }, [hasThemeVars, open, selectedItem]);

  const filteredItems = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase();
    return displayItems.filter(({ item, title, category, itemName, library }) => {
      if (selectedLibrary !== 'all' && library !== selectedLibrary) return false;
      if (!trimmed) return true;
      return [item.name, title, category, itemName].some((value) => value.toLowerCase().includes(trimmed));
    });
  }, [keyword, displayItems, selectedLibrary]);

  const groupedItems = useMemo(() => {
    const groups: Array<{ library: VariableLibraryValue; category: string; items: VariableDisplayItem<T>[] }> = [];
    filteredItems.forEach((displayItem) => {
      const group = groups.find(
        (candidate) => candidate.library === displayItem.library && candidate.category === displayItem.category
      );
      if (group) group.items.push(displayItem);
      else groups.push({ library: displayItem.library, category: displayItem.category, items: [displayItem] });
    });
    return groups;
  }, [filteredItems]);

  useEffect(() => {
    if (!open || !selectedName) return;
    let centerFrame: number | undefined;
    const renderFrame = window.requestAnimationFrame(() => {
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
  }, [open, selectedName, filteredItems]);

  const libraryOptions = [
    { label: libraryLabels.all, value: 'all' },
    ...libraryOrder.map((library) => ({ label: libraryLabels[library], value: library })),
  ];
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
      </div>
      {hasThemeVars && <div className={css.libraryFilter}>
        <Dropdown
          value={selectedLibrary}
          options={libraryOptions}
          onClick={(value) => setSelectedLibrary(value as VariableLibrary | 'all')}
        >
          <div className={css.librarySelect}>
            <span>{libraryLabels[selectedLibrary]}</span>
            <DownOutlined />
          </div>
        </Dropdown>
      </div>}
      <div ref={listRef} className={css.variableList}>
        {filteredItems.length === 0 && <div className={css.empty}>{emptyText}</div>}
        {groupedItems.map(({ library, category, items }, index) => (
          <React.Fragment key={`${library}-${category}`}>
            {hasThemeVars && library && selectedLibrary === 'all' && (index === 0 || groupedItems[index - 1].library !== library) && (
              <div className={css.libraryTitle}>{libraryLabels[library]}</div>
            )}
            {category && <div className={css.categoryTitle}>{category}</div>}
            {items.map(({ item, itemName }) => (
              <div
                key={item.name}
                className={css.item}
                data-selected={getCssVarName(item.name) === normalizedSelectedName || undefined}
                onClick={() => onSelect(item)}
              >
                <span className={css.itemIcon}>
                  {renderIcon ? renderIcon(item) : <VariableNumber />}
                </span>
                <span className={css.itemName}>{itemName}</span>
                <span className={css.itemValue}>
                  {renderValue ? renderValue(item) : formatLengthDisplay(item.value)}
                </span>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
