import type { CSSProperties } from 'react'

export const getDefaultValueFunctionMap = {
  font(values: CSSProperties, config: any) {
    return {
      color: values.color,
      fontSize: values.fontSize,
      textAlign: values.textAlign,
      fontWeight: values.fontWeight,
      fontFamily: values.fontFamily,
      lineHeight: values.lineHeight,
      letterSpacing: values.letterSpacing,
      whiteSpace: values.whiteSpace,
      textOverflow: (values as any).textOverflow,
      webkitLineClamp: (values as any).webkitLineClamp,
      textDecoration: (values as any).textDecoration,
      textDecorationStyle: (values as any).textDecorationStyle,
      textDecorationThickness: (values as any).textDecorationThickness,
      textUnderlineOffset: (values as any).textUnderlineOffset,
      fontStyle: (values as any).fontStyle,
      textTransform: (values as any).textTransform,
      textShadow: (values as any).textShadow,
      // 文字渐变回显（与 background / border 共用栈，Font 侧需要读到）
      backgroundImage: values.backgroundImage,
      backgroundClip: values.backgroundClip,
      backgroundOrigin: (values as any).backgroundOrigin,
      WebkitBackgroundClip: (values as any).WebkitBackgroundClip ?? (values as any).webkitBackgroundClip,
      WebkitTextFillColor: (values as any).WebkitTextFillColor ?? (values as any).webkitTextFillColor,
      backgroundColor: values.backgroundColor,
    }
  },
  border(values: CSSProperties, config: any) {
    return {
      borderTopColor: values.borderTopColor,
      borderBottomColor: values.borderBottomColor,
      borderRightColor: values.borderRightColor,
      borderLeftColor: values.borderLeftColor,
      borderTopLeftRadius: values.borderTopLeftRadius,
      borderTopRightRadius: values.borderTopRightRadius,
      borderBottomRightRadius: values.borderBottomRightRadius,
      borderBottomLeftRadius: values.borderBottomLeftRadius,
      borderTopStyle: values.borderTopStyle,
      borderBottomStyle: values.borderBottomStyle,
      borderRightStyle: values.borderRightStyle,
      borderLeftStyle: values.borderLeftStyle,
      borderTopWidth: values.borderTopWidth,
      borderBottomWidth: values.borderBottomWidth,
      borderLeftWidth: values.borderLeftWidth,
      borderRightWidth: values.borderRightWidth,
      backgroundColor: values.backgroundColor,
      backgroundImage: values.backgroundImage,
      backgroundOrigin: values.backgroundOrigin,
      backgroundClip: values.backgroundClip
    }
  },
  background(values: CSSProperties, config: any) {
    return {
      backgroundColor: values.backgroundColor,
      backgroundImage: values.backgroundImage,
      backgroundRepeat: values.backgroundRepeat,
      backgroundPosition: values.backgroundPosition,
      backgroundSize: values.backgroundSize
    }
  },
  padding(values: CSSProperties, config: any) {
    return {
      paddingTop: values.paddingTop,
      paddingRight: values.paddingRight,
      paddingBottom: values.paddingBottom,
      paddingLeft: values.paddingLeft
    }
  },
  margin(values: CSSProperties, config: any) {
    return {
      marginTop: values.marginTop,
      marginRight: values.marginRight,
      marginBottom: values.marginBottom,
      marginLeft: values.marginLeft
    }
  },
  size(values: CSSProperties, config: any) {
    return {
      width: values.width,
      height: values.height,
      maxWidth: values.maxWidth,
      maxHeight: values.maxHeight,
      minWidth: values.minWidth,
      minHeight: values.minHeight
    }
  },
  flex(values: CSSProperties, config: any) {
    // 只回传已有值，避免 flex: undefined 盖掉 setValue / 其它来源的有效配置
    const out: Record<string, any> = {}
    const v = values as any
    if (v.flex != null && String(v.flex).trim() !== '') out.flex = v.flex
    if (v.flexGrow != null && String(v.flexGrow).trim() !== '') out.flexGrow = v.flexGrow
    if (v.flexShrink != null && String(v.flexShrink).trim() !== '') out.flexShrink = v.flexShrink
    if (v.flexBasis != null && String(v.flexBasis).trim() !== '') out.flexBasis = v.flexBasis
    return out
  },
  cursor(values: CSSProperties, config: any) {
    return {
      cursor: values.cursor
    }
  },
  effects(values: CSSProperties, config: any) {
    return {
      boxShadow: values.boxShadow,
      textShadow: values.textShadow,
      filter: values.filter,
      backdropFilter: (values as any).backdropFilter,
      WebkitBackdropFilter: (values as any).WebkitBackdropFilter ?? (values as any).webkitBackdropFilter,
    }
  },
  // 旧配置兼容：boxshadow / blur → effects
  boxshadow(values: CSSProperties, config: any) {
    return getDefaultValueFunctionMap.effects(values, config)
  },
  blur(values: CSSProperties, config: any) {
    return getDefaultValueFunctionMap.effects(values, config)
  },
  overflow(values: CSSProperties, config: any) {
    return {
      overflowX: values.overflowX,
      overflowY: values.overflowY
    }
  },
  opacity(values: CSSProperties, config: any) {
    return {
      opacity: values.opacity
    }
  },
  appearance(values: CSSProperties, config: any) {
    return {
      opacity: values.opacity,
    }
  },
  zindex(values: CSSProperties, config: any) {
    return {
      zIndex: values.zIndex
    }
  },
  rotation(values: CSSProperties, config: any) {
    return {
      transform: values.transform
    }
  },
  position(values: CSSProperties, config: any) {
    return {
      left: values.left,
      top: values.top,
      // 自由定位切换按钮依赖 position 回显（高亮 / 取消）
      position: values.position,
    }
  },
  layout(values: CSSProperties, config: any) {
    return {
      display: values.display,
      flexDirection: values.flexDirection,
      alignItems: values.alignItems,
      justifyContent: values.justifyContent,
      flexWrap: values.flexWrap,
      rowGap: values.rowGap,
      columnGap: values.columnGap,
      position: values.position,
      overflow: values.overflow,
      paddingTop: values.paddingTop,
      paddingRight: values.paddingRight,
      paddingBottom: values.paddingBottom,
      paddingLeft: values.paddingLeft,
    }
  },
  csspaste(values: CSSProperties, config: any) {
    return {}
  }
}

export const getDefaultValueFunctionMap2 = {
  font() {
    return {
      color: 'transparent',
      fontSize: '14px',
      textAlign: 'start',
      fontWeight: '400',
      fontFamily: '默认',
      lineHeight: 'inherit',
      letterSpacing: 0,
      whiteSpace: 'normal',
      textOverflow: 'clip',
      webkitLineClamp: 'none',
      textDecoration: 'none',
      textDecorationStyle: 'solid',
      textDecorationThickness: 'auto',
      textUnderlineOffset: 'auto',
      fontStyle: 'normal',
      textTransform: 'none',
      // 用于 PANEL_MAP：文字填充相关属性归属 font（后注册的 border/background 会覆盖同名 key）
      WebkitTextFillColor: '',
    }
  },
  border() {
    return {
      borderTopColor: '',
      borderBottomColor: '',
      borderRightColor: '',
      borderLeftColor: '',
      borderTopLeftRadius: '0px',
      borderTopRightRadius: '0px',
      borderBottomRightRadius: '0px',
      borderBottomLeftRadius: '0px',
      borderTopStyle: 'none',
      borderBottomStyle: 'none',
      borderRightStyle: 'none',
      borderLeftStyle: 'none',
      borderTopWidth: '0px',
      borderBottomWidth: '0px',
      borderLeftWidth: '0px',
      borderRightWidth: '0px',
      backgroundImage: 'none',
      backgroundOrigin: '',
      backgroundClip: ''
    }
  },
  background() {
    return {
      // backgroundColor 不继承，初始值固定为 transparent（rgba(0,0,0,0)），
      // 与 borderTopColor 不同，可安全地与计算值做 diff 来检测 UA 填充（如 button 的 buttonface）。
      backgroundColor: 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
      backgroundRepeat: 'repeat',
      backgroundPosition: 'left top',
      backgroundSize: 'auto'
    }
  },
  padding() {
    return {
      paddingTop: '0px',
      paddingRight: '0px',
      paddingBottom: '0px',
      paddingLeft: '0px'
    }
  },
  margin() {
    return {
      marginTop: '0px',
      marginRight: '0px',
      marginBottom: '0px',
      marginLeft: '0px'
    }
  },
  size() {
    return {
      width: 'auto',
      height: 'auto',
      maxWidth: 'auto',
      maxHeight: 'auto',
      minWidth: 'auto',
      minHeight: 'auto',
    }
  },
  flex() {
    return {
      // 归属弹性面板；Size 同批清 flex* 时靠 activePanelsInBatch / 已写入值放行删除
      flex: '',
      flexGrow: '',
      flexShrink: '',
      flexBasis: '',
    }
  },
  cursor() {
    return {
      cursor: 'inherit'
    }
  },
  effects() {
    return {
      boxShadow: 'none',
      textShadow: 'none',
      filter: 'none',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    }
  },
  // 旧配置兼容占位：不注册 CSS 属性到 PANEL_MAP，避免覆盖 effects
  boxshadow() {
    return {}
  },
  blur() {
    return {}
  },
  overflow() {
    return {
      overflowX: 'visible',
      overflowY: 'visible'
    }
  },
  opacity() {
    return {
      opacity: 1
    }
  },
  appearance() {
    return {
      opacity: 1,
    }
  },
  zindex() {
    return {
      zIndex: ''
    }
  },
  rotation() {
    return {
      transform: 'none'
    }
  },
  position() {
    return {
      left: 'auto',
      top: 'auto',
      position: 'static',
    }
  },
  layout() {
    return {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      flexWrap: 'nowrap',
      rowGap: '0px',
      columnGap: '0px',
      position: 'static',
      overflow: 'visible',
      paddingTop: '0px',
      paddingRight: '0px',
      paddingBottom: '0px',
      paddingLeft: '0px',
    }
  },
  csspaste() {
    return {}
  }
}

export const PANEL_MAP: Record<string, string> = {}
Object.keys(getDefaultValueFunctionMap2).forEach(panelType => {
  // @ts-ignore
  const properties = getDefaultValueFunctionMap2[panelType]()
  Object.keys(properties).forEach(property => {
    PANEL_MAP[property] = panelType
  })
})
