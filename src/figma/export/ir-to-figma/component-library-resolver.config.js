'use strict';

/**
 * 组件库变体解析配置
 *
 * 目标：把 resolver 内的“组件特例/默认值/兜底”从逻辑代码中抽离，
 * 统一在这里维护，避免散落在主流程里形成胶水分支。
 */
module.exports = {
  // 当 JSX 未显式传某 prop（undefined）时补齐默认值，仅补缺省字段。
  defaultProps: {
    Button: {
      type: 'secondary',
      size: 'middle',
    },
    Select: {
      size: 'middle',
    },
    DatePicker: {
      size: 'middle',
    },
    RangePicker: {
      size: 'middle',
    },
    TimePicker: {
      size: 'middle',
    },
    Tag: {
      size: 'middle',
    },
  },

  // JSX prop 值与模板 description 值不一致时做归一映射。
  propAliases: {
    Input: {
      size: { middle: undefined },
    },
    Button: {
      type: { link: 'text' },
    },
    Tag: {
      color: { default: undefined },
    },
  },

  // 组件语义值到“风格=”维度值的映射（用于风格 filter）。
  buttonTypeToStyle: {
    link: '品牌色',
  },

  // 精确 key / 宽松 key 都 miss 时，按组件执行可配置兜底。
  // 规则顺序即尝试顺序，命中即停止。
  missFallbackByComponent: {
    Select: [
      {
        name: 'size-middle',
        overrideProps: { size: 'middle' },
      },
    ],
  },

  // JSX children 文案区分变体族时，用变体名中的维度做二级消歧（如 Checkbox 的 带图标=on/off）
  inlineChildrenVariantDim: {
    Checkbox: '带图标',
  },

  // 组件在 symbolDescription 中靠 JSX prop 有无区分变体族（不进 descKey，仅消歧）
  jsxPropPresenceFilters: {
    Alert: ['description'],
  },
};
