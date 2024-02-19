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
    }
    if (isTsx) {
      path += "x";
    }
    return path
  }, [isTsx, language]);

  const defaultOptions = useMemo(() => getDefaultOptions?.("code") ?? {}, []);

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
        return {
          code: encodedValue,
          transformCode: safeEncoder(
            `(function() { var _RTFN_; \n${code}\n; return _RTFN_; })()`
          ),
        };
      } catch (error) {
        console.error("[transform code error]", error);
        return encodedValue;
      }
    },
    [babel, fnParams, language]
  );

  const updateValue = useCallback(async () => {
    const code = codeIns.current?.editor.getValue();
    const val = await transform(code);
    value.set(val);
  }, []);

  const onChange = (value: UnionString, ev: any) => {
    setCode(value);
  };

  const onBlur = async (editor: editor) => {
    updateValue();
    typeof options.onBlur === "function" && options.onBlur();
  };

  const onOpen = useCallback(async () => {
    updateValue();
  }, []);

  const onClose = useCallback(async () => {
    setOpen(false);
    updateValue();
  }, []);

  const onPreview = useCallback(async () => {
    updateValue();
  }, []);

  const onFormat = useCallback(() => {
    if (codeIns!.current) {
      codeIns!.current.format();
    }
  }, []);

  return (
    <Editor
      ref={codeIns}
      loaderConfig={{ paths: defaultOptions.CDN?.paths }}
      eslint={{
        src: defaultOptions.CDN?.eslint,
      }}
      babel={{ standalone: defaultOptions.CDN?.babel }}
      value={code}
      modal={{
        open,
        width: 1200,
        title: title ?? "编辑代码",
        inside: true,
        onOpen,
        onClose,
      }}
      language={language}
      extraLib={`${LegacyLib}\n${extraLib}`}
      isTsx={isTsx}
      onBlur={onBlur}
      onChange={onChange}
      options={{ readonly, fontSize: 13 }}
      comment={{
        value: comments,
      }}
      theme="light"
      height={height}
      toolbar={
        <>
          {preview && <Icon name="preview" onClick={onPreview} />}
          <Icon name="format" onClick={onFormat} />
        </>
      }
      className={styles.editor}
      path={path}
    >
      {displayType === "button" ? (
        <button className={styles.button} onClick={() => setOpen(true)}>
          {title}
        </button>
      ) : (
        void 0
      )}
    </Editor>
  );
}