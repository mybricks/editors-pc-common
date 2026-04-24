import { decodeFigmaClipboardHtmlWithDeps } from "./decode-figma-clipboard.shared.js";

/**
 * Inspector 入口：复用与编辑器 decode 相同的 shared 实现。
 * 真正逻辑源在 `shared/decode-figma-clipboard.shared.js`，并被
 * `import/decode-clipboard.ts`（编辑器运行路径）直接调用。
 */
export function decodeFigmaClipboardHtmlForInspector(html) {
  var pakoApi = window.pako;
  var fzstdApi = window.fzstd;
  var kiwiApi = window.kiwi;
  if (!pakoApi) throw new Error("缺少 window.pako，请先加载 pako-inflate 脚本");
  if (!kiwiApi || typeof kiwiApi.decodeBinarySchema !== "function" || typeof kiwiApi.compileSchema !== "function") {
    throw new Error("缺少 window.kiwi，请先加载 kiwi-schema/browser.js");
  }
  var out = decodeFigmaClipboardHtmlWithDeps(html, {
    inflateRaw: pakoApi.inflateRaw,
    inflate: pakoApi.inflate,
    ungzip: pakoApi.ungzip,
    zstdDecompress: fzstdApi && typeof fzstdApi.decompress === "function" ? fzstdApi.decompress : undefined,
    decodeBinarySchema: kiwiApi.decodeBinarySchema,
    compileSchema: kiwiApi.compileSchema,
  });
  out.decoderSource = "shared:shared/decode-figma-clipboard.shared.js (used by import/decode-clipboard.ts)";
  return out;
}
