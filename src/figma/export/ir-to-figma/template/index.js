// 汇总所有变体模板，供 html-templates-loader.js 的 buildTemplate 消费
// 新增组件时在此追加一行 require 即可
module.exports = [
  { fileName: 'Button',     htmlContent: require('./Button.js') },
  { fileName: 'Checkbox',   htmlContent: require('./Checkbox.js') },
  { fileName: 'DatePicker', htmlContent: require('./DatePicker.js') },
  { fileName: 'Input',      htmlContent: require('./Input.js') },
  { fileName: 'Radio',      htmlContent: require('./Radio.js') },
  { fileName: 'Select',     htmlContent: require('./Select.js') },
  { fileName: 'Switch',     htmlContent: require('./Switch.js') },
  { fileName: 'TimePicker', htmlContent: require('./TimePicker.js') },
  { fileName: 'Icon',       htmlContent: require('./Icon.js') },
];
