import { uuid } from "../../../../utils";
import { useState, useCallback, useRef } from "react";
import { computePercentage, GradientStop, interpolateColor } from "./constants";
import React from "react";
import css from "./index.less";

const PanelRender = ({
  gradientColor,
  stops,
  setStops,
  curElementId,
  setCurElementId,
}: {
  gradientColor: string;
  stops: GradientStop[];
  setStops: (value: GradientStop[]) => void;
  curElementId: string | null;
  setCurElementId: (value: string | null) => void;
}) => {
  const [dragStartFlag, setDragStartFlag] = useState(false);
  const [dragStartPosition, setDragStartPosition] = useState(0);
  const [elementStartPosition, setElementStartPosition] = useState(0);

  const [moveMarkerEndTime, setMoveMarkerEndTime] = useState(-1);

  const previewRef = useRef<HTMLDivElement>(null);

  // 设置渐变停止点位置
  const setGradientStopPosition = (position: number) => {
    // 更新渐变停止点的位置，并确保位置是有效的百分比
    const temp = stops;
    const index = temp.findIndex((stop) => stop.id === curElementId);
    temp[index].position = computePercentage(position);
    // 更新渐变停止点的位置，并确保位置是有效的百分比
    temp.sort((stopA, stopB) => stopA.position - stopB.position);
    setStops([...temp]);
  };

  // 添加渐变停止点
  const addGradientStop = useCallback(
    (position: number) => {
      // 确保位置是有效的百分比
      position = computePercentage(position);
      const temp = [...stops];

      // 找到新停止点应该插入的位置
      const index = temp.findIndex((stop) => stop.position > position);
      // 创建新的停止点对象
      const newStop = {
        id: uuid(),
        position,
        color: "",
      };
      if (temp?.length === 0) {
        newStop.color = "rgba(255,255,255,1)";
      } else {
        // 获取新停止点两边的停止点颜色
        const leftStop = index > 0 ? temp[index - 1] : temp[0];
        const rightStop = index !== -1 ? temp[index] : temp[temp.length - 1];
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
    [stops]
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
        // 计算鼠标按下时的位置百分比
        const position = ((event.clientX - rect.left) / rect.width) * 100;
        setCurElementId(id);
        setDragStartFlag(true);
        setDragStartPosition(position);
        // 存储元素的初始位置
        const temp = [...stops];
        setElementStartPosition(
          temp.find((stop) => stop.id === id)?.position || 0
        );
      }
    },
    [stops, previewRef.current]
  );

  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
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
    setCurElementId(null);
    event.stopPropagation();
  };

  return (
    <div style={{ position: "relative", left: "-12px" }}>
      {dragStartFlag && (
        <div
          className={css["overlay-when-drag"]}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        />
      )}
      {stops?.length > 0 && (
        <div className={css.previewTopBox}>
          {stops?.map((stop, index) => {
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
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  key={id}
                  className={`${css.stopHandle} ${
                    id === curElementId ? css.active : ""
                  }`}
                >
                  <div style={{ backgroundColor: color }}></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div
        className={css.preview}
        style={{
          backgroundImage: gradientColor,
          backgroundColor: stops?.length === 1 ? stops[0]?.color : "",
        }}
        onClick={handlePreviewClick}
        ref={previewRef}
      />
    </div>
  );
};

export default PanelRender;
