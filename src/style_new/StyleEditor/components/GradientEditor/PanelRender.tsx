import { uuid } from "../../../../utils";
import { useState, useCallback, useRef, useMemo } from "react";
import { computePercentage, GradientStop, interpolateColor, resolveGradientStops } from "./constants";
import React from "react";
import { resolveCssVarsInCssValue } from "../../../core/resolve-css-var-color";
import css from "./index.less";

const PanelRender = ({
  gradientColor,
  stops,
  setStops,
  curElementId,
  setCurElementId,
  setIsMoveDone,
  scopeEl = null,
}: {
  gradientColor: string;
  stops: GradientStop[];
  setStops: (value: GradientStop[]) => void;
  curElementId: string | null;
  setCurElementId: (value: string | null) => void;
  setIsMoveDone: (value: boolean) => void;
  scopeEl?: Element | null;
}) => {
  const [dragStartFlag, setDragStartFlag] = useState(false);
  const [dragStartPosition, setDragStartPosition] = useState(0);
  const [elementStartPosition, setElementStartPosition] = useState(0);

  const [moveMarkerEndTime, setMoveMarkerEndTime] = useState(-1);

  const previewRef = useRef<HTMLDivElement>(null);
  const resolvedStops = useMemo(() => resolveGradientStops(stops), [stops]);
  // 编辑器面板不在画布作用域，预览时需把 var() 解析成具体色
  const resolvedGradientColor = useMemo(
    () => resolveCssVarsInCssValue(gradientColor, scopeEl),
    [gradientColor, scopeEl]
  );
  const resolveStopColor = useCallback(
    (color: string) => resolveCssVarsInCssValue(color, scopeEl),
    [scopeEl]
  );

  // 设置渐变停止点位置
  const setGradientStopPosition = (position: number) => {
    // 更新渐变停止点的位置，并确保位置是有效的百分比
    setStops(stops.map((stop) => stop.id === curElementId
      ? { ...stop, position: computePercentage(position) }
      : stop));
  };

  // 添加渐变停止点
  const addGradientStop = useCallback(
    (position: number) => {
      // 确保位置是有效的百分比
      position = computePercentage(position);
      const temp = [...stops];

      // 找到新停止点应该插入的位置
      const index = resolvedStops.findIndex((stop) => stop.position > position);
      // 创建新的停止点对象
      const newStop = {
        id: uuid(),
        position,
        color: "",
      };
      setCurElementId(newStop.id);
      if (temp?.length === 0) {
        newStop.color = "rgba(255,255,255,1)";
      } else {
        // 获取新停止点两边的停止点颜色
        const leftStop = index > 0 ? resolvedStops[index - 1] : resolvedStops[0];
        const rightStop = index !== -1 ? resolvedStops[index] : resolvedStops[resolvedStops.length - 1];
        newStop.color =
          position <= leftStop.position
            ? leftStop.color
            : position >= rightStop.position
            ? rightStop.color
            : interpolateColor(leftStop, rightStop, position);
      }

      // 将新停止点插入到正确的位置
      temp.splice(index === -1 ? temp.length : index, 0, newStop);
      setStops(temp);
    },
    [stops, resolvedStops]
  );

  const handlePreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (moveMarkerEndTime > -1 && +new Date() - moveMarkerEndTime < 10) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const position = ((event.clientX - rect.left) / rect.width) * 100;
    addGradientStop(position);
  };

  const onMouseDown = useCallback(
    (id: any, event: React.MouseEvent<HTMLDivElement>) => {
      const rect = previewRef.current?.getBoundingClientRect();
      if (rect) {
        setIsMoveDone(true);
        // 计算鼠标按下时的位置百分比
        const position = ((event.clientX - rect.left) / rect.width) * 100;
        setCurElementId(id);
        setDragStartFlag(true);
        setDragStartPosition(position);
        // 存储元素的初始位置
        setElementStartPosition(
          resolvedStops.find((stop) => stop.id === id)?.position ?? 0
        );
      }
    },
    [resolvedStops, previewRef.current]
  );

  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      setIsMoveDone(false);
      if (!dragStartFlag) {
        return;
      }
      const rect = previewRef.current?.getBoundingClientRect();
      if (rect) {
        // 计算鼠标移动时的新位置百分比
        const position = ((event.clientX - rect.left) / rect.width) * 100;
        const newPosition =
          elementStartPosition + (position - dragStartPosition);
        setGradientStopPosition(newPosition);
      }
    },
    [dragStartFlag, elementStartPosition, dragStartPosition, previewRef.current]
  );

  const onMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    setDragStartFlag(false);
    setMoveMarkerEndTime(+new Date());
    // 拖拽结束需要把移动标志复位，否则后续（拖拽或输入框）修改的 onChange 会被永久拦截
    setIsMoveDone(true);
    // setCurElementId(null);
    event.stopPropagation();
  };

  return (
    <div style={{ position: "relative", left: "-12px", display: "flow-root" }}>
      {dragStartFlag && (
        <div
          className={css["overlay-when-drag"]}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseDown={() => setDragStartFlag(false)}
        />
      )}
      {stops?.length > 0 && (
        <div className={css.previewTopBox}>
          {resolvedStops.map((stop, index) => {
            const { position, color, id } = stop;
            return (
              <div
                key={`${id}-${index}`}
                className={`${css.stop} ${
                  id === curElementId ? css.stopActive : ""
                }`}
                style={{
                  left: `${position}%`,
                  zIndex: id === curElementId ? 20 : 3,
                }}
                onMouseDown={(e) => onMouseDown(id, e)}
                onMouseUp={onMouseUp}
                onClick={() => setCurElementId(id)}
              >
                <div
                  key={id}
                  className={`${css.stopHandle} ${
                    id === curElementId ? css.active : ""
                  }`}
                >
                  <div style={{ backgroundColor: resolveStopColor(color) }}></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div
        className={css.preview}
        style={{
          backgroundImage: resolvedGradientColor,
          backgroundColor:
            stops?.length === 1 ? resolveStopColor(stops[0]?.color) : "",
        }}
        onClick={handlePreviewClick}
        ref={previewRef}
      >
        <CoordinatePoints />
      </div>
    </div>
  );
};

const positions = [25, 50, 75]; // 定义坐标点的百分比位置
const heights = [4, 6, 4]; // 定义坐标点的高度

// 坐标点组件
const CoordinatePoints = () => (
  <>
    {positions.map((position, index) => (
      <div
        key={index}
        className={css.coordinatePoint}
        style={{ left: `${position}%` }}
      >
        <div style={{ height: `${heights[index]}px` }} />
      </div>
    ))}
  </>
);

export default PanelRender;
