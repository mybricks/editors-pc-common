export function i18n(langs: Record<string, string>) {
  const type = (window as any).__lang_type__;
  if (type && langs[type]) {
    return langs[type] || `${type} not found`;
  }

  return langs['en'] || 'en not found'
}