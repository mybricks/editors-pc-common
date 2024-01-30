import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import HintPanel from "./hintPanel";
import { EditorProps } from "../interface";
import debounce from "lodash/debounce";
import { world } from './icons'
import { loadPkg } from "../util/loadPkg";
import { Spin } from "antd";
import styles from "./index.less";

export default ({ editConfig }: EditorProps) => {
  const { value, options = {}, getDefaultOptions, locales } = editConfig;
  const valConfig = value.get();
  const [CodeEditor, setCodeEditor] = useState<any>();
  const {
    placeholder,
    runCode,
    suggestions: completions = [],
    locale = false,
  } = useMemo(() => {
    if (typeof options === "function") {
      return options.apply(null);
    } else {
      return options;
    }
  }, [options]);
  const defaultOptions = useMemo(() => getDefaultOptions?.('expression') || {}, []);
  const localeEnable = !!locales && !!locale
  const initValue = useMemo(() => {
    if (localeEnable && valConfig.id) {
      const item = locales.searchById(valConfig.id)
      return item ? item.getContent('zh') : `<未找到文案>`
    } else {
      return typeof valConfig === "string" ? valConfig : valConfig?.value
    }
  }, [])
  const [_value, setValue] = useState<string>(initValue);
  const [useLocale, setUseLocale] = useState(!!(localeEnable && valConfig.id))
  const useLocalRef = useRef<any>(useLocale)
  const [showPanel, setShowPanel] = useState<boolean>(false);
  const [result, setResult] = useState<Record<string, any>>();
  const [markers, setMarkers] = useState<Array<Partial<{ message: string }>>>();
  const [loading, setLoading] = useState<boolean>(false);
  useEffect(() => {
    const name: string = "CodeEditor";
    setLoading(true);
    loadPkg(
      defaultOptions.CDN?.codemirror || "//f2.beckwai.com/udata/pkg/eshop/fangzhou/pub/pkg/codemirror/1.0.13/index.min.js",
      name
    )
      .then((res: any) => {
        setCodeEditor(res?.CodeEditor || res?.default);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    runExpression(_value);
  }, [_value]);

  useEffect(() => {
    const closePanel = () => {
      setShowPanel(false);
    };
    document.body.addEventListener("click", closePanel, false);
    return () => {
      document.body.removeEventListener("click", closePanel);
    };
  }, []);

  const openLocale = useCallback(e => {
    if (!locales?.edit) {
      console.error(`未找到 locales.edit`)
      return
    }
    locales.edit({
      value: {
        get() {
          return valConfig
        },
        set(item) {
          if (item) {
            setUseLocale(true)
            useLocalRef.current = true
            setValue(item.getContent('zh'))

            value.set({
              id: item.id
            })
          } else {
            setUseLocale(false)
            useLocalRef.current = false
            setValue('')
            value.set('')
          }
        }
      }
    })
  }, [_value])

  const setHintModel = (
    showPanel: boolean,
    result: Record<string, any> | undefined,
    markers: Array<Partial<{ message: string }>> | undefined
  ) => {
    setShowPanel(showPanel);
    setResult(result);
    setMarkers(markers);
  };

  const runExpression = debounce(
    (expression: string) => {
      if (!!expression) {
        try {
          if ("function" === typeof runCode) {
            const { success, error } = runCode(expression);
            if (!!error && JSON.stringify(error) !== "[]") {
              setHintModel(true, void 0, error);
              return;
            }
            if (success !== undefined) {
              setHintModel(true, success, void 0);
              return;
            }
          } else {
            setHintModel(false, void 0, void 0);
          }
        } catch (error: any) {
          setHintModel(true, void 0, error);
        }
      } else {
        setHintModel(false, void 0, void 0);
      }
    },
    200,
    { leading: true }
  );

  const onChange = (_value: string) => {
    setValue(_value);
    // 传给编辑器的onChange方法不会变化，所以需要在此处使用uselocal的引用
    if (!useLocalRef.current) {
      value.set(_value)
    }
  };

  return (
    <div className={styles.wrap}>
      <Spin spinning={loading}>
        {CodeEditor && (
          <CodeEditor
            placeholder={placeholder}
            value={_value}
            onChange={onChange}
            completions={completions}
            editable={!useLocale}
            theme={{
              focused: {
                outline: "1px solid #fa6400",
              },
            }}
          />

        )}
        {
          localeEnable ? (
            <span className={`${useLocale ? styles.useLocale : ''} ${styles.icon}`}
              onClick={openLocale}
              data-mybricks-tip={`多语言`}>
              {world}
            </span>
          ) : null
        }
      </Spin>
      <HintPanel showPanel={showPanel} result={result} markers={markers} />
    </div>
  );
};
