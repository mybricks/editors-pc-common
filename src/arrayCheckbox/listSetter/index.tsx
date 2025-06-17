import React, { useEffect, useMemo, useRef, useState } from "react";
import { Checkbox, Drawer } from "antd";
import RenderEditor from "../../array/listSetter/renderEditor";
import css from "./index.less";
import { deepCopy } from "../../utils";
import { ExpandIcon } from "../../array/listSetter/constants";

type EditId = string | null;

type ListSetterProps = {
  onChange: Function;
  value: any;
  locales: any;
  items: Array<any>;
  getTitle: (item: any, index: number) => string | Array<string>;
  editable: boolean;
  checkField: string;
  visibleField?: string;
  extraContext?: any;
  /** 获取应用层配置的 editor options */
  getDefaultOptions?(key: string): any;
};

type TitleProps = {
  items: string | Array<string>;
  heavy?: boolean;
};

// 手动增加_id
const initData = (val: any) => {
  if (!Array.isArray(val)) {
    return [];
  } else {
    return val.map((t, inx) => ({ _id: `${inx}-arrayCheckbox-item`, ...t }));
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
          return <img key={`${title}_${index}`} src={title} alt={`图片`}/>;
        }
        return <div key={`${title}_${index}`}>{title}</div>;
      })}
    </div>
  );
};

export default function ({
  onChange,
  value,
  items = [],
  getTitle,
  editable = true,
  checkField = "_checked",
  visibleField,
  locales,
  extraContext,
  getDefaultOptions,
}: ListSetterProps) {
  const triggerInit = useMemo(() => JSON.stringify(value), [value]);
  const initVal = useMemo(() => initData(deepCopy(value)) || [], [value]);
  const [list, setList] = useState(initVal);
  const [editId, setEditId] = useState<EditId>(null);
  const [subFormVisible, setSubFormVisible] = useState(false);
  const listRef = useRef(null);

  /** 在value改变时重新设置list */
  useEffect(() => {
    setEditId((prevId) => {
      const item = initVal.find((t) => t._id === prevId);
      if (item && visibleField && !item[visibleField]) return null;
      return prevId;
    });
  }, [triggerInit]);

  const didMount = useRef(false);

  const listModel = useMemo(() => {
    return {
      setItemChecked: ({ checked, id }: { checked: boolean; id: string }) => {
        setList((prev) => {
          const copy = [...prev].map((item) => {
            if (item._id === id) item[checkField] = checked;
            return item;
          });
          return copy;
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
    if (!didMount.current) {
      return;
    }
    typeof onChange === "function" &&
      onChange(
        JSON.parse(
          JSON.stringify(
            list.map((t) => {
              return { ...t };
            })
          )
        )
      );
  }, [list, onChange]);

  useEffect(() => {
    didMount.current = true;
  }, []);

  useEffect(() => {
    const editViewEle = document.querySelector('div[class^="lyEdt-"]');
    if (!editViewEle || !listRef.current) {
      return;
    }
    const handleClick = (e: any) => {
      if (e.path.includes(listRef.current)) {
        return;
      }
      setSubFormVisible((cur) => {
        if (cur) {
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

  return (
    <div className={`${css.listSetter} fangzhou-theme`} ref={listRef}>
      <div className={css.list}>
        {list.map((item, index) => {
          if (visibleField && !item[visibleField]) {
            return;
          }
          // if (typeof item.ifVisible === 'function') {
          //   item._visible = item.ifVisible();
          //   if (!item._visible) return;
          // }
          return (
            <div
              key={item._id}
              className={`${css.listItem} ${
                editId === item._id
                  ? `${css.listItemSelect} ${css.active}`
                  : css.listItemSelect
              }`}
              onClick={() => {
                setSubFormVisible(false);
                setEditId(null);
              }}
            >
              <Checkbox
                onChange={({ target }) => {
                  const { checked } = target;
                  listModel.setItemChecked({ checked, id: item?._id });
                }}
                checked={item && item[checkField]}
                onClick={(e) => {
                  e.stopPropagation();
                  // setEditId(() => {
                  //   setSubFormVisible(true)
                  //   return item._id
                  // })
                }}
              />
              <div
                className={css.listItemContent}
                //style={{ paddingLeft: "8px" }}
              >
                <Title
                  items={
                    typeof getTitle === "function"
                      ? getTitle(item || {}, index)
                      : []
                  }
                />
              </div>
              {editable && (
                <div
                  className={editId === item._id ? css.editActive : css.edit}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditId((c) => {
                      if (c == item._id) {
                        setSubFormVisible((curVisible) => {
                          return !curVisible;
                        });
                        return null;
                      } else {
                        setSubFormVisible(true);
                        return item._id;
                      }
                    });
                  }}
                >
                  <ExpandIcon />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <Drawer
        className={css.drawerWrapper}
        rootClassName={css.drawerWrapper}
        bodyStyle={{
          borderLeft: "1px solid #bbb",
          backgroundColor: "#F7F7F7",
          padding: 0,
        }}
        key={editIndex} // 用来触发forceRender，因为有些编辑器初始化后就不接收value参数了，不是完全受控的
        placement="right"
        closable={false}
        onClose={() => setSubFormVisible(false)}
        mask={false}
        visible={subFormVisible && !!editId}
        // @ts-ignore
        getContainer={() => document.querySelector('div[class^="lyStage-"]')}
        style={{ position: "absolute" }}
        rootStyle={{position: "absolute",left:'unset'}}
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
        <div style={{ padding: "15px" }}>
          <RenderEditor
            extraContext={extraContext}
            editConfig={{
              type: "Switch",
              title: "启用",
              value: list[editIndex] && list[editIndex][checkField],
              getDefaultOptions,
            }}
            value={list[editIndex] && list[editIndex][checkField]}
            onChange={(v) => {
              listModel.setItemChecked({
                checked: v,
                id: list[editIndex]?._id,
              });
            }}
          />
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
      </Drawer>
    </div>
  );
}
