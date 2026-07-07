import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { arrayMoveImmutable } from "../utils";
import css from "./index.less";
import {
  SortableContainer,
  SortableElement,
  SortableHandle,
  useLazy,
} from "../array/listSetter/lazySortableHoc";
import { DeleteIcon, DragIcon } from "../array/listSetter/constants";

const getUid = (len = 6) => {
  const chars =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const uuid = [];
  for (let i = 0; i < len; i++)
    uuid[i] = chars[0 | Math.floor(Math.random() * chars.length)];
  return uuid.join("");
};

type ListItem = { _id: string; value: string };

const initData = (val: any): ListItem[] => {
  if (!Array.isArray(val)) {
    return [];
  }
  return val.map((t) => ({ _id: getUid(), value: String(t ?? "") }));
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
  <div className={css.grab} title="拖动当前项">
    <DragIcon />
  </div>
));

interface StringArrayProps {
  editConfig: {
    value: { get: () => any; set: (v: any) => void };
    options?: any;
  };
  [k: string]: any;
}

export default function StringArrayEditor({ editConfig }: StringArrayProps) {
  const { value, options = {} } = editConfig;
  const opt = useMemo(() => {
    if (typeof options === "function") return options();
    return options || {};
  }, [options]);

  const addText: string = opt.addText ?? "添加一项";
  const draggable: boolean = opt.draggable !== false;
  const deletable: boolean = opt.deletable !== false;
  const addable: boolean = opt.addable !== false;
  const placeholder: string = opt.placeholder ?? "请输入";
  const defaultValue: string = opt.defaultValue ?? "";
  const cdnMap: any = opt.CDN || {};

  const [list, setList] = useState<ListItem[]>(() =>
    initData(value.get())
  );

  const changeFromOuter = useRef(false);
  const didMount = useRef(false);

  // Sync from outer value changes
  useEffect(() => {
    const outer = value.get();
    const current = list.map((t) => t.value);
    if (JSON.stringify(current) !== JSON.stringify(outer)) {
      changeFromOuter.current = true;
      setList(initData(outer));
    }
  }, [JSON.stringify(value.get())]);

  // Notify outer on internal changes
  useEffect(() => {
    if (!didMount.current) return;
    if (changeFromOuter.current) {
      changeFromOuter.current = false;
      return;
    }
    value.set(list.map((t) => t.value));
  }, [list]);

  useEffect(() => {
    didMount.current = true;
  }, []);

  const handleSortEnd = useCallback(
    ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) => {
      setList((prev) => arrayMoveImmutable(prev, oldIndex, newIndex));
    },
    []
  );

  const handleAdd = useCallback(() => {
    setList((prev) => prev.concat({ _id: getUid(), value: defaultValue }));
  }, [defaultValue]);

  const handleRemove = useCallback((id: string) => {
    setList((prev) => prev.filter((t) => t._id !== id));
  }, []);

  const handleChange = useCallback((id: string, val: string) => {
    setList((prev) => {
      const copy = [...prev];
      const idx = copy.findIndex((t) => t._id === id);
      if (idx !== -1) {
        copy[idx] = { ...copy[idx], value: val };
      }
      return copy;
    });
  }, []);

  const loaded = useLazy(cdnMap.sortableHoc);

  return (
    <div className={`${css.listSetter} fangzhou-theme`}>
      {addable && (
        <div className={css.btnGroup}>
          <div className={css.btn} onClick={handleAdd}>
            <span>+</span>
            {addText}
          </div>
        </div>
      )}

      <SortableList
        useDragHandle
        loaded={loaded}
        onSortEnd={handleSortEnd}
        lockAxis="y"
        helperClass={css.listItemSelect}
      >
        {list.map((item, index) => (
          <SortableItem loaded={loaded} key={item._id} index={index}>
            <div className={css.listItemCard}>
              <div className={css.listItemCardTop}>
                {draggable && <DragHandle loaded={loaded} />}
                <div className={css.listItemContent}>
                  <input
                    className={css.editInput}
                    value={item.value}
                    placeholder={placeholder}
                    onChange={(e) => handleChange(item._id, e.target.value)}
                    onBlur={() => value.set(list.map((t) => t.value))}
                  />
                </div>
                <div className={css.btns}>
                  {deletable && (
                    <div
                      className={css.delete}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(item._id);
                      }}
                    >
                      <DeleteIcon />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SortableItem>
        ))}
      </SortableList>
    </div>
  );
}
