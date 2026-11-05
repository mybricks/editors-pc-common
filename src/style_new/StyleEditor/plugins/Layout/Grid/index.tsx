import React, { useRef, useState } from 'react';
import { Input, InputNumber, incrementDecrement, Select, Dropdown, DownOutlined, SketchPopup, VariableChip, buildDetachMenuOptions } from '../../../components';
import { useStyleEditorContext } from '../../../context';
import { useDragNumber } from '../../../hooks/useDragNumber';
import { FixedWidth } from '../../../icons/FixedWidth';
import { FillContainer } from '../../../icons/FillContainer';
import { HugContents } from '../../../icons/HugContents';
import Icon from '../Icon';
import { parseTrackList, parseTracks, resizeTracks, serializeTrackList, resolveAutoRepeat, resolveVariableTracks, getTrackDisplay, createTrack, updateTrackValue, MAX_EDITABLE_TRACKS, Track, TrackListResult } from './value';
import lang from '../../../../index.i18n';
import styles from './index.less';

interface GridValue {
  gridTemplateColumns?: string | null;
  gridTemplateRows?: string | null;
  gridAutoRows?: string | null;
}

function TrackValueInput({ track, variableSource, variableValue, actualSize, onChange }: {
  track: Track; variableSource?: string; variableValue?: string; actualSize?: number; onChange: (track: Track) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = getTrackDisplay(track);
  const commitValue = (next: string) => {
    // 仅提交非负数字或数字 + fr，并按输入切换固定/填满；无效草稿恢复当前轨道值。
    const match = next.trim().match(/^(\d+(?:\.\d*)?|\.\d+)(fr)?$/i);
    setDraft(null);
    if (match) {
      const nextValue = Number(match[1]);
      const mode = match[2] ? 'fill' : 'fixed';
      if (Number.isFinite(nextValue) && (variableSource || nextValue !== display.value || mode !== display.mode)) {
        onChange(updateTrackValue(track, nextValue, mode));
      }
    }
  };

  if (variableSource) {
    const text = display.mode === 'hug' && actualSize !== undefined ? String(actualSize) : display.text;
    return <VariableChip value={variableSource} resolvedValue={variableValue} display={text} defaultUnit=""
      menuOptions={display.mode === 'fill'
        ? [0.25, 0.5, 0.75, 1, 2, 3, 4, 5].map(value => ({ value: `${value}fr`, label: `${value}fr` }))
        : buildDetachMenuOptions(text)}
      onMenuSelect={commitValue} onMenuAction={() => onChange(track)}
      onInputValue={commitValue} onDetach={() => onChange(track)} />;
  }

  return <Input
    value={draft ?? display.text}
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
    suffix={display.mode === 'fill' && <Dropdown
      value={display.value}
      options={[0.25, 0.5, 0.75, 1, 2, 3, 4, 5].map(value => ({ value, label: `${value}fr` }))}
      onClick={next => commitValue(`${next}fr`)}
    >
      <span style={{ display: 'flex', justifyContent: 'center', width: 16, marginRight: 6, fontSize: 10, opacity: 0.55, cursor: 'pointer' }}>
        <DownOutlined />
      </span>
    </Dropdown>}
  />;
}

function TrackInput({ axis, track, actualSize, variableSource, variableValue, onChange }: {
  axis: 'column' | 'row'; track: Track; actualSize?: number; variableSource?: string; variableValue?: string; onChange: (track: Track) => void;
}) {
  const optionStyle = { '--dropdown-suffix-opacity': 1 } as React.CSSProperties;
  const display = getTrackDisplay(track);
  return <div className={styles.trackInput}>
    <Select
      value={display.mode === 'raw' ? '' : display.mode}
      displayValue={display.mode === 'raw' ? 'CSS' : undefined}
      tip={display.mode === 'raw' ? lang.gridCssValueTip : track.kind === 'minmax' ? track.raw : undefined}
      showSelectedSuffix={false}
      labelStyle={{ textAlign: 'left', padding: 0 }}
      iconClassName={styles.trackArrow}
      options={[
        { value: 'fixed', label: lang.gridFixed, menuLabel: axis === 'column' ? lang.gridFixedWidth : lang.gridFixedHeight, suffix: `(${display.mode === 'fixed' ? display.value : 100})`, icon: <FixedWidth />, style: optionStyle },
        { value: 'hug', label: lang.sizeAdaptive, menuLabel: lang.gridHugContents, icon: <HugContents /> },
        { value: 'fill', label: lang.sizeFillBadge, menuLabel: lang.gridFillContainer, suffix: `(${display.mode === 'fill' ? display.value : 1}fr)`, icon: <FillContainer />, style: optionStyle },
      ]}
      onChange={(mode: 'fixed' | 'fill' | 'hug') => {
        if (track.kind === 'minmax' && mode === display.mode) {
          if (variableSource) onChange(track);
          return;
        }
        onChange(createTrack(mode));
      }}
    />
    {variableSource ? <TrackValueInput track={track} variableSource={variableSource} variableValue={variableValue} actualSize={actualSize} onChange={onChange} />
      : display.mode === 'raw' ? <Input value={display.text} tip={display.text} disabled />
      : display.mode === 'hug' ? <Input value={actualSize} disabled />
      : <TrackValueInput key={display.mode} track={track} onChange={onChange} />}
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
  const countDragRepeatRef = useRef<Track>();
  const countDragVariableRef = useRef(false);
  const [selectedTrack, setSelectedTrack] = useState<{ axis: 'column' | 'row'; index: number } | null>(null);
  const [dragTrack, setDragTrack] = useState<{ axis: 'column' | 'row'; index: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ axis: 'column' | 'row'; index: number; half: 'top' | 'bottom' } | null>(null);
  let columnList = parseTrackList(value.gridTemplateColumns);
  let rowList = parseTrackList(value.gridTemplateRows);
  if (targetDom) {
    if (columnList.kind === 'readonly') {
      const computed = window.getComputedStyle(targetDom).gridTemplateColumns;
      columnList = resolveVariableTracks(columnList, targetDom, computed);
      if (columnList.kind === 'readonly') columnList = resolveAutoRepeat(columnList, computed);
    }
    if (rowList.kind === 'readonly') {
      const computed = window.getComputedStyle(targetDom).gridTemplateRows;
      rowList = resolveVariableTracks(rowList, targetDom, computed);
      if (rowList.kind === 'readonly') rowList = resolveAutoRepeat(rowList, computed);
    }
  }
  const autoList = parseTrackList(value.gridAutoRows || '1fr');
  // 只有确实没有声明时沿用原有首次编辑预览；未知语法不能变成默认轨道。
  const columns = columnList.kind === 'empty' ? resizeTracks([], 1) : columnList.tracks;
  const rows = rowList.tracks;
  const autoRows = rowList.kind === 'empty';
  const rowEditList = autoRows ? autoList : rowList;
  const columnsEditable = columnList.kind !== 'readonly';
  const rowsEditable = rowEditList.kind !== 'readonly' && (!autoRows || rowEditList.kind === 'tracks');
  const pickerEditable = columnsEditable && rowsEditable;
  // 未识别的规则仍可展示实际数量，不把计算出的像素尺寸写回。
  const previewColumnCount = !columnsEditable && targetDom
    ? parseTracks(window.getComputedStyle(targetDom).gridTemplateColumns).length
    : columns.length;
  // Auto 按实际行数展示预览和设置列表，轨道尺寸仍读取 gridAutoRows，避免写入 computed 像素值。
  const previewRowCount = (autoRows || !rowsEditable) && targetDom
    ? parseTracks(window.getComputedStyle(targetDom).gridTemplateRows).length
    : rows.length;
  const summary = `${columnsEditable ? columns.length : previewColumnCount || 'CSS'} × ${rowsEditable ? (autoRows ? lang.gridAuto : rows.length) : previewRowCount || 'CSS'}`;

  // 所有轨道编辑共用这一提交入口；只读规则不进入现有 onChange 写入链路。
  const commitTracks = (changes: { key: keyof GridValue; list: TrackListResult; tracks: Track[] }[]) => {
    const patch: GridValue = {};
    for (const { key, list, tracks } of changes) {
      const result = serializeTrackList(list, tracks);
      if (result.kind === 'unsupported') return;
      patch[key] = result.value;
    }
    onChange(patch);
  };

  const changeCount = (axis: 'column' | 'row', next: string | null) => {
    if (next === null) return;
    if (!countDraggingRef.current) {
      setCountDragStart(null);
      setCountPreviewLocked(false);
    }
    const number = Number(next);
    if (!Number.isFinite(number) || !next.trim()) return;
    const count = Math.min(MAX_EDITABLE_TRACKS, Math.max(1, Math.floor(number)));
    const list = axis === 'column' ? columnList : rowEditList;
    if (list.kind === 'auto-repeat' && !list.variableValue && count === list.tracks.length) return;
    commitTracks([{ key: axis === 'column' ? 'gridTemplateColumns' : 'gridTemplateRows',
      list,
      tracks: resizeTracks(axis === 'column' ? columns : rows, count,
        countDragRepeatRef.current || (list.kind === 'auto-repeat' ? list.tracks[0] : undefined)) }]);
  };
  const selectAutoRows = () => {
    setCountDragStart(null);
    setCountPreviewLocked(false);
    onChange({ gridTemplateRows: 'none', gridAutoRows: value.gridAutoRows || '1fr' });
  };

  // 拖动仍由公共 hook 处理；保留首次拖动前的范围，恢复悬停后也沿用这一基准。
  const countDragOptions = (axis: 'column' | 'row', currentCount: number) => ({
    min: 1, max: MAX_EDITABLE_TRACKS, sensitivity: 0.1, continuous: true, endWithLastDraggedValue: true,
    skipInput: !!(axis === 'column' ? columnList : rowEditList).variableValue,
    onDragChange: (axis === 'column' ? columnList : rowEditList).variableValue || countDragVariableRef.current
      ? (count: number) => { if (count !== currentCount) changeCount(axis, String(count)); }
      : undefined,
    onDragStart: (count: number) => {
      countDraggingRef.current = true;
      // 一次连续拖动沿用起始模板，首次提交展开后新增的轨道也保留 minmax。
      const list = axis === 'column' ? columnList : rowEditList;
      countDragVariableRef.current = !!list.variableValue;
      countDragRepeatRef.current = list.kind === 'auto-repeat' ? list.tracks[0] : undefined;
      setHover(null);
      setCountDragStart(start => start ?? { columns: previewColumnCount, rows: previewRowCount });
      setCountPreviewLocked(true);
      return count;
    },
    onDragEnd: (count: number) => {
      if (count !== currentCount) changeCount(axis, String(count));
      // 松手后保留范围高亮；延迟解除拖动态，避免同次弹窗外 click 关闭弹窗。
      requestAnimationFrame(() => {
        countDraggingRef.current = false;
        countDragRepeatRef.current = undefined;
        countDragVariableRef.current = false;
      });
    },
  });
  const getColumnCountDragProps = useDragNumber(countDragOptions('column', columns.length));
  const getRowCountDragProps = useDragNumber(countDragOptions('row', previewRowCount || 1));

  const renderVariableCount = (axis: 'column' | 'row', list: TrackListResult) => {
    const count = String(list.tracks.length);
    return <VariableChip value={list.source} resolvedValue={list.variableValue} display={count} defaultUnit=""
      prefix={<div {...(axis === 'column' ? getColumnCountDragProps(Number(count), lang.gridColumnCount) : getRowCountDragProps(Number(count), lang.gridRowCount))}>
        <Icon name={axis === 'column' ? 'grid-columns' : 'grid-rows'} />
      </div>}
      menuOptions={[
        ...buildDetachMenuOptions(count),
        ...(axis === 'row' ? [{ value: 'auto', label: lang.gridAuto }] : []),
      ]}
      onMenuAction={() => changeCount(axis, count)} onMenuSelect={selectAutoRows}
      onInputValue={next => changeCount(axis, next)} onDetach={() => changeCount(axis, count)} />;
  };

  const renderTracks = (axis: 'column' | 'row') => {
    const list = axis === 'column' ? columnList : rowEditList;
    const label = axis === 'column' ? lang.gridColumns : lang.gridRows;
    if (list.kind === 'readonly' || (axis === 'row' && autoRows && list.kind === 'empty')) {
      return <section className={styles.tracks}>
        <div className={styles.trackHeader}><span>{label}</span></div>
        <div className={styles.ruleValue} title={list.source}>{list.source}</div>
      </section>;
    }
    let tracks = axis === 'column' ? columns : rows;
    if (axis === 'row' && autoRows) {
      tracks = Array.from({ length: previewRowCount }, (_, index) => autoList.tracks[index % autoList.tracks.length]);
    }
    const key = axis === 'column' ? 'gridTemplateColumns' : 'gridTemplateRows';
    // Hug 仅回显浏览器计算的轨道尺寸，不参与轨道模型或 CSS 写回。
    const actualSizes = targetDom && tracks.some(track => getTrackDisplay(track).mode === 'hug')
      ? parseTracks(window.getComputedStyle(targetDom)[key]).map(track => track.kind === 'dimension' ? Math.round(track.value) : undefined)
      : [];
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
        commitTracks([{ key: axis === 'row' && autoRows ? 'gridAutoRows' : key, list, tracks: updated }]);
      }}>
      <div className={styles.trackHeader}>
        <span>{axis === 'column' ? lang.gridColumns : lang.gridRows}</span>
        <button type="button" className={styles.iconButton} aria-label={lang.gridAddTrack}
          disabled={tracks.length >= MAX_EDITABLE_TRACKS}
          onClick={() => commitTracks([{ key, list, tracks: resizeTracks(tracks, tracks.length + 1, list.kind === 'auto-repeat' ? tracks[0] : undefined) }])}>
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
        <TrackInput axis={axis} track={track} actualSize={actualSizes[index]}
          variableSource={list.variableValue ? list.source : undefined} variableValue={list.variableValue} onChange={next => {
          const updated = tracks.slice();
          updated[index] = next;
          commitTracks([{ key: axis === 'row' && autoRows ? 'gridAutoRows' : key, list, tracks: updated }]);
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
            commitTracks([{ key, list, tracks: tracks.filter((_, i) => i !== index) }]);
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
      style={{ backgroundSize: `${100 / (previewColumnCount || 1)}% ${100 / (previewRowCount || 1)}%` }}>
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
        {columnList.variableValue ? renderVariableCount('column', columnList)
          : <InputNumber disabled={!columnsEditable} value={columnsEditable ? columns.length : previewColumnCount || null} placeholder="CSS" prefix={<div {...(columnsEditable ? getColumnCountDragProps(columns.length, lang.gridColumnCount) : {})}><Icon name="grid-columns" /></div>} tip={lang.gridColumnCount}
            defaultUnitValue="" clearable={false} onChange={next => changeCount('column', next)} />}
        <span>×</span>
        {rowList.variableValue ? renderVariableCount('row', rowList)
          : <InputNumber disabled={!rowsEditable} value={!rowsEditable ? previewRowCount || null : autoRows ? null : rows.length} placeholder={rowsEditable ? lang.gridAuto : 'CSS'}
          prefix={<div {...(rowsEditable ? getRowCountDragProps(previewRowCount || 1, lang.gridRowCount) : {})}><Icon name="grid-rows" /></div>}
          tip={lang.gridRowCount} defaultUnitValue="" clearable={false}
          suffix={<Select
            disabled={!rowsEditable}
            value={autoRows ? 'auto' : 'fixed'}
            hideLabel
            style={{ width: 16, padding: 0, fontSize: 10 }}
            options={[
              { value: 'fixed', label: String(previewRowCount) },
              { value: 'auto', label: lang.gridAuto },
            ]}
            onChange={mode => mode === 'auto' ? selectAutoRows() : changeCount('row', String(previewRowCount))}
          />}
          onChange={next => changeCount('row', next)} />}
      </div>}
      {view === 'picker' ? <>
        <div className={styles.picker} onMouseLeave={() => setHover(null)}>
          {Array.from({ length: 12 * 8 }, (_, index) => {
            const column = index % 12 + 1;
            const row = Math.floor(index / 12) + 1;
            const selected = column <= (countDragStart?.columns ?? previewColumnCount) && row <= (countDragStart?.rows ?? previewRowCount);
            const preview = countPreviewLocked
              ? column <= previewColumnCount && row <= previewRowCount
              : hover && column <= hover.columns && row <= hover.rows;
            return <button type="button" key={index} disabled={!pickerEditable} aria-label={`${column} × ${row}`}
              data-mybricks-tip={JSON.stringify({ content: `${column} × ${row}`, position: 'bottom' })}
              className={[styles.cell, selected && styles.selected, preview && styles.preview].filter(Boolean).join(' ')}
              onMouseEnter={() => {
                if (countPreviewLocked || !pickerEditable) return;
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
                commitTracks([
                  { key: 'gridTemplateColumns', list: columnList, tracks: resizeTracks(columns, column, columnList.kind === 'auto-repeat' ? columns[0] : undefined) },
                  { key: 'gridTemplateRows', list: rowEditList, tracks: resizeTracks(rows, row, rowEditList.kind === 'auto-repeat' ? rows[0] : undefined) },
                ]);
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
