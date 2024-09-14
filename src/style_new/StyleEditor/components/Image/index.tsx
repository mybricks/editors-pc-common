import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback,
  CSSProperties,
} from "react";
import { createPortal } from "react-dom";

import { Panel, ImageOutlined } from "..";

import { ReloadOutlined } from "@ant-design/icons";

import css from "./index.less";

export const DEFAULT_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAEpJREFUSEvtlKEOAEAIQuH/P5pLNgkXLIrRuTGBPQIQmpHaNUh257D3ESi/Flsk89t3W0y7GIFqkbN0gUVBxQFUjIccVBxAxXTID1edp90t8GAGAAAAAElFTkSuQmCC";
import { ImageEditor } from "./Image";
export * from "./Image";

interface ImageProps {
  defaultValue: any;
  style?: CSSProperties;
  onChange: (value: any) => void;
  upload?: (files: Array<File>) => Array<string>;
  tip?: string;
}

export function getBackgroundImage(image: string = "", defaultValue = "") {
  return (
    /url\s*\(\s*["']?([^"'\r\n\)\(]+)["']?\s*\)/gi.exec(image || "")?.[1] ||
    defaultValue
  );
}

export function Image({
  defaultValue,
  style = {},
  onChange,
  upload,
  tip,
}: ImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const childRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<CSSProperties>(defaultValue);
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 兼容下之前的backgroundSize BACKGROUND_SIZE_OPTIONS
    if (
      value.backgroundSize &&
      ["100% auto", "auto 100%"].includes(value.backgroundSize as string)
    ) {
      setValue({ ...value, backgroundSize: "100% 100%" });
    }
  }, []);

  const handleImageClick = useCallback(() => {
    setShow(true);
    setOpen(true);
  }, []);

  const handleReset = useCallback(() => {
    onChange({ key: "backgroundImage", value: "none" });
    setValue((val) => {
      return {
        ...val,
        backgroundImage: "none",
      };
    });
  }, []);

  const handleChange = useCallback((value: { key: string; value: any }) => {
    onChange(value);
    setValue((val) => {
      return {
        ...val,
        [value.key]: value.value,
      };
    });
  }, []);

  const handleClick = useCallback((event: any) => {
    // TODO: 点击弹窗内容以外的区域关闭
    if (
      !childRef.current!.contains(event.target) &&
      !event?.target?.className?.startsWith?.("item-")
    ) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        // TODO
        document.addEventListener("click", handleClick);
      });
    } else {
      document.removeEventListener("click", handleClick);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);

  const icon = useMemo(() => {
    const src = getBackgroundImage(value.backgroundImage);
    if (src) {
      return <img src={src} />;
    }

    return <ImageOutlined />;
  }, [value.backgroundImage]);

  return (
    <Panel.Item style={style}>
      <div className={css.image} data-mybricks-tip={tip}>
        <div ref={ref} className={css.block} onClick={handleImageClick}>
          {icon}
        </div>
        <div
          className={css.reset}
          onClick={handleReset}
          data-mybricks-tip={"重置图片"}
        >
          <ReloadOutlined
            onPointerOverCapture={void 0}
            onPointerMoveCapture={void 0}
          />
        </div>
      </div>
      {show &&
        createPortal(
          <Popup
            value={value}
            positionElement={ref.current!}
            open={open}
            onChange={handleChange}
            childRef={childRef}
            upload={upload}
          />,
          document.body
        )}
    </Panel.Item>
  );
}

interface PopupProps {
  value: any;
  childRef: React.RefObject<HTMLDivElement>;
  onChange: (value: any) => void;
  open: boolean;
  positionElement: HTMLDivElement;
  upload?: (files: Array<File>, args: any) => Array<string>;
}

function Popup({
  value,
  onChange,
  childRef,
  open,
  positionElement,
  upload,
}: PopupProps) {
  const ref = childRef;

  useEffect(() => {
    const menusContainer = ref.current!;
    if (open) {
      const positionElementBct = positionElement.getBoundingClientRect();
      const menusContainerBct = ref.current!.getBoundingClientRect();
      const totalHeight =
        window.innerHeight || document.documentElement.clientHeight;
      const top = positionElementBct.top + positionElementBct.height;
      const right = positionElementBct.left + positionElementBct.width;
      const left = right - menusContainerBct.width;
      const bottom = top + menusContainerBct.height;

      if (bottom > totalHeight) {
        // 目前判断下方是否超出即可
        // 向上
        menusContainer.style.top =
          positionElementBct.top - menusContainerBct.height + "px";
      } else {
        menusContainer.style.top = top + "px";
      }

      menusContainer.style.left = left + "px";
      menusContainer.style.visibility = "visible";
    } else {
      menusContainer.style.visibility = "hidden";
    }
  }, [open]);

  return (
    <div ref={ref} className={css.popup}>
      <ImageEditor value={value} onChange={onChange} upload={upload} />
    </div>
  );
}
