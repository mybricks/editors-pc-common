import { EditorProps } from "@/interface";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Colorpicker } from "../style_new/StyleEditor/components/Colorpicker";
import { PlusOutlined, MinusOutlined } from "../style_new/StyleEditor/components/Icon";
import { InputNumber } from "./InputNumber";
import css from "./index.less";

interface ThemeVar {
  propertyName: string;
  title: string;
  value: string;
  type: "color" | "borderRadius" | "spacing";
}

interface Theme {
  id: string;
  name: string;
  vars: ThemeVar[];
}

interface ThemeData {
  themes: Theme[];
  activeThemeId: string;
}

const GROUPS: { type: ThemeVar["type"]; label: string }[] = [
  { type: "color", label: "颜色" },
  { type: "borderRadius", label: "圆角" },
  { type: "spacing", label: "间距" },
];

const DEFAULT_VALUES: Record<ThemeVar["type"], string> = {
  color: "#1890ff",
  borderRadius: "4px",
  spacing: "8px",
};

const DEFAULT_TITLES: Record<ThemeVar["type"], string> = {
  color: "新颜色",
  borderRadius: "新圆角",
  spacing: "新间距",
};

//随机id生成器
const _genUid = () => Math.random().toString(36).slice(2, 10);

//唯一css变量名生成器
const genKey = (type: string) => `--theme-${type}-${_genUid()}`;

//唯一主题id生成器
const genId = () => `theme-${_genUid()}`;

function migrateData(raw: any): ThemeData {
  if (!raw) {
    const id = genId();
    return { themes: [{ id, name: "默认主题", vars: [] }], activeThemeId: id };
  }
  if (Array.isArray(raw)) {
    const id = genId();
    return { themes: [{ id, name: "默认主题", vars: raw }], activeThemeId: id };
  }
  if (raw.themes && Array.isArray(raw.themes)) {
    return raw as ThemeData;
  }
  const id = genId();
  return { themes: [{ id, name: "默认主题", vars: [] }], activeThemeId: id };
}

export default function ({ editConfig }: EditorProps): JSX.Element {
  const { value } = editConfig;
  const tabListRef = useRef<HTMLDivElement>(null);
  const initialData = useRef<ThemeData>(migrateData(value.get())).current;

  const [themeData, setThemeData] = useState<ThemeData>(initialData);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const activeTheme = initialData.themes.find((t) => t.id === initialData.activeThemeId) || initialData.themes[0];
    const vars = activeTheme?.vars || [];
    const expandedTypes = new Set(vars.map((v) => v.type));
    return new Set(GROUPS.map((g) => g.type).filter((t) => !expandedTypes.has(t)));
  });

  const activeTheme = themeData.themes.find((t) => t.id === themeData.activeThemeId) || themeData.themes[0];
  const themeVars = activeTheme?.vars || [];

  const updateThemeData = useCallback((updater: (prev: ThemeData) => ThemeData) => {
    setThemeData((prev) => {
      const next = updater(prev);
      value.set(next);
      return next;
    });
  }, []);

  const updateVars = useCallback((updater: (prev: ThemeVar[]) => ThemeVar[]) => {
    updateThemeData((prev) => {
      const next = { ...prev, themes: prev.themes.map((t) =>
        t.id === prev.activeThemeId ? { ...t, vars: updater(t.vars) } : t
      )};
      return next;
    });
  }, []);

  // ---- Theme Tab 操作 ----

  const handleAddTheme = useCallback(() => {
    const id = genId();
    updateThemeData((prev) => {
      const sourceTheme = prev.themes.find((t) => t.id === prev.activeThemeId) || prev.themes[0];
      const copiedVars: ThemeVar[] = (sourceTheme?.vars || []).map((v) => ({
        ...v,
        value: DEFAULT_VALUES[v.type],
      }));
      const newTheme: Theme = { id, name: "新主题", vars: copiedVars };
      return { themes: [...prev.themes, newTheme], activeThemeId: prev.activeThemeId };
    });
    requestAnimationFrame(() => {
      if (tabListRef.current) {
        tabListRef.current.scrollTo({ left: tabListRef.current.scrollWidth, behavior: "smooth" });
      }
    });
  }, []);

  const handleSwitchTheme = useCallback((id: string) => {
    updateThemeData((prev) => {
      const theme = prev.themes.find((t) => t.id === id);
      const vars = theme?.vars || [];
      const expandedTypes = new Set(vars.map((v) => v.type));
      setCollapsedGroups(new Set(GROUPS.map((g) => g.type).filter((t) => !expandedTypes.has(t))));
      setEditingKey(null);
      return { ...prev, activeThemeId: id };
    });
    requestAnimationFrame(() => {
      if (tabListRef.current) {
        const container = tabListRef.current;
        const el = container.querySelector<HTMLElement>(`[data-theme-id="${id}"]`);
        if (el) {
          const targetScrollLeft = el.offsetLeft - container.clientWidth / 2 + el.offsetWidth / 2;
          container.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
        }
      }
    });
  }, []);

  const handleDeleteTheme = useCallback((id: string) => {
    updateThemeData((prev) => {
      if (prev.themes.length <= 1) return prev;
      const themes = prev.themes.filter((t) => t.id !== id);
      const activeThemeId = prev.activeThemeId === id ? themes[0].id : prev.activeThemeId;
      return { themes, activeThemeId };
    });
  }, []);

  const handleRenameTheme = useCallback((id: string, name: string) => {
    updateThemeData((prev) => ({
      ...prev,
      themes: prev.themes.map((t) => t.id === id ? { ...t, name } : t),
    }));
    setEditingTabId(null);
  }, []);

  // ---- Var 操作 ----

  const handleAdd = useCallback((type: ThemeVar["type"]) => {
    const key = genKey(type);
    const newVarTemplate: Omit<ThemeVar, "value"> = {
      propertyName: key,
      title: DEFAULT_TITLES[type],
      type,
    };
    // 同步新增到所有主题，各主题使用各自的默认值
    updateThemeData((prev) => ({
      ...prev,
      themes: prev.themes.map((t) => ({
        ...t,
        vars: [...t.vars, { ...newVarTemplate, value: DEFAULT_VALUES[type] }],
      })),
    }));
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.delete(type);
      return next;
    });
  }, []);

  const handleDelete = useCallback((propertyName: string, type: ThemeVar["type"]) => {
    // 同步从所有主题中删除该 propertyName 对应的变量
    updateThemeData((prev) => {
      const next = {
        ...prev,
        themes: prev.themes.map((t) => ({
          ...t,
          vars: t.vars.filter((v) => v.propertyName !== propertyName),
        })),
      };
      const activeTheme = next.themes.find((t) => t.id === next.activeThemeId) || next.themes[0];
      const remaining = (activeTheme?.vars || []).filter((v) => v.type === type);
      if (remaining.length === 0) {
        setCollapsedGroups((groups) => new Set(Array.from(groups).concat(type)));
      }
      return next;
    });
  }, []);

  const handleColorChange = useCallback((propertyName: string, newValue: string) => {
    updateVars((prev) => prev.map((v) => v.propertyName === propertyName ? { ...v, value: newValue } : v));
  }, []);

  const handleValueChange = useCallback((propertyName: string, newValue: string) => {
    updateVars((prev) => prev.map((v) => v.propertyName === propertyName ? { ...v, value: newValue } : v));
  }, []);

  const handleTitleBlur = useCallback((propertyName: string, title: string) => {
    // 标题是字段的语义描述，同步到所有主题
    updateThemeData((prev) => ({
      ...prev,
      themes: prev.themes.map((t) => ({
        ...t,
        vars: t.vars.map((v) => v.propertyName === propertyName ? { ...v, title } : v),
      })),
    }));
    setEditingKey(null);
  }, []);

  return (
    <div className={css.themesEditor}>
      {/* 标题行：主题 + 新增按钮 */}
      <div className={css.titleRow}>
        <span className={css.editorTitle}>主题</span>
        <div className={css.addTab} onClick={handleAddTheme}>
          <PlusOutlined />
        </div>
      </div>

      {/* Tab 列表 */}
      <div className={css.tabListWrap}>
        <div className={css.tabList} ref={tabListRef}>
        {themeData.themes.map((theme) => {
          const isActive = theme.id === themeData.activeThemeId;
          const isEditingTab = editingTabId === theme.id;
          return (
              <div
                key={theme.id}
                data-theme-id={theme.id}
                className={`${css.tab} ${isActive ? css.tabActive : ""}`}
                onClick={() => !isEditingTab && handleSwitchTheme(theme.id)}
              >
                {isEditingTab ? (
                  <input
                    className={css.tabInput}
                    defaultValue={theme.name}
                    onBlur={(e) => handleRenameTheme(theme.id, e.target.value || theme.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditingTabId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <span
                    className={css.tabName}
                    data-mybricks-tip="双击修改标题"
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingTabId(theme.id); }}
                  >
                    {theme.name}
                  </span>
                )}
                {themeData.themes.length > 1 && (
                  <span
                    className={css.tabCloseBtn}
                    onClick={(e) => { e.stopPropagation(); handleDeleteTheme(theme.id); }}
                  >
                    <svg viewBox="0 0 10 10" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <line x1="1" y1="1" x2="9" y2="9" />
                      <line x1="9" y1="1" x2="1" y2="9" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 变量分组列表 */}
      {GROUPS.map(({ type, label }) => {
        const items = themeVars.filter((v) => v.type === type);
        const collapsed = collapsedGroups.has(type);
        return (
          <div key={type} className={`${css.group} ${collapsed ? css.groupCollapsed : ""}`}>
            <div className={css.groupHeader}>
              <span className={css.groupTitle}>{label}</span>
              <div className={css.addBtn} onClick={() => handleAdd(type)}>
                <PlusOutlined />
              </div>
            </div>

            {!collapsed && items.map((themeVar) => (
              <div key={themeVar.propertyName} className={css.wrapContainer}>
                <div className={css.wrap}>
                  <div className={css.themeItem}>
                    {type === "color" && (
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

                    {(type === "borderRadius" || type === "spacing") && (
                      <InputNumber
                        value={themeVar.value}
                        style={{ padding: 0, fontSize: 10, minWidth: 48, maxWidth: 48 }}
                        unitOptions={[
                          { label: "px", value: "px" },
                          { label: "%", value: "%" },
                        ]}
                        onChange={(val) => handleValueChange(themeVar.propertyName, val)}
                      />
                    )}

                    <div className={css.themeInfo}>
                      {editingKey === themeVar.propertyName ? (
                        <input
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
                        <span
                          className={css.themeTitle}
                          data-mybricks-tip="双击修改标题"
                          onDoubleClick={() => setEditingKey(themeVar.propertyName)}
                        >
                          {themeVar.title}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className={css.deleteBtn} onClick={() => handleDelete(themeVar.propertyName, type)}>
                  <MinusOutlined />
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
