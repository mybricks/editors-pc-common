import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApplyStyleMutations, useStyleEditorContext } from '../../context'
import type { ChangeEvent } from '../../type'
import { INTERACTIVE_PSEUDO_STATES, onStatePreviewChange } from '../../../core/state-preview'
import { resolveEffectiveStyleSource } from '../../../core/style-property'
import { SketchPopup, SketchCloseIcon } from '../SketchPopup'
import { Dropdown } from '../DropDown'
import { DownOutlined } from '../Icon/DownOutlined'
import lang from '../../../index.i18n'
import {
  getPropertyLabel, getTimingOptions, parseTransitionLonghands, patchTransitionRules,
  serializeTransitionRules, DEFAULT_RULE, TIME_PRESETS, TRANSITION_KEYS,
} from './value'
import type { TransitionAction, TransitionRule, TransitionRules } from './value'
import css from './index.less'
import { isMotionFillProperty } from '../../plugins/Background/transition-adapter'

export function useTransitionController(fallbackOnChange: ChangeEvent) {
  const context = useStyleEditorContext()
  const apply = useApplyStyleMutations(fallbackOnChange)
  const options = context?.editConfig.options
  const tab = !Array.isArray(options) ? options?.zoneTab : undefined
  const enabled = !!tab?.pseudo && INTERACTIVE_PSEUDO_STATES.has(tab.pseudo)
  const target = context?.targetDom
  const selector = tab?.selector
  const values = TRANSITION_KEYS.map(key => {
    // Tab 缓存的 effectiveStyle 可能缺少新写入的过渡，按当前态 CSS 来源读取。
    const property = enabled ? context?.getStyleProperty?.(key) : undefined
    if (property) {
      return resolveEffectiveStyleSource(
        property.candidates.filter(candidate => candidate.currentState)
      )?.value || ''
    }
    return context?.effectiveStyle?.[key]?.value || ''
  })
  const signature = JSON.stringify(values)
  const source = useMemo(() => {
    const declaration = document.createElement('div').style
    if (enabled) {
      // 交给 CSSOM 解析简写和函数；这里只读当前态显式声明。
      // 本编辑器写完整简写；连续写入时，长写来源可能仍是上一次 CSSOM 快照。
      if (values[0]) declaration.transition = values[0]
      else TRANSITION_KEYS.slice(1).forEach((key, index) => {
        if (values[index + 1]) declaration[key] = values[index + 1]
      })
    }
    return { rules: parseTransitionLonghands({
      property: declaration.transitionProperty, duration: declaration.transitionDuration,
      timing: declaration.transitionTimingFunction, delay: declaration.transitionDelay,
    }) }
  }, [signature, target, selector, enabled])
  const [local, setLocal] = useState(source)
  const sourceRef = useRef(source)
  const rulesRef = useRef(source.rules)
  // 来源更新/换选中时重新读回；普通重渲染保留最近一次成功写入。
  if (sourceRef.current !== source) {
    sourceRef.current = source
    rulesRef.current = source.rules
  }
  const commit = useCallback((selected: string[], action: TransitionAction) => {
    if (!selected.length) return
    const fill = selected.includes('background-color')
    // 面板仍是一个“填充颜色”选项，参数和关闭操作同时作用于全部内部颜色。
    if (fill) selected = selected.concat(Object.keys(rulesRef.current).filter(isMotionFillProperty))
    const next = patchTransitionRules(rulesRef.current, selected, action)
    const result = apply([{
      type: 'set', key: 'transition', value: serializeTransitionRules(next), target: 'current-rule',
      ...(fill ? { motionFill: true } : {}),
    }])
    if (result && !result.applied) return
    rulesRef.current = next
    setLocal({ rules: next })
  }, [apply])
  // local 负责触发主动编辑后的渲染，规则以 ref 中的最新成功快照为准。
  return useMemo(() => ({ enabled, rules: rulesRef.current, commit }), [enabled, source, local, commit])
}

function Diamond({ filled = false }: { filled?: boolean }) {
  return <svg width='24' height='24' viewBox='2 2 20 20' fill='none' aria-hidden='true'>
    <path d='M11.6465 8.06055C11.8417 7.8654 12.1583 7.86537 12.3535 8.06055L15.9395 11.6465C16.1346 11.8417 16.1346 12.1583 15.9395 12.3535L12.3535 15.9395C12.1583 16.1346 11.8417 16.1346 11.6465 15.9395L8.06055 12.3535C7.86538 12.1583 7.86538 11.8417 8.06055 11.6465L11.6465 8.06055Z' fill={filled ? 'currentColor' : 'none'} stroke='currentColor' />
  </svg>
}

function commonValue<K extends keyof TransitionRule>(rules: TransitionRules, selected: string[], key: K): TransitionRule[K] | undefined {
  // 尚未配置时显示待应用的默认值；编辑参数会沿用 patch 链路启用动效。
  if (selected.length && selected.every(property => !rules[property])) return DEFAULT_RULE[key]
  const first = rules[selected[0]]?.[key]
  return selected.every(property => rules[property]?.[key] === first) ? first : undefined
}

function TimeInput({ label, value, disabled, onChange }: {
  label: string; value?: number; disabled: boolean; onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  useEffect(() => setDraft(null), [value])
  return <div className={css.timeInput}>
    <input type='number' min='0' step='10' aria-label={label} disabled={disabled}
      value={draft ?? value ?? ''} placeholder={lang.transitionMixedValue}
      onChange={event => setDraft(event.target.value)}
      onBlur={event => {
        const number = event.target.valueAsNumber
        if (draft !== null && Number.isFinite(number) && number >= 0) onChange(number)
        setDraft(null)
      }}
      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />
    <span>ms</span>
    <Dropdown value={value} disabled={disabled} className={css.presets}
      options={TIME_PRESETS.map(value => ({ value, label: `${value}ms` }))}
      onClick={value => { setDraft(null); onChange(value) }}>
      <span aria-label={label + ' ms'}><DownOutlined /></span>
    </Dropdown>
  </div>
}

export function TransitionTrigger({ controller, properties }: {
  controller: ReturnType<typeof useTransitionController>; properties: string[]
}) {
  const { rules, commit } = controller
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const close = useCallback(() => setOpen(false), [])
  // 缓存的 Tab 面板不会卸载，状态切换时主动关闭其 Portal。
  useEffect(() => open ? onStatePreviewChange(close) : undefined, [open, close])
  const configured = properties.some(property => !!rules[property])
  const mode = configured ? 'animation' : 'none'
  const disabled = !selected.length
  const timingOptions = useMemo(() => {
    const declaration = document.createElement('div').style
    return getTimingOptions().map(option => {
      declaration.transitionTimingFunction = option.value
      return { ...option, value: declaration.transitionTimingFunction }
    })
  }, [])
  const timing = commonValue(rules, selected, 'timing')
  const effectLabel = mode === 'none' ? lang.transitionNone : lang.transitionAnimation
  return <>
    <button type='button' ref={anchorRef} className={`${css.trigger} ${configured ? css.configured : ''}`}
      aria-label={lang.transitionTitle + ': ' + properties.map(getPropertyLabel).join('、')}
      aria-expanded={open} data-mybricks-tip={configured ? lang.transitionConfigured : lang.transitionUnconfigured}
      onClick={() => {
        if (open) close()
        else {
          // 未配置时点击菱形即启用整组动效，已有配置只展开查看。
          if (!configured) commit(properties, { type: 'enable' })
          setSelected(properties)
          setOpen(true)
        }
      }}><Diamond filled={configured} /></button>
    <SketchPopup open={open} mounted={open} anchorRef={anchorRef} onClose={close} className={css.popup}>
      <div className={css.popupHeader}>
        <strong>{lang.transitionTitle}</strong>
        <button type='button' aria-label={lang.close} onClick={close}>{SketchCloseIcon}</button>
      </div>
      <div className={css.row}>
        <span>{lang.transitionEffect}</span>
        <div className={css.control}>
          <Dropdown value={mode}
            options={[{ value: 'none', label: lang.transitionNone }, { value: 'animation', label: lang.transitionAnimation }]}
            menuStyle={{ boxSizing: 'border-box' }}
            onClick={effect => {
              // “无”关闭当前编辑器整组动效，与外部菱形保持一致。
              // 属性区收起后，空选时重新开启动画使用整组属性，避免无法展开。
              if (effect === 'animation' && !selected.length) setSelected(properties)
              commit(effect === 'none' || !selected.length ? properties : selected, { type: effect === 'none' ? 'none' : 'enable' })
            }}>
            <button type='button' className={css.select} aria-label={lang.transitionEffect}>
              <span>{effectLabel}</span><DownOutlined />
            </button>
          </Dropdown>
        </div>
      </div>
      {mode === 'animation' && <>
      <div className={css.row}>
        <span>{lang.transitionProperties}</span>
        <div className={css.control}>
          <Dropdown value={selected} multiple showRemove={false}
            options={properties.map(property => ({ value: property, label: getPropertyLabel(property) }))}
            menuStyle={{ boxSizing: 'border-box' }}
            onClick={property => setSelected(selected.includes(property)
              ? selected.filter(item => item !== property) : [...selected, property])}>
            <button type='button' className={css.select} aria-label={lang.transitionProperties}
              data-mybricks-tip={lang.transitionSelectionTip}>
              <span>{selected.length ? selected.map(getPropertyLabel).join('、') : lang.transitionSelectProperties}</span><DownOutlined />
            </button>
          </Dropdown>
        </div>
      </div>
      <div className={css.row}>
        <span>{lang.transitionCurve}</span>
        <div className={css.control}>
          <Dropdown value={timing || ''} options={timingOptions} disabled={disabled}
            menuStyle={{ boxSizing: 'border-box' }}
            onClick={value => commit(selected, { type: 'patch', value: { timing: value } })}>
            <button type='button' className={css.select} disabled={disabled} aria-label={lang.transitionCurve}>
              <span>{timingOptions.find(option => option.value === timing)?.label || lang.transitionMixed}</span><DownOutlined />
            </button>
          </Dropdown>
        </div>
      </div>
      <div className={css.row}>
        <span>{lang.transitionDuration}</span>
        <TimeInput key={selected.join(',') + ':duration'} label={lang.transitionDuration} disabled={disabled}
          value={commonValue(rules, selected, 'durationMs')}
          onChange={durationMs => commit(selected, { type: 'patch', value: { durationMs } })} />
      </div>
      <div className={css.row}>
        <span>{lang.transitionDelay}</span>
        <TimeInput key={selected.join(',') + ':delay'} label={lang.transitionDelay} disabled={disabled}
          value={commonValue(rules, selected, 'delayMs')}
          onChange={delayMs => commit(selected, { type: 'patch', value: { delayMs } })} />
      </div>
      </>}
    </SketchPopup>
  </>
}
