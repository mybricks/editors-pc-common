import React, {useMemo, useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";
import {world} from './icons'
import {Input} from "antd";
import {debounce} from "../util/lodash";
import {EditorProps} from "../interface";
import {useObservable} from "@mybricks/rxui";
import {getOptionsFromEditor, isValid} from "../utils";

import css from "./index.less";

export default function ({editConfig}: EditorProps): JSX.Element {
  const { value, options = {}, locales } = editConfig
  const val = value.get()

  const [useLocale, setUseLocale] = useState(false)
  const [curText, setCurText] = useState(val)
  const changedRef = useRef<HTMLTextAreaElement>()

  const {
    readonly = false,
    style = { height: 100 },
    onEnterSet,
    hCenter,
    vCenter,
    width,
    height,
    focusNow,
    selectContent,
    locale = false,
  } = getOptionsFromEditor(options)

  const localeEnable = !!locales && !!locale

  const styles = useMemo(() => {
    return Object.assign({}, style, {
      height: height || style.height || 100
    })
  }, [])

  const updateVal = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    value.set(evt.target.value)
    changedRef.current = void 0
  }, [])

  const openLocale = useCallback(() => {
    if (!locales?.edit) {
      console.error(`未找到 locales.edit`)
      return
    }
    locales.edit({
      value: {
        get() {
          return {
            val,
            curText
          }
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
    }
  }, [])

  const handleTextareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) {
      changedRef.current = el;

      if (vCenter) {
        el.scrollTop = el.scrollHeight / 2; //滚动
      }

      if (focusNow) {
        el.focus();

        if (selectContent) {
          el.select();
        } else {
          const cursorPosition = el.value.length;
          el.setSelectionRange(cursorPosition, cursorPosition);
        }
      }
    }
  }, [])

  const stopPropagation = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  }, [])

  // 引擎双击编辑文案链路
  if (vCenter) {
    const nowWidth = Math.max(width, 80)
    const nowHeight = Math.max(styles.height, 26)

    return (
      <div
        className={`${css.textArea} ${css.vCenter}`}
        onMouseDown={stopPropagation}
      >
        <textarea
          ref={handleTextareaRef}
          style={{ ...styles, width: nowWidth, height: nowHeight }}
          onDoubleClick={stopPropagation}
          onChange={(evt) => {
            setCurText(evt.target.value);
          }}
          onKeyPress={(evt) => {
            if (onEnterSet) {
              if (evt.shiftKey || evt.key !== "Enter") {
                return;
              }
              updateVal(evt as unknown as React.ChangeEvent<HTMLTextAreaElement>);
            }
          }}
          onBlur={(evt) => {
            updateVal(evt);
          }}
          disabled={readonly || useLocale}
          value={curText}
        />
        {localeEnable ? (
          <span
            className={`${useLocale ? css.useLocale : ""} ${css.icon}`}
            onClick={openLocale}
            data-mybricks-tip={`多语言`}
          >
            {world}
          </span>
        ) : null}
      </div>
    );
  } else {
    return (
      <div
        className={`${css.textArea}`}
        style={{
          width,
          height,
        }}
      >
        <Input.TextArea
          ref={handleTextareaRef}
          style={styles}
          onDoubleClick={stopPropagation}
          onChange={(evt) => {
            setCurText(evt.target.value);
          }}
          onKeyPress={(evt) => {
            if (onEnterSet) {
              if (evt.shiftKey || evt.key !== "Enter") return;
              updateVal(evt as unknown as React.ChangeEvent<HTMLTextAreaElement>);
            }
          }}
          onBlur={(evt) => {
            updateVal(evt as unknown as React.ChangeEvent<HTMLTextAreaElement>);
          }}
          disabled={readonly || useLocale}
          defaultValue={val}
          value={curText}
        />
        {localeEnable ? (
          <span
            className={`${useLocale ? css.useLocale : ""} ${css.icon}`}
            onClick={openLocale}
            data-mybricks-tip={`多语言`}
          >
            {world}
          </span>
        ) : null}
      </div>
    );
  }
}
