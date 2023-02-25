import {AnyMap, SelectOptions} from './types';

// font-family选择项
export const FontFamilyOptions: SelectOptions = [
  {label: '默认', value: ''},
  {
    label: 'system-ui',
    value:
      "system-ui, -apple-system, BlinkMacSystemFont, 'PingFang SC', miui, Roboto, Helvetica Neue, Helvetica, sans-serif",
  },
  {label: 'din', value: 'DIN'},
  {label: 'AvenirNext', value: 'AvenirNext, AvenirNext-BoldItalic'},
];

// font-weight选择项
export const FontWeightOptions: SelectOptions = [
  {label: '极细', value: '100'},
  {label: '特细', value: '200'},
  {label: '细', value: '300'},
  {label: '标准', value: '400'},
  {label: '中黑', value: '500'},
  {label: '中粗', value: '700'},
  {label: '特粗', value: '900'},
  // { label: '100', value: '100' },
  // { label: '200', value: '200' },
  // { label: '300', value: '300' },
  // { label: '400', value: '400' },
  // { label: '500', value: '500' },
  // { label: '600', value: '600' },
  // { label: '700', value: '700' },
  // { label: '800', value: '800' },
  // { label: '900', value: '900' },
  // {label: 'bold', value: 'bold'},
  // {label: 'bolder', value: 'bolder'},
  // {label: 'lighter', value: 'lighter'},
  // {label: 'normal', value: 'normal'}
];

// font-style选择项
export const FontStyleOptions: SelectOptions = [
  {label: '默认', value: 'normal'},
  {label: '斜体', value: 'italic'}
];

export const TextDecoratioin: SelectOptions = [
  {label: '默认', value: 'normal'},
  {label: '下划线', value: 'underline'},
  {label: '上划线', value: 'overline'},
  {label: '中划线', value: 'line-through'},
  // {label: '闪烁', value: 'blink'},
];

// border-style选择项
export const BorderStyleOptions: SelectOptions = [
  {label: '实线', value: 'solid'},
  {label: '虚线', value: 'dashed'},
  {label: '无', value: 'none'},
  // {label: 'hidden', value: 'hidden'},
  // {label: 'dotted', value: 'dotted'},
  // {label: 'double', value: 'double'},
  // {label: 'groove', value: 'groove'},
  // {label: 'ridge', value: 'ridge'},
  // {label: 'inset', value: 'inset'},
  // {label: 'outset', value: 'outset'}
];

// background-size选择项
export const BackgroundSizeOptions: SelectOptions = [
  {label: '适应', value: 'contain'},
  {label: '填充', value: 'cover'},
  {label: '铺满', value: '100% 100%'},
  {label: '铺满x轴', value: '100% auto'},
  {label: '铺满y轴', value: 'auto 100%'},
];

// background-repeat选择项
export const BackgroundRepeatOptions: SelectOptions = [
  {label: '平铺', value: 'repeat'},
  {label: '不平铺', value: 'no-repeat'},
];

// background-position选择项
export const BackgroundPositionOptions: SelectOptions = [
  {label: '居上', value: 'center top'},
  {label: '居中', value: 'center center'},
  {label: '居下', value: 'center bottom'},
  {label: '居左', value: 'left center'},
  {label: '居右', value: 'right center'},
  {label: '左上', value: 'left top'},
  {label: '左下', value: 'left bottom'},
  {label: '右上', value: 'right top'},
  {label: '右下', value: 'right bottom'},
];

// 默认配色
export const presetColors: Array<string> = [
  'rgb(245, 34, 45)',
  'rgb(250, 84, 28)',
  'rgb(250, 140, 22)',
  'rgb(250, 173, 20)',
  'rgb(250, 219, 20)',
  'rgb(160, 217, 17)',
  'rgb(82, 196, 26)',
  'rgb(19, 194, 194)',
  'rgb(24, 144, 255)',
  'rgb(47, 84, 235)',
  'rgb(114, 46, 209)',
  'rgb(235, 47, 150)',
  'rgb(255, 77, 79)',
  'rgb(255, 122, 69)',
  'rgb(255, 169, 64)',
  'rgb(255, 197, 61)',
  'rgb(255, 236, 61)',
  'rgb(186, 230, 55)',
  'rgb(115, 209, 61)',
  'rgb(54, 207, 201)',
  'rgb(64, 169, 255)',
  'rgb(89, 126, 247)',
  'rgb(255 255 255)',
  'rgba(255, 255, 255, 0)',
];

export const OptionsMap = {
  fontStyle: FontStyleOptions,
  textDecoration: TextDecoratioin,
  fontWeight: FontWeightOptions,
  fontFamily: FontFamilyOptions,
  borderStyle: BorderStyleOptions,
  backgroundSize: BackgroundSizeOptions,
  backgroundRepeat: BackgroundRepeatOptions,
  backgroundPosition: BackgroundPositionOptions,
};

// 默认宽高样式
export const DefaultSize = {
  width: '100%',
  height: '100%',
};

// 默认高样式
export const DefaultHeight = {
  height: '100%',
};

// 默认宽样式
export const DefaultWidth = {
  width: '100%',
};

// 默认字体样式
export const DefaultFont: AnyMap = {
  lineHeight: '14px',
  letterSpacing: '0px',
  fontSize: '14px',
  fontWeight: 400,
  color: '#222222',
  fontStyle: 'normal',
  fontFamily: '',
};

// 默认边框样式
export const DefaultBorder: AnyMap = {
  borderWidth: '0px',
  borderRadius: '0px',
  borderStyle: 'solid',
  borderColor: '#ffffff',
};

// 背景默认样式 包括背景色、背景图
export const DefaultBg: AnyMap = {
  background: 'url() center top / 100% 100% no-repeat, transparent',
};

// 背景图片默认样式
export const DefaultBgImage: AnyMap = {
  backgroundImage: 'url()',
  backgroundSize: '100% 100%',
  backgroundPosition: 'center top',
  backgroundRepeat: 'no-repeat',
};

// 内间距默认样式
export const DefaultPadding: AnyMap = {
  paddingTop: '0px',
  paddingBottom: '0px',
  paddingLeft: '0px',
  paddingRight: '0px',
};

export const DefaultBoxShaodw: AnyMap = {
  boxShadow: '0px 0px 0px 0px #000000',
};

export const DefaultTextShaodw: AnyMap = {
  boxShadow: '0px 0px 0px #000000',
};

export const DefaultConfigMap: { [key: string]: AnyMap } = {
  SIZE: DefaultSize,
  WIDTH: DefaultWidth,
  HEIGHT: DefaultHeight,
  FONT: DefaultFont,
  BORDER: DefaultBorder,
  BGCOLOR: DefaultBg,
  BGIMAGE: DefaultBg,
  PADDING: DefaultPadding,
  SHADOW: DefaultBoxShaodw,
  TEXTSHADOW: DefaultTextShaodw,
};

export const Sequence: Array<string> = [
  'PADDING',
  'SIZE',
  // 'WIDTH',
  // 'HEIGHT',
  'FONT',
  'ALIGN',
  'TEXTSHADOW',
  'BORDER',
  'BGCOLOR',
  'BGIMAGE',
  'SHADOW',
];

export const TitleMap: { [key: string]: string } = {
  SIZE: '尺寸',
  PADDING: '内间距',
  // 'WIDTH': '宽',
  // 'HEIGHT': '高',
  FONT: '字体',
  ALIGN: '对齐',
  BORDER: '边框',
  BGCOLOR: '背景色',
  BGIMAGE: '背景图',
  SHADOW: '阴影',
  TEXTSHADOW: '文字阴影',
};
