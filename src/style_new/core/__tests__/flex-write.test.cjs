const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const ts = require('typescript')

// 只加载生产写入链路做行为验证，不执行构建或类型检查。
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }
).outputText, filename)
require.extensions['.tsx'] = require.extensions['.ts']
const { applyStyleChange } = require('../apply-style-change.ts')
const { createStyleResolution, getStyleResolution, cssPropertyName } = require('../style-property.ts')
const { buildStyleMutationChange } = require('../../StyleEditor/helper/style-mutations.ts')

const flexKeys = ['flexGrow', 'flexShrink', 'flexBasis']
function declaration(authored) {
  const values = {}
  for (const [key, raw] of Object.entries(authored)) {
    const important = /!important\s*$/.test(raw)
    const value = String(raw).replace(/\s*!important\s*$/, '')
    values[cssPropertyName(key)] = raw
    if (key === 'flex') {
      value.split(/\s+/).forEach((part, index) => {
        values[cssPropertyName(flexKeys[index])] = part + (important ? ' !important' : '')
      })
    }
  }
  const names = Object.keys(values)
  return {
    length: names.length, item: index => names[index],
    getPropertyValue: key => String(values[key] ?? '').replace(/\s*!important\s*$/, ''),
    getPropertyPriority: key => /!important\s*$/.test(values[key] || '') ? 'important' : '',
  }
}

function fixture({ grow = '0', shorthand = '0 0 33.3333%', pseudo = null, sameSource = false } = {}) {
  const target = {
    nodeType: 1, style: declaration({}), dataset: {}, parentElement: null,
    classList: Object.assign(['label', 'col'], { contains: key => ['label', 'col'].includes(key) }),
    matches: () => true, hasAttribute: () => false,
    getAttribute: key => key === 'data-zone-selector' ? '.label' : null,
  }
  const sources = [
    { selector: '.col' + (pseudo || ''), authored: { flex: shorthand } },
    ...sameSource ? [] : [{ selector: '.label' + (pseudo || ''), authored: { flexGrow: grow } }],
  ]
  const tab = { selector: '.label' + (pseudo || ''), baseSelector: '.label', pseudo, target, baseRules: [],
    sourceRules: sources.map(({ selector, authored }, sourceOrder) => ({
      sourceSelector: selector, selectorPart: selector, sourceOrder, target,
      rule: { style: declaration(authored) },
    })) }
  const calls = []
  const editConfig = { options: { targetDom: target, zoneTab: tab }, value: {
    set: (patch, { selector }) => {
      const deletions = window.__mybricks_style_deletions || []
      calls.push({ patch, selector, deletions: [...deletions], explicitSelector: window.__mybricks_style_explicit_selector })
      const source = sources.find(source => source.selector === selector)
      assert.ok(source, `unexpected write target: ${selector}`)
      for (const key of deletions) delete source.authored[key]
      for (const [key, value] of Object.entries(patch)) {
        if (value == null) delete source.authored[key]
        else source.authored[key] = value
      }
    },
  } }
  const resolution = getStyleResolution(tab, target)
  let liveStyle = {}
  const apply = (grow, shrink, basis) => {
    const result = applyStyleChange({ editConfig, liveStyle, value: buildStyleMutationChange([
      { type: 'clear', key: 'flex' },
      ...[grow, shrink, basis].map((value, index) => value == null
        ? { type: 'clear', key: flexKeys[index] }
        : { type: 'set', key: flexKeys[index], value }),
    ]) })
    liveStyle = result.nextLiveStyle
    return result
  }
  const read = (current = resolution) => flexKeys.map(key => current.get(key).winner?.value)
  const reload = () => {
    tab.sourceRules.forEach((source, index) => { source.rule.style = declaration(sources[index].authored) })
    return createStyleResolution(tab, target)
  }
  return { apply, calls, resolution, sources, read, reload }
}

function scenario(name, run) {
  test(name, () => {
    const previous = { window: global.window, document: global.document, log: console.log }
    global.window = { getComputedStyle: element => element.style }
    global.document = { body: { appendChild() {} }, getElementById: () => null,
      createElement: () => ({ style: {}, appendChild() {}, removeAttribute() { this.style = {} } }) }
    console.log = () => {}
    try { run() } finally { Object.assign(global, { window: previous.window, document: previous.document }); console.log = previous.log }
  })
}

scenario('mixed flex sources persist edits and keep working before and after CSSOM reload', () => {
  const state = fixture()
  const first = state.apply('22', '0', '33.3333%')
  assert.equal(first.applied, true)
  assert.deepEqual(flexKeys.map(key => first.nextLiveStyle[key]), ['22', '0', '33.3333%'])
  assert.deepEqual(state.read(), ['22', '0', '33.3333%'])
  assert.equal(state.apply('22', '2', '33.3333%').applied, true)
  assert.deepEqual(state.read(), ['22', '2', '33.3333%'])
  assert.deepEqual(state.read(state.reload()), ['22', '2', '33.3333%'])
  assert.ok(state.calls.some(call => call.selector === '.label' && call.patch.flexGrow === '22'))
  assert.ok(state.calls.some(call => call.selector === '.col' && call.patch.flexShrink === '2'))
  assert.ok(state.calls.every(call => call.explicitSelector === call.selector))
})

scenario('splitting a shared shorthand preserves its own grow for elements without the label class', () => {
  const state = fixture({ grow: '0 !important', shorthand: '3 0 33.3333% !important' })
  assert.equal(state.apply('22', '2', '25%').applied, true)
  const col = state.sources.find(source => source.selector === '.col').authored
  assert.equal(col.flexGrow, '3 !important')
  assert.equal(col.flexShrink, '2 !important')
  assert.equal(col.flexBasis, '25% !important')
  assert.deepEqual(state.read(state.reload()), ['22', '2', '25%'])
})

scenario('clearing one field in mixed sources removes only its own contribution', () => {
  const state = fixture()
  assert.equal(state.apply('22', '2', null).applied, true)
  assert.deepEqual(state.read(state.reload()), ['22', '2', undefined])
})

scenario('a single-source shorthand still supports advanced editing', () => {
  const state = fixture({ sameSource: true })
  assert.equal(state.apply('22', '2', '25%').applied, true)
  assert.equal(state.calls.length, 1)
  assert.deepEqual(state.read(state.reload()), ['22', '2', '25%'])
})

scenario('mixed sources in a pseudo state stay in that state', () => {
  const state = fixture({ pseudo: ':hover' })
  assert.equal(state.apply('22', '2', '25%').applied, true)
  assert.ok(state.calls.every(call => call.selector.endsWith(':hover')))
  assert.deepEqual(state.read(state.reload()), ['22', '2', '25%'])
})
