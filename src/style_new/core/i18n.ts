export function i18n<T extends Record<string, Record<string, string>>>(langs: T): { [K in keyof T]: string } {
  return new Proxy(langs, {
    get(target, key) {
      const entry = target[key as keyof T]
      if (!entry) return undefined

      const type = (window as any).__lang_type__
      return (type && entry[type]) || entry.zh || 'zh not found'
    },
  }) as unknown as { [K in keyof T]: string }
}

/** 当前语言是否为中文，供需要按语言分支处理样式/布局的场景复用 */
export function isZh(): boolean {
  return (window as any).__lang_type__ === 'zh'
}