import { i18n } from "./core/i18n";

export default {
  // ZoneTabBar / zone-tab
  commonTab: i18n({
    zh: '常规',
    en: 'Common',
  }),

  // CssEditor
  cssEditorTitle: i18n({
    zh: 'CSS样式编辑',
    en: 'CSS Editor',
  }),
  zoomIn: i18n({
    zh: '放大',
    en: 'Zoom in',
  }),

  // ColorEditor
  inheritFallback: i18n({
    zh: '继承',
    en: 'Inherit',
  }),
  noColorConfigured: i18n({
    zh: '未配置颜色',
    en: 'No color set',
  }),
  colorInputTip: i18n({
    zh: '支持16进制、RGB、RGBA、HSL、HSLA、var()或颜色名称',
    en: 'Supports hex, RGB, RGBA, HSL, HSLA, var(), or a color name',
  }),
  gradientColorText: i18n({
    zh: '渐变色',
    en: 'Gradient',
  }),
  backgroundImageText: i18n({
    zh: '背景图',
    en: 'Image',
  }),
  unbind: i18n({
    zh: '解除绑定',
    en: 'Unbind',
  }),
  colorVariable: i18n({
    zh: '@颜色变量',
    en: '@Color variable',
  }),

  // Colorpicker
  close: i18n({
    zh: '关闭',
    en: 'Close',
  }),
  fillTab: i18n({
    zh: '填充',
    en: 'Solid',
  }),
  gradientTab: i18n({
    zh: '渐变',
    en: 'Gradient',
  }),
  imageTab: i18n({
    zh: '图片',
    en: 'Image',
  }),
  variableTab: i18n({
    zh: '变量',
    en: 'Variable',
  }),
  noColorVariables: i18n({
    zh: '当前画布没有可用的颜色变量',
    en: 'No color variables available on this canvas',
  }),

  // DropDown (font)
  removeFontTip: i18n({
    zh: '移除该字体',
    en: 'Remove font',
  }),
  dragReorderTip: i18n({
    zh: '拖拽调整顺序',
    en: 'Drag to reorder',
  }),
  selectedFonts: i18n({
    zh: '已选字体',
    en: 'Selected fonts',
  }),
  fontPriorityTip: i18n({
    zh: '字体优先级从上到下递减',
    en: 'Font priority decreases from top to bottom',
  }),
  moreFonts: i18n({
    zh: '更多字体',
    en: 'More fonts',
  }),

  // GradientEditor / Gradient — type & shape labels
  linearGradient: i18n({
    zh: '线性',
    en: 'Linear',
  }),
  radialGradient: i18n({
    zh: '径向',
    en: 'Radial',
  }),
  ellipseShape: i18n({
    zh: '椭圆',
    en: 'Ellipse',
  }),
  circleShape: i18n({
    zh: '圆形',
    en: 'Circle',
  }),

  // GradientEditor — tips
  gradientTypeTip: i18n({
    zh: '渐变类型',
    en: 'Gradient type',
  }),
  gradientAngleTip: i18n({
    zh: '渐变线方向角度',
    en: 'Gradient angle',
  }),
  anglePrefixTip: i18n({
    zh: '角度',
    en: 'Angle',
  }),
  radialShapeTip: i18n({
    zh: '辐射形状',
    en: 'Radial shape',
  }),
  stopPositionTip: i18n({
    zh: '停靠位置',
    en: 'Stop position',
  }),

  // Gradient component
  gradientColorTip: i18n({
    zh: '渐变颜色',
    en: 'Gradient color',
  }),
  resetTip: i18n({
    zh: '重置',
    en: 'Reset',
  }),
  gradientTypeSuffix: i18n({
    zh: '颜色渐变',
    en: 'gradient',
  }),

  // Image / ImagePanel — labels
  imageSizeLabel: i18n({
    zh: '大小',
    en: 'Size',
  }),
  imageRepeatLabel: i18n({
    zh: '平铺',
    en: 'Repeat',
  }),
  imagePositionLabel: i18n({
    zh: '位置',
    en: 'Position',
  }),
  imageAlt: i18n({
    zh: '图片',
    en: 'Image',
  }),
  imageAltBg: i18n({
    zh: '背景图片',
    en: 'Background image',
  }),
  clickToUpload: i18n({
    zh: '点击上传',
    en: 'Click to upload',
  }),

  // Image size options
  imgSizeCover: i18n({
    zh: '填充（无留白）',
    en: 'Cover (no whitespace)',
  }),
  imgSizeContain: i18n({
    zh: '适应（有留白）',
    en: 'Contain (with whitespace)',
  }),
  imgSizeStretch: i18n({
    zh: '拉伸',
    en: 'Stretch',
  }),
  imgSizeOriginal: i18n({
    zh: '原始大小',
    en: 'Original size',
  }),
  imgSizeDefault: i18n({
    zh: '默认',
    en: 'Default',
  }),
  imgSizeFit: i18n({
    zh: '适应',
    en: 'Contain',
  }),
  imgSizeFill: i18n({
    zh: '填充',
    en: 'Cover',
  }),
  imgSizeTile: i18n({
    zh: '铺满',
    en: 'Fill',
  }),
  imgSizeTileX: i18n({
    zh: '铺满x轴',
    en: 'Fill X-axis',
  }),
  imgSizeTileY: i18n({
    zh: '铺满y轴',
    en: 'Fill Y-axis',
  }),

  // Image repeat options
  imgRepeatOn: i18n({
    zh: '平铺',
    en: 'Repeat',
  }),
  imgRepeatOff: i18n({
    zh: '不平铺',
    en: 'No repeat',
  }),

  // Image position options
  imgPosTop: i18n({
    zh: '居上',
    en: 'Top',
  }),
  imgPosCenter: i18n({
    zh: '居中',
    en: 'Center',
  }),
  imgPosBottom: i18n({
    zh: '居下',
    en: 'Bottom',
  }),
  imgPosLeft: i18n({
    zh: '居左',
    en: 'Left',
  }),
  imgPosRight: i18n({
    zh: '居右',
    en: 'Right',
  }),
  imgPosTopLeft: i18n({
    zh: '左上',
    en: 'Top left',
  }),
  imgPosBottomLeft: i18n({
    zh: '左下',
    en: 'Bottom left',
  }),
  imgPosTopRight: i18n({
    zh: '右上',
    en: 'Top right',
  }),
  imgPosBottomRight: i18n({
    zh: '右下',
    en: 'Bottom right',
  }),

  // ─── Phase 3 新增词条 ───────────────────────────────────────────────────

  // ClearButton / generic
  clearLabel: i18n({
    zh: '清空',
    en: 'Clear',
  }),

  // InputNumber
  defaultLabel: i18n({
    zh: '默认',
    en: 'Default',
  }),
  settingsTip: i18n({
    zh: '设置',
    en: 'Settings',
  }),
  unitTip: i18n({
    zh: '单位',
    en: 'Unit',
  }),

  // Popup
  cancelBtn: i18n({
    zh: '取消',
    en: 'Cancel',
  }),
  confirmBtn: i18n({
    zh: '确定',
    en: 'OK',
  }),

  // Slider / VariableNumberInput / VariableChip
  applyVariableTip: i18n({
    zh: '应用变量...',
    en: 'Apply variable...',
  }),
  variablePrefix: i18n({
    zh: '变量：',
    en: 'Variable: ',
  }),
  replaceVariable: i18n({
    zh: '替换变量...',
    en: 'Replace variable...',
  }),
  fixedValuePrefix: i18n({
    zh: '固定值',
    en: 'Fixed value',
  }),

  // VariableList
  searchPlaceholder: i18n({
    zh: '搜索',
    en: 'Search',
  }),
  noVariables: i18n({
    zh: '当前画布没有可用变量',
    en: 'No variables available on this canvas',
  }),
  noSizeVariables: i18n({
    zh: '当前画布没有可用的尺寸变量',
    en: 'No size variables available on this canvas',
  }),
  noOpacityVariables: i18n({
    zh: '当前画布没有可用的不透明度变量',
    en: 'No opacity variables available on this canvas',
  }),

  // Appearance / Opacity
  opacityPanelTitle: i18n({
    zh: '不透明度',
    en: 'Opacity',
  }),
  dragOpacity: i18n({
    zh: '拖拽调整不透明度',
    en: 'Drag to adjust opacity',
  }),
  dragOpacityUnbind: i18n({
    zh: '拖拽调整不透明度（将解除变量绑定）',
    en: 'Drag to adjust opacity (variable will be unbound)',
  }),
  fixedValueOpacity: i18n({
    zh: '固定值',
    en: 'Fixed value',
  }),

  // Background
  imageLayerLabel: i18n({
    zh: '图片',
    en: 'Image',
  }),
  gradientLayerLabel: i18n({
    zh: '渐变',
    en: 'Gradient',
  }),
  solidLayerLabel: i18n({
    zh: '纯色',
    en: 'Solid color',
  }),
  fillPanelTitle: i18n({
    zh: '填充',
    en: 'Fill',
  }),
  dragOpacityShort: i18n({
    zh: '拖拽调整不透明度',
    en: 'Drag to adjust opacity',
  }),

  // Border
  noBorder: i18n({
    zh: '无',
    en: 'None',
  }),
  solidLine: i18n({
    zh: '实线',
    en: 'Solid',
  }),
  dashedLine: i18n({
    zh: '虚线',
    en: 'Dashed',
  }),
  borderOutside: i18n({
    zh: '外部',
    en: 'Outside',
  }),
  borderCenter: i18n({
    zh: '居中',
    en: 'Center',
  }),
  borderInside: i18n({
    zh: '内部',
    en: 'Inside',
  }),
  defaultOption: i18n({
    zh: '默认',
    en: 'Default',
  }),
  lineStyleTip: i18n({
    zh: '线条样式',
    en: 'Line style',
  }),
  borderWidthTip: i18n({
    zh: '边框宽度',
    en: 'Border width',
  }),
  leftBorderWidthTip: i18n({
    zh: '左边框宽度',
    en: 'Left border width',
  }),
  topBorderWidthTip: i18n({
    zh: '上边框宽度',
    en: 'Top border width',
  }),
  rightBorderWidthTip: i18n({
    zh: '右边框宽度',
    en: 'Right border width',
  }),
  bottomBorderWidthTip: i18n({
    zh: '下边框宽度',
    en: 'Bottom border width',
  }),
  borderPositionTitle: i18n({
    zh: '边框位置',
    en: 'Border position',
  }),
  borderPositionLabel: i18n({
    zh: '位置',
    en: 'Position',
  }),
  borderPositionTip: i18n({
    zh: '边框位置设置',
    en: 'Border position',
  }),
  borderPanelTitle: i18n({
    zh: '边框',
    en: 'Border',
  }),
  deleteBorderTip: i18n({
    zh: '删除边框',
    en: 'Remove border',
  }),
  toggleSplitTip: i18n({
    zh: '切换为单独配置',
    en: 'Switch to individual sides',
  }),
  toggleUnifiedTip: i18n({
    zh: '切换为统一配置',
    en: 'Switch to unified',
  }),
  computedValueTip: i18n({
    zh: '当前未配置，为计算值',
    en: 'Not configured, showing computed value',
  }),

  // Border-Radius / Radius
  radiusPanelTitle: i18n({
    zh: '圆角',
    en: 'Radius',
  }),
  radiusTip: i18n({
    zh: '圆角半径',
    en: 'Border radius',
  }),
  topLeftRadiusTip: i18n({
    zh: '左上角半径',
    en: 'Top-left radius',
  }),
  topRightRadiusTip: i18n({
    zh: '右上角半径',
    en: 'Top-right radius',
  }),
  bottomRightRadiusTip: i18n({
    zh: '右下角半径',
    en: 'Bottom-right radius',
  }),
  bottomLeftRadiusTip: i18n({
    zh: '左下角半径',
    en: 'Bottom-left radius',
  }),
  topLeftRadiusLabel: i18n({
    zh: '左上圆角',
    en: 'Top-left',
  }),
  topRightRadiusLabel: i18n({
    zh: '右上圆角',
    en: 'Top-right',
  }),
  bottomLeftRadiusLabel: i18n({
    zh: '左下圆角',
    en: 'Bottom-left',
  }),
  bottomRightRadiusLabel: i18n({
    zh: '右下圆角',
    en: 'Bottom-right',
  }),
  mixedPlaceholder: i18n({
    zh: '混合',
    en: 'Mixed',
  }),
  toggleEditModeTip: i18n({
    zh: '切换编辑方式',
    en: 'Toggle edit mode',
  }),
  dragRadiusUnbind: i18n({
    zh: '将解除变量绑定',
    en: 'variable will be unbound',
  }),
  dragAdjust: i18n({
    zh: '拖拽调整',
    en: 'Drag to adjust',
  }),

  // CSSPaste
  appliedStylesCount: i18n({
    zh: '条样式',
    en: 'styles applied',
  }),
  alreadyApplied: i18n({
    zh: '已应用',
    en: 'Applied',
  }),
  applyStyles: i18n({
    zh: '应用样式',
    en: 'Apply styles',
  }),

  // Cursor
  cursorHelp: i18n({ zh: '帮助', en: 'Help' }),
  cursorPointer: i18n({ zh: '手', en: 'Pointer' }),
  cursorText: i18n({ zh: '文本可选中', en: 'Text' }),
  cursorNotAllowed: i18n({ zh: '不可点击', en: 'Not allowed' }),
  cursorDefault: i18n({ zh: '箭头', en: 'Default' }),
  cursorCustom: i18n({ zh: '自定义', en: 'Custom' }),
  cursorPanelTitle: i18n({ zh: '光标', en: 'Cursor' }),

  // Effects
  dropShadowLabel: i18n({ zh: '外阴影', en: 'Drop shadow' }),
  innerShadowLabel: i18n({ zh: '内阴影', en: 'Inner shadow' }),
  textShadowLabel: i18n({ zh: '文字阴影', en: 'Text shadow' }),
  layerBlurLabel: i18n({ zh: '图层模糊', en: 'Layer blur' }),
  backgroundBlurLabel: i18n({ zh: '背景模糊', en: 'Background blur' }),
  shadowBlurPanelTitle: i18n({ zh: '阴影与模糊', en: 'Shadow & Blur' }),
  editEffectTip: i18n({ zh: '点击编辑效果', en: 'Click to edit' }),
  closeEffectTip: i18n({ zh: '关闭', en: 'Close' }),
  positionLabel: i18n({ zh: '位置', en: 'Offset' }),
  blurLabel: i18n({ zh: '模糊', en: 'Blur' }),
  spreadLabel: i18n({ zh: '扩散', en: 'Spread' }),
  colorLabel: i18n({ zh: '颜色', en: 'Color' }),
  dragBlurTip: i18n({ zh: '拖拽调整模糊半径', en: 'Drag to adjust blur radius' }),
  dragSpreadTip: i18n({ zh: '拖拽调整扩散半径', en: 'Drag to adjust spread radius' }),
  dragOffsetXTip: i18n({ zh: '拖拽调整x轴偏移', en: 'Drag to adjust X offset' }),
  dragOffsetYTip: i18n({ zh: '拖拽调整y轴偏移', en: 'Drag to adjust Y offset' }),
  dragUnbindSuffix: i18n({ zh: '（将解除变量绑定）', en: ' (variable will be unbound)' }),

  // Flex
  flexPanelTitle: i18n({ zh: '弹性', en: 'Flex' }),
  flexAutoFill: i18n({ zh: '自动填充父级的剩余空间，多个元素按比例分配', en: 'Auto-fill remaining space in parent, distributed proportionally among siblings' }),
  flexRatioLabel: i18n({ zh: '比例', en: 'Ratio' }),
  flexRatioTip: i18n({ zh: '父级为横向/纵向排列时，决定本元素占多少剩余空间。填 1 表示参与均分；多个子项分别填 1 和 2 时按 1:2 分配。清空则不弹性拉伸。', en: 'When parent is row/column, determines how much remaining space this element takes. 1 = equal share; 1 and 2 → 1:2 ratio. Leave empty to disable flex stretch.' }),
  flexSplitTip: i18n({ zh: '切换为单独配置（增长 / 收缩 / 基础长度）', en: 'Switch to individual (grow / shrink / basis)' }),
  flexUnifiedTip: i18n({ zh: '切换为统一配置（比例）', en: 'Switch to unified (ratio)' }),
  flexGrowLabel: i18n({ zh: '增长系数', en: 'Grow' }),
  flexGrowTip: i18n({ zh: '空间有多余时，按该数值比例放大。常用 1；填 0 表示不放大。', en: 'When there is extra space, scale up by this factor. Use 1 for equal grow; 0 to disable.' }),
  flexShrinkLabel: i18n({ zh: '收缩系数', en: 'Shrink' }),
  flexShrinkTip: i18n({ zh: '空间不够时，按该数值比例缩小。常用 1；填 0 表示不缩小。', en: 'When space is insufficient, shrink by this factor. Use 1 for equal shrink; 0 to disable.' }),
  flexBasisLabel: i18n({ zh: '基础长度', en: 'Basis' }),
  flexBasisTip: i18n({ zh: '分配剩余空间前的初始尺寸。填 0 表示尺寸完全由比例决定；也可填具体长度，如 100px、50%。留空时按元素自身尺寸或内容计算。', en: 'Initial size before distributing remaining space. 0 means size is entirely ratio-driven; or specify a length like 100px / 50%. Leave empty to use natural size.' }),
  flexDefaultPlaceholder: i18n({ zh: '默认', en: 'Default' }),
  styleSourceNotReady: i18n({ zh: '样式来源尚未就绪，暂不能删除', en: 'Style source not ready, cannot delete yet' }),

  // Font
  fontPanelTitle: i18n({ zh: '字体', en: 'Typography' }),
  fontWeight100: i18n({ zh: '极细', en: 'Thin' }),
  fontWeight200: i18n({ zh: '特细', en: 'Extra Light' }),
  fontWeight300: i18n({ zh: '细体', en: 'Light' }),
  fontWeight400: i18n({ zh: '标准', en: 'Regular' }),
  fontWeight500: i18n({ zh: '中等', en: 'Medium' }),
  fontWeight600: i18n({ zh: '中黑', en: 'Semi Bold' }),
  fontWeight700: i18n({ zh: '粗体', en: 'Bold' }),
  fontWeight800: i18n({ zh: '特粗', en: 'Extra Bold' }),
  fontWeight900: i18n({ zh: '极粗', en: 'Black' }),
  fontWeightThin: i18n({ zh: '极细', en: 'Thin' }),
  fontWeightExtraLight: i18n({ zh: '特细', en: 'Extra Light' }),
  fontWeightLight: i18n({ zh: '细体', en: 'Light' }),
  fontWeightRegular: i18n({ zh: '标准', en: 'Regular' }),
  fontWeightMedium: i18n({ zh: '中等', en: 'Medium' }),
  fontWeightSemiBold: i18n({ zh: '中黑', en: 'Semi Bold' }),
  fontWeightBold: i18n({ zh: '粗体', en: 'Bold' }),
  fontWeightExtraBold: i18n({ zh: '特粗', en: 'Extra Bold' }),
  fontWeightBlack: i18n({ zh: '极粗', en: 'Black' }),
  lineHeightDefault: i18n({ zh: '默认', en: 'Default' }),
  lineHeightMultiple: i18n({ zh: '倍数', en: 'Multiple' }),
  textDecorationSolid: i18n({ zh: '实线', en: 'Solid' }),
  textDecorationDotted: i18n({ zh: '点状', en: 'Dotted' }),
  textDecorationDashed: i18n({ zh: '虚线', en: 'Dashed' }),
  textDecorationDouble: i18n({ zh: '双线', en: 'Double' }),
  textDecorationWavy: i18n({ zh: '波浪', en: 'Wavy' }),
  decorationSolid: i18n({ zh: '实线', en: 'Solid' }),
  decorationDotted: i18n({ zh: '点状', en: 'Dotted' }),
  decorationDashed: i18n({ zh: '虚线', en: 'Dashed' }),
  decorationDouble: i18n({ zh: '双线', en: 'Double' }),
  decorationWavy: i18n({ zh: '波浪', en: 'Wavy' }),
  fontFamilyPlaceholderInherit: i18n({ zh: '继承', en: 'Inherit' }),
  fontFamilyPlaceholderNotSet: i18n({ zh: '未配置字体', en: 'No font set' }),
  fontFamilyInherited: i18n({ zh: '继承', en: 'Inherit' }),
  fontFamilyNotConfigured: i18n({ zh: '未配置字体', en: 'No font set' }),
  alignLeft: i18n({ zh: '居左对齐', en: 'Align left' }),
  alignCenter: i18n({ zh: '居中对齐', en: 'Align center' }),
  alignRight: i18n({ zh: '居右对齐', en: 'Align right' }),
  fontSizePlaceholder: i18n({ zh: '默认', en: 'Default' }),
  lineHeightPlaceholder: i18n({ zh: '默认', en: 'Default' }),
  letterSpacingPlaceholder: i18n({ zh: '默认', en: 'Default' }),
  fontSizeTip: i18n({ zh: '字号', en: 'Font size' }),
  lineHeightTip: i18n({ zh: '行高', en: 'Line height' }),
  letterSpacingTip: i18n({ zh: '字间距', en: 'Letter spacing' }),
  fontSizeGradeTip: i18n({ zh: '字号档位', en: 'Font size preset' }),
  boldTip: i18n({ zh: '粗体', en: 'Bold' }),
  whiteSpaceTip: i18n({ zh: '空白字符合并、换行', en: 'White space & line wrap' }),
  textWrapTip: i18n({ zh: '空白字符合并、换行', en: 'White space & line wrap' }),
  fontSettingsTip: i18n({ zh: '文字设置', en: 'Text settings' }),
  singleFont: i18n({ zh: '单字体', en: 'Single' }),
  multiFont: i18n({ zh: '多字体', en: 'Multiple' }),
  fontSingle: i18n({ zh: '单字体', en: 'Single' }),
  fontMultiple: i18n({ zh: '多字体', en: 'Multiple' }),
  fontLabel: i18n({ zh: '字体', en: 'Font' }),
  fontVariableAt: i18n({ zh: '@字体变量', en: '@Font variable' }),
  colorVariableAt: i18n({ zh: '@颜色变量', en: '@Color variable' }),
  decorationLabel: i18n({ zh: '装饰', en: 'Decoration' }),
  decorationNone: i18n({ zh: '无装饰', en: 'None' }),
  decorationUnderline: i18n({ zh: '下划线', en: 'Underline' }),
  decorationStrikethrough: i18n({ zh: '删除线', en: 'Strikethrough' }),
  decorationStyleLabel: i18n({ zh: '样式', en: 'Style' }),
  decorationStyleTip: i18n({ zh: '装饰线样式', en: 'Decoration style' }),
  decorationOffsetLabel: i18n({ zh: '偏移', en: 'Offset' }),
  decorationOffsetTip: i18n({ zh: '下划线偏移', en: 'Underline offset' }),
  underlineOffsetTip: i18n({ zh: '下划线偏移', en: 'Underline offset' }),
  decorationThicknessLabel: i18n({ zh: '粗细', en: 'Thickness' }),
  decorationThicknessTip: i18n({ zh: '装饰线粗细', en: 'Decoration thickness' }),
  decorationWeightLabel: i18n({ zh: '粗细', en: 'Thickness' }),
  decorationWeightTip: i18n({ zh: '装饰线粗细', en: 'Decoration thickness' }),
  italicLabel: i18n({ zh: '斜体', en: 'Italic' }),
  italicNone: i18n({ zh: '无斜体', en: 'None' }),
  italicOn: i18n({ zh: '斜体', en: 'Italic' }),
  textCaseLabel: i18n({ zh: '大小写', en: 'Transform' }),
  textCaseNone: i18n({ zh: '默认', en: 'None' }),
  textCaseDefault: i18n({ zh: '默认', en: 'Default' }),
  textCaseUpper: i18n({ zh: '全大写', en: 'Uppercase' }),
  textCaseLower: i18n({ zh: '全小写', en: 'Lowercase' }),
  textCaseCapitalize: i18n({ zh: '首字母大写', en: 'Capitalize' }),
  textTruncateLabel: i18n({ zh: '截断文字', en: 'Truncation' }),
  textTruncateNone: i18n({ zh: '不截断', en: 'None' }),
  textTruncateEllipsis: i18n({ zh: '省略号截断', en: 'Ellipsis' }),
  maxLinesLabel: i18n({ zh: '最大行数', en: 'Max lines' }),
  maxLinesTip: i18n({ zh: '最大行数', en: 'Max lines' }),
  dragFontSize: i18n({ zh: '拖拽调整字号', en: 'Drag to adjust font size' }),
  dragFontSizeUnbind: i18n({ zh: '拖拽调整字号（将解除变量绑定）', en: 'Drag to adjust font size (variable will be unbound)' }),
  dragLineHeight: i18n({ zh: '拖拽调整行高', en: 'Drag to adjust line height' }),
  dragLineHeightUnbind: i18n({ zh: '拖拽调整行高（将解除变量绑定）', en: 'Drag to adjust line height (variable will be unbound)' }),
  dragLetterSpacing: i18n({ zh: '拖拽调整字间距', en: 'Drag to adjust letter spacing' }),
  dragLetterSpacingUnbind: i18n({ zh: '拖拽调整字间距（将解除变量绑定）', en: 'Drag to adjust letter spacing (variable will be unbound)' }),
  applyVariableShort: i18n({ zh: '应用变量...', en: 'Apply variable...' }),
  emptyValueDefault: i18n({ zh: '默认', en: 'Default' }),

  // Layout
  layoutPanelTitle: i18n({ zh: '布局', en: 'Layout' }),
  overflowHiddenLabel: i18n({ zh: '超出容器不显示', en: 'Clip overflow' }),
  overflowHiddenTip: i18n({ zh: '开启后超出容器大小的内容将会被隐藏', en: 'Content outside the container will be hidden' }),
  inlineLabel: i18n({ zh: '内联显示', en: 'Display inline' }),
  inlineTip: i18n({ zh: '与相邻内容同行显示', en: 'Display inline with adjacent content' }),

  // Layout/Direction
  directionNone: i18n({ zh: '默认', en: 'Default' }),
  directionInline: i18n({ zh: '内联', en: 'Inline' }),
  directionColumn: i18n({ zh: '纵向排版', en: 'Vertical' }),
  directionRow: i18n({ zh: '横向排版', en: 'Horizontal' }),

  // Layout/JustifyContent
  justifyEven: i18n({ zh: '均匀', en: 'Space evenly' }),
  justifyBetween: i18n({ zh: '两端', en: 'Space between' }),
  wrapLabel: i18n({ zh: '换行', en: 'Wrap' }),

  // Layout/Gap
  columnGapLabel: i18n({ zh: '列间距', en: 'Column gap' }),
  rowGapLabel: i18n({ zh: '行间距', en: 'Row gap' }),
  dragGap: i18n({ zh: '拖拽调整', en: 'Drag to adjust' }),

  // Layout/Padding (inner)
  paddingTop: i18n({ zh: '上边距', en: 'Top' }),
  paddingRight: i18n({ zh: '右边距', en: 'Right' }),
  paddingBottom: i18n({ zh: '下边距', en: 'Bottom' }),
  paddingLeft: i18n({ zh: '左边距', en: 'Left' }),
  independentPaddingToggle: i18n({ zh: '非独立边距', en: 'Unified padding' }),
  independentPaddingToggleOff: i18n({ zh: '独立边距', en: 'Individual padding' }),

  // Margin
  marginPanelTitle: i18n({ zh: '外边距', en: 'Margin' }),
  marginUnifiedLabel: i18n({ zh: '外边距', en: 'Margin' }),
  marginUnifiedTip: i18n({ zh: '外边距', en: 'Margin' }),
  marginLeftLabel: i18n({ zh: '左外边距', en: 'Left margin' }),
  marginTopLabel: i18n({ zh: '上外边距', en: 'Top margin' }),
  marginRightLabel: i18n({ zh: '右外边距', en: 'Right margin' }),
  marginBottomLabel: i18n({ zh: '下外边距', en: 'Bottom margin' }),
  marginAutoPlaceholder: i18n({ zh: '自动', en: 'Auto' }),
  dragMarginUnified: i18n({ zh: '拖拽调整外边距', en: 'Drag to adjust margin' }),
  dragMarginUnifiedUnbind: i18n({ zh: '拖拽调整外边距（将解除变量绑定）', en: 'Drag to adjust margin (variable will be unbound)' }),
  dragMarginLeft: i18n({ zh: '拖拽调整左外边距', en: 'Drag to adjust left margin' }),
  dragMarginLeftUnbind: i18n({ zh: '拖拽调整左外边距（将解除变量绑定）', en: 'Drag to adjust left margin (variable will be unbound)' }),
  dragMarginTop: i18n({ zh: '拖拽调整上外边距', en: 'Drag to adjust top margin' }),
  dragMarginTopUnbind: i18n({ zh: '拖拽调整上外边距（将解除变量绑定）', en: 'Drag to adjust top margin (variable will be unbound)' }),
  dragMarginRight: i18n({ zh: '拖拽调整右外边距', en: 'Drag to adjust right margin' }),
  dragMarginRightUnbind: i18n({ zh: '拖拽调整右外边距（将解除变量绑定）', en: 'Drag to adjust right margin (variable will be unbound)' }),
  dragMarginBottom: i18n({ zh: '拖拽调整下外边距', en: 'Drag to adjust bottom margin' }),
  dragMarginBottomUnbind: i18n({ zh: '拖拽调整下外边距（将解除变量绑定）', en: 'Drag to adjust bottom margin (variable will be unbound)' }),

  // Padding
  paddingPanelTitle: i18n({ zh: '内边距', en: 'Padding' }),
  paddingUnifiedLabel: i18n({ zh: '内边距', en: 'Padding' }),
  paddingUnifiedTip: i18n({ zh: '内边距', en: 'Padding' }),
  paddingLeftLabel: i18n({ zh: '左内边距', en: 'Left padding' }),
  paddingTopLabel: i18n({ zh: '上内边距', en: 'Top padding' }),
  paddingRightLabel: i18n({ zh: '右内边距', en: 'Right padding' }),
  paddingBottomLabel: i18n({ zh: '下内边距', en: 'Bottom padding' }),
  dragPaddingUnified: i18n({ zh: '拖拽调整内边距', en: 'Drag to adjust padding' }),
  dragPaddingUnifiedUnbind: i18n({ zh: '拖拽调整内边距（将解除变量绑定）', en: 'Drag to adjust padding (variable will be unbound)' }),
  dragPaddingLeft: i18n({ zh: '拖拽调整左内边距', en: 'Drag to adjust left padding' }),
  dragPaddingLeftUnbind: i18n({ zh: '拖拽调整左内边距（将解除变量绑定）', en: 'Drag to adjust left padding (variable will be unbound)' }),
  dragPaddingTop: i18n({ zh: '拖拽调整上内边距', en: 'Drag to adjust top padding' }),
  dragPaddingTopUnbind: i18n({ zh: '拖拽调整上内边距（将解除变量绑定）', en: 'Drag to adjust top padding (variable will be unbound)' }),
  dragPaddingRight: i18n({ zh: '拖拽调整右内边距', en: 'Drag to adjust right padding' }),
  dragPaddingRightUnbind: i18n({ zh: '拖拽调整右内边距（将解除变量绑定）', en: 'Drag to adjust right padding (variable will be unbound)' }),
  dragPaddingBottom: i18n({ zh: '拖拽调整下内边距', en: 'Drag to adjust bottom padding' }),
  dragPaddingBottomUnbind: i18n({ zh: '拖拽调整下内边距（将解除变量绑定）', en: 'Drag to adjust bottom padding (variable will be unbound)' }),

  // OverFlow
  overflowAuto: i18n({ zh: '自动', en: 'Auto' }),
  overflowScroll: i18n({ zh: '显示滚动条', en: 'Scroll' }),
  overflowHidden: i18n({ zh: '隐藏内容', en: 'Hidden' }),
  overflowVisible: i18n({ zh: '显示内容', en: 'Visible' }),
  overflowClip: i18n({ zh: '裁剪内容', en: 'Clip' }),
  horizontal: i18n({ zh: '水平', en: 'Horizontal' }),
  vertical: i18n({ zh: '垂直', en: 'Vertical' }),
  overflowCurrentIs: i18n({ zh: '当前为', en: 'Current:' }),
  overflowSetTo: i18n({ zh: '设置为', en: 'Set to:' }),
  overflowPanelTitle: i18n({ zh: '内容溢出', en: 'Overflow' }),

  // Position
  positionPanelTitle: i18n({ zh: '位置', en: 'Position' }),
  positionDefault: i18n({ zh: '默认', en: 'Default' }),
  positionAbsolute: i18n({ zh: '自由定位', en: 'Absolute' }),
  positionTopLabel: i18n({ zh: '上', en: 'Top' }),
  positionRightLabel: i18n({ zh: '右', en: 'Right' }),
  positionBottomLabel: i18n({ zh: '下', en: 'Bottom' }),
  positionLeftLabel: i18n({ zh: '左', en: 'Left' }),
  positionDefaultPlaceholder: i18n({ zh: '默认', en: 'Default' }),
  dragPosition: i18n({ zh: '拖拽调整', en: 'Drag to adjust' }),

  // Rotation
  rotationPanelTitle: i18n({ zh: '旋转', en: 'Rotation' }),
  rotationAngleTip: i18n({ zh: '旋转角度', en: 'Rotation angle' }),
  dragRotation: i18n({ zh: '拖拽调整旋转角度', en: 'Drag to adjust rotation' }),
  rotateCW90Tip: i18n({ zh: '顺时针旋转90°', en: 'Rotate 90° clockwise' }),
  flipHorizontalTip: i18n({ zh: '水平翻转', en: 'Flip horizontal' }),
  flipVerticalTip: i18n({ zh: '垂直翻转', en: 'Flip vertical' }),

  // Size
  sizePanelTitle: i18n({ zh: '尺寸', en: 'Size' }),
  sizeDisabledTip: i18n({ zh: '由布局自动控制，修改后将改为固定值', en: 'Controlled by layout; editing will switch to a fixed value' }),
  removeMinWidth: i18n({ zh: '移除最小宽', en: 'Remove min width' }),
  removeMaxWidth: i18n({ zh: '移除最大宽', en: 'Remove max width' }),
  removeMinHeight: i18n({ zh: '移除最小高', en: 'Remove min height' }),
  removeMaxHeight: i18n({ zh: '移除最大高', en: 'Remove max height' }),
  sizeHugContent: i18n({ zh: '适应内容', en: 'Hug contents' }),
  sizeFillParent: i18n({ zh: '填满父容器', en: 'Fill container' }),
  sizeAdaptive: i18n({ zh: '适应', en: 'Hug' }),
  sizeFillBadge: i18n({ zh: '填满', en: 'Fill' }),
  widthLabel: i18n({ zh: '宽', en: 'W' }),
  heightLabel: i18n({ zh: '高', en: 'H' }),
  minLabel: i18n({ zh: '最小', en: 'Min' }),
  maxLabel: i18n({ zh: '最大', en: 'Max' }),
  minWidthTip: i18n({ zh: '最小宽度', en: 'Min width' }),
  maxWidthTip: i18n({ zh: '最大宽度', en: 'Max width' }),
  minHeightTip: i18n({ zh: '最小高度', en: 'Min height' }),
  maxHeightTip: i18n({ zh: '最大高度', en: 'Max height' }),
  widthTip: i18n({ zh: '宽', en: 'Width' }),
  heightTip: i18n({ zh: '高', en: 'Height' }),
  notConfiguredPlaceholder: i18n({ zh: '未配置', en: 'Not set' }),
  fillPlaceholder: i18n({ zh: '填满', en: 'Fill' }),
  hugPlaceholder: i18n({ zh: '适应', en: 'Hug' }),
  defaultPlaceholder: i18n({ zh: '默认', en: 'Default' }),
  fixedWidth: i18n({ zh: '固定宽', en: 'Fixed W' }),
  fixedHeight: i18n({ zh: '固定高', en: 'Fixed H' }),
  addMinLabel: i18n({ zh: '添加最小', en: 'Add min' }),
  addMaxLabel: i18n({ zh: '添加最大', en: 'Add max' }),
  normalSizeLabel: i18n({ zh: '普通宽/高', en: 'Width/Height' }),
  minSizeLabel: i18n({ zh: '最小宽/高', en: 'Min W/H' }),
  maxSizeLabel: i18n({ zh: '最大宽/高', en: 'Max W/H' }),
  lockAspectRatio: i18n({ zh: '锁定宽高比', en: 'Lock aspect ratio' }),
  unlockAspectRatio: i18n({ zh: '解锁宽高比', en: 'Unlock aspect ratio' }),
  dragWidth: i18n({ zh: '拖拽调整宽', en: 'Drag to adjust width' }),
  dragWidthUnbind: i18n({ zh: '拖拽调整宽（将解除变量绑定）', en: 'Drag to adjust width (variable will be unbound)' }),
  dragHeight: i18n({ zh: '拖拽调整高', en: 'Drag to adjust height' }),
  dragHeightUnbind: i18n({ zh: '拖拽调整高（将解除变量绑定）', en: 'Drag to adjust height (variable will be unbound)' }),
  dragMinWidth: i18n({ zh: '拖拽调整最小宽', en: 'Drag to adjust min width' }),
  dragMinWidthUnbind: i18n({ zh: '拖拽调整最小宽（将解除变量绑定）', en: 'Drag to adjust min width (variable will be unbound)' }),
  dragMaxWidth: i18n({ zh: '拖拽调整最大宽', en: 'Drag to adjust max width' }),
  dragMaxWidthUnbind: i18n({ zh: '拖拽调整最大宽（将解除变量绑定）', en: 'Drag to adjust max width (variable will be unbound)' }),
  dragMinHeight: i18n({ zh: '拖拽调整最小高', en: 'Drag to adjust min height' }),
  dragMinHeightUnbind: i18n({ zh: '拖拽调整最小高（将解除变量绑定）', en: 'Drag to adjust min height (variable will be unbound)' }),
  dragMaxHeight: i18n({ zh: '拖拽调整最大高', en: 'Drag to adjust max height' }),
  dragMaxHeightUnbind: i18n({ zh: '拖拽调整最大高（将解除变量绑定）', en: 'Drag to adjust max height (variable will be unbound)' }),
  unitLabel: i18n({ zh: '单位', en: 'Unit' }),

  // ZIndex
  toTopLabel: i18n({ zh: '置顶', en: 'Bring to front' }),
  toBottomLabel: i18n({ zh: '置底', en: 'Send to back' }),
  zIndexPanelTitle: i18n({ zh: '层级', en: 'Z-index' }),

  // ZoneTabBar / StyleEditorShell / zone-tab — pseudo labels
  hoverState: i18n({ zh: '悬浮态', en: 'Hover' }),
  focusState: i18n({ zh: '聚焦态', en: 'Focus' }),
  focusVisibleState: i18n({ zh: '键盘聚焦态', en: 'Focus visible' }),
  activeState: i18n({ zh: '激活态', en: 'Active' }),
  disabledState: i18n({ zh: '禁用态', en: 'Disabled' }),
  beforePseudo: i18n({ zh: '前缀元素', en: 'Before' }),
  afterPseudo: i18n({ zh: '后缀元素', en: 'After' }),
  focusWithinState: i18n({ zh: '后代聚焦态', en: 'Focus within' }),
  placeholderPseudo: i18n({ zh: '占位符元素', en: 'Placeholder' }),
  addStateTooltip: i18n({ zh: '为该元素添加悬浮、激活、聚焦、禁用状态下的样式', en: 'Add hover, active, focus, or disabled styles for this element' }),

  // StyleEditorShell — toolbar tips & messages
  copyStyleTip: i18n({ zh: '复制样式', en: 'Copy styles' }),
  pasteStyleTip: i18n({ zh: '粘贴样式', en: 'Paste styles' }),
  cssEditorTip: i18n({ zh: 'CSS编辑', en: 'CSS editor' }),
  collapsePanel: i18n({ zh: '收起', en: 'Collapse' }),
  expandPanel: i18n({ zh: '展开', en: 'Expand' }),
  backToVisual: i18n({ zh: '返回可视化编辑', en: 'Back to visual editor' }),
  copySuccessMsg: i18n({ zh: '复制成功', en: 'Copied' }),
  stylesCopiedMsg: i18n({ zh: '样式已复制', en: 'Styles copied' }),
  emptyStylesCopiedMsg: i18n({ zh: '已复制（当前无样式）', en: 'Copied (no styles)' }),
  copyFailedMsg: i18n({ zh: '复制失败', en: 'Copy failed' }),
  clipboardPermissionMsg: i18n({ zh: '无法读取剪切板，请检查浏览器权限', en: 'Cannot read clipboard — check browser permissions' }),
  noStyleToPasteMsg: i18n({ zh: '剪切板中没有可粘贴的样式', en: 'No styles to paste from clipboard' }),
  styleParseFailMsg: i18n({ zh: '剪切板样式无法解析', en: 'Clipboard styles could not be parsed' }),
  stylesPastedMsg: i18n({ zh: '样式已粘贴', en: 'Styles pasted' }),
  noStyleAppliedMsg: i18n({ zh: '没有可应用的样式', en: 'No styles to apply' }),
  styleUnchangedMsg: i18n({ zh: '样式未发生变化', en: 'No changes to styles' }),
  discardAllTip: i18n({ zh: '全部丢弃', en: 'Discard all' }),
  discardAllAriaLabel: i18n({ zh: '清空暂存', en: 'Clear staged changes' }),
  aiApplyTip: i18n({ zh: '交给AI应用', en: 'Apply with AI' }),
  aiApplyAriaLabel: i18n({ zh: '提交给AI修改', en: 'Submit to AI' }),
  changesCount: i18n({ zh: '处变更', en: 'change(s)' }),
  onlyCurrentZone: i18n({ zh: '只修改当前区域', en: 'Edit current zone only' }),
  syncAllZones: i18n({ zh: '同步修改使用同一套样式的全部区域', en: 'Sync all zones sharing the same styles' }),
  applyToAll: i18n({ zh: '应用至全部', en: 'Apply to all' }),
  editCurrentZoneOnly: i18n({ zh: '仅编辑选中区域', en: 'Edit selected zone only' }),
  affectedZones: i18n({ zh: '个区域', en: 'zone(s) affected' }),
  markedLabel: i18n({ zh: '(已标记)', en: '(marked)' }),
  nonDomNode: i18n({ zh: '(非dom节点)', en: '(non-DOM node)' }),
  currentDomZone: i18n({ zh: '当前dom区域', en: 'Current DOM zone' }),
}
