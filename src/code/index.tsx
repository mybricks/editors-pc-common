import React, { useEffect, useCallback, useMemo, useRef, useState } from "react";
import Editor, { HandlerType, editor, Icon, registerCopilot, Monaco } from "/Users/lianglihao/Documents/GitHub/coder/src";
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
  const { value, options = {}, getDefaultOptions, aiView } = editConfig;
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

  const [editor, setEditor] = useState<editor>();
  const [monaco, setMonaco] = useState<Monaco>();

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

  useEffect(() => {
    if (!monaco || !editor || !aiView?.request) return;
    const request = aiView.request;
    const dispose = registerCopilot(monaco, editor, {
      language: "typescript",
      async fetchCompletions({ codeBeforeCursor, codeAfterCursor }: { codeBeforeCursor: string, codeAfterCursor: string }) {
        const codeBeforeCursorSplitStrings = codeBeforeCursor.split("\n");
        const lastCode = codeBeforeCursorSplitStrings[codeBeforeCursorSplitStrings.length - 2].trim();

        if (lastCode.includes("//")) {
          const messages = [
            {
              role: "system",
              content: "你是一名资深的前端程序员，请根据当前给到的单ts文件代码的上下两部分以及类型提示进行分析，给出合适的在中间可续写可运行的代码推荐（可以包含注释）\n" + 
              "当前上下文的类型定义为:" +
              // `${LegacyLib}\n${extraLib}\n` +
              `${extraLib}\n` +
              "上部分代码为:\n" +
              `${codeBeforeCursor}\n` +
              "下部分代码为:\n" +
              `${codeAfterCursor}\n` +
              "[要求]\n" + 
              "1：回答简洁，如非必要、无需任何额外建议;\n" + 
              "2：返回的代码不需要有```包裹，因为是直接用在代码编辑器中;\n" + 
              "3：返回的代码不需要ts类型定义，仅js即可;\n " + 
              "4：返回的代码必须能和上下部分代码顺利拼接上，不能有语法错误，请严格自查;"
              // "4：必须是顺利续写的代码;\n" + 
              // "  以下仅举例，应该根据具体上下文返回：" +
              // "  前段代码为: function sum(\n" + 
              // "  返回的结果: a, b) { return a+b; }"
            },
            {
              role: "user",
              content: "请给出合理的可行的代码续写推荐"
            }
          ]

          const res = await request(messages)
          return [{
            code: res,
          }]
        } else {
          return []
        }
      }
    });
    return () => {
      dispose();
    };
  }, [monaco, editor]);

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
    <div className={!showBtn ? styles.wrapper : void 0}>
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
                closeIcon: <Icon name="zoom" data-mybricks-tip="缩小"/>,
                extra: <Icon name="format" data-mybricks-tip="格式化" onClick={onFormat} />,
                onOpen,
                onClose,
                contentClassName: styles.dialog
              }
            : void 0
        }
        language={language}
        extraLib={`${LegacyLib}\n${extraLib}`}
        isTsx={isTsx}
        onMount={(editor, monaco) => {
          // console.log("编辑器初始化: ", {
          //   editor,
          //   monaco
          // })
          // console.log("类型提示: ", {
          //   LegacyLib,
          //   extraLib
          // })
          setEditor(editor);
          setMonaco(monaco);
        }}
        onBlur={onBlur}
        onChange={onChange}
        options={{ readonly, fontSize: 13 }}
        comment={{
          value: comments,
          className: styles.comment,
        }}
        theme={theme ?? "light"}
        height={height}
        className={styles.editor}
        wrapperClassName={showBtn ? styles["btn-wrapper"] : styles['editor-wrapper']}
        path={path}
        resizable={!showBtn}
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
          <span data-mybricks-tip="展开">
            <Icon className={styles.icon} name="plus" onClick={onOpen} />
          </span>
        </div>
      )}
    </div>
  );
}
