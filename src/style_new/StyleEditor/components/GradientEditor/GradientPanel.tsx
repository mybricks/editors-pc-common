import React, { useCallback, useEffect, useRef, useState } from "react";
import { GradientStop } from "./constants";
import { uuid } from "../../../../utils";
import chroma from "chroma-js";
import css from "./index.less";

function computePercentage(position: number) {
  // 不需要再计算百分比，因为position已经是百分比了
  return Math.round(Math.min(Math.max(position, 0), 100));
}

export function GradientPanel({
  gradientColor,
  stops,
  setStops,
}: {
  gradientColor: string;
  stops: GradientStop[];
  setStops: (value: GradientStop[]) => void;
}) {
  const [dragStartFlag, setDragStartFlag] = useState(false);
  const [dragStartPosition, setDragStartPosition] = useState(0);
  const [elementStartPosition, setElementStartPosition] = useState(0);

  const [curElementId, setCurElementId] = useState<string | null>(null);

  const [moveMarkerEndTime, setMoveMarkerEndTime] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  const setGradientStopPosition = (position: number) => {
    const temp = stops;
    const index = temp.findIndex((stop) => stop.id === curElementId);
    temp[index].position = computePercentage(position);
    temp.sort((stopA, stopB) => stopA.position - stopB.position);
    setStops([...temp]);
  };

  const addGradientStop = useCallback(
    (position: number) => {
      position = computePercentage(position);
      const temp = [...stops];

      const index = temp.findIndex((stop) => stop.position > position);
      const leftStop = index > 0 ? temp[index - 1] : temp[0];
      const rightStop = index !== -1 ? temp[index] : temp[temp.length - 1];

      const newStop = {
        id: uuid(),
        position,
        color:
          position <= leftStop.position
            ? leftStop.color
            : position >= rightStop.position
            ? rightStop.color
            : chroma
                .scale([leftStop.color, rightStop.color])(
                  (position - leftStop.position) /
                    (rightStop.position - leftStop.position)
                )
                .hex(),
      };

      temp.splice(index === -1 ? temp.length : index, 0, newStop);
      setStops(temp);
    },
    [stops]
  );

  const onMouseDown = useCallback(
    (id: any, event: React.MouseEvent<HTMLDivElement>) => {
      const rect = ref.current?.getBoundingClientRect();
      if (rect) {
        const position = ((event.clientX - rect.left) / rect.width) * 100;
        setCurElementId(id);
        setDragStartFlag(true);
        setDragStartPosition(position);
        const temp = [...stops];
        setElementStartPosition(
          temp.find((stop) => stop.id === id)?.position || 0
        );
      }
    },
    [stops]
  );

  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!dragStartFlag) {
        return;
      }
      const rect = ref.current?.getBoundingClientRect();
      if (rect) {
        const position = ((event.clientX - rect.left) / rect.width) * 100;
        const newPosition =
          elementStartPosition + (position - dragStartPosition);
        setGradientStopPosition(newPosition);
      }
    },
    [dragStartFlag, elementStartPosition, dragStartPosition, ref.current]
  );

  function onMouseUp(event: React.MouseEvent<HTMLDivElement>) {
    setDragStartFlag(false);
    setMoveMarkerEndTime(+new Date());
    setCurElementId(null);
    event.stopPropagation();
  }

  function addMarker(event: React.MouseEvent<HTMLDivElement>) {
    if (moveMarkerEndTime > -1 && +new Date() - moveMarkerEndTime < 10) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const position = ((event.clientX - rect.left) / rect.width) * 100;
    addGradientStop(position);
  }

  const gradientColorToRight = gradientColor;

  return (
    <>
      {dragStartFlag && (
        <div
          className={css["overlay-when-drag"]}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        />
      )}
      <div
        className={css["gradient-panel__slider"]}
        style={{ background: gradientColorToRight }}
        onClick={addMarker}
        ref={ref}
      >
        {stops.map(
          ({ position, color, id }, index: React.Key | null | undefined) => {
            return (
              <div
                key={`${id}-${index}`}
                style={{
                  left: `${position}%`,
                  zIndex: id === curElementId ? 20 : 1,
                }}
                onMouseDown={(e) => {
                  onMouseDown(id, e);
                }}
                onMouseUp={onMouseUp}
                onClick={(event) => event.stopPropagation()}
                className={`${css["gradient-panel__slider-marker"]} ${
                  id === curElementId
                    ? css["gradient-panel__slider-marker_active"]
                    : ""
                }`}
              >
                <div
                  id={color}
                  style={{ backgroundColor: color }}
                  className={`${css["gradient-panel__slider-marker__color"]}`}
                />
              </div>
            );
          }
        )}
      </div>
    </>
  );
}
