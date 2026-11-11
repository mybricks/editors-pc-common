import { splitCssList } from '../../plugins/Effects/layers'
import lang from '../../../index.i18n'

export type TransitionRule = { durationMs: number; timing: string; delayMs: number }
export type TransitionRules = Record<string, TransitionRule>
export type TransitionAction = { type: 'none' | 'enable' }
  | { type: 'patch'; value: Partial<TransitionRule> }

export const DEFAULT_RULE: TransitionRule = { durationMs: 200, timing: 'linear', delayMs: 0 }
export const TIME_PRESETS = [0, 10, 50, 100, 200, 500, 1000, 2000, 5000]
export const TRANSITION_KEYS = [
  'transition', 'transitionProperty', 'transitionDuration', 'transitionTimingFunction', 'transitionDelay',
] as const

const sides = ['top', 'right', 'bottom', 'left']
const radius = ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map(corner => `border-${corner}-radius`)
const GROUP_PROPERTIES: Record<string, string[]> = {
  LAYOUT: ['row-gap', 'column-gap'],
  FLEX: ['flex-grow', 'flex-shrink', 'flex-basis'],
  SIZE: ['width', 'height', 'min-width', 'max-width', 'min-height', 'max-height'],
  POSITION: sides,
  FONT: ['color', 'font-size', 'font-weight', 'line-height', 'letter-spacing'],
  'IMAGE-FIT': ['object-position'],
  BACKGROUND: ['background-color', 'background-position', 'background-size'],
  BORDER: sides.flatMap(side => [`border-${side}-width`, `border-${side}-color`]),
  RADIUS: radius,
  'BORDER-RADIUS': radius,
  MARGIN: sides.map(side => `margin-${side}`),
  PADDING: sides.map(side => `padding-${side}`),
  OPACITY: ['opacity'],
  EFFECTS: ['box-shadow', 'text-shadow', 'filter', 'backdrop-filter'],
  ROTATION: ['transform'],
}

export function getTransitionProperties(pluginKey: string, config: { displayOnly?: boolean }): string[] {
  return pluginKey === 'LAYOUT' && config.displayOnly ? [] : GROUP_PROPERTIES[pluginKey] || []
}

export function getPropertyLabel(property: string): string {
  const labels: Record<string, string> = {
    width: lang.transitionWidth, height: lang.transitionHeight,
    'min-width': lang.minWidthTip, 'max-width': lang.maxWidthTip,
    'min-height': lang.minHeightTip, 'max-height': lang.maxHeightTip,
    color: lang.colorLabel, 'font-size': lang.fontSizeTip, 'font-weight': lang.transitionFontWeight,
    'line-height': lang.lineHeightTip, 'letter-spacing': lang.letterSpacingTip,
    'row-gap': lang.rowGapLabel, 'column-gap': lang.columnGapLabel,
    'flex-grow': lang.transitionFlexGrow, 'flex-shrink': lang.transitionFlexShrink, 'flex-basis': lang.transitionFlexBasis,
    'object-position': lang.transitionObjectPosition,
    'background-color': lang.transitionBackgroundColor, 'background-position': lang.transitionBackgroundPosition,
    'background-size': lang.transitionBackgroundSize,
    opacity: lang.opacityPanelTitle, transform: lang.transitionTransform,
    'box-shadow': lang.transitionBoxShadow, 'text-shadow': lang.textShadowLabel,
    filter: lang.transitionFilter, 'backdrop-filter': lang.transitionBackdropFilter,
  }
  const sideLabels = [lang.positionTopLabel, lang.positionRightLabel, lang.positionBottomLabel, lang.positionLeftLabel]
  sides.forEach((side, i) => {
    labels[side] = sideLabels[i]
    labels[`margin-${side}`] = `${lang.marginPanelTitle} · ${sideLabels[i]}`
    labels[`padding-${side}`] = `${lang.paddingPanelTitle} · ${sideLabels[i]}`
    labels[`border-${side}-width`] = `${lang.borderWidthTip} · ${sideLabels[i]}`
    labels[`border-${side}-color`] = `${lang.transitionBorderColor} · ${sideLabels[i]}`
  })
  radius.forEach((property, i) => {
    labels[property] = [lang.transitionTopLeft, lang.transitionTopRight, lang.transitionBottomRight, lang.transitionBottomLeft][i]
  })
  return labels[property] || property
}

const spring = (t: number) => 1 - Math.exp(-7 * t) * (Math.cos(11 * t) + 7 / 11 * Math.sin(11 * t))
export const SPRING_TIMING = 'linear(' + Array.from({ length: 61 }, (_, i) => {
  const t = i / 60
  return `${Number((spring(t) / spring(1)).toFixed(4))} ${Number((t * 100).toFixed(2))}%`
}).join(', ') + ')'

export function getTimingOptions() {
  return [
    { value: 'linear', label: lang.transitionLinear },
    { value: 'ease', label: lang.transitionEase },
    { value: 'ease-in', label: lang.transitionEaseIn },
    { value: 'ease-out', label: lang.transitionEaseOut },
    { value: 'ease-in-out', label: lang.transitionEaseInOut },
    { value: 'cubic-bezier(0.4, 0, 0.2, 1)', label: lang.transitionBezier },
    { value: SPRING_TIMING, label: lang.transitionSpring },
  ]
}

function milliseconds(value: string): number {
  return parseFloat(value) * (value.endsWith('ms') ? 1 : 1000)
}

export function parseTransitionLonghands(values: {
  property: string; duration: string; timing: string; delay: string
}): TransitionRules {
  if (!values.property || values.property === 'none') return {}
  const properties = splitCssList(values.property)
  const durations = splitCssList(values.duration || '0s')
  const timings = splitCssList(values.timing || 'ease')
  const delays = splitCssList(values.delay || '0s')
  const rules: TransitionRules = {}
  properties.forEach((property, i) => {
    rules[property] = {
      durationMs: milliseconds(durations[i % durations.length]),
      timing: timings[i % timings.length],
      delayMs: milliseconds(delays[i % delays.length]),
    }
  })
  return rules
}

export function patchTransitionRules(current: TransitionRules, selected: string[], action: TransitionAction): TransitionRules {
  const next = { ...current }
  selected.forEach(property => {
    if (action.type === 'none') delete next[property]
    else if (action.type === 'enable') next[property] = next[property] || { ...DEFAULT_RULE }
    else if (action.type === 'patch') next[property] = { ...(next[property] || DEFAULT_RULE), ...action.value }
  })
  return next
}

export function serializeTransitionRules(rules: TransitionRules): string {
  return Object.keys(rules).map(property => {
    const { durationMs, timing, delayMs } = rules[property]
    return `${property} ${durationMs}ms ${timing} ${delayMs}ms`
  }).join(', ') || 'none'
}
