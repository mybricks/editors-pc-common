import React, { useCallback, useEffect, useRef, useState } from "react";
import { GradientStop } from "./constants";
import { uuid } from "../../../../utils";
import chroma from "chroma-js";
import css from "./index.less";

const maxOffset = 261 - 75;
const minOffset = 0;

function computePercentage(offset: number) {
  // @ts-ignore
  return parseInt(parseFloat(offset / maxOffset) * 100);
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
  const [dragStartOffset, setDragStartOffset] = useState(0);
  const [elementStartOffset, setElementStartOffset] = useState(0);

  const [curElementId, setCurElementId] = useState<string | null>(null);

  const [moveMarkerEndTime, setMoveMarkerEndTime] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  const setGradientStopOffset = (offset: number) => {
    const temp = stops;
    const index = temp.findIndex((stop) => stop.id === curElementId);
    temp[index].offset = offset;
    temp[index].position = computePercentage(offset);
    temp.sort((stopA, stopB) => stopA.offset - stopB.offset);
    setStops([...temp]);
  };

  const addGradientStop = useCallback(
    (offset: number) => {
      const temp = stops;
      const firstStop = stops[0];
      const lastStop = stops[stops.length - 1];

      if (offset <= firstStop?.offset || 0) {
        temp.unshift({
          id: uuid(),
          offset,
          color: firstStop.color,
          position: computePercentage(offset),
        });
        setStops([...temp]);
        return;
      }

      if (offset >= lastStop?.offset || 100) {
        temp.push({
          id: uuid(),
          offset,
          color: lastStop.color,
          position: computePercentage(offset),
        });
        setStops([...temp]);
        return;
      }

      for (let i = 0; i < stops.length - 1; i++) {
        const curStop = stops[i];
        const nextStop = stops[i + 1];
        if (offset > curStop.offset && offset <= nextStop.offset) {
          const range = chroma.scale([curStop.color, nextStop.color]);
          temp.splice(i + 1, 0, {
            id: uuid(),
            offset,
            color: range(
              (offset - curStop.offset) / (nextStop.offset - curStop.offset)
            ).hex(),
            position: computePercentage(offset),
          });
          setStops([...temp]);
          return;
        }
      }
    },
    [stops]
  );

  const onMouseDown = useCallback((id: any, event: { clientX: any }) => {
    const { clientX } = event;
    setCurElementId(id);
    setDragStartFlag(true);
    setDragStartOffset(clientX);
    const temp = [...stops];
    setElementStartOffset(temp.find((stop) => stop.id === id)?.offset || 0);
  }, []);

  const onMouseMove = useCallback(
    (event: { clientX: any }) => {
      if (!dragStartFlag) {
        return;
      }
      const { clientX } = event;
      const newOffset = elementStartOffset + (clientX - dragStartOffset);
      if (newOffset < minOffset || newOffset > maxOffset) {
        return;
      }
      setGradientStopOffset(newOffset);
    },
    [dragStartFlag, elementStartOffset, dragStartOffset]
  );

  function onMouseUp(event: { stopPropagation: () => void }) {
    setDragStartFlag(false);
    setMoveMarkerEndTime(+new Date());
    setCurElementId(null);
    event.stopPropagation();
  }

  function addMarker(event: any) {
    if (moveMarkerEndTime > -1 && +new Date() - moveMarkerEndTime < 10) {
      return;
    }
    const roughOffset =
      parseInt(event.clientX) -
      parseInt(event.target.getBoundingClientRect().left);
    const finalOffset =
      roughOffset < 0 ? 0 : roughOffset > maxOffset ? maxOffset : roughOffset;

    addGradientStop(finalOffset);
  }

  const gradientColorToRight = gradientColor;

  return (
    <>
      {/* <div
        className={css["gradient-preview"]}
        style={{ background: gradientColor }}
      /> */}
      {dragStartFlag && (
        <div
          className={css["overlay-when-drag"]}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        />
      )}
      {/* <div className={css["gradient-panel"]}> */}
      <div
        className={css["gradient-panel__slider"]}
        style={{ background: gradientColorToRight }}
        onClick={addMarker}
        ref={ref}
      >
        {stops.map(
          (
            { offset, color, id, position },
            index: React.Key | null | undefined
          ) => {
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
      {/* </div> */}
    </>
  );
}
