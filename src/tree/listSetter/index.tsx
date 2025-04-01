import React, { useEffect, useMemo, useRef, useState, useContext, Children } from 'react'
import { Drawer, Tooltip, Tree, TreeProps,TreeDataNode } from 'antd'
// import {
//   SortableContainer,
//   SortableElement,
//   SortableHandle,
// } from 'react-sortable-hoc'
import { arrayMoveImmutable } from '../../utils'
import RenderEditor from './renderEditor'
import { editorsConfigKey } from '../../constant'
import {
  SortableContainer,
  SortableElement,
  SortableHandle,
  useLazy,
} from './lazySortableHoc';
import css from './index.less'
import Icon from "./Icon";
import {DeleteIcon, ExpandIcon, DragIcon} from "./constants";

type ActiveId = string | null
type EditId = string | null

type ListSetterProps = {
  onSelect?: (activeId: string, activeIndex: number) => void
  onAdd?: (id: string) => void | object
  onChange: Function
  onRemove?: (id: string) => void
  value: any
  locales: any
  items: Array<any>
  getTitle: (item: any) => string | Array<string>
  draggable: boolean
  editable: boolean
  selectable: boolean
  deletable: boolean
  addable: boolean
  addText?: string
  customOptRender?: any
  extraContext?: any
  cdnMap: any;
  /** 获取应用层配置的 editor options */
  getDefaultOptions?(key: string): any;

  addItemGoal?: any
}

type TitleProps = {
  items: string | Array<string>
  heavy?: boolean
}

const getUid = (len = 6) => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  const uuid = []
  for (let i = 0; i < len; i++)
    uuid[i] = chars[0 | Math.floor(Math.random() * chars.length)]
  return uuid.join('')
}

const initData = (val: any) => {
  if (!Array.isArray(val)) {
    return []
  } else {
    return val.map((t) => ({ _id: getUid(), ...t }))
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

const SortableList = SortableContainer(({ children }) => {
  return <div className={css.list}>{children}</div>
})

const SortableItem = SortableElement(
  ({ children, className = '', onClick = () => { } }) => (
    <div className={`${css.listItem} ${className}`} onClick={onClick}>
      {children}
    </div>
  )
)

const DragHandle = SortableHandle(({ }) => (
  // [TODO] 用 Tooltip 好像antd版本的会死循环，别问为什么
  // <Tooltip
  //   placement="left"
  //   title={'拖动当前项'}
  //   overlayInnerStyle={{ fontSize: 12 }}
  // >
  <div className={css.grab} title="拖动当前项">
    <svg viewBox="0 0 20 20" width="12">
      <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
    </svg>
  </div>
  // </Tooltip>
))

export default function ({
  onChange,
  value,
  items = [],
  getTitle,
  onSelect,
  onAdd,
  onRemove,
  draggable = true,
  editable = true,
  selectable = false,
  deletable = true,
  addable = true,
  locales = null,
  addText = '添加一项',
  customOptRender,
  extraContext,
  cdnMap,
  addItemGoal,
  getDefaultOptions
}: ListSetterProps) {
  const [list, setList] = useState(initData(value) || [])
  //[TODO] activeId 和 editId 为了支持这个交互不得已做的，写的太乱了
  const [activeId, setActiveId] = useState<ActiveId>(null)
  const [editId, setEditId] = useState<EditId>(null)
  const [editItem, setEditItem] = useState();

  const [subFormVisible, setSubFormVisible] = useState(false)
  const listRef = useRef(null)
  /** 数据变化来自外部 */
  const changeFromOuter = useRef(false);

  const didMount = useRef(false)

  const expandable = useMemo(() => {
    return (window as any)[editorsConfigKey]?.expandable ?? false
  }, [])

  const _selectable = useMemo(() => {
    return expandable || selectable
  }, [selectable, expandable])

  function updateValue(id: string, key: string, val: string, list: any){
    const newList = [...list]
    newList.map((item)=>{
      if(item._id === id ){
        item[key] = val
      }else if(item.children && Array.isArray(item.children) && item.children.length > 0){
        updateValue(id, key, val, item.children)
      }
    })
    return newList
  }

  function filterDel(arr: any, id:string) {
    arr.map((item:any, index:number) => {
      if(item._id == id) {
          arr.splice(index, 1)
      }
      if(item.children) {
        filterDel(item.children, id)
      }
    })
    return arr
  }

  function addItem(val:any, id:string, list:any){
    const newList = [...list]
    newList.forEach(ele=> {
      if (ele._id === id) {
        ele.children ? ele.children.push(val) : ele.children = [val]
      } else {
        if (ele.children) {
          addItem(val, id, ele.children)
        }
      }
    })
    return newList
  }

  const listModel = useMemo(() => {
    return {
      add: (item: any) => {
        setList((prev) => {
          return prev.concat(item)
        })
      },
      addItem: (item: any) => {
        setList((prev) => {
          const copy = addItem(item.val, item.id, [...prev])
          return copy
        })
      },
      remove: (id: string) => {
        setList((prev) => {
          const copy = filterDel([...prev],id)
          return copy
        })
      },
      //移动还没做
      move: (from: number, to: number) => {
        setList((prev) => {
          return arrayMoveImmutable(prev, from, to)
        })
      },
      setItemKey: (id: string, key: string, val: any) => {
        setList((prev) => {
          const copy = updateValue(id, key, val, [...prev])
          return copy
        })
      },
    }
  }, [])

  useEffect(() => {
    const curList = list;

    if (JSON.stringify(curList) !== JSON.stringify(value)) {
      changeFromOuter.current = true;
      setList(initData(value));
    }
  }, [JSON.stringify(value)]);

  useEffect(() => {
    if (!didMount.current) {
      return
    }
    if (changeFromOuter.current) {
      changeFromOuter.current = false;
      return;
    }
    typeof onChange === 'function' &&
      onChange(
        JSON.parse(
          JSON.stringify(
            list
          )
        )
      )
  }, [list, onChange])

  useEffect(() => {
    if (!didMount.current) {
      return
    }

    if (!_selectable) {
      return
    }

    typeof onSelect === 'function' &&
      onSelect(
        activeId as string,
        list.findIndex((t) => t._id === activeId)
      )
  }, [activeId, list, onSelect, _selectable])

  useEffect(() => {
    didMount.current = true
  }, [])

  useEffect(() => {
    const editViewEle =
      document.querySelector('div[class^="lyEdt-"]') ||
      document.querySelector('#root div[class^="settingForm"]')
    if (!editViewEle || !listRef.current) {
      return
    }
    const handleClick = (e: any) => {
      if (e?.path?.includes(listRef.current)) {
        return
      }
      setSubFormVisible((cur) => {
        if (cur) {
          setEditId(null)
          setActiveId(null)
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

  const handleSortEnd = ({
    oldIndex,
    newIndex,
  }: {
    oldIndex: number
    newIndex: number
  }) => {
    listModel.move(oldIndex, newIndex)
  }

  useEffect(() => {
    //expandable情况下，将editId与activeId同步，不需要editId了
    if (expandable) {
      setEditId(activeId)
    }
  }, [activeId, expandable])

  useEffect(() => {
    //expandable情况下，第一次默认展开第一个
    if (!didMount || !expandable) {
      return
    }
    setActiveId(list.find((t) => t)?._id ?? null)
  }, [didMount, expandable])

  function getNodeById(tree:any, id:any) {
    let arr = Array.isArray(tree) ? tree : [tree]
    let result = null
    while (arr.length) {
      let item = arr.pop()
      if (item && item._id === id) {
        result = item
        break
      } else if (item && item.children && item.children.length) {
        arr.push(...item.children)
      }
    }
    return result
  }

  //查找对应节点层级
  function findLevel(tree:any, id:any){
    let arr = Array.isArray(tree) ? tree : [tree]
    let level = 0;
    while (arr.length) {
      let item = arr.pop()
      if (item && item._id === id) {
        level += 1; 
        break
      } else if (item && item.children && item.children.length) {
        level += 1;
        arr.push(...item.children)
      }
    }
    return level;
  }

  const SubEditors = useMemo(() => {
    return (
      <div style={{ padding: '15px' }} onClick={(e) => e.stopPropagation()}>
        {items.map((item, idx) => {
          const itemValue = JSON.parse(JSON.stringify(getNodeById([...list], editId)))
          const value = getNodeById([...list], editId)?.[item.value]
          const level = findLevel([...list], editId);

          if (typeof item.ifVisible === 'function' 
            && value !== undefined 
            && item.ifVisible(itemValue) === false 
          ) {
           return
          }

          //通过组件设置的index，决定编辑器的显示和隐藏
          if(item.frontIndex && typeof item.frontIndex === 'number' &&  level > item.frontIndex){
            return
          }

          if(item.afterIndex && typeof item.afterIndex === 'number' &&  level < item.afterIndex){
            return
          }

          return (
            <RenderEditor
              key={`${editId}_${idx}_${item.type}`}
              editConfig={{ ...item, locales, getDefaultOptions }}
              extraContext={extraContext}
              value={value}
              onChange={(v) => {
                listModel.setItemKey(editId||'', item.value, v)
              }}
            />
          )
        })}
      </div>
    )
  }, [items, list, listModel, editIndex, editId])

  const loaded = useLazy(cdnMap.sortableHoc);

  const editFun = ((e: any, item:any) => {
    e.stopPropagation()
    setEditId((c) => {
      if (c == item._id) {
        setSubFormVisible((curVisible) => {
          return !curVisible
        })
        return null
      } else {
        _selectable && setActiveId(item._id)
        setSubFormVisible(true)
        return item._id
      }
    })
    setEditItem(item);
  })

  const deleteFun = (e:any, item:any) => {
    e.stopPropagation()
    if (activeId === item._id) {
      setSubFormVisible(false)
      setActiveId(list.find((t) => t._id)._id)
    }
    if (editId === item._id) {
      setEditId(null)
    }
    listModel.remove(item._id)
    // 务必放在后面
    typeof onRemove === 'function' && onRemove(item._id)
  }

  const addFun = (item:any) => {
    const uid = getUid()
    return listModel.addItem(
      {
        val: {
          _id: uid,
          ...(typeof onAdd === 'function' ? onAdd(uid) || {} : {}),
        },
        id: item._id
      }
    )
  }

  const judgeFun =(item:any)=>{
    let judge = false;
    if(addItemGoal.value && Array.isArray(addItemGoal.value) && addItemGoal.value.length > 0){
      for(let i=0; i<addItemGoal.value.length; i++){
        if(item[addItemGoal.key] ===  addItemGoal.value[i]){
          judge = true;
          break;
        }
      }
    }
    return addItemGoal && item[addItemGoal.key] && judge;
  }

  const valueTransFun = ((val: any) => {
    let newVal = [];
    newVal = val.map((item: any)=>{
      if(!item.children || (item.children && Array.isArray(item.children) && item.children.length === 0)){
        return {
          ...item,
          title: <div style={{display: 'flex',justifyContent:"space-around", alignItems: 'center'}}>
          <div style={{marginRight: '20px'}}>
            {getTitle(item)}
          </div>
          <div className={css.editBox} style={{display: 'flex'}}>
            <div
              className={
                editId === item._id ? css.editActive : css.edit
              }
              onClick={(e) => editFun(e, item)}
            >
              <ExpandIcon/>
            </div>
            <div
              className={css.edit}
              onClick={(e) => deleteFun(e,item)}
            >
              <DeleteIcon/>
            </div>
          </div>
          {judgeFun(item) ? 
            <div
                className={css.edit}
                onClick={() => addFun(item)}
              >
                <Icon name="add"/>
            </div> :
            void 0
          }
        </div>
        }
      }else if(item.children && Array.isArray(item.children) && item.children.length > 0){
        return {
          ...item,
          title: <div style={{display: 'flex',justifyContent:"space-around", alignItems: 'center'}}>
          <div style={{marginRight: '20px'}}>
            {getTitle(item)}
          </div>
          <div className={css.editBox} style={{display: 'flex'}}>
            <div 
              className={
                editId === item._id ? css.editActive : css.edit
              }
              onClick={(e) => editFun(e, item)}
            >
              <ExpandIcon/>
            </div>
            <div 
              className={css.delete}
              onClick={(e) => deleteFun(e,item)}
            >
              <DeleteIcon/>
            </div>
          </div>
          {judgeFun(item) ? 
            <div
                className={css.add}
                onClick={() => addFun(item)}
              >
                <Icon name="add"/>
            </div> :
            void 0
          }
        </div>,
          children: valueTransFun(item.children)
        }
      }
    })
    return newVal
  })

  const onDrop: TreeProps['onDrop'] = (info) => {
    const dropKey = info.node.key;
    const dragKey = info.dragNode.key;
    const dropPos = info.node.pos.split('-');
    const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]); 

    const loop = (
      data: TreeDataNode[],
      key: React.Key,
      callback: (node: TreeDataNode, i: number, data: TreeDataNode[]) => void,
    ) => {
      for (let i = 0; i < data.length; i++) {
        if (data[i].key === key) {
          return callback(data[i], i, data);
        }
        if (data[i].children) {
          loop(data[i].children!, key, callback);
        }
      }
    };
    const data = [...list];

    // Find dragObject
    let dragObj: TreeDataNode;
    loop(data, dragKey, (item, index, arr) => {
      arr.splice(index, 1);
      dragObj = item;
    });

    if (!info.dropToGap) {
      loop(data, dropKey, (item) => {
        item.children = item.children || [];
        item.children.unshift(dragObj);
      });
    } else {
      let ar: TreeDataNode[] = [];
      let i: number;
      loop(data, dropKey, (_item, index, arr) => {
        ar = arr;
        i = index;
      });
      if (dropPosition === -1) {
        ar.splice(i!, 0, dragObj!);
      } else {
        ar.splice(i! + 1, 0, dragObj!);
      }
    }
    setList(data);
  };

  const drag = (
    <span className={`${css.drag}`}>
      <svg viewBox="0 0 20 20" width="12">
        <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
      </svg>
    </span>
  )

  return (
    <div className={`${css.listSetter} fangzhou-theme`} ref={listRef}>
      {addable &&
        <div
          className={css.btnAdd}
          onClick={() => {
            const uid = getUid()
            return listModel.add({
              _id: uid,
              ...(typeof onAdd === 'function' ? onAdd(uid) || {} : {}),
            })
          }}
        >
          {addText}
        </div>}
      <Tree
        treeData={valueTransFun(list)}
        draggable={draggable === true ? {icon: drag} : draggable}
        onDrop={onDrop}
        autoExpandParent={true}
        defaultExpandParent={true}
        defaultExpandAll={true}
      />
      {!expandable && (
        <Drawer
          className={css.drawerWrapper}
          rootClassName={css.drawerWrapper}
          bodyStyle={{
            borderLeft: '1px solid #bbb',
            backgroundColor: '#F7F7F7',
            padding: 0,
          }}
          width={280}
          key={editIndex} // 用来触发forceRender，因为有些编辑器初始化后就不接收value参数了，不是完全受控的
          placement="right"
          closable={false}
          onClose={() => setSubFormVisible(false)}
          mask={false}
          visible={subFormVisible && !!editId}
          getContainer={() =>
            document.querySelector('div[class^="lyStage-"]') ||
            document.querySelector('#root div[class^="sketchSection"]')
          }
          style={{ position: 'absolute' }}
          rootStyle={{position: "absolute",left:'unset'}}
        >
          <div>
            <Title
              heavy
              items={
                typeof getTitle === 'function'
                  ? getTitle(editItem || {})
                  : []
              }
            />
          </div>
          {!expandable && SubEditors}
        </Drawer>
      )}
    </div>
  )
}