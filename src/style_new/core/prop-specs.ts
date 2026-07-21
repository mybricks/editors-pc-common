export type Fallback =
  | 'computed'
  | 'computedIfInvalid'
  | 'static'
  | 'empty'
  | 'none'
  | 'fontFamily'
  | 'gap'

export type PropSpec = {
  camel: string
  /** CSSStyleDeclaration 上的读法；默认 camel */
  styleKey?: string
  inherit: boolean
  fallback: Fallback
  staticValue?: any
  /** 读入 rule 时若等于这些值则忽略（如 textDecoration:'none'） */
  skipValues?: string[]
  /** 额外视为未设置，再走 fallback */
  treatAsUnset?: string[]
  /** 是否从 rule.style 读取；默认 true。boxShadow 旧实现不读 rule */
  readFromRule?: boolean
  /**
   * computed 类 fallback 的「未设置」判定：
   * - falsy：!value（padding 等）
   * - notSet：undefined | 'inherit'（多数 font）
   * 默认 falsy；font 数字段用 notSet
   */
  unsetMode?: 'falsy' | 'notSet'
}

export const PROP_SPECS: PropSpec[] = [
  // font（可继承）
  { camel: 'color', inherit: true, fallback: 'computedIfInvalid', unsetMode: 'notSet' },
  { camel: 'fontSize', inherit: true, fallback: 'computed', unsetMode: 'notSet' },
  { camel: 'textAlign', inherit: true, fallback: 'computed', unsetMode: 'notSet' },
  { camel: 'fontWeight', inherit: true, fallback: 'computed', unsetMode: 'notSet' },
  { camel: 'lineHeight', inherit: true, fallback: 'computed', unsetMode: 'notSet' },
  { camel: 'fontFamily', inherit: true, fallback: 'fontFamily' },
  { camel: 'letterSpacing', inherit: true, fallback: 'computed', unsetMode: 'notSet' },
  { camel: 'whiteSpace', inherit: true, fallback: 'computed', unsetMode: 'notSet' },

  // font（非继承；注意：旧实现在 inheritOnly return 之后才读 cursor，父级规则不会带入 cursor）
  { camel: 'cursor', inherit: false, fallback: 'static', staticValue: 'inherit' },
  { camel: 'textOverflow', inherit: false, fallback: 'none' },
  { camel: 'webkitLineClamp', inherit: false, fallback: 'none' },
  {
    camel: 'textDecoration',
    inherit: false,
    fallback: 'none',
    skipValues: ['none'],
  },
  {
    camel: 'fontStyle',
    inherit: false,
    fallback: 'none',
    skipValues: ['normal'],
  },
  {
    camel: 'textTransform',
    inherit: false,
    fallback: 'none',
    skipValues: ['none'],
  },
  { camel: 'webkitTextFillColor', inherit: false, fallback: 'none' },
  { camel: 'webkitBackgroundClip', inherit: false, fallback: 'none' },

  // padding / margin
  { camel: 'paddingTop', inherit: false, fallback: 'computed' },
  { camel: 'paddingRight', inherit: false, fallback: 'computed' },
  { camel: 'paddingBottom', inherit: false, fallback: 'computed' },
  { camel: 'paddingLeft', inherit: false, fallback: 'computed' },
  { camel: 'marginTop', inherit: false, fallback: 'computed' },
  { camel: 'marginRight', inherit: false, fallback: 'computed' },
  { camel: 'marginBottom', inherit: false, fallback: 'computed' },
  { camel: 'marginLeft', inherit: false, fallback: 'computed' },

  // background
  { camel: 'backgroundColor', inherit: false, fallback: 'empty' },
  { camel: 'backgroundImage', inherit: false, fallback: 'static', staticValue: 'none' },
  { camel: 'backgroundRepeat', inherit: false, fallback: 'computed' },
  { camel: 'backgroundPosition', inherit: false, fallback: 'static', staticValue: 'left top' },
  { camel: 'backgroundSize', inherit: false, fallback: 'computed' },
  { camel: 'backgroundOrigin', inherit: false, fallback: 'none' },
  { camel: 'backgroundClip', inherit: false, fallback: 'none' },

  // border
  { camel: 'borderTopColor', inherit: false, fallback: 'computedIfInvalid' },
  { camel: 'borderRightColor', inherit: false, fallback: 'computedIfInvalid' },
  { camel: 'borderBottomColor', inherit: false, fallback: 'computedIfInvalid' },
  { camel: 'borderLeftColor', inherit: false, fallback: 'computedIfInvalid' },
  { camel: 'borderTopLeftRadius', inherit: false, fallback: 'computed' },
  { camel: 'borderTopRightRadius', inherit: false, fallback: 'computed' },
  { camel: 'borderBottomRightRadius', inherit: false, fallback: 'computed' },
  { camel: 'borderBottomLeftRadius', inherit: false, fallback: 'computed' },
  { camel: 'borderTopStyle', inherit: false, fallback: 'computed' },
  { camel: 'borderRightStyle', inherit: false, fallback: 'computed' },
  { camel: 'borderBottomStyle', inherit: false, fallback: 'computed' },
  { camel: 'borderLeftStyle', inherit: false, fallback: 'computed' },
  {
    camel: 'borderTopWidth',
    inherit: false,
    fallback: 'computed',
    treatAsUnset: ['initial'],
  },
  {
    camel: 'borderBottomWidth',
    inherit: false,
    fallback: 'computed',
    treatAsUnset: ['initial'],
  },
  {
    camel: 'borderLeftWidth',
    inherit: false,
    fallback: 'computed',
    treatAsUnset: ['initial'],
  },
  {
    camel: 'borderRightWidth',
    inherit: false,
    fallback: 'computed',
    treatAsUnset: ['initial'],
  },

  // size
  { camel: 'width', inherit: false, fallback: 'static', staticValue: 'auto' },
  { camel: 'height', inherit: false, fallback: 'static', staticValue: 'auto' },
  { camel: 'maxWidth', inherit: false, fallback: 'static', staticValue: 'auto' },
  { camel: 'maxHeight', inherit: false, fallback: 'static', staticValue: 'auto' },
  { camel: 'minWidth', inherit: false, fallback: 'static', staticValue: 'auto' },
  { camel: 'minHeight', inherit: false, fallback: 'static', staticValue: 'auto' },

  // effects / overflow / opacity / z / transform
  // boxShadow：旧实现不从 rule 读取（TODO 注释掉了），只走 computed 兜底
  { camel: 'boxShadow', inherit: false, fallback: 'computed', readFromRule: false },
  { camel: 'filter', inherit: false, fallback: 'computed' },
  { camel: 'backdropFilter', inherit: false, fallback: 'none' },
  { camel: 'overflowX', inherit: false, fallback: 'computed' },
  { camel: 'overflowY', inherit: false, fallback: 'computed' },
  { camel: 'opacity', inherit: false, fallback: 'static', staticValue: 1 },
  { camel: 'zIndex', inherit: false, fallback: 'none' },
  { camel: 'transform', inherit: false, fallback: 'none' },

  // layout
  { camel: 'display', inherit: false, fallback: 'computed' },
  { camel: 'flexDirection', inherit: false, fallback: 'computed' },
  { camel: 'alignItems', inherit: false, fallback: 'computed' },
  { camel: 'justifyContent', inherit: false, fallback: 'computed' },
  { camel: 'flexWrap', inherit: false, fallback: 'computed' },
  { camel: 'rowGap', inherit: false, fallback: 'gap', treatAsUnset: ['normal'] },
  { camel: 'columnGap', inherit: false, fallback: 'gap', treatAsUnset: ['normal'] },
  { camel: 'position', inherit: false, fallback: 'computed' },
  { camel: 'overflow', inherit: false, fallback: 'computed' },
]
