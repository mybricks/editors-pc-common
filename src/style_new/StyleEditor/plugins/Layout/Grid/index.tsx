import React, { useRef, useState } from 'react';
import { Input, InputNumber, incrementDecrement, Select, Dropdown, DownOutlined, SketchPopup } from '../../../components';
import { useStyleEditorContext } from '../../../context';
import { useDragNumber } from '../../../hooks/useDragNumber';
import { FixedWidth } from '../../../icons/FixedWidth';
import { FillContainer } from '../../../icons/FillContainer';
import { HugContents } from '../../../icons/HugContents';
import Icon from '../Icon';
import { parseTracks, resizeTracks, serializeTracks, Track } from './value';
import lang from '../../../../index.i18n';
import styles from './index.less';

interface GridValue {
  gridTemplateColumns?: string | null;
  gridTemplateRows?: string | null;
  gridAutoRows?: string | null;
}

function TrackValueInput({ track, onChange }: { track: Track; onChange: (track: Track) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commitValue = (next: string) => {
    // 仅提交非负数字或数字 + fr，并按输入切换固定/填满；无效草稿恢复当前轨道值。
    const match = next.trim().match(/^(\d+(?:\.\d*)?|\.\d+)(fr)?$/i);
    setDraft(null);
    if (match) {
      const nextValue = Number(match[1]);
      const mode = match[2] ? 'fill' : 'fixed';
      if (Number.isFinite(nextValue) && (nextValue !== track.value || mode !== track.mode)) {
        onChange({ mode, value: nextValue });
      }
    }
  };

  return <Input
    value={draft ?? `${track.value}${track.mode === 'fill' ? 'fr' : ''}`}
    onChange={setDraft}
    onBlur={event => commitValue(event.currentTarget.value)}
    onKeyDown={event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.blur();
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const text = event.currentTarget.value.trim();
        const number = text.replace(/fr$/i, '');
        const next = `${incrementDecrement(number, event.key)}${/fr$/i.test(text) ? 'fr' : ''}`;
        setDraft(next);
        event.currentTarget.value = next;
        event.currentTarget.select();
        event.preventDefault();
      }
    }}
    suffix={track.mode === 'fill' && <Dropdown
      value={track.value}
      options={[0.25, 0.5, 0.75, 1, 2, 3, 4, 5].map(value => ({ value, label: `${value}fr` }))}
      onClick={next => commitValue(`${next}fr`)}
    >
      <span style={{ display: 'flex', justifyContent: 'center', width: 16, marginRight: 6, fontSize: 10, opacity: 0.55, cursor: 'pointer' }}>
        <DownOutlined />
      </span>
    </Dropdown>}
  />;
}

function TrackInput({ axis, track, onChange }: { axis: 'column' | 'row'; track: Track; onChange: (track: Track) => void }) {
  const optionStyle = { '--dropdown-suffix-opacity': 1 } as React.CSSProperties;
  return <div className={styles.trackInput}>
    <Select
      value={track.mode}
      showSelectedSuffix={false}
      labelStyle={{ textAlign: 'left', padding: 0 }}
      iconClassName={styles.trackArrow}
      options={[
        { value: 'fixed', label: lang.gridFixed, menuLabel: axis === 'column' ? lang.gridFixedWidth : lang.gridFixedHeight, suffix: `(${track.mode === 'fixed' ? track.value : 100})`, icon: <FixedWidth />, style: optionStyle },
        { value: 'hug', label: lang.sizeAdaptive, menuLabel: lang.gridHugContents, icon: <HugContents /> },
        { value: 'fill', label: lang.sizeFillBadge, menuLabel: lang.gridFillContainer, suffix: `(${track.mode === 'fill' ? track.value : 1}fr)`, icon: <FillContainer />, style: optionStyle },
      ]}
      onChange={(mode: Track['mode']) => onChange(mode === 'hug' ? { mode } : { mode, value: mode === 'fixed' ? 100 : 1 })}
    />
    {track.mode !== 'hug' && <TrackValueInput key={track.mode} track={track} onChange={onChange} />}
  </div>;
}

export default function Grid({ value, onChange, onRemoveLayout }: { value: GridValue; onChange: (patch: GridValue) => void; onRemoveLayout: () => void }) {
  const targetDom = useStyleEditorContext()?.targetDom;
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<'picker' | 'settings' | null>(null);
  const [hover, setHover] = useState<{ columns: number; rows: number } | null>(null);
  const [countDragStart, setCountDragStart] = useState<{ columns: number; rows: number } | null>(null);
  const [countPreviewLocked, setCountPreviewLocked] = useState(false);
  const countDraggingRef = useRef(false);
  const [selectedTrack, setSelectedTrack] = useState<{ axis: 'column' | 'row'; index: number } | null>(null);
  const [dragTrack, setDragTrack] = useState<{ axis: 'column' | 'row'; index: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ axis: 'column' | 'row'; index: number; half: 'top' | 'bottom' } | null>(null);
  const declaredColumns = parseTracks(value.gridTemplateColumns);
  const columns = declaredColumns.length ? declaredColumns : resizeTracks([], 1);
  const rows = parseTracks(value.gridTemplateRows);
  const autoRows = rows.length === 0;
  // Auto 按实际行数展示预览和设置列表，轨道尺寸仍读取 gridAutoRows，避免写入 computed 像素值。
  const previewRowCount = autoRows && targetDom
    ? parseTracks(window.getComputedStyle(targetDom).gridTemplateRows).length
    : rows.length;
  const summary = `${columns.length} × ${autoRows ? lang.gridAuto : rows.length}`;

  const changeCount = (axis: 'column' | 'row', next: string | null) => {
    if (next === null) return;
    if (!countDraggingRef.current) {
      setCountDragStart(null);
      setCountPreviewLocked(false);
    }
    const count = Math.max(1, parseInt(next, 10));
    onChange({
      [axis === 'column' ? 'gridTemplateColumns' : 'gridTemplateRows']:
        serializeTracks(resizeTracks(axis === 'column' ? columns : rows, count)),
    });
  };
  const selectAutoRows = () => {
    setCountDragStart(null);
    setCountPreviewLocked(false);
    onChange({ gridTemplateRows: 'none', gridAutoRows: value.gridAutoRows || '1fr' });
  };

  // 拖动仍由公共 hook 处理；保留首次拖动前的范围，恢复悬停后也沿用这一基准。
  const countDragOptions = (axis: 'column' | 'row', currentCount: number) => ({
    min: 1, sensitivity: 0.1, continuous: true, endWithLastDraggedValue: true,
    onDragStart: (count: number) => {
      countDraggingRef.current = true;
      setHover(null);
      setCountDragStart(start => start ?? { columns: columns.length, rows: previewRowCount });
      setCountPreviewLocked(true);
      return count;
    },
    onDragEnd: (count: number) => {
      if (count !== currentCount) changeCount(axis, String(count));
      // 松手后保留范围高亮；延迟解除拖动态，避免同次弹窗外 click 关闭弹窗。
      requestAnimationFrame(() => { countDraggingRef.current = false; });
    },
  });
  const getColumnCountDragProps = useDragNumber(countDragOptions('column', columns.length));
  const getRowCountDragProps = useDragNumber(countDragOptions('row', previewRowCount || 1));

  const renderTracks = (axis: 'column' | 'row') => {
    let tracks = axis === 'column' ? columns : rows;
    if (axis === 'row' && autoRows) {
      const autoTracks = parseTracks(value.gridAutoRows || '1fr');
      tracks = Array.from({ length: previewRowCount }, (_, index) => autoTracks[index % autoTracks.length]);
    }
    const key = axis === 'column' ? 'gridTemplateColumns' : 'gridTemplateRows';
    const removeLabel = (axis === 'column' ? lang.gridRemoveColumn : lang.gridRemoveRow).replace('{count}', String(tracks.length));
    const dropIndex = dropTarget?.axis === axis ? dropTarget.index + (dropTarget.half === 'bottom' ? 1 : 0) : null;
    const showDropIndicator = dragTrack?.axis === axis && dropIndex !== null
      && dropIndex !== dragTrack.index && dropIndex !== dragTrack.index + 1;
    return <section className={styles.tracks}
      onDragOver={event => {
        // 整个轴列表接收拖动，标题和行间空隙也对应到明确的插入位置。
        if (dragTrack?.axis !== axis) {
          setDropTarget(null);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        const rects = Array.from(event.currentTarget.querySelectorAll(`.${styles.trackRow}`))
          .map(row => row.getBoundingClientRect());
        const nextIndex = rects.findIndex(rect => event.clientY < rect.top + rect.height / 2);
        setDropTarget(nextIndex === -1
          ? { axis, index: tracks.length - 1, half: 'bottom' }
          : { axis, index: nextIndex, half: 'top' });
      }}
      onDrop={event => {
        if (dragTrack?.axis !== axis || dropIndex === null) return;
        event.preventDefault();
        event.stopPropagation();
        // 放置与已显示的插入线共用目标，不在松手时重新按鼠标坐标计算。
        let insertAt = dropIndex;
        if (dragTrack.index < insertAt) insertAt -= 1;
        setDragTrack(null);
        setDropTarget(null);
        if (dragTrack.index === insertAt) return;

        const updated = tracks.slice();
        const [moved] = updated.splice(dragTrack.index, 1);
        updated.splice(insertAt, 0, moved);
        setSelectedTrack({ axis, index: insertAt });
        // 松手只提交一次；自动行沿用尺寸编辑的写法，保留自动行数。
        onChange({ [axis === 'row' && autoRows ? 'gridAutoRows' : key]: serializeTracks(updated) });
      }}>
      <div className={styles.trackHeader}>
        <span>{axis === 'column' ? lang.gridColumns : lang.gridRows}</span>
        <button type="button" className={styles.iconButton} aria-label={lang.gridAddTrack}
          onClick={() => onChange({ [key]: serializeTracks(resizeTracks(tracks, tracks.length + 1)) })}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" data-fpl-icon-size="24L" aria-hidden="true">
            <path fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      {tracks.map((track, index) => <div key={index}
        className={[styles.trackRow,
          selectedTrack?.axis === axis && selectedTrack.index === index && styles.trackRowSelected,
          dragTrack?.axis === axis && dragTrack.index === index && styles.trackRowDragging,
        ].filter(Boolean).join(' ')}
        onClickCapture={() => setSelectedTrack({ axis, index })}
        onFocusCapture={() => setSelectedTrack({ axis, index })}>
        {showDropIndicator && dropTarget?.index === index &&
          <div className={styles.dropIndicator} style={{ [dropTarget.half]: -2 }} />}
        <button type="button" className={styles.trackHandle}
          aria-label={`${axis === 'column' ? lang.gridColumns : lang.gridRows} ${index + 1}: ${lang.dragReorderTip}`}
          draggable
          onDragStart={event => {
            event.stopPropagation();
            setSelectedTrack({ axis, index });
            setDragTrack({ axis, index });
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setDragImage(event.currentTarget.parentElement!, 12, 12);
          }}
          onDragEnd={() => { setDragTrack(null); setDropTarget(null); }}>
          <span className={styles.trackIndex}>{index + 1}</span>
          <svg className={styles.trackGrip} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
            <path fill="currentColor" fillRule="evenodd" d="M11 11.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1 0-1h5a.5.5 0 0 1 .5.5M11 8a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1 0-1h5a.5.5 0 0 1 .5.5m0-3.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1 0-1h5a.5.5 0 0 1 .5.5" clipRule="evenodd" />
          </svg>
        </button>
        <TrackInput axis={axis} track={track} onChange={next => {
          const updated = tracks.slice();
          updated[index] = next;
          onChange({ [axis === 'row' && autoRows ? 'gridAutoRows' : key]: serializeTracks(updated) });
        }} />
        <button type="button" className={styles.iconButton}
          aria-label={removeLabel.replace('{index}', String(index + 1))}
          data-mybricks-tip={removeLabel.replace('{index}', String(index + 1))}
          onClick={() => {
            // 最后一条直接退出布局，避免先提交空轨道再切换默认。
            if (tracks.length === 1) {
              setSelectedTrack(null);
              onRemoveLayout();
              return;
            }
            setSelectedTrack({ axis, index: Math.min(index, tracks.length - 2) });
            onChange({ [key]: serializeTracks(tracks.filter((_, i) => i !== index)) });
          }}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" data-fpl-icon-size="24L" aria-hidden="true">
            <path fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M6 12a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11A.5.5 0 0 1 6 12" clipRule="evenodd" />
          </svg>
        </button>
      </div>)}
    </section>;
  };

  return <div className={styles.grid}>
    <div className={styles.label}>{lang.gridLabel}</div>
    <button type="button" ref={anchorRef} className={styles.summary} onClick={() => {
      setHover(null);
      setCountDragStart(null);
      setCountPreviewLocked(false);
      setSelectedTrack(null);
      setView('picker');
      // Temporary style-instrument-debug: 验收确认后删除。
      void fetch('http://127.0.0.1:4318/logs', {
        method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ sessionId: 'grid-card1-20261103', event: 'grid-picker-open', time: new Date().toISOString(),
          data: { columns: columns.length, autoRows, previewRowCount } }),
      }).catch(() => {});
    }}
      style={{ backgroundSize: `${100 / columns.length}% ${100 / (previewRowCount || 1)}%` }}>
      <span>{summary}</span>
    </button>
    <SketchPopup open={view !== null} mounted={view !== null} anchorRef={anchorRef} onClose={() => { if (!countDraggingRef.current) setView(null); }}
      className={[styles.popup, view === 'settings' && styles.settingsPopup].filter(Boolean).join(' ')} repositionKey={`${view}-${columns.length}-${rows.length}`}>
      <div className={styles.header}>
        <span>{view === 'settings' ? lang.gridSettings : lang.gridLabel}</span>
        <button type="button" className={styles.iconButton} onClick={() => setView(null)} aria-label={lang.close}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" data-fpl-icon-size="24L" aria-hidden="true">
            <path fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M17.354 6.646a.5.5 0 0 1 0 .708L12.707 12l4.647 4.646a.5.5 0 0 1-.708.708L12 12.707l-4.646 4.647a.5.5 0 0 1-.708-.708L11.293 12 6.646 7.354a.5.5 0 0 1 .708-.707L12 11.293l4.646-4.647a.5.5 0 0 1 .708 0" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      {view === 'picker' && <div className={styles.counts}>
        <InputNumber value={columns.length} prefix={<div {...getColumnCountDragProps(columns.length, lang.gridColumnCount)}><Icon name="grid-columns" /></div>} tip={lang.gridColumnCount}
          defaultUnitValue="" clearable={false} onChange={next => changeCount('column', next)} />
        <span>×</span>
        <InputNumber value={autoRows ? null : rows.length} placeholder={lang.gridAuto}
          prefix={<div {...getRowCountDragProps(previewRowCount || 1, lang.gridRowCount)}><Icon name="grid-rows" /></div>}
          tip={lang.gridRowCount} defaultUnitValue="" clearable={false}
          suffix={<Select
            value={autoRows ? 'auto' : 'fixed'}
            hideLabel
            style={{ width: 16, padding: 0, fontSize: 10 }}
            options={[
              { value: 'fixed', label: String(previewRowCount) },
              { value: 'auto', label: lang.gridAuto },
            ]}
            onChange={mode => mode === 'auto' ? selectAutoRows() : changeCount('row', String(previewRowCount))}
          />}
          onChange={next => changeCount('row', next)} />
      </div>}
      {view === 'picker' ? <>
        <div className={styles.picker} onMouseLeave={() => setHover(null)}>
          {Array.from({ length: 12 * 8 }, (_, index) => {
            const column = index % 12 + 1;
            const row = Math.floor(index / 12) + 1;
            const selected = column <= (countDragStart?.columns ?? columns.length) && row <= (countDragStart?.rows ?? previewRowCount);
            const preview = countPreviewLocked
              ? column <= columns.length && row <= previewRowCount
              : hover && column <= hover.columns && row <= hover.rows;
            return <button type="button" key={index} aria-label={`${column} × ${row}`}
              data-mybricks-tip={JSON.stringify({ content: `${column} × ${row}`, position: 'bottom' })}
              className={[styles.cell, selected && styles.selected, preview && styles.preview].filter(Boolean).join(' ')}
              onMouseEnter={() => {
                if (countPreviewLocked) return;
                setHover({ columns: column, rows: row });
                // Temporary style-instrument-debug: 验收确认后删除。
                void fetch('http://127.0.0.1:4318/logs', {
                  method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
                  body: JSON.stringify({ sessionId: 'grid-card1-20261103', event: 'grid-picker-hover', time: new Date().toISOString(),
                    data: { columns: column, rows: row } }),
                }).catch(() => {});
              }}
              onClick={() => {
                // 数量拖动后保留高亮，首次点击格子盘只恢复悬停预览。
                if (countPreviewLocked) {
                  setCountPreviewLocked(false);
                  setHover({ columns: column, rows: row });
                  return;
                }
                onChange({
                  gridTemplateColumns: serializeTracks(resizeTracks(columns, column)),
                  gridTemplateRows: serializeTracks(resizeTracks(rows, row)),
                });
                setView(null);
              }} />;
          })}
        </div>
        <button type="button" className={styles.settingsButton} onClick={() => setView('settings')}>{lang.gridOpenSettings}</button>
      </> : <div className={styles.trackList} onDragOver={() => setDropTarget(null)} onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null);
      }}>{renderTracks('column')}{renderTracks('row')}</div>}
    </SketchPopup>
  </div>;
}
