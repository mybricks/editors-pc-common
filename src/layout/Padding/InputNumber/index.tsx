import React, { useState } from "react";
import styles from "./index.less";
export type InputNumberProps = Partial<{
  addonBefore: React.ReactNode | string;
  addonAfter: React.ReactNode | string;
  value: number | string | undefined;
  className: string;
  tooltip: string;
  disabled: boolean;
  onChange: (value: number) => void;
  onBlur: (value: number) => void;
}>;
export default ({
  addonBefore,
  addonAfter,
  value,
  className,
  tooltip,
  onChange,
  onBlur,
  disabled
}: InputNumberProps) => {
  const [isFocus, setIsFocus] = useState(false);

  const handleFocus = () => {
    setIsFocus(true)
  }

  const handleOnBlur = (e: any) => {
    setIsFocus(false)
    const value = e.target.value;
    typeof onBlur === "function" &&
      onBlur(value.trim() ? parseFloat(value) : 0);
  };

  const handleOnChange = (e: any) => {
    const value = e.target.value;
    typeof onChange === "function" &&
      onChange(value.trim() ? parseFloat(value) : value);
  }
  
  return (
    <div
      className={`${styles.inputNumber} ${className} ${isFocus ? styles.focus : void 0}`}
      style={{ 
        opacity: disabled ? 0.2 : void 0,
        cursor: disabled ? 'not-allowed' : void 0
      }}
      data-mybricks-tip={tooltip}
    >
      {addonBefore}
      <input
        type="number" 
        value={value} min={0} 
        onChange={handleOnChange}
        onBlur={handleOnBlur} 
        onFocus={handleFocus}
        disabled={disabled}
      />
    </div>
  );
};