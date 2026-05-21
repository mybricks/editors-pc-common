'use strict';

var resolverConfig = require('./component-library-resolver.config');

/**
 * component-library-resolver.js
 *
 * 职责：将 IR 中 type='component-library' 的节点解析为 type='figma-instance' 节点，
 * 供 ir-to-figma.js 调用 convertInstanceNode 转为 Figma INSTANCE。
 *
 * 匹配策略（方案 B — description 优先）：
 *   1. 使用 html-templates-loader.js 构建的变体库模板中的 componentLibrary 数组
 *      （来自 Figma REST API，包含 componentKey + name + description）
 *   2. 解析每个组件的 description 字段（JSX 代码片段），提取
 *      { type, size, danger, ghost, loading, disabled }
 *   3. 过滤「状态=Normal」的变体（Hover/Active/Focus 是伪类交互态，DOM 不可知）
 *   4. 用 IR 节点的 figmaProps（由 babelPlugin 编译期注入）匹配 6 维索引
 *   5. 多候选时两步消歧：
 *      a. 先按 figmaProps.hasIcon 匹配变体名中的"图标"字样
 *         （hasIcon=true → 优先含"图标"的名字；hasIcon=false → 优先不含"图标"的名字）
 *      b. 再优先取 禁用中=off + 加载中=off 的 Normal 默认态
 *   6. 完全未命中时返回 null，调用方降级为 convertFrameNode
 *
 * 注意：hasIcon 不参与索引 key，只作消歧参考，原因：
 *   Figma Code Connect 描述中 loading 变体会包含 icon={<SpinnerIcon />}，
 *   导致 hasIcon 污染，使 key 分配错误。
 *
 * 降级兜底：若 componentLibrary 为空（旧版模板），回退到遍历
 * componentNodes 的 symbolDescription 字段，逻辑相同。
 */

// ─── 描述解析 ──────────────────────────────────────────────────────────────

/**
 * 从 JSX 代码片段（description 字段）提取 JSX 组件名。
 * 例：`<Button type="primary" />` → "Button"
 *     `<Input size="large" />` → "Input"
 *     `<DatePicker size="small" />` → "DatePicker"
 */
function parseComponentName(description) {
  if (!description) return '';
  var m = description.match(/<([A-Z][A-Za-z.]+)[\s\n\r/>]/);
  return m ? m[1] : '';
}


/**
 * 组件默认 props 映射表
 *
 * 当 JSX 未显式传入某 prop 时（Babel 提取为 undefined），用此表补齐默认值，
 * 再进行 descKey 匹配。避免因隐式默认值导致 key 与模板 description 不对齐。
 *
 * 规则：只补 undefined 字段，不覆盖已有值（哪怕是 false）。
 * 维护方式：直接在此处增减组件及其默认 prop，无需修改其他代码。
 */
var COMPONENT_DEFAULT_PROPS = resolverConfig.defaultProps || {};

/**
 * 组件 prop 值别名映射表
 *
 * 解决"JSX 里的 prop 值"与"Code Connect description 里的 prop 值"不一致的问题。
 * 格式：{ 组件名: { propName: { jsxValue: descriptionValue } } }
 * descriptionValue 为 undefined 表示该 prop 在 description 中被省略（视为默认值）。
 *
 * 典型场景：Ant Design 中 size="middle" 是默认值，Code Connect 通常省略不写，
 * 但 JSX 里用户可能显式写出 size="middle"，导致 descKey 无法匹配。
 *
 * 维护方式：增减组件或 prop 别名，无需修改其他代码。
 */
var COMPONENT_PROP_ALIASES = resolverConfig.propAliases || {};

/**
 * Button type → 期望的 Figma 风格维度值
 *
 * 当 JSX Button 的原始 type（别名前）能确定对应的"风格"时，在此声明。
 * 风格 filter 会优先从此表查找，而不是一律偏好"风格=标准"。
 *
 * 未在此表中的 type 仍走默认行为（偏好"风格=标准"）。
 */
var BUTTON_TYPE_TO_STYLE = resolverConfig.buttonTypeToStyle || {};

var COMPONENT_MISS_FALLBACKS = resolverConfig.missFallbackByComponent || {};

/** 组件 JSX children 文案对应 Figma 变体维度名（如 Checkbox 的 带图标=） */
var INLINE_CHILDREN_VARIANT_DIM = resolverConfig.inlineChildrenVariantDim || {};

/** 靠 JSX prop 有无区分变体族（如 Alert 的 description） */
var JSX_PROP_PRESENCE_FILTERS = resolverConfig.jsxPropPresenceFilters || {};

/**
 * 从 JSX 代码片段（description 字段）提取组件 props 用于索引键。
 * @param {string} description
 * @returns {{ type?:string, size?:string, shape?:string, danger?:boolean, ghost?:boolean, loading?:boolean, disabled?:boolean }}
 */
function parseDesc(description) {
  var props = {};
  if (!description) return props;

  var mType    = description.match(/type="([^"]+)"/);
  var mSize    = description.match(/size="([^"]+)"/);
  var mColor   = description.match(/color="([^"]+)"/);
  var mShape   = description.match(/shape="([^"]+)"/);
  var mDanger  = description.match(/danger=\{(true|false)\}/);
  var mGhost   = description.match(/ghost=\{(true|false)\}/);
  var mLoading = description.match(/loading=\{(true|false)\}/);
  var mDisabled = description.match(/\bdisabled(?:=\{(true|false)\})?/);

  if (mType)    props.type    = mType[1];
  if (mSize)    props.size    = mSize[1];
  if (mColor)   props.color   = mColor[1];
  if (mShape)   props.shape   = mShape[1];
  if (mDanger)  props.danger  = mDanger[1]  === 'true';
  if (mGhost)   props.ghost   = mGhost[1]   === 'true';
  if (mLoading) props.loading = mLoading[1] === 'true';
  if (mDisabled) props.disabled = mDisabled[1] !== undefined ? mDisabled[1] === 'true' : true;

  return props;
}

/** symbolDescription 的 JSX 片段中是否包含某 prop（description="..." 或 showIcon={true}） */
function descHasJsxProp(description, propName) {
  if (!description || !propName) return false;
  var escaped = propName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('\\b' + escaped + '(?:=\\{|=")', 'm').test(description);
}

/** 从 description 解析布尔 prop：{true}/{false} 或简写无值视为 true */
function parseDescBooleanProp(description, propName) {
  if (!description || !propName) return undefined;
  var escaped = propName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp('\\b' + escaped + '=\\{true\\}', 'm').test(description)) return true;
  if (new RegExp('\\b' + escaped + '=\\{false\\}', 'm').test(description)) return false;
  if (new RegExp('\\b' + escaped + '(?=\\s|>|/)', 'm').test(description)
    && !new RegExp('\\b' + escaped + '=', 'm').test(description)) {
    return true;
  }
  return undefined;
}

function filterByJsxPropPresence(entries, propName, shouldHave) {
  var list = Array.isArray(entries) ? entries : [];
  if (!list.length || !propName) return list;
  var filtered = list.filter(function(c) {
    var has = descHasJsxProp(c.description, propName);
    return shouldHave ? has : !has;
  });
  return filtered.length > 0 ? filtered : list;
}

function filterByDescBooleanProp(entries, propName, expected) {
  var list = Array.isArray(entries) ? entries : [];
  if (!list.length || !propName || expected === undefined) return list;
  var filtered = list.filter(function(c) {
    var val = parseDescBooleanProp(c.description, propName);
    return val === undefined || val === expected;
  });
  return filtered.length > 0 ? filtered : list;
}

/**
 * 从 symbolDescription 提取 JSX 开闭标签之间的静态文案（children 文本）。
 * 自闭合 <Checkbox /> 返回 ''。
 */
function parseDescInlineChildrenText(description, componentName) {
  if (!description) return '';
  var comp = componentName || parseComponentName(description);
  if (!comp) return '';
  var baseTag = comp.split('.')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var openRe = new RegExp('<' + baseTag + '[^>]*>', 'i');
  var openM = description.match(openRe);
  if (!openM) return '';
  if (/\/\s*>/.test(openM[0])) return '';
  var afterOpen = description.slice(openM.index + openM[0].length);
  var closeRe = new RegExp('</' + baseTag + '\\s*>', 'i');
  var closeM = afterOpen.match(closeRe);
  if (!closeM) return '';
  var inner = afterOpen.slice(0, closeM.index);
  inner = inner.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/[^\n]*/g, '');
  return inner.replace(/\s+/g, ' ').trim();
}

function descHasInlineChildren(description, componentName) {
  return parseDescInlineChildrenText(description, componentName).length > 0;
}

function parseInlineChildrenMeta(description, componentName) {
  var text = parseDescInlineChildrenText(description, componentName);
  return { hasText: text.length > 0, text: text };
}

function entryHasInlineChildrenDim(entry, dimName) {
  if (!dimName || !entry) return false;
  return (entry.name || '').indexOf(dimName + '=') !== -1;
}

/**
 * 按「是否有 JSX children 文案」收窄候选（不进 descKey，仅消歧）。
 */
function filterInlineChildrenEntries(entries, queryMeta) {
  var list = Array.isArray(entries) ? entries : [];
  if (!list.length || !queryMeta) return list;

  var hasInlineChildren = !!queryMeta.hasInlineChildren;
  var domComponent = queryMeta.domComponent;
  var dimName = domComponent && INLINE_CHILDREN_VARIANT_DIM[domComponent];

  var filtered = list.filter(function(c) {
    var meta = c.inlineChildrenMeta || parseInlineChildrenMeta(c.description, c.component);
    var descHas = meta.hasText;
    var nameHasDim = dimName ? entryHasInlineChildrenDim(c, dimName) : false;
    if (hasInlineChildren) return descHas || nameHasDim;
    return !descHas && !nameHasDim;
  });

  return filtered.length > 0 ? filtered : list;
}

/**
 * Checkbox 等：在「有文案」族内按 带图标=on/off 与 hasIcon 对齐。
 */
function filterInlineChildrenVariantDim(entries, domComponent, hasIcon) {
  var list = Array.isArray(entries) ? entries : [];
  var dimName = domComponent && INLINE_CHILDREN_VARIANT_DIM[domComponent];
  if (!list.length || !dimName) return list;

  var hasDim = list.some(function(c) { return entryHasInlineChildrenDim(c, dimName); });
  if (!hasDim) return list;

  var preferred = hasIcon ? (dimName + '=on') : (dimName + '=off');
  var filtered = list.filter(function(c) {
    var n = c.name || '';
    return n.indexOf(dimName + '=') === -1 || n.indexOf(preferred) !== -1;
  });

  return filtered.length > 0 ? filtered : list;
}

/**
 * 从 description 中提取 Input prefix/suffix 语义锚点。
 * 目的：当 figmaProps 传入了 prefix/suffix（尤其是特定文案如 ¥ / RMB）时，
 * 先把候选收窄到"同描述语义组"，再做默认态偏好，避免落入无关维度组。
 */
function parseInlineAffixMeta(description) {
  var text = String(description || '');
  var hasPrefix = /prefix=/.test(text);
  var hasSuffix = /suffix=/.test(text);
  var _prefixLiteralMatch = text.match(/prefix="([^"]*)"/);
  var _suffixLiteralMatch = text.match(/suffix="([^"]*)"/);
  var prefixLiteral = _prefixLiteralMatch ? _prefixLiteralMatch[1] : undefined;
  var suffixLiteral = _suffixLiteralMatch ? _suffixLiteralMatch[1] : undefined;
  var hasYuanPrefix = /prefix="¥"/.test(text);
  var hasRmbSuffix = /suffix="RMB"/.test(text);
  return {
    hasPrefix: hasPrefix,
    hasSuffix: hasSuffix,
    prefixLiteral: prefixLiteral,
    suffixLiteral: suffixLiteral,
    hasYuanPrefix: hasYuanPrefix,
    hasRmbSuffix: hasRmbSuffix,
  };
}

function filterInputAffixEntries(entries, figmaProps) {
  var list = Array.isArray(entries) ? entries : [];
  var hasPrefix = !!(figmaProps && figmaProps.prefix);
  var hasSuffix = !!(figmaProps && figmaProps.suffix);
  var prefixLiteral = (figmaProps && typeof figmaProps.prefix === 'string') ? figmaProps.prefix : undefined;
  var suffixLiteral = (figmaProps && typeof figmaProps.suffix === 'string') ? figmaProps.suffix : undefined;
  var wantYuan = figmaProps && figmaProps.prefix === '¥';
  var wantRmb = figmaProps && figmaProps.suffix === 'RMB';

  if (!hasPrefix && !hasSuffix) return list;

  return list.filter(function(c) {
    var m = c && c.affixMeta ? c.affixMeta : parseInlineAffixMeta(c && c.description || '');
    if (hasPrefix && !m.hasPrefix) return false;
    if (hasSuffix && !m.hasSuffix) return false;
    if (prefixLiteral !== undefined && m.prefixLiteral !== prefixLiteral) return false;
    if (suffixLiteral !== undefined && m.suffixLiteral !== suffixLiteral) return false;
    if (wantYuan && !m.hasYuanPrefix) return false;
    if (wantRmb && !m.hasRmbSuffix) return false;
    return true;
  });
}

/**
 * 将 props 对象序列化为索引 key（5 维，顺序固定，与来源无关）。
 * hasIcon 不参与 key，只在多候选消歧时使用。
 * loading / disabled 不参与 key：Figma Code Connect description 从不编码这两个状态，
 *   所有变体（加载中=on/off、禁用中=on/off）共享同一 bucket，由 filter 4/5 在后处理中双向选择。
 * undefined 的字段用 '' 占位以保持 key 唯一性。
 *
 * 维度顺序：type | size | color | shape | danger | ghost
 */
function makeDescKey(props) {
  return [
    props.type    !== undefined ? props.type    : '',
    props.size    !== undefined ? props.size    : '',
    props.color   !== undefined ? props.color   : '',
    props.shape   !== undefined ? props.shape   : '',
    String(props.danger  !== undefined ? props.danger  : ''),
    String(props.ghost   !== undefined ? props.ghost   : ''),
  ].join('|');
}

function applyConfiguredMissFallbacks(candidates, index, applyComponentFilter, domComponent, queryProps, logTag) {
  if (candidates && candidates.length > 0) return candidates;
  if (!domComponent) return candidates;
  var rules = COMPONENT_MISS_FALLBACKS[domComponent];
  if (!Array.isArray(rules) || rules.length === 0) return candidates;

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i] || {};
    if (!rule.overrideProps || typeof rule.overrideProps !== 'object') continue;
    var ruleProps = Object.assign({}, queryProps, rule.overrideProps);
    var ruleKey = makeDescKey(ruleProps);
    console.log(logTag, 'miss fallback[' + (rule.name || i) + '] key:', ruleKey);
    var hit = applyComponentFilter(index.get(ruleKey));
    if (hit && hit.length > 0) return hit;
  }
  return candidates;
}

// ─── 索引构建 ──────────────────────────────────────────────────────────────

var _indexCache = null;
var _indexSourceId = null; // 用 fileKey 做 cache key，避免模板更新时复用旧索引

/**
 * 构建 description → componentKey 索引。
 * 优先使用 template.componentLibrary（REST API 数据），
 * 降级到 template.componentNodes 的 symbolDescription。
 *
 * @param {object} template  html-templates-loader.js 构建的模板对象
 * @returns {Map<string, Array<{componentKey:string, name:string}>>}
 */
function buildDescriptionIndex(template) {
  var cacheKey = template && template.fileKey;
  if (_indexCache && _indexSourceId === cacheKey) return _indexCache;

  var index = new Map();

  /** 向 index 中写入一条记录，key = makeDescKey(parsedProps)（6 维，不含 hasIcon） */
  function addEntry(componentKey, name, description) {
    if (!componentKey || !description) return;

    // 过滤交互态变体（hover/focus/active/error/编辑中 等），只保留默认/静止态。
    // 不同组件的"默认态"命名各异：Button→"Normal"，DatePicker→"normal"，Input→"默认"，RangePicker→"未选"，
    // 因此改为"排除已知交互态"而非"必须含 normal"，以兼容更多组件类型。
    if (name && name.indexOf('状态=') !== -1) {
      var _nameLow = name.toLowerCase();
      // 已知交互/非默认态：hover / focus / active / press / pressed / disabled /
      //   聚焦 / 悬浮 / 按下 / 已输入 / 报错 / 编辑
      var _EXCLUDE_STATES = ['hover', 'focus', 'active', 'press', 'pressed', 'disabled',
                             '聚焦', '悬浮', '悬停', '按下', '已输入', '报错', '编辑'];
      for (var _ei = 0; _ei < _EXCLUDE_STATES.length; _ei++) {
        if (_nameLow.indexOf('状态=' + _EXCLUDE_STATES[_ei]) !== -1) return;
      }
    }

    var parsed = parseDesc(description);
    // danger / ghost 需统一默认值，确保与 queryProps 的 makeDescKey 结果一致。
    // loading / disabled 已从 key 中移除，无需补默认值。
    if (parsed.danger === undefined) parsed.danger = false;
    if (parsed.ghost  === undefined) parsed.ghost  = false;

    var key = makeDescKey(parsed);
    var _compName = parseComponentName(description);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push({
      componentKey: componentKey,
      name: name || '',
      component: _compName,
      description: description || '',
      affixMeta: parseInlineAffixMeta(description),
      inlineChildrenMeta: parseInlineChildrenMeta(description, _compName),
    });
  }

  if (template && Array.isArray(template.componentLibrary) && template.componentLibrary.length > 0) {
    // 主路径：REST API 数据
    template.componentLibrary.forEach(function(item) {
      addEntry(item.componentKey, item.name, item.description);
    });
  } else {
    // 降级路径：从 SYMBOL 节点的 symbolDescription 提取
    // 兼容旧格式（componentNodes）和新格式（iocNodes）
    var nodesToScan = Array.isArray(template.componentNodes)
      ? template.componentNodes
      : (Array.isArray(template.iocNodes) ? template.iocNodes : []);
    nodesToScan.forEach(function(node) {
      if (node && node.type === 'SYMBOL' && node.symbolDescription && node.componentKey) {
        addEntry(node.componentKey, node.name || '', node.symbolDescription);
      }
    });
  }

  // 诊断：打印 index 中所有含 DatePicker 的 key（帮助确认描述解析结果）
  var _dpKeys = [];
  index.forEach(function(entries, k) {
    entries.forEach(function(e) {
      if (e.name && e.name.indexOf('进度=') !== -1) {
        _dpKeys.push({ key: k, name: e.name });
      }
    });
  });
  if (_dpKeys.length > 0) {
    console.log('[component-library-resolver][buildIndex] DatePicker 相关 index keys:', _dpKeys);
  }

  _indexCache = index;
  _indexSourceId = cacheKey;
  return index;
}

// ─── 主解析入口 ────────────────────────────────────────────────────────────

/**
 * 将 component-library IR 节点解析为 figma-instance IR 节点。
 *
 * @param {object} irNode   type='component-library' 的 IR 节点
 * @param {object} template html-templates-loader.js 构建的模板对象
 * @returns {{ type:'figma-instance', figmaComponentKey:string, name:string, style:object, figmaSyncSelector?:string } | null}
 */
function resolveComponentLibraryNode(irNode, template) {
  var _tag = '[component-library-resolver]';

  if (!irNode || !template) {
    console.log(_tag, 'SKIP: irNode or template is null', { irNode: !!irNode, template: !!template });
    return null;
  }

  // 打印模板状态：帮助确认模板格式是否正确
  console.log(_tag, 'template state', {
    fileKey: template.fileKey,
    hasIocCanvasNode: !!(template.iocCanvasNode),
    componentNodesCount: (template.componentNodes || []).length,
    componentLibraryCount: (template.componentLibrary || []).length,
    componentKeyIndexKeys: Object.keys(template.componentKeyIndex || {}).length,
  });

  var figmaProps = irNode.figmaProps;
  console.log(_tag, 'irNode figmaProps', figmaProps, '| disabled:', irNode.disabled, '| label:', irNode.label);

  if (!figmaProps) {
    // data-figma-props 是映射的前提条件：没有 babelPlugin 打标就不走变体库映射，
    // 直接降级为普通 frame 渲染（由调用方 ir-to-figma.js 处理）。
    console.log(_tag, 'SKIP: no figmaProps on irNode — data-figma-props is required for component library mapping');
    return null;
  }

  var index = buildDescriptionIndex(template);
  console.log(_tag, 'description index size:', index ? index.size : 0);
  if (!index || index.size === 0) {
    console.log(_tag, 'SKIP: empty description index — componentLibrary and componentNodes both empty or no descriptions');
    return null;
  }

  // 组件类型：由 babelPlugin 在编译时注入到 figmaComponent（来源于 data-figma-props.component）。
  var domComponent = irNode.figmaComponent;

  // 构造查询 props（5 维进入 key，+ loading/disabled 仅供 filter 读取）
  // loading / disabled 不进 key（Figma description 从不编码它们），但保留在 queryProps 供 filter 4/5 双向选择。
  var queryProps = {
    type:     figmaProps.type,
    size:     figmaProps.size,
    color:    figmaProps.color,
    shape:    figmaProps.shape,   // undefined 表示默认形状（非圆角），与 description 省略 shape 一致
    danger:   figmaProps.danger  !== undefined ? figmaProps.danger  : false,
    ghost:    figmaProps.ghost   !== undefined ? figmaProps.ghost   : false,
    // 仅供 filter 使用，不进 makeDescKey
    loading:  figmaProps.loading  !== undefined ? figmaProps.loading  : false,
    disabled: figmaProps.disabled !== undefined ? figmaProps.disabled : !!(irNode.disabled),
  };

  // 应用组件默认 props：当 JSX 未显式写某字段时（undefined），从 COMPONENT_DEFAULT_PROPS 补齐，
  // 使 descKey 能命中模板中对应的变体描述。只补 undefined，不覆盖已有值。
  var compDefaults = domComponent && COMPONENT_DEFAULT_PROPS[domComponent];
  if (compDefaults) {
    if (queryProps.type    === undefined && compDefaults.type    !== undefined) queryProps.type    = compDefaults.type;
    if (queryProps.size    === undefined && compDefaults.size    !== undefined) queryProps.size    = compDefaults.size;
    if (queryProps.color   === undefined && compDefaults.color   !== undefined) queryProps.color   = compDefaults.color;
    if (queryProps.shape   === undefined && compDefaults.shape   !== undefined) queryProps.shape   = compDefaults.shape;
    if (queryProps.danger  === undefined && compDefaults.danger  !== undefined) queryProps.danger  = compDefaults.danger;
    if (queryProps.ghost   === undefined && compDefaults.ghost   !== undefined) queryProps.ghost   = compDefaults.ghost;
    if (queryProps.loading === undefined && compDefaults.loading !== undefined) queryProps.loading = compDefaults.loading;
  }

  // 应用组件 prop 值别名：将 JSX 里的 prop 值映射为 description 中使用的等效值。
  // 典型用例：Input size="middle" → undefined（description 省略 size = 中等/默认）。
  var propAliases = domComponent && COMPONENT_PROP_ALIASES[domComponent];
  if (propAliases) {
    ['type', 'size', 'color', 'shape'].forEach(function(p) {
      if (propAliases[p] && Object.prototype.hasOwnProperty.call(propAliases[p], queryProps[p])) {
        console.log(_tag, 'prop alias:', p + '=' + queryProps[p], '→', propAliases[p][queryProps[p]]);
        queryProps[p] = propAliases[p][queryProps[p]];
      }
    });
  }

  // Tag color="default"：Figma 默认色 Tag 的 description 省略 color 行，与 processing/success 等区分
  if (domComponent === 'Tag' && (queryProps.color === 'default' || queryProps.color === '')) {
    queryProps.color = undefined;
  }

  // hasIcon 仅用于多候选消歧，不进入 key
  var queryHasIcon = figmaProps.hasIcon ? true : false;

  // JSX children 文案（标签内文字）：DOM label 或 babel hasChildrenText
  var queryHasInlineChildren = !!(
    irNode.label ||
    (figmaProps && (
      figmaProps.hasChildrenText ||
      (typeof figmaProps.childrenText === 'string' && figmaProps.childrenText.trim()) ||
      (typeof figmaProps.children === 'string' && figmaProps.children.trim())
    ))
  );
  var _inlineChildrenQueryMeta = {
    hasInlineChildren: queryHasInlineChildren,
    domComponent: domComponent,
  };

  var key = makeDescKey(queryProps);
  console.log(_tag, 'query key:', key, '| queryProps:', queryProps,
    '| hasIcon:', queryHasIcon, '| hasInlineChildren:', queryHasInlineChildren, '| domComponent:', domComponent);

  var candidates = index.get(key);

  // 组件类型过滤：
  //   关键语义：当 domComponent 已知时，若候选集中存在同类型候选则收窄到同类型；
  //             若候选集里完全没有同类型候选，则强制清空（不使用错误类型候选）。
  //             domComponent 未知（空字符串）时不过滤，保留全部候选。

  function applyComponentFilter(cands) {
    if (!domComponent || !cands || cands.length === 0) return cands;
    // 精确匹配优先（Input.Search、DatePicker 等）
    var sameType = cands.filter(function(c) { return c.component === domComponent; });
    if (sameType.length > 0) {
      console.log(_tag, 'component filter:', domComponent, '→ narrowed', cands.length, '→', sameType.length);
      return sameType;
    }
    // 复合组件名尾段匹配：Babel 只取 JSX tag 最后段（如 DatePicker.RangePicker → "RangePicker"），
    // 但 description 里可能写全称。尾段相等时视为同类型。
    var suffixType = cands.filter(function(c) {
      if (!c.component) return false;
      var segs = c.component.split('.');
      return segs[segs.length - 1] === domComponent;
    });
    if (suffixType.length > 0) {
      console.log(_tag, 'component filter (suffix match):', domComponent, '→ narrowed', cands.length, '→', suffixType.length);
      return suffixType;
    }
    // 有候选但全都不是目标组件类型 → 强制 miss，避免跨组件误匹配
    console.log(_tag, 'component filter: domComponent=' + domComponent + ' but 0 matching candidates in bucket (size=' + cands.length + ') → force miss');
    return [];
  }

  candidates = applyComponentFilter(candidates);

  if (!candidates || candidates.length === 0) {
    // 宽松匹配：忽略 size 差异（兼容 description 省略 size 的情况）
    // loading / disabled 已不在 key 中，无需 reset。
    var relaxedProps = Object.assign({}, queryProps, { size: undefined });
    var relaxedKey = makeDescKey(relaxedProps);
    console.log(_tag, 'exact miss, trying relaxed key (size-dropped):', relaxedKey);
    candidates = applyComponentFilter(index.get(relaxedKey));
  }

  candidates = applyConfiguredMissFallbacks(
    candidates,
    index,
    applyComponentFilter,
    domComponent,
    queryProps,
    _tag
  );

  // Input affix 全局锚定回退：
  // 不依赖 candidates 数量。即使当前只有 1 个候选，只要它不匹配 prefix/suffix 字面值，
  // 也会在同组件全量候选中重选"描述匹配组"（如 prefix="¥" + suffix="RMB"）。
  if (domComponent === 'Input' && figmaProps && (figmaProps.prefix || figmaProps.suffix)) {
    var _curAffixMatched = filterInputAffixEntries(candidates || [], figmaProps);
    if (_curAffixMatched.length > 0) {
      candidates = _curAffixMatched;
      console.log(_tag, 'Input affix anchor (current bucket) →', candidates.length);
    } else {
      var _allInputEntries = [];
      index.forEach(function(arr) {
        if (!arr || !arr.length) return;
        for (var _ai = 0; _ai < arr.length; _ai++) {
          var _it = arr[_ai];
          if (_it && _it.component === 'Input') _allInputEntries.push(_it);
        }
      });
      var _globalAffixMatched = filterInputAffixEntries(_allInputEntries, figmaProps);
      if (_globalAffixMatched.length > 0) {
        candidates = _globalAffixMatched;
        console.log(_tag, 'Input affix anchor (global fallback) →', candidates.length);
      }
    }
  }

  if (!candidates || candidates.length === 0) {
    console.log(_tag, 'MISS: no matching variant found');
    var sampleKeys = [];
    index.forEach(function(v, k) { if (sampleKeys.length < 10) sampleKeys.push(k); });
    console.log(_tag, 'index sample keys (first 10):', sampleKeys);
    return null;
  }

  /**
   * 多候选消歧（确定性过滤，取代原有评分法）
   *
   * 经过组件类型过滤后，候选集内已是同一组件的不同变体。
   * 进一步用确定性规则逐步收窄，每步只过滤"有结果"时才更新候选集：
   *
   *   1. Icon filter：queryHasIcon=false → 排除名字含"图标"的候选（反之亦然）
   *   2. 进度 filter：有"进度="维度时优先"未选择/未选中"（DatePicker/TimePicker 空态）
   *   3. 风格 filter：有"风格="维度时优先"风格=标准"（JSX 无风格信息时默认标准态）
   *
   * loading / disabled 已是 descKey 第 5、6 维，同 bucket 候选值必然一致，无需再判断。
   * 经过以上过滤后剩余多个候选时，取首个（componentLibrary 的顺序即优先级）。
   *
   * 扩展方式：在此函数末尾按同一模式追加新的 filter 块，无需修改其他逻辑。
   */
  var best = candidates[0];
  if (candidates.length > 1) {
    // 1. 尺寸 filter（最先执行，用于跨变体组收窄）：
    //    候选集中同时存在 尺寸=大/中/小 变体和其他无尺寸维度变体（如"有前缀组"）时，
    //    优先收窄到与 figmaProps.size 匹配的尺寸组。
    //    必须放在 Icon filter 之前：尺寸=中 变体名含"无图标=..."，indexOf('图标') 会误命中，
    //    若先执行 icon filter 则 尺寸=中 候选全被清空。
    //    当 figmaProps.size 为 undefined 时，默认偏好 尺寸=中。
    var hasChineseSizeDim = candidates.some(function(c) { return (c.name || '').indexOf('尺寸=') !== -1; });
    if (hasChineseSizeDim) {
      var _sizeMap = { 'large': '大', 'small': '小', 'middle': '中' };
      var _rawSize = figmaProps && figmaProps.size;
      var _expectedChineseSize = _sizeMap[_rawSize] || '中';
      var sizeMatched = candidates.filter(function(c) {
        var n = c.name || '';
        // 有 尺寸= 维度且匹配期望尺寸；没有 尺寸= 维度的候选（如有前缀组）直接排除
        return n.indexOf('尺寸=') !== -1 && n.indexOf('尺寸=' + _expectedChineseSize) !== -1;
      });
      if (sizeMatched.length > 0) {
        console.log(_tag, 'size filter (尺寸):', _expectedChineseSize, '→', candidates.length, '→', sizeMatched.length);
        candidates = sizeMatched;
      }
    }

    // 保存状态过滤前的全量候选，供步骤 4 图标组合跨状态回退使用
    var _candidatesBeforeStateFilter = candidates.slice();

    // 2. 加载中 filter（提前到图标 filter 之前）：
    //    description 不编码 loading 状态，所有变体落同一 bucket。
    //    双向：loading=true 时偏好"加载中=on"，否则偏好"加载中=off"。
    //    必须先于 icon filter：否则 icon filter 可能把"加载中=off/禁用中=off"的图标变体
    //    误排除，导致只剩"禁用中=on"候选。
    var hasLoadingDim = candidates.some(function(c) { return (c.name || '').indexOf('加载中=') !== -1; });
    if (hasLoadingDim) {
      if (queryProps.loading === true) {
        var loadingOn = candidates.filter(function(c) { return (c.name || '').indexOf('加载中=on') !== -1; });
        if (loadingOn.length > 0) candidates = loadingOn;
      } else {
        var loadingOff = candidates.filter(function(c) {
          var n = c.name || '';
          return n.indexOf('加载中=') === -1 || n.indexOf('加载中=off') !== -1;
        });
        if (loadingOff.length > 0) candidates = loadingOff;
      }
    }

    // 3. 禁用中 filter（提前到图标 filter 之前）：
    //    description 不编码 disabled 状态，所有变体落同一 bucket。
    //    双向：disabled=true 时偏好"禁用中=on"，否则偏好"禁用中=off"。
    //    必须先于 icon filter：原因同加载中 filter。
    var hasDisabledDim = candidates.some(function(c) { return (c.name || '').indexOf('禁用中=') !== -1; });
    if (hasDisabledDim) {
      if (queryProps.disabled === true) {
        var disabledOn = candidates.filter(function(c) { return (c.name || '').indexOf('禁用中=on') !== -1; });
        if (disabledOn.length > 0) candidates = disabledOn;
      } else {
        var disabledOff = candidates.filter(function(c) {
          var n = c.name || '';
          return n.indexOf('禁用中=') === -1 || n.indexOf('禁用中=off') !== -1;
        });
        if (disabledOff.length > 0) candidates = disabledOff;
      }
    }

    // 4. Icon filter（Button 等「组合=图标+文字」；Checkbox 的 带图标= 维度由 filter 13/14 处理，此处跳过）
    var _skipButtonIconFilter = domComponent && INLINE_CHILDREN_VARIANT_DIM[domComponent];
    if (!_skipButtonIconFilter) {
      var iconFiltered = candidates.filter(function(c) {
        var nameHasIcon = (c.name || '').indexOf('图标') !== -1;
        return queryHasIcon ? nameHasIcon : !nameHasIcon;
      });
      if (iconFiltered.length > 0) {
        candidates = iconFiltered;
      } else if (!queryHasIcon) {
        var _textOnlyFallback = _candidatesBeforeStateFilter.filter(function(c) {
          return (c.name || '').indexOf('图标') === -1;
        });
        if (_textOnlyFallback.length > 0) {
          var _bestTextOnly = _textOnlyFallback.filter(function(c) {
            var n = c.name || '';
            var _loadingMatch = queryProps.loading
              ? n.indexOf('加载中=on') !== -1
              : (n.indexOf('加载中=') === -1 || n.indexOf('加载中=off') !== -1);
            var _disabledMatch = queryProps.disabled
              ? n.indexOf('禁用中=on') !== -1
              : (n.indexOf('禁用中=') === -1 || n.indexOf('禁用中=off') !== -1);
            return _loadingMatch && _disabledMatch;
          });
          if (_bestTextOnly.length > 0) {
            candidates = _bestTextOnly;
            console.log(_tag, 'icon composition fallback (cross-state): 扩搜到仅文字+正确状态 →', candidates.length, '个候选');
          }
        }
      }
    }

    // 4.5. 无图标 filter（Input 尺寸组命名约定：无图标=on = 没有图标，无图标=off = 有图标）：
    //      与 icon filter 语义互补——icon filter 用于 Button 等"图标=on/off"命名，
    //      无图标 filter 用于 Input"无图标=on/off"命名（on/off 语义相反）。
    //      必须在 icon filter 之后：icon filter 对 Input 尺寸组无效（结果为空不更新），
    //      无图标 filter 接着处理。
    //
    //      扩展：figmaProps.prefix/suffix 有值（字符串或 true）表示内嵌前/后缀内容（文字 or 图标），
    //      与 JSX icon 一样应偏好 无图标=off 变体。
    var hasWuIconDim = candidates.some(function(c) { return (c.name || '').indexOf('无图标=') !== -1; });
    if (hasWuIconDim) {
      var _hasInlineContent = queryHasIcon || !!(figmaProps && (figmaProps.prefix || figmaProps.suffix));
      var wuIconFiltered = candidates.filter(function(c) {
        var n = c.name || '';
        // 无图标=on → 没有图标；无图标=off → 有图标/内嵌内容（语义与 icon filter 相反）
        return _hasInlineContent
          ? (n.indexOf('无图标=') === -1 || n.indexOf('无图标=off') !== -1)
          : (n.indexOf('无图标=') === -1 || n.indexOf('无图标=on') !== -1);
      });
      if (wuIconFiltered.length > 0) {
        console.log(_tag, '无图标 filter:', _hasInlineContent ? '→有内嵌内容(off)' : '→无图标(on)', '→', wuIconFiltered.length);
        candidates = wuIconFiltered;
      }
    }

    // 4.6. Input prefix/suffix 描述锚定 filter：
    //      目标：当 figmaProps 指定了 prefix/suffix（如 prefix="¥", suffix="RMB"）时，
    //      先命中"描述中同语义组"（有前缀/有后缀/特定文案），再让后续状态过滤挑默认态。
    //      说明：这是"锚定到 description 组"而非直接锁死单个 componentKey。
    if (domComponent === 'Input' && figmaProps) {
      var _affixAnchored = filterInputAffixEntries(candidates, figmaProps);
      if (_affixAnchored.length > 0) {
        console.log(_tag, 'Input affix description anchor:', {
          hasPrefix: !!figmaProps.prefix,
          hasSuffix: !!figmaProps.suffix,
          prefixLiteral: (typeof figmaProps.prefix === 'string') ? figmaProps.prefix : undefined,
          suffixLiteral: (typeof figmaProps.suffix === 'string') ? figmaProps.suffix : undefined,
          yuan: figmaProps.prefix === '¥',
          rmb: figmaProps.suffix === 'RMB'
        }, '→', _affixAnchored.length);
        candidates = _affixAnchored;
      }
    }

    // 5. 进度 filter（DatePicker / TimePicker 中间态偏向"未选择"）
    var hasProgressDim = candidates.some(function(c) { return (c.name || '').indexOf('进度=') !== -1; });
    if (hasProgressDim) {
      var unselected = candidates.filter(function(c) {
        var n = c.name || '';
        return n.indexOf('进度=') === -1 || (n.indexOf('已选择') === -1 && n.indexOf('已选中') === -1);
      });
      if (unselected.length > 0) candidates = unselected;
    }

    // 6. 风格 filter：
    //    · 若 Button 的原始 type（别名前）在 BUTTON_TYPE_TO_STYLE 中有映射，则偏好对应风格。
    //      例如 type="link" → 风格=品牌色（蓝色文字按钮）。
    //    · 否则默认偏好"风格=标准"（通用场景）。
    var hasStyleDim = candidates.some(function(c) { return (c.name || '').indexOf('风格=') !== -1; });
    if (hasStyleDim) {
      var _origType = figmaProps && figmaProps.type;
      var _preferredStyle = (domComponent === 'Button' && _origType && BUTTON_TYPE_TO_STYLE[_origType])
        ? BUTTON_TYPE_TO_STYLE[_origType]
        : '标准';
      var preferredStyleCands = candidates.filter(function(c) {
        var n = c.name || '';
        return n.indexOf('风格=') === -1 || n.indexOf('风格=' + _preferredStyle) !== -1;
      });
      if (preferredStyleCands.length > 0) candidates = preferredStyleCands;
    }

    // 7. 前缀-左/前缀-右 filter：
    //    Figma Input 组件中：
    //      · 前缀-左=on  → 对应 antd 的 addonBefore（输入框外部左侧前置区域，如"Http://"）
    //      · 前缀-右=on  → 对应 antd 的 addonAfter（输入框外部右侧后置区域，如".com"）
    //    注意：antd 的 prefix/suffix（输入框内嵌内容）由 filter 2.5（无图标）处理，不走此维度。
    //    figmaProps 未传 addonBefore/addonAfter 时，偏好 前缀-左=off 且 前缀-右=off 的变体。
    var hasPrefixLRDim = candidates.some(function(c) {
      var n = c.name || '';
      return n.indexOf('前缀-左=') !== -1 || n.indexOf('前缀-右=') !== -1;
    });
    if (hasPrefixLRDim) {
      var _hasPrefix = !!(figmaProps && figmaProps.addonBefore);
      var _hasSuffix = !!(figmaProps && figmaProps.addonAfter);
      var prefixFiltered = candidates.filter(function(c) {
        var n = c.name || '';
        var leftOk = _hasPrefix
          ? (n.indexOf('前缀-左=') === -1 || n.indexOf('前缀-左=on') !== -1)
          : (n.indexOf('前缀-左=') === -1 || n.indexOf('前缀-左=off') !== -1);
        var rightOk = _hasSuffix
          ? (n.indexOf('前缀-右=') === -1 || n.indexOf('前缀-右=on') !== -1)
          : (n.indexOf('前缀-右=') === -1 || n.indexOf('前缀-右=off') !== -1);
        return leftOk && rightOk;
      });
      if (prefixFiltered.length > 0) {
        console.log(_tag, 'prefix-LR filter → candidates:', prefixFiltered.length);
        candidates = prefixFiltered;
      }
    }

    // 8. 字数计数 filter：
    //    figmaProps 未传 showCount（或 showCount=false）时偏好 字数计数=off。
    var hasShowCountDim = candidates.some(function(c) { return (c.name || '').indexOf('字数计数=') !== -1; });
    if (hasShowCountDim) {
      var _showCount = !!(figmaProps && figmaProps.showCount);
      var showCountFiltered = candidates.filter(function(c) {
        var n = c.name || '';
        return _showCount
          ? (n.indexOf('字数计数=') === -1 || n.indexOf('字数计数=on') !== -1)
          : (n.indexOf('字数计数=') === -1 || n.indexOf('字数计数=off') !== -1);
      });
      if (showCountFiltered.length > 0) {
        console.log(_tag, 'showCount filter →', showCountFiltered.length);
        candidates = showCountFiltered;
      }
    }

    // 9. 状态偏好 filter：
    //    根据 disabled/loading 状态，在"状态="维度名称中匹配对应静态态。
    //    设计意图：
    //      · 普通状态（disabled=false, loading=false）→ 偏好 状态=默认/正常/normal
    //      · disabled=true                           → 偏好 状态=禁用/disabled/失效
    //      · 只对"状态="维度存在时有效；Button 等用"禁用中="维度的组件由 filter 6 覆盖
    //    注意：此 filter 放在最后，因为其他 filter（尺寸/无图标/前缀/字数）先收窄范围后，
    //          状态匹配才精确。
    var _hasStateDim = candidates.some(function(c) { return (c.name || '').indexOf('状态=') !== -1; });
    if (_hasStateDim) {
      var _isDisabled = queryProps.disabled === true;
      var _STATE_DISABLED_KW = ['禁用', 'disabled', '失效'];
      var _STATE_DEFAULT_KW  = ['默认', '正常', 'normal'];
      var _stateKws = _isDisabled ? _STATE_DISABLED_KW : _STATE_DEFAULT_KW;
      var stateFiltered = candidates.filter(function(c) {
        var n = (c.name || '').toLowerCase();
        for (var _si = 0; _si < _stateKws.length; _si++) {
          if (n.indexOf(_stateKws[_si]) !== -1) return true;
        }
        return false;
      });
      if (stateFiltered.length > 0) {
        console.log(_tag, '状态偏好 filter (' + (_isDisabled ? '禁用' : '默认') + ') → candidates:', stateFiltered.length);
        candidates = stateFiltered;
      }
    }

    // 10. 语音 filter（Input.Search 特有维度）：
    //     JSX 传入了 suffix → 有麦克风图标 → 偏好 语音=on；
    //     未传 suffix → 偏好 语音=off。
    //     figmaProps.suffix 在 babelPlugin 中提取：JSX 表达式设为 true，字符串设为字符串值。
    var hasYuyinDim = candidates.some(function(c) { return (c.name || '').indexOf('语音=') !== -1; });
    if (hasYuyinDim) {
      var _hasMicSuffix = !!(figmaProps && figmaProps.suffix);
      var yuyinFiltered = candidates.filter(function(c) {
        var n = c.name || '';
        return _hasMicSuffix
          ? (n.indexOf('语音=') === -1 || n.indexOf('语音=on') !== -1)
          : (n.indexOf('语音=') === -1 || n.indexOf('语音=off') !== -1);
      });
      if (yuyinFiltered.length > 0) {
        console.log(_tag, '语音 filter:', _hasMicSuffix ? 'on' : 'off', '→', yuyinFiltered.length);
        candidates = yuyinFiltered;
      }
    }

    // 11. 文字按钮 filter（Input.Search 特有维度）：
    //     JSX 传入了 enterButton → 偏好 文字按钮=on；否则 → 偏好 文字按钮=off。
    //     figmaProps.enterButton 由 babelPlugin SCALAR_PROPS 提取（字符串或 true）。
    var hasWenziAnNiuDim = candidates.some(function(c) { return (c.name || '').indexOf('文字按钮=') !== -1; });
    if (hasWenziAnNiuDim) {
      var _hasEnterButton = !!(figmaProps && figmaProps.enterButton);
      var wenziFiltered = candidates.filter(function(c) {
        var n = c.name || '';
        return _hasEnterButton
          ? (n.indexOf('文字按钮=') === -1 || n.indexOf('文字按钮=on') !== -1)
          : (n.indexOf('文字按钮=') === -1 || n.indexOf('文字按钮=off') !== -1);
      });
      if (wenziFiltered.length > 0) {
        console.log(_tag, '文字按钮 filter:', _hasEnterButton ? 'on' : 'off', '→', wenziFiltered.length);
        candidates = wenziFiltered;
      }
    }

    // 12. 蓝色图标 filter（Input.Search 特有视觉态）：
    //     JSX 没有对应 prop 控制此维度（on/off 描述完全相同），默认偏好 蓝色图标=off（标准静止态）。
    var hasLanseIconDim = candidates.some(function(c) { return (c.name || '').indexOf('蓝色图标=') !== -1; });
    if (hasLanseIconDim) {
      var lansOffFiltered = candidates.filter(function(c) {
        var n = c.name || '';
        return n.indexOf('蓝色图标=') === -1 || n.indexOf('蓝色图标=off') !== -1;
      });
      if (lansOffFiltered.length > 0) {
        console.log(_tag, '蓝色图标 filter: → off (default) →', lansOffFiltered.length);
        candidates = lansOffFiltered;
      }
    }

    // 13. JSX children 文案 filter：区分「纯控件」与「带标签内文字」变体族（如 Checkbox 16×16 vs 108×22）
    var _inlineFiltered = filterInlineChildrenEntries(candidates, _inlineChildrenQueryMeta);
    if (_inlineFiltered.length > 0 && _inlineFiltered.length !== candidates.length) {
      console.log(_tag, 'inlineChildren filter:', queryHasInlineChildren ? 'has text' : 'no text',
        '→', candidates.length, '→', _inlineFiltered.length);
      candidates = _inlineFiltered;
    } else if (_inlineFiltered.length > 0) {
      candidates = _inlineFiltered;
    }

    // 14. 带图标= 二级 filter（Checkbox 等有文案族内的 icon 槽位）
    var _inlineDimName = domComponent && INLINE_CHILDREN_VARIANT_DIM[domComponent];
    if (_inlineDimName && candidates.some(function(c) { return entryHasInlineChildrenDim(c, _inlineDimName); })) {
      var _dimFiltered = filterInlineChildrenVariantDim(candidates, domComponent, queryHasIcon);
      if (_dimFiltered.length > 0 && _dimFiltered.length !== candidates.length) {
        console.log(_tag, 'inlineChildren variant dim filter:', _inlineDimName, queryHasIcon ? '=on' : '=off',
          '→', candidates.length, '→', _dimFiltered.length);
        candidates = _dimFiltered;
      } else if (_dimFiltered.length > 0) {
        candidates = _dimFiltered;
      }
    }

    // 15. 悬停 filter：Checkbox 等用 悬停=on/off 编码伪类交互态（非 状态=hover），
    //     索引构建不会排除；DOM 导出无法感知 hover，默认偏好 悬停=off 静止态。
    var hasXuantingDim = candidates.some(function(c) { return (c.name || '').indexOf('悬停=') !== -1; });
    if (hasXuantingDim) {
      var xuantingOff = candidates.filter(function(c) {
        var n = c.name || '';
        return n.indexOf('悬停=') === -1 || n.indexOf('悬停=off') !== -1;
      });
      if (xuantingOff.length > 0) {
        console.log(_tag, '悬停 filter: → off (default) →', candidates.length, '→', xuantingOff.length);
        candidates = xuantingOff;
      }
    }

    // 16. 禁用 filter（Checkbox 变体名为 禁用=，与 Button 的 禁用中= 不同，需单独处理）
    var hasJinyongDim = candidates.some(function(c) {
      var n = c.name || '';
      return n.indexOf('禁用=') !== -1 && n.indexOf('禁用中=') === -1;
    });
    if (hasJinyongDim) {
      if (queryProps.disabled === true) {
        var jinyongOn = candidates.filter(function(c) { return (c.name || '').indexOf('禁用=on') !== -1; });
        if (jinyongOn.length > 0) candidates = jinyongOn;
      } else {
        var jinyongOff = candidates.filter(function(c) {
          var n = c.name || '';
          return n.indexOf('禁用=') === -1 || n.indexOf('禁用=off') !== -1;
        });
        if (jinyongOff.length > 0) {
          console.log(_tag, '禁用 filter: → off (default) →', candidates.length, '→', jinyongOff.length);
          candidates = jinyongOff;
        }
      }
    }

    // 17. JSX prop 有无 filter（Alert：仅 message vs message+description 两套变体族）
    var _presenceProps = domComponent && JSX_PROP_PRESENCE_FILTERS[domComponent];
    if (_presenceProps && _presenceProps.length && figmaProps) {
      for (var _ppi = 0; _ppi < _presenceProps.length; _ppi++) {
        var _presenceProp = _presenceProps[_ppi];
        var _queryHasProp = !!(
          figmaProps[_presenceProp] &&
          (typeof figmaProps[_presenceProp] !== 'string' || figmaProps[_presenceProp].trim())
        );
        var _presenceFiltered = filterByJsxPropPresence(candidates, _presenceProp, _queryHasProp);
        if (_presenceFiltered.length > 0 && _presenceFiltered.length !== candidates.length) {
          console.log(_tag, 'jsx prop presence filter:', _presenceProp, _queryHasProp ? 'has' : 'none',
            '→', candidates.length, '→', _presenceFiltered.length);
          candidates = _presenceFiltered;
        } else if (_presenceFiltered.length > 0) {
          candidates = _presenceFiltered;
        }
      }
    }

    // 18. Tag color filter：default/未传 → description 无 color=；其余按 color="..." 精确匹配
    if (domComponent === 'Tag' && figmaProps) {
      var _tagColor = queryProps.color;
      if (!_tagColor) {
        var _noColorTag = filterByJsxPropPresence(candidates, 'color', false);
        if (_noColorTag.length > 0 && _noColorTag.length !== candidates.length) {
          console.log(_tag, 'Tag color filter: default/none →', candidates.length, '→', _noColorTag.length);
          candidates = _noColorTag;
        } else if (_noColorTag.length > 0) {
          candidates = _noColorTag;
        }
      } else {
        var _colorLiteral = _tagColor;
        var _colorMatched = candidates.filter(function(c) {
          return (c.description || '').indexOf('color="' + _colorLiteral + '"') !== -1;
        });
        if (_colorMatched.length > 0) {
          console.log(_tag, 'Tag color filter:', _colorLiteral, '→', _colorMatched.length);
          candidates = _colorMatched;
        }
      }
    }

    // 19. Alert 等：showIcon / closable / banner 与 description 布尔值对齐
    if (domComponent === 'Alert' && figmaProps) {
      var _alertBoolProps = ['showIcon', 'closable', 'banner'];
      for (var _abi = 0; _abi < _alertBoolProps.length; _abi++) {
        var _abProp = _alertBoolProps[_abi];
        var _abVal = figmaProps[_abProp];
        if (_abVal === undefined && _abProp === 'banner') _abVal = false;
        if (_abVal === undefined) continue;
        var _abFiltered = filterByDescBooleanProp(candidates, _abProp, !!_abVal);
        if (_abFiltered.length > 0 && _abFiltered.length !== candidates.length) {
          console.log(_tag, 'Alert bool prop filter:', _abProp, '→', !!_abVal,
            '→', candidates.length, '→', _abFiltered.length);
          candidates = _abFiltered;
        } else if (_abFiltered.length > 0) {
          candidates = _abFiltered;
        }
      }
    }

    best = candidates[0];
    console.log(_tag, 'disambiguation after filters, candidates left:', candidates.length, ', chosen:', best.name);
  } else if (candidates && candidates.length === 1 && domComponent && INLINE_CHILDREN_VARIANT_DIM[domComponent]) {
    // 单候选桶仍尝试 children 族校验（避免唯一项是错误族）
    var _singleInline = filterInlineChildrenEntries(candidates, _inlineChildrenQueryMeta);
    if (_singleInline.length > 0) {
      candidates = _singleInline;
    }
  }

  best = candidates[0];

  console.log(_tag, 'HIT:', best.name, '| componentKey:', best.componentKey);

  // 检查 componentKeyIndex 中是否有对应 symbolID 条目
  var tplEntry = template.componentKeyIndex && template.componentKeyIndex[best.componentKey];
  if (!tplEntry) {
    console.warn(_tag, 'WARNING: componentKey found in description index but NOT in componentKeyIndex!',
      'This means the template was generated via API-direct export (iocCanvasNode=null).',
      'The INSTANCE will have no symbolID → Figma will show "Component removed from this file".',
      'You must re-export the HTML templates using the IOC Canvas clipboard method.',
      'componentKey:', best.componentKey
    );
  } else {
    console.log(_tag, 'componentKeyIndex entry:', tplEntry);
  }

  var style = irNode.style || {};
  // Input（尤其 prefix/suffix/addonBefore/addonAfter 场景）通常是多文本槽位组件，
  // 若沿用通用 label→textOverride 逻辑，容易把整段文本误写到 suffix/prefix 槽位，
  // 导致“示例文字”混入或 RMB 前多出符号。此处仅对相关 Input 场景禁用通用文本覆写。
  var _isInputWithInlineAffix = domComponent === 'Input' && !!(
    figmaProps && (
      figmaProps.prefix ||
      figmaProps.suffix ||
      figmaProps.addonBefore ||
      figmaProps.addonAfter
    )
  );
  var _isInputFamily = (
    domComponent === 'Input' ||
    domComponent === 'Input.Search' ||
    domComponent === 'Input.TextArea'
  );
  var _resolvedLabel;
  if (_isInputWithInlineAffix) {
    _resolvedLabel = undefined;
  } else if (_isInputFamily) {
    // Input 系列优先使用 placeholder 作为文本 override，
    // 避免把 DOM 测量/隐藏文本（如 "0571"）误写入组件文字槽位。
    _resolvedLabel = irNode.placeholder || irNode.label;
  } else if (domComponent === 'Alert' && figmaProps && figmaProps.message) {
    _resolvedLabel = figmaProps.message;
  } else {
    _resolvedLabel = irNode.label;
  }
  var resolved = {
    type: 'figma-instance',
    figmaComponentKey: best.componentKey,
    // name 用于 Figma 层面板的节点名称（人类可读），优先用 label（按钮文字/占位符），否则用变体名
    name: _resolvedLabel || best.name || 'Instance',
    // label 单独保存，供 convertInstanceNode 作为 textOverride 内容使用。
    // irNode.label 明确设为 undefined 时表示无文本 override（如无 placeholder 的 DatePicker）。
    label: _resolvedLabel,
    style: style,
  };
  if (irNode.figmaSyncSelector) resolved.figmaSyncSelector = irNode.figmaSyncSelector;

  return resolved;
}

module.exports = { resolveComponentLibraryNode: resolveComponentLibraryNode };
