import React, { useRef, useState, useEffect, useCallback } from "react";

import { ColorEditor, InputNumber, Panel, Select } from "../index";

import css from "./index.less";
import {
  AddButton,
  Circle,
  Ellipse,
  Linear,
  MinusButton,
  Radial,
} from "./icon";
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
  const [activeStop, setActiveStop] = useState<string>("");
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

  const handlePreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const position = Math.floor((x / rect.width) * 100);
    if (position < 0 || position >= 100) {
      return;
    }
    const color = findColorByPosition(stops, position) || "rgba(255,255,255,1)";
    const id = uuid();
    const newStop = { color, position, id };
    changeStops(stopSort([...stops, newStop]));
    setActiveStop(id);
  };

  const onMouseDown = useCallback((id: any, event: { clientX: any }) => {
    const { clientX } = event;
    setActiveStop(id);
    // setDragStartFlag(true);
    // setDragStartOffset(clientX);
    const temp = [...stops];
    // setElementStartOffset(temp.find((stop) => stop.id === id)?.offset || 0);
  }, []);

  const onMouseMove = useCallback((event: { clientX: any }) => {
    // if (!dragStartFlag) {
    //   return;
    // }
    const { clientX } = event;
    // const newOffset = elementStartOffset + (clientX - dragStartOffset);
    // if (newOffset < minOffset || newOffset > maxOffset) {
    //   return;
    // }
    // setGradientStopOffset(newOffset);
  }, []);

  const onMouseUp = (event: { stopPropagation: () => void }) => {
    // setDragStartFlag(false);
    // setMoveMarkerEndTime(+new Date());
    setActiveStop("");
    event.stopPropagation();
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
              key={`${id}-${index}`}
              draggable="true"
              className={`${css.stop} ${
                id === activeStop ? css.stopActive : ""
              }`}
              style={{ left: `${position}%` }}
              onClick={(e) => {
                setActiveStop(id);
                e.stopPropagation(); // 阻止事件冒泡
              }}
              onDragStart={(e) => {
                e.stopPropagation();
                setActiveStop(id);
              }}
              onDragEnd={(e) => {
                console.log(e);
              }}
            >
              <div
                key={id}
                className={`${css.stopHandle} ${
                  id === activeStop ? css.active : ""
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
        <Select
          tip="渐变类型"
          style={{ flex: 1 }}
          value={gradientType}
          options={gradientOptions}
          prefix={gradientType === "radial" ? <Radial /> : <Linear />}
          onChange={(value) => setGradientType(value)}
        />
        {gradientType === "linear" ? (
          <InputNumber
            tip="渐变线方向角度"
            defaultValue={deg}
            onChange={(value) => setDeg(parseInt(value))}
            style={{ flex: 1 }}
            type={"number"}
            defaultUnitValue=""
          />
        ) : (
          <Select
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
                    changeProperty("color", color, id);
                    setActiveStop(id);
                  }}
                />
                <InputNumber
                  key={position}
                  tip="位置"
                  defaultValue={position}
                  onChange={(position) => {
                    let newPosition = Number(position);
                    newPosition = newPosition > 100 ? 100 : newPosition;
                    changeProperty("position", newPosition, id, true);
                    setActiveStop(id);
                  }}
                  style={{ flex: 3 }}
                  type={"number"}
                  defaultUnitValue=""
                />
                <Panel.Item
                  style={{ width: 30, padding: 0 }}
                  onClick={() => {
                    if (stops.length > 2) {
                      removeColor(id);
                    }
                  }}
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
