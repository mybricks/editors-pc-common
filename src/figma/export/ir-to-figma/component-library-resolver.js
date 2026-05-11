'use strict';

/**
 * component-library-resolver.js
 *
 * 职责：将 IR 中 type='component-library' 的节点解析为 type='figma-instance' 节点，
 * 供 ir-to-figma.js 调用 convertInstanceNode 转为 Figma INSTANCE。
 *
 * 匹配策略（方案 B — description 优先）：
 *   1. 使用 figma-component-template.js 中的 componentLibrary 数组
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
 * 从 DOM 元素的 rawClassName 推断 JSX 组件名（Ant Design className 约定）。
 * 仅用于 descKey 命中后的候选过滤，推断失败时返回空字符串（不影响匹配）。
 */
var _ANT_CLASS_TO_COMPONENT = {
  'ant-input':    'Input',
  'ant-btn':      'Button',
  'ant-picker':   'DatePicker',   // DatePicker / TimePicker / RangePicker
  'ant-select':   'Select',
  'ant-checkbox': 'Checkbox',
  'ant-radio':    'Radio',
  'ant-switch':   'Switch',
  'ant-slider':   'Slider',
  'ant-rate':     'Rate',
  'ant-tag':      'Tag',
  'ant-badge':    'Badge',
};

function guessComponentFromClassName(rawClassName) {
  if (!rawClassName) return '';
  // 匹配第一个 "ant-{word}" class，取基础组件 class（不含 size/state 修饰符）
  var parts = rawClassName.split(/\s+/);
  for (var i = 0; i < parts.length; i++) {
    var m = parts[i].match(/^(ant-[a-z]+)(?:-|$)/);
    if (m && _ANT_CLASS_TO_COMPONENT[m[1]]) return _ANT_CLASS_TO_COMPONENT[m[1]];
  }
  return '';
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
var COMPONENT_DEFAULT_PROPS = {
  Button: {
    type: 'secondary',   // <Button> 不写 type 时默认映射到 secondary 变体
  },
  // Select 不传 size 时 Ant Design 默认 middle；
  // 若不补默认值，descKey 里 size 为空，无法命中任何变体描述（所有描述都写了 size="…"）。
  Select: {
    size: 'middle',
  },
};

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
var COMPONENT_PROP_ALIASES = {
  // Input: size="middle" 是默认尺寸，description 中省略，需归一为 undefined（空 key）。
  // Button/Select 的 size="middle" 在 description 中有显式记录，不需要归一。
  Input: {
    size: { 'middle': undefined },
  },
  Button: {
    // type="link" 在 m-ui Code Connect 中用 type="text" 编码，
    // 但风格不同（link=品牌色/蓝色, text=标准/灰色）。
    // 别名后由 BUTTON_TYPE_TO_STYLE 在风格 filter 中选择正确风格。
    type: { 'link': 'text' },
  },
  // 其他组件按需添加，例如：
  // TimePicker: { size: { 'middle': undefined } },
  // RangePicker: { size: { 'middle': undefined } },
};

/**
 * Button type → 期望的 Figma 风格维度值
 *
 * 当 JSX Button 的原始 type（别名前）能确定对应的"风格"时，在此声明。
 * 风格 filter 会优先从此表查找，而不是一律偏好"风格=标准"。
 *
 * 未在此表中的 type 仍走默认行为（偏好"风格=标准"）。
 */
var BUTTON_TYPE_TO_STYLE = {
  'link': '品牌色',   // type="link" → 蓝色文字按钮 → 风格=品牌色
};

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
  var mShape   = description.match(/shape="([^"]+)"/);
  var mDanger  = description.match(/danger=\{(true|false)\}/);
  var mGhost   = description.match(/ghost=\{(true|false)\}/);
  var mLoading = description.match(/loading=\{(true|false)\}/);
  var mDisabled = description.match(/\bdisabled(?:=\{(true|false)\})?/);

  if (mType)    props.type    = mType[1];
  if (mSize)    props.size    = mSize[1];
  if (mShape)   props.shape   = mShape[1];
  if (mDanger)  props.danger  = mDanger[1]  === 'true';
  if (mGhost)   props.ghost   = mGhost[1]   === 'true';
  if (mLoading) props.loading = mLoading[1] === 'true';
  if (mDisabled) props.disabled = mDisabled[1] !== undefined ? mDisabled[1] === 'true' : true;

  return props;
}

/**
 * 将 props 对象序列化为索引 key（5 维，顺序固定，与来源无关）。
 * hasIcon 不参与 key，只在多候选消歧时使用。
 * loading / disabled 不参与 key：Figma Code Connect description 从不编码这两个状态，
 *   所有变体（加载中=on/off、禁用中=on/off）共享同一 bucket，由 filter 4/5 在后处理中双向选择。
 * undefined 的字段用 '' 占位以保持 key 唯一性。
 *
 * 维度顺序：type | size | shape | danger | ghost
 */
function makeDescKey(props) {
  return [
    props.type    !== undefined ? props.type    : '',
    props.size    !== undefined ? props.size    : '',
    props.shape   !== undefined ? props.shape   : '',
    String(props.danger  !== undefined ? props.danger  : ''),
    String(props.ghost   !== undefined ? props.ghost   : ''),
  ].join('|');
}

// ─── 索引构建 ──────────────────────────────────────────────────────────────

var _indexCache = null;
var _indexSourceId = null; // 用 fileKey 做 cache key，避免模板更新时复用旧索引

/**
 * 构建 description → componentKey 索引。
 * 优先使用 template.componentLibrary（REST API 数据），
 * 降级到 template.componentNodes 的 symbolDescription。
 *
 * @param {object} template  figma-component-template.js 的 module.exports 对象
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
    if (!index.has(key)) index.set(key, []);
    index.get(key).push({
      componentKey: componentKey,
      name: name || '',
      component: parseComponentName(description),  // 'Button' / 'Input' / 'DatePicker' …
    });
  }

  if (template && Array.isArray(template.componentLibrary) && template.componentLibrary.length > 0) {
    // 主路径：REST API 数据
    template.componentLibrary.forEach(function(item) {
      addEntry(item.componentKey, item.name, item.description);
    });
  } else if (template && Array.isArray(template.componentNodes)) {
    // 降级路径：从 SYMBOL 节点的 symbolDescription 提取
    template.componentNodes.forEach(function(node) {
      if (node.type === 'SYMBOL' && node.symbolDescription && node.componentKey) {
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
 * @param {object} template figma-component-template.js 导出对象
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
    console.log(_tag, 'SKIP: no figmaProps on irNode (babelPlugin not tagged or tag not injected to DOM)');
    return null;
  }

  var index = buildDescriptionIndex(template);
  console.log(_tag, 'description index size:', index ? index.size : 0);
  if (!index || index.size === 0) {
    console.log(_tag, 'SKIP: empty description index — componentLibrary and componentNodes both empty or no descriptions');
    return null;
  }

  // 组件类型：优先用编译时精确注入的 figmaComponent，降级从 rawClassName 推断（兼容旧版）。
  var domComponent = irNode.figmaComponent || guessComponentFromClassName(irNode.rawClassName || '');

  // 构造查询 props（5 维进入 key，+ loading/disabled 仅供 filter 读取）
  // loading / disabled 不进 key（Figma description 从不编码它们），但保留在 queryProps 供 filter 4/5 双向选择。
  var queryProps = {
    type:     figmaProps.type,
    size:     figmaProps.size,
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
    if (queryProps.shape   === undefined && compDefaults.shape   !== undefined) queryProps.shape   = compDefaults.shape;
    if (queryProps.danger  === undefined && compDefaults.danger  !== undefined) queryProps.danger  = compDefaults.danger;
    if (queryProps.ghost   === undefined && compDefaults.ghost   !== undefined) queryProps.ghost   = compDefaults.ghost;
    if (queryProps.loading === undefined && compDefaults.loading !== undefined) queryProps.loading = compDefaults.loading;
  }

  // 应用组件 prop 值别名：将 JSX 里的 prop 值映射为 description 中使用的等效值。
  // 典型用例：Input size="middle" → undefined（description 省略 size = 中等/默认）。
  var propAliases = domComponent && COMPONENT_PROP_ALIASES[domComponent];
  if (propAliases) {
    ['type', 'size', 'shape'].forEach(function(p) {
      if (propAliases[p] && Object.prototype.hasOwnProperty.call(propAliases[p], queryProps[p])) {
        console.log(_tag, 'prop alias:', p + '=' + queryProps[p], '→', propAliases[p][queryProps[p]]);
        queryProps[p] = propAliases[p][queryProps[p]];
      }
    });
  }

  // hasIcon 仅用于多候选消歧，不进入 key
  var queryHasIcon = figmaProps.hasIcon ? true : false;

  var key = makeDescKey(queryProps);
  console.log(_tag, 'query key:', key, '| queryProps:', queryProps, '| hasIcon:', queryHasIcon, '| domComponent:', domComponent);

  var candidates = index.get(key);

  // 组件类型过滤：
  //   关键语义：当 domComponent 已知时，若候选集中存在同类型候选则收窄到同类型；
  //             若候选集里完全没有同类型候选，则强制清空（不使用错误类型候选）。
  //             domComponent 未知（空字符串）时不过滤，保留全部候选。

  function applyComponentFilter(cands) {
    if (!domComponent || !cands || cands.length === 0) return cands;
    var sameType = cands.filter(function(c) { return c.component === domComponent; });
    if (sameType.length > 0) {
      console.log(_tag, 'component filter:', domComponent, '→ narrowed', cands.length, '→', sameType.length);
      return sameType;
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

    // 2. Icon filter
    var iconFiltered = candidates.filter(function(c) {
      var nameHasIcon = (c.name || '').indexOf('图标') !== -1;
      return queryHasIcon ? nameHasIcon : !nameHasIcon;
    });
    if (iconFiltered.length > 0) candidates = iconFiltered;

    // 2.5. 无图标 filter（Input 尺寸组命名约定：无图标=on = 没有图标，无图标=off = 有图标）：
    //      与 icon filter 语义互补——icon filter 用于 Button 等"图标=on/off"命名，
    //      无图标 filter 用于 Input"无图标=on/off"命名（on/off 语义相反）。
    //      必须在 icon filter 之后：icon filter 对 Input 尺寸组无效（结果为空不更新），
    //      无图标 filter 接着处理。
    var hasWuIconDim = candidates.some(function(c) { return (c.name || '').indexOf('无图标=') !== -1; });
    if (hasWuIconDim) {
      var wuIconFiltered = candidates.filter(function(c) {
        var n = c.name || '';
        // 无图标=on → 没有图标；无图标=off → 有图标（语义与 icon filter 相反）
        return queryHasIcon
          ? (n.indexOf('无图标=') === -1 || n.indexOf('无图标=off') !== -1)
          : (n.indexOf('无图标=') === -1 || n.indexOf('无图标=on') !== -1);
      });
      if (wuIconFiltered.length > 0) {
        console.log(_tag, '无图标 filter:', queryHasIcon ? '→有图标(off)' : '→无图标(on)', '→', wuIconFiltered.length);
        candidates = wuIconFiltered;
      }
    }

    // 3. 进度 filter（DatePicker / TimePicker 中间态偏向"未选择"）
    var hasProgressDim = candidates.some(function(c) { return (c.name || '').indexOf('进度=') !== -1; });
    if (hasProgressDim) {
      var unselected = candidates.filter(function(c) {
        var n = c.name || '';
        return n.indexOf('进度=') === -1 || (n.indexOf('已选择') === -1 && n.indexOf('已选中') === -1);
      });
      if (unselected.length > 0) candidates = unselected;
    }

    // 4. 风格 filter：
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

    // 5. 加载中 filter：description 不编码 loading 状态，所有变体落同一 bucket。
    //    双向：loading=true 时偏好"加载中=on"，否则偏好"加载中=off"。
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

    // 6. 禁用中 filter：description 不编码 disabled 状态，所有变体落同一 bucket。
    //    双向：disabled=true 时偏好"禁用中=on"，否则偏好"禁用中=off"。
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

    // 7. 前缀-左/前缀-右 filter：
    //    figmaProps 未传 prefix/suffix 时，偏好 前缀-左=off 且 前缀-右=off 的变体。
    //    figmaProps 有 prefix 时偏好 前缀-左=on，有 suffix 时偏好 前缀-右=on。
    var hasPrefixLRDim = candidates.some(function(c) {
      var n = c.name || '';
      return n.indexOf('前缀-左=') !== -1 || n.indexOf('前缀-右=') !== -1;
    });
    if (hasPrefixLRDim) {
      var _hasPrefix = !!(figmaProps && figmaProps.prefix);
      var _hasSuffix = !!(figmaProps && figmaProps.suffix);
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

    best = candidates[0];
    console.log(_tag, 'disambiguation after filters, candidates left:', candidates.length, ', chosen:', best.name);
  }

  console.log(_tag, 'HIT:', best.name, '| componentKey:', best.componentKey);

  // 检查 componentKeyIndex 中是否有对应 symbolID 条目
  var tplEntry = template.componentKeyIndex && template.componentKeyIndex[best.componentKey];
  if (!tplEntry) {
    console.warn(_tag, 'WARNING: componentKey found in description index but NOT in componentKeyIndex!',
      'This means the template was generated via API-direct export (iocCanvasNode=null).',
      'The INSTANCE will have no symbolID → Figma will show "Component removed from this file".',
      'You must regenerate figma-component-template.js using the IOC Canvas clipboard method.',
      'componentKey:', best.componentKey
    );
  } else {
    console.log(_tag, 'componentKeyIndex entry:', tplEntry);
  }

  var style = irNode.style || {};
  var resolved = {
    type: 'figma-instance',
    figmaComponentKey: best.componentKey,
    // name 用于 Figma 层面板的节点名称（人类可读），优先用 label（按钮文字/占位符），否则用变体名
    name: irNode.label || best.name || 'Instance',
    // label 单独保存，供 convertInstanceNode 作为 textOverride 内容使用。
    // irNode.label 明确设为 undefined 时表示无文本 override（如无 placeholder 的 DatePicker）。
    label: irNode.label,
    style: style,
  };
  if (irNode.figmaSyncSelector) resolved.figmaSyncSelector = irNode.figmaSyncSelector;

  return resolved;
}

module.exports = { resolveComponentLibraryNode: resolveComponentLibraryNode };
