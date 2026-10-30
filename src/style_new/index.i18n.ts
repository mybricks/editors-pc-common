import { i18n } from "./core/i18n";

export default i18n({
  // ZoneTabBar
  commonTab: {
    zh: '常规',
    en: 'Regular',
  },

  // CssEditor
  cssEditorTitle: {
    zh: 'CSS样式编辑',
    en: 'CSS Editor',
  },
  zoomIn: {
    zh: '放大',
    en: 'Zoom in',
  },

  // ColorEditor
  inheritFallback: {
    zh: '继承',
    en: 'Inherit',
  },
  noColorConfigured: {
    zh: '未配置颜色',
    en: 'No color set',
  },
  colorInputTip: {
    zh: '支持16进制、RGB、RGBA、HSL、HSLA、var()或颜色名称',
    en: 'Supports hex, RGB, RGBA, HSL, HSLA, var(), or a color name',
  },
  gradientColorText: {
    zh: '渐变色',
    en: 'Gradient',
  },
  backgroundImageText: {
    zh: '背景图',
    en: 'Image',
  },
  unbind: {
    zh: '解除绑定',
    en: 'Unbind',
  },
  colorVariable: {
    zh: '@颜色变量',
    en: '@Color variable',
  },

  // Colorpicker
  close: {
    zh: '关闭',
    en: 'Close',
  },
  fillTab: {
    zh: '填充',
    en: 'Solid',
  },
  gradientTab: {
    zh: '渐变',
    en: 'Gradient',
  },
  imageTab: {
    zh: '图片',
    en: 'Image',
  },
  variableTab: {
    zh: '变量',
    en: 'Variable',
  },
  noColorVariables: {
    zh: '当前画布没有可用的颜色变量',
    en: 'No color variables available on this canvas',
  },

  // DropDown (font)
  removeFontTip: {
    zh: '移除该字体',
    en: 'Remove font',
  },
  dragReorderTip: {
    zh: '拖拽调整顺序',
    en: 'Drag to reorder',
  },
  selectedFonts: {
    zh: '已选字体',
    en: 'Selected fonts',
  },
  fontPriorityTip: {
    zh: '字体优先级从上到下递减',
    en: 'Font priority decreases from top to bottom',
  },
  moreFonts: {
    zh: '更多字体',
    en: 'More fonts',
  },

  // GradientEditor
  linearGradient: {
    zh: '线性',
    en: 'Linear',
  },
  radialGradient: {
    zh: '径向',
    en: 'Radial',
  },
  ellipseShape: {
    zh: '椭圆',
    en: 'Ellipse',
  },
  circleShape: {
    zh: '圆形',
    en: 'Circle',
  },

  // GradientEditor
  gradientTypeTip: {
    zh: '渐变类型',
    en: 'Gradient type',
  },
  gradientAngleTip: {
    zh: '渐变线方向角度',
    en: 'Gradient angle',
  },
  anglePrefixTip: {
    zh: '角度',
    en: 'Angle',
  },
  radialShapeTip: {
    zh: '辐射形状',
    en: 'Radial shape',
  },
  stopPositionTip: {
    zh: '停靠位置',
    en: 'Stop position',
  },

  // Gradient component
  gradientColorTip: {
    zh: '渐变颜色',
    en: 'Gradient color',
  },
  resetTip: {
    zh: '重置',
    en: 'Reset',
  },
  gradientTypeSuffix: {
    zh: '颜色渐变',
    en: 'gradient',
  },

  // ImagePanel
  imageUrlLabel: {
    zh: '图片链接',
    en: 'Image url',
  },
  imageSizeLabel: {
    zh: '大小',
    en: 'Size',
  },
  imageRepeatLabel: {
    zh: '平铺',
    en: 'Repeat',
  },
  imagePositionLabel: {
    zh: '位置',
    en: 'Position',
  },
  imageAlt: {
    zh: '图片',
    en: 'Image',
  },
  imageAltBg: {
    zh: '背景图片',
    en: 'Background image',
  },
  clickToUpload: {
    zh: '点击上传',
    en: 'Click to upload',
  },

  // ImageFit
  imageFitPanelTitle: { zh: '图片适配', en: 'Image fit' },
  imageFitLabel: { zh: '模式', en: 'Mode' },
  imageFitAlignLabel: { zh: '对齐', en: 'Alignment' },
  imageStyleDefault: { zh: '默认', en: 'Default' },
  imageFitFill: { zh: '拉伸填满', en: 'Stretch' },
  imageFitContain: { zh: '完整显示', en: 'Contain' },
  imageFitCover: { zh: '铺满裁切', en: 'Cover' },
  imageFitNone: { zh: '原始尺寸', en: 'Original size' },
  imageFitScaleDown: { zh: '只缩不放', en: 'Scale down' },
  imagePositionTopLeft: { zh: '左上', en: 'Top left' },
  imagePositionTop: { zh: '上中', en: 'Top' },
  imagePositionTopRight: { zh: '右上', en: 'Top right' },
  imagePositionLeft: { zh: '左中', en: 'Left' },
  imagePositionCenter: { zh: '居中', en: 'Center' },
  imagePositionRight: { zh: '右中', en: 'Right' },
  imagePositionBottomLeft: { zh: '左下', en: 'Bottom left' },
  imagePositionBottom: { zh: '下中', en: 'Bottom' },
  imagePositionBottomRight: { zh: '右下', en: 'Bottom right' },

  // Image size options
  imgSizeCover: {
    zh: '填充（无留白）',
    en: 'Cover (no whitespace)',
  },
  imgSizeContain: {
    zh: '适应（有留白）',
    en: 'Contain (with whitespace)',
  },
  imgSizeStretch: {
    zh: '拉伸',
    en: 'Stretch',
  },
  imgSizeOriginal: {
    zh: '原始大小',
    en: 'Original size',
  },
  imgSizeDefault: {
    zh: '默认',
    en: 'Default',
  },
  imgSizeFit: {
    zh: '适应',
    en: 'Contain',
  },
  imgSizeFill: {
    zh: '填充',
    en: 'Cover',
  },
  imgSizeTile: {
    zh: '铺满',
    en: 'Fill',
  },
  imgSizeTileX: {
    zh: '铺满x轴',
    en: 'Fill X-axis',
  },
  imgSizeTileY: {
    zh: '铺满y轴',
    en: 'Fill Y-axis',
  },

  // Image repeat options
  imgRepeatOn: {
    zh: '平铺',
    en: 'Repeat',
  },
  imgRepeatOff: {
    zh: '不平铺',
    en: 'No repeat',
  },

  // Image position options
  imgPosTop: {
    zh: '居上',
    en: 'Top',
  },
  imgPosCenter: {
    zh: '居中',
    en: 'Center',
  },
  imgPosBottom: {
    zh: '居下',
    en: 'Bottom',
  },
  imgPosLeft: {
    zh: '居左',
    en: 'Left',
  },
  imgPosRight: {
    zh: '居右',
    en: 'Right',
  },
  imgPosTopLeft: {
    zh: '左上',
    en: 'Top left',
  },
  imgPosBottomLeft: {
    zh: '左下',
    en: 'Bottom left',
  },
  imgPosTopRight: {
    zh: '右上',
    en: 'Top right',
  },
  imgPosBottomRight: {
    zh: '右下',
    en: 'Bottom right',
  },

  // ClearButton
  clearLabel: {
    zh: '清空',
    en: 'Clear',
  },

  // InputNumber
  defaultLabel: {
    zh: '默认',
    en: 'Default',
  },
  settingsTip: {
    zh: '设置',
    en: 'Settings',
  },
  unitTip: {
    zh: '单位',
    en: 'Unit',
  },

  // Popup
  cancelBtn: {
    zh: '取消',
    en: 'Cancel',
  },
  confirmBtn: {
    zh: '确定',
    en: 'OK',
  },

  // Slider / VariableNumberInput / VariableChip
  applyVariableTip: {
    zh: '应用变量...',
    en: 'Apply variable...',
  },
  variablePrefix: {
    zh: '变量：',
    en: 'Variable: ',
  },
  replaceVariable: {
    zh: '替换变量...',
    en: 'Replace variable...',
  },
  fixedValuePrefix: {
    zh: '固定值',
    en: 'Fixed value',
  },

  // VariableList
  searchPlaceholder: {
    zh: '搜索',
    en: 'Search',
  },
  noVariables: {
    zh: '当前画布没有可用变量',
    en: 'No variables available on this canvas',
  },
  allLibraries: {
    zh: '全部库',
    en: 'All libraries',
  },
  designVariables: {
    zh: '自定义库',
    en: 'Custom library',
  },
  designVariablesTip: {
    zh: '通过业务空间配置的自定义设计变量',
    en: 'Custom design variables configured through the business space',
  },
  otherVariables: {
    zh: '其它库',
    en: 'Other libraries',
  },
  noSizeVariables: {
    zh: '当前画布没有可用的尺寸变量',
    en: 'No size variables available on this canvas',
  },
  noOpacityVariables: {
    zh: '当前画布没有可用的不透明度变量',
    en: 'No opacity variables available on this canvas',
  },

  // Appearance
  opacityPanelTitle: {
    zh: '不透明度',
    en: 'Opacity',
  },
  dragOpacity: {
    zh: '拖拽调整不透明度',
    en: 'Drag to adjust opacity',
  },
  dragOpacityUnbind: {
    zh: '拖拽调整不透明度（将解除变量绑定）',
    en: 'Drag to adjust opacity (variable will be unbound)',
  },
  fixedValueOpacity: {
    zh: '固定值',
    en: 'Fixed value',
  },

  // Background
  imageLayerLabel: {
    zh: '图片',
    en: 'Image',
  },
  gradientLayerLabel: {
    zh: '渐变',
    en: 'Gradient',
  },
  solidLayerLabel: {
    zh: '纯色',
    en: 'Solid color',
  },
  fillPanelTitle: {
    zh: '填充',
    en: 'Fill',
  },
  dragOpacityShort: {
    zh: '拖拽调整不透明度',
    en: 'Drag to adjust opacity',
  },

  // Border
  noBorder: {
    zh: '无',
    en: 'None',
  },
  solidLine: {
    zh: '实线',
    en: 'Solid',
  },
  dashedLine: {
    zh: '虚线',
    en: 'Dashed',
  },
  borderOutside: {
    zh: '外部',
    en: 'Outside',
  },
  borderCenter: {
    zh: '居中',
    en: 'Center',
  },
  borderInside: {
    zh: '内部',
    en: 'Inside',
  },
  defaultOption: {
    zh: '默认',
    en: 'Default',
  },
  lineStyleTip: {
    zh: '线条样式',
    en: 'Border style',
  },
  borderWidthTip: {
    zh: '边框宽度',
    en: 'Border width',
  },
  leftBorderWidthTip: {
    zh: '左边框宽度',
    en: 'Left border width',
  },
  topBorderWidthTip: {
    zh: '上边框宽度',
    en: 'Top border width',
  },
  rightBorderWidthTip: {
    zh: '右边框宽度',
    en: 'Right border width',
  },
  bottomBorderWidthTip: {
    zh: '下边框宽度',
    en: 'Bottom border width',
  },
  dragBorderWidthTip: {
    zh: '拖拽调整边框宽度',
    en: 'Drag to adjust border width',
  },
  dragLeftBorderWidthTip: {
    zh: '拖拽调整左边框宽度',
    en: 'Drag to adjust left border width',
  },
  dragTopBorderWidthTip: {
    zh: '拖拽调整上边框宽度',
    en: 'Drag to adjust top border width',
  },
  dragRightBorderWidthTip: {
    zh: '拖拽调整右边框宽度',
    en: 'Drag to adjust right border width',
  },
  dragBottomBorderWidthTip: {
    zh: '拖拽调整下边框宽度',
    en: 'Drag to adjust bottom border width',
  },
  borderPositionTitle: {
    zh: '边框位置',
    en: 'Border position',
  },
  borderPositionLabel: {
    zh: '位置',
    en: 'Position',
  },
  borderPositionTip: {
    zh: '边框位置设置',
    en: 'Border position',
  },
  borderPanelTitle: {
    zh: '边框',
    en: 'Border',
  },
  deleteBorderTip: {
    zh: '删除边框',
    en: 'Remove border',
  },
  toggleSplitTip: {
    zh: '切换为单独配置',
    en: 'Switch to individual sides',
  },
  toggleUnifiedTip: {
    zh: '切换为统一配置',
    en: 'Switch to unified',
  },
  computedValueTip: {
    zh: '当前未配置，为计算值',
    en: 'Not configured, showing computed value',
  },

  // Border-Radius
  radiusPanelTitle: {
    zh: '圆角',
    en: 'Corner Radius',
  },
  radiusTip: {
    zh: '圆角半径',
    en: 'Border radius',
  },
  topLeftRadiusTip: {
    zh: '左上角半径',
    en: 'Top-left radius',
  },
  topRightRadiusTip: {
    zh: '右上角半径',
    en: 'Top-right radius',
  },
  bottomRightRadiusTip: {
    zh: '右下角半径',
    en: 'Bottom-right radius',
  },
  bottomLeftRadiusTip: {
    zh: '左下角半径',
    en: 'Bottom-left radius',
  },
  topLeftRadiusLabel: {
    zh: '左上圆角',
    en: 'Top-left',
  },
  topRightRadiusLabel: {
    zh: '右上圆角',
    en: 'Top-right',
  },
  bottomLeftRadiusLabel: {
    zh: '左下圆角',
    en: 'Bottom-left',
  },
  bottomRightRadiusLabel: {
    zh: '右下圆角',
    en: 'Bottom-right',
  },
  mixedPlaceholder: {
    zh: '混合',
    en: 'Mixed',
  },
  toggleEditModeTip: {
    zh: '切换编辑方式',
    en: 'Toggle edit mode',
  },
  dragRadiusUnbind: {
    zh: '将解除变量绑定',
    en: 'variable will be unbound',
  },
  dragAdjust: {
    zh: '拖拽调整',
    en: 'Drag to adjust',
  },

  // CSSPaste
  appliedStylesCount: {
    zh: '条样式',
    en: 'styles applied',
  },
  alreadyApplied: {
    zh: '已应用',
    en: 'Applied',
  },
  applyStyles: {
    zh: '应用样式',
    en: 'Apply styles',
  },

  // Cursor
  cursorHelp: { zh: '帮助', en: 'Help' },
  cursorPointer: { zh: '手', en: 'Pointer' },
  cursorText: { zh: '文本可选中', en: 'Text' },
  cursorNotAllowed: { zh: '不可点击', en: 'Not allowed' },
  cursorDefault: { zh: '箭头', en: 'Default' },
  cursorCustom: { zh: '自定义', en: 'Custom' },
  cursorPanelTitle: { zh: '光标', en: 'Cursor' },

  // Effects
  dropShadowLabel: { zh: '外阴影', en: 'Drop shadow' },
  innerShadowLabel: { zh: '内阴影', en: 'Inner shadow' },
  textShadowLabel: { zh: '文字阴影', en: 'Text shadow' },
  layerBlurLabel: { zh: '图层模糊', en: 'Layer blur' },
  backgroundBlurLabel: { zh: '背景模糊', en: 'Background blur' },
  shadowBlurPanelTitle: { zh: '阴影与模糊', en: 'Shadow & Blur' },
  editEffectTip: { zh: '点击编辑效果', en: 'Click to edit' },
  closeEffectTip: { zh: '关闭', en: 'Close' },
  positionLabel: { zh: '位置', en: 'Offset' },
  blurLabel: { zh: '模糊', en: 'Blur' },
  spreadLabel: { zh: '扩散', en: 'Spread' },
  colorLabel: { zh: '颜色', en: 'Color' },
  presetLabel: { zh: '预设', en: 'Presets' },
  shadowPresetAriaLabel: { zh: '阴影预设', en: 'shadow preset' },
  dragBlurTip: { zh: '拖拽调整模糊半径', en: 'Drag to adjust blur radius' },
  dragSpreadTip: { zh: '拖拽调整扩散半径', en: 'Drag to adjust spread radius' },
  dragOffsetXTip: { zh: '拖拽调整x轴偏移', en: 'Drag to adjust X offset' },
  dragOffsetYTip: { zh: '拖拽调整y轴偏移', en: 'Drag to adjust Y offset' },
  shadowPresetSubtle: { zh: '轻微', en: 'Subtle' },
  shadowPresetSoft: { zh: '适中', en: 'Soft' },
  shadowPresetFloating: { zh: '明显', en: 'Floating' },
  shadowPresetStrong: { zh: '强烈', en: 'Strong' },
  dragUnbindSuffix: { zh: '（将解除变量绑定）', en: ' (variable will be unbound)' },

  // Flex
  flexPanelTitle: { zh: '弹性', en: 'Flex' },
  flexAutoFill: { zh: '自动填充父级的剩余空间，多个元素按比例分配', en: 'Auto-fill remaining space in parent element by setting the ratio to 1 ' },
  flexRatioLabel: { zh: '比例', en: 'Ratio' },
  flexRatioTip: { zh: '父级为横向/纵向排列时，决定本元素占多少剩余空间。填 1 表示参与均分；多个子项分别填 1 和 2 时按 1:2 分配。清空则不弹性拉伸。', en: 'When parent is row/column, determines how much remaining space this element takes. 1 = equal share; 1 and 2 → 1:2 ratio. Leave empty to disable flex stretch.' },
  flexSplitTip: { zh: '切换为单独配置（增长 / 收缩 / 基础长度）', en: 'Switch to individual (grow / shrink / basis)' },
  flexUnifiedTip: { zh: '切换为统一配置（比例）', en: 'Switch to unified (ratio)' },
  flexGrowLabel: { zh: '增长系数', en: 'Grow' },
  flexGrowTip: { zh: '空间有多余时，按该数值比例放大。常用 1；填 0 表示不放大。', en: 'When there is extra space, scale up by this factor. Use 1 for equal grow; 0 to disable.' },
  flexShrinkLabel: { zh: '收缩系数', en: 'Shrink' },
  flexShrinkTip: { zh: '空间不够时，按该数值比例缩小。常用 1；填 0 表示不缩小。', en: 'When space is insufficient, shrink by this factor. Use 1 for equal shrink; 0 to disable.' },
  flexBasisLabel: { zh: '基础长度', en: 'Basis' },
  flexBasisTip: { zh: '分配剩余空间前的初始尺寸。填 0 表示尺寸完全由比例决定；也可填具体长度，如 100px、50%。留空时按元素自身尺寸或内容计算。', en: 'Initial size before distributing remaining space. 0 means size is entirely ratio-driven; or specify a length like 100px / 50%. Leave empty to use natural size.' },
  flexDefaultPlaceholder: { zh: '默认', en: 'Default' },
  styleSourceNotReady: { zh: '样式来源尚未就绪，暂不能删除', en: 'Style source not ready, cannot delete yet' },

  // Font
  fontPanelTitle: { zh: '字体', en: 'Typography' },
  fontFamilyTip: { zh: '字体', en: 'Font Family' },
  fontWeight100: { zh: '极细', en: 'Thin' },
  fontWeight200: { zh: '特细', en: 'Extra Light' },
  fontWeight300: { zh: '细体', en: 'Light' },
  fontWeight400: { zh: '标准', en: 'Regular' },
  fontWeight500: { zh: '中等', en: 'Medium' },
  fontWeight600: { zh: '中黑', en: 'Semi Bold' },
  fontWeight700: { zh: '粗体', en: 'Bold' },
  fontWeight800: { zh: '特粗', en: 'Extra Bold' },
  fontWeight900: { zh: '极粗', en: 'Black' },
  fontWeightThin: { zh: '极细', en: 'Thin' },
  fontWeightExtraLight: { zh: '特细', en: 'Extra Light' },
  fontWeightLight: { zh: '细体', en: 'Light' },
  fontWeightRegular: { zh: '标准', en: 'Regular' },
  fontWeightMedium: { zh: '中等', en: 'Medium' },
  fontWeightSemiBold: { zh: '中黑', en: 'Semi Bold' },
  fontWeightBold: { zh: '粗体', en: 'Bold' },
  fontWeightExtraBold: { zh: '特粗', en: 'Extra Bold' },
  fontWeightBlack: { zh: '极粗', en: 'Black' },
  lineHeightDefault: { zh: '默认', en: 'Default' },
  lineHeightMultiple: { zh: '倍数', en: 'Multiple' },
  textDecorationSolid: { zh: '实线', en: 'Solid' },
  textDecorationDotted: { zh: '点状', en: 'Dotted' },
  textDecorationDashed: { zh: '虚线', en: 'Dashed' },
  textDecorationDouble: { zh: '双线', en: 'Double' },
  textDecorationWavy: { zh: '波浪', en: 'Wavy' },
  decorationSolid: { zh: '实线', en: 'Solid' },
  decorationDotted: { zh: '点状', en: 'Dotted' },
  decorationDashed: { zh: '虚线', en: 'Dashed' },
  decorationDouble: { zh: '双线', en: 'Double' },
  decorationWavy: { zh: '波浪', en: 'Wavy' },
  fontFamilyPlaceholderInherit: { zh: '继承', en: 'Inherit' },
  fontFamilyPlaceholderNotSet: { zh: '未配置字体', en: 'No font set' },
  fontFamilyInherited: { zh: '继承', en: 'Inherit' },
  fontFamilyNotConfigured: { zh: '未配置字体', en: 'No font set' },
  alignLeft: { zh: '居左对齐', en: 'Align left' },
  alignCenter: { zh: '居中对齐', en: 'Align center' },
  alignRight: { zh: '居右对齐', en: 'Align right' },
  fontSizePlaceholder: { zh: '默认', en: 'Default' },
  lineHeightPlaceholder: { zh: '默认', en: 'Default' },
  letterSpacingPlaceholder: { zh: '默认', en: 'Default' },
  fontSizeTip: { zh: '字号', en: 'Font size' },
  lineHeightTip: { zh: '行高', en: 'Line height' },
  letterSpacingTip: { zh: '字间距', en: 'Letter spacing' },
  fontSizeGradeTip: { zh: '字号档位', en: 'Font size preset' },
  boldTip: { zh: '粗体', en: 'Bold' },
  whiteSpaceTip: { zh: '空白字符合并、换行', en: 'White space & line wrap' },
  textWrapTip: { zh: '空白字符合并、换行', en: 'White space & line wrap' },
  fontSettingsTip: { zh: '更多', en: 'More' },
  singleFont: { zh: '单字体', en: 'Single' },
  multiFont: { zh: '多字体', en: 'Multiple' },
  fontSingle: { zh: '单字体', en: 'Single' },
  fontMultiple: { zh: '多字体', en: 'Multiple' },
  fontLabel: { zh: '字体', en: 'Font' },
  fontVariableAt: { zh: '@字体变量', en: '@Font variable' },
  colorVariableAt: { zh: '@颜色变量', en: '@Color variable' },
  decorationLabel: { zh: '装饰', en: 'Decoration' },
  decorationNone: { zh: '无装饰', en: 'None' },
  decorationUnderline: { zh: '下划线', en: 'Underline' },
  decorationStrikethrough: { zh: '删除线', en: 'Strikethrough' },
  decorationStyleLabel: { zh: '样式', en: 'Style' },
  decorationStyleTip: { zh: '装饰线样式', en: 'Decoration style' },
  decorationOffsetLabel: { zh: '偏移', en: 'Offset' },
  decorationOffsetTip: { zh: '下划线偏移', en: 'Underline offset' },
  underlineOffsetTip: { zh: '下划线偏移', en: 'Underline offset' },
  decorationThicknessLabel: { zh: '粗细', en: 'Thickness' },
  decorationThicknessTip: { zh: '装饰线粗细', en: 'Decoration thickness' },
  decorationWeightLabel: { zh: '粗细', en: 'Thickness' },
  decorationWeightTip: { zh: '装饰线粗细', en: 'Decoration thickness' },
  italicLabel: { zh: '斜体', en: 'Italic' },
  italicNone: { zh: '无斜体', en: 'None' },
  italicOn: { zh: '斜体', en: 'Italic' },
  textCaseLabel: { zh: '大小写', en: 'Case' },
  textCaseNone: { zh: '默认', en: 'None' },
  textCaseDefault: { zh: '默认', en: 'Default' },
  textCaseUpper: { zh: '全大写', en: 'Uppercase' },
  textCaseLower: { zh: '全小写', en: 'Lowercase' },
  textCaseCapitalize: { zh: '首字母大写', en: 'Capitalize' },
  textTruncateLabel: { zh: '截断', en: 'Truncation' },
  textTruncateNone: { zh: '不截断', en: 'None' },
  textTruncateEllipsis: { zh: '省略号截断', en: 'Ellipsis' },
  maxLinesLabel: { zh: '最大行数', en: 'Max lines' },
  maxLinesTip: { zh: '最大行数', en: 'Max lines' },
  textWrapLabel: { zh: '换行', en: 'Wrap' },
  textWrapNormal: { zh: '自动换行', en: 'Auto wrap' },
  textWrapNowrap: { zh: '不换行', en: 'No wrap' },
  textWrapPreWrap: { zh: '保留文本中间或开头的空格，并进行自动换行', en: 'Keeps spaces at the start or within text, and wraps automatically' },
  dragFontSize: { zh: '拖拽调整字号', en: 'Drag to adjust font size' },
  dragFontSizeUnbind: { zh: '拖拽调整字号（将解除变量绑定）', en: 'Drag to adjust font size (variable will be unbound)' },
  dragLineHeight: { zh: '拖拽调整行高', en: 'Drag to adjust line height' },
  dragLineHeightUnbind: { zh: '拖拽调整行高（将解除变量绑定）', en: 'Drag to adjust line height (variable will be unbound)' },
  dragLetterSpacing: { zh: '拖拽调整字间距', en: 'Drag to adjust letter spacing' },
  dragLetterSpacingUnbind: { zh: '拖拽调整字间距（将解除变量绑定）', en: 'Drag to adjust letter spacing (variable will be unbound)' },
  applyVariableShort: { zh: '应用变量...', en: 'Apply variable...' },
  emptyValueDefault: { zh: '默认', en: 'Default' },

  // Layout
  layoutPanelTitle: { zh: '布局', en: 'Layout' },
  overflowHiddenLabel: { zh: '超出容器不显示', en: 'Clip content' },
  overflowHiddenTip: { zh: '开启后超出容器大小的内容将会被隐藏', en: 'Hide content outside the element' },
  inlineLabel: { zh: '内联显示', en: 'Display inline' },
  inlineTip: { zh: '与相邻内容同行显示', en: 'Display inline with adjacent content' },

  // Layout/Direction
  directionNone: { zh: '默认', en: 'Default' },
  directionInline: { zh: '内联', en: 'Inline' },
  directionColumn: { zh: '纵向排版', en: 'Vertical' },
  directionRow: { zh: '横向排版', en: 'Horizontal' },
  directionFreedom: { zh: '自由布局', en: 'Free layout' },

  // Layout/JustifyContent
  justifyEven: { zh: '均匀', en: 'Space evenly' },
  justifyBetween: { zh: '两端', en: 'Space between' },
  wrapLabel: { zh: '换行', en: 'Wrap' },

  // Layout/Gap
  columnGapLabel: { zh: '列间距', en: 'Column gap' },
  rowGapLabel: { zh: '行间距', en: 'Row gap' },
  dragGap: { zh: '拖拽调整', en: 'Drag to adjust' },

  // Layout/Padding
  paddingTop: { zh: '上边距', en: 'Top' },
  paddingRight: { zh: '右边距', en: 'Right' },
  paddingBottom: { zh: '下边距', en: 'Bottom' },
  paddingLeft: { zh: '左边距', en: 'Left' },
  independentPaddingToggle: { zh: '非独立边距', en: 'Unified padding' },
  independentPaddingToggleOff: { zh: '独立边距', en: 'Individual padding' },

  // Margin
  marginPanelTitle: { zh: '外边距', en: 'Margin' },
  marginUnifiedLabel: { zh: '外边距', en: 'Margin' },
  marginUnifiedTip: { zh: '外边距', en: 'Margin' },
  marginLeftLabel: { zh: '左外边距', en: 'Left margin' },
  marginTopLabel: { zh: '上外边距', en: 'Top margin' },
  marginRightLabel: { zh: '右外边距', en: 'Right margin' },
  marginBottomLabel: { zh: '下外边距', en: 'Bottom margin' },
  marginAutoPlaceholder: { zh: '自动', en: 'Auto' },
  dragMarginUnified: { zh: '拖拽调整外边距', en: 'Drag to adjust margin' },
  dragMarginUnifiedUnbind: { zh: '拖拽调整外边距（将解除变量绑定）', en: 'Drag to adjust margin (variable will be unbound)' },
  dragMarginLeft: { zh: '拖拽调整左外边距', en: 'Drag to adjust left margin' },
  dragMarginLeftUnbind: { zh: '拖拽调整左外边距（将解除变量绑定）', en: 'Drag to adjust left margin (variable will be unbound)' },
  dragMarginTop: { zh: '拖拽调整上外边距', en: 'Drag to adjust top margin' },
  dragMarginTopUnbind: { zh: '拖拽调整上外边距（将解除变量绑定）', en: 'Drag to adjust top margin (variable will be unbound)' },
  dragMarginRight: { zh: '拖拽调整右外边距', en: 'Drag to adjust right margin' },
  dragMarginRightUnbind: { zh: '拖拽调整右外边距（将解除变量绑定）', en: 'Drag to adjust right margin (variable will be unbound)' },
  dragMarginBottom: { zh: '拖拽调整下外边距', en: 'Drag to adjust bottom margin' },
  dragMarginBottomUnbind: { zh: '拖拽调整下外边距（将解除变量绑定）', en: 'Drag to adjust bottom margin (variable will be unbound)' },

  // Padding
  paddingPanelTitle: { zh: '内边距', en: 'Padding' },
  paddingUnifiedLabel: { zh: '内边距', en: 'Padding' },
  paddingUnifiedTip: { zh: '内边距', en: 'Padding' },
  paddingLeftLabel: { zh: '左内边距', en: 'Left padding' },
  paddingTopLabel: { zh: '上内边距', en: 'Top padding' },
  paddingRightLabel: { zh: '右内边距', en: 'Right padding' },
  paddingBottomLabel: { zh: '下内边距', en: 'Bottom padding' },
  dragPaddingUnified: { zh: '拖拽调整内边距', en: 'Drag to adjust padding' },
  dragPaddingUnifiedUnbind: { zh: '拖拽调整内边距（将解除变量绑定）', en: 'Drag to adjust padding (variable will be unbound)' },
  dragPaddingLeft: { zh: '拖拽调整左内边距', en: 'Drag to adjust left padding' },
  dragPaddingLeftUnbind: { zh: '拖拽调整左内边距（将解除变量绑定）', en: 'Drag to adjust left padding (variable will be unbound)' },
  dragPaddingTop: { zh: '拖拽调整上内边距', en: 'Drag to adjust top padding' },
  dragPaddingTopUnbind: { zh: '拖拽调整上内边距（将解除变量绑定）', en: 'Drag to adjust top padding (variable will be unbound)' },
  dragPaddingRight: { zh: '拖拽调整右内边距', en: 'Drag to adjust right padding' },
  dragPaddingRightUnbind: { zh: '拖拽调整右内边距（将解除变量绑定）', en: 'Drag to adjust right padding (variable will be unbound)' },
  dragPaddingBottom: { zh: '拖拽调整下内边距', en: 'Drag to adjust bottom padding' },
  dragPaddingBottomUnbind: { zh: '拖拽调整下内边距（将解除变量绑定）', en: 'Drag to adjust bottom padding (variable will be unbound)' },

  // OverFlow
  overflowAuto: { zh: '自动', en: 'Auto' },
  overflowScroll: { zh: '显示滚动条', en: 'Scroll' },
  overflowHidden: { zh: '隐藏', en: 'Hidden' },
  overflowVisible: { zh: '显示', en: 'Visible' },
  overflowClip: { zh: '裁剪', en: 'Clip' },
  horizontal: { zh: '水平', en: 'Horizontal' },
  vertical: { zh: '垂直', en: 'Vertical' },
  overflowCurrentIs: { zh: '当前为', en: 'Current:' },
  overflowSetTo: { zh: '设置为', en: 'Set to:' },
  overflowPanelTitle: { zh: '内容溢出', en: 'Overflow' },

  // Position
  positionPanelTitle: { zh: '位置', en: 'Position' },
  positionDefault: { zh: '默认', en: 'Default' },
  positionAbsolute: { zh: '自由定位', en: 'Absolute' },
  positionTopLabel: { zh: '上', en: 'Top' },
  positionRightLabel: { zh: '右', en: 'Right' },
  positionBottomLabel: { zh: '下', en: 'Bottom' },
  positionLeftLabel: { zh: '左', en: 'Left' },
  positionDefaultPlaceholder: { zh: '默认', en: 'Default' },
  positionTopTip: { zh: '相对顶部定位', en: 'Position relative to top' },
  positionRightTip: { zh: '相对右侧定位', en: 'Position relative to right' },
  positionBottomTip: { zh: '相对底部定位', en: 'Position relative to bottom' },
  positionLeftTip: { zh: '相对左侧定位', en: 'Position relative to left' },
  dragPosition: { zh: '拖拽调整', en: 'Drag to adjust' },

  // Rotation
  rotationPanelTitle: { zh: '旋转', en: 'Rotation' },
  rotationAngleTip: { zh: '旋转角度', en: 'Rotation angle' },
  dragRotation: { zh: '拖拽调整旋转角度', en: 'Drag to adjust rotation' },
  rotateCW90Tip: { zh: '顺时针旋转90°', en: 'Rotate 90° clockwise' },
  flipHorizontalTip: { zh: '水平翻转', en: 'Flip horizontal' },
  flipVerticalTip: { zh: '垂直翻转', en: 'Flip vertical' },

  // Size
  sizePanelTitle: { zh: '尺寸', en: 'Dimensions' },
  sizeDisabledTip: { zh: '由布局自动控制，修改后将改为固定值', en: 'Controlled by layout; editing will switch to a fixed value' },
  removeMinWidth: { zh: '移除最小宽', en: 'Remove min width' },
  removeMaxWidth: { zh: '移除最大宽', en: 'Remove max width' },
  removeMinHeight: { zh: '移除最小高', en: 'Remove min height' },
  removeMaxHeight: { zh: '移除最大高', en: 'Remove max height' },
  sizeHugContent: { zh: '适应内容', en: 'Hug contents' },
  sizeFillParent: { zh: '填满父容器', en: 'Fill container' },
  sizeAdaptive: { zh: '适应', en: 'Hug' },
  sizeFillBadge: { zh: '填满', en: 'Fill' },
  widthLabel: { zh: '宽', en: 'W' },
  heightLabel: { zh: '高', en: 'H' },
  minLabel: { zh: '最小', en: 'Min' },
  maxLabel: { zh: '最大', en: 'Max' },
  minWidthTip: { zh: '最小宽度', en: 'Min width' },
  maxWidthTip: { zh: '最大宽度', en: 'Max width' },
  minHeightTip: { zh: '最小高度', en: 'Min height' },
  maxHeightTip: { zh: '最大高度', en: 'Max height' },
  widthTip: { zh: '宽', en: 'Width' },
  heightTip: { zh: '高', en: 'Height' },
  notConfiguredPlaceholder: { zh: '未配置', en: 'Not set' },
  fillPlaceholder: { zh: '填满', en: 'Fill' },
  hugPlaceholder: { zh: '适应', en: 'Hug' },
  defaultPlaceholder: { zh: '默认', en: 'Default' },
  fixedWidth: { zh: '固定宽', en: 'Fixed W' },
  fixedHeight: { zh: '固定高', en: 'Fixed H' },
  addMinLabel: { zh: '添加最小', en: 'Add min' },
  addMaxLabel: { zh: '添加最大', en: 'Add max' },
  addMinWidthLabel: { zh: '添加最小宽...', en: 'Add min width...' },
  addMaxWidthLabel: { zh: '添加最大宽...', en: 'Add max width...' },
  addMinHeightLabel: { zh: '添加最小高...', en: 'Add min height...' },
  addMaxHeightLabel: { zh: '添加最大高...', en: 'Add max height...' },
  normalSizeLabel: { zh: '普通宽/高', en: 'Width/Height' },
  minSizeLabel: { zh: '最小宽/高', en: 'Min W/H' },
  maxSizeLabel: { zh: '最大宽/高', en: 'Max W/H' },
  lockAspectRatio: { zh: '锁定宽高比', en: 'Lock aspect ratio' },
  unlockAspectRatio: { zh: '解锁宽高比', en: 'Unlock aspect ratio' },
  dragWidth: { zh: '拖拽调整宽', en: 'Drag to adjust width' },
  dragWidthUnbind: { zh: '拖拽调整宽（将解除变量绑定）', en: 'Drag to adjust width (variable will be unbound)' },
  dragHeight: { zh: '拖拽调整高', en: 'Drag to adjust height' },
  dragHeightUnbind: { zh: '拖拽调整高（将解除变量绑定）', en: 'Drag to adjust height (variable will be unbound)' },
  dragMinWidth: { zh: '拖拽调整最小宽', en: 'Drag to adjust min width' },
  dragMinWidthUnbind: { zh: '拖拽调整最小宽（将解除变量绑定）', en: 'Drag to adjust min width (variable will be unbound)' },
  dragMaxWidth: { zh: '拖拽调整最大宽', en: 'Drag to adjust max width' },
  dragMaxWidthUnbind: { zh: '拖拽调整最大宽（将解除变量绑定）', en: 'Drag to adjust max width (variable will be unbound)' },
  dragMinHeight: { zh: '拖拽调整最小高', en: 'Drag to adjust min height' },
  dragMinHeightUnbind: { zh: '拖拽调整最小高（将解除变量绑定）', en: 'Drag to adjust min height (variable will be unbound)' },
  dragMaxHeight: { zh: '拖拽调整最大高', en: 'Drag to adjust max height' },
  dragMaxHeightUnbind: { zh: '拖拽调整最大高（将解除变量绑定）', en: 'Drag to adjust max height (variable will be unbound)' },
  unitLabel: { zh: '单位', en: 'Unit' },

  // ZIndex
  toTopLabel: { zh: '置顶', en: 'Front' },
  toBottomLabel: { zh: '置底', en: 'Back' },
  zIndexPanelTitle: { zh: '层级', en: 'Layer' },

  // ZoneTabBar
  hoverState: { zh: '悬浮态', en: 'Hover' },
  focusState: { zh: '聚焦态', en: 'Focus' },
  focusVisibleState: { zh: '键盘聚焦态', en: 'Focus visible' },
  activeState: { zh: '激活态', en: 'Active' },
  disabledState: { zh: '禁用态', en: 'Disabled' },
  beforePseudo: { zh: '前缀元素', en: 'Before' },
  afterPseudo: { zh: '后缀元素', en: 'After' },
  commonStyleTip: { zh: '元素常规状态下的样式', en: 'Styles for the element in its default state' },
  hoverStateTip: { zh: '元素鼠标悬浮状态下的样式', en: 'Styles applied when the mouse hovers over the element' },
  focusStateTip: { zh: '元素获得焦点时的样式', en: 'Styles applied when the element is focused' },
  focusVisibleStateTip: { zh: '元素键盘导航聚焦时的样式', en: 'Styles applied when the element is focused via keyboard navigation' },
  focusWithinStateTip: { zh: '元素后代获得焦点时的样式', en: 'Styles applied when a descendant element is focused' },
  activeStateTip: { zh: '元素被点击激活时的样式', en: 'Styles applied while the element is being clicked' },
  disabledStateTip: { zh: '元素禁用状态下的样式', en: 'Styles applied when the element is disabled' },
  checkedStateTip: { zh: '元素被选中时的样式', en: 'Styles applied when the element is checked' },
  placeholderShownStateTip: { zh: '元素显示占位符文字时的样式', en: 'Styles applied when placeholder text is visible' },
  beforePseudoTip: { zh: '元素前方插入的装饰内容的样式', en: 'Styles for the decorative content inserted before the element' },
  afterPseudoTip: { zh: '元素后方插入的装饰内容的样式', en: 'Styles for the decorative content inserted after the element' },
  placeholderPseudoTip: { zh: '元素输入框占位符文字的样式', en: 'Styles for the placeholder text inside the input' },
  pseudoElementTip: { zh: '伪元素', en: 'Pseudo-element' },
  pseudoClassTip: { zh: '伪类', en: 'Pseudo-class' },
  focusWithinState: { zh: '后代聚焦态', en: 'Focus within' },
  placeholderPseudo: { zh: '占位符元素', en: 'Placeholder' },
  addStateTooltip: { zh: '为该元素添加悬浮、激活、聚焦、禁用状态下的样式', en: 'Add hover, active, focus, or disabled styles for this element' },
  addStateLabel: { zh: '添加状态', en: 'Add state' },
  commonStyleLabel: { zh: '常规样式', en: 'Regular style' },
  deleteLabel: { zh: '删除', en: 'Delete' },
  moreActionsLabel: { zh: '更多操作', en: 'More actions' },

  // StyleEditorShell
  copyStyleTip: { zh: '复制样式', en: 'Copy styles' },
  pasteStyleTip: { zh: '粘贴样式', en: 'Paste styles' },
  cssEditorTip: { zh: 'CSS编辑', en: 'CSS editor' },
  collapsePanel: { zh: '收起', en: 'Collapse' },
  expandPanel: { zh: '展开', en: 'Expand' },
  backToVisual: { zh: '返回可视化编辑', en: 'Back to visual editor' },
  copySuccessMsg: { zh: '复制成功', en: 'Copied' },
  stylesCopiedMsg: { zh: '样式已复制', en: 'Styles copied' },
  emptyStylesCopiedMsg: { zh: '已复制（当前无样式）', en: 'Copied (no styles)' },
  copyFailedMsg: { zh: '复制失败', en: 'Copy failed' },
  clipboardPermissionMsg: { zh: '无法读取剪切板，请检查浏览器权限', en: 'Cannot read clipboard — check browser permissions' },
  noStyleToPasteMsg: { zh: '剪切板中没有可粘贴的样式', en: 'No styles to paste from clipboard' },
  styleParseFailMsg: { zh: '剪切板样式无法解析', en: 'Clipboard styles could not be parsed' },
  stylesPastedMsg: { zh: '样式已粘贴', en: 'Styles pasted' },
  noStyleAppliedMsg: { zh: '没有可应用的样式', en: 'No styles to apply' },
  styleUnchangedMsg: { zh: '样式未发生变化', en: 'No changes to styles' },
  discardAllTip: { zh: '全部丢弃', en: 'Discard all' },
  discardAllAriaLabel: { zh: '清空暂存', en: 'Clear staged changes' },
  aiApplyTip: { zh: '交给AI应用', en: 'Apply with AI' },
  aiApplyAriaLabel: { zh: '提交给AI修改', en: 'Submit to AI' },
  changesCount: { zh: '处变更', en: 'change(s)' },
  onlyCurrentZone: { zh: '只修改当前区域', en: 'Edit current zone only' },
  syncAllZones: { zh: '同步修改使用同一套样式的全部区域', en: 'Sync all zones that share the same styles' },
  applyToAll: { zh: '应用至全部', en: 'Apply to all' },
  editCurrentZoneOnly: { zh: '仅编辑选中区域', en: 'selected zone only' },
  affectedZones: { zh: '个区域', en: 'zone(s)' },
  affectedLabel: { zh: '影响', en: 'Affects' },
  markedLabel: { zh: '(已标记)', en: '(marked)' },
  nonDomNode: { zh: '(非dom节点)', en: '(non-DOM node)' },
  currentDomZone: { zh: '当前dom区域', en: 'Current DOM zone' },

  // CSS syntax error messages
  cssMissingColon: { zh: 'CSS 声明缺少冒号', en: 'CSS declaration is missing a colon' },
  cssInvalidPropertyName: { zh: '无效的 CSS 属性名', en: 'Invalid CSS property name' },
  cssEmptyPlaceholder: { zh: '(空)', en: '(empty)' },
  cssMissingValue: { zh: '缺少属性值', en: 'is missing a value' },
  cssMissingSemicolon: { zh: 'CSS 声明之间可能缺少分号', en: 'A semicolon may be missing between CSS declarations' },
  cssUnclosedString: { zh: 'CSS 字符串未闭合', en: 'Unclosed CSS string' },
  cssUnclosedComment: { zh: 'CSS 注释未闭合', en: 'Unclosed CSS comment' },
  cssUnclosedParen: { zh: 'CSS 函数括号未闭合', en: 'Unclosed CSS function parenthesis' },
  cssUnclosedBracket: { zh: 'CSS 方括号未闭合', en: 'Unclosed CSS bracket' },
  cssExtraCloseParen: { zh: '存在多余的右括号', en: 'Extra closing parenthesis' },
  cssExtraCloseBracket: { zh: '存在多余的右方括号', en: 'Extra closing bracket' },
  cssNoNestedRules: { zh: '样式规则内不支持嵌套规则', en: 'Nested rules are not supported inside a style rule' },
  cssOnlySingleRule: { zh: '仅支持编辑单条 CSS 规则', en: 'Only a single CSS rule can be edited' },
  cssExtraCloseBrace: { zh: '存在多余的右花括号', en: 'Extra closing brace' },
  cssMissingOpenBrace: { zh: 'CSS 规则缺少左花括号', en: 'CSS rule is missing an opening brace' },
  cssMissingCloseBrace: { zh: 'CSS 规则缺少右花括号', en: 'CSS rule is missing a closing brace' },
  cssMissingSelector: { zh: 'CSS 规则缺少选择器', en: 'CSS rule is missing a selector' },
  cssExtraContentAfterBrace: { zh: '右花括号后存在多余内容', en: 'Unexpected content after closing brace' },

  // figma export
  copyToFigma: { zh: '复制到 Figma', en: 'Copy to Figma' },
  selectPageFirst: { zh: '请先选择页面', en: 'Select a page first' },
  copyNPagesToFigma: { zh: '复制 {n} 个页面到 Figma', en: 'Copy {n} page(s) to Figma' },
  copyAllPagesToFigma: { zh: '复制全部页面到 Figma', en: 'Copy all pages to Figma' },
  enableVariantMapping: { zh: '开启变体库映射', en: 'Enable variant mapping' },
  disableVariantMapping: { zh: '关闭变体库映射', en: 'Disable variant mapping' },
  figmaReading: { zh: '读取中…', en: 'Reading…' },
  syncStyleFromFigma: { zh: '从 Figma 同步样式', en: 'Sync styles from Figma' },
  figmaSyncSuccess: { zh: '成功从Figma同步{n}条样式改动', en: 'Synced {n} style change(s) from Figma' },
  figmaParsedCandidates: { zh: '已解析{n}条候选样式，{m}条组件变体', en: 'Parsed {n} candidate style(s), {m} component variant(s)' },
  figmaNoNodeParsed: { zh: '未解析到可同步节点（图层名需为单个 class，如 myCard）', en: 'No syncable node found (layer name must be a single class, e.g. myCard)' },
  figmaDecodeDone: { zh: '已解码完成', en: 'Decoded' },
  selectAllLabel: { zh: '全选', en: 'Select all' },
  selectPageToExportTip: { zh: '选择要导出的页面', en: 'Select pages to export' },
  unnamedPage: { zh: '未命名页面', en: 'Unnamed page' },
  copyGeneratedFigmaData: { zh: '复制已生成的 Figma 数据', en: 'Copy generated Figma data' },

  // useExportToFigma
  figmaPreparing: { zh: '准备中...', en: 'Preparing...' },
  figmaNoPageFound: { zh: '未找到可复制的页面，请聚焦到一个页面后重试', en: 'No exportable page found, please focus on a page and try again' },
  figmaParsingPageStructure: { zh: '解析页面结构...', en: 'Parsing page structure...' },
  figmaBuildingDomModel: { zh: '构建 DOM 模型...', en: 'Building DOM model...' },
  figmaNoValidFrameInCanvasList: { zh: 'canvasList 中未找到任何有效帧', en: 'No valid frame found in canvasList' },
  figmaCopiedPagesName: { zh: '复制的 {n} 个页面', en: 'Copied {n} page(s)' },
  figmaFetchingImageResources: { zh: '拉取图片资源 ({done}/{total})...', en: 'Fetching image resources ({done}/{total})...' },
  figmaFetchImageResourcesDone: { zh: '拉取图片资源完成', en: 'Image resources fetched' },
  figmaLoadingFonts: { zh: '加载字体（{fonts}）...', en: 'Loading fonts ({fonts})...' },
  figmaGeneratingData: { zh: '生成 Figma 数据...', en: 'Generating Figma data...' },
  figmaWritingClipboard: { zh: '写入剪贴板...', en: 'Writing to clipboard...' },
  figmaDone: { zh: '完成', en: 'Done' },
  figmaCopiedPastePrompt: { zh: '已复制，请前往 Figma 直接 Cmd+V / Ctrl+V 粘贴', en: 'Copied, please go to Figma and paste with Cmd+V / Ctrl+V' },
  figmaDataReadyClickToCopy: { zh: '数据已就绪，点击按钮复制', en: 'Data is ready, click the button to copy' },
  figmaClickToCopyManuallyTip: { zh: '请点击「复制已生成的 Figma 数据」按钮，在 Figma 中 Ctrl+V 进行粘贴', en: 'Please click the "Copy generated Figma data" button, then paste in Figma with Ctrl+V' },
  figmaExportFailed: { zh: '导出失败: {error}', en: 'Export failed: {error}' },
  figmaUnknownError: { zh: '未知错误', en: 'Unknown error' },
  figmaCopyFailedNotFocused: { zh: '复制失败：请先点击页面聚焦后再重试', en: 'Copy failed: please click the page to focus and try again' },
  figmaCopyFailed: { zh: '复制失败: {error}', en: 'Copy failed: {error}' },

  // read-clipboard
  figmaClipboardReadUnsupported: { zh: '当前环境不支持读取剪贴板', en: 'Reading clipboard is not supported in this environment' },
  figmaClipboardNoDataDetected: { zh: '剪贴板中未检测到 Figma 数据，请在 Figma 内选中节点后使用 Ctrl/Cmd+C 复制', en: 'No Figma data detected in clipboard. Please select a node in Figma and copy it with Ctrl/Cmd+C' },
})
