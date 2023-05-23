import React, {
  useMemo,
  useState,
  useEffect,
  useCallback
} from 'react'

import { TypeChange } from './components'
import { isTypeMatch, getAutoChangeScript, getTypeTitleBySchema } from './utils'

import type { EditorProps } from './types'

import css from './index.less'

export default function ({editConfig: {value, options, popView}}: EditorProps): JSX.Element {
  const [internalValue, setInternalValue] = useState(value.get())
  const [{from: fromSchema, to: toSchema}] = useState(options)
  const [auto, setAuto] = useState(!!internalValue?.auto)

  const handleEditClick: () => void = useCallback(() => {
    popView('编辑类型转换', ({close}) => {
      return (
        <TypeChange
          toSchema={options.to}
          fromSchema={options.from}
          conAry={internalValue?.conAry}
          onComplete={(val) => {
            const finalValue = Object.assign({auto: false}, val)
            close()
            setAuto(false)
            setInternalValue(finalValue)
            value.set(finalValue)
          }}
        />
      )
    }, {width: 550, beforeEditView: true})
  }, [options])

  const handleSwitchChange: () => void = useCallback(() => {
    setAuto(!auto)
    if (!auto) {
      const script = getAutoChangeScript(fromSchema, toSchema)

      value.set({
        title: `${getTypeTitleBySchema(fromSchema)} > ${getTypeTitleBySchema(toSchema)}`,
        auto: true,
        script
      })
    } else {
      value.set({auto: false})
    }
  }, [auto])

  const tips: JSX.Element = useMemo(() => {
    return (
      <span>从 {getTypeTitleBySchema(fromSchema)} 到 {getTypeTitleBySchema(toSchema)}</span>
    )
  }, [])

  const autoSwitch: JSX.Element | null = useMemo(() => {
    return isTypeMatch(fromSchema, toSchema) ? (
      <span>
        <input
          checked={auto}
          type={'checkbox'}
          onChange={handleSwitchChange}
        />
        自动转换
      </span>
    ) : null
  }, [auto])

  return (
    <div className={css.editor}>
      {tips}
      {autoSwitch}
      <button onClick={handleEditClick}>编辑</button>
    </div>
  )
}
