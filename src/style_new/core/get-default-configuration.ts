import type { CSSProperties } from 'react'

import { deepCopy } from '../../utils'
import { DEFAULT_OPTIONS } from '../StyleEditor'
import {
  getSuggestOptionsByElement,
  splitCSSProperties,
} from '../StyleEditor/helper'
import {
  isPaintStackPropIrrelevantToBorder,
  isPaintStackPropOwnedByTextFill,
  refineEffectedPanel,
} from '../StyleEditor/helper/paint-stack'
import type { GetDefaultConfigurationProps } from '../type'
import type { Options } from '../StyleEditor/type'
import { mapEffectedPanels, normalizeEffectOptions } from './effects-alias'
import { getEffectedCssPropertyAndOptions } from './get-effected-css'
import {
  getDefaultValueFunctionMap,
  getDefaultValueFunctionMap2,
  PANEL_MAP,
} from './panel-defaults'
import {
  CSS_TRIVIAL_VALUES,
  isBorderPanelMeaningfullyUsed,
  isMeaninglessStylePropForPanel,
} from './panel-effected'

export type SuggestOptionItem = { type: string, config?: any }
export type SuggestOptionsCache = WeakMap<HTMLElement, { options: SuggestOptionItem[], timestamp: number }>

const SUGGEST_OPTIONS_CACHE_TTL = 1500

export function getSuggestOptionsWithCache(realTargetDom: HTMLElement, cache?: SuggestOptionsCache) {
  if (!cache) {
    return getSuggestOptionsByElement(realTargetDom)
  }

  const now = Date.now()
  const cacheItem = cache.get(realTargetDom)
  if (cacheItem && (now - cacheItem.timestamp) < SUGGEST_OPTIONS_CACHE_TTL) {
    return cacheItem.options
  }

  const suggestOptions = getSuggestOptionsByElement(realTargetDom)
  if (suggestOptions) {
    cache.set(realTargetDom, { options: suggestOptions as SuggestOptionItem[], timestamp: now })
  }
  return suggestOptions
}

export function getDefaultConfiguration2 ({value, options}: GetDefaultConfigurationProps) {
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
export function getDefaultConfiguration ({value, options}: GetDefaultConfigurationProps, suggestOptionsCache?: SuggestOptionsCache) {
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
  let effectedFromRulesOnly: string[] = [];
  let effectedFromAncestorsOnly: string[] = [];
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
      finalOptions = getSuggestOptionsWithCache(realTargetDom, suggestOptionsCache) ?? finalOptions
    }


    
    // 将引擎传入的 [data-zone-selector='[...]'] 格式解析为 CSS 选择器数组
    const rawSelector = Array.isArray(selector) ? selector[0] : selector;
    const zoneArrayMatch = rawSelector?.match(/\[data-zone-selector=['"]?(\[[^\]]*\])['"]?\]/);

    // realSelectors：完整数组，用于多类名场景（如 [".actionBtn", ".primary"]）覆盖所有规则
    // realSelector：最后一个，用于伪类判断等需要单值的场景
    let realSelectors: string[] = rawSelector ? [rawSelector] : [];
    let realSelector: string | undefined = rawSelector;

    if (zoneArrayMatch) {
      try {
        const selectors: string[] = JSON.parse(zoneArrayMatch[1]);
        realSelectors = selectors;
        realSelector = selectors[selectors.length - 1];
      } catch {}
    }

    const isPseudoSelector = typeof realSelector === 'string' && /:(:)?[a-zA-Z0-9\-\_]+/.test(realSelector);
    const realDom = !!realTargetDom ? realTargetDom : null;
    if (realDom || isPseudoSelector) {
      getDefaultValue = false;
      const [styleValues, options, ownRulesPanels, ancestorPanels] = getEffectedCssPropertyAndOptions(realDom, realSelectors.length > 1 ? realSelectors : (realSelector ?? ''), comId);

      effctedOptions = options == null ? options : mapEffectedPanels(options as string[]);
      effectedFromRulesOnly = mapEffectedPanels(ownRulesPanels as string[]);
      effectedFromAncestorsOnly = mapEffectedPanels(ancestorPanels as string[]);
      finalOptions = normalizeEffectOptions(finalOptions)
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

  finalOptions = normalizeEffectOptions(finalOptions)

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
  const setValueBag = splitedSetValue as Record<string, any>
  Object.keys(splitedSetValue).forEach(property => {
    const mapped = PANEL_MAP[property]
    if (isMeaninglessStylePropForPanel(property, setValueBag[property], mapped, setValueBag)) {
      return
    }
    const panel = refineEffectedPanel(property, mapped, setValueBag)
    if (panel) {
      if (panel === 'border' && !isBorderPanelMeaningfullyUsed(setValueBag)) {
        return
      }
      setValueEffectedPanels.add(panel)
    }
  })

  let collapsedOptions: any = [];
  if (effctedOptions) {
    collapsedOptions = finalOptions.map(t => {
      return typeof t === 'string' ? t.toLowerCase() : t?.type.toLowerCase()
    }).filter(t => !effctedOptions.includes(t) && !setValueEffectedPanels.has(t) && !effectedFromAncestorsOnly.includes(t))
  }

  const ownEffectedSet = new Set([...effectedFromRulesOnly, ...Array.from(setValueEffectedPanels)]);
  
  let readonlyExpandedOptions = Array.from(new Set(effectedFromAncestorsOnly.filter(p => !ownEffectedSet.has(p))));

  // 检测被折叠的面板中是否有 UA/computedStyle 默认值（即 defaultValue 里的属性值与空白默认值不同）。
  // 若直接折叠，用户展开后会看到有值却显示 - 号（可误删），因此将它们移入 readonlyExpandedOptions，
  // 渲染为 collapse='inherited'，展开且无 - 号，与父级继承样式的处理方式保持一致。
  if (collapsedOptions.length > 0) {
    const uaFilledPanels: string[] = [];
    collapsedOptions = collapsedOptions.filter((panelKey: string) => {
      // @ts-ignore
      const emptyValues: Record<string, any> = getDefaultValueFunctionMap2[panelKey]?.() ?? {};
      const diffProps: Array<{prop: string, empty: any, current: any}> = [];
      const hasUAValue = Object.keys(emptyValues).some(prop => {
        const styleBag = defaultValue as Record<string, any>
        // 文字渐变占用的 backgroundImage/clip 等不应让边框/背景面板被当成「有值」而展开
        if (isPaintStackPropOwnedByTextFill(prop, styleBag)) {
          return false
        }
        // 普通背景渐变写在 backgroundImage 上：边框面板空白基准也含该字段，需排除
        if (
          panelKey === 'border' &&
          isPaintStackPropIrrelevantToBorder(prop, styleBag)
        ) {
          return false
        }
        const emptyVal = emptyValues[prop];
        // @ts-ignore
        const currentVal = defaultValue[prop];
        // CSS "无值"关键字，与空字符串视为等价，避免 UA 默认值（如 boxShadow:'none'）被误判为有效值
        const CSS_NONE_KEYWORDS = CSS_TRIVIAL_VALUES
        const normalize = (v: any) => {
          if (v === '' || CSS_NONE_KEYWORDS.has(v)) return null
          // rgba(0,0,0,0) 是 transparent 的 computedStyle 等价形式，统一视为无语义值
          if (v === 'rgba(0, 0, 0, 0)') return null
          return v
        }
        // 空白基准为 '' 的属性（如 borderTopColor）：
        // 其 computedStyle 初始值依赖 currentColor（随 color 属性变化），
        // 无法与"无配置"状态区分，直接跳过，避免误判为有 UA 值。
        // 注：backgroundColor 不属于此类（不继承，初始值固定为 transparent），
        // 已改为 'rgba(0,0,0,0)' 作为空白基准，可正常参与 diff。
        if (emptyVal === '') return false
        // 当前值存在且与空白默认值不同，说明有 UA 或 computed 值填充
        const isDiff = currentVal !== undefined && normalize(currentVal) !== normalize(emptyVal);
        if (isDiff) diffProps.push({ prop, empty: emptyVal, current: currentVal });
        return isDiff;
      });
      if (hasUAValue) {
        uaFilledPanels.push(panelKey);
        return false;
      }
      return true;
    });
    // 将有 UA 值的面板加入 readonlyExpandedOptions（去重，且不能与 ownEffectedSet 重叠）
    const newReadonly = uaFilledPanels.filter(p => !ownEffectedSet.has(p) && !readonlyExpandedOptions.includes(p));
    readonlyExpandedOptions = [...readonlyExpandedOptions, ...newReadonly];
  }

  return {
    options: finalOptions,
    collapsedOptions,
    readonlyExpandedOptions,
    autoCollapseWhenUnusedProperty,
    defaultValue: getDefaultValue
      ? Object.assign(defaultValue, splitedSetValue)
      : Object.assign({}, splitedSetValue, defaultValue),
    setValue: Object.assign({}, splitedSetValue),
    finalOpen,
    finalSelector,
    finnalExcludeOptions,
    targetDom: dom,
  } as {
    options: Options,
    collapsedOptions: string[]
    readonlyExpandedOptions: string[]
    autoCollapseWhenUnusedProperty: boolean,
    defaultValue: CSSProperties,
    setValue: CSSProperties & Record<string, any>,
    finalOpen: boolean,
    finalSelector: string,
    finnalExcludeOptions: any,
    targetDom: any,
  }
}
