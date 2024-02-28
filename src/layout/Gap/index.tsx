import React, { CSSProperties } from "react";
import InputNumber from "./InputNumber";
import Icon from "../Icon";
import styles from "./index.less";

type Value = Partial<{
  rowGap: CSSProperties["rowGap"];
  columnGap: CSSProperties["columnGap"];
}>;

export interface GapProps {
  value: Value;
  onChange: (value: Value) => void;
  flexDirection: CSSProperties["flexDirection"];
}
export default ({ value, onChange, flexDirection }: GapProps) => {
  return (
    <div className={styles.gap}>
      <InputNumber
        addonBefore={<Icon name="column-gap" />}
        //addonAfter={"px"}
        disabled = {flexDirection === "column"}
        tooltip="列间距"
        className={styles.input}
        value={value.columnGap}
        onChange={(v) => onChange({ ...value, columnGap: v })}
      /> 
      <InputNumber
        addonBefore={<Icon name="row-gap" />}
        //addonAfter={"px"}
        disabled = {flexDirection === "row"}
        tooltip="行间距"
        className={styles.input}
        value={value.rowGap}
        onChange={(v) => onChange({ ...value, rowGap: v })}
      />
    </div>
  );
};
