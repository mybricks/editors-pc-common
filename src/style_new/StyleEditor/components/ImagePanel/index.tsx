import React, { useRef, useState, useCallback } from "react";
import { Input, Select } from "../";
import { ExtractBackground } from "../Image/ExtractBackground";
import lang from "../../../index.i18n";

import css from "./index.less";

// 图片选择器相关常量
const DEFAULT_IMAGE = '';

const BACKGROUND_SIZE_OPTIONS = [
  { label: lang.imgSizeCover, value: "cover" },
  { label: lang.imgSizeContain, value: "contain" },
  { label: lang.imgSizeStretch, value: "100% 100%" },
  { label: lang.imgSizeOriginal, value: "auto" },
];

const BACKGROUND_REPEAT_OPTIONS = [
  { label: lang.imgRepeatOn, value: 'repeat' },
  { label: lang.imgRepeatOff, value: 'no-repeat' }
];

const BACKGROUND_POSITION_OPTIONS = [
  { label: lang.imgPosTop, value: 'center top' },
  { label: lang.imgPosCenter, value: 'center center' },
  { label: lang.imgPosBottom, value: 'center bottom' },
  { label: lang.imgPosLeft, value: 'left center' },
  { label: lang.imgPosRight, value: 'right center' },
  { label: lang.imgPosTopLeft, value: 'left top' },
  { label: lang.imgPosBottomLeft, value: 'left bottom' },
  { label: lang.imgPosTopRight, value: 'right top' },
  { label: lang.imgPosBottomRight, value: 'right bottom' }
];

function getBackgroundImage(image: string = '', defaultValue = '') {
  return /url\s*\(\s*["']?([^"'\r\n\)\(]+)["']?\s*\)/gi.exec(ExtractBackground(image, 'image')?.[0] || '')?.[1] || defaultValue;
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

export interface ImageValue {
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundRepeat?: string;
  backgroundPosition?: string;
}

interface ImagePanelProps {
  /** 背景图片相关值 */
  value: ImageValue;
  /** 变更回调 */
  onChange: (key: string, value: string) => void;
  /** 图片上传函数 */
  upload?: (files: Array<File>, args: any) => Promise<Array<string>>;
}

export function ImagePanel({
  value,
  onChange,
  upload,
}: ImagePanelProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [localImageValue, setLocalImageValue] = useState<ImageValue>(value);

  const handleImageClick = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleImageChange = useCallback((key: string, newValue: string) => {
    setLocalImageValue(prev => ({ ...prev, [key]: newValue }));
    onChange(key, newValue);
  }, [onChange]);

  const handleBackgroundChange = useCallback((newBackground: string) => {
    const newValue = `url(${newBackground})`;
    handleImageChange('backgroundImage', newValue);
  }, [handleImageChange]);

  const handleFileInputChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    const [newValue] = await (typeof upload === 'function' ? upload([file], {}) : file2Base64(file));
    handleBackgroundChange(newValue);
  }, [handleBackgroundChange, upload]);

  const handleUrlInputChange = useCallback((url: string) => {
    handleBackgroundChange(url);
  }, [handleBackgroundChange]);

  const imageSrc = getBackgroundImage(localImageValue.backgroundImage || '', DEFAULT_IMAGE);

  return (
    <div className={css.imagePanel}>
      <div className={css.imageUpload}>
        <div 
          className={`${css.imageContainer} ${imageSrc !== DEFAULT_IMAGE ? css.hasImage : ""}`}
          onClick={handleImageClick}
        >
          <img 
            style={{ opacity: imageSrc === DEFAULT_IMAGE ? 0.5 : 1 }} 
            src={imageSrc} 
            alt={lang.imageAltBg}
          />
          <button className={css.uploadButton}>{lang.clickToUpload}</button>
        </div>
        <input
          type="file"
          accept="image/*"
          ref={imageInputRef}
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
      </div>
      <div className={css.imageItem}>
        <Input clearable onClear={() => handleUrlInputChange('')}
          onChange={handleUrlInputChange} 
          value={getBackgroundImage(localImageValue.backgroundImage || '', '')}
        />
      </div>
      <div className={css.imageItem}>
        <div className={css.imageLabel}>{lang.imageSizeLabel}</div>
        <div className={css.imageValue}>
          <Select
            style={{ padding: 0 }}
            defaultValue={localImageValue.backgroundSize || 'auto'}
            options={BACKGROUND_SIZE_OPTIONS}
            onChange={(val: string) => handleImageChange('backgroundSize', val)}
          />
        </div>
      </div>
      {!["100% 100%", "cover"].includes(localImageValue.backgroundSize || '') && (
        <div className={css.imageItem}>
          <div className={css.imageLabel}>{lang.imageRepeatLabel}</div>
          <div className={css.imageValue}>
            <Select
              style={{ padding: 0 }}
              defaultValue={localImageValue.backgroundRepeat || 'no-repeat'}
              options={BACKGROUND_REPEAT_OPTIONS}
              onChange={(val: string) => handleImageChange('backgroundRepeat', val)}
            />
          </div>
        </div>
      )}
      {localImageValue.backgroundSize !== "100% 100%" && (
        <div className={css.imageItem}>
          <div className={css.imageLabel}>{lang.imagePositionLabel}</div>
          <div className={css.imageValue}>
            <Select
              style={{ padding: 0 }}
              defaultValue={localImageValue.backgroundPosition || 'center center'}
              options={BACKGROUND_POSITION_OPTIONS}
              onChange={(val: string) => handleImageChange('backgroundPosition', val)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
