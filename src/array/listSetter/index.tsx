import React, { useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "antd";
import { arrayMoveImmutable } from "../../utils";
import RenderEditor from "./renderEditor";
import { editorsConfigKey } from "./../../constant";
import {
  SortableContainer,
  SortableElement,
  SortableHandle,
  useLazy,
} from "./lazySortableHoc";
import css from "./index.less";
import { DeleteIcon } from "./constants";
import { ListSetterProps, TitleProps, ActiveId, EditId } from "./types";

const getUid = (len = 6) => {
  const chars =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const uuid = [];
  for (let i = 0; i < len; i++)
    uuid[i] = chars[0 | Math.floor(Math.random() * chars.length)];
  return uuid.join("");
};

const initData = (val: any) => {
  if (!Array.isArray(val)) {
    return [];
  } else {
    return val.map((t) => ({ _id: getUid(), ...t }));
  }
};

const Title = ({ items, heavy = false }: TitleProps) => {
  const titles = Array.isArray(items) ? items : [items];
  return (
    <div className={heavy ? `${css.titles} ${css.titlesHeavy}` : css.titles}>
      {titles.map((title, index) => {
        if (
          title?.toLocaleLowerCase &&
          /\.(png|jpe?g|gif|svg)(\?.*)?$/.test(title.toLocaleLowerCase())
        ) {
          return <img key={`${title}_${index}`} src={title} />;
        }
        return <div key={`${title}_${index}`}>{title}</div>;
      })}
    </div>
  );
};

const SortableList = SortableContainer(({ children }) => {
  return <div className={css.list}>{children}</div>;
});

const SortableItem = SortableElement(
  ({ children, className = "", onClick = () => {} }) => (
    <div className={`${css.listItem} ${className}`} onClick={onClick}>
      {children}
    </div>
  )
);

const DragHandle = SortableHandle(({}) => (
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
));

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
  addText = "添加一项",
  customOptRender,
  extraContext,
  cdnMap,
  defaultSelect,
  getDefaultOptions,
  handleDelete,
}: ListSetterProps) {
  const [list, setList] = useState(initData(value) || []);
  //[TODO] activeId 和 editId 为了支持这个交互不得已做的，写的太乱了
  const [activeId, setActiveId] = useState<ActiveId>(null);
  const [editId, setEditId] = useState<EditId>(null);
  const [subFormVisible, setSubFormVisible] = useState(false);
  const listRef = useRef(null);

  /** 数据变化来自外部 */
  const changeFromOuter = useRef(false);

  const didMount = useRef(false);

  const expandable = useMemo(() => {
    return (window as any)[editorsConfigKey]?.expandable ?? false;
  }, []);

  const _selectable = useMemo(() => {
    return expandable || selectable;
  }, [selectable, expandable]);

  const listModel = useMemo(() => {
    return {
      add: (item: any) => {
        setList((prev) => {
          return prev.concat(item);
        });
      },
      remove: (id: string) => {
        setList((prev) => {
          const targetIndedx = prev.findIndex((t) => t._id == id);
          const copy = [...prev];
          if (targetIndedx !== -1) {
            copy.splice(targetIndedx, 1);
          }
          return copy;
        });
      },
      move: (from: number, to: number) => {
        setList((prev) => {
          return arrayMoveImmutable(prev, from, to);
        });
      },
      setItemKey: (index: number, key: string, val: any) => {
        setList((prev) => {
          const copy = [...prev];
          if (copy && copy[index]) {
            copy[index][key] = val;
          }
          return copy;
        });
      },
    };
  }, []);

  useEffect(() => {
    const curList = list;

    if (JSON.stringify(curList) !== JSON.stringify(value)) {
      changeFromOuter.current = true;
      setList(initData(value));
    }
  }, [JSON.stringify(value)]);

  useEffect(() => {
    if (!didMount.current) {
      return;
    }
    if (changeFromOuter.current) {
      changeFromOuter.current = false;
      return;
    }
    typeof onChange === "function" &&
      onChange(JSON.parse(JSON.stringify(list)));
  }, [list, onChange]);

  useEffect(() => {
    if (!didMount.current) {
      return;
    }

    if (!_selectable) {
      return;
    }

    typeof onSelect === "function" &&
      onSelect(
        activeId as string,
        list.findIndex((t) => t._id === activeId)
      );
  }, [activeId, list, onSelect, _selectable]);

  useEffect(() => {
    didMount.current = true;
  }, []);

  useEffect(() => {
    const editViewEle =
      document.querySelector('div[class^="lyEdt-"]') ||
      document.querySelector('#root div[class^="settingForm"]');
    if (!editViewEle || !listRef.current) {
      return;
    }
    const handleClick = (e: any) => {
      if (e?.path?.includes(listRef.current)) {
        return;
      }
      setSubFormVisible((cur) => {
        if (cur) {
          setEditId(null);
          setActiveId(null);
          return false;
        }
        return cur;
      });
    };
    editViewEle.addEventListener("click", handleClick, false);
    return () => {
      editViewEle.removeEventListener("click", handleClick);
    };
  }, [listRef]);

  const editIndex = useMemo(() => {
    return list.findIndex((t) => t._id === editId);
  }, [editId, list]);

  const handleSortEnd = ({
    oldIndex,
    newIndex,
  }: {
    oldIndex: number;
    newIndex: number;
  }) => {
    listModel.move(oldIndex, newIndex);
  };

  useEffect(() => {
    //expandable情况下，将editId与activeId同步，不需要editId了
    if (expandable) {
      setEditId(activeId);
    }
  }, [activeId, expandable]);

  useEffect(() => {
    //expandable情况下，第一次默认展开第一个
    if (!didMount || !expandable) {
      return;
    }
    setActiveId(list.find((t) => t)?._id ?? null);
  }, [didMount, expandable]);

  useEffect(() => {
    if (didMount.current && selectable && !activeId && defaultSelect) {
      let target = list.find(
        (t) => t._id === defaultSelect || t.id === defaultSelect
      );
      if (target) {
        setActiveId(defaultSelect || target._id);
      }
    }
  }, [defaultSelect, activeId, didMount, selectable, list]);

  const SubEditors = useMemo(() => {
    return (
      <div style={{ padding: "15px" }} onClick={(e) => e.stopPropagation()}>
        {items.map((item, idx) => {
          const value = list[editIndex]?.[item.value];

          const itemValue = JSON.parse(JSON.stringify(list[editIndex] || {}));
          if (
            typeof item.ifVisible === "function" &&
            item.ifVisible(itemValue, editIndex) === false
          ) {
            return;
          }

          return (
            <RenderEditor
              key={`${editIndex}_${idx}_${item.type}`}
              editConfig={{ ...item, locales, getDefaultOptions }}
              extraContext={extraContext}
              value={value}
              onChange={(v) => {
                listModel.setItemKey(editIndex, item.value, v);
              }}
            />
          );
        })}
      </div>
    );
  }, [items, list, listModel, editIndex]);

  const loaded = useLazy(cdnMap.sortableHoc);

  return (
    <div className={`${css.listSetter} fangzhou-theme`} ref={listRef}>
      {addable && (
        <div
          className={css.btnAdd}
          onClick={() => {
            const uid = getUid();
            return listModel.add({
              _id: uid,
              ...(typeof onAdd === "function" ? onAdd(uid) || {} : {}),
            });
          }}
        >
          {addText}
        </div>
      )}
      <SortableList
        useDragHandle
        loaded={loaded}
        onSortEnd={handleSortEnd}
        lockAxis="y"
        helperClass={css.listItemSelect}
      >
        {list.map((item, index) => {
          let showDelete = deletable;
          if (showDelete && handleDelete) {
            showDelete = !handleDelete(item);
          }
          return (
            <SortableItem
              loaded={loaded}
              key={item._id}
              index={index}
              className={`${
                _selectable
                  ? activeId === item._id || activeId === item.id
                    ? `${css.listItemSelect} ${css.active}`
                    : css.listItemSelect
                  : ""
              }`}
              onClick={() => {
                if (!_selectable) {
                  return;
                }
                setSubFormVisible(false);
                setActiveId((c) => {
                  if (c === item._id) {
                    setEditId(null);
                    return null;
                  } else {
                    setEditId(null);
                    return item._id;
                  }
                });
              }}
            >
              <div className={css.listItemCard}>
                <div className={css.listItemCardTop}>
                  {draggable && <DragHandle loaded={loaded} />}
                  <div
                    className={css.listItemContent}
                    style={{ paddingLeft: draggable ? "7px" : "3px" }}
                    title={
                      expandable && activeId !== item._id ? "点击展开详情" : ""
                    }
                  >
                    <Title
                      items={
                        typeof getTitle === "function"
                          ? getTitle(item || {}, index)
                          : []
                      }
                    />
                  </div>
                  {!expandable && editable && (
                    <div
                      className={
                        editId === item._id ? css.editActive : css.edit
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditId((c) => {
                          if (c == item._id) {
                            setSubFormVisible((curVisible) => {
                              return !curVisible;
                            });
                            return null;
                          } else {
                            _selectable && setActiveId(item._id);
                            setSubFormVisible(true);
                            return item._id;
                          }
                        });
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
                  {customOptRender
                    ? customOptRender({ item, index, setList })
                    : null}
                  {showDelete && (
                    <div
                      className={css.delete}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeId === item._id) {
                          setSubFormVisible(false);
                          setActiveId(list.find((t) => t._id)._id);
                        }
                        if (editId === item._id) {
                          setEditId(null);
                        }
                        listModel.remove(item._id);
                        // 务必放在后面
                        typeof onRemove === "function" && onRemove(item._id);
                      }}
                    >
                      <DeleteIcon />
                    </div>
                  )}
                </div>
                {expandable && editId === item._id && SubEditors}
              </div>
            </SortableItem>
          );
        })}
      </SortableList>
      {!expandable && (
        <Drawer
          className={css.drawerWrapper}
          bodyStyle={{
            borderLeft: "1px solid #bbb",
            backgroundColor: "#F7F7F7",
            padding: 0,
          }}
          width={280}
          key={editIndex} // 用来触发forceRender，因为有些编辑器初始化后就不接收value参数了，不是完全受控的
          placement="right"
          closable={false}
          onClose={() => setSubFormVisible(false)}
          mask={false}
          visible={subFormVisible && !!editId}
          // @ts-ignore
          getContainer={() =>
            document.querySelector('div[class^="lyStage-"]') ||
            document.querySelector('#root div[class^="sketchSection"]')
          }
          style={{ position: "absolute" }}
        >
          <div>
            <Title
              heavy
              items={
                typeof getTitle === "function"
                  ? getTitle(list[editIndex] || {}, editIndex)
                  : []
              }
            />
          </div>
          {!expandable && SubEditors}
        </Drawer>
      )}
    </div>
  );
}
