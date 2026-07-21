/**
 * 判断一个 DOM class 是否对应选择器里的某个短名。
 * 支持三种形式：
 *   1. 精确匹配：cls === shortName
 *   2. CSS Modules "--" 分隔：pages_Foo--shortName
 *   3. CSS Modules "-" 分隔（含下划线前缀）：pages_Foo_less-shortName
 */
export function classMatchesShortName(cls: string, shortName: string): boolean {
  return cls === shortName ||
    cls.endsWith('--' + shortName) ||
    (cls.endsWith('-' + shortName) && cls.slice(0, cls.length - shortName.length - 1).includes('_'))
}

/**
 * 用"选择器末段短名"匹配元素的实际（可能哈希的）classList。
 * 只验证末段（空格分隔的最后一段），祖先部分由 zoneSelectorList 构建逻辑保证。
 */
export function elMatchesSelectorTail(element: Element, sel: string): boolean {
  const lastPart = sel.trim().split(/\s+/).pop() ?? ''
  const shortNames = (lastPart.match(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g) ?? []).map(c => c.slice(1))
  if (shortNames.length === 0) return false
  const elClasses = Array.from(element.classList)
  return shortNames.every(sn => elClasses.some(cls => classMatchesShortName(cls, sn)))
}

/** 元素是否持有 rawClass（或其 CSS Modules 哈希变体）；支持复合类 "a.b" */
export function elementHasClassOrHashed(element: Element, rawClass: string): boolean {
  if (!rawClass) return false
  if (rawClass.includes('.')) {
    const parts = rawClass.split('.').filter(Boolean)
    return parts.every(part =>
      Array.from(element.classList).some(c => c === part || c.endsWith('-' + part))
    )
  }
  return Array.from(element.classList).some(c => c === rawClass || c.endsWith('-' + rawClass))
}

/** CSS Modules 哈希类名：规则末尾 class 必须属于当前 element，避免 ant-*-title 误匹配 .title */
export function ruleLastClassBelongsToElement(
  element: HTMLElement | null,
  ruleLast: string,
  selLast: string
): boolean {
  if (!element) {
    return ruleLast === selLast || ruleLast.endsWith('-' + selLast)
  }
  const elementHasTargetClass = Array.from(element.classList).some(
    c => c === selLast || c.endsWith('-' + selLast)
  )
  if (elementHasTargetClass) {
    // element 已在目标类上（如 xxx--title）：规则末尾 class 必须精确归属该 element
    return Array.from(element.classList).some(c => c === ruleLast)
  }
  // 编辑尚未激活的状态类（如 formTabActive）：element 不含目标 class，保留 endsWith 宽松匹配
  return ruleLast === selLast || ruleLast.endsWith('-' + selLast)
}
