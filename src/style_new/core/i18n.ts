export function i18n(langs: Record<string, string>) {
  const type = (window as any).__lang_type__;
  if (type && langs[type]) {
    return langs[type] || `${type} not found`;
  }

  return langs['zh'] || 'zh not found'
}

/** 当前语言是否为中文，供需要按语言分支处理样式/布局的场景复用 */
export function isZh(): boolean {
  return (window as any).__lang_type__ === 'zh'
}