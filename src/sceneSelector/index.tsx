import React, { useMemo, useState, ChangeEvent } from 'react'

import { uuid } from "../utils"
import { useUpdateEffect } from "../hooks"
import { EditorProps } from "../interface"


import css from "./index.less"

const EMPTY_ID = 'empty'

export default function ({ editConfig }: EditorProps) {
  const { editorValue, SCENES_MAP, SCENE_OPTIONS } = useMemo(() => {
    const editorValue = editConfig.value
    let defaultValue = Object.assign(editorValue.get(), {})
    const scenes: Array<{ id: string, title: string }> = editConfig.scenes.getAll()
    const SCENE_OPTIONS = scenes.map(({ id, title }) => {
      return {
        id,
        title,
        label: title,
        empty: false
      }
    })
    const SCENES_MAP: any = {}

    if (defaultValue.empty) {
      defaultValue.label = '空白场景'
      SCENE_OPTIONS.unshift(defaultValue)
    } else {
      const emptyOption = { id: uuid(), label: '空白场景', empty: true, title: '场景' }
      if (!SCENE_OPTIONS.find((option) => option.id === defaultValue.id)) {
        emptyOption.title = defaultValue.title
        editorValue.set(emptyOption)
      }

      SCENE_OPTIONS.unshift(emptyOption)
    }

    SCENE_OPTIONS.forEach(({ id, label, title, empty }) => {
      SCENES_MAP[id] = { id, label, title, empty }
    })

    return {
      editorValue,
      SCENES_MAP,
      SCENE_OPTIONS: SCENE_OPTIONS.map(({ id, label }) => {
        return <option value={id}>{label}</option>
      })
    }
  }, [])
  const [sceneInfo, setSceneInfo] = useState(editorValue.get() || SCENES_MAP[EMPTY_ID]) // { id, title }

  function onInputChange (e: ChangeEvent<HTMLInputElement>) {
    setSceneInfo(() => {
      return {
        ...sceneInfo,
        title: e.target.value
      }
    })
  }

  function onSelectChange (e: ChangeEvent<HTMLSelectElement>) {
    setSceneInfo(SCENES_MAP[e.target.value])
  }

  useUpdateEffect(() => {
    editorValue.set({
      id: sceneInfo.id,
      title: sceneInfo.title,
      empty: sceneInfo.empty
    })
  }, [sceneInfo])


  return (
    <div className={`${css.editor} fangzhou-theme`}>
      {sceneInfo.empty ? (
        <>
          <div className={css.span}>名称</div>
          <input
            type='text'
            value={sceneInfo.title}
            placeholder='请输入场景名称'
            onChange={onInputChange}
          />
          <div className={css.span}>场景</div>
        </>
      ) : null}
      <select value={sceneInfo.id} onChange={onSelectChange}>
        {SCENE_OPTIONS}
      </select>
    </div>
  )
}
