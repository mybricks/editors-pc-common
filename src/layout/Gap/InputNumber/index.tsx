import React from "react";
import styles from "./index.less";
export type InputNumberProps = Partial<{
  addonBefore: React.ReactNode | string;
  addonAfter: React.ReactNode | string;
  value: number;
  className: string;
  tooltip: string;
  onChange: (value: number) => void;
}>;
export default ({
  addonBefore,
  addonAfter,
  value,
  className,
  tooltip,
  onChange,
}: InputNumberProps) => {
  const handleChange = (e: any) => {
    const value = e.target.value;
    typeof onChange === "function" &&
      onChange(value.trim() ? parseFloat(value) : 0);
  };
  return (
    <div
      className={`${styles.inputNumber} ${className}`}
      data-mybricks-tip={tooltip}
    >
      {addonBefore}
      <input type="number" value={value} min={0} onChange={handleChange} />
      {addonAfter}
    </div>
  );
};
