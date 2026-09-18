export type CascadeMode = 'default' | 'hover'

export type CssSpecificity = {
  A: number
  B: number
  C: number
}

export type CascadePriority = {
  important: boolean
  inline: boolean
  specificity: CssSpecificity
  sourceOrder: number
}

export type CascadeRuleSource = {
  rule: CSSStyleRule
  /** 用于当前来源计算特指度的单个 selector 分支。 */
  selectorPart?: string
  /** selectorPart 应当匹配的元素；Zone Tab 可为每条来源提供自己的目标。 */
  target?: Element | null
  /** 样式表中的稳定顺序；数值越大，声明越晚。 */
  sourceOrder?: number
}

export type CascadeCandidateSource =
  | {
      kind: 'inline'
      style: CSSStyleDeclaration
    }
  | {
      kind: 'rule'
      style: CSSStyleDeclaration
      rule: CSSStyleRule
      selector: string
      sourceOrder: number
    }

export type CascadeCandidate = {
  /** 被查询的 longhand 属性，统一为 kebab-case。 */
  property: string
  /** 源码中真正写下的属性；可能是 background、gap 等 shorthand。 */
  authoredProperty: string
  value: string
  priority: CascadePriority
  source: CascadeCandidateSource
}

export type CssCascadeSession = {
  resolve(property: string, mode?: CascadeMode): CascadeCandidate | null
  resolveValue(property: string, mode?: CascadeMode): CascadeResolvedValue
  resolveAll(
    properties: string[],
    mode?: CascadeMode
  ): Map<string, CascadeCandidate>
  getInlineCandidate(property: string): CascadeCandidate | null
  hasInlineDeclaration(property: string): boolean
}

export type CascadeResolvedValue = {
  value: string
  winner: CascadeCandidate | null
  fromComputedStyle: boolean
}

export type CssCascadeSessionOptions = {
  /** 调用方已经取得的快照；仅在没有 author 声明时作为兜底。 */
  computedStyle?: CSSStyleDeclaration | null
}
