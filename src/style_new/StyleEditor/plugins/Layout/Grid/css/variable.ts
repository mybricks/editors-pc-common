import { parseCssVar, resolveCssVar } from '../../../../../core/css-var';

/** 整轴变量保留原始单位与比例，值的支持范围继续由 Grid 解析器判断。 */
export function resolveGridVariable(source: string, target: Element): string | null {
  if (!parseCssVar(source)) return null;
  // 先按 CSS 变量规则取值，再判断能否编辑；已定义但不支持的值不能误用 fallback。
  return resolveCssVar(source, target, () => true);
}
