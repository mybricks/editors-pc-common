const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }
).outputText, filename)
require.extensions['.tsx'] = require.extensions['.ts']
const { applyStyleChange, createStyleRemovalPlan } = require('../apply-style-change.ts')
const { collectAncestorStateLinkTab, createAncestorStateLink, resolveStateLinkAncestor } = require('../ancestor-state-link.ts')
const { collectAffectedElements } = require('../get-similar-zones.ts')
const { getStyleResolution, resolveEffectiveStyleSource } = require('../style-property.ts')
const { createStyleWriteTargetResolver } = require('../style-write-target.ts')
const { buildSoloSelector, getSavedSoloStyle } = require('../build-solo-selector.ts')
const { splitAncestorState, splitZoneSelectorState } = require('../zone-tab.ts')

function declaration(values) {
  const names = Object.keys(values)
  return {
    length: names.length, cssText: names.map(key => `${key}: ${values[key]}`).join(';'),
    item: index => names[index],
    getPropertyValue: key => String(values[key] || '').replace(/\s*!important\s*$/, ''),
    getPropertyPriority: key => /!important\s*$/.test(values[key] || '') ? 'important' : '',
  }
}

function fixture(important = false) {
  const target = { nodeType: 1, style: declaration({ color: 'black !important' }), dataset: {},
    parentElement: null, classList: ['B'], matches: () => true,
    hasAttribute: () => false, getAttribute: () => '.B' }
  const rule = (selector, values, sourceOrder) => ({ sourceSelector: selector, selectorPart: selector,
    sourceOrder, target, isPageStyle: true, rule: { style: declaration(values) } })
  const linked = rule('.A:hover .B', { color: important ? 'red !important' : 'red' }, 0)
  const own = rule('.B:hover', { color: 'green !important', opacity: '0.5' }, 1)
  const tab = { selector: '.B:hover', baseSelector: '.B', pseudo: ':hover', target,
    linkedSelector: '.A:hover .B', ancestorStateLink: { ancestorDepth: 1, selector: '.A:hover .B', pseudo: ':hover' },
    sourceRules: [linked, own], linkedRules: [linked, own], baseRules: [] }
  const calls = []
  const editConfig = { options: { zoneTab: tab, targetDom: target, selector: tab.linkedSelector }, value: {
    set: (patch, options) => calls.push({ patch: { ...patch }, selector: options.selector,
      deletions: [...(window.__mybricks_style_deletions || [])],
      explicit: window.__mybricks_style_explicit_selector,
      linked: window.__mybricks_style_ancestor_state_link_selector }),
  } }
  return { tab, target, own, calls, editConfig }
}

function scenario(name, run) {
  test(name, () => {
    const previous = { window: global.window, document: global.document }
    global.window = { getComputedStyle: element => element.style }
    global.document = { body: { appendChild() {} }, getElementById: () => null,
      createElement: () => ({ style: {}, appendChild() {}, removeAttribute() { this.style = {} } }) }
    try { run() } finally { Object.assign(global, previous) }
  })
}

scenario('four ancestor states are opt-in and do not expand compound or unsupported states', () => {
  for (const pseudo of [':hover', ':focus', ':active', ':disabled']) {
    assert.equal(splitZoneSelectorState(`.A${pseudo} .B`).pseudo, null)
    assert.equal(splitAncestorState(`.A${pseudo} .B`).matchSelector, '.A .B')
    assert.equal(splitAncestorState(`.A${pseudo} .B`).pseudo, pseudo)
    assert.equal(splitAncestorState(`.A${pseudo} .B${pseudo}`), null)
    assert.equal(splitAncestorState(`.A${pseudo} + .B`), null)
    assert.equal(splitAncestorState(`.A${pseudo} .C:hover .B`), null)
    assert.equal(splitAncestorState(`.A:not(${pseudo}) .B`), null)
  }
  for (const pseudo of [':focus-within', ':focus-visible', ':checked', '::before']) {
    assert.equal(splitAncestorState(`.A${pseudo} .B`), null)
  }
})

scenario('four manually added ancestor states require their own persisted declaration', () => {
  const previewModule = require('../state-preview.ts')
  const previousContext = previewModule.getStatePreviewContext
  const ancestor = { classList: ['A'], parentElement: null, matches: selector => selector === '.A' }
  const target = { classList: ['B'], parentElement: ancestor }
  const preview = { pseudo: ':hover', batch: true, tab: { baseSelector: '.A', isAdded: true } }
  let rules = []
  document.querySelectorAll = () => [{ sheet: { cssRules: rules } }]
  previewModule.getStatePreviewContext = element => element === ancestor ? preview : null
  try {
    for (const pseudo of [':hover', ':focus', ':active', ':disabled']) {
      preview.pseudo = pseudo
      rules = []
      assert.equal(createAncestorStateLink(target, '.B', ''), null)
      rules = [{ selectorText: `.A${pseudo}`, style: declaration({}) }]
      assert.equal(createAncestorStateLink(target, '.B', ''), null)
      const otherPseudo = pseudo === ':hover' ? ':focus' : ':hover'
      rules = [{ selectorText: `.A${otherPseudo}`, style: declaration({ color: 'red' }) }]
      assert.equal(createAncestorStateLink(target, '.B', ''), null)
      rules = [{ selectorText: `.A${pseudo}`, style: declaration({ color: 'blue' }) }]
      assert.deepEqual(createAncestorStateLink(target, '.B', ''), {
        ancestorDepth: 1, selector: `.A${pseudo} .B`, pseudo,
      })
    }
    preview.pseudo = ':focus-within'
    assert.equal(createAncestorStateLink(target, '.B', ''), null)
  } finally { previewModule.getStatePreviewContext = previousContext }
})

scenario('four linked states collect their matching tab and retain all original property sources', () => {
  const target = { classList: ['B'], parentElement: null, matches: selector => selector === '.B' || selector === '.A .B', style: declaration({}) }
  const rules = [{ selectorText: '.B', style: declaration({ 'font-weight': '400' }) }]
  for (const pseudo of [':hover', ':focus', ':active', ':disabled']) {
    rules.push({ selectorText: `.B${pseudo}`, style: declaration({ color: 'green !important' }) })
    rules.push({ selectorText: `.A${pseudo} .B`, style: declaration({ color: 'blue' }) })
  }
  document.querySelectorAll = () => [{ sheet: { cssRules: rules } }]
  for (const pseudo of [':hover', ':focus', ':active', ':disabled']) {
    const link = { ancestorDepth: 1, selector: `.A${pseudo} .B`, pseudo }
    const tab = collectAncestorStateLinkTab(target, { baseSelector: '.B', sourceRules: [], baseRules: [] }, link)
    assert.equal(tab.pseudo, pseudo)
    assert.equal(tab.selector, `.B${pseudo}`)
    assert.deepEqual(tab.sourceRules.map(source => source.sourceSelector), [`.B${pseudo}`, `.A${pseudo} .B`])
    assert.equal(tab.baseRules[0].rule.style.getPropertyValue('font-weight'), '400')
    tab.sourceRules.forEach(source => { source.isPageStyle = true })
    const resolution = getStyleResolution(tab, target)
    assert.deepEqual(resolution.get('color').candidates.map(item => item.label), [`.B${pseudo}`, link.selector])
    const resolve = createStyleWriteTargetResolver(tab, target, resolution)
    assert.equal(resolve('color').selector, `.B${pseudo}`)
    assert.equal(resolve('opacity').selector, link.selector)
  }
})

scenario('four linked states preserve potential count and runtime solo restore', () => {
  const previous = { Element: global.Element, CSS: global.CSS }
  global.Element = class {}
  global.CSS = { escape: value => value }
  try {
    const root = element('root')
    element('placeholder', root)
    const ancestor = element('A', root)
    const child = element('B', ancestor)
    element('other', ancestor)
    const scope = { querySelectorAll: selector => {
      assert.equal(selector, '.pages_Test__less--A .pages_Test__less--B')
      return [child, {}]
    } }
    for (const pseudo of [':hover', ':focus', ':active', ':disabled']) {
      const linkedSelector = `.A${pseudo} .B`
      assert.equal(collectAffectedElements({ linkedSelector, ancestorStateLink: { pseudo, selector: linkedSelector, ancestorDepth: 1 }, sourceRules: [], baseRules: [] }, [], scope, child).size, 2)
      const runtimeSelector = `.pages_Test__less--A:nth-child(2)${pseudo} .pages_Test__less--B:nth-child(1)`
      const cssom = { styleSheets: [{ cssRules: [
        { selectorText: runtimeSelector, style: declaration({ color: 'blue' }) },
        { selectorText: '.pages_Test__less--B:nth-child(1)', style: declaration({ color: 'green' }) },
      ] }] }
      const saved = getSavedSoloStyle(child, '.B', root, cssom, ancestor, linkedSelector)
      assert.equal(saved.selector, `.A:nth-child(2)${pseudo} .B:nth-child(1)`)
      assert.equal(saved.rules.length, 1)
    }
  } finally { Object.assign(global, previous) }
})

scenario('four states keep ancestor nth placement and submit only to their solo rule', () => {
  const root = element('root')
  element('placeholder', root)
  const ancestor = element('A', root)
  const child = element('B', ancestor)
  element('other', ancestor)
  for (const pseudo of [':hover', ':focus', ':active', ':disabled']) {
    const selector = buildSoloSelector(child, '.B', root, { stateAncestor: ancestor, linkedSelector: `.A${pseudo} .B` })
    assert.equal(selector, `.A:nth-child(2)${pseudo} .B:nth-child(1)`)
    const state = fixture()
    state.tab.pseudo = pseudo
    state.tab.linkedSelector = `.A${pseudo} .B`
    state.tab.ancestorStateLink = { ancestorDepth: 1, selector: state.tab.linkedSelector, pseudo }
    state.editConfig.options.soloEdit = true
    state.editConfig.options.selector = selector
    applyStyleChange({ editConfig: state.editConfig, liveStyle: {}, value: { key: 'color', value: 'blue' } })
    assert.equal(state.calls[0].selector, selector)
    assert.equal(state.calls[0].linked, selector)
    assert.deepEqual(state.calls[0].patch, { color: 'blue' })
    applyStyleChange({ editConfig: state.editConfig, liveStyle: {}, value: { key: 'paddingLeft', value: '8px' } })
    assert.equal(state.calls[1].selector, selector)
    assert.equal(state.calls[1].patch.paddingLeft, '8px')
    applyStyleChange({ editConfig: state.editConfig, liveStyle: {}, value: { key: 'color', value: null } })
    assert.equal(state.calls[2].selector, selector)
    assert.equal(state.calls[2].patch.color, 'unset')
  }
})

scenario('manually added ancestor hover offers linkage only after a nonempty rule is persisted', () => {
  const previewModule = require('../state-preview.ts')
  const previousContext = previewModule.getStatePreviewContext
  const ancestor = { classList: ['A'], parentElement: null, matches: selector => selector === '.A' }
  const target = { classList: ['B'], parentElement: ancestor }
  const preview = { pseudo: ':hover', batch: true, tab: { baseSelector: '.A', isAdded: true } }
  let rules = []
  document.querySelectorAll = () => [{ sheet: { cssRules: rules } }]
  previewModule.getStatePreviewContext = element => element === ancestor ? preview : null
  try {
    assert.equal(createAncestorStateLink(target, '.B', ''), null)
    rules = [{ selectorText: '.A:hover', style: declaration({}) }]
    assert.equal(createAncestorStateLink(target, '.B', ''), null)
    rules = [{ selectorText: '.A:hover', style: declaration({ color: 'blue' }) }]
    assert.equal(createAncestorStateLink(target, '.B', '').selector, '.A:hover .B')
    rules = []
    assert.equal(createAncestorStateLink(target, '.B', ''), null)
    preview.tab.isAdded = false
    assert.equal(createAncestorStateLink(target, '.B', '').selector, '.A:hover .B')
  } finally { previewModule.getStatePreviewContext = previousContext }
})

scenario('linked collection uses current normal sources and the existing hover cascade inputs', () => {
  const target = { classList: ['B'], parentElement: null, matches: selector => selector === '.B' || selector === '.A .B' }
  const rules = [
    { selectorText: '.B', style: declaration({ 'font-weight': '400' }) },
    { selectorText: '.B:hover', style: declaration({ color: 'green' }) },
    { selectorText: '.A:hover .B', style: declaration({ color: 'blue' }) },
  ]
  document.querySelectorAll = () => [{ sheet: { cssRules: rules } }]
  const emptyHover = { selector: '.B:hover', baseSelector: '.B', pseudo: ':hover', sourceRules: [], baseRules: [] }
  const linked = collectAncestorStateLinkTab(target, emptyHover, { ancestorDepth: 1, selector: '.A:hover .B', pseudo: ':hover' })
  assert.deepEqual(linked.baseRules.map(source => source.sourceSelector), ['.B'])
  assert.deepEqual(linked.sourceRules.map(source => source.sourceSelector), ['.B:hover', '.A:hover .B'])
  assert.equal(linked.baseRules[0].rule.style.getPropertyValue('font-weight'), '400')
})

scenario('linked affected count uses the fixed potential scope even without base sources or real hover', () => {
  const previous = { Element: global.Element, CSS: global.CSS }
  global.Element = class {}
  global.CSS = { escape: value => value }
  try {
    const first = { classList: ['B'], parentElement: { classList: ['A'], parentElement: null } }
    const second = {}
    const scope = { querySelectorAll: selector => {
      assert.equal(selector, '.A .B')
      return [first, second]
    } }
    const affected = collectAffectedElements({ linkedSelector: '.A:hover .B', ancestorStateLink: { pseudo: ':hover', selector: '.A:hover .B', ancestorDepth: 1 }, baseRules: [], sourceRules: [] }, ['.B:hover'], scope, first)
    assert.equal(affected.size, 2)
    assert.equal(affected.has(first), true)
  } finally { Object.assign(global, previous) }
})

scenario('four states edit the displayed source, use linkage for new fields, and clear the same source', () => {
  for (const pseudo of [':hover', ':focus', ':active', ':disabled']) {
    const state = fixture()
    state.target.style = declaration({})
    state.tab.selector = `.B${pseudo}`
    state.tab.pseudo = pseudo
    state.tab.linkedSelector = `.A${pseudo} .B`
    state.tab.ancestorStateLink = { ancestorDepth: 1, selector: state.tab.linkedSelector, pseudo }
    state.editConfig.options.selector = state.tab.linkedSelector
    state.tab.sourceRules.forEach(source => {
      source.sourceSelector = source.sourceSelector.replace(':hover', pseudo)
      source.selectorPart = source.sourceSelector
    })
    const resolution = getStyleResolution(state.tab, state.target)
    const displayed = resolveEffectiveStyleSource(resolution.get('color').candidates.filter(source => source.currentState))
    assert.equal(displayed.label, `.B${pseudo}`)
    applyStyleChange({ editConfig: state.editConfig, liveStyle: { color: 'green' }, value: { key: 'color', value: 'blue' } })
    assert.equal(state.calls[0].selector, `.B${pseudo}`)
    assert.equal(state.calls[0].linked, undefined)
    assert.equal(state.calls[0].explicit, state.calls[0].selector)
    assert.equal(resolution.get('color').winner.value, 'blue')
    applyStyleChange({ editConfig: state.editConfig, liveStyle: { color: 'blue' }, value: { key: 'letterSpacing', value: '2px' } })
    assert.equal(state.calls[1].selector, state.tab.linkedSelector)
    assert.equal(state.calls[1].linked, state.tab.linkedSelector)
    assert.deepEqual(state.calls[1].patch, { letterSpacing: '2px' })
    const removal = createStyleRemovalPlan(['color'], resolution, state.target)
    assert.equal(removal.canClear, true)
    assert.equal(removal.groups[0].selector, `.B${pseudo}`)
    applyStyleChange({ editConfig: state.editConfig, liveStyle: {}, value: [], removeKeys: ['color'] })
    assert.equal(state.calls[2].selector, `.B${pseudo}`)
    assert.equal(state.calls[2].linked, undefined)
    assert.equal(state.calls[2].patch.color, 'unset !important')
    applyStyleChange({ editConfig: state.editConfig, liveStyle: {}, value: [], removeKeys: ['letterSpacing'] })
    assert.equal(state.calls[3].selector, state.tab.linkedSelector)
    assert.deepEqual(state.calls[3].patch, { letterSpacing: null })
    assert.equal(window.__mybricks_style_ancestor_state_link_selector, undefined)
  }
})
scenario('ancestor winner uses its original rule and retains priority', () => {
  const state = fixture(true)
  state.target.style = declaration({})
  const resolution = getStyleResolution(state.tab, state.target)
  assert.equal(resolution.get('color').winner.label, '.A:hover .B')
  applyStyleChange({ editConfig: state.editConfig, liveStyle: { color: 'red' }, value: { key: 'color', value: 'blue' } })
  assert.equal(state.calls[0].selector, '.A:hover .B')
  assert.equal(state.calls[0].linked, '.A:hover .B')
  assert.deepEqual(state.calls[0].patch, { color: 'blue !important' })
})
scenario('new property keeps the chosen ancestor scope even if only another ancestor has an existing source', () => {
  const state = fixture()
  state.target.style = declaration({})
  state.tab.sourceRules = [{ ...state.own, sourceSelector: '.Other:hover .B', selectorPart: '.Other:hover .B' }]
  const resolve = createStyleWriteTargetResolver(state.tab, state.target)
  assert.equal(resolve('color').selector, '.Other:hover .B')
  assert.equal(resolve('letterSpacing').selector, '.A:hover .B')
})
scenario('spacing and radius follow their winning rule rather than the linked fallback', () => {
  const state = fixture()
  state.target.style = declaration({})
  state.own.rule.style = declaration({ 'padding-left': '4px !important', 'border-top-left-radius': '3px !important' })
  state.tab.sourceRules[0].rule.style = declaration({ 'padding-left': '2px', 'border-top-left-radius': '1px' })
  for (const [key, value] of [['paddingLeft', '8px'], ['borderTopLeftRadius', '6px']]) {
    applyStyleChange({ editConfig: state.editConfig, liveStyle: {}, value: { key, value, intent: 'set-effective-style' } })
    assert.equal(state.calls.at(-1).selector, '.B:hover')
    assert.equal(state.calls.at(-1).linked, undefined)
  }
})
scenario('affected scope includes original state sources as well as new-property linkage', () => {
  const state = fixture()
  state.target.matches = () => true
  const linked = {}, ownOnly = {}
  const previousElement = global.Element
  const previousCSS = global.CSS
  global.CSS = { escape: value => value }
  global.Element = class {}
  try {
    const scope = { querySelectorAll: selector => selector === '.A .B' ? [linked] : [linked, ownOnly] }
    const affected = collectAffectedElements(state.tab, [], scope, state.target)
    assert.equal(affected.size, 2)
    assert.equal(affected.has(ownOnly), true)
  } finally { global.Element = previousElement; global.CSS = previousCSS }
})
scenario('one change can write existing own-state and new linked fields to separate rules', () => {
  const state = fixture()
  state.target.style = declaration({})
  applyStyleChange({ editConfig: state.editConfig, liveStyle: {}, value: [
    { key: 'color', value: 'blue' }, { key: 'letterSpacing', value: '2px' },
  ] })
  assert.deepEqual(state.calls.map(call => call.selector), ['.B:hover', '.A:hover .B'])
  assert.equal(state.calls[0].linked, undefined)
  assert.equal(state.calls[1].linked, '.A:hover .B')
  assert.deepEqual(Object.keys(state.calls[0].patch), ['color'])
  assert.deepEqual(Object.keys(state.calls[1].patch), ['letterSpacing'])
})
scenario('runtime-library winner still falls back to the project linked selector', () => {
  const state = fixture()
  state.target.style = declaration({})
  state.own.isRuntimeStyle = true
  state.own.isPageStyle = false
  const resolve = createStyleWriteTargetResolver(state.tab, state.target)
  assert.equal(resolve('color').selector, '.A:hover .B')
})

scenario('batch editing removes the selected linked solo rule before using the original shared source', () => {
  const state = fixture()
  const root = element('root')
  element('placeholder', root)
  const ancestor = element('A', root)
  const child = element('B', ancestor)
  element('other', ancestor)
  const documentRoot = { getElementById: () => root }
  Object.assign(child, { nodeType: 1, style: declaration({}), dataset: {}, matches: () => true,
    hasAttribute: () => false, getRootNode: () => documentRoot })
  const soloSelector = buildSoloSelector(child, '.B', root, { stateAncestor: ancestor, linkedSelector: '.A:hover .B' })
  state.tab.target = child
  state.editConfig.options.targetDom = child
  state.editConfig.options.comId = 'component'
  const solo = { ...state.own, target: child, sourceSelector: soloSelector, selectorPart: soloSelector,
    rule: { style: declaration({ color: 'orange !important' }) } }
  state.tab.sourceRules.push(solo)
  const result = applyStyleChange({ editConfig: state.editConfig, liveStyle: { color: 'orange' }, value: { key: 'color', value: 'blue' } })
  assert.equal(result.applied, true)
  assert.equal(state.calls[0].selector, soloSelector)
  assert.ok(state.calls[0].deletions.includes('color'))
  assert.equal(state.calls[0].linked, soloSelector)
  assert.equal(state.calls[1].selector, '.B:hover')
  assert.equal(state.calls[1].linked, undefined)
  assert.equal(state.tab.sourceRules.includes(solo), false)
})

scenario('fixed ancestor resolves from the current target rather than retaining old DOM', () => {
  const ancestor = { parentElement: null }
  const middle = { parentElement: ancestor }
  assert.equal(resolveStateLinkAncestor({ parentElement: middle }, { ancestorDepth: 2, selector: '.A:hover .B', pseudo: ':hover' }), ancestor)
})

function element(name, parent = null) {
  const node = { parentElement: parent, children: [], classList: [`pages_Test__less--${name}`],
    getAttribute: key => key === 'data-zone-classnames' ? name : null }
  if (parent) parent.children.push(node)
  return node
}

scenario('descendant solo keeps the fixed ancestor batch or solo scope', () => {
  const root = element('root')
  element('placeholder', root)
  const ancestor = element('A', root)
  const child = element('B', ancestor)
  element('other', ancestor)
  for (const prefix of ['.A:hover', '.A:nth-child(2):hover']) {
    const linkedSelector = `${prefix} .B`
    const result = buildSoloSelector(child, '.B', root, { stateAncestor: ancestor, linkedSelector })
    assert.equal(result, '.A:nth-child(2):hover .B:nth-child(1)')
    assert.equal(getSavedSoloStyle(child, '.B', root, { styleSheets: [] }, ancestor, linkedSelector), null)
  }
  ancestor.children.reverse()
  assert.equal(buildSoloSelector(child, '.B', root, {
    stateAncestor: ancestor, linkedSelector: '.A:hover .B',
  }), '.A:nth-child(2):hover .B:nth-child(2)')
})

scenario('repeated stat items generate distinct linked solo rules and submit to the selected one', () => {
  const root = element('root')
  const group = element('statsGroupPrimary', root)
  const firstItem = element('statItem', group)
  const secondItem = element('statItem', group)
  const firstValue = element('statValue', firstItem)
  element('statLabel', firstItem)
  const secondValue = element('statValue', secondItem)
  element('statLabel', secondItem)
  const linkedSelector = '.statItem:hover .statValue'
  const firstSelector = buildSoloSelector(firstValue, '.statValue', root, { stateAncestor: firstItem, linkedSelector })
  const secondSelector = buildSoloSelector(secondValue, '.statValue', root, { stateAncestor: secondItem, linkedSelector })
  assert.equal(firstSelector, '.statItem:nth-child(1):hover .statValue:nth-child(1)')
  assert.equal(secondSelector, '.statItem:nth-child(2):hover .statValue:nth-child(1)')
  assert.equal(buildSoloSelector(firstValue, '.statValue', firstItem), '.statValue')
  const cssom = { styleSheets: [{ cssRules: [
    { selectorText: '.pages_Test__less--statItem:nth-child(1):hover .pages_Test__less--statValue:nth-child(1)', style: declaration({ color: 'blue' }) },
    { selectorText: '.pages_Test__less--statItem:nth-child(2):hover .pages_Test__less--statValue:nth-child(1)', style: declaration({ color: 'red' }) },
  ] }] }
  assert.equal(getSavedSoloStyle(firstValue, '.statValue', root, cssom, firstItem, linkedSelector).selector, firstSelector)
  assert.equal(getSavedSoloStyle(secondValue, '.statValue', root, cssom, secondItem, linkedSelector).selector, secondSelector)
  const state = fixture()
  state.editConfig.options.soloEdit = true
  state.editConfig.options.selector = secondSelector
  state.tab.linkedSelector = linkedSelector
  state.tab.ancestorStateLink.selector = linkedSelector
  applyStyleChange({ editConfig: state.editConfig, liveStyle: {}, value: { key: 'color', value: 'blue' } })
  assert.equal(state.calls[0].selector, secondSelector)
  assert.equal(state.calls[0].linked, secondSelector)
})

scenario('linked solo restore excludes the subject own solo rule', () => {
  const container = element('root')
  const ancestor = element('A', container)
  element('other', ancestor)
  const child = element('B', ancestor)
  const root = { styleSheets: [{ cssRules: [
    { selectorText: '.pages_Test__less--B:nth-child(2)', style: declaration({ color: 'green' }) },
    { selectorText: '.pages_Test__less--A:hover .pages_Test__less--B:nth-child(2)', style: declaration({ color: 'red' }) },
  ] }] }
  const saved = getSavedSoloStyle(child, '.B', container, root, ancestor, '.A:hover .B')
  assert.deepEqual(saved.rules.map(rule => rule.selector), ['.A:hover .B:nth-child(2)'])
})
