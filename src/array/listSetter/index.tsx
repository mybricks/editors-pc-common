import { Drawer, Table } from "antd";
import type { ColumnType } from "antd/lib/table";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { arrayMoveImmutable } from "../../utils";
import { editorsConfigKey } from "./../../constant";
import { DeleteIcon, DragIcon, ExpandIcon } from "./constants";
import css from "./index.less";
import {
  SortableContainer,
  SortableElement,
  SortableHandle,
  useLazy,
} from "./lazySortableHoc";
import RenderEditor, { FormItemTitle } from "./renderEditor";
import {
  ActiveId,
  EditId,
  ListSetterProps,
  TagType,
  TitleProps,
} from "./types";

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
          return <img key={`${title}_${index}`} src={title} alt={`图片`} />;
        }

        return <div key={`${title}_${index}`}>{title}</div>;
      })}
    </div>
  );
};

const SortableList = SortableContainer(({ children }) => {
  return <div className={css.content}>{children}</div>;
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
    <DragIcon />
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
  batchEditable = true,
  batchWidth = "50%",
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
  tagsRender,
}: ListSetterProps) {
  const [list, setList] = useState(initData(value) || []);
  //[TODO] activeId 和 editId 为了支持这个交互不得已做的，写的太乱了
  const [activeId, setActiveId] = useState<ActiveId>(null);
  const [editId, setEditId] = useState<EditId>(null);
  const [subFormVisible, setSubFormVisible] = useState(false);
  const listRef = useRef(null);
  const [batchEditVisible, setBatchEditVisible] = useState(false);

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

  const getI18nText = useCallback(
    (val: any): string | string[] => {
      if (!val?.id) {
        // 可能是dom 现在不做处理
        return val;
      }
      const item = locales.searchById(val?.id);
      if (item) {
        return item.getContent("zh");
      } else {
        return `<未找到文案>`;
      }
    },
    [locales]
  );

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

  const BatchSubEditorsList = useMemo(() => {
    const columns = items.map((item, idx) => {
      const column: ColumnType<any> = {
        key: item.value,
        title: (
          <FormItemTitle title={item.title} description={item.description} />
        ),
        dataIndex: item.value,
        width: item.width,
        render: (value, record, index) => {
          const itemValue = JSON.parse(JSON.stringify(record || {}));
          if (
            typeof item.ifVisible === "function" &&
            item.ifVisible(itemValue, index) === false
          ) {
            return;
          }
          return (
            <RenderEditor
              key={`${index}_${idx}_${item.type}`}
              editConfig={{ ...item, locales, getDefaultOptions }}
              extraContext={extraContext}
              value={value}
              onChange={(v) => {
                listModel.setItemKey(index, item.value, v);
              }}
              showTitle={false}
            />
          );
        },
      };
      return column;
    });

    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className={css.batchEditorWrapper}
      >
        <Table
          columns={columns}
          dataSource={list}
          pagination={false}
          size="small"
        />
      </div>
    );
  }, [items, list, listModel]);

  const loaded = useLazy(cdnMap.sortableHoc);

  const tagsList = useCallback(
    (item: any) => {
      if (tagsRender && tagsRender(item).length > 0) {
        return tagsRender(item)?.map(
          ({ color, text }: TagType) =>
            text && (
              <div key={`${color}-${text}`} className={css.tag}>
                {text}
              </div>
              // <Tag
              //   color={color || "var(--mybricks-color-primary)"}
              //   key={`${color}-${text}`}
              //   style={{
              //     marginRight: 2,
              //     borderRadius: 5,
              //     fontWeight: 'bold',
              //     fontSize: 10
              //   }}
              // >
              //   {text}
              // </Tag>
            )
        );
      }
      return null;
    },
    [tagsRender]
  );

  //console.log(`activeId=${activeId}, editId=${editId}, subFormVisible=${subFormVisible}, editable=${editable}, batchEditable=${batchEditable} `);
  return (
    <div className={`${css.listSetter} fangzhou-theme`} ref={listRef}>
      {(addable || (editable && batchEditable)) && (
        <div className={css.btnGroup}>
          {addable && (
            <div
              className={css.btn}
              onClick={() => {
                const uid = getUid();
                return listModel.add({
                  _id: uid,
                  ...(typeof onAdd === "function" ? onAdd(uid) || {} : {}),
                });
              }}
            >
              <span>+</span>
              {addText}
            </div>
          )}
          {/*{editable && batchEditable && (*/}
          {/*  <div*/}
          {/*    className={css.btn}*/}
          {/*    onClick={() => {*/}
          {/*      setBatchEditVisible((v) => !v);*/}
          {/*      subFormVisible && setSubFormVisible(false);*/}
          {/*    }}*/}
          {/*  >*/}
          {/*    批量编辑*/}
          {/*  </div>*/}
          {/*)}*/}
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
                    //style={{paddingLeft: draggable ? "7px" : "3px"}}
                    title={
                      expandable && activeId !== item._id ? "点击展开详情" : ""
                    }
                  >
                    <Title
                      items={
                        typeof getTitle === "function"
                          ? getI18nText(getTitle(item || {}, index))
                          : []
                      }
                    />
                    {tagsList(item)}
                  </div>
                  <div className={css.btns}>
                    {!expandable && editable && (
                      <div
                        className={
                          editId === item._id ? css.editActive : css.edit
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          batchEditVisible && setBatchEditVisible(false);
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
                        <ExpandIcon />
                      </div>
                    )}
                    {customOptRender ? (
                      <div className={css.visible}>
                        {customOptRender({ item, index, setList })}
                      </div>
                    ) : null}
                    {showDelete ? (
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
                    ) : null}
                  </div>
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
          rootClassName={css.drawerWrapper}
          bodyStyle={{
            borderLeft: "1px solid #bbb",
            backgroundColor: "#F7F7F7",
            padding: 0,
          }}
          width={330}
          key={editIndex} // 用来触发forceRender，因为有些编辑器初始化后就不接收value参数了，不是完全受控的
          placement="right"
          closable={false}
          onClose={() => setSubFormVisible(false)}
          mask={false}
          visible={subFormVisible && !!editId}
          open={subFormVisible && !!editId}
          // @ts-ignore
          getContainer={() =>
            document.querySelector('div[class^="lyStage-"]') ||
            document.querySelector('#root div[class^="sketchSection"]')
          }
          style={{ position: "absolute" }}
          rootStyle={{ position: "absolute", left: "unset" }}
        >
          <div>
            <Title
              heavy
              items={
                typeof getTitle === "function"
                  ? getI18nText(getTitle(list[editIndex] || {}, editIndex))
                  : []
              }
            />
          </div>
          {!expandable && SubEditors}
        </Drawer>
      )}
      {editable && batchEditable && (
        <Drawer
          className={css.batchEditDrawerWrapper}
          // @ts-ignore
          rootClassName={css.batchEditDrawerWrapper}
          bodyStyle={{
            borderLeft: "1px solid #bbb",
            backgroundColor: "#F7F7F7",
            padding: 0,
          }}
          width={batchWidth ?? "50%"}
          key="batchEdit" // 用来触发forceRender，因为有些编辑器初始化后就不接收value参数了，不是完全受控的
          placement="right"
          closable={false}
          onClose={() => setBatchEditVisible(false)}
          mask={false}
          visible={batchEditVisible}
          open={batchEditVisible}
          // @ts-ignore
          getContainer={() =>
            document.querySelector('div[class^="lyStage-"]') ||
            document.querySelector('#root div[class^="sketchSection"]')
          }
          style={{ position: "absolute" }}
          rootStyle={{ position: "absolute", left: "unset" }}
        >
          <div>
            <Title heavy items="批量编辑" />
            {BatchSubEditorsList}
          </div>
        </Drawer>
      )}
    </div>
  );
}
