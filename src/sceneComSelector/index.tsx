import React, { useMemo, useState, ChangeEvent } from 'react'

import { uuid } from "../utils"
import { useUpdateEffect } from "../hooks"
import { EditorProps } from "../interface"


import css from "./index.less"

const EMPTY_ID = 'empty'

interface SceneComponent {
  id: string;
  title: string;
  slots: Array<{ id: string, title: string, coms: Array<SceneComponent>}>
}

interface Scene {
  id: string;
  title: string;
  components: Array<SceneComponent>
}

export default function ({ editConfig }: EditorProps) {
  const { editorValue, defaultValue, COMS_MAP, COM_OPTIONS } = useMemo(() => {
    const editorValue = editConfig.value
    const scenes: Array<Scene> = editConfig.scenes.getAll()
    const COM_OPTIONS: Array<{ id: string, label: string }> = []
    let defaultValue = Object.assign(editorValue.get(), {})
    let resetId = true
    const defaultId = defaultValue.id
    const COMS_MAP: {[key: string]: any} = {}

    function deep(components: Scene['components'], sceneTitle: string) {
      components.forEach(({ id, title, slots }) => {
        if (defaultId === id) {
          resetId = false
        }
        COM_OPTIONS.push({
          id,
          label: `${sceneTitle} - ${title}`
        })
        COMS_MAP[id] = {
          id,
          title: `${sceneTitle} - ${title}`
        }
        if (Array.isArray(slots)) {
          slots.forEach(({ coms }) => {
            if (Array.isArray(coms)) {
              deep(coms, sceneTitle)
            }
          })
        }
      })
    }


    scenes.forEach(({ title: sceneTitle, components }) => {
      deep(components, sceneTitle)
    })

    if (resetId && COM_OPTIONS.length) {
      // 不存在这个组件了，默认设置为第一个
      const id = COM_OPTIONS[0].id
      editorValue.set(COMS_MAP[id])
      defaultValue.id = id
    }

    return {
      editorValue,
      defaultValue,
      COMS_MAP,
      COM_OPTIONS: COM_OPTIONS.map(({ id, label }) => {
        return <option value={id}>{label}</option>
      }),
    }
  }, [])

  const [value, setValue] = useState(defaultValue)
  
  function onSelectChange(e: ChangeEvent<HTMLSelectElement>) {
    setValue(COMS_MAP[e.target.value])
  }

  useUpdateEffect(() => {
    editorValue.set(value)
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
