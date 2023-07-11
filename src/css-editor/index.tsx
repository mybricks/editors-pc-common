import React, { useCallback, useRef, useState } from "react";
import MonacoEditor from "@mybricks/code-editor";
import { Tooltip } from "antd";
import { FullscreenOutlined } from "@ant-design/icons";
import { EditorProps } from "../interface";
import Icon from "./Icon";
import styles from "./index.less";

export default function ({ editConfig, env }: EditorProps): JSX.Element {
  const { value, options = {}, popView } = editConfig;
  const { renderType, title = "CSS样式编辑" } = options;
  const [zoomIn, setZoomIn] = useState<boolean>(false);
  const editorRef = useRef<MonacoEditor>();

  const onMounted = (editor: MonacoEditor) => {
    editorRef.current = editor;
  };

  const onChange = (val: string) => {
    value.set(val);
  };

  const onZoomIn = useCallback(() => {
    if (!zoomIn) {
      setZoomIn(true);
      popView(
        title,
        () => {
          return <div className={styles.modal}>{renderMonaco()}</div>;
        },
        { onClose }
      );
    }
  }, [zoomIn]);

  const onClose = () => {
    const val = editorRef.current?.getValue();
    value.set(val);
    setZoomIn(false);
  };

  const inlineRender = useCallback(() => {
    return (
      <div className={styles["inline-wrap"]}>
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <Tooltip title="放大编辑">
            <div className={styles.plus} onClick={onZoomIn}>
              <FullscreenOutlined />
            </div>
          </Tooltip>
        </div>
        <div className={styles.body}>{renderMonaco()}</div>
      </div>
    );
  }, [zoomIn, options]);

  const miniRender = () => {
    return (
      <div onClick={onZoomIn}>
        <Icon name="cssIcon" />
      </div>
    );
  };

  const renderMonaco = useCallback(() => {
    return (
      <MonacoEditor
        height="100%"
        env={env}
        onMounted={onMounted}
        value={value.get()}
        onChange={onChange}
        language="css"
      />
    );
  }, [options]);

  return (
    <div className={styles.wrap}>
      {renderType === "icon" ? miniRender() : inlineRender()}
    </div>
  );
}
