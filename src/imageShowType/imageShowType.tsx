import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorProps } from "@/interface";
import styles from "./imageShowType.less";

const Segmented = window?.antd?.Segmented;
const Select = window?.antd?.Select;

const isNumber = (num) => {
  return num !== "100%" && !isNaN(parseFloat(num));
};

const showToast = (msg: string) => {
  window?.antd?.message?.warning(msg);
};

enum IMAGE_MODE {
  ASPECTFILL = "aspectFill",
  OBJECTFIT = "objectFit",
  TOP = "top",
  LEFT = "left",
  RIGHT = "right",
  BOTTOM = "bottom",
  ASPECTFIT = "aspectFit",
  SCALETOFILL = "scaleToFill",
  WIDTHFIX = "widthFix",
  HEIGHTFIX = 'heightFix'
}

enum IMAGE_TYPE {
  CUT = 'cut',
  SCALE = 'scale',
  ADAPT = 'adapt'
}

const MODEL_MAP = {
  [IMAGE_TYPE.CUT]: [
    { label: "尽可能显示更多内容", value: IMAGE_MODE.ASPECTFILL },
    { label: "图片保持比例铺满", value: IMAGE_MODE.OBJECTFIT },
    // { label: "显示图片的顶部区域", value: IMAGE_MODE.TOP },
    // { label: "显示图片的左边区域", value: IMAGE_MODE.LEFT },
    // { label: "显示图片的右边区域", value: IMAGE_MODE.RIGHT },
    // { label: "显示图片的底部区域", value: IMAGE_MODE.BOTTOM },
    { label: "通过留白完整显示图片", value: IMAGE_MODE.ASPECTFIT },
  ],
  [IMAGE_TYPE.SCALE]: [{ label: "拉伸图片至填满宽高", value: IMAGE_MODE.SCALETOFILL }],
  [IMAGE_TYPE.ADAPT]: [{ label: "根据图片比例自动计算高度", value: IMAGE_MODE.WIDTHFIX }],
};

const getTypeFromMode = (mode) => {
  if (MODEL_MAP[IMAGE_TYPE.CUT].findIndex((item) => item.value === mode) > -1) {
    return IMAGE_TYPE.CUT;
  }

  if (MODEL_MAP[IMAGE_TYPE.SCALE].findIndex((item) => item.value === mode) > -1) {
    return IMAGE_TYPE.SCALE;
  }

  if (MODEL_MAP[IMAGE_TYPE.ADAPT].findIndex((item) => item.value === mode) > -1) {
    return IMAGE_TYPE.ADAPT;
  }

  return "";
};

// const ImageSelect = ({ options, value, onChange }) => {
//   return <div className={styles.imageSelect}></div>;
// };

export default function ({ editConfig }: EditorProps): any {
  const { value, options } = editConfig;
  /** getter获取默认数据 */
  const { mode: getterMode } = value.get?.() ?? {};
  // const [type, setType] = useState('');
  const [mode, setMode] = useState(getterMode);

  const { style = {} } = value.get?.() ?? {};

  const type = useMemo(() => {
    return getTypeFromMode(mode);
  }, [mode]);

  const styleRef = useRef({ width: style.width, height: style.height })
  /** style 变化后将 mode 重置到可用type的默认值 */
  useEffect(() => {
    if (styleRef.current.width !== style.width || styleRef.current.height !== style.height) {
      setMode(_mode => {
        if (style.height === 'auto') {
          value.set(IMAGE_MODE.WIDTHFIX);
          return IMAGE_MODE.WIDTHFIX
        } else {
          /** 如果不属于保持比例，就保持原样就行 */
          if (getTypeFromMode(_mode) !== IMAGE_TYPE.ADAPT) {
            value.set(_mode);
            return _mode
          } else {
            value.set(IMAGE_MODE.OBJECTFIT);
            return IMAGE_MODE.OBJECTFIT
          }
        }
        
      })
    }
    styleRef.current = { width: style.width, height: style.height }
  }, [style.width, style.height]);

  /** mode变化调用editor.setValue  */
  // useEffect(() => {
  //   value.set(mode);
  // }, [mode]);

  const [desc, subModes] = useMemo(() => {
    let desc = "";
    switch (true) {
      case type === IMAGE_TYPE.CUT: {
        desc = "裁剪模式，不改变原图比例，裁剪多余的内容";
        break;
      }
      case type === IMAGE_TYPE.SCALE: {
        desc = "拉伸模式，改变原图比例，拉伸图片撑满宽高";
        break;
      }
      case type === IMAGE_TYPE.ADAPT: {
        desc = "配置图片的宽或者高，自动计算另一边";
        break;
      }
    }

    let subModes = [];
    subModes = MODEL_MAP[type] ?? [];
    return [desc, subModes];
  }, [type]);

  const onChange = (_type) => {
    switch (true) {
      case _type === IMAGE_TYPE.CUT: {
        if (
          (isNumber(style.width) || style.width === "100%") &&
          isNumber(style.height)
        ) {
          // setType(_type)
          setMode(IMAGE_MODE.ASPECTFILL);
          value.set(IMAGE_MODE.ASPECTFILL);
          return;
        }
        showToast("裁剪模式需要固定宽高");
        return;
      }
      case _type === IMAGE_TYPE.SCALE: {
        if (
          (isNumber(style.width) || style.width === "100%") &&
          isNumber(style.height)
        ) {
          // setType(_type)
          setMode(IMAGE_MODE.SCALETOFILL);
          value.set(IMAGE_MODE.SCALETOFILL);
          return;
        }
        showToast("拉伸模式需要固定宽高");
        return;
      }
      case _type === IMAGE_TYPE.ADAPT: {
        if (
          (isNumber(style.width) || style.width === "100%") &&
          style.height === 'auto'
        ) {
          setMode(IMAGE_MODE.WIDTHFIX);
          value.set(IMAGE_MODE.WIDTHFIX);
          return;
        }
        
        showToast("保持比例需要固定宽度，高度适应内容");
        return;
      }
      default: {
        // setType('scale')
      }
    }
  };

  const changeCutMode = useCallback((v) => {
    setMode(v);
    value.set(v);
  }, []);


  return (
    <div className={styles.imageShow}>
      <Segmented
        style={{ fontSize: 12 }}
        options={[
          { label: "裁剪图片", value: IMAGE_TYPE.CUT },
          { label: "拉伸图片", value: IMAGE_TYPE.SCALE },
          { label: "保持比例", value: IMAGE_TYPE.ADAPT },
        ]}
        onChange={onChange}
        value={type}
        size="small"
      />
      <div className={styles.desc}>{desc}</div>
      {Array.isArray(subModes) && subModes.length > 0 && (
        <Select
          disabled={type !== IMAGE_TYPE.CUT}
          style={{ width: "100%" ,fontSize: 12}}
          options={subModes}
          value={mode}
          size="small"
          onChange={changeCutMode}
        ></Select>
      )}
    </div>
  );
};

