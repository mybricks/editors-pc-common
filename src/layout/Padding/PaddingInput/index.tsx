import React from "react";
import styles from "./index.less";
export type InputNumberProps = Partial<{
  addonBefore: React.ReactNode | string;
  addonAfter: React.ReactNode | string;
  value: any;
  className: string;
  tooltip: string;
  disabled: boolean;
  onChange: (value: any) => void;
  model: any;
}>;
export default ({
  addonBefore,
  addonAfter,
  value,
  className,
  tooltip,
  onChange,
  disabled,
  model
}: InputNumberProps) => {
  const handleBlur = (e: any) => {
    const value = e.target.value;
    typeof onChange === "function" &&
      onChange(value.trim() ? parseFloat(value) : 0);
  };

  const handleOnChange = (e: any) => {
    const value = e.target.value;
    typeof onChange === "function" &&
      onChange(value.trim() ? parseFloat(value) : value);
  }
  
  const valueOpt = (()=>{
    const valueArr = Object.values(value);
    const keyArr = Object.keys(value);
    if(valueArr[0] !== valueArr[1]){
      model[keyArr[0]] = valueArr[0];
      model[keyArr[1]] = valueArr[0];
    }
    return valueArr[0]
  })

  return (
    <div
      className={`${styles.inputNumber} ${className}`}
      style={{ 
        opacity: disabled ? 0.2 : void 0,
        cursor: disabled ? 'not-allowed' : void 0
      }}
      data-mybricks-tip={tooltip}
    >
      {addonBefore}
      <input 
        type="number"
        value={valueOpt()}
        onChange={handleOnChange}
        onBlur={handleBlur}
        disabled={disabled}
        //style={{paddingLeft: '20px'}}
      />
    </div>
  );
};