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
  shapeOptions,
  gradientOptions,
} from "./constants";
import { uuid } from "../../../../utils";
import { GradientPanel } from "./GradientPanel";

export function GradientEditor({
  defaultValue,
  onChange,
  options = [],
}: GradientEditorProps) {
  const [gradientType, setGradientType] = useState<GradientType>("linear");
  const [shapeType, setShapeType] = useState<ShapeType>("ellipse");
  const [deg, setDeg] = useState(90);
  const [stops, setStops] = useState<GradientStop[]>(defalutGradientStops);
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

  const changeStops = (newStops: GradientStop[]) => {
    setStops(stopSort(newStops));
  };

  const stopSort = useCallback(
    (arr: GradientStop[]) =>
      arr.sort((a, b) => (a.position || 0) - (b.position || 0)),
    []
  );

  const addColor = useCallback(() => {
    const { color = "#ffffff", position = 50 } = stops[stops.length - 1] || {};
    changeStops([
      ...stops,
      {
        // 可以继续对齐figma
        color: color,
        position: position + 1 <= 100 ? position + 1 : 100,
        id: uuid(),
        offset: 0,
      },
    ]);
  }, [stops]);

  const removeColor = useCallback(
    (index: number) => {
      if (stops.length < 2) return;
      changeStops(stops.filter((_, i) => i !== index));
    },
    [stops]
  );

  const generateGradientValue = (
    deg: number,
    gradientType: GradientType,
    shapeType: ShapeType,
    stops: GradientStop[]
  ) => {
    const direction = gradientType === "linear" ? `${deg}deg` : shapeType;
    return `${gradientType}-gradient(${direction}${stops
      .map((stop) => `, ${stop.color} ${stop.position}%`)
      .join("")})`;
  };

  const finalValue = generateGradientValue(deg, gradientType, shapeType, stops);
  const finalValueRight = generateGradientValue(90, "linear", shapeType, stops);

  useEffect(() => {
    onChange?.(finalValue);
  }, [finalValue, onChange]);

  const changeProperty = useCallback(
    (property: string, value: any, index: number, isSort = false) => {
      setStops((prevStops) => {
        const temp = prevStops.map((stop, i) =>
          i === index ? { ...stop, [property]: value } : stop
        );
        return isSort ? stopSort(temp) : temp;
      });
    },
    [onChange, finalValue, stops]
  );

  const handlePreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const position = Math.floor((x / rect.width) * 100);
    if (position < 0 || position >= 100) {
      return;
    }
    const color =
      gradientType === "linear"
        ? findColorByPosition(stops, position) || "#ffffff"
        : "#ffffff";
    const newStop = { color, position, id: uuid(), offset: 0 };
    setStops((prevStops) => {
      prevStops.push(newStop);
      return stopSort(prevStops);
    });
    setActiveStopPosition(position);
  };

  const PanelRender = useCallback(() => {
    return (
      <div
        className={css.preview}
        style={{ backgroundImage: finalValueRight }}
        ref={previewRef}
        onClick={handlePreviewClick}
      >
        {stops.map((stop, index) => {
          const { position, color, id } = stop;
          return (
            <div
              key={id}
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
                key={id}
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
    );
  }, [stops, finalValueRight]);

  return (
    <div style={{ width: "100%", marginTop: 12 }}>
      <GradientPanel
        gradientColor={finalValueRight}
        stops={stops}
        setStops={changeStops}
      />
      {/* <PanelRender /> */}
      <div className={css.top}>
        <RadioGroup
          options={gradientOptions}
          onChange={(value) => setGradientType(value.target.value)}
          value={gradientType}
        ></RadioGroup>
        {gradientType === "linear" ? (
          <InputNumber
            tip="渐变线方向角度"
            defaultValue={deg}
            onChange={(value) => setDeg(parseInt(value))}
            style={{ flex: 2 }}
            type={"number"}
            defaultUnitValue=""
          />
        ) : (
          <RadioGroup
            options={shapeOptions}
            onChange={(value) => setShapeType(value.target.value)}
            value={shapeType}
          />
        )}
        <Panel.Item style={{ width: 30, padding: 0 }} onClick={addColor}>
          <AddButton />
        </Panel.Item>
      </div>
      {/* <StopsRender /> */}
      <div className={css.stops}>
        {stops?.length > 0 &&
          stops.map((stop, index) => {
            const { color, position, id } = stop;
            if (!color) return null;
            return (
              <Panel.Content key={id} style={{ padding: "3px 0" }}>
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
                  key={position}
                  tip="位置"
                  defaultValue={position}
                  onChange={(position) => {
                    let newPosition = Number(position);
                    newPosition = newPosition > 100 ? 100 : newPosition;
                    changeProperty("position", newPosition, index, true);
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
