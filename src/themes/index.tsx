import { EditorProps } from "@/interface";
import React, { useCallback, useRef, useState } from "react";
import { Colorpicker } from "../style_new/StyleEditor/components/Colorpicker";
import { PlusOutlined, MinusOutlined } from "../style_new/StyleEditor/components/Icon";
import css from "./index.less";

interface ThemeVar {
  propertyName: string;
  title: string;
  value: string;
  type: string;
}

let uid = 0;
const genKey = () => `theme-var-${++uid}`;

export default function ({ editConfig }: EditorProps): JSX.Element {
  const { value } = editConfig;

  const [themeVars, setThemeVars] = useState<ThemeVar[]>(value.get() || []);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = useCallback((next: ThemeVar[]) => {
    setThemeVars(next);
    value.set(next);
  }, []);

  const handleColorChange = useCallback((propertyName: string, newValue: string) => {
    commit(themeVars.map((v) =>
      v.propertyName === propertyName ? { ...v, value: newValue } : v
    ));
  }, [themeVars]);

  const handleDelete = useCallback((propertyName: string) => {
    commit(themeVars.filter((v) => v.propertyName !== propertyName));
  }, [themeVars]);

  const handleAdd = useCallback(() => {
    const key = genKey();
    const newVar: ThemeVar = { propertyName: key, title: "新主题变量", value: "#1890ff", type: "color" };
    const next = [...themeVars, newVar];
    commit(next);
    setEditingKey(key);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [themeVars]);

  const handleTitleBlur = useCallback((propertyName: string, title: string) => {
    commit(themeVars.map((v) =>
      v.propertyName === propertyName ? { ...v, title } : v
    ));
    setEditingKey(null);
  }, [themeVars]);

  return (
    <div className={css.themesEditor}>
      <div className={css.header}>
        <span className={css.headerTitle}>主题颜色</span>
        <span className={css.addIconBtn} onClick={handleAdd} title="新增主题色">
          <PlusOutlined />
        </span>
      </div>

      <div className={css.list}>
        {themeVars.map((themeVar) => (
          <div key={themeVar.propertyName} className={css.themeItem}>
            {themeVar.type === "color" && (
              <Colorpicker
                context={{}}
                value={themeVar.value || "#000000"}
                showSubTabs={false}
                disableBackgroundImage
                disableGradient
                onChange={(result) => {
                  const val = Array.isArray(result) ? result[0]?.value : (result as any)?.value;
                  if (val) handleColorChange(themeVar.propertyName, val);
                }}
              >
                <div
                  className={css.colorSwatch}
                  style={{ backgroundColor: themeVar.value || "#000000" }}
                />
              </Colorpicker>
            )}

            <div className={css.themeInfo}>
              {editingKey === themeVar.propertyName ? (
                <input
                  ref={inputRef}
                  className={css.titleInput}
                  defaultValue={themeVar.title}
                  onBlur={(e) => handleTitleBlur(themeVar.propertyName, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditingKey(null);
                  }}
                  autoFocus
                />
              ) : (
                <span className={css.themeTitle} onDoubleClick={() => setEditingKey(themeVar.propertyName)}>
                  {themeVar.title}
                </span>
              )}
            </div>

            <span className={css.deleteBtn} onClick={() => handleDelete(themeVar.propertyName)} title="删除">
              <MinusOutlined />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
