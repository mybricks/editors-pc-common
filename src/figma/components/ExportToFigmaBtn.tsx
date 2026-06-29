import React from 'react';
import { useExportToFigma, FontfaceConfig } from '../hooks/useExportToFigma';
import { CheckIcon } from './CheckIcon';
import { SpinIcon } from './SpinIcon';
import { figmaButtonStyle } from './styles';

/** 变体库映射状态图标（上下左右 4 菱形十字布局，Figma component set 风格） */
function VariantIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--mybricks-color-primary, #1677ff)' : 'var(--mybricks-text-color-secondary, #aaa)';
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M7 0.5 L10 3.5 L7 6.5 L4 3.5 Z" />
      <path d="M7.5 7 L10.5 4 L13.5 7 L10.5 10 Z" />
      <path d="M7 7.5 L10 10.5 L7 13.5 L4 10.5 Z" />
      <path d="M0.5 7 L3.5 4 L6.5 7 L3.5 10 Z" />
    </svg>
  );
}

/** 自绘 Checkbox，避免宿主全局样式重置导致原生 input 不可见 */
function CustomCheckbox({ checked, indeterminate = false, onChange }: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  const primary = 'var(--mybricks-color-primary, #1677ff)';
  const filled = checked || indeterminate;
  return (
    <span
      onClick={e => { e.stopPropagation(); onChange(); }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 13,
        height: 13,
        flexShrink: 0,
        borderRadius: 2,
        border: `1.5px solid ${filled ? primary : 'rgba(0,0,0,0.25)'}`,
        backgroundColor: filled ? primary : 'transparent',
        cursor: 'pointer',
        boxSizing: 'border-box',
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      {indeterminate && !checked ? (
        <svg width="7" height="2" viewBox="0 0 7 2" fill="none">
          <rect x="0" y="0.5" width="7" height="1" rx="0.5" fill="#fff" />
        </svg>
      ) : checked ? (
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M1 3 L3 5 L7 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}

/** 向下箭头图标，用于页面选择下拉触发按钮 */
function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 3.5 L5 6.5 L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type PageInfo = {
  element: Element;
  title: string;
  kind: string;
};

export interface ExportToFigmaBtnProps {
  comEle: HTMLElement | null | undefined;
  comId: string;
  fontfaces?: FontfaceConfig[];
  getCanvasList?: () => ArrayLike<Element>;
}

export function ExportToFigmaBtn({ comEle, comId, fontfaces, getCanvasList }: ExportToFigmaBtnProps) {
  const [componentLibraryEnabled, setComponentLibraryEnabled] = React.useState(false);
  const [pageDropdownVisible, setPageDropdownVisible] = React.useState(false);
  const [pageInfos, setPageInfos] = React.useState<PageInfo[]>([]);
  // null = 全选（默认），Set = 具体选中的索引集合
  const [selectedIndices, setSelectedIndices] = React.useState<Set<number> | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // 将当前选择状态同步到 ref，供 getEffectiveCanvasList 在导出时读取
  const selectionRef = React.useRef<{ indices: Set<number> | null; infos: PageInfo[] }>({ indices: null, infos: [] });
  selectionRef.current = { indices: selectedIndices, infos: pageInfos };

  // 有具体选择时返回过滤后的元素列表，否则直接透传原始 getCanvasList（零额外开销）
  const getEffectiveCanvasList = React.useCallback((): ArrayLike<Element> => {
    const { indices, infos } = selectionRef.current;
    if (indices === null || infos.length === 0) {
      return getCanvasList?.() ?? [];
    }
    return infos.filter((_, i) => indices.has(i)).map(p => p.element);
  }, [getCanvasList]);

  const isMultiCanvas = !comEle;

  const { loading, progress, handleExport, pendingClipboardHtml, handleRetryClipboard } = useExportToFigma(
    comEle,
    comId,
    // 单组件导出走原始 getCanvasList；多画布导出走 getEffectiveCanvasList 以支持页面过滤
    { fontfaces, getCanvasList: isMultiCanvas ? getEffectiveCanvasList : getCanvasList, componentLibraryEnabled }
  );

  // 点击区域外关闭下拉
  React.useEffect(() => {
    if (!pageDropdownVisible) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPageDropdownVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pageDropdownVisible]);


  const handleOpenDropdown = React.useCallback(() => {
    if (pageDropdownVisible) {
      setPageDropdownVisible(false);
      return;
    }
    const list = getCanvasList?.() ?? [];
    const infos: PageInfo[] = Array.from(list).map(el => ({
      element: el,
      title: el.getAttribute('data-zone-title') || '未命名页面',
      kind: el.getAttribute('data-zone-kind') || 'page',
    }));
    setPageInfos(infos);
    setPageDropdownVisible(true);
  }, [pageDropdownVisible, getCanvasList]);

  const handleToggleIndex = React.useCallback((i: number) => {
    setSelectedIndices(prev => {
      const total = selectionRef.current.infos.length;
      const allSet = new Set(Array.from({ length: total }, (_, idx) => idx));
      const current = prev === null ? allSet : prev;
      const next = new Set(current);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next.size === total ? null : next; // 全选时重置为 null
    });
  }, []);

  const handleToggleAll = React.useCallback(() => {
    setSelectedIndices(prev => {
      const total = selectionRef.current.infos.length;
      const isAll = prev === null || prev.size === total;
      // 当前全选 → 取消全选（空集合）；否则 → 全选（null）
      return isAll ? new Set<number>() : null;
    });
  }, []);

  const isAllSelected = selectedIndices === null || selectedIndices.size === pageInfos.length;
  const selectedCount = selectedIndices === null ? pageInfos.length : selectedIndices.size;
  const noneSelected = selectedIndices !== null && selectedIndices.size === 0;

  const mainBtnLabel = React.useMemo(() => {
    if (!isMultiCanvas) return '复制到 Figma';
    if (noneSelected) return '请先选择页面';
    if (selectedIndices !== null && pageInfos.length > 0 && selectedCount < pageInfos.length) {
      return `复制 ${selectedCount} 个页面到 Figma`;
    }
    return '复制全部页面到 Figma';
  }, [isMultiCanvas, selectedIndices, selectedCount, pageInfos.length, noneSelected]);

  function renderPageDropdown() {
    if (!pageDropdownVisible || pageInfos.length === 0) return null;
    return (
      <div style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 2,
        background: 'var(--mybricks-bg-color-main, #fff)',
        border: '1px solid rgba(2, 9, 16, 0.13)',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        zIndex: 9999,
        overflow: 'hidden',
      }}>
        {/* 全选行 */}
        <div
          onClick={handleToggleAll}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            cursor: 'pointer',
            borderBottom: '1px solid rgba(2,9,16,0.06)',
            fontSize: 12,
            color: 'var(--mybricks-text-color-main)',
          }}
        >
          <CustomCheckbox
            checked={isAllSelected}
            indeterminate={!isAllSelected && selectedCount > 0}
            onChange={handleToggleAll}
          />
          <span>全选</span>
          <span style={{ marginLeft: 'auto', color: 'var(--mybricks-text-color-secondary, #999)', fontSize: 11 }}>
            {selectedCount} / {pageInfos.length}
          </span>
        </div>
        {/* 页面列表 */}
        {pageInfos.map((info, i) => {
          const checked = selectedIndices === null || selectedIndices.has(i);
          return (
            <div
              key={i}
              onClick={() => handleToggleIndex(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--mybricks-text-color-main)',
              }}
            >
              <CustomCheckbox
                checked={checked}
                onChange={() => handleToggleIndex(i)}
              />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {info.title}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  function renderButtons(retryLabel?: React.ReactNode) {
    const isRetry = !!retryLabel;
    // 页面选择按钮仅在多画布正常状态下显示（非 loading、非 retry）
    const showPageSelect = isMultiCanvas && !isRetry && !loading;

    return (
      <div ref={dropdownRef} style={{ padding: '4px 0', display: 'flex', position: 'relative' }}>

        {/* Split-button 外壳：主区 + 箭头区视觉上是一整块 */}
        <div style={{
          display: 'flex',
          flex: 1,
          borderRadius: 6,
          border: `1px solid var(--mybricks-border-color, rgba(0,0,0,0.15))`,
          overflow: 'hidden',
          marginRight: 4,
        }}>
          {/* 主区 */}
          <button
            type="button"
            disabled={loading}
            onClick={loading ? undefined : (noneSelected ? handleOpenDropdown : (isRetry ? handleRetryClipboard : handleExport))}
            style={{
              ...figmaButtonStyle,
              flex: 1,
              border: 'none',
              borderRadius: 0,
              cursor: loading ? 'default' : 'pointer',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {loading && (
              <>
                <div style={{ position: 'absolute', inset: 0, background: 'var(--mybricks-border-color, rgba(0,0,0,0.12))', opacity: 0.35 }} />
                <div style={{
                  position: 'absolute', top: 0, left: 0, height: '100%',
                  width: `${Math.min(Math.max(progress.percent, 0), 100)}%`,
                  background: 'var(--mybricks-color-primary, #1677ff)',
                  opacity: 0.22,
                  transition: 'width 320ms ease-out',
                }} />
              </>
            )}
            <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', width: '100%' }}>
              {isRetry ? (
                retryLabel
              ) : loading ? (
                <>
                  <SpinIcon />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1, minWidth: 0 }}>
                    {progress.text}
                  </span>
                  <span style={{ flexShrink: 0, marginLeft: 4 }}>{Math.round(progress.percent)}%</span>
                </>
              ) : (
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mainBtnLabel}</span>
              )}
            </span>
          </button>

          {/* 箭头区：细分隔线 + 下拉触发 */}
          {showPageSelect && (
            <>
              <div style={{
                width: 1,
                alignSelf: 'stretch',
                background: 'var(--mybricks-border-color, rgba(0,0,0,0.15))',
                flexShrink: 0,
              }} />
              <button
                type="button"
                onClick={handleOpenDropdown}
                data-mybricks-tip={`{"content":"选择要导出的页面","position":"left"}`}
                style={{
                  ...figmaButtonStyle,
                  width: 24,
                  flex: 'none',
                  border: 'none',
                  borderRadius: 0,
                  padding: 0,
                  backgroundColor: pageDropdownVisible ? 'rgba(22,119,255,0.07)' : figmaButtonStyle.backgroundColor,
                  color: pageDropdownVisible ? 'var(--mybricks-color-primary, #1677ff)' : 'var(--mybricks-text-color-secondary, #999)',
                }}
              >
                <ChevronDownIcon />
              </button>
            </>
          )}
        </div>

        {/* 变体库映射切换按钮 */}
        <button
          type="button"
          onClick={() => setComponentLibraryEnabled(prev => !prev)}
          data-mybricks-tip={`{"content":"${componentLibraryEnabled ? '点击关闭变体库映射' : '点击开启变体库映射'}","position":"left"}`}
          style={{
            ...figmaButtonStyle,
            width: 28,
            flex: 'none',
            borderRadius: 6,
            padding: 0,
            backgroundColor: componentLibraryEnabled
              ? 'rgba(22,119,255,0.07)'
              : figmaButtonStyle.backgroundColor,
          }}
        >
          <VariantIcon active={componentLibraryEnabled} />
        </button>

        {/* 页面选择下拉面板 */}
        {renderPageDropdown()}
      </div>
    );
  }

  if (pendingClipboardHtml) {
    return renderButtons(
      <>
        <CheckIcon />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          复制已生成的 Figma 数据
        </span>
      </>
    );
  }

  return renderButtons();
}
