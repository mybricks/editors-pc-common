import React, { useState, useEffect, useCallback } from "react";

import { ColorEditor, InputNumber, Panel, Select } from "../index";

import css from "./index.less";
import {
  AddButton,
  Angle,
  Circle,
  Ellipse,
  Linear,
  MinusButton,
  Radial,
} from "./Icon";
import {
  ShapeType,
  GradientType,
  defalutGradientStops,
  GradientStop,
  ParseGradient,
  GradientEditorProps,
  shapeOptions,
  gradientOptions,
} from "./constants";
import { uuid } from "../../../../utils";
import PanelRender from "./PanelRender";

export function GradientEditor({
  defaultValue,
  onChange,
  onTypeChange,
  onDegChange,
  onShapeChange,
}: GradientEditorProps) {
  const [gradientType, setGradientType] = useState<GradientType>("linear");
  const [shapeType, setShapeType] = useState<ShapeType>("ellipse");
  const [deg, setDeg] = useState(90);
  const [stops, setStops] = useState<GradientStop[]>([]);

  useEffect(() => {
    if (defaultValue) {
      const { type, direction, stops } = ParseGradient(defaultValue);
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

  useEffect(() => onTypeChange?.(gradientType), [gradientType]);
  useEffect(() => onDegChange?.(deg), [deg]);
  useEffect(() => onShapeChange?.(shapeType), [onShapeChange]);

  const changeStops = (newStops: GradientStop[]) => {
    setStops(stopSort(newStops));
  };

  const stopSort = useCallback(
    (arr: GradientStop[]) =>
      arr.sort((a, b) => (a.position || 0) - (b.position || 0)),
    []
  );

  const addColor = useCallback(() => {
    const { color = "rgba(255,255,255,1)", position = 50 } =
      stops[stops.length - 1] || {};
    changeStops([
      ...stops,
      {
        // 可以继续对齐figma
        color: color,
        position: position + 10 <= 100 ? position + 10 : 100,
        id: uuid(),
      },
    ]);
  }, [stops]);

  const removeColor = useCallback(
    (id: string) => {
      changeStops(stops.filter(({ id: _id }) => id !== _id));
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
    if (stops.length === 0) return "none";
    return `${gradientType}-gradient(${direction}${stops
      .map((stop) => `, ${stop.color} ${stop.position}%`)
      .join("")})`;
  };

  const finalValue = generateGradientValue(deg, gradientType, shapeType, stops);
  const finalValueRight = generateGradientValue(90, "linear", shapeType, stops);

  useEffect(() => {
    if (finalValue) {
      onChange?.(finalValue);
    }
  }, [finalValue]);

  const changeProperty = useCallback(
    (property: string, value: any, id: string, isSort = false) => {
      setStops((prevStops) => {
        const temp = prevStops.map((stop, i) =>
          stop.id === id ? { ...stop, [property]: value } : stop
        );
        return isSort ? stopSort(temp) : temp;
      });
    },
    [onChange, finalValue, stops]
  );

  const [curElementId, setCurElementId] = useState<string | null>(null);

  const onClickAngle = useCallback(() => {
    // 定义四个角度
    const angles = [0, 90, 180, 270];

    // 如果 deg 是 angles 中的一个，直接选择下一个角度
    const index = angles.findIndex((angle) => angle === deg);
    if (index !== -1) {
      setDeg(angles[(index + 1) % angles.length]);
      return;
    }

    // 如果 deg 不在 angles 中，找到最接近的角度
    let closestDeg = angles[0]; // 默认最接近的角度为数组中的第一个
    angles.forEach((angle) => {
      if (Math.abs(deg - angle) < Math.abs(deg - closestDeg)) {
        closestDeg = angle;
      }
    });

    setDeg(closestDeg);
  }, [deg]);

  return (
    <div style={{ width: "100%", marginTop: 6, maxHeight: 360 }}>
      <PanelRender
        gradientColor={finalValueRight}
        stops={stops}
        setStops={changeStops}
        curElementId={curElementId}
        setCurElementId={setCurElementId}
      />
      <div className={css.top}>
        <Select
          tip="渐变类型"
          key={gradientType}
          style={{ flex: 1 }}
          value={gradientType}
          options={gradientOptions}
          prefix={gradientType === "radial" ? <Radial /> : <Linear />}
          onChange={(value) => setGradientType(value)}
        />
        {gradientType === "linear" ? (
          <InputNumber
            tip="渐变线方向角度"
            prefix={
              <div onClick={onClickAngle}>
                <Angle />
              </div>
            }
            key={deg}
            suffix="°"
            prefixTip="角度"
            style={{ flex: 1 }}
            type={"number"}
            defaultUnitValue=""
            defaultValue={deg}
            onChange={(value) => setDeg(parseInt(value))}
          />
        ) : (
          <Select
            key={shapeType}
            tip="辐射形状"
            style={{ flex: 1 }}
            value={shapeType}
            options={shapeOptions}
            prefix={shapeType === "ellipse" ? <Ellipse /> : <Circle />}
            onChange={(value) => setShapeType(value)}
          />
        )}
        <Panel.Item style={{ width: 30, padding: 0 }} onClick={addColor}>
          <AddButton />
        </Panel.Item>
      </div>
      <div className={css.stops}>
        {stops?.length > 0 &&
          stops.map((stop) => {
            const { color, position, id } = stop;
            if (!color) return null;
            const border = curElementId === id ? "1px solid #FA6400" : "";
            return (
              <Panel.Content
                key={id}
                style={{
                  padding: "3px 0",
                }}
              >
                <InputNumber
                  key={position}
                  tip="停靠位置"
                  suffix="%"
                  // prefix={<PositionIcon />}
                  // prefixTip="位置"
                  style={{ flex: 2, border }}
                  type={"number"}
                  defaultUnitValue=""
                  defaultValue={position}
                  onChange={(position) => {
                    let newPosition = Number(position);
                    newPosition = newPosition > 100 ? 100 : newPosition;
                    changeProperty("position", newPosition, id, true);
                    setCurElementId(id);
                  }}
                />
                <ColorEditor
                  defaultValue={color}
                  key={color}
                  style={{ flex: 5, border }}
                  onChange={(color) => {
                    changeProperty("color", color, id);
                    setCurElementId(id);
                  }}
                />
                <Panel.Item
                  style={{ width: 30, padding: 0, border }}
                  // className={stops.length <= 2 ? css.disabled : ""}
                  onClick={() => {
                    // if (stops.length > 2) {
                    removeColor(id);
                    // }
                  }}
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
