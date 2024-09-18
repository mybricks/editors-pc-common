export const ExtractBackground = (
  css: string,
  type: "all" | "image" | "gradient" = "all"
) => {
  // 正则表达式，匹配 url(), linear-gradient() 和 radial-gradient()
  const regex =
    /((linear|radial)-gradient\((?:[^()]+|\([^()]*\))*\)|url\(['"]?[^)'"]+['"]?\))/gi;

  // 执行匹配
  const matches = css?.match(regex);

  // 如果没有匹配到任何内容，返回空数组
  if (!css || !matches) {
    return [];
  }

  // 过滤结果，根据类型返回对应的值
  const filtered = matches.filter((match: string) => {
    switch (type) {
      case "image":
        return /url\(/.test(match);
      case "gradient":
        return /linear-gradient\(|\b-radial-gradient\(/.test(match);
      default:
        return true; // 如果没有指定类型，返回所有匹配项
    }
  });

  // 返回指定类型的值，如果没有指定类型，则返回所有匹配项
  return filtered.map((match: string) => match.trim());
};