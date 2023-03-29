import React, { useState, useEffect, useCallback } from "react";
import { CodeEditor } from "@mybricks/expression-editor";
import HintPanel from "./hintPanel";
import { EditorProps } from "../interface";
import debounce from 'lodash/debounce'
import styles from "./index.less";

export default ({ editConfig }: EditorProps) => {
  const { value, options = {} } = editConfig;
  const valConfig = value.get();
  const { placeholder, runCode, suggestions: completions = [] } = options;
  const [_value, setValue] = useState<string>(
    typeof valConfig === "string" ? valConfig : valConfig?.value
  );
  const [showPanel, setShowPanel] = useState<boolean>(false);
  const [result, setResult] = useState<Record<string, any>>();
  const [markers, setMarkers] = useState<Array<Partial<{ message: string }>>>();

  useEffect(() => {
    runExpression(_value);
  }, [_value]);

  useEffect(() => {
    const closePanel = () => {
      setShowPanel(false)
    }
    document.body.addEventListener('click', closePanel, false)
    return () => {
      document.body.removeEventListener('click', closePanel)
    }
  }, [])

  const setHintModel = (
    showPanel: boolean,
    result: Record<string, any> | undefined,
    markers: Array<Partial<{ message: string }>> | undefined
  ) => {
    setShowPanel(showPanel);
    setResult(result);
    setMarkers(markers);
  };

  const runExpression = debounce((expression: string) => {
    if (!!expression) {
      try {
        if ("function" === typeof runCode) {
          const { success, error } = runCode(expression);
          if (!!error && JSON.stringify(error) !== '[]') {
            setHintModel(true, void 0, error);
            return;
          }
          if (success !== undefined) {
            setHintModel(true, success, markers);
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
  }, 200, { leading: true });

  const onChange = (_value: string) => {
    value.set(_value);
    setValue(_value);
  };
  return (
    <div className={styles.wrap}>
      <CodeEditor
        placeholder={placeholder}
        value={_value}
        onChange={onChange}
        completions={completions}
        theme={{
          focused: {
            outline: "1px solid #fa6400",
          }
        }}
      />
      <HintPanel showPanel={showPanel} result={result} markers={markers} />
    </div>
  );
};
