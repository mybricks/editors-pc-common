import React, { CSSProperties } from "react";
import InputNumber from "./InputNumber";
import Icon from "../Icon";
import { useDragNumber } from "../../style_new/StyleEditor/hooks";
import styles from "./index.less";

type Value = Partial<{
  rowGap: CSSProperties["rowGap"];
  columnGap: CSSProperties["columnGap"];
}>;

export interface GapProps {
  value: Value;
  onChange: (value: Value) => void;
  onBlur: (value: Value) => void;
  flexDirection: CSSProperties["flexDirection"];
}
export default ({ value, onChange, onBlur, flexDirection }: GapProps) => {
  const getDragProps = useDragNumber({ continuous: true });

  return (
    <div className={styles.gap}>
      {flexDirection === "row" && <InputNumber
        addonBefore={
          <div {...getDragProps(value.columnGap, "拖拽调整列间距")}>
            <Icon name="column-gap" />
          </div>
        }
        tooltip="列间距"
        className={styles.input}
        value={value.columnGap}
        onChange={(v) => onChange({ ...value, columnGap: v })}
        onBlur={(v) => onBlur({ ...value, columnGap: v })}
      />}

      {flexDirection === "column" && <InputNumber
        addonBefore={
          <div {...getDragProps(value.rowGap, "拖拽调整行间距")}>
            <Icon name="row-gap" />
          </div>
        }
        tooltip="行间距"
        className={styles.input}
        value={value.rowGap}
        onChange={(v) => onChange({ ...value, rowGap: v })}
        onBlur={(v) => onBlur({ ...value, rowGap: v })}
      />}
    </div>
  );
};
