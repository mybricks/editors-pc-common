/** 比较写入和 CSSOM 回读的值，避免 rgba/rgb、空格等格式差异触发编辑器重建。 */
export function normalizeCssValue(property: string, value: string): string {
  const style = document.createElement('span').style;
  style.setProperty(property, value);
  return style.getPropertyValue(property) || value;
}
