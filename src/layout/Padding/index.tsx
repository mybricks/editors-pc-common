import React, { CSSProperties } from "react";
import InputNumber from "./InputNumber";
import PaddingInput from "./PaddingInput";
import Icon from "../Icon";
import styles from "./index.less";

type Value = Partial<{
  paddingTop: CSSProperties["paddingTop"];
  paddingRight: CSSProperties["paddingRight"];
  paddingBottom: CSSProperties["paddingBottom"];
  paddingLeft: CSSProperties["paddingLeft"];
}>;

export interface PaddingProps {
  paddingType: 'independentPadding' | 'dependentPadding';
  onPaddingToggle: (padding: 'independentPadding' | 'dependentPadding') => void;
  value: Value,
  onChange: (value: Value) => void;
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

  const onChangeHandle = (v:string)=>{
    if(!isNaN(Number(v))){
      return onChange({ ...value, paddingLeft: v, paddingRight: v})
    }

    if(v.indexOf(',') !== -1 && isNaN(Number(v))){
      if(v.match(/,/g,"").length === 1){
        let arr = v.split(',');
        onChange({ ...value, paddingLeft: parseFloat(arr[0]), paddingRight: parseFloat(arr[1])});
      }else{
        onChange({ ...value, paddingLeft: 0, paddingRight: 0})
      }
    }
  }
    

    


  return (
    <div className={styles.gap}>
      {
        paddingType === 'independentPadding' ? 
        <div style={{display: 'flex', flexDirection: 'row'}}>
          <div style={{width: '112px', marginRight: '10px'}}>
            <PaddingInput
              addonBefore={<Icon name="paddingColumn" />}
              tooltip="上下边距"
              className={styles.input}
              value={{paddingTop: value.paddingTop, paddingBottom: value.paddingBottom}}
              onChange={(v) => onChange({ ...value, paddingTop: v, paddingBottom: v})}
            />
          </div>
          <div style={{width: '95px', marginRight: '5px'}}>
            <PaddingInput
              addonBefore={<Icon name="paddingRow" />}
              tooltip="左右边距"
              className={styles.input}
              value={{paddingLeft: value.paddingLeft, paddingRight: value.paddingRight}}
              onChange={(v) => onChange({ ...value, paddingLeft: v, paddingRight: v})}
            />
          </div>
        </div>
      :  defaultPadding.map(({ title, name, render }) => (
        <div style={{width: '45px', marginRight: '10px'}}>
          <InputNumber
            addonBefore={render()}
            tooltip={title}
            className={styles.input}
            value={value[name]}
            onChange={(v) => onChange({ ...value, [name]: v })}
          />
        </div>
      ))
        }
        {renderPaddingIcon()}
    </div>
  );
};