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
}>;
export default ({
  addonBefore,
  addonAfter,
  value,
  className,
  tooltip,
  onChange,
  disabled
}: InputNumberProps) => {
  // const handleBlur = (e: any) => {
  //   const value = e.target.value;
  //   //纯数字
  //   if(typeof onChange === "function" && !isNaN(Number(value))){
  //     onChange(value.trim() ? parseFloat(value) : 0);
  //   }

  //   //对文本进行判断
  //   if(typeof onChange === "function" && value.indexOf(',') !== -1 && isNaN(Number(value))){
  //     if(value.match(/,/g,"").length === 1){
  //       console.log('123')
  //       let arr = value.split(',');
  //       console.log('arr',arr);
  //       console.log('arr11',arr[0].trim() ? parseFloat(arr[0]) : 0 + ','+ arr[1].trim() ? parseFloat(arr[1]) : 0);
  //       onChange((arr[0].trim() && !isNaN(Number(arr[0])) ? parseFloat(arr[0]) : 0) + ','+ (arr[1].trim()&& !isNaN(Number(arr[0])) ? parseFloat(arr[1]) : 0));
  //     }else{
  //       onChange(0)
  //     }
  //   }
  // };

  // const handleOnChange = (e: any) => {
  //   const value = e.target.value;
  //   typeof onChange === "function" &&
  //     onChange(value);
  // }

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
    // console.log('value',value);
    const valueArr = Object.values(value);
    // if(valueArr[0] === valueArr[1]){
    //   return valueArr[0]
    // }else{
    //   return valueArr[0] + ',' + valueArr[1]
    // }
    return valueArr[0]
  })

  return (
    <div
      className={`${styles.inputNumber} ${className}`}
      style={{ 
        opacity: disabled ? 0.2 : void 0,
        //backgroundColor: disabled ? '#d9d9d9' : void 0,
        cursor: disabled ? 'not-allowed' : void 0
      }}
      data-mybricks-tip={tooltip}
    >
      {addonBefore}
      <input 
        value={valueOpt()} 
        onChange={handleOnChange}
        onBlur={handleBlur} 
        disabled={disabled}
        style={{paddingLeft: '20px'}}
      />
    </div>
  );
};