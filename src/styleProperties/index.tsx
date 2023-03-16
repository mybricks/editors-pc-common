import React, { CSSProperties, useState } from "react";
import StyleEditor from "@mybricks/style-editor";

export default function ({ editConfig, env, ...rest }: any) {
  const { value, options = {} } = editConfig;

  const [style, setStyle] = useState(value.get() || {});

  const onChange = (style: CSSProperties) => {
    setStyle(style);
    value.set(style);
  };

  return <StyleEditor options={options} value={style} onChange={onChange} />;
}
