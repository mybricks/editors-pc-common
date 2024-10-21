import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import css from "./index.less";
import { Input, Select } from "..";
import { getBackgroundImage, DEFAULT_IMAGE } from "./";
import { ExtractBackground } from "./ExtractBackground";

interface PopupProps {
  value: any;
  onChange: (value: any) => void;
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

const BACKGROUND_SIZE_OPTIONS = [
  { label: "默认", value: "auto" },
  { label: "适应", value: "contain" },
  { label: "填充", value: "cover" },
  { label: "铺满", value: "100% 100%" },
  { label: "铺满x轴", value: "100% auto" },
  { label: "铺满y轴", value: "auto 100%" },
];

const BACKGROUND_SIZE_OPTIONS_NEW = [
  { label: "填充（无留白）", value: "cover" },
  { label: "适应（有留白）", value: "contain" },
  { label: "拉伸", value: "100% 100%" },
  { label: "原始大小", value: "auto" },
];

export const ImageEditor = ({ value, onChange, upload }: PopupProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleImageClick = useCallback(() => {
    inputRef.current!.click();
  }, []);
  const [defalutValue, setDefalutValue] = useState(value);

  const changeDefalutValue = useCallback(
    (key: string, newValue: string) => {
      setDefalutValue((preDefalutValue: any) => ({
        ...preDefalutValue,
        [key]: newValue,
      }));
      onChange({ key, value: newValue });
    },
    [defalutValue]
  );

  const handleBackgroundChange = useCallback(
    (newBackground: string) => {
      const gradient = ExtractBackground(
        defalutValue.backgroundImage,
        "gradient"
      )?.[0];
      const newValue = gradient
        ? `url(${newBackground}),${gradient}`
        : `url(${newBackground})`;
      changeDefalutValue("backgroundImage", newValue);
      onChange({ key: "backgroundImage", value: newValue });
    },
    [defalutValue]
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

  const imgSrc = useMemo(
    () => getBackgroundImage(defalutValue.backgroundImage, DEFAULT_IMAGE),
    [defalutValue.backgroundImage]
  );

  return (
    <>
      <div className={css.image}>
        <div
          className={`${css.imageContainer} ${
            imgSrc !== DEFAULT_IMAGE ? css.hasImage : ""
          }`}
          onClick={handleImageClick}
        >
          <img
            style={{ opacity: imgSrc === DEFAULT_IMAGE ? 0.5 : 1 }}
            src={imgSrc}
          />
          <button className={css.uploadButton}>点击上传</button>
        </div>

        <input
          type="file"
          accept={"image/*"}
          ref={inputRef}
          onChange={handleFileInputChange}
        />
      </div>
      <div className={css.item}>
        <Input onChange={handleUrlInputChange} value={imgSrc} />
      </div>
      <div className={css.item}>
        <div className={css.label}>大小</div>
        <div className={css.value}>
          <Select
            style={{ padding: 0 }}
            defaultValue={defalutValue.backgroundSize}
            options={BACKGROUND_SIZE_OPTIONS_NEW}
            onChange={(value: string) =>
              changeDefalutValue("backgroundSize", value)
            }
          />
        </div>
      </div>
      {!["100% 100%", "cover"].includes(defalutValue.backgroundSize) && (
        <div className={css.item}>
          <div className={css.label}>平铺</div>
          <div className={css.value}>
            <Select
              style={{ padding: 0 }}
              defaultValue={defalutValue.backgroundRepeat}
              options={BACKGROUND_REPEAT_OPTIONS}
              onChange={(value) =>
                changeDefalutValue("backgroundRepeat", value)
              }
            />
          </div>
        </div>
      )}
      {defalutValue.backgroundSize !== "100% 100%" && (
        <div className={css.item}>
          <div className={css.label}>位置</div>
          <div className={css.value}>
            <Select
              style={{ padding: 0 }}
              defaultValue={defalutValue.backgroundPosition}
              options={BACKGROUND_POSITION_OPTIONS}
              onChange={(value) =>
                changeDefalutValue("backgroundPosition", value)
              }
            />
          </div>
        </div>
      )}
    </>
  );
};

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
