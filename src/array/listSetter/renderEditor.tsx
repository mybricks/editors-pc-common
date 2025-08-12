import { EditConfig } from "@/interface";
import { InfoCircleOutlined } from "@ant-design/icons";
import React, { useContext, useEffect, useMemo, useState } from "react";
import AryContext from "./../context";
import DefaultEditors from "./defaultEditors";
import css from "./index.less";

const useModel = ({ value, onChange }: { value: any; onChange: Function }) => {
  const [closure, setClosure] = useState(value);

  useEffect(() => {
    setClosure(value);
  }, [value]);

  const model = useMemo(() => {
    return {
      get: () => {
        return closure;
      },
      set: (newVal: any) => {
        typeof onChange === "function" && onChange(newVal);
        setClosure(newVal);
      },
    };
  }, [closure, onChange]);

  return model;
};

export default ({
  editConfig = {} as EditConfig,
  extraContext,
  value,
  onChange,
  showTitle = true,
}: {
  editConfig: EditConfig;
  extraContext: any;
  value: any;
  onChange: (val: any) => void;
  showTitle?: boolean;
}) => {
  const { injectEditors } = useContext(AryContext);

  const model = useModel({
    value,
    onChange,
  });

  const Editors = useMemo(() => {
    return injectEditors || DefaultEditors;
  }, [injectEditors, DefaultEditors]);

  const editorProps = {
    editConfig: {
      ...editConfig,
      // [TODO] 临时把array的text转到textinput里
      type:
        editConfig.type.toLowerCase() === "text"
          ? "textinput"
          : editConfig.type,
      options:
        typeof editConfig.options === "function" // 支持options为函数的情况
          ? editConfig.options() || {}
          : editConfig.options,
      value: model,
    },
    ...(extraContext || {}),
  };

  const Component =
    window?.__editorAppender__?.(editorProps) ?? Editors(editorProps);

  return (
    <div className={css.item} style={editConfig.css}>
      {Component?.render ? (
        Component.render
      ) : (
        <>
          {showTitle && (
            <FormItemTitle
              title={editConfig.title}
              description={editConfig?.description}
            />
          )}
          <div className={css.itemContent}>{Component}</div>
        </>
      )}
    </div>
  );
};

export function FormItemTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className={css.itemDesc}>
      <span className={css.itemTitle}>{title}</span>
      {description && (
        <div data-mybricks-tip={description} className={css.description}>
          <InfoCircleOutlined />
        </div>
      )}
    </div>
  );
}
