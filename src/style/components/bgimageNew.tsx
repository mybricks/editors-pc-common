import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback,
  CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ReloadOutlined } from "@ant-design/icons";
import {
  Input,
  Panel,
  Select,
  ImageOutlined,
  GradientEditor,
} from "../../style_new/StyleEditor/components";
import { ExtractBackground } from "../../style_new/StyleEditor/components/Image/ExtractBackground";
import { observe } from "@mybricks/rxui";
import { Ctx } from "../Style";

import css from "./index.less";

const DEFAULT_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAEpJREFUSEvtlKEOAEAIQuH/P5pLNgkXLIrRuTGBPQIQmpHaNUh257D3ESi/Flsk89t3W0y7GIFqkbN0gUVBxQFUjIccVBxAxXTID1edp90t8GAGAAAAAElFTkSuQmCC";

function getBackgroundImage(image: string = "", defaultValue = "") {
  return (
    /url\s*\(\s*["']?([^"'\r\n\)\(]+)["']?\s*\)/gi.exec(
      ExtractBackground(image, "image")?.[0] || ""
    )?.[1] || defaultValue
  );
}

export default function Image({}) {
  const ctx: Ctx = observe(Ctx, { from: "parents" });
  const upload = ctx.upload;
  const defaultValue = {
    backgroundImage: "none",
    backgroundPosition: "left top",
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
    ...ctx.val,
  };
  const ref = useRef<HTMLDivElement>(null);
  const childRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<CSSProperties>(defaultValue);
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);

  const handleImageClick = useCallback(() => {
    setShow(true);
    setOpen(true);
  }, []);

  const onChange = useCallback(
    ({ key, value }: { key: string; value: string }) => {
      ctx.set({ [key]: value });
    },
    [value]
  );

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

  const onGradientChange = useCallback(
    (newValue: string) => {
      if (newValue && newValue !== "none") {
        if (
          ExtractBackground(value?.backgroundImage || "", "image").length > 0
        ) {
          newValue = `${
            ExtractBackground(value?.backgroundImage || "", "image")[0]
          }, ${newValue}`;
        }
        handleChange({ key: "backgroundImage", value: newValue });
      }
    },
    [value.backgroundImage, handleChange]
  );

  return (
    <Panel title="背景图">
      <Panel.Item className={css.bgimageNew}>
        <div className={css.image} data-mybricks-tip={"背景图"}>
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
      <div className={css.gradientEditor}>
        <div style={{ height: 20 }} />
        <GradientEditor
          onChange={onGradientChange}
          defaultValue={
            ExtractBackground(
              value?.backgroundImage as string,
              "gradient"
            )?.[0] || "none"
          }
        />
      </div>
    </Panel>
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

const BACKGROUND_REPEAT_OPTIONS = [
  { label: "平铺", value: "repeat" },
  { label: "不平铺", value: "no-repeat" },
];

const BACKGROUND_POSITION_OPTIONS = [
  { label: "居上", value: "center top" },
  { label: "居中", value: "center center" },
  { label: "居下", value: "center bottom" },
  { label: "居左", value: "left center" },
  { label: "居右", value: "right center" },
  { label: "左上", value: "left top" },
  { label: "左下", value: "left bottom" },
  { label: "右上", value: "right top" },
  { label: "右下", value: "right bottom" },
];

const BACKGROUND_SIZE_OPTIONS_NEW = [
  { label: "填充（无留白）", value: "cover" },
  { label: "适应（有留白）", value: "contain" },
  { label: "拉伸", value: "100% 100%" },
  { label: "原始大小", value: "auto" },
];

function Popup({
  value,
  onChange,
  childRef,
  open,
  positionElement,
  upload,
}: PopupProps) {
  const ref = childRef;
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleImageClick = useCallback(() => {
    inputRef.current!.click();
  }, []);

  const handleBackgroundChange = useCallback(
    (newBackground: string) => {
      const gradient = ExtractBackground(
        value.backgroundImage,
        "gradient"
      )?.[0];
      const newValue = gradient
        ? `${gradient}, url(${newBackground})`
        : `url(${newBackground})`;
      onChange({ key: "backgroundImage", value: newValue });
    },
    [value.backgroundImage]
  );

  const handleFileInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target?.files?.[0];
      if (!file) return;

      const [neValue] = await (typeof upload === "function"
        ? upload([file], {})
        : file2Base64(file));
      handleBackgroundChange(neValue);
    },
    [handleBackgroundChange]
  );

  const handleUrlInputChange = useCallback(
    (url: string) => {
      handleBackgroundChange(url);
    },
    [handleBackgroundChange]
  );

  return (
    <div ref={ref} className={css.bgimagePopup}>
      <div className={css.image}>
        <img
          src={getBackgroundImage(value.backgroundImage, DEFAULT_IMAGE)}
          onClick={handleImageClick}
        />
        <input
          type="file"
          accept={"image/*"}
          style={{ display: "none" }}
          ref={inputRef}
          onChange={handleFileInputChange}
        />
      </div>
      <div className={css.item}>
        <Input
          onChange={handleUrlInputChange}
          value={getBackgroundImage(value.backgroundImage, DEFAULT_IMAGE)}
        />
      </div>
      <div className={css.item}>
        <div className={css.label}>大小</div>
        <div className={css.value}>
          <Select
            style={{ padding: 0 }}
            defaultValue={value.backgroundSize}
            options={BACKGROUND_SIZE_OPTIONS_NEW}
            onChange={(value: string) => {
              onChange({ key: "backgroundSize", value });
            }}
          />
        </div>
      </div>
      {!["100% 100%", "cover"].includes(value.backgroundSize) && (
        <div className={css.item}>
          <div className={css.label}>平铺</div>
          <div className={css.value}>
            <Select
              style={{ padding: 0 }}
              defaultValue={value.backgroundRepeat}
              options={BACKGROUND_REPEAT_OPTIONS}
              onChange={(value) => onChange({ key: "backgroundRepeat", value })}
            />
          </div>
        </div>
      )}
      {value.backgroundSize !== "100% 100%" && (
        <div className={css.item}>
          <div className={css.label}>位置</div>
          <div className={css.value}>
            <Select
              style={{ padding: 0 }}
              defaultValue={value.backgroundPosition}
              options={BACKGROUND_POSITION_OPTIONS}
              onChange={(value) =>
                onChange({ key: "backgroundPosition", value })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

function file2Base64(file: File): Promise<Array<string>> {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.readAsDataURL(file);
    fr.onload = (result) => {
      // @ts-ignore
      const base64Str = result.currentTarget.result;
      resolve([base64Str]);
    };
  });
}
