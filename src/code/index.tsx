import React, { useCallback, useMemo, useRef, useState } from "react";
import Editor, { HandlerType, editor, Icon } from "@mybricks/coder";
import { LegacyLib } from "./legacyLib";
import {
  getComputedValue,
  formatValue,
  getFnString,
  safeEncoder,
} from "./util";
import styles from "./index.less";

type UnionString = string | undefined;

export default function ({ editConfig }: any): JSX.Element {
  const { value, options = {}, getDefaultOptions } = editConfig;
  const {
    title,
    displayType,
    readonly,
    comments,
    language = "javascript",
    extraLib,
    babel,
    fnParams,
    isTsx,
    preview,
    height,
    theme,
  } = options;
  const codeIns = useRef<HandlerType>(null);
  const [code, setCode] = useState<UnionString>(() =>
    getComputedValue(value.get())
  );

  const [open, setOpen] = useState<boolean>(false);

  const path = useMemo(() => {
    let path = `file:///${Math.random()}_code`;
    if (language === "typescript") {
      path += ".ts";
    } else if (language === "javascript") {
      path += ".js";
    } else {
      path += `.${language}`;
    }
    if (isTsx) {
      path += "x";
    }
    return path;
  }, [isTsx, language]);

  const defaultOptions = useMemo(() => getDefaultOptions?.("code") ?? {}, []);

  const showBtn = useMemo(() => {
    return displayType === "button";
  }, [displayType]);

  const transform = useCallback(
    async (value: UnionString) => {
      if (!value) return value;
      const encodedValue = safeEncoder(value);
      const { babel } = options;
      if (!babel || !["javascript", "typescript"].includes(language))
        return encodedValue;
      try {
        const _value = formatValue(getFnString(value, fnParams));
        const code = await codeIns.current?.compile(_value);
        if (code) {
          return {
            code: encodedValue,
            transformCode: safeEncoder(
              `(function() { var _RTFN_; \n${code}\n; return _RTFN_; })()`
            ),
          };
        }
        return encodedValue;
      } catch (error) {
        console.error("[transform code error]", error);
        return encodedValue;
      }
    },
    [babel, fnParams, language]
  );

  const updateValue = useCallback(async (current?: string) => {
    const code = current ?? codeIns.current?.editor.getValue();
    const val = await transform(code);
    value.set(val);
  }, []);

  const onChange = (value: UnionString, ev: any) => {
    setCode(value);
  };

  const onBlur = useCallback(async (editor: editor) => {
    await updateValue(editor.getValue());
    typeof options.onBlur === "function" && options.onBlur();
  }, []);

  const onOpen = useCallback(async () => {
    await updateValue();
    setOpen(true);
  }, []);

  const onClose = useCallback(async () => {
    await updateValue();
    setOpen(false);
  }, []);

  const onPreview = useCallback(() => {
    updateValue();
  }, []);

  const onFormat = useCallback(() => {
    if (codeIns!.current) {
      codeIns!.current.format();
    }
  }, []);

  return (
    <div className={!showBtn ? styles.wrap : void 0}>
      <Editor
        ref={codeIns}
        loaderConfig={{ paths: defaultOptions.CDN?.paths }}
        eslint={{
          src: defaultOptions.CDN?.eslint,
        }}
        babel={{ standalone: defaultOptions.CDN?.babel }}
        value={code}
        modal={
          options.modal !== false
            ? {
                open,
                width: 1200,
                title: title ?? "编辑代码",
                inside: true,
                onOpen,
                onClose,
              }
            : void 0
        }
        language={language}
        extraLib={`${LegacyLib}\n${extraLib}`}
        isTsx={isTsx}
        onBlur={onBlur}
        onChange={onChange}
        options={{ readonly, fontSize: 13 }}
        comment={{
          value: comments,
          height: 300,
        }}
        theme={theme ?? "light"}
        height={height}
        className={styles.editor}
        path={path}
      >
        {showBtn ? (
          <button className={styles.button} onClick={() => setOpen(true)}>
            {title}
          </button>
        ) : (
          void 0
        )}
      </Editor>
      {!showBtn && (
        <div className={styles.toolbar}>
          {preview && (
            <span data-mybricks-tip="预览">
              <Icon
                className={styles.icon}
                name="preview"
                onClick={onPreview}
              />
            </span>
          )}
          <span data-mybricks-tip="格式化">
            <Icon className={styles.icon} name="format" onClick={onFormat} />
          </span>
          <span data-mybricks-tip="放大编辑">
            <Icon className={styles.icon} name="plus" onClick={onOpen} />
          </span>
        </div>
      )}
    </div>
  );
}