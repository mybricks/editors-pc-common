import React from "react";
import { EditorProps } from "../interface";
import { useDarkMode } from "../hooks/useDarkMode";

type RenderPrdView = (props?: {
  content: string;
  darkMode?: boolean;
}) => React.ReactElement;

function getRenderPrdView(): RenderPrdView | undefined {
  return window._sandbox_?.helpers?.renders?.renderPrdView;
}

/**
 * 只读 Markdown 预览。
 *
 * 渲染逻辑和样式由 plugin-ai 提供，因此这里不引入 markdown-it，也不复制
 * PRD / Mermaid 的实现。AI 插件未初始化时给出可识别的占位提示。
 */
export default function MarkdownView({ editConfig }: EditorProps): JSX.Element {
  const darkMode = useDarkMode();
  const renderPrdView = getRenderPrdView();
  const rawContent = editConfig.value?.get?.();
  const content = typeof rawContent === "string" ? rawContent : "";

  if (!renderPrdView) {
    return (
      <div style={{ padding: 12, color: "#999", fontSize: 12 }}>
        Markdown 预览能力未就绪
      </div>
    );
  }

  return renderPrdView({ content, darkMode });
}
