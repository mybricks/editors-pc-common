import React, {useMemo, useCallback, useEffect, useRef, useState} from "react";
import {world} from './icons'
import {Input} from "antd";
import {debounce} from "../util/lodash";
import {EditorProps} from "../interface";
import {useObservable} from "@mybricks/rxui";
import {getOptionsFromEditor, isValid} from "../utils";

import css from "./index.less";

export default function ({editConfig}: EditorProps): JSX.Element {
  const {
    value, options = {}, locales
  } = editConfig;

  const [curText, setCurText] = useState('')
  const [useLocale, setUseLocale] = useState(false)

  const val = value.get()

  const {
    readonly = false,
    style = {
      height: 100,
    },
    onEnterSet,
    hCenter,
    vCenter,
    width,
    height,
    focusNow,
    selectContent,
    locale = false,
    ...res
  } = getOptionsFromEditor(options)

  const [edtSize, setEdtSize] = useState({
    width,
    height
  })

  const localeEnable = !!locales && !!locale

  const styles = useMemo(() => {
    return {
      height: height || style.height || 100
    };
  }, []);

  const textAreaRef = useRef<HTMLInputElement>()

  const setVal = useCallback(val => {
    const textarea = textAreaRef.current as HTMLTextAreaElement
    textarea.style.height = '20px'//重置高度，才能获取正确的scrollHeight
    const nowHeight = Math.max(textarea.scrollHeight, height)
    //console.log('...nowHeight',nowHeight)

    setEdtSize({...edtSize, height: nowHeight})
    setCurText(val)

    requestAnimationFrame(v => {
      textarea.style.height = 'auto'
      textarea.scrollTop = 0//置顶
    })

  }, [edtSize])

  const updateVal = useCallback((evt) => {
    value.set(evt.target.value)
    textAreaRef.current = void 0
  }, [])

  const openLocale = useCallback(e => {
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
    } else {
      setCurText(val)
    }
  }, [])


  useEffect(() => {
    if (textAreaRef.current) {
      if (focusNow) {
        textAreaRef.current.focus()
        if (selectContent) {
          textAreaRef.current.select()
        }
      }
    }
  }, [
    textAreaRef.current
  ])

  // useEffect(() => {
  //   return () => {
  //     if (useLocale && changedRef.current) {
  //       value.set(changedRef.current.value)
  //       changedRef.current = void 0
  //     }
  //   }
  // }, [useLocale])

  if (vCenter) {
    return (
      <div className={`${css.textArea} ${css.vCenter}`}
           style={edtSize}>
        <textarea ref={el => {
          if (el) {
            textAreaRef.current = el
          }
        }}
          //style={styles}
                  onDoubleClick={e => {
                    e.stopPropagation()
                  }}
                  onChange={evt => {
                    setVal(evt.target.value)
                  }}
                  maxLength={1000}
                  onKeyPress={evt => {
                    if (onEnterSet) {
                      if (evt.key !== 'Enter') return
                      updateVal(evt)
                    }
                  }}
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
    )
  } else {
    return (
      <div className={`${css.textArea}`}
           style={{
             width,
             height
           }}>
        <Input.TextArea ref={el => {
          if (el) {
            textAreaRef.current = el
          }
        }}
                        style={styles}
                        onDoubleClick={e => {
                          e.stopPropagation()
                        }}
                        onChange={evt => {
                          setCurText(evt.target.value)
                        }}
                        onKeyPress={evt => {
                          if (onEnterSet) {
                            if (evt.key !== 'Enter') return
                            updateVal(evt)
                          }
                        }}
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
    )
  }
}
