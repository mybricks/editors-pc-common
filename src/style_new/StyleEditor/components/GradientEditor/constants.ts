import { CSSProperties } from "react";

interface GradientEditorProps {
  defaultValue?: string;
  style?: CSSProperties;
  onChange?: (value: any) => void;
  options?: any[];
}

interface GradientStop {
  color: string;
  position: number;
}

const defalutGradientStops: GradientStop[] = [
  { color: "#ffffff", position: 0 },
  { color: "#ffffff", position: 50 },
];

export type { GradientEditorProps, GradientStop };

export { defalutGradientStops };
