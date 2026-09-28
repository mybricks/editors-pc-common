const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const ts = require('typescript')

// 仅在内存中执行行为测试，不运行构建或 TypeScript 类型检查。
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React, esModuleInterop: true },
  })
  module._compile(outputText, filename)
}
require.extensions['.tsx'] = require.extensions['.ts']

const { normalizeStyleShorthands } = require('../shorthand-normalizer.ts')
const { applyStyleChange } = require('../apply-style-change.ts')
const { getStyleResolution } = require('../style-property.ts')
const { buildBorderWidthChange, hasNoVisibleBorderLine } = require('../../StyleEditor/helper/border-value.ts')
const { buildStyleMutationChange } = require('../../StyleEditor/helper/style-mutations.ts')

const sides = ['Top', 'Right', 'Bottom', 'Left']
const widthKeys = sides.map(side => `border${side}Width`)
const component = (part, value) => Object.fromEntries(sides.map(side => [`border${side}${part}`, value]))
const border = (width = '1px', style = 'solid', color = '#84adff') => ({
  ...component('Width', width), ...component('Style', style), ...component('Color', color),
})
const normalize = (style, changes = style, borderMode) => normalizeStyleShorthands(style,
  Object.entries(changes).map(([key, value]) => ({ key, value, borderMode })), new Set(), { changedGroupsOnly: true }).style

test('split mode keeps four identical borders as side shorthands, including invisible borders', () => {
  for (const line of ['solid', 'none']) {
    assert.deepEqual(normalize(border('2px', line), undefined, 'split'),
      Object.fromEntries(sides.map(side => [`border${side}`, `2px ${line} #84adff`])))
  }
})

test('an incomplete or mixed-priority side does not prevent other sides using shorthand', () => {
  const completeLeft = { borderLeftWidth: '7px', borderLeftStyle: 'solid', borderLeftColor: '#84adff' }
  for (const partialTop of [
    { borderTopWidth: '1px', borderTopStyle: 'solid' },
    { borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: '#84adff!important' },
    { borderTopWidth: 'unset', borderTopStyle: 'solid', borderTopColor: '#84adff' },
  ]) {
    assert.deepEqual(normalize({ ...completeLeft, ...partialTop }, undefined, 'split'), {
      borderLeft: '7px solid #84adff', ...partialTop,
    })
  }
})

test('split mode never groups incomplete borders across sides or invents missing colors', () => {
  const partial = { ...component('Width', '2px'), ...component('Style', 'solid') }
  assert.deepEqual(normalize(partial, undefined, 'split'), partial)
})

test('partial unified configuration uses component shorthands without inventing color', () => {
  assert.deepEqual(normalize({ ...component('Width', '2px'), ...component('Style', 'solid') }),
    { borderWidth: '2px', borderStyle: 'solid' })
  assert.deepEqual(normalize(component('Width', '2px')), { borderWidth: '2px' })
  assert.deepEqual(normalize(border('2px')), { border: '2px solid #84adff' })
})

test('editing a side of a previously compressed border preserves other sides and color', () => {
  assert.deepEqual(normalize({ border: '2px solid #84adff', borderLeftWidth: '4px' }, { borderLeftWidth: '4px' }), {
    borderTop: '2px solid #84adff', borderRight: '2px solid #84adff',
    borderBottom: '2px solid #84adff', borderLeft: '4px solid #84adff',
  })
})

test('clearing unified width splits border and retains only explicit style/color', () => {
  const clears = component('Width', null)
  assert.deepEqual(normalize({ border: '2px solid #84adff', ...clears }, clears),
    { borderStyle: 'solid', borderColor: '#84adff' })
})

test('variable lengths and functional colors survive repeated writes', () => {
  assert.deepEqual(normalize({ border: 'var(--stroke) solid rgb(1, 2, 3)', borderLeftWidth: '4px' },
    { borderLeftWidth: '4px' }), {
    borderTop: 'var(--stroke) solid rgb(1, 2, 3)', borderRight: 'var(--stroke) solid rgb(1, 2, 3)',
    borderBottom: 'var(--stroke) solid rgb(1, 2, 3)', borderLeft: '4px solid rgb(1, 2, 3)',
  })
  assert.deepEqual(normalize({ border: 'var(--border)', ...component('Width', '2px') }, component('Width', '2px')),
    { border: 'var(--border)', borderWidth: '2px' })
})

test('mixed priorities and CSS-wide values are never combined into invalid border shorthand', () => {
  const mixed = normalize({ ...border('2px'), borderLeftColor: 'red!important' })
  assert.equal(mixed.border, undefined)
  assert.equal(mixed.borderLeftColor, 'red!important')
  const unset = normalize({ ...border('2px'), ...component('Width', 'unset') })
  assert.deepEqual(unset, { borderWidth: 'unset', borderStyle: 'solid', borderColor: '#84adff' })
})

test('explicit border replaces stale details, including opaque variables and none', () => {
  for (const value of ['var(--border)', 'none', '2px solid blue']) {
    assert.deepEqual(normalize({ ...border(), border: value }, { border: value }), { border: value })
  }
})

function declaration(values = {}) {
  const css = Object.fromEntries(Object.entries(values).map(([key, value]) =>
    [key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), value]))
  const names = Object.keys(css)
  return {
    length: names.length, item: index => names[index],
    getPropertyValue: key => String(css[key] || '').replace(/\s*!important$/, ''),
    getPropertyPriority: key => /!important$/.test(css[key] || '') ? 'important' : '',
    setProperty() {}, removeProperty() {},
  }
}

function fixture(rules = [], inline = {}, info = {}) {
  const target = {
    nodeType: 1, dataset: { styleInfo: JSON.stringify(info) }, parentElement: null,
    classList: Object.assign(['target', 'color'], { contains: name => ['target', 'color'].includes(name) }),
    matches: () => true, getAttribute: () => '.target', hasAttribute: () => false,
    style: declaration(inline),
  }
  const sourceRules = rules.map(([selector, values], sourceOrder) => ({
    rule: { style: declaration(values) }, sourceSelector: selector, selectorPart: selector,
    sourceOrder, target, isPageStyle: true,
  }))
  const tab = { selector: '.target', baseSelector: '.target', pseudo: null, sourceRules, baseRules: [], target }
  const calls = []
  const editConfig = {
    options: { targetDom: target, zoneTab: tab },
    value: { set: (style, { selector }) => calls.push({ style, selector,
      deletions: global.window.__mybricks_style_deletions }) },
  }
  let liveStyle = {}
  const applyItems = value => {
    const result = applyStyleChange({ editConfig, liveStyle, value })
    liveStyle = result.nextLiveStyle
    return result
  }
  return { target, calls, resolution: getStyleResolution(tab, target), applyItems, apply(changes, borderMode) {
    return applyItems(buildStyleMutationChange(
      Object.entries(changes).map(([key, value]) => ({
        type: value == null ? 'clear' : 'set', key, value, borderMode,
      }))
    ))
  } }
}

function scenario(name, run) {
  test(name, () => {
    const previous = { window: global.window, log: console.log }
    global.window = {}
    console.log = () => {}
    try { run() } finally { global.window = previous.window; console.log = previous.log }
  })
}

// 渲染真实 Border 和 mutation 适配层，只替换叶子 UI/拖拽等浏览器依赖。
// 直接调用宽度输入实际拿到的回调，覆盖“统一配置 → 单位下拉默认”的入口。
function renderBorderControls(value, onChange) {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const Module = require('node:module')
  const filename = require.resolve('../../StyleEditor/plugins/Border/index.tsx')
  const controls = { widths: [], colors: [], styles: [] }
  const leaf = () => null
  const children = props => props.children
  const Panel = props => { controls.panel = props; return props.children }
  Panel.Content = children
  Panel.Item = children
  const components = {
    Panel,
    Select: props => { controls.styles.push(props); return null },
    ColorEditor: props => { controls.colors.push(props); return null },
    VariableNumberInput: props => { controls.widths.push(props.inputProps); return null },
    withApplyVariableOption: options => options,
  }
  for (const name of ['BorderWeightOutlined', 'BorderSplitOutlined', 'BorderTopOutlined',
    'BorderBottomOutlined', 'BorderLeftOutlined', 'BorderRightOutlined', 'MinusOutlined']) components[name] = leaf
  const mocks = {
    react: { ...React, useLayoutEffect: () => {} },
    'react-dom': { createPortal: children },
    '../..': require('../../StyleEditor/context.tsx'),
    '../../components': components,
    '../../hooks': {
      useDragNumber: () => () => ({}),
      useLengthVarBinding: () => ({ hasVariables: false, anchorRef: { current: null } }),
    },
    '../../icons/Setting': { Setting: leaf },
    '../../../core/resolve-css-var-color': { getCssVarColorOptions: () => [], resolveCssVarColor: value => value },
    './index.less': {},
  }
  const loaded = new Module(filename, module)
  const actualRequire = Module.createRequire(filename)
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : actualRequire(name)
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React, esModuleInterop: true },
  })
  loaded._compile(outputText, filename)
  renderToStaticMarkup(React.createElement(loaded.exports.Border, { value, onChange }))
  return controls
}

for (const trigger of ['unit default', 'onClear', 'minus']) {
  scenario(`unified Border ${trigger} clears only its own fields through its actual callback`, () => {
    const current = border('10px', 'solid', 'rgb(0, 0, 0)')
    const { calls, applyItems, resolution } = fixture([['.target', {
      border: '10px solid rgb(0, 0, 0)', ...current, borderRadius: '4px', marginLeft: '24px',
    }]])
    const submitted = []
    const controls = renderBorderControls(current, items => { submitted.push(items); return applyItems(items) })
    assert.equal(controls.widths.length, 1, '必须处于统一配置，而不是单边配置')
    const width = controls.widths[0]
    assert.equal(width.clearable, true)
    assert.ok(width.unitOptions.some(option => option.value === 'default'))
    if (trigger === 'unit default') width.onChange('default')
    else if (trigger === 'onClear') width.onClear()
    else controls.panel.resetFunction()
    assert.equal(submitted.length, 1)
    const clearAll = trigger === 'minus'
    assert.deepEqual(Object.fromEntries(submitted[0].map(({ key, value }) => [key, value])),
      clearAll ? border(null, null, null) : component('Width', null))
    assert.equal(calls.length, 1)
    assert.equal(calls[0].selector, '.target')
    if (clearAll) {
      assert.equal(calls[0].style.border, null)
      assert.ok(Object.values(calls[0].style).every(value => value === null))
      for (const key of Object.keys(current)) assert.equal(resolution.get(key).winner, null)
    } else {
      assert.deepEqual(calls[0].style, { borderStyle: 'solid', borderColor: 'rgb(0, 0, 0)' })
      assert.ok(calls[0].deletions.includes('border'))
      for (const key of widthKeys) assert.equal(resolution.get(key).winner, null)
      for (const key of Object.keys(current).filter(key => !key.endsWith('Width'))) {
        assert.equal(resolution.get(key).winner.value, current[key])
      }
      const afterClear = { ...component('Style', 'solid'), ...component('Color', 'rgb(0, 0, 0)') }
      const rerendered = renderBorderControls(afterClear, applyItems)
      assert.equal(rerendered.widths[0].value, undefined)
      assert.equal(rerendered.styles.find(style => style.tip === '线条样式').value, 'solid')
      assert.equal(rerendered.colors[0].defaultValue, 'rgb(0, 0, 0)')
      rerendered.widths[0].onChange('12px')
      assert.deepEqual(calls.at(-1).style, { border: '12px solid rgb(0, 0, 0)' })
    }
    assert.equal(resolution.get('borderRadius').winner.value, '4px')
    assert.equal(resolution.get('marginLeft').winner.value, '24px')
  })
}

scenario('unified Border with no width does not offer width default or clear other fields', () => {
  const current = { ...component('Style', 'solid'), ...component('Color', 'rgb(0, 0, 0)') }
  const { calls, applyItems, resolution } = fixture([['.target', {
    borderStyle: 'solid', borderColor: 'rgb(0, 0, 0)', ...current,
  }]])
  const controls = renderBorderControls(current, applyItems)
  assert.equal(controls.widths.length, 1)
  assert.equal(controls.widths[0].clearable, false)
  assert.ok(!controls.widths[0].unitOptions.some(option => option.value === 'default'))
  controls.widths[0].onChange('default')
  assert.equal(calls.length, 0)
  for (const key of Object.keys(current)) assert.equal(resolution.get(key).winner.value, current[key])
})

scenario('unified width default retains variables, priorities and an explicit none style', () => {
  const current = border('var(--stroke)!important', 'none!important', 'var(--stroke-color)!important')
  const { calls, applyItems, resolution } = fixture([['.target', current]])
  const controls = renderBorderControls(current, applyItems)
  controls.widths[0].onChange('default')
  assert.deepEqual(calls[0].style, { borderStyle: 'none!important', borderColor: 'var(--stroke-color)!important' })
  assert.equal(resolution.get('borderTopWidth').winner, null)
  const afterClear = renderBorderControls({
    ...component('Style', 'none!important'), ...component('Color', 'var(--stroke-color)!important'),
  }, applyItems)
  assert.equal(afterClear.styles.find(style => style.tip === '线条样式').value, 'none')
  assert.equal(afterClear.colors[0].defaultValue, 'var(--stroke-color)')
})

scenario('an explicit line style is displayed independently of zero width in unified mode', () => {
  const controls = renderBorderControls(border('0px', 'dashed', 'red'), () => {})
  const lineStyle = controls.styles.find(style => style.tip === '线条样式')
  assert.equal(lineStyle.value, 'dashed')
  assert.deepEqual(lineStyle.options.map(option => option.value), ['none', 'solid', 'dashed'])
  assert.equal(controls.colors[0].defaultValue, 'red')
})

scenario('unified width default leaves style/color in their original rule without copying or deleting them', () => {
  const { calls, applyItems, resolution } = fixture([
    ['.color', { ...component('Style', 'solid'), ...component('Color', 'red') }],
    ['.target', component('Width', '10px')],
  ])
  renderBorderControls(border('10px', 'solid', 'red'), applyItems).widths[0].onChange('default')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].selector, '.target')
  assert.ok(Object.values(calls[0].style).every(value => value === null))
  assert.ok(!Object.keys(calls[0].style).some(key => /Style|Color/.test(key)))
  for (const side of sides) {
    assert.equal(resolution.get(`border${side}Width`).winner, null)
    assert.equal(resolution.get(`border${side}Style`).winner.label, '.color')
    assert.equal(resolution.get(`border${side}Color`).winner.value, 'red')
  }
})

scenario('unified refill uses the highest classname and carries authored style/color into border', () => {
  const current = border('10px', 'solid', '#84adff')
  const { calls, applyItems, resolution } = fixture([
    ['.color', { border: '10px solid #84adff', ...current }],
    ['.target.color', { marginLeft: '24px', fontWeight: '600' }],
  ])
  renderBorderControls(current, applyItems).widths[0].onChange('default')
  assert.equal(calls[0].selector, '.color')
  assert.deepEqual(calls[0].style, { borderStyle: 'solid', borderColor: '#84adff' })

  const remaining = { ...component('Style', 'solid'), ...component('Color', '#84adff') }
  renderBorderControls(remaining, applyItems).widths[0].onChange('1px')
  assert.equal(calls.length, 2)
  assert.equal(calls[1].selector, '.target.color')
  assert.deepEqual(calls[1].style, { border: '1px solid #84adff' })
  for (const key of Object.keys(border())) assert.equal(resolution.get(key).winner.label, '.target.color')
  assert.ok(resolution.get('borderTopColor').candidates.some(candidate => candidate.label === '.color' && candidate.value === '#84adff'))
  assert.equal(resolution.get('marginLeft').winner.value, '24px')
  assert.equal(resolution.get('fontWeight').winner.value, '600')

  renderBorderControls(border('1px'), applyItems).widths[0].onChange('default')
  assert.equal(calls[2].selector, '.target.color')
  assert.deepEqual(calls[2].style, { borderStyle: 'solid', borderColor: '#84adff' })
})

scenario('unified refill after CSSOM refresh repairs split-source width into one border at the highest classname', () => {
  const { calls, applyItems } = fixture([
    ['.color', { ...component('Style', 'solid'), ...component('Color', 'var(--stroke-color)') }],
    ['.target.color', { borderWidth: '10px', ...component('Width', '10px') }],
  ])
  renderBorderControls(border('10px', 'solid', 'var(--stroke-color)'), applyItems).widths[0].onChange('1px')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].selector, '.target.color')
  assert.deepEqual(calls[0].style, { border: '1px solid var(--stroke-color)' })
  assert.ok(calls[0].deletions.includes('borderWidth'))
})

scenario('unified refill does not invent a missing authored color to force border shorthand', () => {
  const { calls, applyItems } = fixture([
    ['.color', component('Style', 'solid')],
    ['.target.color', { marginLeft: '24px' }],
  ])
  renderBorderControls(component('Style', 'solid'), applyItems).widths[0].onChange('1px')
  assert.equal(calls[0].selector, '.target.color')
  assert.deepEqual(calls[0].style, { borderWidth: '1px', borderStyle: 'solid' })
})

scenario('split Border width default still removes only the selected side through its actual callback', () => {
  const current = { ...border(), borderLeftWidth: '7px' }
  const { calls, applyItems } = fixture([['.target', current]])
  const controls = renderBorderControls(current, applyItems)
  assert.equal(controls.widths.length, 4)
  controls.widths.find(width => width.value === '7px').onChange('default')
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].style, {
    borderTop: '1px solid #84adff', borderRight: '1px solid #84adff', borderBottom: '1px solid #84adff',
  })
})

scenario('same-source width edit keeps authored color and emits one border declaration', () => {
  const { calls, apply } = fixture([['.target', border()]])
  assert.equal(apply(component('Width', '2px')).applied, true)
  assert.deepEqual(calls[0].style, { border: '2px solid #84adff' })
  assert.equal(calls[0].selector, '.target')
})

for (const color of ['#84adff', 'rgba(24,144,255,1)']) {
  scenario(`recreating a cleared border keeps sides independent with color ${color}`, () => {
    const current = border('7px')
    const { calls, apply, resolution } = fixture([['.target', { border: '7px solid #84adff', ...current }]])
    for (const side of ['Top', 'Right', 'Bottom']) {
      apply(buildBorderWidthChange(current, [`border${side}Width`], null, () => 'solid').changes, 'split')
    }
    const recreated = buildBorderWidthChange({}, ['borderTopWidth'], '1px', () => 'none')
    apply(recreated.changes, 'split')
    assert.deepEqual(calls.at(-1).style, {
      borderLeft: '7px solid #84adff', borderTopWidth: '1px', borderTopStyle: 'solid',
    })
    assert.equal(resolution.get('borderTopColor').winner, null)
    apply({ borderTopColor: color }, 'split')
    assert.deepEqual(calls.at(-1).style, {
      borderLeft: '7px solid #84adff', borderTop: `1px solid ${color}`,
    })
    assert.equal(resolution.get('borderTopColor').winner.value, color)
    assert.equal(resolution.get('borderRightWidth').winner, null)
    assert.equal(resolution.get('borderBottomWidth').winner, null)
    assert.ok(calls.at(-1).deletions.includes('borderTopWidth'))
    assert.ok(calls.at(-1).deletions.includes('borderTopStyle'))
  })
}

scenario('split editing never collapses equal sides, but returning to all mode does', () => {
  const { calls, apply } = fixture([['.target', border()]])
  apply({ borderLeftWidth: '2px' }, 'split')
  apply({ borderLeftWidth: '1px' }, 'split')
  assert.deepEqual(calls.at(-1).style,
    Object.fromEntries(sides.map(side => [`border${side}`, '1px solid #84adff'])))
  apply(component('Width', '1px'), 'all')
  assert.deepEqual(calls.at(-1).style, { border: '1px solid #84adff' })
})

scenario('split clear preserves side output mode through mutation conversion', () => {
  const { calls, apply } = fixture([['.target', border()]])
  apply({ borderLeftColor: null }, 'split')
  assert.deepEqual(calls.at(-1).style, {
    borderTop: '1px solid #84adff', borderRight: '1px solid #84adff',
    borderBottom: '1px solid #84adff', borderLeftWidth: '1px', borderLeftStyle: 'solid',
  })
})

scenario('color from a different selector is neither copied nor deleted', () => {
  const { calls, apply } = fixture([
    ['.color', component('Color', '#84adff')],
    ['.target', { ...component('Width', '1px'), ...component('Style', 'solid') }],
  ])
  apply(component('Width', '2px'))
  assert.equal(calls.length, 1)
  assert.equal(calls[0].selector, '.target')
  assert.deepEqual(calls[0].style, { borderWidth: '2px', borderStyle: 'solid' })
})

scenario('consecutive edit and clear work before CSSOM recompilation and preserve radius', () => {
  const { calls, apply, resolution } = fixture([['.target', { ...border(), borderRadius: '4px' }]])
  apply(component('Width', '2px'))
  assert.equal(resolution.get('borderLeftWidth').winner.value, '2px')
  apply({ borderLeftWidth: '4px' })
  assert.equal(resolution.get('borderLeftWidth').winner.value, '4px')
  apply(component('Width', null))
  assert.deepEqual(calls[2].style, { borderStyle: 'solid', borderColor: '#84adff' })
  assert.equal(resolution.get('borderLeftWidth').winner, null)
  assert.equal(resolution.get('borderTopStyle').winner.value, 'solid')
  assert.ok(calls.every(call => !(call.deletions || []).some(key => /Radius/.test(key))))
})

scenario('widths from multiple sources are updated in their own selectors', () => {
  const { calls, apply } = fixture([
    ['.color', { borderTopWidth: '1px', borderRightWidth: '1px' }],
    ['.target', { borderBottomWidth: '1px', borderLeftWidth: '1px' }],
  ])
  apply(component('Width', '2px'))
  assert.deepEqual(calls.map(({ selector, style }) => ({ selector, style })), [
    { selector: '.color', style: { borderTopWidth: '2px', borderRightWidth: '2px' } },
    { selector: '.target', style: { borderBottomWidth: '2px', borderLeftWidth: '2px' } },
  ])
})

scenario('important priority is retained during width edits', () => {
  const importantBorder = Object.fromEntries(Object.entries(border()).map(([key, value]) => [key, `${value}!important`]))
  const { calls, apply } = fixture([['.target', importantBorder]])
  apply(component('Width', '2px'))
  assert.deepEqual(calls[0].style, { border: '2px solid #84adff!important' })
})

scenario('static JSX border keeps its existing shorthand source range', () => {
  const info = { border: { kind: 'static', valueStart: 1, valueEnd: 20, propertyStart: 0, propertyEnd: 21 } }
  const { calls, apply } = fixture([], { border: '1px solid #84adff', ...border() }, info)
  assert.equal(apply(component('Width', '2px')).applied, true)
  assert.deepEqual(calls[0].style, { border: '2px solid #84adff' })
  assert.equal(calls[0].selector, 'inline')
})

scenario('a class width edit preserves an inline color source without attempting to delete it', () => {
  const { calls, apply } = fixture([['.target', component('Width', '1px')]],
    { borderTopColor: 'red' }, { borderTopColor: { kind: 'dynamic' } })
  assert.equal(apply(component('Width', '2px')).applied, true)
  assert.deepEqual(calls[0].style, { borderWidth: '2px' })
  assert.ok(!calls[0].deletions?.includes('borderTopColor'))
})

scenario('a static inline width can clear without rewriting its dynamic sibling', () => {
  const { calls, apply } = fixture([], { borderLeftWidth: '2px', borderTopColor: 'red' }, {
    borderLeftWidth: { kind: 'static', valueStart: 1, valueEnd: 5, propertyStart: 0, propertyEnd: 6 },
    borderTopColor: { kind: 'dynamic' },
  })
  assert.equal(apply({ borderLeftWidth: null }).clearApplied, true)
  assert.deepEqual(calls[0].style, { borderLeftWidth: null })
})

scenario('clearing one side of border preserves the other widths without zero or unset', () => {
  const { calls, apply, resolution } = fixture([['.target', { border: '2px solid #84adff', ...border('2px') }]])
  apply({ borderLeftWidth: null })
  assert.deepEqual(calls[0].style, {
    borderTop: '2px solid #84adff', borderRight: '2px solid #84adff', borderBottom: '2px solid #84adff',
    borderLeftStyle: 'solid', borderLeftColor: '#84adff',
  })
  assert.equal(resolution.get('borderLeftWidth').winner, null)
  assert.equal(resolution.get('borderTopWidth').winner.value, '2px')
})

for (const clearedSide of sides) {
  scenario(`split editor clears the whole ${clearedSide} border and writes only the other three sides`, () => {
    const current = border('12px', 'solid', 'rgb(132, 173, 255)')
    const { calls, apply, resolution } = fixture([['.target', {
      border: '12px solid rgb(132, 173, 255)', ...current, borderRadius: '4px',
    }]])
    const mutation = buildBorderWidthChange(current, [`border${clearedSide}Width`], null,
      () => 'solid')
    assert.deepEqual(mutation.changes, {
      [`border${clearedSide}Width`]: null,
      [`border${clearedSide}Style`]: null,
      [`border${clearedSide}Color`]: null,
    })
    assert.equal(apply(mutation.changes).clearApplied, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].selector, '.target')
    assert.deepEqual(calls[0].style, Object.fromEntries(sides.filter(side => side !== clearedSide)
      .map(side => [`border${side}`, '12px solid rgb(132, 173, 255)'])))
    assert.ok(calls[0].deletions.includes('border'))
    assert.ok(!calls[0].deletions.some(key => /Radius/.test(key)))
    for (const part of ['Width', 'Style', 'Color']) {
      assert.equal(resolution.get(`border${clearedSide}${part}`).winner, null)
    }
  })
}

scenario('successive split resets and editing a remaining side do not recreate cleared borders', () => {
  const current = border('12px')
  const { calls, apply, resolution } = fixture([['.target', { border: '12px solid #84adff', ...current }]])
  const clearSide = side => buildBorderWidthChange(current, [`border${side}Width`], null,
    () => 'solid').changes
  apply(clearSide('Top'))
  apply(clearSide('Left'))
  assert.deepEqual(calls[1].style, { borderRight: '12px solid #84adff', borderBottom: '12px solid #84adff' })
  apply({ borderRightWidth: '8px' })
  assert.deepEqual(calls[2].style, { borderRight: '8px solid #84adff', borderBottom: '12px solid #84adff' })
  for (const side of ['Top', 'Left']) {
    for (const part of ['Width', 'Style', 'Color']) assert.equal(resolution.get(`border${side}${part}`).winner, null)
  }
  apply(clearSide('Bottom'))
  assert.deepEqual(calls[3].style, { borderRight: '8px solid #84adff' })
  apply(clearSide('Right'))
  assert.ok(Object.values(calls[4].style).every(value => value === null))
  assert.equal(resolution.get('borderRightWidth').winner, null)
})

scenario('split reset preserves sibling variables and important priority', () => {
  const current = border('var(--stroke)', 'dashed', 'var(--stroke-color)')
  const important = Object.fromEntries(Object.entries(current).map(([key, value]) => [key, `${value}!important`]))
  const { calls, apply } = fixture([['.target', important]])
  apply(buildBorderWidthChange(current, ['borderTopWidth'], null, () => 'dashed').changes)
  assert.deepEqual(calls[0].style, {
    borderRight: 'var(--stroke) dashed var(--stroke-color)!important',
    borderBottom: 'var(--stroke) dashed var(--stroke-color)!important',
    borderLeft: 'var(--stroke) dashed var(--stroke-color)!important',
  })
})

scenario('split reset preserves fallback rules instead of copying or deleting their declarations', () => {
  const { calls, apply, resolution } = fixture([
    ['.color', border('1px', 'dashed', 'red')],
    ['.target', border('12px')],
  ])
  apply(buildBorderWidthChange(border('12px'), ['borderTopWidth'], null, () => 'solid').changes)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].selector, '.target')
  assert.deepEqual(calls[0].style, {
    borderRight: '12px solid #84adff', borderBottom: '12px solid #84adff', borderLeft: '12px solid #84adff',
  })
  assert.equal(resolution.get('borderTopWidth').winner.value, '1px')
  assert.equal(resolution.get('borderTopWidth').winner.label, '.color')
})

scenario('computed-only clear is a no-op and width-added solid survives width default', () => {
  const { calls, apply, resolution } = fixture([['.target', {}]])
  assert.equal(apply(component('Width', null)).applied, false)
  assert.equal(calls.length, 0)
  const first = buildBorderWidthChange({}, widthKeys, '2px', () => 'none')
  apply(first.changes)
  assert.deepEqual(calls[0].style, { borderWidth: '2px', borderStyle: 'solid' })
  const cleared = buildBorderWidthChange(first.changes, widthKeys, null, () => 'solid')
  apply(cleared.changes)
  assert.deepEqual(calls[1].style, { borderStyle: 'solid' })
  assert.equal(resolution.get('borderTopStyle').winner.value, 'solid')
  assert.equal(resolution.get('borderTopWidth').winner, null)
})

test('default width is distinct from zero width', () => {
  assert.equal(hasNoVisibleBorderLine('solid', undefined), false)
  assert.equal(hasNoVisibleBorderLine('solid', '3px'), false)
  assert.equal(hasNoVisibleBorderLine('solid', '0px'), true)
  assert.equal(hasNoVisibleBorderLine('none', undefined), true)
})

test('clearing unified width preserves both authored and automatically introduced line styles', () => {
  const first = buildBorderWidthChange({}, widthKeys, '2px', () => 'none')
  assert.deepEqual(first.changes, { ...component('Width', '2px'), ...component('Style', 'solid') })
  const cleared = buildBorderWidthChange(first.changes, widthKeys, null, () => 'solid')
  assert.deepEqual(cleared.changes, component('Width', null))
  const existing = buildBorderWidthChange(border(), widthKeys, '2px', () => 'solid')
  assert.deepEqual(existing.changes, component('Width', '2px'))
  assert.deepEqual(buildBorderWidthChange(border('2px'), widthKeys, null, () => 'solid').changes,
    component('Width', null))
  const manual = buildBorderWidthChange(first.changes, widthKeys, null, () => 'solid')
  assert.deepEqual(manual.changes, component('Width', null))
})
