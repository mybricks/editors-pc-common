import { CSSProperties } from "react";
import ColorUtil from "color";
import { uuid } from "../../../../utils";
import { color2rgba } from "../../utils";
export * from "./GradientParser";
interface GradientEditorProps {
  defaultValue?: string;
  style?: CSSProperties;
  onChange?: (value: any) => void;
  onTypeChange?: (type: string) => void;
  options?: any[];
}

interface GradientStop {
  color: string;
  position: number;
  id: string;
}

const defalutGradientStops: GradientStop[] = [
  { color: "rgba(255,255,255,0)", position: 0, id: uuid() },
  { color: "rgba(255,255,255,0)", position: 50, id: uuid() },
];
type GradientType = "linear" | "radial";
type ShapeType = "ellipse" | "radial";

const gradientOptions = [
  { value: "linear", label: "线性" },
  { value: "radial", label: "径向" },
];

const shapeOptions = [
  { value: "ellipse", label: "椭圆" },
  { value: "circle", label: "圆形" },
];

function interpolateColor(
  stop1: GradientStop,
  stop2: GradientStop,
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
  colorsArray: GradientStop[],
  position: number
): string {
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
  shapeOptions,
  gradientOptions,
  interpolateColor,
  computePercentage,
};
