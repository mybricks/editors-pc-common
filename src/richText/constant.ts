export const tinymceCDN = 'https://ali2.a.kwimgs.com/udata/pkg/eshop/fangzhou/pub/pkg/tinymce/5.7.1/tinymce.min.js';

const langCDN = 'https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/pub/pkg/tinymce/5.7.1/zh_CN.js';

const plugins = ['table', 'link', 'uploadimage', 'paste', 'full', 'nonbreaking', 'lists', 'wordcount'];

const simpleToolBar = ['formatselect bullist numlist full', 'forecolor backcolor bold italic strikethrough hr'];

const fullToolBar =
  'undo redo formatselect fontsizeselect bold italic underline strikethrough removeformat forecolor backcolor bullist numlist alignleft aligncenter alignright uploadimage link table hr full';

export const baseConfig = {
  language: 'zh_CN',
  placeholder: '请在此输入内容',
  block_formats: '标题 1=h1; 标题 2=h2; 标题 3=h3; 标题 4=h4; 正文(大)=h5; 正文=p;',
  // skin: 'custom',
  fontsize_formats: '10px 12px 14px 16px 18px 20px 24px 28px 36px',
  contextmenu: '',
  menubar: false,
  branding: false,
  statusbar: false,
  plugins,
  toolbar,
  language_url: langCDN,
};

export const defaultCss =
  'body {color: #666666; font-size:14px; line-height: 1.6; margin: 0; padding: 10px;}' +
  'h1 {color: #222222; font-size:28px;font-weight: 600; line-height: 1.4; margin: 12px 0; text-align:center}' +
  'h2 {color: #252525; font-size:24px;font-weight: 500; margin: 8px 0;}' +
  'h3 {color: #252525; font-size:20px;font-weight: 500; font-weight:500; margin: 6px 0;}' +
  'h4 {color: #252525; font-size:18px;font-weight: 500; font-weight:500; margin: 4px 0;}' +
  'h5 {color: #666666; font-size:16px;font-weight:400; margin: 4px 0;}' +
  'p {color: #666666; font-size:14px; line-height: 1.6; margin: 4px 0;}' +
  'ul {display: block; list-style-type: disc; padding-inline-start: 20px; margin: 4px 0;}' +
  'ol {display: block; list-style-type: decimal; padding-inline-start: 20px; margin: 4px 0;}' +
  'li {display: list-item;}';

export const simpleConfig = { ...baseConfig, height: 500, plugins, toolbar: simpleToolBar };

export const fullConfig = { ...baseConfig, height: '100%', plugins, toolbar: fullToolBar };
