import type { FreedomPlanOptions, StylePlanItem } from './freedom-plan'
import { collectSubjectClassSelectors, resolveCssomSourceSelector } from './build-zone-selectors-from-cssom'

/** 有源码定位的拖入节点或无 class 节点写 JSX，不依赖临时 drag 类名。 */
export function isInlineFreedomTarget(target: Element): boolean {
  return target.hasAttribute('data-loc')
    && (target.getAttribute('data-drag-insert') === 'true' || target.classList.length === 0)
}

/** 拖入节点生成的 class 只用于编辑期定位，不应成为 Less 的稳定作用域。 */
export function hasOnlyTransientDragClasses(target: Element): boolean {
  const classNames = Array.from(target.classList)
  return classNames.length > 0 && classNames.every(name => /^drag_/.test(name))
}

export function getInlineFreedomOptions(parent: HTMLElement, options: FreedomPlanOptions): FreedomPlanOptions {
  if (!isInlineFreedomTarget(parent)) return options
  const root = parent.getRootNode() as Document | ShadowRoot
  const scope = parent.closest('[data-desn-page]') || root.getElementById(options.comId)
  const segments: string[] = []
  // 选择器仅供测量和普通 class 子项的 Less 作用域使用；inline 本身仍按 DOM 的源码位置写入。
  // 无 class 时沿结构定位，不能把即将废弃的拖入标记或编辑期 data-loc 写进 Less。
  for (let element: Element | null = parent; element; element = element.parentElement) {
    const name = element.classList[0]
    if (name) {
      const sourceSelector = resolveCssomSourceSelector(`.${name}`, element, options.comId)
      segments.unshift(sourceSelector !== `.${name}` ? sourceSelector : `[class~=${JSON.stringify(name)}]`)
      break
    }
    const siblings = Array.from(element.parentElement?.children || []).filter(sibling => sibling.tagName === element!.tagName)
    segments.unshift(`${element.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(element) + 1 || 1})`)
    if (element === scope || element.parentElement === scope) break
  }
  return { ...options, selector: segments.join(' > '), soloEdit: true }
}

function restoreInlineFreedom(target: HTMLElement): StylePlanItem['style'] {
  const style: Record<string, any> = {}
  for (const property of Array.from(target.style)) {
    if (!property.startsWith('--freeform-original-')) continue
    const key = property.slice('--freeform-original-'.length).replace(/-([a-z])/g, (_, char) => char.toUpperCase())
    style[key] = JSON.parse(target.style.getPropertyValue(property))
    style[property] = null
  }
  return style
}

/** 位置/尺寸沿用主规划器；只在声明解析前分离 JSX 写入及其原值备份、恢复。 */
export function prepareInlineFreedomChanges(changes: StylePlanItem[], parents: HTMLElement[], mode: 'freedom' | 'flex', scope: Element) {
  const lessChanges: StylePlanItem[] = []
  const inline = new Map<HTMLElement, StylePlanItem>()
  const mergeInline = (target: HTMLElement, style: StylePlanItem['style']) => {
    const previous = inline.get(target)
    inline.set(target, { target, selector: 'inline', lessFile: '', style: { ...previous?.style, ...style } })
  }
  for (const change of changes) {
    let nextChange = change
    const targetIsInline = isInlineFreedomTarget(change.target)
    if (mode === 'freedom' && !targetIsInline) {
      const parent = change.target.parentElement
      const childSelector = collectSubjectClassSelectors(change.target)[0]
      // 新生成的混合计划不能把临时 drag_* 父类写进 Less；旧 flex 退出计划保持原选择器用于恢复。
      if (parent && parents.includes(parent as HTMLElement) && hasOnlyTransientDragClasses(parent) && childSelector) {
        const nthChild = change.selector.match(/:nth-child\(\d+\)$/)?.[0] || ''
        nextChange = { ...change, selector: `${childSelector}${nthChild}` }
      }
    }
    if (targetIsInline) mergeInline(nextChange.target, nextChange.style)
    else lessChanges.push(nextChange)
  }

  if (mode === 'freedom') {
    inline.forEach(change => {
      // Less 的原值标记不适用于 inline；备份的是 DOM 自身声明，不能读 computed 继承值。
      const style: Record<string, any> = change.style
      for (const key of Object.keys(style).filter(key => !key.startsWith('--'))) {
        const property = key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)
        const marker = `--freeform-original-${property}`
        style[marker] = change.target.style.getPropertyValue(marker)
          || JSON.stringify(change.target.style.getPropertyValue(property) || null)
      }
    })
  } else {
    for (const parent of parents) {
      // inline 没有 CSSOM 来源规则，退出时从父子自身的标记补回恢复计划。
      if (isInlineFreedomTarget(parent) && parent.style.getPropertyValue('--layout-mode').trim() === 'freedom') {
        mergeInline(parent, { ...restoreInlineFreedom(parent), '--layout-mode': null })
      }
      for (const child of Array.from(parent.children) as HTMLElement[]) {
        if (isInlineFreedomTarget(child) && child.style.getPropertyValue('--freeform-position').trim() === 'absolute') {
          mergeInline(child, { ...restoreInlineFreedom(child), '--freeform-position': null })
        }
      }
      // 祖先若承担了本次宽度补偿，也按自身备份恢复；不动祖先自身的 freeform 容器。
      for (let target = parent.parentElement; target && target !== scope; target = target.parentElement) {
        if (!isInlineFreedomTarget(target) || target.style.getPropertyValue('--layout-mode')) continue
        const style = restoreInlineFreedom(target)
        if (Object.keys(style).length) mergeInline(target, style)
      }
    }
  }
  return {
    lessChanges,
    merge(resolvedChanges: StylePlanItem[]) {
      if (!inline.size) return resolvedChanges
      // 批量操作的第一个目标仍是选中父容器，供宿主登记操作记录。
      const parentChange = inline.get(parents[0])
      const rest = Array.from(inline.values()).filter(change => change !== parentChange)
      return parentChange ? [parentChange, ...resolvedChanges, ...rest] : [...resolvedChanges, ...rest]
    },
  }
}
