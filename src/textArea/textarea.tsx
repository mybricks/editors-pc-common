import React, { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { world } from './icons'
import { Input } from "antd";
import { debounce } from "../util/lodash";
import { EditorProps } from "../interface";
import { useObservable } from "@mybricks/rxui";
import { getOptionsFromEditor, isValid } from "../utils";

import css from "./index.less";

export default function ({ editConfig }: EditorProps): JSX.Element {
  const { value, options = {}, locales } = editConfig;
  const [curText, setCurText] = useState('')
  const [useLocale, setUseLocale] = useState(false)

  const val = value.get()
  const {
    readonly = false,
    style = {
      height: 100,
    },
    locale = false,
    ...res
  } = getOptionsFromEditor(options);
  const localeEnable = !!locales && !!locale

  const styles = useMemo(() => {
    const { height = 100 } = style;

    return {
      height,
    };
  }, []);

  const changedRef = useRef<HTMLInputElement>()

  const updateVal = useCallback((evt) => {
    value.set(evt.target.value)
    changedRef.current = void 0
  }, [])

  const openLocale = useCallback(e => {
    if (!locales?.edit) {
      console.error(`未找到 locales.edit`)
      return
    }
    locales.edit({
      value: {
        get() {
          return val
        },
        set(item) {
          if (item) {
            setUseLocale(true)

            setCurText(item.getContent('zh'))

            value.set({
              id: item.id
            })
          } else {
            setUseLocale(false)

            setCurText('')
            value.set('')
          }
        }
      }
    })
  }, [curText])

  useEffect(() => {
    if (localeEnable && val && typeof val === 'object' && val.id) {
      setUseLocale(true)

      const item = locales.searchById(val.id)
      if (item) {
        setCurText(item.getContent('zh'))
      } else {
        setCurText(`<未找到文案>`)
      }
    } else {
      setCurText(val)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (useLocale && changedRef.current) {
        value.set(changedRef.current.value)
        changedRef.current = void 0
      }
    }
  }, [useLocale])

  return (
    <div className={css["editor-textArea"]}>
      <Input.TextArea
        style={styles}
        onChange={evt => {
          setCurText(evt.target.value)
        }}
        // onKeyPress={evt => {
        //   if (evt.key !== 'Enter') return
        //   updateVal(evt)
        // }}
        onBlur={(evt) => {
          updateVal(evt)
        }}
        disabled={readonly || useLocale}
        defaultValue={val}
        {...res}
        value={curText}
      />
      {
        localeEnable ? (
          <span className={`${useLocale ? css.useLocale : ''} ${css.icon}`}
            onClick={openLocale}
            data-mybricks-tip={`多语言`}>
            {world}
          </span>
        ) : null
      }
    </div>
  );
}
