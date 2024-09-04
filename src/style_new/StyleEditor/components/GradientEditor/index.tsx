import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback,
  CSSProperties,
} from "react";

import ColorUtil from "color";

import { Slider, Tooltip } from "antd";

import { ColorEditor, InputNumber } from "../../components";
import { Panel } from "../";

import css from "./index.less";
import { Radio } from "antd";
import { AddButton } from "./icon";

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

export function GradientEditor({
  defaultValue,
  onChange,
  options = [],
}: GradientEditorProps) {
  const [gradientType, setGradientType] = useState("linear");
  const [shapeType, setShapeType] = useState("ellipse");
  const [deg, setDeg] = useState(90);
  const [stops, setStops] = useState<GradientStop[]>([
    { color: "#ffffff", position: 0 },
    { color: "#000000", position: 50 },
  ]);

  const [current, setCurrent] = useState<GradientStop>();

  useEffect(() => {
    if (defaultValue) {
      const { type, direction, stops } = parseGradient(defaultValue);
      setGradientType(type);
      if (type === "linear" && direction) {
        setDeg(parseInt(direction));
      }
      setStops(stops);
    }
  }, [defaultValue]);

  const addColor = useCallback(() => {
    // setColors([...colors, "#ffffff"]);
  }, [stops]);

  const removeColor = (index: number) => {
    if (stops.length < 2) return;
    setStops(stops.filter((_, i) => i !== index));
  };

  const handleChange = useCallback(() => {
    const colors = `(${
      gradientType === "linear" ? deg + "deg" : shapeType
    }${stops.map((stop) => `, ${stop.color} ${stop.position}%`).join("")})`;
    const newValue = `${gradientType}-gradient${colors}`;
    onChange?.(newValue);
  }, [gradientType, shapeType, deg, stops]);

  return (
    <div style={{ width: "100%" }}>
      <Panel.Content className={css.top}>
        <div className={css.radioGroup}>
          <Radio.Group
            options={[
              { value: "linear", label: "线性" },
              { value: "radial", label: "径向" },
            ]}
            buttonStyle={"solid"}
            onChange={(value) => {
              setGradientType(value.target.value);
              handleChange();
            }}
            defaultValue={gradientType}
            optionType="button"
            size="small"
          />
        </div>
        {gradientType === "linear" ? (
          <InputNumber
            tip="边框宽度"
            defaultValue={deg}
            onChange={(value) => {
              setDeg(parseInt(value));
              handleChange();
            }}
            style={{ flex: 2 }}
            type={"number"}
          />
        ) : (
          <div className={css.radioGroup}>
            <Radio.Group
              options={[
                { value: "ellipse", label: "椭圆" },
                { value: "circle", label: "圆形" },
              ]}
              buttonStyle={"solid"}
              onChange={(value) => {
                setShapeType(value.target.value);
                handleChange();
              }}
              defaultValue={shapeType}
              optionType="button"
              size="small"
            />
          </div>
        )}
        <Panel.Item style={{ flex: 1 }}>
          <AddButton />
        </Panel.Item>
      </Panel.Content>
      <div className={css.stops}>
        {stops?.length > 0 &&
          stops.map((stop, index) => {
            const { color, position } = stop;
            return (
              <Panel.Content>
                <ColorEditor
                  defaultValue={color}
                  style={{ flex: 2 }}
                  // key={color} // 可以解决排序color不更新问题但是会导致没法一直改颜色
                  onChange={(color) => {
                    setStops(
                      stops.map((stop, i) =>
                        i === index ? { ...stop, color } : stop
                      )
                    );
                    handleChange();
                  }}
                />
                <Slider
                  min={0}
                  max={100}
                  style={{ flex: 1 }}
                  value={position}
                  onChange={(position) => {
                    setStops(
                      stops.map((stop, i) =>
                        i === index ? { ...stop, position } : stop
                      )
                    );
                  }}
                  onAfterChange={(position) => {
                    handleChange();
                    // color没有更新
                    // setStops(
                    //   stops
                    //     .map((stop, i) =>
                    //       i === index ? { ...stop, position } : stop
                    //     )
                    //     .sort(
                    //       (a, b) =>
                    //         a.position && b.position && a.position - b.position
                    //     )
                    // );
                  }}
                />
              </Panel.Content>
            );
          })}
      </div>
    </div>
  );
}

// 解析颜色
function parseGradient(gradientString: string): {
  type: string;
  direction?: string;
  stops: GradientStop[];
} {
  let match;
  let direction;

  // 匹配 linear-gradient
  match = gradientString.match(/(\d+deg),\s*(.+)/);
  if (match) {
    const direction = match[1].trim();
    const type = "linear";
    return { type, direction, stops: parseStops(match[2].trim()) };
  } else {
    // 匹配 radial-gradient
    match = gradientString.match(/radial-gradient\(([^)]+)\)\s*,?\s*(.*)/);
    if (match) {
      direction = match[1];
      gradientString = match[2];
      const type = "radial";
      return { type, stops: parseStops(gradientString) };
    }
  }

  throw new Error("Invalid gradient string format.");
}

function parseStops(stopsString: string): GradientStop[] {
  const stops = [];
  const colors = stopsString.split(", ");
  let currentPercentage = 0;

  for (let i = 0; i < colors.length; i++) {
    const colorStop = colors[i].trim();
    const match = colorStop.match(/(.*)\s+(\d+)?%/);
    if (match) {
      const color = match[1];
      const position = match[2] ? parseInt(match[2], 10) : currentPercentage;
      stops.push({ color, position });
      currentPercentage = position;
    }
  }

  return stops;
}
