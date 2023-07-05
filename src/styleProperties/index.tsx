import React, { CSSProperties, useState } from "react";

// 已废弃
export default function ({ editConfig, env, ...rest }: any) {
  const { value, options = {} } = editConfig;

  const [style, setStyle] = useState(value.get() || {});

  const onChange = (style: CSSProperties) => {
    setStyle(style);
    value.set(style);
  };

  return <span>已废弃</span>;
}
