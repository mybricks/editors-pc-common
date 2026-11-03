import React, { useRef, useState } from 'react';
import { InputNumber, Select, SketchPopup, SketchCloseIcon, PlusOutlined, MinusOutlined } from '../../../components';
import { useStyleEditorContext } from '../../../context';
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

function TrackInput({ track, onChange }: { track: Track; onChange: (track: Track) => void }) {
  return <div className={styles.trackInput}>
    <Select
      value={track.mode}
      options={[
        { value: 'fixed', label: lang.gridFixed, icon: <FixedWidth /> },
        { value: 'fill', label: lang.sizeFillBadge, icon: <FillContainer /> },
        { value: 'hug', label: lang.sizeAdaptive, icon: <HugContents /> },
      ]}
      onChange={(mode: Track['mode']) => onChange(mode === 'hug' ? { mode } : { mode, value: mode === 'fixed' ? 100 : 1 })}
    />
    {track.mode !== 'hug' && <InputNumber
      value={serializeTracks([track])}
      defaultUnitValue={track.mode === 'fill' ? 'fr' : 'px'}
      suffix={track.mode === 'fill' ? 'fr' : 'px'}
      clearable={false}
      onChange={value => {
        if (value !== null) onChange({ ...track, value: Math.max(0, parseFloat(value)) });
      }}
    />}
  </div>;
}

export default function Grid({ value, onChange }: { value: GridValue; onChange: (patch: GridValue) => void }) {
  const targetDom = useStyleEditorContext()?.targetDom;
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<'picker' | 'settings' | null>(null);
  const [hover, setHover] = useState<{ columns: number; rows: number } | null>(null);
  const declaredColumns = parseTracks(value.gridTemplateColumns);
  const columns = declaredColumns.length ? declaredColumns : resizeTracks([], 1);
  const rows = parseTracks(value.gridTemplateRows);
  const autoRows = rows.length === 0;
  // Auto 的实际行数仅用于网格预览；行数输入和写入继续保留自动模式。
  const previewRowCount = autoRows && targetDom
    ? parseTracks(window.getComputedStyle(targetDom).gridTemplateRows).length
    : rows.length;
  const summary = `${columns.length} × ${autoRows ? lang.gridAuto : rows.length}`;

  const changeCount = (axis: 'column' | 'row', next: string | null) => {
    if (next === null) return;
    const count = Math.max(1, parseInt(next, 10));
    onChange({
      [axis === 'column' ? 'gridTemplateColumns' : 'gridTemplateRows']:
        serializeTracks(resizeTracks(axis === 'column' ? columns : rows, count)),
    });
  };
  const selectAutoRows = () => onChange({ gridTemplateRows: 'none', gridAutoRows: value.gridAutoRows || '1fr' });

  const renderTracks = (axis: 'column' | 'row') => {
    const tracks = axis === 'column' ? columns : rows;
    const key = axis === 'column' ? 'gridTemplateColumns' : 'gridTemplateRows';
    return <section className={styles.tracks}>
      <div className={styles.trackHeader}>
        <span>{axis === 'column' ? lang.gridColumns : lang.gridRows}</span>
        <button type="button" className={styles.iconButton} aria-label={lang.gridAddTrack}
          onClick={() => onChange({ [key]: serializeTracks(resizeTracks(tracks, tracks.length + 1)) })}>
          <PlusOutlined />
        </button>
      </div>
      {axis === 'row' && autoRows ? <div className={styles.trackRow}>
        <span className={styles.trackIndex}>{lang.gridAuto}</span>
        <TrackInput track={parseTracks(value.gridAutoRows || '1fr')[0]}
          onChange={track => onChange({ gridAutoRows: serializeTracks([track]) })} />
      </div> : tracks.map((track, index) => <div className={styles.trackRow} key={index}>
        <span className={styles.trackIndex}>{index + 1}</span>
        <TrackInput track={track} onChange={next => {
          const updated = tracks.slice();
          updated[index] = next;
          onChange({ [key]: serializeTracks(updated) });
        }} />
        <button type="button" className={styles.iconButton} aria-label={lang.gridRemoveTrack}
          disabled={tracks.length === 1}
          onClick={() => onChange({ [key]: serializeTracks(tracks.filter((_, i) => i !== index)) })}>
          <MinusOutlined />
        </button>
      </div>)}
    </section>;
  };

  return <div className={styles.grid}>
    <div className={styles.label}>{lang.gridLabel}</div>
    <button type="button" ref={anchorRef} className={styles.summary} onClick={() => {
      setHover(null);
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
    <SketchPopup open={view !== null} mounted={view !== null} anchorRef={anchorRef} onClose={() => setView(null)}
      className={styles.popup} repositionKey={`${view}-${columns.length}-${rows.length}`}>
      <div className={styles.header}>
        <span>{view === 'settings' ? lang.gridSettings : lang.gridLabel}</span>
        <button type="button" className={styles.iconButton} onClick={() => setView(null)} aria-label={lang.close}>
          {SketchCloseIcon}
        </button>
      </div>
      <div className={styles.counts}>
        <InputNumber value={columns.length} prefix={<Icon name="grid-columns" />} tip={lang.gridColumnCount}
          defaultUnitValue="" clearable={false} onChange={next => changeCount('column', next)} />
        <span>×</span>
        <InputNumber value={autoRows ? null : rows.length} placeholder={lang.gridAuto} prefix={<Icon name="grid-rows" />}
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
      </div>
      {view === 'picker' ? <>
        <div className={styles.picker} onMouseLeave={() => setHover(null)}>
          {Array.from({ length: 12 * 8 }, (_, index) => {
            const column = index % 12 + 1;
            const row = Math.floor(index / 12) + 1;
            const selected = column <= columns.length && row <= previewRowCount;
            const preview = hover && column <= hover.columns && row <= hover.rows;
            return <button type="button" key={index} aria-label={`${column} × ${row}`}
              className={[styles.cell, selected && styles.selected, preview && styles.preview].filter(Boolean).join(' ')}
              onMouseEnter={() => {
                setHover({ columns: column, rows: row });
                // Temporary style-instrument-debug: 验收确认后删除。
                void fetch('http://127.0.0.1:4318/logs', {
                  method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
                  body: JSON.stringify({ sessionId: 'grid-card1-20261103', event: 'grid-picker-hover', time: new Date().toISOString(),
                    data: { columns: column, rows: row } }),
                }).catch(() => {});
              }}
              onClick={() => {
                onChange({
                  gridTemplateColumns: serializeTracks(resizeTracks(columns, column)),
                  gridTemplateRows: serializeTracks(resizeTracks(rows, row)),
                });
                setView(null);
              }} />;
          })}
        </div>
        <div className={styles.hoverCount}>{hover ? `${hover.columns} × ${hover.rows}` : summary}</div>
        <button type="button" className={styles.settingsButton} onClick={() => setView('settings')}>{lang.gridOpenSettings}</button>
      </> : <div className={styles.trackList}>{renderTracks('column')}{renderTracks('row')}</div>}
    </SketchPopup>
  </div>;
}
