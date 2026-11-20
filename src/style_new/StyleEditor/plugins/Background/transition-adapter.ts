import { findCssVarReferences, parseCssVar } from '../../../core/css-var'
import { findCssClosingParenthesis } from '../../../core/css-functions'
import { createStyleResolution, resolveEffectiveStyleSource } from '../../../core/style-property'
import type { StyleResolution } from '../../../core/style-property'
import { createStyleWriteTargetResolver } from '../../../core/style-write-target'
import type { ZoneTab } from '../../../core/zone-tab'
import type { StyleRemovalPlan } from '../../../core/apply-style-change'
import { decomposeBackgroundStack, getContentBackgroundMeta } from '../../helper/paint-stack'
import { splitBackgroundLayers } from '../../helper/gradient-border'
import { parseTransitionLonghands, serializeTransitionRules, TRANSITION_KEYS } from '../../components/Transition/value'
import { ParseGradient } from '../../components/GradientEditor/GradientParser'
import { parseLayers, serializeLayers } from './layers'
import type { BgLayer } from './layers'

// 编辑器只管理这个命名空间；注册和清理由动画文件计划统一生成。
export const MOTION_FILL_PREFIX = '--mybricks-motion-fill-'
export const isMotionFillProperty = (name: string) => name.startsWith(MOTION_FILL_PREFIX)

export function getMotionFillVariable(value: string): string | undefined {
  const variable = parseCssVar(value)
  return variable && isMotionFillProperty(variable.varName) ? variable.varName : undefined
}

type ReadValue = (name: string) => string | undefined

/** 复用渐变解析器识别色标，只替换颜色，方向和位置保留原表达式。 */
function getMotionFillColors(layer: BgLayer) {
  if (layer.type === 'solid') return {
    colors: [layer.value],
    toImage: (colors: string[]) => `linear-gradient(${colors[0]}, ${colors[0]})`,
  }
  if (layer.type !== 'gradient' || !/^(linear|radial)-gradient\(/.test(layer.value)) return null
  const { stops } = ParseGradient(layer.value)
  const open = layer.value.indexOf('(')
  const parts = splitBackgroundLayers(layer.value.slice(open + 1, -1))
  const offset = parts.length - stops.length
  const colorEnds = parts.slice(offset).map(part => /^[\w-]+\(/.test(part)
    ? findCssClosingParenthesis(part, part.indexOf('(')) + 1
    : part.search(/\s|$/))
  return {
    colors: parts.slice(offset).map((part, i) => part.slice(0, colorEnds[i])),
    toImage: (colors: string[]) => layer.value.slice(0, open + 1) + [
      ...parts.slice(0, offset),
      ...colors.map((color, i) => color + parts[offset + i].slice(colorEnds[i])),
    ].join(', ') + ')',
  }
}

/** 只拆内部变量这一层；内部值为 var(--brand) 时继续交给原变量控件。 */
export function readMotionFillLayers(layers: BgLayer[], read: ReadValue): BgLayer[] {
  return layers.map(layer => {
    if (layer.type === 'gradient' && layer.value.includes(MOTION_FILL_PREFIX)) {
      const fill = getMotionFillColors(layer)
      if (fill) return { ...layer,
        value: fill.toImage(fill.colors.map(color => {
          const name = getMotionFillVariable(color)
          return name ? read(name) || color : color
        })),
      }
    }
    const name = layer.type === 'solid' && getMotionFillVariable(layer.value)
    return name ? { ...layer, value: read(name) || layer.value } : layer
  })
}

/** 保留旧序列化的删除/迁移项，受管层改色时仍写回原变量。 */
export function writeMotionFillLayers(
  layers: BgLayer[], changes: Array<{ key: string; value: any }>, sourceLayers: BgLayer[], transition?: string
) {
  // sourceLayers 在本次操作时从 CSS 读取；展示层不保存变量身份。
  const names = sourceLayers.map(layer => getMotionFillColors(layer)?.colors.map(getMotionFillVariable) || [])
  if (!names.some(colors => colors.some(Boolean))) return changes
  const variables: Record<string, string> = {}
  const sourceNamesSet = new Set(names.flat().filter(Boolean) as string[])
  const serialized = serializeLayers(layers.length === sourceLayers.length ? layers.map((layer, index) => {
    const sourceNames = names[index] || []
    const firstName = sourceNames.find(Boolean)
    if (!firstName || layer.value === sourceLayers[index].value) return layer
    const fill = getMotionFillColors(layer)
    if (!fill) return layer
    const refs = fill.colors.map((color, i) => {
      const name = sourceNames[i] || (i === 0 ? firstName : `${firstName}-stop-${i}`)
      variables[name] = color
      return `var(${name})`
    })
    return { ...layer, value: layer.type === 'solid' ? refs[0] : fill.toImage(refs) }
  }) : layers)
  const nextImage = serialized.find(item => item.key === 'backgroundImage')?.value || ''
  const nextNames = new Set(findCssVarReferences(nextImage).map(ref => ref.varName))
  const removedNames = Array.from(sourceNamesSet).filter(name => !nextNames.has(name))
  const extra = Object.entries(variables).map(([key, value]) => ({ key, value }))
  // 已启用的纯色层切成渐变时，新色标继续使用原动效；关闭态不会被重新打开。
  if (transition) {
    const declaration = document.createElement('div').style
    declaration.transition = transition
    const rules = parseTransitionLonghands({ property: declaration.transitionProperty,
      duration: declaration.transitionDuration, timing: declaration.transitionTimingFunction, delay: declaration.transitionDelay })
    const timing = rules['background-color']
    const added = Object.keys(variables).filter(name => !rules[name])
    if (timing && added.length) {
      added.forEach(name => { rules[name] = { ...timing } })
    }
    removedNames.forEach(name => { delete rules[name] })
    if (added.length || removedNames.length) {
      extra.push({ key: 'transition', value: serializeTransitionRules(rules) })
    }
  }
  removedNames.forEach(name => extra.push({ key: name, value: null }))
  return changes.map(change => change.key === 'backgroundImage' && change.value != null
    ? { ...change, value: serialized.find(item => item.key === 'backgroundImage')!.value }
    : change
  ).concat(extra)
}

/** 背景表达式不变时，也要比较它引用的内部颜色；普通背景保持旧指纹。 */
export function getMotionFillSignature(image: string, read: ReadValue): string {
  if (!image.includes(MOTION_FILL_PREFIX)) return ''
  const names = Array.from(new Set(findCssVarReferences(image).map(variable => variable.varName)
    .filter(isMotionFillProperty)))
  return JSON.stringify(names.map(name => [name, read(name)]))
}

/** 在原写入/删除组中追加清理；变量归属只取同一选择器的 CSS 声明。 */
export function appendMotionFillRemoval(
  group: StyleRemovalPlan['groups'][number], resolution: StyleResolution, target: HTMLElement | null
): boolean {
  if (!('backgroundImage' in group.style) && !group.deletions.includes('backgroundImage')) return false
  const source = (key: string) => resolveEffectiveStyleSource(
    resolution.get(key).candidates.filter(candidate => candidate.label === group.selector))
  const image = source('backgroundImage')?.value || ''
  const names = Array.from(new Set(findCssVarReferences(image).map(ref => ref.varName).filter(isMotionFillProperty)))
  if (!names.length) return false
  const nextImage = group.style.backgroundImage || ''
  const remaining = new Set(findCssVarReferences(nextImage).map(ref => ref.varName))
  const removedNames = names.filter(name => !remaining.has(name))
  if (!removedNames.length) return false
  const declaration = target!.ownerDocument.createElement('div').style
  const transition = group.style.transition ?? source('transition')?.value
  if (transition) declaration.transition = transition
  else TRANSITION_KEYS.slice(1).forEach(key => { declaration[key] = source(key)?.value || '' })
  const rules = parseTransitionLonghands({
    property: declaration.transitionProperty,
    duration: declaration.transitionDuration,
    timing: declaration.transitionTimingFunction,
    delay: declaration.transitionDelay,
  })
  removedNames.forEach(name => { delete rules[name] })
  const nextMeta = getContentBackgroundMeta({ backgroundImage: nextImage })
  if (!parseLayers(nextMeta.backgroundImage).length) {
    delete rules['background-position']
    delete rules['background-size']
    const color = 'backgroundColor' in group.style ? group.style.backgroundColor
      : group.deletions.includes('backgroundColor') ? '' : source('backgroundColor')?.value
    if (!parseLayers('', color).length) delete rules['background-color']
  }
  // 图层已移除，内部变量不再需要 unset 屏蔽基础态；删除本地声明即可。
  removedNames.forEach(name => { delete group.style[name] })
  group.deletions.push(...removedNames, ...TRANSITION_KEYS.filter(key => !group.deletions.includes(key)))
  TRANSITION_KEYS.forEach(key => { delete group.style[key] })
  if (Object.keys(rules).length) {
    group.style.transition = serializeTransitionRules(rules) + (source('transition')?.important ? ' !important' : '')
    group.deletions = group.deletions.filter(key => key !== 'transition')
  }
  return true
}

const BACKGROUND_KEYS = ['backgroundImage', 'backgroundColor', 'backgroundSize', 'backgroundRepeat',
  'backgroundPosition', 'backgroundClip', 'WebkitBackgroundClip', 'backgroundOrigin']

/** 首次启用把起点、终点转换为同一组颜色变量；计划仍由公共样式执行器保存。 */
export function createMotionFillPlan(
  transition: string, tab: ZoneTab, resolution: StyleResolution, target: HTMLElement | null
) {
  const baseTab: ZoneTab = { ...tab, pseudo: null, selector: tab.baseSelector,
    sourceRules: tab.baseRules, baseRules: [] }
  const baseResolution = createStyleResolution(baseTab, target)
  const readBase = (key: string) => baseResolution.get(key).winner?.value
  const readState = (key: string) => resolveEffectiveStyleSource(
    resolution.get(key).candidates.filter(source => source.currentState)
  )?.value
  const baseStyle = Object.fromEntries(BACKGROUND_KEYS.map(key => [key, readBase(key)]))
  const stateStyle = Object.fromEntries(BACKGROUND_KEYS.map(key => [key, readState(key) ?? readBase(key)]))
  const stateTarget = createStyleWriteTargetResolver(tab, target, resolution)('transition', 'current-rule')
  const declaration = target!.ownerDocument.createElement('div').style
  declaration.transition = transition
  const rules = parseTransitionLonghands({ property: declaration.transitionProperty,
    duration: declaration.transitionDuration, timing: declaration.transitionTimingFunction, delay: declaration.transitionDelay })
  const timing = rules['background-color']
  if (!timing) {
    const image = stateStyle.backgroundImage || ''
    const references = findCssVarReferences(image).filter(variable => isMotionFillProperty(variable.varName))
    const names = Array.from(new Set([
      ...references.map(variable => variable.varName),
      ...tab.sourceRules.filter(source => source.sourceSelector === stateTarget.selector).flatMap(source =>
        Array.from({ length: source.rule.style.length }, (_, i) => source.rule.style.item(i)).filter(isMotionFillProperty)),
    ]))
    if (!names.length || !stateTarget.selector) return null
    // 关闭时把内部引用还原一层，用户原本绑定的 var(--brand) 保留。
    let restored = image
    references.slice().reverse().forEach(reference => {
      const color = readState(reference.varName) ?? readBase(reference.varName) ?? 'transparent'
      restored = restored.slice(0, reference.start) + color + restored.slice(reference.end)
    })
    const priority = resolution.get('backgroundImage').winner?.important ? ' !important' : ''
    return {
      baseResolution,
      base: { canClear: true, groups: [] } as StyleRemovalPlan,
      current: { canClear: true, groups: [{ selector: stateTarget.selector,
        style: { ...(references.length ? { backgroundImage: restored + priority } : {}), transition },
        deletions: names,
      }] } as StyleRemovalPlan,
    }
  }
  const baseMeta = getContentBackgroundMeta(baseStyle)
  const stateMeta = getContentBackgroundMeta(stateStyle)
  const baseLayers = parseLayers(baseMeta.backgroundImage)
  const stateLayers = parseLayers(stateMeta.backgroundImage)
  const baseColors = baseLayers.map(getMotionFillColors)
  const stateColors = stateLayers.map(getMotionFillColors)
  // 常规态只有 background-color 时，状态里的颜色 image 从透明显现，原底色保留。
  // 注册变量的初值就是 transparent，无需给常规态凭空添加图层或重复叠加底色。
  const appearsFromTransparent = !baseLayers.length && stateColors.every(Boolean)
  if (!appearsFromTransparent && baseLayers.length !== stateLayers.length) return null
  // 只补间颜色；两端都有图层时，渐变方向、色标数量和位置必须一致。
  const indices = stateColors.map((fill, i) => fill && (appearsFromTransparent ||
    baseColors[i] && fill.toImage(fill.colors.map(() => 'color')) ===
      baseColors[i]!.toImage(baseColors[i]!.colors.map(() => 'color'))) ? i : -1)
    .filter(i => i >= 0)
  if (!indices.length) return null

  const baseTarget = createStyleWriteTargetResolver(baseTab, target, baseResolution)('backgroundImage')
  // 这一转换需要可写的 CSS 规则；原生 background-color 及内联分支保留旧路径。
  if (!baseTarget.selector || baseTarget.selector === 'inline' || !stateTarget.selector) return null

  const baseWrites: Record<string, string> = {}
  const stateWrites: Record<string, string> = {}
  const baseImages = splitBackgroundLayers(baseStyle.backgroundImage)
  const stateImages = splitBackgroundLayers(stateStyle.backgroundImage)
  const baseOffset = decomposeBackgroundStack(baseStyle).textLayer ? 1 : 0
  const stateOffset = decomposeBackgroundStack(stateStyle).textLayer ? 1 : 0
  indices.forEach(i => {
    const baseFill = baseColors[i]
    const stateFill = stateColors[i]!
    const refs = stateFill.colors.map((color, stop) => {
      const baseVariable = baseFill && getMotionFillVariable(baseFill.colors[stop])
      const stateVariable = getMotionFillVariable(color)
      const name = stateVariable || baseVariable || `${MOTION_FILL_PREFIX}${Math.random().toString(36).slice(2, 12)}`
      if (baseFill && !baseVariable) baseWrites[name] = baseFill.colors[stop]
      // 读取声明原文，避免把主题绑定或动画中间色写死。
      stateWrites[name] = stateVariable ? readState(stateVariable) ?? readBase(stateVariable)! : color
      rules[name] = { ...timing }
      return `var(${name})`
    })
    if (baseFill) baseImages[baseOffset + i] = baseFill.toImage(refs)
    stateImages[stateOffset + i] = stateFill.toImage(refs)
  })
  if (Object.keys(baseWrites).length) {
    const priority = baseResolution.get('backgroundImage').winner?.important ? ' !important' : ''
    baseWrites.backgroundImage = baseImages.join(', ') + priority
  }
  const statePriority = resolution.get('backgroundImage').winner?.important ? ' !important' : ''
  stateWrites.backgroundImage = stateImages.join(', ') + statePriority
  stateWrites.transition = serializeTransitionRules(rules)
  return {
    baseResolution,
    base: { canClear: true, groups: Object.keys(baseWrites).length
      ? [{ selector: baseTarget.selector, style: baseWrites, deletions: [] }] : [] } as StyleRemovalPlan,
    current: { canClear: true, groups: [{ selector: stateTarget.selector, style: stateWrites, deletions: [] }] } as StyleRemovalPlan,
  }
}
