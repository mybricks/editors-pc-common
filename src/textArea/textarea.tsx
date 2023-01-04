import React, {useMemo, useCallback, useEffect, useRef} from "react";

import {Input} from "antd";
import {debounce} from "../util/lodash";
import {EditorProps} from "../interface";
import {useObservable} from "@mybricks/rxui";
import {getOptionsFromEditor, isValid} from "../utils";

import css from "./index.less";

export default function ({editConfig}: EditorProps): JSX.Element {
  const {value, options = {}} = editConfig;
  const model = useObservable(
    {val: isValid(value.get()) ? value.get() : "", value},
    [value]
  )

  const {
    readonly = false,
    style = {
      height: 100,
    },
    ...res
  } = getOptionsFromEditor(options);

  const styles = useMemo(() => {
    const {height = 100} = style;

    return {
      height,
    };
  }, []);

  const changedRef = useRef<HTMLInputElement>()

  const updateVal = useCallback((evt) => {
    model.value.set(evt.target.value)
    changedRef.current = void 0
  }, [])

  useEffect(() => {
    return () => {
      if (changedRef.current) {
        model.value.set(changedRef.current.value)
        changedRef.current = void 0
      }
    }
  }, [])

  return (
    <div className={css["editor-textArea"]}>
      <Input.TextArea
        style={styles}
        onChange={evt => {
          changedRef.current = evt.target
        }}
        onBlur={(evt) => {
          updateVal(evt)
        }}
        disabled={readonly}
        defaultValue={model.val}
        {...res}
      />
    </div>
  );
}
