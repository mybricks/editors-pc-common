/**
 * 从系统剪贴板读取 Figma 复制的 HTML（优先 text/html，否则纯文本）。
 */
import lang from '../../style_new/index.i18n';

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
    throw new Error(lang.figmaClipboardReadUnsupported);
  }
  const text = await navigator.clipboard.readText();
  if (text && (text.includes('(figma)') || text.includes('fig-kiwi'))) return text;
  throw new Error(lang.figmaClipboardNoDataDetected);
}
