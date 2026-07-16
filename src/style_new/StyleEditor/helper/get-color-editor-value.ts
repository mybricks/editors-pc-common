/**
 * 从 ColorEditor / Colorpicker 的 onChange payload 中取出当前填充值。
 * 支持 string | { key, value } | Array<{ key, value }>。
 */
export const getColorEditorValue = (input: any): string | undefined => {
  if (typeof input === 'string') {
    return input;
  }
  if (Array.isArray(input)) {
    const backgroundImage = input.find(
      (item) => item.key === 'backgroundImage' && item.value !== 'none'
    );
    const backgroundColor = input.find((item) => item.key === 'backgroundColor');
    return backgroundImage?.value || backgroundColor?.value;
  }
  return input?.value;
};
