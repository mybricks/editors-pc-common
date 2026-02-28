import React, {CSSProperties, useCallback, useMemo, useRef, useState,useEffect} from 'react'
import {createPortal} from "react-dom";

// @ts-ignore
import colorUtil from 'color-string'
// @ts-ignore
import {toCSS, toJSON} from 'cssjson';
// @ts-ignore
import {calculate, compare} from 'specificity';

import {message, Tooltip} from "antd";

import {AppstoreOutlined, CaretRightOutlined, CodeOutlined, CopyOutlined, ReloadOutlined,DeleteOutlined} from '@ant-design/icons'
// @ts-ignore
import MonacoEditor from "@mybricks/code-editor";

import {copyText, deepCopy} from '../utils'
import StyleEditor, {DEFAULT_OPTIONS, StyleEditorProvider} from './StyleEditor'

import {getSuggestOptionsByElement, mergeCSSProperties, splitCSSProperties} from './StyleEditor/helper'

import type {EditorProps, GetDefaultConfigurationProps} from './type'
import type {ChangeEvent, Options, Style} from './StyleEditor/type'

import {useUpdateEffect} from './StyleEditor/hooks'

import css from './index.less'
import {fullScreenIcon, goBackIcon} from './icon';

interface State {
  open: boolean
  editMode: boolean
}

function getDocument() {
  const root = document.getElementById('_mybricks-geo-webview_')?.shadowRoot || document
  return root
}

export default function ({editConfig}: EditorProps) {
  const [titleContent, setTitleContent] = useState("");
  const [targetStyle, setTargetStyle] = useState<any>(null);

  const [
    {
      finalOpen,
      finalDisabledSwitch,
      finalSelector
    },
    canvasEle
  ] = useMemo(() => {

    return [
      getDefaultConfiguration2(editConfig), 
      // @ts-ignore
      editConfig.canvasEle
    ]
  }, [])

  const [{
    open,
    show,
    editMode,
  }, setStatus] = useState({
    open: finalOpen,
    show: finalOpen,
    editMode: true
  })

  const [key, setKey] = useState(0)
  const isResetRef = useRef(false)

  // 切换面板的时候要重新获取样式，否则CSS面板的样式写完就不回显了
  const [{
    targetDom,
    ...styleProps
  },] = useMemo(() => {
    const config = getDefaultConfiguration(editConfig)
    // 重置后，所有面板都应该折叠
    if (isResetRef.current) {
      isResetRef.current = false
      const allOptionKeys = (config.options || []).map((t: any) =>
        typeof t === 'string' ? t.toLowerCase() : t?.type?.toLowerCase()
      )
      config.collapsedOptions = allOptionKeys
    }

    return [config]
  }, [editMode, key])

  const refresh = useCallback(() => {
    editConfig.value.set({})
    isResetRef.current = true
    setKey(key => key + 1)
  }, [])

  const copy = useCallback(() => {
    if (finalSelector) {
      if (typeof finalSelector === "string") {
        copyText(JSON.stringify({
          [finalSelector]: {}
        }))
      } else {
        copyText(JSON.stringify((finalSelector as string[]).reduce((p, c) => {
          p[c] = {};
          return p
        }, {} as any)))
      }
      message.success("复制成功");
    }
  }, [])

  function onOpenClick () {
    if (!finalDisabledSwitch) {
      setStatus((status) => {
        return {
          ...status,
          show: true,
          open: !status.open
        }
      })
    }
  }

  function onEditModeClick () {
    setStatus((status) => {
      return {
        show: true,
        open: true,
        editMode: !status.editMode
      }
    })
  }

  useUpdateEffect(() => {
    setKey(key => key + 1)
  }, [editConfig.ifRefresh?.()])

  const title = useMemo(() => {
    return (
      <>
      {/* 可视化编辑态的工具条 */}
      {editMode &&  (<div
        // onMouseEnter={onMouseEnter}
        // onMouseLeave={onMouseLeave}
        className={css.titleContainer}
        //style={{ marginBottom: open ? 3 : 0 }}
      >
        <div className={css.title} onClick={onOpenClick}>
          {/*{finalDisabledSwitch ? null : <div*/}
          {/*  className={`${css.icon}${open ? ` ${css.iconOpen}` : ''}`}*/}
          {/*  data-mybricks-tip={open ? '收起' : '展开'}*/}
          {/*>*/}
          {/*  <CaretRightOutlined />*/}
          {/*</div>}*/}
          <div>
              {editConfig.title}
            {/* <span className={css.tips}>{titleContent}</span> */}
            </div>
        </div>
        <div className={css.actions}>
          <div
            className={css.selector}
            data-mybricks-tip={finalSelector}        
            onClick={copy}
            >
            {finalSelector}
          </div>

          <div
            className={css.icon}
            data-mybricks-tip={'复制selector'}
            onClick={copy}
          >
            <CopyOutlined />
          </div>
          <div
            className={css.icon}
            data-mybricks-tip={'重置'}
            onClick={refresh}
          >
            <ReloadOutlined />
          </div>
          <div
            className={css.icon}
            data-mybricks-tip={'代码编辑'}
            onClick={onEditModeClick}
          >
            {editMode ? <CodeOutlined /> : <AppstoreOutlined />}
          </div>
        </div>
      </div>)}
      {/* 代码编辑的工具条 */}
      {!editMode && (<div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={css.titleContainer}
        //style={{ marginBottom: open ? 3 : 0 }}
      >
        <div className={css.title} style={{fontWeight: "normal"}} onClick={onOpenClick}>
          {finalDisabledSwitch ? null : <div
            className={`${css.icon}${open ? ` ${css.iconOpen}` : ''}`}
            data-mybricks-tip={open ? '收起' : '展开'}
          >
            <CaretRightOutlined />
          </div>}
          <div>
            {editConfig.title}
            {/* <span className={css.tips}>
              {titleContent}
            </span> */}
          </div>
        </div>
        <div className={css.actions_allawys_display}>
          <div
            className={css.selector}
            data-mybricks-tip={finalSelector}        
            onClick={copy}
            >
            {finalSelector}
          </div>
          <div
            className={css.icon}
            data-mybricks-tip={'复制selector'}
            onClick={copy}
          >
            <CopyOutlined />
          </div>
          <div
            className={css.icon}
            data-mybricks-tip={'重置'}
            onClick={refresh}
          >
            <ReloadOutlined/>
          </div>
          <div
            className={css.icon}
            data-mybricks-tip={`{content:'返回可视化编辑',position:'left'}`}
            onClick={onEditModeClick}
          >
            {/* {<AppstoreOutlined />} */}
            {goBackIcon}
          </div>
        </div>
      </div>)}
      </>
    )
  }, [open, editMode, titleContent])

  const editor = useMemo(() => {
    if (editMode) {
      return (
        <Style editConfig={editConfig} {...styleProps}/>
      )
    } else {
      return (
        <CssEditor {...editConfig} selector={':root'} onChange={(value: any) => {
          editConfig.value.set(deepCopy(value))
        }}/>
      )
    }
  }, [editMode, key])

  function onMouseEnter() {
    try {
      if (canvasEle && targetDom.length) {
        setTitleContent("(已标记)")
        const res: any = Array.from(targetDom).reduce((res: any, dom: any) => {
          const rect = dom.getBoundingClientRect()
          if (res.left > rect.left) {
            res.left = rect.left
          }
          if (res.top > rect.top) {
            res.top = rect.top
          }
          const width = rect.left + rect.width
          if (res.width < width) {
            res.width = width
          }
          const height = rect.top + rect.height
          if (res.height < height) {
            res.height = height
          }
          
          return res
        }, {
          left: Infinity,
          top: Infinity,
          width: -Infinity,
          height: -Infinity
        })
        const width = res.width - res.left
        const height = res.height - res.top
        const cRect = canvasEle.getBoundingClientRect()
        setTargetStyle({
          canvas: {
            left: res.left - cRect.left,
            top: res.top - cRect.top,
            width,
            height
          },
          tips: {
            left: res.left - cRect.left,
            top: res.top - cRect.top + 8,
          }
        })
      } else {
        setTitleContent("(非dom节点)")
      }
    } catch {}
  }

  function onMouseLeave() {
    try {
      if (canvasEle && targetDom.length) {
        setTargetStyle(null)
      }
      setTitleContent("")
    } catch {}
  }

  return {
    render: (
      <>
        {title}
        <div key={key} style={{display: open ? 'block' : 'none'}}>
          {show && editor}
        </div>
        {canvasEle && targetStyle && createPortal(
          <>
            <div className={css.popupTips} style={targetStyle.canvas}></div>
            <Tooltip
              placement="topLeft"
              title={editConfig.title || "当前dom区域"}
              visible={true}
              overlayInnerStyle={{
                color: "#555",
                fontSize: 12,
                minWidth: 50,
                textAlign: 'center',
                boxShadow: "0px 1px 4px 2px rgba(39, 54, 78, 0.37)",
                borderRadius: 4
              }}
              color='#fff'
              transitionName=""
            >
              <div className={css.popupTips} style={targetStyle.tips}></div>
            </Tooltip>
          </>
          , canvasEle)}
      </>
    )
  }
}

interface StyleProps extends EditorProps {
  [key: string]: any;
}
function Style ({editConfig, options, setValue, collapsedOptions, autoCollapseWhenUnusedProperty, finnalExcludeOptions, defaultValue }: StyleProps) {
  const handleChange: ChangeEvent = useCallback((value) => {
    // 每次操作开始前清空上次可能残留的删除信号，防止普通组件的删除操作污染 AI 组件
    ;(window as any).__mybricks_style_deletions = null
    const deletedKeys: string[] = []

    if (Array.isArray(value)) {
      value.forEach(({key, value}) => {
        if (value === null) {
          deletedKeys.push(key)
          delete setValue[key]
        } else {
          setValue[key] = value
        }
      })
    } else {
      if (value.value === null) {
        deletedKeys.push(value.key)
        delete setValue[value.key]
      } else {
        setValue[value.key] = value.value;
      }
    }

    // 删除信号通过 window 侧通道传递给 valueProxy.set，
    // 不污染 editConfig.value（代码编辑器不会看到 null 值）
    if (deletedKeys.length > 0) {
      (window as any).__mybricks_style_deletions = deletedKeys
    }

    const mergedCssProperties = mergeCSSProperties(deepCopy(setValue))

    editConfig.value.set(mergedCssProperties)
  }, [])

  const editorContext = useMemo(() => {
    return {
      editConfig,
      autoCollapseWhenUnusedProperty
    }
  }, [editConfig, autoCollapseWhenUnusedProperty])

  return (
    <StyleEditorProvider value={editorContext}>
      <StyleEditor
        defaultValue={defaultValue}
        options={options}
        finnalExcludeOptions={finnalExcludeOptions}
        collapsedOptions={collapsedOptions}
        onChange={handleChange}
      />
    </StyleEditorProvider>
  )
}

// code
const CSS_EDITOR_TITLE = 'CSS样式编辑'

function getDefaultValue({value, selector}: any) {
  const styleValue = deepCopy(value.get() || {})

  return parseToCssCode(styleValue, selector)
}

export interface StyleData {
  styleKey: string;
  value: string | number | boolean;
}

/**
 * 将驼峰写法改成xx-xx的css命名写法
 * @param styleKey
 */
export function toLine(styleKey: string) {
  return styleKey.replace(/([A-Z])/g, '-$1').toLowerCase();
}

export function toHump(name: String) {
  return name.replace(/\-(\w)/g, (all, letter) => {
    return letter.toUpperCase();
  });
}

function parseToCssCode(styleData: StyleData, selector: string) {
  const parseStyleData: any = {};
  for (const styleKey in styleData) {
    // @ts-ignore
    parseStyleData[toLine(styleKey)] = styleData[styleKey];
  }

  const cssJson = {
    children: {
      [selector || 'div']: {
        children: {},
        attributes: parseStyleData,
      },
    },
  };

  return toCSS(cssJson);
}

export function parseToStyleData(cssCode: string, selector: string) {
  const styleData = {};
  try {
    const cssJson = toJSON(cssCode.trim().endsWith('}') ? cssCode : (cssCode + '}'));// 包bug
    const cssJsonData = cssJson?.children?.[selector || 'div']?.attributes;
    for (const key in cssJsonData) {
      // @ts-ignore
      styleData[toHump(key)] = cssJsonData[key];
    }
  } catch (e: any) {
    console.error(e.message);
  }

  return styleData;
}

function CssEditor ({popView, options, value, selector, onChange: onPropsChange, getDefaultOptions}: any) {
  const [cssValue, setCssValue] = useState(getDefaultValue({value, selector}))
  const editorRef = useRef<MonacoEditor>(null)
  const defaultOptions = useMemo(() => getDefaultOptions?.('stylenew') ?? {}, []);
  const [context] = useState({value: cssValue})

  const onMounted = useCallback((editor: any) => {
    editorRef.current = editor
  }, [])

  const onChange = useCallback((value: any) => {
    setCssValue(value);

    context.value = value
  }, [])

  const onBlur = useCallback(() => {
    const newStyleData = parseToStyleData(context.value, selector);
    onPropsChange(newStyleData)
  }, [])

  const onFullscreen = useCallback(() => {
    popView(
      CSS_EDITOR_TITLE,
      () => {
        return <div className={css.modal}>{monaco}</div>;
      },
      { 
        onClose: () => {
          // const val = editorRef.current?.getValue();
        }
      }
    )
  }, [cssValue])

  const monaco = useMemo(() => {
    return (
      <MonacoEditor
        height='100%'
        onMounted={onMounted}
        value={cssValue}
        onChange={onChange}
        CDN={defaultOptions.CDN}
        onBlur={onBlur}
        language='css'
      />
    )
  }, [cssValue])

  return (
    <div className={css.codeWrap}>
      <div className={css.inlineWrap}>
        {/* <div className={css.header}>
          <span className={css.title}>{'CSS样式编辑'}</span>
          <div data-mybricks-tip='放大编辑' className={css.plus} onClick={onFullscreen}>
            <FullscreenOutlined />
          </div>
        </div> */}
        <div className={css.body}>
          <div data-mybricks-tip='放大' className={css.plus} onClick={onFullscreen}>
            {fullScreenIcon}
          </div>
          {monaco}
        </div>
      </div>
    </div>
  )
}

function getDefaultConfiguration2 ({value, options}: GetDefaultConfigurationProps) {
  let finalOpen = false
  let finalDisabledSwitch = false
  let finalSelector

  if (!options) {

  } else if (Array.isArray(options)) {

  } else {
    const { plugins, selector, targetDom, defaultOpen = false, disabledSwitch = false } = options
    finalSelector = selector
    finalOpen = defaultOpen
    if (disabledSwitch) {
      // 禁用开关，默认打开
      finalOpen = true
    }
    finalDisabledSwitch = disabledSwitch
  }

  return {
    finalOpen,
    finalSelector,
    finalDisabledSwitch
  } as {
    finalOpen: boolean,
    finalSelector: string,
    finalDisabledSwitch: boolean,
  }
}

/**
 * 获取默认的配置项和样式
 */
function getDefaultConfiguration ({value, options}: GetDefaultConfigurationProps) {
  let finalOpen = false
  let finalOptions
  /** 自动收起没有生效的 CSS 插件 */
  let autoCollapseWhenUnusedProperty = true;
  let defaultValue: CSSProperties = {}
  let finalSelector
  const setValue = deepCopy(value.get() || {})

  let getDefaultValue = true
  let dom;
  let effctedOptions: string[] | null = null;
  let finnalExcludeOptions: string[] | null = null;

  if (!options) {
    // 没有options，普通编辑器配置使用，直接使用默认的配置，展示全部
    finalOptions = DEFAULT_OPTIONS
  } else if (Array.isArray(options)) {
    // options是一个数组，直接使用
    finalOptions = options
  } else {
    const { plugins, selector, targetDom, defaultOpen = false, autoOptions = false, exclude, comId } = options
    dom = targetDom
    finalSelector = selector
    finalOpen = defaultOpen
    // 这里还要再处理一下 
    finalOptions = plugins || DEFAULT_OPTIONS

    // 黑名单
    if (exclude) {
      finnalExcludeOptions = exclude
    }

    let realTargetDom: HTMLElement | undefined

    if (Object.prototype.toString.call(targetDom) === '[object NodeList]' && targetDom?.length) {
      realTargetDom = targetDom[0]
    } else if (Object.prototype.toString.call(targetDom).indexOf('HTML') > -1) {
      realTargetDom = targetDom as any
    }

    /** 用户是否配置options */
    const userNoConfig = finalOptions === DEFAULT_OPTIONS
    
    // 未配置options，开启自动折叠
    if (userNoConfig || autoOptions) {
      autoCollapseWhenUnusedProperty = true
    }
    // 未配置options，自动disabled不可用的配置
    if ((userNoConfig || autoOptions) && !!realTargetDom) {
      finalOptions = getSuggestOptionsByElement(realTargetDom) ?? finalOptions
    }
    
    // 如果有真实DOM就用DOM，否则对于伪元素选择器使用selector逻辑
    // 将引擎传入的 [data-zone-selector='[".listContainer .card"]'] 格式转换为 CSS 选择器
    // 否则 getStyleRules 无法在样式表里匹配到对应规则，导致 effectedPanels 为空、面板全部折叠
    const rawSelector = Array.isArray(selector) ? selector[0] : selector;
    const zoneMatch = rawSelector?.match(/\[data-zone-selector=['"]?\[?["']([^"']+)["']\]?['"]?\]/);
    const realSelector = zoneMatch ? zoneMatch[1] : rawSelector;

    const isPseudoSelector = typeof realSelector === 'string' && /:(:)?[a-zA-Z0-9\-\_]+/.test(realSelector);
    const realDom = !!realTargetDom ? realTargetDom : null;
    if (realDom || isPseudoSelector) {
      getDefaultValue = false;
      const [styleValues, options] = getEffectedCssPropertyAndOptions(realDom, realSelector, comId);
      effctedOptions = options;
      finalOptions.forEach((option) => {
        let type, config;
        if (typeof option === 'string') {
          type = option.toLowerCase();
          config = {};
        } else {
          type = option.type.toLowerCase();
          config = option.config || {};
        }
        // @ts-ignore
        if (DEFAULT_OPTIONS.includes(type)) {
          // @ts-ignore TODO: 类型补全
          Object.assign(defaultValue, getDefaultValueFunctionMap[type](styleValues, config));
        }
      });
    }
  }

  if (getDefaultValue) {
    finalOptions.forEach((option) => {
      let type, config

      if (typeof option === 'string') {
        type = option.toLowerCase()
        config = {}
      } else {
        type = option.type.toLowerCase()
        config = option.config || {}
      }

      // @ts-ignore
      if (DEFAULT_OPTIONS.includes(type)) {
        // @ts-ignore TODO: 类型补全
        Object.assign(defaultValue, getDefaultValueFunctionMap2[type]())
      }
    })
  }

  const splitedSetValue = splitCSSProperties(setValue)

  const setValueEffectedPanels = new Set<string>();
  Object.keys(splitedSetValue).forEach(property => {
    if (PANEL_MAP[property]) {
      setValueEffectedPanels.add(PANEL_MAP[property])
    }
  })

  let collapsedOptions: any = [];
  if (effctedOptions) {
    collapsedOptions = finalOptions.map(t => {
      return typeof t === 'string' ? t.toLowerCase() : t?.type.toLowerCase()
    }).filter(t => !effctedOptions.includes(t) && !setValueEffectedPanels.has(t))
  }

  return {
    options: finalOptions,
    collapsedOptions,
    autoCollapseWhenUnusedProperty,
    defaultValue: Object.assign(defaultValue, splitedSetValue),
    setValue: Object.assign({}, splitedSetValue),
    finalOpen,
    finalSelector,
    finnalExcludeOptions,
    targetDom: dom,
  } as {
    options: Options,
    collapsedOptions: string[]
    autoCollapseWhenUnusedProperty: boolean,
    defaultValue: CSSProperties,
    setValue: CSSProperties & Record<string, any>,
    finalOpen: boolean,
    finalSelector: string,
    finnalExcludeOptions: any,
    targetDom: any,
  }
}

const getDefaultValueFunctionMap = {
  font(values: CSSProperties, config: any) {
    return {
      color: values.color,
      fontSize: values.fontSize,
      textAlign: values.textAlign,
      fontWeight: values.fontWeight,
      fontFamily: values.fontFamily,
      lineHeight: values.lineHeight,
      letterSpacing: values.letterSpacing,
      whiteSpace: values.whiteSpace
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
      borderRightWidth: values.borderRightWidth
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
  boxshadow(values: CSSProperties, config: any) {
    return {
      boxShadow: values.boxShadow
    }
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
  }
}

const getDefaultValueFunctionMap2 = {
  font() {
    return {
      color: 'transparent',
      fontSize: '14px',
      textAlign: 'start',
      fontWeight: '400',
      fontFamily: '默认',
      lineHeight: 'inherit',
      letterSpacing: 0,
      whiteSpace: 'normal'
    }
  },
  border() {
    return {
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderRightColor: 'transparent',
      borderLeftColor: 'transparent',
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
      borderRightWidth: '0px'
    }
  },
  background() {
    return {
      backgroundColor: 'transparent',
      backgroundImage: 'none',
      backgroundRepeat: 'repeat',
      backgroundPosition: 'left top',
      backgroundSize: 'cover'
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
  cursor() {
    return {
      cursor: 'inherit'
    }
  },
  boxshadow() {
    return {
      boxShadow: ''
    }
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
  layout() {
    return {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      flexWrap: 'nowrap',
      rowGap: '0px',
      columnGap: '0px',
      position: 'inherit',
      overflow: 'visible',
      paddingTop: '0px',
      paddingRight: '0px',
      paddingBottom: '0px',
      paddingLeft: '0px',
    }
  }
}

/** 获取当前CSS规则下生效的样式以及插件 */
function getEffectedCssPropertyAndOptions (element: HTMLElement | null, selector: string, comId?: string) {
  try {
    let finalRules;
    let computedValues;

    if (element) {
      // 处理真实DOM元素的情况
      const classListValue = element.classList.value
      finalRules = getStyleRules(element, classListValue.indexOf(selector) !== -1 ? null : selector).filter((finalRule: any) => {
        let tempCompare
        try {
          tempCompare = calculate(finalRule.selectorText)
        } catch {}

        if (tempCompare) {
          finalRule.tempCompare = tempCompare
          return true
        }

        return false
      }).sort((a, b) => {
        // @ts-ignore
        return compare(a.tempCompare, b.tempCompare)
      })

      // 检查是否是伪元素选择器（使用::或:before/:after）
      const isPseudoElement = selector.includes('::') || selector.includes(':before') || selector.includes(':after')
      if (isPseudoElement) {
        // 对于伪元素，使用第二个参数来获取其计算样式
        const pseudoSelector = selector.split(':')[1]
        computedValues = window.getComputedStyle(element, pseudoSelector)
      } else {
        computedValues = window.getComputedStyle(element)
      }
    } else if (selector) {

      // 处理纯selector的情况（包括伪类如:hover, :disabled等）
      finalRules = getStyleRules(null, selector).filter((finalRule: any) => {
        let tempCompare
        try {
          tempCompare = calculate(finalRule.selectorText)
        } catch {}

        if (tempCompare) {
          finalRule.tempCompare = tempCompare
          return true
        }

        return false
      }).sort((a, b) => {
        // @ts-ignore
        return compare(a.tempCompare, b.tempCompare)
      })

      // 获取基础选择器对应的元素
      const root = getDocument()
      const baseSelector = selector.split(':')[0]
      const targetElement = root.querySelector(`#${comId} ${baseSelector}`)
      
      if (targetElement) {
        // 检查是否是伪元素（如::before、::after、::placeholder）
        const pseudoMatch = selector.match(/(::[a-zA-Z0-9\-]+)/);
        const pseudoSelector = pseudoMatch ? pseudoMatch[0] : null;
        if (pseudoSelector) {
          computedValues = window.getComputedStyle(targetElement, pseudoSelector);
        } else {
          // TDDO，现在获取不到样式表的 finalRules，因为类名可能不一样

          // 属于伪类（如:hover、:disabled等），则获取普通元素的computedStyle作为基础样式
          computedValues = window.getComputedStyle(targetElement);
        }
      } else {
        // 如果找不到对应元素，创建一个空的，防止报错
        computedValues = window.getComputedStyle(document.createElement('div'))
      }
    } else {
      return [{}, []]
    }

    const effectedPanels = getEffectedPanelsFromCssRules(finalRules)
    const values = getValues(finalRules, computedValues)

    return [values, effectedPanels]
  } catch (e) {
    return [{}, []]
  }
}

function getValues (rules: CSSStyleRule[], computedValues: CSSStyleDeclaration) {
  // TODO: 先一个个来吧，后面改一下
  /** font */
  let color // 继承属性
  let fontSize // 继承属性
  let textAlign // 继承属性
  let fontWeight // 继承属性
  let lineHeight // 继承属性
  let fontFamily // 继承属性
  let letterSpacing // 继承属性
  let linHeight // 继承属性
  let whiteSpace // 继承属性
  /** font */

  /** padding */
  let paddingTop // 非继承属性
  let paddingRight // 非继承属性
  let paddingBottom // 非继承属性
  let paddingLeft // 非继承属性
  /** padding */

  /** margin */
  let marginTop // 非继承属性
  let marginRight // 非继承属性
  let marginBottom // 非继承属性
  let marginLeft // 非继承属性
  /** margin */

  /** background */
  let backgroundColor // 非继承属性
  let backgroundImage // 非继承属性
  let backgroundRepeat // 非继承属性
  let backgroundPosition // 非继承属性
  let backgroundSize // 非继承属性
  /** background */

  /** border */
  let borderTopColor // 非继承属性
  let borderRightColor // 非继承属性
  let borderBottomColor // 非继承属性
  let borderLeftColor // 非继承属性
  let borderTopLeftRadius // 非继承属性
  let borderTopRightRadius // 非继承属性
  let borderBottomRightRadius // 非继承属性
  let borderBottomLeftRadius // 非继承属性
  let borderTopStyle // 非继承属性
  let borderRightStyle // 非继承属性
  let borderBottomStyle // 非继承属性
  let borderLeftStyle // 非继承属性
  let borderTopWidth // 非继承属性
  let borderBottomWidth // 非继承属性
  let borderLeftWidth // 非继承属性
  let borderRightWidth // 非继承属性
  /** border */

  /** size */
  let width // 非继承属性
  let height // 非继承属性
  let maxWidth
  let maxHeight
  let minWidth
  let minHeight
  /** size */

  /** cursor */
  let cursor // 非继承属性
  /** cursor */

  /** boxshadow */
  let boxShadow // 非继承属性
  /** boxshadow */

  /** overflow */
  let overflowX // 非继承属性
  let overflowY // 非继承属性
  /** overflow */

  /** opacity */
  let opacity // 非继承属性
  /** opacity */

  /** layout */
  let display // 非继承属性
  let flexDirection // 非继承属性
  let alignItems // 非继承属性
  let justifyContent // 非继承属性
  let flexWrap // 非继承属性
  let rowGap // 非继承属性
  let columnGap // 非继承属性
  let position // 非继承属性
  let overflow // 非继承属性
  /** layout */

  rules.forEach((rule) => {
    const { style } = rule

    /** font */
    const {
      color: styleColor,
      fontSize: styleFontSize,
      textAlign: styleTextAlign,
      fontWeight: styleFontWeight,
      lineHeight: styleLineHeight,
      fontFamily: styleFontFamily,
      letterSpacing: styleLetterSpacing,
      whiteSpace: styleWhiteSpace
    } = style
    if (styleColor) {
      color = styleColor
    }
    if (styleFontSize) {
      fontSize = styleFontSize
    }
    if (styleTextAlign) {
      textAlign = styleTextAlign
    }
    if (styleFontWeight) {
      fontWeight = styleFontWeight
    }
    if (styleLineHeight) {
      lineHeight = styleLineHeight
    }
    if (styleFontFamily) {
      fontFamily = styleFontFamily
    }
    if (styleLetterSpacing) {
      letterSpacing = styleLetterSpacing
    }
    if (styleWhiteSpace) {
      whiteSpace = styleWhiteSpace
    }
    /** font */

    /** padding */
    const {
      paddingTop: stylePaddingTop,
      paddingRight: stylePaddingRight,
      paddingBottom: stylePaddingBottom,
      paddingLeft: stylePaddingLeft
    } = style
    if (stylePaddingTop) {
      paddingTop = stylePaddingTop
    }
    if (stylePaddingRight) {
      paddingRight = stylePaddingRight
    }
    if (stylePaddingBottom) {
      paddingBottom = stylePaddingBottom
    }
    if (stylePaddingLeft) {
      paddingLeft = stylePaddingLeft
    }
    /** padding */

    /** margin */
    const {
      marginTop: styleMarginTop,
      marginRight: styleMarginRight,
      marginBottom: styleMarginBottom,
      marginLeft: styleMarginLeft
    } = style
    if (styleMarginTop) {
      marginTop = styleMarginTop
    }
    if (styleMarginRight) {
      marginRight = styleMarginRight
    }
    if (styleMarginBottom) {
      marginBottom = styleMarginBottom
    }
    if (styleMarginLeft) {
      marginLeft = styleMarginLeft
    }
    /** margin */

    /** background */
    const {
      backgroundColor: styleBackgroundColor,
      backgroundImage: styleBackgroundImage,
      backgroundRepeat: styleBackgroundRepeat,
      backgroundPosition: styleBackgroundPosition,
      backgroundSize: styleBackgroundSize
    } = style
    if (styleBackgroundColor) {
      backgroundColor = styleBackgroundColor
    }
    if (styleBackgroundImage) {
      backgroundImage = styleBackgroundImage
    }
    if (styleBackgroundRepeat) {
      backgroundRepeat = styleBackgroundRepeat
    }
    if (styleBackgroundPosition) {
      backgroundPosition = styleBackgroundPosition
    }
    if (styleBackgroundSize) {
      backgroundSize = styleBackgroundSize
    }
    /** background */

    /** border */
    const {
      borderTopColor: styleBorderTopColor,
      borderRightColor: styleBorderRightColor,
      borderBottomColor: styleBorderBottomColor,
      borderLeftColor: styleBorderLeftColor,
      borderTopLeftRadius: styleBorderTopLeftRadius,
      borderTopRightRadius: styleBorderTopRightRadius,
      borderBottomRightRadius: styleBorderBottomRightRadius,
      borderBottomLeftRadius: styleBorderBottomLeftRadius,
      borderTopStyle: styleBorderTopStyle,
      borderRightStyle: styleBorderRightStyle,
      borderBottomStyle: styleBorderBottomStyle,
      borderLeftStyle: styleBorderLeftStyle,
      borderTopWidth: styleBorderTopWidth,
      borderBottomWidth: styleBorderBottomWidth,
      borderLeftWidth: styleBorderLeftWidth,
      borderRightWidth: styleBorderRightWidth
    } = style
    if (styleBorderTopColor) {
      borderTopColor = styleBorderTopColor
    }
    if (styleBorderRightColor) {
      borderRightColor = styleBorderRightColor
    }
    if (styleBorderBottomColor) {
      borderBottomColor = styleBorderBottomColor
    }
    if (styleBorderLeftColor) {
      borderLeftColor = styleBorderLeftColor
    }
    if (styleBorderTopLeftRadius) {
      borderTopLeftRadius = styleBorderTopLeftRadius
    }
    if (styleBorderTopRightRadius) {
      borderTopRightRadius = styleBorderTopRightRadius
    }
    if (styleBorderBottomRightRadius) {
      borderBottomRightRadius = styleBorderBottomRightRadius
    }
    if (styleBorderBottomLeftRadius) {
      borderBottomLeftRadius = styleBorderBottomLeftRadius
    }
    if (styleBorderTopStyle) {
      borderTopStyle = styleBorderTopStyle
    }
    if (styleBorderRightStyle) {
      borderRightStyle = styleBorderRightStyle
    }
    if (styleBorderBottomStyle) {
      borderBottomStyle = styleBorderBottomStyle
    }
    if (styleBorderLeftStyle) {
      borderLeftStyle = styleBorderLeftStyle
    }
    if (styleBorderTopWidth) {
      borderTopWidth = styleBorderTopWidth
    }
    if (styleBorderBottomWidth) {
      borderBottomWidth = styleBorderBottomWidth
    }
    if (styleBorderLeftWidth) {
      borderLeftWidth = styleBorderLeftWidth
    }
    if (styleBorderRightWidth) {
      borderRightWidth = styleBorderRightWidth
    }
    /** border */

    /** size */
    const {
      width: styleWidth,
      height: styleHeight,
      maxWidth: styleMaxWidth,
      maxHeight: styleMaxHeight,
      minWidth: styleMinWidth,
      minHeight: styleMinHeight,
    } = style
    if (styleWidth) {
      width = styleWidth
    }
    if (styleHeight) {
      height = styleHeight
    }
    if (styleMaxWidth) {
      maxWidth = styleMaxWidth
    }
    if (styleMaxHeight) {
      maxHeight = styleMaxHeight
    }
    if (styleMinWidth) {
      minWidth = styleMinWidth
    }
    if (styleMinHeight) {
      minHeight = styleMinHeight
    }
    /** size */

    /** cursor */
    const {
      cursor: styleCursor
    } = style
    if (styleCursor) {
      cursor = styleCursor
    } 
    /** cursor */

    /** boxShadow TODO:  */
    // const {
    //   boxShadow: styleBoxShadow
    // } = style
    // if (styleBoxShadow) {
    //     boxShadow = styleBoxShadow
    //   }
    /** boxShadow */

    /** overflow */
    const {
      overflowX: styleOverflowX,
      overflowY: styleOverflowY
    } = style
    if (styleOverflowX) {
      overflowX = styleOverflowX
    }
    if (styleOverflowY) {
      overflowY = styleOverflowY
    }
    /** overflow */

    /** opacity */
    const { opacity: styleOpacity } = style
    if (styleOpacity) {
      opacity = styleOpacity
    }
    /** opacity */

    /** layout */
    const {
      display: styleDisplay,
      flexDirection: styleFlexDirection,
      alignItems: styleAlignItems,
      justifyContent: styleJustifyContent,
      flexWrap: styleFlexWrap,
      rowGap: styleRowGap,
      columnGap: styleColumnGap,
      position: stylePosition,
      overflow: styleOverflow,
    } = style
    if (styleDisplay) { display = styleDisplay }
    if (styleFlexDirection) { flexDirection = styleFlexDirection }
    if (styleAlignItems) { alignItems = styleAlignItems }
    if (styleJustifyContent) { justifyContent = styleJustifyContent }
    if (styleFlexWrap) { flexWrap = styleFlexWrap }
    if (styleRowGap) { rowGap = styleRowGap }
    if (styleColumnGap) { columnGap = styleColumnGap }
    if (stylePosition) { position = stylePosition }
    if (styleOverflow) { overflow = styleOverflow }
    /** layout */
  })

  const isNotSet = (v: any) => v === undefined || v === 'inherit';

  /** font */
  if (isNotSet(color) || !colorUtil.get(color)) {
    color = computedValues.color
  }
  if (isNotSet(fontSize)) {
    fontSize = computedValues.fontSize
  }
  if (isNotSet(textAlign)) {
    textAlign = computedValues.textAlign
  }
  if (isNotSet(fontWeight)) {
    fontWeight = computedValues.fontWeight
  }
  if (isNotSet(lineHeight)) {
    lineHeight = computedValues.lineHeight
  }
  if (!fontFamily) {
    // fontFamily = computedValues.fontFamily
    fontFamily = 'inherit'
  }
  if (isNotSet(letterSpacing)) {
    letterSpacing = computedValues.letterSpacing
  }
  if (isNotSet(whiteSpace)) {
    whiteSpace = computedValues.whiteSpace
  }
  /** font */

  /** padding */
  if (!paddingTop) {
    paddingTop = computedValues.paddingTop
  }
  if (!paddingRight) {
    paddingRight = computedValues.paddingRight
  }
  if (!paddingBottom) {
    paddingBottom = computedValues.paddingBottom
  }
  if (!paddingLeft) {
    paddingLeft = computedValues.paddingLeft
  }
  /** padding */

  /** margin */
  if (!marginTop) {
    marginTop = computedValues.marginTop
  }
  if (!marginRight) {
    marginRight = computedValues.marginRight
  }
  if (!marginBottom) {
    marginBottom = computedValues.marginBottom
  }
  if (!marginLeft) {
    marginLeft = computedValues.marginLeft
  }
  /** margin */


  /** background */
  if (!backgroundColor || !colorUtil.get(backgroundColor)) {
    backgroundColor = computedValues.backgroundColor
  }
  if (!backgroundImage) {
    // backgroundImage = computedValues.backgroundImage
    backgroundImage = 'none'
  }
  if (!backgroundRepeat) {
    backgroundRepeat = computedValues.backgroundRepeat
  }
  if (!backgroundPosition) {
    // backgroundPosition = computedValues.backgroundPosition
    backgroundPosition = 'left top'
  }
  if (!backgroundSize) {
    backgroundSize = computedValues.backgroundSize
  }
  /** background */

  /** border */
  if (!borderTopColor || !colorUtil.get(borderTopColor)) {
    borderTopColor = computedValues.borderTopColor // 默认使用当前元素color,否则为浏览器默认颜色
  }
  if (!borderRightColor || !colorUtil.get(borderRightColor)) {
    borderRightColor = computedValues.borderRightColor
  }
  if (!borderBottomColor || !colorUtil.get(borderBottomColor)) {
    borderBottomColor = computedValues.borderBottomColor
  }
  if (!borderLeftColor || !colorUtil.get(borderLeftColor)) {
    borderLeftColor = computedValues.borderLeftColor
  }
  if (!borderTopLeftRadius) {
    borderTopLeftRadius = computedValues.borderTopLeftRadius
  }
  if (!borderTopRightRadius) {
    borderTopRightRadius = computedValues.borderTopRightRadius
  }
  if (!borderBottomRightRadius) {
    borderBottomRightRadius = computedValues.borderBottomRightRadius
  }
  if (!borderBottomLeftRadius) {
    borderBottomLeftRadius = computedValues.borderBottomLeftRadius
  }
  if (!borderTopStyle) {
    borderTopStyle = computedValues.borderTopStyle
  }
  if (!borderRightStyle) {
    borderRightStyle = computedValues.borderRightStyle
  }
  if (!borderBottomStyle) {
    borderBottomStyle = computedValues.borderBottomStyle
  }
  if (!borderLeftStyle) {
    borderLeftStyle = computedValues.borderLeftStyle
  }
  if (!borderTopWidth || borderTopWidth === 'initial') {
    borderTopWidth = computedValues.borderTopWidth
  }
  if (!borderBottomWidth || borderBottomWidth === 'initial') {
    borderBottomWidth = computedValues.borderBottomWidth
  }
  if (!borderLeftWidth || borderLeftWidth === 'initial') {
    borderLeftWidth = computedValues.borderLeftWidth
  }
  if (!borderRightWidth || borderRightWidth === 'initial') {
    borderRightWidth = computedValues.borderRightWidth
  }
  /** border */

  /** size */
  if (!width) {
    width = 'auto'
  }
  if (!height) {
    height = 'auto'
  }
  if (!maxWidth) {
    maxWidth = 'auto'
  }
  if (!maxHeight) {
    maxHeight = 'auto'
  }
  if (!minWidth) {
    minWidth = 'auto'
  }
  if (!minHeight) {
    minHeight = 'auto'
  }
  /** size */

  /** cursor */
  if (!cursor) {
    cursor = 'inherit'
  }
  /** cursor */

  /** boxshadow */
  if (!boxShadow) {
    boxShadow = computedValues.boxShadow;
  }
  /** boxshadow */

  /** overflow */
  if (!overflowX) {
    overflowX = computedValues.overflowX
  }
  if (!overflowY) {
    overflowY = computedValues.overflowY
  }
  /** overflow */

  /** opacity */
  if (!opacity) {
    opacity = 1
  }
  /** opacity */

  /** layout */
  // 若 CSS 规则里没有显式设置这些属性，则从 computedValues 读取当前计算值作为回显基准。
  // position 默认为 'static'（浏览器计算值），回显时直接使用即可。
  if (!display) { display = computedValues.display }
  if (!flexDirection) { flexDirection = computedValues.flexDirection }
  if (!alignItems) { alignItems = computedValues.alignItems }
  if (!justifyContent) { justifyContent = computedValues.justifyContent }
  if (!flexWrap) { flexWrap = computedValues.flexWrap }
  // 浏览器对非 flex/grid 容器的 gap 计算值是 'normal'，InputNumber 无法解析，统一归零
  if (!rowGap || rowGap === 'normal') { rowGap = computedValues.rowGap === 'normal' ? '0px' : (computedValues.rowGap || '0px') }
  if (!columnGap || columnGap === 'normal') { columnGap = computedValues.columnGap === 'normal' ? '0px' : (computedValues.columnGap || '0px') }
  if (!position) { position = computedValues.position }
  if (!overflow) { overflow = computedValues.overflow }
  /** layout */

  return getRealValue({
    color,
    fontSize,
    textAlign,
    fontWeight,
    lineHeight,
    fontFamily,
    letterSpacing,
    whiteSpace,

    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,

    marginTop,
    marginRight,
    marginBottom,
    marginLeft,

    backgroundColor,
    backgroundImage,
    backgroundRepeat,
    backgroundPosition,
    backgroundSize,

    borderTopColor,
    borderBottomColor,
    borderLeftColor,
    borderRightColor,
    borderTopLeftRadius,
    borderTopRightRadius,
    borderBottomRightRadius,
    borderBottomLeftRadius,
    borderTopStyle,
    borderRightStyle,
    borderBottomStyle,
    borderLeftStyle,
    borderTopWidth,
    borderBottomWidth,
    borderLeftWidth,
    borderRightWidth,

    width,
    height,
    maxWidth,
    maxHeight,
    minWidth,
    minHeight,

    cursor,

    boxShadow,

    overflowX,
    overflowY,

    opacity,

    display,
    flexDirection,
    alignItems,
    justifyContent,
    flexWrap,
    rowGap,
    columnGap,
    position,
    overflow,
  }, computedValues)
}

// 修改getStyleRules函数以更好地处理伪类选择器
function getStyleRules (element: HTMLElement | null, selector: string | null) {
  const finalRules = [] // 最终返回的规则
  const root = getDocument()
  const PSEUDO_REGEX = /(:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?)$/    // 匹配选择器末尾的伪类/伪元素部分 如 :hover等


  // 提取目标 selector 末尾的伪类部分（如 :hover、:active、::before）
  const selectorPseudoMatch = selector ? selector.match(PSEUDO_REGEX) : null
  const selectorPseudo = selectorPseudoMatch ? selectorPseudoMatch[0] : null

  // 用于区分三种匹配情况
  const isPseudoSelector = !!selectorPseudo
  const hasRealDom      = !!element

  for (let i = 0; i < root.styleSheets.length; i++) {
    try {
      const sheet = root.styleSheets[i]
      const rules = sheet.cssRules ? sheet.cssRules : sheet.rules

      for (let j = 0; j < rules.length; j++) {
        const rule = rules[j]
        if (!(rule instanceof CSSStyleRule)) continue
        const { selectorText } = rule

        // ─── 情况1：编辑伪类态 + 有真实DOM ────────────────────────────────────
        // 例：selector=".mainBtn:hover"，element=<div class="mainBtn">
        // 策略：规则的伪类必须与目标相同，再剥掉伪类用 element.matches 验证基础选择器
        if (isPseudoSelector && hasRealDom) {
          const rulePseudoMatch = selectorText.match(PSEUDO_REGEX)
          const rulePseudo = rulePseudoMatch ? rulePseudoMatch[0] : null
          if (rulePseudo !== selectorPseudo) continue        // 伪类不同（如 :active vs :hover）直接跳过
          const ruleBase = selectorText.slice(0, selectorText.length - rulePseudo.length).trim()
          try {
            if (element.matches(ruleBase)) finalRules.push(rule)
          } catch {}
          continue
        }

        // ─── 情况2：编辑伪类态 + 无真实DOM（antd 全局伪类规则）──────────────
        // 例：selector=".ant-btn:not(:disabled):hover"，element=null
        // 策略：没有 DOM 节点可做 matches，用字符串匹配
        // 同时兼容平台加了作用域前缀的规则（selectorText = ".u_xxx .ant-btn:...:hover"）
        // 和 antd 注入的全局规则（selectorText = ".ant-btn:...:hover"）
        if (isPseudoSelector && !hasRealDom && selector) {
          // antd 全局规则：selectorText 与 selector 完全一致
          const isGlobalRule = selectorText === selector
          // 用户自定义规则：平台加了作用域前缀，格式为 "[scope] [selector]"
          const isScopedRule = selectorText.endsWith(' ' + selector)
          if (isGlobalRule || isScopedRule) finalRules.push(rule)
          continue
        }

        // ─── 情况3：编辑默认态（selector 无伪类）────────────────────────────
        // 例：selector=".tabItem"，element=<div class="tabItem active">
        // 策略：两道过滤防止其他规则污染默认态回显

        // 过滤①：规则本身含任何伪类（:has(...)、:hover 等）→ 直接跳过
        // 防止平台注入的全局规则（如 ":has(.geoView) *"）混入默认态
        if (/:[a-zA-Z\-]/.test(selectorText)) continue

        // 过滤②：element.matches 会命中元素身上所有类的规则，
        // 需验证规则主体（最后一个空格后的部分）的末尾 class token 与 selector 完全相等，
        // 防止 ".tabItem.active" 在编辑默认态时被纳入（lastToken=".active" ≠ ".tabItem"）
        // 兼容多级选择器：selector=".listContainer .card .detailInfo .infoRow" 时
        // lastToken 只是 ".infoRow"，需额外用 endsWith 验证整条规则是否以该选择器结尾
        try {
          if (!element || !element.matches(selectorText) || !selector) continue
          // selectorText 最后一段的最后一个 class token（防止 .tabItem.active 污染 .tabItem）
          const lastSegment      = selectorText.split(' ').pop() || selectorText
          const classTokens      = lastSegment.split('.').filter(Boolean)
          const lastToken        = classTokens.length > 0 ? '.' + classTokens[classTokens.length - 1] : lastSegment
          // selector 最后一段的最后一个 class token（兼容引擎传入完整路径如 .a .b .c）
          const selectorLastSeg  = selector.split(' ').pop() || selector
          const selectorTokens   = selectorLastSeg.split('.').filter(Boolean)
          const selectorLastToken = selectorTokens.length > 0 ? '.' + selectorTokens[selectorTokens.length - 1] : selectorLastSeg
          // 两边取最后 token 比较：防止 .tabItem.active ≠ .tabItem，同时兼容多级路径
          if (lastToken === selectorLastToken) finalRules.push(rule)
        } catch {}
      }
    } catch {}
  }

  return finalRules
}

// TODO: 之后的主题配置，按理说所有编辑器均需要做好兼容
function getRealValue(style: any, computedValues: CSSStyleDeclaration) {
  const finalStyle: any = {}

  Object.keys(style).forEach((key) => {
    const value = style[key]
    if (typeof value === 'string') {
      // @ts-ignore
      finalStyle[key] = value.startsWith('var') ? computedValues[key] : value
    } else {
      finalStyle[key] = value
    }
  })

  return finalStyle
}


const PANEL_MAP: Record<string, string> = {};
Object.keys(getDefaultValueFunctionMap2).forEach(panelType => {
  // @ts-ignore
  const properties = getDefaultValueFunctionMap2[panelType]();
  Object.keys(properties).forEach(property => {
    PANEL_MAP[property] = panelType
  })
})
/**
 * @description 从 css rules 中获取当前生效的插件，用于展示插件的是否默认折叠
 */
function getEffectedPanelsFromCssRules (rules: CSSStyleRule[]) {
  let effectedPanels = new Set();
  rules.filter(rule => {
    // 设计器默认的CSS样式去除掉
    if (rule.selectorText.indexOf('.desn-') === 0 && rule.selectorText.indexOf('*') > -1) {
      return false
    }
    return true
  }).forEach(rule => {
    rule.styleMap.forEach((_, key) => {
      if (PANEL_MAP[toHump(key)]) {
        effectedPanels.add(PANEL_MAP[toHump(key)])
      }
    })
  })
  return Array.from(effectedPanels)
}