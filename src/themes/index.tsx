import { EditorProps } from "@/interface";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Colorpicker } from "../style_new/StyleEditor/components/Colorpicker";
import { PlusOutlined, MinusOutlined, ReloadOutlined } from "../style_new/StyleEditor/components/Icon";
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

const DEFAULT_THEME_DATA: ThemeData = {
  activeThemeId: "theme-light",
  themes: [
    {
      id: "theme-light",
      name: "亮色主题",
      vars: [
        { propertyName: "--color-primary", value: "#1890ff", title: "品牌色", type: "color" },
        { propertyName: "--color-primary-bg", value: "#e6f7ff", title: "主色浅色背景", type: "color" },
        { propertyName: "--color-primary-hover", value: "#40a9ff", title: "主色悬浮态", type: "color" },
        { propertyName: "--color-primary-active", value: "#096dd9", title: "主色激活态", type: "color" },
        { propertyName: "--color-error", value: "#ff4d4f", title: "错误色", type: "color" },
        { propertyName: "--color-warning", value: "#faad14", title: "警戒色", type: "color" },
        { propertyName: "--color-success", value: "#52c41a", title: "成功色", type: "color" },
        { propertyName: "--color-link", value: "#1890ff", title: "链接色", type: "color" },
        { propertyName: "--color-link-hover", value: "#69c0ff", title: "链接悬浮色", type: "color" },
        { propertyName: "--color-text", value: "rgba(0, 0, 0, 0.88)", title: "一级文本色", type: "color" },
        { propertyName: "--color-text-secondary", value: "rgba(0, 0, 0, 0.65)", title: "二级文本色", type: "color" },
        { propertyName: "--color-text-tertiary", value: "rgba(0, 0, 0, 0.45)", title: "三级文本色", type: "color" },
        { propertyName: "--color-bg-base", value: "#ffffff", title: "基础背景色", type: "color" },
        { propertyName: "--color-bg-container", value: "#ffffff", title: "容器背景色", type: "color" },
        { propertyName: "--color-bg-layout", value: "#f5f5f5", title: "布局背景色", type: "color" },
        { propertyName: "--color-bg-mask", value: "rgba(0, 0, 0, 0.45)", title: "蒙层背景色", type: "color" },
        { propertyName: "--color-border", value: "#d9d9d9", title: "一级边框色", type: "color" },
        { propertyName: "--color-border-secondary", value: "#f0f0f0", title: "二级边框色", type: "color" },
        { propertyName: "--color-fill", value: "rgba(0, 0, 0, 0.15)", title: "一级填充色", type: "color" },
        { propertyName: "--color-fill-secondary", value: "rgba(0, 0, 0, 0.06)", title: "二级填充色", type: "color" },
        { propertyName: "--radius-sm", value: "4px", title: "小圆角", type: "borderRadius" },
        { propertyName: "--radius-base", value: "8px", title: "基础圆角", type: "borderRadius" },
        { propertyName: "--radius-lg", value: "12px", title: "大圆角", type: "borderRadius" },
        { propertyName: "--radius-pill", value: "100px", title: "胶囊圆角", type: "borderRadius" },
        { propertyName: "--spacing-xs", value: "4px", title: "超小间距", type: "spacing" },
        { propertyName: "--spacing-sm", value: "8px", title: "小间距", type: "spacing" },
        { propertyName: "--spacing-base", value: "16px", title: "基础间距", type: "spacing" },
        { propertyName: "--spacing-md", value: "24px", title: "中间距", type: "spacing" },
        { propertyName: "--spacing-lg", value: "32px", title: "大间距", type: "spacing" },
        { propertyName: "--spacing-xl", value: "40px", title: "超大间距", type: "spacing" },
      ],
    },
    {
      id: "theme-dark",
      name: "暗黑主题",
      vars: [
        { propertyName: "--color-primary", value: "#1668dc", title: "品牌色", type: "color" },
        { propertyName: "--color-primary-bg", value: "#111d2c", title: "主色浅色背景", type: "color" },
        { propertyName: "--color-primary-hover", value: "#3c89e8", title: "主色悬浮态", type: "color" },
        { propertyName: "--color-primary-active", value: "#0958d9", title: "主色激活态", type: "color" },
        { propertyName: "--color-error", value: "#dc4446", title: "错误色", type: "color" },
        { propertyName: "--color-warning", value: "#d89614", title: "警戒色", type: "color" },
        { propertyName: "--color-success", value: "#49aa19", title: "成功色", type: "color" },
        { propertyName: "--color-link", value: "#1668dc", title: "链接色", type: "color" },
        { propertyName: "--color-link-hover", value: "#3c89e8", title: "链接悬浮色", type: "color" },
        { propertyName: "--color-text", value: "rgba(255, 255, 255, 0.85)", title: "一级文本色", type: "color" },
        { propertyName: "--color-text-secondary", value: "rgba(255, 255, 255, 0.65)", title: "二级文本色", type: "color" },
        { propertyName: "--color-text-tertiary", value: "rgba(255, 255, 255, 0.45)", title: "三级文本色", type: "color" },
        { propertyName: "--color-bg-base", value: "#141414", title: "基础背景色", type: "color" },
        { propertyName: "--color-bg-container", value: "#1f1f1f", title: "容器背景色", type: "color" },
        { propertyName: "--color-bg-layout", value: "#141414", title: "布局背景色", type: "color" },
        { propertyName: "--color-bg-mask", value: "rgba(0, 0, 0, 0.65)", title: "蒙层背景色", type: "color" },
        { propertyName: "--color-border", value: "#424242", title: "一级边框色", type: "color" },
        { propertyName: "--color-border-secondary", value: "#303030", title: "二级边框色", type: "color" },
        { propertyName: "--color-fill", value: "rgba(255, 255, 255, 0.18)", title: "一级填充色", type: "color" },
        { propertyName: "--color-fill-secondary", value: "rgba(255, 255, 255, 0.08)", title: "二级填充色", type: "color" },
        { propertyName: "--radius-sm", value: "4px", title: "小圆角", type: "borderRadius" },
        { propertyName: "--radius-base", value: "8px", title: "基础圆角", type: "borderRadius" },
        { propertyName: "--radius-lg", value: "12px", title: "大圆角", type: "borderRadius" },
        { propertyName: "--radius-pill", value: "100px", title: "胶囊圆角", type: "borderRadius" },
        { propertyName: "--spacing-xs", value: "4px", title: "超小间距", type: "spacing" },
        { propertyName: "--spacing-sm", value: "8px", title: "小间距", type: "spacing" },
        { propertyName: "--spacing-base", value: "16px", title: "基础间距", type: "spacing" },
        { propertyName: "--spacing-md", value: "24px", title: "中间距", type: "spacing" },
        { propertyName: "--spacing-lg", value: "32px", title: "大间距", type: "spacing" },
        { propertyName: "--spacing-xl", value: "40px", title: "超大间距", type: "spacing" },
      ],
    },
  ],
};

const DEFAULT_TITLES: Record<ThemeVar["type"], string> = {
  color: "新颜色",
  borderRadius: "新圆角",
  spacing: "新间距",
};

function syncThemeVarsToWindow(themeData: ThemeData) {
  const activeTheme = themeData.themes.find((t) => t.id === themeData.activeThemeId) || themeData.themes[0];
  (window as any).MYBRICKS_AICOM_THEME_VARIABLES = activeTheme?.vars || [];
}

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

  useEffect(() => {
    syncThemeVarsToWindow(initialData);
  }, []);

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
      const next = { ...prev, activeThemeId: id };
      syncThemeVarsToWindow(next);
      return next;
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

  const handleReset = useCallback(() => {
    const activeTheme = DEFAULT_THEME_DATA.themes.find((t) => t.id === DEFAULT_THEME_DATA.activeThemeId) || DEFAULT_THEME_DATA.themes[0];
    const vars = activeTheme?.vars || [];
    const expandedTypes = new Set(vars.map((v) => v.type));
    setCollapsedGroups(new Set(GROUPS.map((g) => g.type).filter((t) => !expandedTypes.has(t))));
    setEditingKey(null);
    setEditingTabId(null);
    updateThemeData(() => DEFAULT_THEME_DATA);
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
      {/* 标题行：主题 + 重置按钮 + 新增按钮 */}
      <div className={css.titleRow}>
        <span className={css.editorTitle}>主题</span>
        <div className={css.resetBtn} data-mybricks-tip={`{content:'重置为默认主题',position:'left'}`} onClick={handleReset}>
          <ReloadOutlined />
        </div>
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
                        disableVariable
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
