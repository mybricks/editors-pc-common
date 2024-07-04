import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const isEdited = useRef(false);

  const [indent2emUrl, setIndent2emUrl] = useState<string>();

  useEffect(() => {
    const CDN = 'https://f2.beckwai.com/udata/pkg/eshop/fangzhou/pub/pkg/tinymce/5.7.1/plugins/indent2em/plugin2.js';
    const platformAssetsUrl = '/mfs/editor_assets/richText/tinymce/5.7.1/plugins/indent2em/plugin.js';
    fetch(CDN, { method: 'HEAD' }).then(res => {
      if (res.ok) {
        console.log('CDN 链接地址可以访问');
        setIndent2emUrl(platformAssetsUrl);
      } else {
        console.log('CDN 链接地址无法访问');
        setIndent2emUrl(platformAssetsUrl);
      }
    }).catch(() => {
      console.log('CDN 链接地址无法访问');
      setIndent2emUrl(platformAssetsUrl);
    })
  }, [])

  const { value, options, upload, getDefaultOptions } = editConfig;
  const defaultOptions = useMemo(() => getDefaultOptions?.('richtext') ?? {}, []);

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
      isEdited.current = true;
    });

    editor.on("blur", () => {
      const content = editor.getContent({ format: "raw" });
      isEdited.current = false;
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
          isEdited.current = false;
          model.value.set(content);
          model.visible = !model.visible;
        },
      });
    });
  }, []);

  const getEditor = () => {
    const config = model.visible ? fullConfig : simpleConfig;
    return (
      <div
        className={`${css.commonEditor} ${model.type === "h5" ? css.h5 : css.pc
          } ${model.visible ? css.fullEditor : css.blockEditor}`}
      >
        <TinyEditor
          ref={containerRef}
          tinymceScriptSrc={defaultOptions?.CDN?.tinymce || tinymceCDN}
          // @ts-ignore
          onInit={(evt, editor) => (editorRef.current = editor)}
          initialValue={model.value.get()}
          init={{
            ...config,
            language_url: defaultOptions?.CDN?.language || config.language_url,
            content_style: options?.contentCss || defaultCss,
            setup,
            external_plugins: {
              'indent2em': indent2emUrl as string
            }
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
            let finalUrl = typeof url === 'string' ? url : url.url
            if (!finalUrl) {
              model.imgModalVisible = false;
              return;
            }
            const editor = editorRef.current;
            const img = editor.dom.createHTML("img", {
              src: finalUrl,
              style: "width: 100%",
            });
            editor.selection.setContent(img);
            const content = editor.getContent({ format: "raw" });
            model.val = content;
            isEdited.current = false;
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
  }

  useEffect(() => {
    if (model.visible && options.editConfig?.width !== void 0) {
      // @ts-ignore
      containerRef.current?.editor?.iframeElement.style.width =
        options.editConfig.width;
    }
  }, [containerRef.current, model.visible]);

  useEffect(() => {
    return () => {
      if (isEdited.current) {
        isEdited.current = false;
        model.value.set(model.val)
      }
    }
  }, [])


  if (!indent2emUrl) return <div />;
  return <>{model.visible ? createPortal(getEditor(), document.body) : getEditor()}</>;
}
