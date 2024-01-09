import React, { useMemo, useState, ChangeEvent } from 'react'

import { uuid } from "../utils"
import { useUpdateEffect } from "../hooks"
import { EditorProps } from "../interface"


import css from "./index.less"

const EMPTY_ID = 'empty'

export default function ({ editConfig }: EditorProps) {
  const { editorValue, defaultValue, COM_OPTIONS } = useMemo(() => {
    const editorValue = editConfig.value
    const scenes: Array<{ id: string, title: string, components: Array<{ id: string, title: string }> }> = editConfig.scenes.getAll()
    const COM_OPTIONS: Array<{ id: string, label: string }> = []
    let defaultValue = Object.assign(editorValue.get(), {})
    let resetId = true
    const defaultId = defaultValue.id

    scenes.forEach(({ title: sceneTitle, components }) => {
      components.forEach(({ id, title }) => {
        if (defaultId === id) {
          resetId = false
        }
        COM_OPTIONS.push({
          id,
          label: `${sceneTitle} - ${title}`
        })
      })
    })

    if (resetId && COM_OPTIONS.length) {
      // 不存在这个组件了，默认设置为第一个
      const id = COM_OPTIONS[0].id
      editorValue.set({
        id
      })
      defaultValue.id = id
    }

    return {
      editorValue,
      defaultValue,
      COM_OPTIONS: COM_OPTIONS.map(({ id, label }) => {
        return <option value={id}>{label}</option>
      }),
    }
  }, [])

  const [value, setValue] = useState(defaultValue)
  
  function onSelectChange(e: ChangeEvent<HTMLSelectElement>) {
    setValue({
      id: e.target.value
    })
  }

  useUpdateEffect(() => {
    editorValue.set({
      id: value.id
    })
  }, [value])

  return (
    <div className={`${css.editor} fangzhou-theme`}>
      {COM_OPTIONS.length ? (
        <select value={value.id} onChange={onSelectChange}>
          {COM_OPTIONS}
        </select>
      ) : (
        <div>画布中没有组件，请添加后再试</div>
      )}
    </div>
  )
}
