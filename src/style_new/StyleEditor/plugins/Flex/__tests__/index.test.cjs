const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

// 仅在内存中加载 TS 执行行为测试，不运行构建或类型检查。
const compilerOptions = {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  jsx: ts.JsxEmit.React, esModuleInterop: true,
}
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions }
).outputText, filename)
require.extensions['.tsx'] = require.extensions['.ts']
const { StyleEditorProvider } = require('../../../context.tsx')

function loadWithMocks(filename, mocks) {
  const loaded = new Module(filename, module)
  const actualRequire = Module.createRequire(filename)
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : actualRequire(name)
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, compilerOptions,
  }).outputText, filename)
  return loaded.exports
}

function renderControls(value, effectiveValue = {}) {
  const controls = { inputs: [], writes: [] }
  const capture = node => React.Children.forEach(node, child => {
    if (!React.isValidElement(child)) return
    if (child.type === 'input') controls.inputs.push(child.props)
    capture(child.props.children)
  })
  const children = props => props.children
  const leaf = () => null
  const Panel = props => { capture(props.children); return props.children }
  Panel.Content = children
  Panel.Item = children
  const { Flex } = loadWithMocks(require.resolve('../index.tsx'), {
    '../../components': {
      Panel,
      InputNumber: props => { controls.basis = props; return null },
    },
    '../../icons/Setting': { Setting: leaf },
    '../../components/Icon': { MinusOutlined: leaf },
    './index.less': {},
  })
  const previousWindow = global.window
  global.window = { getComputedStyle: element => element.style }
  try {
    renderToStaticMarkup(React.createElement(StyleEditorProvider, {
      value: {
        editConfig: {}, autoCollapseWhenUnusedProperty: false,
        targetDom: { style: {}, parentElement: { style: { display: 'flex' } } },
        effectiveStyle: Object.fromEntries(Object.entries(effectiveValue).map(([key, value]) =>
          [key, { value, type: 'stylesheet' }])),
      },
    }, React.createElement(Flex, {
      value, collapse: false, showTitle: true,
      onChange: items => { controls.writes.push(...items) },
    })))
  } finally {
    global.window = previousWindow
  }
  return controls
}

function assertParts(controls, grow, shrink, basis) {
  assert.deepEqual(controls.inputs.map(input => input.value), [grow, shrink])
  assert.equal(controls.basis.defaultValue, basis)
}

function defaultConfiguration(sourceValue, ruleValue) {
  const { getDefaultConfiguration } = loadWithMocks(require.resolve('../../../../core/get-default-configuration.ts'), {
    '../../utils': { deepCopy: value => JSON.parse(JSON.stringify(value)) },
    '../StyleEditor': { DEFAULT_OPTIONS: ['flex'] },
    '../StyleEditor/helper': { splitCSSProperties: value => ({ ...value }) },
    './get-effected-css': {
      getEffectedCssPropertyAndOptions: () => [ruleValue, ['flex'], ['flex'], [], {}],
    },
  })
  return getDefaultConfiguration({
    value: { get: () => sourceValue },
    options: { plugins: ['flex'], selector: '.label', targetDom: { nodeType: 1 } },
  }).defaultValue
}

test('percentage shorthand displays both zero factors and the full basis precision', () => {
  const controls = renderControls({ flex: '0 0 33.3333%' })
  assertParts(controls, '0', '0', '33.3333%')
  assert.deepEqual(controls.writes, [])
})

for (const override of [{ flexGrow: 0 }, { flexShrink: 0 }, { flexBasis: '25%' }]) {
  test(`a partial longhand override preserves the other shorthand fields: ${JSON.stringify(override)}`, () => {
    const controls = renderControls({ flex: '0 0 33.3333%', ...override })
    assertParts(controls, '0', '0', override.flexBasis || '33.3333%')
  })
}

test('merging a source longhand with a rule shorthand keeps all three fields', () => {
  const value = defaultConfiguration({ flexGrow: 0 }, { flex: '0 0 33.3333%' })
  assertParts(renderControls(value), '0', '0', '33.3333%')
})

test('mixed shorthand and longhand source declarations keep the shorthand contribution', () => {
  const value = defaultConfiguration({ flex: '0 0 33.3333%', flexGrow: 2 }, {})
  assertParts(renderControls(value), '2', '0', '33.3333%')
})

test('an authored ratio still overrides expanded CSSOM fields', () => {
  const value = defaultConfiguration({ flex: 2 }, { flex: '1 1 0%', flexGrow: '1', flexShrink: '1', flexBasis: '0%' })
  const controls = renderControls(value)
  assert.deepEqual(controls.inputs.map(input => input.value), ['2'])
  assert.equal(controls.basis, undefined)
})

test('editing one field preserves the other values contributed by the shorthand', () => {
  const controls = renderControls({ flex: '0 0 33.3333%', flexGrow: 0 })
  controls.inputs[0].onFocus()
  controls.inputs[0].onBlur({ target: { value: '2' } })
  assert.deepEqual(controls.writes.map(({ key, value }) => ({ key, value })), [
    { key: 'flex', value: null },
    { key: 'flexGrow', value: '2' },
    { key: 'flexShrink', value: '0' },
    { key: 'flexBasis', value: '33.3333%' },
  ])
})

test('focus and blur without an edit do not rewrite the shorthand', () => {
  const controls = renderControls({ flex: '0 0 33.3333%', flexGrow: 0 })
  for (const input of controls.inputs) {
    input.onFocus()
    input.onBlur({ target: { value: input.value } })
  }
  assert.deepEqual(controls.writes, [])
})

test('a lone longhand leaves genuinely unconfigured fields empty', () => {
  assertParts(renderControls({ flexGrow: 0 }), '0', '', undefined)
})
