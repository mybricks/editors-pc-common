import { CSSProperties } from "react";
import ColorUtil from "color";
import { uuid } from "../../../../utils";
import { color2rgba } from "../../utils";
import type { CssVarColorOption } from "../../../core/resolve-css-var-color";
import lang from "../../../index.i18n";
export * from "./GradientParser";
interface GradientEditorProps {
  defaultValue?: string;
  style?: CSSProperties;
  onChange?: (value: any) => void;
  onTypeChange?: (type: string) => void;
  /** 当前画布可选的 CSS 颜色变量（用于色标回显） */
  variableOptions?: CssVarColorOption[];
  /** 画布目标节点：解析 CSS 变量作用域 */
  scopeEl?: Element | null;
  [k: string]: any;
}

interface GradientStop {
  color: string;
  /** null 表示由 CSS 自动分配位置，不能当作显式的 0%。 */
  position: number | null;
  id: string;
}

type ResolvedGradientStop = GradientStop & { position: number };

// 仅为预览、拖拽和颜色插值计算位置，不回填到用户配置。
function resolveGradientStops(stops: GradientStop[]): ResolvedGradientStop[] {
  if (!stops.length) return [];
  const positions = stops.map((stop) => stop.position);
  positions[0] = positions[0] ?? 0;
  const lastIndex = positions.length - 1;
  positions[lastIndex] = positions[lastIndex] ?? 100;

  let previousPosition = positions[0]!;
  for (let index = 1; index < positions.length; index++) {
    const position = positions[index];
    if (position !== null) {
      positions[index] = previousPosition = Math.max(previousPosition, position);
    }
  }

  let start = 0;
  for (let end = 1; end < positions.length; end++) {
    if (positions[end] === null) continue;
    for (let index = start + 1; index < end; index++) {
      positions[index] = positions[start]! +
        (positions[end]! - positions[start]!) * (index - start) / (end - start);
    }
    start = end;
  }
  return stops.map((stop, index) => ({ ...stop, position: positions[index]! }));
}

function sortGradientStops(stops: GradientStop[]): GradientStop[] {
  const resolved = resolveGradientStops(stops);
  return stops.map((stop, index) => ({
    stop, position: stop.position ?? resolved[index].position,
  })).sort((a, b) => a.position - b.position).map(({ stop }) => stop);
}

const defalutGradientStops: GradientStop[] = [
  { color: "rgba(255,255,255,0)", position: 0, id: uuid() },
  { color: "rgba(255,255,255,0)", position: 50, id: uuid() },
];
type GradientType = "linear-gradient" | "radial-gradient";
type ShapeType = "ellipse" | "radial";

function getGradientOptions() {
  return [
    { value: "linear-gradient", label: lang.linearGradient },
    { value: "radial-gradient", label: lang.radialGradient },
  ];
}

function getShapeOptions() {
  return [
    { value: "ellipse", label: lang.ellipseShape },
    { value: "circle", label: lang.circleShape },
  ];
}

function interpolateColor(
  stop1: ResolvedGradientStop,
  stop2: ResolvedGradientStop,
  targetPosition: number
): string {
  const { color: color1Hex, position: position1 } = stop1;
  const { color: color2Hex, position: position2 } = stop2;
  if (!color1Hex || !color2Hex) {
    return "rgba(255,255,255,1)";
  }
  // 将颜色转换为 RGB 数组
  // @ts-ignore
  const color1RGB = ColorUtil(color1Hex).color;
  // @ts-ignore
  const color2RGB = ColorUtil(color2Hex).color;

  const scale = (targetPosition - position1) / (position2 - position1);

  // 计算目标颜色的 RGB 值
  const r = color1RGB[0] + (color2RGB[0] - color1RGB[0]) * scale;
  const g = color1RGB[1] + (color2RGB[1] - color1RGB[1]) * scale;
  const b = color1RGB[2] + (color2RGB[2] - color1RGB[2]) * scale;

  // 将 RGB 值转换回十六进制表示
  const targetColorHex = color2rgba(ColorUtil({ r, g, b }).hexa());
  return targetColorHex;
}
function findColorByPosition(
  stops: GradientStop[],
  position: number
): string {
  const colorsArray = resolveGradientStops(stops);
  // 检查位置是否在数组范围内
  if (position < colorsArray[0].position) {
    return colorsArray[0].color;
  } else if (position > colorsArray[colorsArray.length - 1].position) {
    return colorsArray[colorsArray.length - 1].color;
  } else {
    // 查找最接近给定位置的颜色
    let closestColorIndex = 0;
    let minDistance = Math.abs(position - colorsArray[0].position);
    for (let i = 1; i < colorsArray.length; i++) {
      const distance = Math.abs(position - colorsArray[i].position);
      if (distance < minDistance) {
        minDistance = distance;
        closestColorIndex = i;
      }
    }
    return interpolateColor(
      colorsArray[closestColorIndex - 1],
      colorsArray[closestColorIndex],
      position
    );
  }
}

// 计算位置百分比的函数，确保值在0到100之间
const computePercentage = (position: number) => {
  // 确保 position 的值在 0 到 100 之间，并四舍五入到最近的整数
  return Math.round(Math.min(Math.max(position, 0), 100));
};

export type { GradientEditorProps, GradientStop, GradientType, ShapeType };

export {
  defalutGradientStops,
  findColorByPosition,
  getShapeOptions,
  getGradientOptions,
  interpolateColor,
  computePercentage,
  resolveGradientStops,
  sortGradientStops,
};
