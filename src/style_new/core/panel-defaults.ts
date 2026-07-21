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
      fontStyle: (values as any).fontStyle,
      textTransform: (values as any).textTransform,
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
  cursor(values: CSSProperties, config: any) {
    return {
      cursor: values.cursor
    }
  },
  effects(values: CSSProperties, config: any) {
    return {
      boxShadow: values.boxShadow,
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
      borderTopLeftRadius: values.borderTopLeftRadius,
      borderTopRightRadius: values.borderTopRightRadius,
      borderBottomRightRadius: values.borderBottomRightRadius,
      borderBottomLeftRadius: values.borderBottomLeftRadius,
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
      // flex/flexGrow/flexBasis 本身不是 Size 面板展示的字段，
      // 但 Size 插件在改宽高时会尝试清空它们（避免 flex-basis 覆盖 width/height），
      // 这里注册空白基准值只是为了让它们进入 PANEL_MAP，归属到 size 面板，
      // 使 handleChange 的删除守卫能正确识别并放行这几个属性的清除请求。
      flex: 'auto',
      flexGrow: '0',
      flexBasis: 'auto',
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
      borderTopLeftRadius: '0px',
      borderTopRightRadius: '0px',
      borderBottomRightRadius: '0px',
      borderBottomLeftRadius: '0px',
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
