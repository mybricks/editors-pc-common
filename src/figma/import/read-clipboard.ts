/**
 * 从系统剪贴板读取 Figma 复制的 HTML（优先 text/html，否则纯文本）。
 */
export async function readFigmaClipboardHtml(): Promise<string> {
  if (navigator.clipboard && typeof navigator.clipboard.read === 'function') {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const types = item.types || [];
        for (const mime of types) {
          try {
            const blob = await item.getType(mime);
            const html = await blob.text();
            if (html && (html.includes('(figma)') || html.includes('fig-kiwi'))) return html;
          } catch (_) {
            /* 某些 MIME 不可读为 text，跳过 */
          }
        }
      }
    } catch (_) {
      /* 回退 readText */
    }
  }
  if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
    throw new Error('当前环境不支持读取剪贴板');
  }
  const text = await navigator.clipboard.readText();
  if (text && (text.includes('(figma)') || text.includes('fig-kiwi'))) return text;
  throw new Error('剪贴板中未检测到 Figma 数据，请在 Figma 内选中节点后使用 Ctrl/Cmd+C 复制');
}
