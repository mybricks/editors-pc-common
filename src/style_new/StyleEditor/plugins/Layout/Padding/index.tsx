import React, { CSSProperties } from "react";
import { InputNumber } from "../../../components";
import Icon from "../Icon";
import styles from "./index.less";

type Value = Partial<{
  paddingTop: CSSProperties["paddingTop"] | null;
  paddingRight: CSSProperties["paddingRight"] | null;
  paddingBottom: CSSProperties["paddingBottom"] | null;
  paddingLeft: CSSProperties["paddingLeft"] | null;
}>;

export interface PaddingProps {
  paddingType: 'independentPadding' | 'dependentPadding';
  onPaddingToggle: (padding: 'independentPadding' | 'dependentPadding') => void;
  value: Value,
  onChange: (value: Value) => void;
}
const PX_UNIT_OPTIONS = [{ label: "px", value: "px" }];

function toInputValue(value: CSSProperties["paddingTop"] | null): string | undefined {
  // 清空后传入 undefined，让公共 InputNumber 回到“默认”占位态。
  if (value == null || value === "") return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

export default ({paddingType, onPaddingToggle, value, onChange  }: PaddingProps) => {

  const defaultPadding = [
    {
      title: "上边距",
      name: "paddingTop",
      render: () => <Icon name="paddingTop"/>
    },
    {
      title: "右边距",
      name: "paddingRight",
      render: () => <Icon name="paddingRight" />,
    },
    {
      title: "下边距",
      name: "paddingBottom",
      render: () => <Icon name="paddingBottom" />,
    },
    {
      title: "左边距",
      name: "paddingLeft",
      render: () => <Icon name="paddingLeft" />,
    },
  ];

  const renderPaddingIcon = () => {
    const title = paddingType === 'independentPadding' ? "非独立边距" : "独立边距";
    return (
      <div
        data-mybricks-tip={title}
        className={`${styles.padding} ${
          paddingType === 'dependentPadding' ? styles.selected : ""
        }`}
        onClick={() => onPaddingToggle(paddingType === 'independentPadding' ? 'dependentPadding' : 'independentPadding')}
      >
        <Icon name="paddingType" />
      </div>
    );
  };

  return (
    // <div className={styles.gap}>
    //   {
    //     paddingType === 'independentPadding' ? 
    //       <div style={{display: 'flex', flexDirection: 'row'}}>
    //         <div 
    //           style={{width: '112px', marginRight: '10px'}}
    //           //style={{width: '86px', marginRight: '10px'}}
    //         >
    //           <PaddingInput
    //             addonBefore={<Icon name="paddingColumn" />}
    //             tooltip="上下边距"
    //             className={styles.input}
    //             value={{paddingTop: value.paddingTop, paddingBottom: value.paddingBottom}}
    //             onChange={(v) => onChange({ ...value, paddingTop: v, paddingBottom: v})}
    //             model={model}
    //           />
    //         </div>
    //         <div style={{width: '95px', marginRight: '5px'}}>
    //           <PaddingInput
    //             addonBefore={<Icon name="paddingRow" />}
    //             tooltip="左右边距"
    //             className={styles.input}
    //             value={{paddingLeft: value.paddingLeft, paddingRight: value.paddingRight}}
    //             onChange={(v) => onChange({ ...value, paddingLeft: v, paddingRight: v})}
    //             model={model}
    //           />
    //         </div>
    //       </div>
    //     :  defaultPadding.map(({ title, name, render }) => (
    //       <div style={{width: '45px', marginRight: '10px'}}>
    //         <InputNumber
    //           addonBefore={render()}
    //           tooltip={title}
    //           className={styles.input}
    //           value={value[name]}
    //           onChange={(v) => onChange({ ...value, [name]: v })}
    //           model={model}
    //         />
    //       </div>
    //     ))
    //   }
    //     {renderPaddingIcon()}
    // </div>

    <div className={styles.gap}>
      {defaultPadding.map(({ title, name, render }) => (
        <div className={styles.input} style={{width: '52px', marginRight: '10px'}}>
          <InputNumber
            prefix={render()}
            tip={title}
            style={{ padding: "0 8px" }}
            type="number"
            value={toInputValue(value[name])}
            defaultValue={toInputValue(value[name])}
            defaultUnitValue="px"
            unitOptions={PX_UNIT_OPTIONS}
            // 0 也是有效回显值，需要保留“默认”入口；空值时公共组件会自动隐藏入口。
            clearable
            onChange={(next) =>
              onChange({
                ...value,
                [name]: next == null ? null : next,
              })
            }
          />
        </div>
      ))}
    </div>
  );
};
