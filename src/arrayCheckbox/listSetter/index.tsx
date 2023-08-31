import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Checkbox, Drawer } from 'antd'
import RenderEditor from '../../array/listSetter/renderEditor'
import css from './index.less'
import { deepCopy } from '../../utils'

type EditId = string | null

type ListSetterProps = {
  onChange: Function
  value: any
  items: Array<any>
  getTitle: (item: any, index: number) => string | Array<string>
  editable: boolean
  checkField: string
  visibleField?: string
  extraContext?: any
}

type TitleProps = {
  items: string | Array<string>
  heavy?: boolean
}

// 手动增加_id
const initData = (val: any) => {
  if (!Array.isArray(val)) {
    return []
  } else {
    return val.map((t, inx) => ({ _id: `${inx}-arrayCheckbox-item`, ...t }))
  }
}

const Title = ({ items, heavy = false }: TitleProps) => {
  const titles = Array.isArray(items) ? items : [items]
  return (
    <div className={heavy ? `${css.titles} ${css.titlesHeavy}` : css.titles}>
      {titles.map((title, index) => {
        if (
          title?.toLocaleLowerCase &&
          /\.(png|jpe?g|gif|svg)(\?.*)?$/.test(title.toLocaleLowerCase())
        ) {
          return <img key={`${title}_${index}`} src={title} />
        }
        return <div key={`${title}_${index}`}>{title}</div>
      })}
    </div>
  )
}

export default function ({
  onChange,
  value,
  items = [],
  getTitle,
  editable = true,
  checkField = '_checked',
  visibleField,
  extraContext
}: ListSetterProps) {
  const triggerInit = JSON.stringify(value);
  const initVal = initData(deepCopy(value)) || [];
  const [list, setList] = useState(initVal);
  const [editId, setEditId] = useState<EditId>(null)
  const [subFormVisible, setSubFormVisible] = useState(false)
  const listRef = useRef(null)

  /** 在value改变时重新设置list */
  useEffect(() => {
    setList(initVal);
    setEditId(prevId => {
      const item = initVal.find(t => t._id === prevId);
      if (item && visibleField && !item[visibleField]) return null;
      return prevId;
    })
  }, [triggerInit]);

  const didMount = useRef(false)

  const listModel = useMemo(() => {
    return {
      setItemChecked: ({ checked, id }: { checked: boolean, id: string }) => {
        setList((prev) => {
          const copy = [...prev].map(item => {
            if (item._id === id) item[checkField] = checked;
            return item;
          });
          return copy
        })
      },
      setItemKey: (index: number, key: string, val: any) => {
        setList((prev) => {
          const copy = [...prev]
          if (copy && copy[index]) {
            copy[index][key] = val
          }
          return copy
        })
      },
    }
  }, []);

  useEffect(() => {
    if (!didMount.current) {
      return
    }
    typeof onChange === 'function' &&
      onChange(
        JSON.parse(
          JSON.stringify(
            list.map((t) => {
              return { ...t }
            })
          )
        )
      )
  }, [list, onChange])


  useEffect(() => {
    didMount.current = true
  }, [])

  useEffect(() => {
    const editViewEle = document.querySelector('div[class^="lyEdt-"]')
    if (!editViewEle || !listRef.current) {
      return
    }
    const handleClick = (e: any) => {
      if (e.path.includes(listRef.current)) {
        return
      }
      setSubFormVisible((cur) => {
        if (cur) {
          return false
        }
        return cur
      })
    }
    editViewEle.addEventListener('click', handleClick, false)
    return () => {
      editViewEle.removeEventListener('click', handleClick)
    }
  }, [listRef])

  const editIndex = useMemo(() => {
    return list.findIndex((t) => t._id === editId)
  }, [editId, list])

  return (
    <div className={`${css.listSetter} fangzhou-theme`} ref={listRef}>
      <div className={css.list}>
        {list.map((item, index) => {
          if (visibleField && !item[visibleField]) {
            return
          }
          // if (typeof item.ifVisible === 'function') {
          //   item._visible = item.ifVisible();
          //   if (!item._visible) return;
          // }
          return (
            <div
              key={item._id}
              className={`${css.listItem} ${editId === item._id
                ? `${css.listItemSelect} ${css.active}`
                : css.listItemSelect
                }`}
              onClick={() => {
                setSubFormVisible(false)
                setEditId(null)
              }}
            >
              <div
                className={css.listItemContent}
                style={{ paddingLeft: '8px' }}
              >
                <Title
                  items={
                    typeof getTitle === 'function'
                      ? getTitle(item || {}, index)
                      : []
                  }
                />
              </div>
              {editable && (
                <div
                  className={editId === item._id ? css.editActive : css.edit}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditId((c) => {
                      if (c == item._id) {
                        setSubFormVisible((curVisible) => {
                          return !curVisible
                        })
                        return null
                      } else {
                        setSubFormVisible(true)
                        return item._id
                      }
                    })
                  }}
                >
                  <svg viewBox="0 0 1024 1024" width="15" height="15">
                    <path
                      d="M341.108888 691.191148 515.979638 616.741529 408.633794 511.126097 341.108888 691.191148Z"
                      p-id="5509"
                    ></path>
                    <path
                      d="M860.525811 279.121092 749.7171 164.848489 428.544263 481.69274 543.68156 601.158622 860.525811 279.121092Z"
                      p-id="5510"
                    ></path>
                    <path
                      d="M951.813934 142.435013c0 0-29.331026-32.462343-63.091944-57.132208-33.759895-24.670889-59.729359 0-59.729359 0l-57.132208 57.132208 115.996874 115.565039c0 0 48.909943-49.342802 63.957661-66.222237C966.861652 174.897356 951.813934 142.435013 951.813934 142.435013L951.813934 142.435013z"
                      p-id="5511"
                    ></path>
                    <path
                      d="M802.174845 946.239985 176.165232 946.239985c-61.635779 0-111.786992-50.151213-111.786992-111.786992L64.37824 208.443379c0-61.635779 50.151213-111.786992 111.786992-111.786992l303.856449 0c12.357446 0 22.357194 10.011005 22.357194 22.357194s-9.999748 22.357194-22.357194 22.357194L176.165232 141.370775c-36.986379 0-67.072605 30.086226-67.072605 67.072605l0 626.009613c0 36.986379 30.086226 67.072605 67.072605 67.072605l626.009613 0c36.985356 0 67.072605-30.086226 67.072605-67.072605L869.24745 530.596544c0-12.347213 9.999748-22.357194 22.357194-22.357194s22.357194 10.011005 22.357194 22.357194l0 303.856449C913.961838 896.088772 863.810624 946.239985 802.174845 946.239985z"
                      p-id="5512"
                    ></path>
                  </svg>
                </div>
              )}
              <Checkbox
                onChange={({ target }) => {
                  const { checked } = target;
                  listModel.setItemChecked({ checked, id: item?._id })
                }}
                checked={item && item[checkField]}
                onClick={(e) => {
                  e.stopPropagation()
                  // setEditId(() => {
                  //   setSubFormVisible(true)
                  //   return item._id
                  // })
                }}
              />
            </div>
          )
        })}
      </div>
      <Drawer
        className={css.drawerWrapper}
        bodyStyle={{
          borderLeft: '1px solid #bbb',
          backgroundColor: '#F7F7F7',
          padding: 0,
        }}
        key={editIndex} // 用来触发forceRender，因为有些编辑器初始化后就不接收value参数了，不是完全受控的
        placement="right"
        closable={false}
        onClose={() => setSubFormVisible(false)}
        mask={false}
        visible={subFormVisible && !!editId}
        getContainer={() => document.querySelector('div[class^="lyStage-"]')}
        style={{ position: 'absolute' }}
      >
        <div>
          <Title
            heavy
            items={
              typeof getTitle === 'function'
                ? getTitle(list[editIndex] || {}, editIndex)
                : []
            }
          />
        </div>
        <div style={{ padding: '15px' }}>
          <RenderEditor
            extraContext={extraContext}
            editConfig={{
              type: 'Switch',
              title: '启用',
              value: list[editIndex] && list[editIndex][checkField]
            }}
            value={list[editIndex] && list[editIndex][checkField]}
            onChange={(v) => {
              listModel.setItemChecked({ checked: v, id: list[editIndex]?._id })
            }}
          />
          {items.map((item, idx) => {
            const value = list[editIndex]?.[item.value]

            const itemValue = JSON.parse(JSON.stringify(list[editIndex] || {}))
            if (
              typeof item.ifVisible === 'function' &&
              item.ifVisible(itemValue, editIndex) === false
            ) {
              return
            }

            return (
              <RenderEditor
                key={`${editIndex}_${idx}_${item.type}`}
                editConfig={item}
                extraContext={extraContext}
                value={value}
                onChange={(v) => {
                  listModel.setItemKey(editIndex, item.value, v)
                }}
              />
            )
          })}
        </div>
      </Drawer>
    </div>
  )
}
