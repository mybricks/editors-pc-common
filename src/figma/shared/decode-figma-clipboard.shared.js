function decodeHtmlEntities(str) {
  if (!str) return "";
  return String(str)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
}

function extractTaggedBase64(html, tag) {
  var re = new RegExp("<!--\\(" + tag + "\\)([\\s\\S]*?)\\(\\/" + tag + "\\)-->", "i");
  var m = html.match(re);
  if (m) return m[1].replace(/\s+/g, "");
  var re2 = new RegExp("\\(" + tag + "\\)([\\s\\S]*?)\\(\\/" + tag + "\\)", "i");
  var m2 = html.match(re2);
  if (m2) return m2[1].replace(/\s+/g, "");
  return "";
}

function extractFromDataAttr(html, attrName, tag) {
  if (!html) return "";
  var re = new RegExp(attrName + "\\s*=\\s*([\"'])([\\s\\S]*?)\\1", "i");
  var m = html.match(re);
  if (!m) return "";
  var rawAttr = m[2] || "";
  var decodedAttr = decodeHtmlEntities(rawAttr);
  return extractTaggedBase64(decodedAttr, tag);
}

function maybeBase64FigKiwi(str) {
  if (!str) return "";
  var compact = String(str).replace(/\s+/g, "");
  if (/^ZmlnLWtpd2k/i.test(compact) && compact.length > 32) return compact;
  return "";
}

function base64ToUint8(b64) {
  var clean = String(b64 || "").replace(/\s+/g, "");
  var bin = atob(clean);
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function readU32LE(u8, off) {
  return (u8[off] | (u8[off + 1] << 8) | (u8[off + 2] << 16) | (u8[off + 3] << 24)) >>> 0;
}

function bytesToAscii(u8, start, len) {
  var s = "";
  for (var i = 0; i < len; i++) s += String.fromCharCode(u8[start + i]);
  return s;
}

function parseArchive(figmaBin) {
  if (!figmaBin || figmaBin.length < 20) throw new Error("fig-kiwi 数据过短");
  var prelude = bytesToAscii(figmaBin, 0, 8);
  if (prelude !== "fig-kiwi") throw new Error("非 fig-kiwi 格式，prelude=" + prelude);
  var version = readU32LE(figmaBin, 8) >>> 0;
  var schemaLen = readU32LE(figmaBin, 12) >>> 0;
  var schemaStart = 16;
  var schemaEnd = schemaStart + schemaLen;
  if (schemaEnd + 4 > figmaBin.length) throw new Error("schema chunk 越界");
  var messageLen = readU32LE(figmaBin, schemaEnd) >>> 0;
  var messageStart = schemaEnd + 4;
  var messageEnd = messageStart + messageLen;
  if (messageEnd > figmaBin.length) throw new Error("message chunk 越界");
  return {
    version: version,
    schemaChunk: figmaBin.subarray(schemaStart, schemaEnd),
    messageChunk: figmaBin.subarray(messageStart, messageEnd)
  };
}

function looksLikeZstdFrame(chunk) {
  return !!(
    chunk &&
    chunk.length >= 4 &&
    chunk[0] === 0x28 &&
    chunk[1] === 0xb5 &&
    chunk[2] === 0x2f &&
    chunk[3] === 0xfd
  );
}

function hexPrefix(chunk, n) {
  var m = Math.min(n, chunk.length);
  var s = "";
  for (var i = 0; i < m; i++) s += (i ? " " : "") + chunk[i].toString(16).padStart(2, "0");
  return s + (chunk.length > m ? "…" : "");
}

function decompressChunk(chunk, archiveVersion, deps) {
  var preferZstd = archiveVersion === 106 || looksLikeZstdFrame(chunk);
  var attempts = [];

  if (preferZstd && typeof deps.zstdDecompress === "function") {
    attempts.push({ name: "zstd", fn: function() { return deps.zstdDecompress(chunk); } });
  }
  attempts.push(
    { name: "inflateRaw", fn: function() { return deps.inflateRaw(chunk); } },
    { name: "inflate", fn: function() { return deps.inflate(chunk); } },
    { name: "ungzip", fn: function() { return deps.ungzip(chunk); } }
  );
  if (!preferZstd && typeof deps.zstdDecompress === "function") {
    attempts.push({ name: "zstd", fn: function() { return deps.zstdDecompress(chunk); } });
  }

  var errors = [];
  for (var i = 0; i < attempts.length; i++) {
    try {
      return { bytes: attempts[i].fn(), method: attempts[i].name };
    } catch (e) {
      errors.push(attempts[i].name + ":" + (e && e.message ? e.message : String(e)));
    }
  }
  throw new Error(
    "解压失败（已尝试 " +
      attempts.map(function(a) { return a.name; }).join("、") +
      "）。archiveVersion=" +
      archiveVersion +
      " chunk前8字节=" +
      hexPrefix(chunk, 8) +
      " | " +
      errors.join(" | ")
  );
}

function validateDeps(deps) {
  var missing = [];
  if (!deps || typeof deps !== "object") missing.push("deps");
  if (!deps || typeof deps.inflateRaw !== "function") missing.push("inflateRaw");
  if (!deps || typeof deps.inflate !== "function") missing.push("inflate");
  if (!deps || typeof deps.ungzip !== "function") missing.push("ungzip");
  if (!deps || typeof deps.decodeBinarySchema !== "function") missing.push("decodeBinarySchema");
  if (!deps || typeof deps.compileSchema !== "function") missing.push("compileSchema");
  if (missing.length) throw new Error("decode 依赖缺失: " + missing.join(", "));
}

function decodeFigmaClipboardHtmlWithDeps(html, deps) {
  validateDeps(deps);
  var decodedHtml = decodeHtmlEntities(html || "");
  var figmetaB64 = extractTaggedBase64(decodedHtml, "figmeta");
  if (!figmetaB64) figmetaB64 = extractFromDataAttr(decodedHtml, "data-metadata", "figmeta");
  var figmaB64 = extractTaggedBase64(decodedHtml, "figma");
  if (!figmaB64) figmaB64 = extractFromDataAttr(decodedHtml, "data-buffer", "figma");
  if (!figmaB64) figmaB64 = maybeBase64FigKiwi(decodedHtml);
  if (!figmaB64) {
    throw new Error("未找到 figma 数据，请确认已在 Figma 中复制（剪贴板需含 figma 标记）");
  }

  var meta = null;
  if (figmetaB64) {
    try {
      meta = JSON.parse(new TextDecoder("utf-8").decode(base64ToUint8(figmetaB64)));
    } catch (_) {
      meta = null;
    }
  }

  var figmaBin = base64ToUint8(figmaB64);
  var archive = parseArchive(figmaBin);
  var schemaRaw = decompressChunk(archive.schemaChunk, archive.version, deps);
  var messageRaw = decompressChunk(archive.messageChunk, archive.version, deps);

  var schemaObj = deps.decodeBinarySchema(schemaRaw.bytes);
  var compiled = deps.compileSchema(schemaObj);
  var message = compiled.decodeMessage(messageRaw.bytes);

  return {
    meta: meta,
    archiveVersion: archive.version,
    message: message,
    figmaBytes: figmaBin.length,
    schemaBytes: archive.schemaChunk.length,
    messageBytes: archive.messageChunk.length,
    schemaMethod: schemaRaw.method,
    messageMethod: messageRaw.method,
    compiled: compiled,
    schemaRawBytes: schemaRaw.bytes
  };
}

function getNodeChangesFromMessage(message) {
  var nodeChanges =
    (message && message.nodeChanges) ||
    (message &&
      message.message &&
      typeof message.message === "object" &&
      message.message !== null &&
      message.message.nodeChanges);
  if (Array.isArray(nodeChanges)) return nodeChanges;
  return null;
}

function buildNodeTreeLines(nodeChanges) {
  if (!nodeChanges) return [];
  return nodeChanges.map(function(raw, i) {
    var n = raw || {};
    var sz = n.size || {};
    var tr = n.transform || [];
    var x = tr[0] && tr[0][2] != null ? Math.round(Number(tr[0][2])) : "?";
    var y = tr[1] && tr[1][2] != null ? Math.round(Number(tr[1][2])) : "?";
    var w = sz.x != null ? Math.round(Number(sz.x)) : "?";
    var h = sz.y != null ? Math.round(Number(sz.y)) : "?";
    var children = n.children;
    var stackMode = n.stackMode;
    var stackWrap = n.stackWrap;
    var stackSpacing = n.stackSpacing;
    var layout;
    if (stackMode) layout = String(stackMode) + (stackWrap ? "/" + stackWrap : "") + " gap=" + (stackSpacing != null ? stackSpacing : "-");
    return {
      index: i,
      type: String(n.type || ""),
      name: String(n.name || ""),
      x: x,
      y: y,
      w: w,
      h: h,
      layout: layout,
      childCount: Array.isArray(children) ? children.length : 0
    };
  });
}

export {
  decodeFigmaClipboardHtmlWithDeps,
  getNodeChangesFromMessage,
  buildNodeTreeLines
};
