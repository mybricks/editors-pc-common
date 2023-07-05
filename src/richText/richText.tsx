import React, { useCallback, useEffect, useRef } from "react";
import { Editor as TinyEditor } from "@tinymce/tinymce-react";
import { Editor } from "tinymce";
import { EditorProps } from "../interface";
import { useComputed, useObservable } from "@mybricks/rxui";
import { defaultCss, fullConfig, simpleConfig, tinymceCDN } from "./constant";
import UploadModal from "../components/upload-modal";
import type { TinyMCE } from "tinymce";
import { createPortal } from "react-dom";
import css from "./style.less";

declare global {
  interface Window {
    tinyMCE: TinyMCE;
  }
}

export default function ({ editConfig }: EditorProps): JSX.Element {
  const editorRef = useRef<Editor>(null);
  const containerRef = useRef(null);

  const { value, options, upload } = editConfig;

  const model = useObservable({
    val: value.get(),
    value,
    type: options?.type || "pc",
    visible: false,
    imgModalVisible: false,
  });

  const setup = useCallback((editor: Editor) => {
    editor.on("keyup change", () => {
      const content = editor.getContent();
      model.val = content;
    });

    editor.on("blur", () => {
      const content = editor.getContent({ format: "raw" });
      model.value.set(content);
    });

    const { PluginManager } = window.tinyMCE;

    PluginManager.add("uploadimage", function (editor) {
      editor.ui.registry.addButton("uploadimage", {
        icon: "image",
        tooltip: "上传图片",
        onAction: () => {
          model.imgModalVisible = true;
        },
      });
    });

    PluginManager.add("full", function (editor) {
      editor.ui.registry.addButton("full", {
        icon: "fullscreen",
        tooltip: "全屏/退出全屏",
        onAction: () => {
          const content = editor.getContent({ format: "raw" });
          model.val = content;
          model.value.set(content);
          model.visible = !model.visible;
        },
      });
    });
  }, []);

  const editor = useComputed(() => {
    const config = model.visible ? fullConfig : simpleConfig;
    return (
      <div
        className={`${css.commonEditor} ${
          model.type === "h5" ? css.h5 : css.pc
        } ${model.visible ? css.fullEditor : css.blockEditor}`}
      >
        <TinyEditor
          ref={containerRef}
          tinymceScriptSrc={tinymceCDN}
          // @ts-ignore
          onInit={(evt, editor) => (editorRef.current = editor)}
          initialValue={model.value.get()}
          init={{
            ...config,
            content_style: options?.contentCss || defaultCss,
            setup,
          }}
        />
        <UploadModal
          type="image/*"
          title="上传图片"
          visible={model.imgModalVisible}
          value={""}
          onOk={(url) => {
            if (!editorRef.current) {
              model.imgModalVisible = false;
              return;
            }
            const editor = editorRef.current;
            const img = editor.dom.createHTML("img", {
              src: url,
              style: "width: 100%",
            });
            editor.selection.setContent(img);
            const content = editor.getContent({ format: "raw" });
            model.val = content;
            model.value.set(content);
            model.imgModalVisible = false;
          }}
          onCancel={() => {
            model.imgModalVisible = false;
          }}
          upload={upload}
        />
      </div>
    );
  });

  useEffect(() => {
    if (model.visible && options.editConfig?.width !== void 0) {
      // @ts-ignore
      containerRef.current?.editor?.iframeElement.style.width =
        options.editConfig.width;
    }
  }, [containerRef.current, model.visible]);

  useEffect(() => {
    return () => {
      model.value.set(model.val)
    }
  }, [])
  return <>{model.visible ? createPortal(editor, document.body) : editor}</>;
}
