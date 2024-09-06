import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";

import { ColorEditor, InputNumber, Panel } from "../index";

import css from "./index.less";
import { Radio } from "antd";
import { AddButton, MinusButton } from "./icon";
import {
  ShapeType,
  GradientType,
  GradientStop,
  parseGradient,
  GradientEditorProps,
  defalutGradientStops,
  findColorByPosition,
} from "./constants";

export function GradientEditor({
  defaultValue,
  onChange,
  options = [],
}: GradientEditorProps) {
  const [gradientType, setGradientType] = useState<GradientType>("linear");
  const [shapeType, setShapeType] = useState<ShapeType>("ellipse");
  const [deg, setDeg] = useState(90);
  const [stops, setStops] = useState<GradientStop[]>(
    options || defalutGradientStops
  );
  const [activeStopPosition, setActiveStopPosition] = useState<number>(-1);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultValue) {
      const { type, direction, stops } = parseGradient(defaultValue);
      setGradientType(type);
      if (type === "linear" && direction) {
        setDeg(parseInt(direction));
      } else if (direction) {
        setShapeType(direction as ShapeType);
      }
      if (stops.length > 0) {
        setStops(stopSort(stops));
      }
    }
  }, [defaultValue]);

  const stopSort = useCallback((arr: GradientStop[]) => {
    return arr.sort(
      (a, b) => a.position && b.position && a.position - b.position
    );
  }, []);

  const addColor = useCallback(() => {
    const { color = "#ffffff", position = 50 } = stops[stops.length - 1] || {};
    setStops([
      ...stops,
      {
        // 可以继续对齐figma
        color: color,
        position: position + 1 <= 100 ? position + 1 : 100,
      },
    ]);
    handleChange();
  }, [stops]);

  const removeColor = useCallback(
    (index: number) => {
      if (stops.length < 2) return;
      setStops(stops.filter((_, i) => i !== index));
      handleChange();
    },
    [stops]
  );

  const finalValue = useMemo(() => {
    const colors = `(${
      gradientType === "linear" ? deg + "deg" : shapeType
    }${stops.map((stop) => `, ${stop.color} ${stop.position}%`).join("")})`;
    const newValue = `${gradientType}-gradient${colors}`;
    return newValue;
  }, [gradientType, deg, shapeType, stops]);

  const handleChange = useCallback(() => {
    if (onChange) {
      onChange(finalValue);
    }
  }, [finalValue, gradientType, deg, shapeType, stops]);

  const changeProperty = useCallback(
    (property: string, value: any, index: number, isSort = false) => {
      setStops((prevStops) => {
        const temp = prevStops.map((stop, i) =>
          i === index ? { ...stop, [property]: value } : stop
        );
        return isSort ? stopSort(temp) : temp;
      });
      handleChange();
    },
    [onChange, finalValue, stops]
  );

  const changeGradientType = useCallback(
    (value: GradientType) => {
      setGradientType(value);
      handleChange();
    },
    [onChange, handleChange]
  );
  const changeShapeType = useCallback(
    (value: ShapeType) => {
      setShapeType(value);
      handleChange();
    },
    [onChange, handleChange]
  );

  const handlePreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const position = Math.floor((x / rect.width) * 100);
    const color =
      gradientType === "linear"
        ? findColorByPosition(stops, position) || "#ffffff"
        : "#ffffff";
    const newStop = { color, position };
    setStops((prevStops) => {
      prevStops.push(newStop);
      return stopSort(prevStops);
    });
    setActiveStopPosition(position);
  };

  return (
    <div style={{ width: "100%", marginTop: 12 }}>
      <div
        className={css.preview}
        style={{ backgroundImage: finalValue }}
        ref={previewRef}
        onClick={handlePreviewClick}
      >
        {stops.map((stop, index) => {
          const { position, color } = stop;
          return (
            <div
              key={position + color}
              draggable="true"
              className={`${css.stop} ${
                position === activeStopPosition ? css.stopActive : ""
              }`}
              style={{ left: `${position}%` }}
              onClick={(e) => {
                setActiveStopPosition(position);
                e.stopPropagation(); // 阻止事件冒泡
              }}
              onDragStart={(e) => {
                e.stopPropagation();
                setActiveStopPosition(position);
              }}
              onDragEnd={(e) => {
                console.log(e);
              }}
            >
              <div
                key={index}
                className={`${css.stopHandle} ${
                  position === activeStopPosition ? css.active : ""
                }`}
              >
                <div style={{ backgroundColor: color }}></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className={css.top}>
        <RadioGroup
          options={[
            { value: "linear", label: "线性" },
            { value: "radial", label: "径向" },
          ]}
          onChange={(value) => changeGradientType(value.target.value)}
          value={gradientType}
        ></RadioGroup>
        {gradientType === "linear" ? (
          <InputNumber
            tip="渐变线方向角度"
            defaultValue={deg}
            onChange={(value) => {
              setDeg(parseInt(value));
              handleChange();
            }}
            style={{ flex: 2 }}
            type={"number"}
            defaultUnitValue=""
          />
        ) : (
          <RadioGroup
            options={[
              { value: "ellipse", label: "椭圆" },
              { value: "circle", label: "圆形" },
            ]}
            onChange={(value) => changeShapeType(value.target.value)}
            value={shapeType}
          />
        )}
        <Panel.Item style={{ width: 30, padding: 0 }} onClick={addColor}>
          <AddButton />
        </Panel.Item>
      </div>
      <div className={css.stops}>
        {stops?.length > 0 &&
          stops.map((stop, index) => {
            const { color, position } = stop;
            if (!color) return null;
            return (
              <Panel.Content
                key={color + position}
                style={{ padding: "3px 0" }}
              >
                <ColorEditor
                  defaultValue={color}
                  style={{ flex: 8 }}
                  // key={color} // 可以解决排序color不更新问题但是会导致没法一直改颜色
                  onChange={(color) => {
                    changeProperty("color", color, index);
                    setActiveStopPosition(position);
                  }}
                />
                <InputNumber
                  tip="位置"
                  defaultValue={position}
                  onChange={(position) => {
                    const newPosition = Number(position);
                    changeProperty(
                      "position",
                      newPosition > 100 ? 100 : newPosition,
                      index,
                      true
                    );
                    setActiveStopPosition(Number(newPosition));
                  }}
                  style={{ flex: 3 }}
                  type={"number"}
                  defaultUnitValue=""
                />
                <Panel.Item
                  style={{ width: 30, padding: 0 }}
                  onClick={() => removeColor(index)}
                  className={stops.length <= 2 ? css.disabled : ""}
                >
                  <MinusButton />
                </Panel.Item>
              </Panel.Content>
            );
          })}
      </div>
    </div>
  );
}

const RadioGroup = ({
  onChange,
  value,
  options,
}: {
  onChange: (value: any) => void;
  value: string;
  options: { value: string; label: string }[];
}) => (
  <div className={css.radioGroup}>
    <Radio.Group
      options={options}
      buttonStyle={"solid"}
      onChange={onChange}
      value={value}
      optionType="button"
      size="small"
      style={{ backgroundColor: "#efefef" }}
    />
  </div>
);
