'use strict';

/**
 * html-templates-loader.js
 *
 * 从传入的 HTML 字符串数组构建变体库模板。
 * 无 fs/path 依赖，可在浏览器（webpack）环境运行。
 *
 * 用法：
 *   var buildTemplate = require('./html-templates-loader');
 *   var sources = require('./template/index.js'); // [{ fileName, htmlContent }]
 *   var tpl = buildTemplate(sources, { kiwiSchema, inflateDeps });
 *
 * 两阶段处理：
 *   Phase 1 — 独立解码每个 HTML 字符串（互相无依赖），得到 nodeChanges + rawBlobs
 *   Phase 2 — 单次确定性合并：
 *     · blobOffset 在 Phase 2 开始时一次性预算，无中间状态（消除 ID 漂移）
 *     · GUID-based 去重（同一 Figma 文件内 GUID 唯一）
 *     · nonHollowByName 从全局节点全集建立（修复 Checkbox 图标空框 bug）
 *
 * deps = { kiwiSchema, inflateDeps: { inflateRaw, inflate, ungzip, zstdDecompress? } }
 */

// ─── HTML / fig-kiwi 解析工具（浏览器 + Node.js 兼容）─────────────────────────

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
}

function extractTaggedBase64(html, tag) {
  var re = new RegExp('<!--\\(' + tag + '\\)([\\s\\S]*?)\\(\\/' + tag + '\\)-->', 'i');
  var m = html.match(re);
  if (m) return m[1].replace(/\s+/g, '');
  var re2 = new RegExp('\\(' + tag + '\\)([\\s\\S]*?)\\(\\/' + tag + '\\)', 'i');
  var m2 = html.match(re2);
  if (m2) return m2[1].replace(/\s+/g, '');
  return '';
}

function extractFromDataAttr(html, attrName, tag) {
  var re = new RegExp(attrName + '\\s*=\\s*(["\'])([\\s\\S]*?)\\1', 'i');
  var m = html.match(re);
  if (!m) return '';
  return extractTaggedBase64(decodeHtmlEntities(m[2] || ''), tag);
}

function base64ToUint8(b64) {
  var clean = String(b64 || '').replace(/\s+/g, '');
  // Node.js
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(clean, 'base64'));
  // Browser
  var bin = atob(clean);
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64ToString(b64) {
  var bytes = base64ToUint8(b64);
  // Node.js
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('utf-8');
  // Browser
  return new TextDecoder('utf-8').decode(bytes);
}

function readU32LE(u8, off) {
  return (u8[off] | (u8[off + 1] << 8) | (u8[off + 2] << 16) | (u8[off + 3] << 24)) >>> 0;
}

function bytesToAscii(u8, start, len) {
  var s = '';
  for (var i = 0; i < len; i++) s += String.fromCharCode(u8[start + i]);
  return s;
}

function parseArchive(bin) {
  if (!bin || bin.length < 20) throw new Error('fig-kiwi 数据过短');
  var prelude = bytesToAscii(bin, 0, 8);
  if (prelude !== 'fig-kiwi') throw new Error('非 fig-kiwi 格式，prelude=' + prelude);
  var version   = readU32LE(bin, 8) >>> 0;
  var schemaLen = readU32LE(bin, 12) >>> 0;
  var schemaEnd = 16 + schemaLen;
  if (schemaEnd + 4 > bin.length) throw new Error('schema chunk 越界');
  var msgLen   = readU32LE(bin, schemaEnd) >>> 0;
  var msgStart = schemaEnd + 4;
  if (msgStart + msgLen > bin.length) throw new Error('message chunk 越界');
  return {
    version: version,
    schemaChunk: bin.subarray(16, schemaEnd),
    messageChunk: bin.subarray(msgStart, msgStart + msgLen),
  };
}

function looksLikeZstd(chunk) {
  return chunk && chunk.length >= 4 &&
    chunk[0] === 0x28 && chunk[1] === 0xb5 && chunk[2] === 0x2f && chunk[3] === 0xfd;
}

function decompressChunk(chunk, version, inflateDeps) {
  var preferZstd = version === 106 || looksLikeZstd(chunk);
  var fns = [];
  if (preferZstd && typeof inflateDeps.zstdDecompress === 'function') {
    fns.push(function() { return inflateDeps.zstdDecompress(chunk); });
  }
  fns.push(
    function() { return inflateDeps.inflateRaw(chunk); },
    function() { return inflateDeps.inflate(chunk); },
    function() { return inflateDeps.ungzip(chunk); }
  );
  if (!preferZstd && typeof inflateDeps.zstdDecompress === 'function') {
    fns.push(function() { return inflateDeps.zstdDecompress(chunk); });
  }
  var errs = [];
  for (var i = 0; i < fns.length; i++) {
    try { return fns[i](); } catch (e) { errs.push(String(e && e.message || e)); }
  }
  throw new Error('解压失败：' + errs.join(' | '));
}

// ─── Node 节点清理（移除 Uint8Array 及无需序列化的字段）────────────────────

var STRIP_KEYS = { handleMirroring: 1, isSymbolPublishable: 1 };

function cleanNode(val) {
  if (val == null || typeof val !== 'object') return val;
  if (val instanceof Uint8Array) return undefined;
  if (Array.isArray(val)) {
    var arr = [];
    for (var i = 0; i < val.length; i++) {
      var v = cleanNode(val[i]);
      arr.push(v === undefined ? null : v);
    }
    return arr;
  }
  var out = {};
  var keys = Object.keys(val);
  for (var j = 0; j < keys.length; j++) {
    var k = keys[j];
    if (k.charAt(0) === '_' || STRIP_KEYS[k]) continue;
    var cv = cleanNode(val[k]);
    if (cv !== undefined) out[k] = cv;
  }
  return out;
}

// ─── Blob → base64 ───────────────────────────────────────────────────────────

function blobToBase64(blob) {
  if (blob == null) return null;
  var bytes;
  if (blob instanceof Uint8Array) {
    bytes = blob;
  } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(blob)) {
    bytes = new Uint8Array(blob);
  } else if (Array.isArray(blob)) {
    bytes = new Uint8Array(blob);
  } else if (blob && blob.bytes instanceof Uint8Array) {
    bytes = blob.bytes;
  } else if (blob && Array.isArray(blob.bytes)) {
    bytes = new Uint8Array(blob.bytes);
  } else if (typeof blob === 'string') {
    return blob; // already base64
  } else {
    return null;
  }
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  // Browser fallback
  var binary = '';
  for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ─── Blob 引用 remap ──────────────────────────────────────────────────────────

function remapBlobRefs(val, offset) {
  if (!offset || val == null || typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    var arr = new Array(val.length);
    for (var i = 0; i < val.length; i++) arr[i] = remapBlobRefs(val[i], offset);
    return arr;
  }
  var out = {};
  var keys = Object.keys(val);
  for (var j = 0; j < keys.length; j++) {
    var k = keys[j];
    var v = val[k];
    if ((k === 'commandsBlob' || k === 'vectorNetworkBlob' || k === 'dataBlob' || k === 'blobRef') &&
        typeof v === 'number') {
      out[k] = v + offset;
    } else {
      out[k] = remapBlobRefs(v, offset);
    }
  }
  return out;
}

// ─── Phase 1：解码单个 HTML 字符串 ───────────────────────────────────────────

function decodeOneSource(source, deps) {
  var html = source.htmlContent;

  // 提取 figmeta（fileKey）
  var figmetaB64 = extractTaggedBase64(html, 'figmeta') ||
                   extractFromDataAttr(html, 'data-metadata', 'figmeta');
  var meta = null;
  if (figmetaB64) {
    try { meta = JSON.parse(base64ToString(figmetaB64)); } catch (_) {}
  }

  // 提取 figma binary
  var figmaB64 = extractTaggedBase64(html, 'figma') ||
                 extractFromDataAttr(html, 'data-buffer', 'figma');
  if (!figmaB64) throw new Error('未找到 figma 数据：' + source.fileName);

  var figmaBin = base64ToUint8(figmaB64);
  var archive  = parseArchive(figmaBin);
  var kiwi     = deps.kiwiSchema;
  var inflateDeps = deps.inflateDeps;

  var schemaBytes  = decompressChunk(archive.schemaChunk, archive.version, inflateDeps);
  var messageBytes = decompressChunk(archive.messageChunk, archive.version, inflateDeps);

  var schemaObj = kiwi.decodeBinarySchema(schemaBytes);
  var compiled  = kiwi.compileSchema(schemaObj);
  var message   = compiled.decodeMessage(messageBytes);

  var nodeChanges = (message && message.nodeChanges) || [];
  var rawBlobs    = (message && message.blobs) || [];

  return {
    fileName:    source.fileName,
    fileKey:     meta && meta.fileKey,
    nodeChanges: nodeChanges,
    rawBlobs:    rawBlobs,
  };
}

// ─── 变体过滤：只保留默认/静止态，排除交互态 ─────────────────────────────────

var INTERACTION_STATE_VALS = ['hover', 'focus', 'active', 'disabled', 'press', 'pressed'];

function isNormalVariant(node) {
  if (node.variantPropSpecs) {
    for (var vi = 0; vi < node.variantPropSpecs.length; vi++) {
      if (INTERACTION_STATE_VALS.indexOf((node.variantPropSpecs[vi].value || '').toLowerCase()) !== -1) return false;
    }
    if (node.symbolDescription && node.symbolDescription.indexOf('加载中=on') !== -1) return false;
    return true;
  }
  if (node.symbolDescription) {
    var desc = node.symbolDescription;
    if (desc.indexOf('状态=') === -1) return false;
    var descLow = desc.toLowerCase();
    for (var ii = 0; ii < INTERACTION_STATE_VALS.length; ii++) {
      if (descLow.indexOf('状态=' + INTERACTION_STATE_VALS[ii]) !== -1) return false;
    }
    if (desc.indexOf('加载中=on') !== -1) return false;
    return true;
  }
  return false;
}

// ─── 在子树中找第一个有效 TEXT overrideKey ───────────────────────────────────

function findFirstTextOverrideKey(parentGuidKey, childrenOf, globalGuidToNode) {
  var queue    = (childrenOf[parentGuidKey] || []).slice();
  var fallback = null;
  var seen     = Object.create(null);
  for (var qi = 0; qi < queue.length; qi++) {
    var gk = queue[qi];
    if (!gk || seen[gk]) continue;
    seen[gk] = true;
    var nd = globalGuidToNode[gk];
    if (!nd) continue;
    if (nd.type === 'TEXT') {
      if (nd.overrideKey) {
        var ovKey = nd.overrideKey.sessionID + ':' + nd.overrideKey.localID;
        var ovNode = globalGuidToNode[ovKey];
        if (!ovNode || ovNode.type === 'TEXT') {
          return { sessionID: nd.overrideKey.sessionID, localID: nd.overrideKey.localID };
        }
      } else if (!fallback) {
        fallback = { sessionID: nd.guid.sessionID, localID: nd.guid.localID };
      }
    }
    var kids = childrenOf[gk] || [];
    for (var ki = 0; ki < kids.length; ki++) queue.push(kids[ki]);
  }
  return fallback;
}

// ─── 收集节点子树（DFS，已清理）──────────────────────────────────────────────

function collectSubtree(rootGk, childrenOf, globalGuidToNode, collectedGuids, out) {
  var stack = (childrenOf[rootGk] || []).slice();
  while (stack.length) {
    var gk = stack.pop();
    if (!gk || collectedGuids[gk]) continue;
    collectedGuids[gk] = true;
    var n = globalGuidToNode[gk];
    if (n) out.push(cleanNode(n));
    var kids = childrenOf[gk] || [];
    for (var i = 0; i < kids.length; i++) stack.push(kids[i]);
  }
}

// ─── Phase 2：单次确定性合并 ─────────────────────────────────────────────────

var SYNTHETIC_IOC_GUID = { sessionID: 20004329, localID: 2 };

function mergeFileResults(fileResults) {
  // ── 2-1. 预算 blobOffset（一次性，无中间状态）────────────────────────────
  var totalBlobOffset = 0;
  for (var fi = 0; fi < fileResults.length; fi++) {
    fileResults[fi]._blobOffset = totalBlobOffset;
    totalBlobOffset += fileResults[fi].rawBlobs.length;
  }

  // ── 2-2. 建全局 guidToNode 表（跨所有文件，先入优先）────────────────────
  var globalGuidToNode = Object.create(null);
  for (var fi2 = 0; fi2 < fileResults.length; fi2++) {
    var nodes = fileResults[fi2].nodeChanges;
    for (var ni = 0; ni < nodes.length; ni++) {
      var nd = nodes[ni];
      if (!nd.guid) continue;
      var gk = nd.guid.sessionID + ':' + nd.guid.localID;
      if (!globalGuidToNode[gk]) globalGuidToNode[gk] = nd;
    }
  }

  // ── 2-3. 建全局 parent→children 映射 ────────────────────────────────────
  var childrenOf = Object.create(null);
  var allGks = Object.keys(globalGuidToNode);
  for (var ai = 0; ai < allGks.length; ai++) {
    var aGk = allGks[ai];
    var aNode = globalGuidToNode[aGk];
    if (!aNode.parentIndex || !aNode.parentIndex.guid) continue;
    var pgk = aNode.parentIndex.guid.sessionID + ':' + aNode.parentIndex.guid.localID;
    if (!childrenOf[pgk]) childrenOf[pgk] = [];
    childrenOf[pgk].push(aGk);
  }

  // ── 2-4. 建 componentKeyIndex ────────────────────────────────────────────
  var componentKeyIndex = Object.create(null);
  var fileKey = null;

  function recordNormalVariant(node, localChildrenOf, localGuidToNode) {
    if (!node.componentKey) return;
    if (componentKeyIndex[node.componentKey]) return;
    var nodeForCheck = node;
    if (!node.variantPropSpecs && node.publishID) {
      var pubGk2 = node.publishID.sessionID + ':' + node.publishID.localID;
      var mainNode = globalGuidToNode[pubGk2];
      if (mainNode && mainNode.variantPropSpecs) nodeForCheck = mainNode;
    }
    if (!isNormalVariant(nodeForCheck)) return;

    var canonicalGuid = node.guid;
    if (node.publishID &&
        (node.publishID.sessionID !== node.guid.sessionID ||
         node.publishID.localID   !== node.guid.localID)) {
      canonicalGuid = node.publishID;
    }
    var entry = { sessionID: canonicalGuid.sessionID, localID: canonicalGuid.localID };
    var coF = localChildrenOf || childrenOf;
    // 优先用局部节点表查找子树中的 TEXT overrideKey，避免跨文件 GUID 碰撞导致拿到错误文件的节点
    var localGm = localGuidToNode || globalGuidToNode;
    var textKey = findFirstTextOverrideKey(
      node.guid.sessionID + ':' + node.guid.localID, coF, localGm
    ) || findFirstTextOverrideKey(
      canonicalGuid.sessionID + ':' + canonicalGuid.localID, childrenOf, globalGuidToNode
    );
    if (textKey) entry.textOverrideKey = textKey;
    // 用局部节点表记录 IOC 副本的父节点（ComponentSet FRAME），避免跨模板 GUID 碰撞污染。
    // globalGuidToNode 是「先到先得」的全局表，多模板加载时 IOC 副本 GUID 可能被其他模板覆盖，
    // 导致 canonicalToIocCopy 失效；此处用 localGm（per-template）直接记录 csFrameGuid。
    if (node.parentIndex && node.parentIndex.guid) {
      var _pGk = node.parentIndex.guid.sessionID + ':' + node.parentIndex.guid.localID;
      var _pNode = localGm[_pGk];
      if (_pNode && _pNode.isStateGroup) {
        entry.csFrameGuid = { sessionID: node.parentIndex.guid.sessionID, localID: node.parentIndex.guid.localID };
      }
    }
    componentKeyIndex[node.componentKey] = entry;
  }

  for (var fi3 = 0; fi3 < fileResults.length; fi3++) {
    var fr = fileResults[fi3];
    if (!fileKey && fr.fileKey) fileKey = fr.fileKey;
    var nodes3 = fr.nodeChanges;

    var localChildrenOf = Object.create(null);
    var localGuidToNode = Object.create(null);
    for (var ni3 = 0; ni3 < nodes3.length; ni3++) {
      var nd3 = nodes3[ni3];
      if (!nd3.guid) continue;
      var ndGk = nd3.guid.sessionID + ':' + nd3.guid.localID;
      localGuidToNode[ndGk] = nd3;
      if (!nd3.parentIndex || !nd3.parentIndex.guid) continue;
      var ndPgk = nd3.parentIndex.guid.sessionID + ':' + nd3.parentIndex.guid.localID;
      if (!localChildrenOf[ndPgk]) localChildrenOf[ndPgk] = [];
      localChildrenOf[ndPgk].push(ndGk);
    }

    // 找 IOC Canvas
    var iocGk = null;
    for (var ni4 = 0; ni4 < nodes3.length; ni4++) {
      var n4 = nodes3[ni4];
      if (n4.internalOnly === true ||
          (n4.type === 'CANVAS' && n4.name && n4.name.indexOf('Internal Only') !== -1)) {
        iocGk = n4.guid.sessionID + ':' + n4.guid.localID;
        break;
      }
    }

    if (iocGk) {
      (function scanUnderIoc(pgk) {
        var kids = localChildrenOf[pgk] || [];
        for (var ki = 0; ki < kids.length; ki++) {
          var kidGk = kids[ki];
          // 优先使用局部节点表，避免跨文件同 GUID 碰撞（如多文件共享 20004330:* IOC 副本 GUID）
          var kidNode = localGuidToNode[kidGk] || globalGuidToNode[kidGk];
          if (!kidNode) continue;
          if (kidNode.componentKey) recordNormalVariant(kidNode, localChildrenOf, localGuidToNode);
          scanUnderIoc(kidGk);
        }
      })(iocGk);
    }

    // 补充扫描：主画布 SYMBOL 直接含 componentKey + variantPropSpecs（库文件场景）
    for (var ni5 = 0; ni5 < nodes3.length; ni5++) {
      var n5 = nodes3[ni5];
      if (n5.type === 'SYMBOL' && n5.componentKey && n5.variantPropSpecs) {
        recordNormalVariant(n5, localChildrenOf, localGuidToNode);
      }
    }
  }

  // ── 2-5. 验证 textOverrideKey ────────────────────────────────────────────
  for (var ck in componentKeyIndex) {
    var ev = componentKeyIndex[ck];
    if (!ev.textOverrideKey) continue;
    var tokGk = ev.textOverrideKey.sessionID + ':' + ev.textOverrideKey.localID;
    var tokNode = globalGuidToNode[tokGk];
    if (tokNode && tokNode.type !== 'TEXT') delete ev.textOverrideKey;
  }

  // ── 2-6. 确定需收录的 canonical SYMBOL GUID 集合 ─────────────────────────
  var usedSymbolGuids = Object.create(null);
  for (var ck2 in componentKeyIndex) {
    var e2 = componentKeyIndex[ck2];
    usedSymbolGuids[e2.sessionID + ':' + e2.localID] = true;
  }

  var canonicalToIocCopy = Object.create(null);
  var allGks2 = Object.keys(globalGuidToNode);
  for (var bi = 0; bi < allGks2.length; bi++) {
    var bNode = globalGuidToNode[allGks2[bi]];
    if (!bNode.publishID || !bNode.guid) continue;
    var bPubGk = bNode.publishID.sessionID + ':' + bNode.publishID.localID;
    var bOwnGk = bNode.guid.sessionID + ':' + bNode.guid.localID;
    if (bPubGk !== bOwnGk) canonicalToIocCopy[bPubGk] = bNode;
  }

  // ── 2-7. 深度收集 SYMBOL 子树 ────────────────────────────────────────────
  var collectedGuids = Object.create(null);
  var componentNodes = [];

  var syntheticIocGuidKey = SYNTHETIC_IOC_GUID.sessionID + ':' + SYNTHETIC_IOC_GUID.localID;
  collectedGuids[syntheticIocGuidKey] = true;

  // 从 componentKeyIndex 的 csFrameGuid 字段构建「规范 GUID → CS FRAME GUID」映射。
  // csFrameGuid 由 recordNormalVariant 用局部节点表（per-template）记录，
  // 不受 globalGuidToNode 跨模板 GUID 碰撞的影响，是最可靠的 CS FRAME 来源。
  var canonicalGuidToCSFrame = Object.create(null);
  for (var ck4 in componentKeyIndex) {
    var e4 = componentKeyIndex[ck4];
    if (e4.csFrameGuid) {
      canonicalGuidToCSFrame[e4.sessionID + ':' + e4.localID] = e4.csFrameGuid;
    }
  }

  // usedParentGuids：记录所有需要作为 SYMBOL 父节点写入 componentNodes 的 CS FRAME GUID。
  //
  // 填充策略与父节点解析（下方 SYMBOL loop）保持对齐，同样采用双路：
  //   路径1（首选）：从 componentKeyIndex.csFrameGuid 填充。
  //     csFrameGuid 由 recordNormalVariant 用 per-template 局部节点表写入，
  //     不受多模板 globalGuidToNode 跨文件 GUID 碰撞影响，是最可靠的来源。
  //   路径2（安全兜底）：从 globalGuidToNode / canonicalToIocCopy 补充。
  //     可能因碰撞返回不准确的结果，但在路径1 覆盖所有场景的前提下，
  //     路径2 实际上不会贡献新的 GUID；保留它仅为应对未来未知的边界场景。
  //     【注意】若未来要移除路径2，同样需确认 csFrameGuid 对所有新模板均已正确写入。
  var usedParentGuids = Object.create(null);
  // 路径1：csFrameGuid（首选，最可靠）
  for (var ck5 in componentKeyIndex) {
    var e5 = componentKeyIndex[ck5];
    if (e5.csFrameGuid) {
      usedParentGuids[e5.csFrameGuid.sessionID + ':' + e5.csFrameGuid.localID] = true;
    }
  }
  // 路径2：globalGuidToNode / canonicalToIocCopy（安全兜底，当前不应贡献新 GUID）
  for (var sgk in usedSymbolGuids) {
    var sNode = globalGuidToNode[sgk];
    if (sNode && sNode.parentIndex && sNode.parentIndex.guid) {
      var spGk = sNode.parentIndex.guid.sessionID + ':' + sNode.parentIndex.guid.localID;
      var spNode = globalGuidToNode[spGk];
      if (spNode && spNode.type === 'FRAME') usedParentGuids[spGk] = true;
    }
    var copyNode = canonicalToIocCopy[sgk];
    if (copyNode && copyNode.parentIndex && copyNode.parentIndex.guid) {
      var cpGk = copyNode.parentIndex.guid.sessionID + ':' + copyNode.parentIndex.guid.localID;
      var cpNode = globalGuidToNode[cpGk];
      if (cpNode && cpNode.type === 'FRAME') usedParentGuids[cpGk] = true;
    }
  }

  for (var fgk in usedParentGuids) {
    var fNode = globalGuidToNode[fgk];
    if (fNode && !collectedGuids[fgk]) {
      collectedGuids[fgk] = true;
      var cleanedF = cleanNode(fNode);
      cleanedF.parentIndex = {
        guid: { sessionID: SYNTHETIC_IOC_GUID.sessionID, localID: SYNTHETIC_IOC_GUID.localID },
        position: (cleanedF.parentIndex && cleanedF.parentIndex.position) || '!',
      };
      componentNodes.push(cleanedF);
    }
  }

  for (var sgk2 in usedSymbolGuids) {
    var symNode = globalGuidToNode[sgk2];
    var copyNode2 = canonicalToIocCopy[sgk2];

    if (!symNode && copyNode2) {
      symNode = JSON.parse(JSON.stringify(copyNode2));
      var parts = sgk2.split(':');
      symNode.guid = { sessionID: parseInt(parts[0]), localID: parseInt(parts[1]) };
    }
    if (!symNode) continue;

    if (!collectedGuids[sgk2]) {
      collectedGuids[sgk2] = true;
      var cleanedSym = cleanNode(symNode);
      var symParentGk = cleanedSym.parentIndex && cleanedSym.parentIndex.guid &&
        (cleanedSym.parentIndex.guid.sessionID + ':' + cleanedSym.parentIndex.guid.localID);
      if (!usedParentGuids[symParentGk]) {
        // 规范 SYMBOL 的 parentIndex 在原始模板中可能指向主画布页面（如 0:1）而非 ComponentSet FRAME，
        // 需要找到正确的 CS FRAME 重新挂载。按优先级依次尝试：
        //
        // 路径1（首选）：canonicalGuidToCSFrame
        //   来源：recordNormalVariant 在 per-template 局部节点表（localGuidToNode）中记录的 csFrameGuid。
        //   可靠性：最高——局部表仅包含当前模板的节点，完全不受多模板加载时
        //   globalGuidToNode「先到先得」规则导致的跨模板 GUID 碰撞影响。
        //   覆盖范围：所有在 IOC Canvas 下有副本且副本直接父节点为 CS FRAME 的 SYMBOL，
        //   即所有正常变体 SYMBOL，已验证覆盖 Button/DatePicker/Checkbox/Input/Select 等全部模板。
        //
        // 路径2（安全兜底）：copyNode2.parentIndex
        //   来源：canonicalToIocCopy，由 globalGuidToNode 构建（可能因碰撞被污染）。
        //   可靠性：较低——多模板加载时若 IOC 副本 GUID 与其他模板的节点碰撞，
        //   canonicalToIocCopy 可能失效（返回 undefined）或指向错误节点。
        //   当前实践中，路径1 已覆盖路径2 的全部场景，路径2 永远不会被触发；
        //   保留它仅作为额外的安全保障，以应对未来新增模板中可能出现的未知场景。
        //   【注意】若未来要移除路径2，需先确认 csFrameGuid 对所有新增模板均已正确写入。
        //
        // 兜底：挂到 IOC Canvas 根节点（SYMBOL 无 CS FRAME，如 Icon 类直接变体）
        var _resolvedParentGuid = null;
        var _csFromCK = canonicalGuidToCSFrame[sgk2];
        if (_csFromCK && usedParentGuids[_csFromCK.sessionID + ':' + _csFromCK.localID]) {
          _resolvedParentGuid = _csFromCK;
        } else {
          // 路径2：当前不应被触发（路径1 已全覆盖），保留为安全兜底
          var _copyParentGk = copyNode2 && copyNode2.parentIndex && copyNode2.parentIndex.guid
            ? (copyNode2.parentIndex.guid.sessionID + ':' + copyNode2.parentIndex.guid.localID)
            : null;
          if (_copyParentGk && usedParentGuids[_copyParentGk]) {
            _resolvedParentGuid = copyNode2.parentIndex.guid;
          }
        }
        cleanedSym.parentIndex = {
          guid: _resolvedParentGuid || { sessionID: SYNTHETIC_IOC_GUID.sessionID, localID: SYNTHETIC_IOC_GUID.localID },
          position: (cleanedSym.parentIndex && cleanedSym.parentIndex.position) || '"',
        };
      }
      componentNodes.push(cleanedSym);
    }

    var subtreeRootGk = copyNode2
      ? (copyNode2.guid.sessionID + ':' + copyNode2.guid.localID)
      : sgk2;
    var beforeCount = componentNodes.length;
    collectSubtree(subtreeRootGk, childrenOf, globalGuidToNode, collectedGuids, componentNodes);

    // ★ 关键修复：子树的直接子节点 parentIndex.guid 指向 IOC Canvas 副本 GUID，
    //   但 SYMBOL 本身在 iocNodes 里是 canonical GUID。
    //   ir-to-figma.js 通过 parentIndex.guid 建 _iocChildrenOf，
    //   若副本 GUID ≠ canonical GUID，子节点找不到父节点，SYMBOL 在剪贴板里没有子节点 → 空壳。
    //   将直接子节点的 parentIndex.guid 改成 canonical GUID 即可解决。
    if (copyNode2) {
      var copyGkFix = copyNode2.guid.sessionID + ':' + copyNode2.guid.localID;
      var canonParts = sgk2.split(':');
      var canonGuid = { sessionID: parseInt(canonParts[0]), localID: parseInt(canonParts[1]) };
      for (var fixI = beforeCount; fixI < componentNodes.length; fixI++) {
        var fixN = componentNodes[fixI];
        if (!fixN || !fixN.parentIndex || !fixN.parentIndex.guid) continue;
        var fixPGk = fixN.parentIndex.guid.sessionID + ':' + fixN.parentIndex.guid.localID;
        if (fixPGk === copyGkFix) {
          fixN.parentIndex = { guid: canonGuid, position: fixN.parentIndex.position };
        }
      }
    }
  }

  // ── 2-8. captureIconSymbols：收录 INSTANCE 引用的图标 SYMBOL ────────────
  // 与步骤 2-7 相同策略：
  //   · canonical SYMBOL（主画布）作为 iocNodes 里的 SYMBOL 节点（publishID/componentKey 完整）
  //   · 子节点从 IOC Canvas 副本收集（副本才有实际 shape 子节点；主画布图标 SYMBOL 通常是空壳）
  //   · 直接子节点的 parentIndex.guid 从副本 GUID 重写为 canonical GUID（同 2-7 的修复）
  var prevSize = -1;
  while (true) {
    var curSize = componentNodes.length;
    if (curSize === prevSize) break;
    prevSize = curSize;
    var snapshot = componentNodes.slice();
    for (var ii2 = 0; ii2 < snapshot.length; ii2++) {
      var inst = snapshot[ii2];
      if (inst.type !== 'INSTANCE') continue;
      if (!inst.symbolData || !inst.symbolData.symbolID) continue;
      var sid = inst.symbolData.symbolID;
      var sidGk = sid.sessionID + ':' + sid.localID;
      if (collectedGuids[sidGk]) continue;

      var iconSym = globalGuidToNode[sidGk];
      var iconCopy = canonicalToIocCopy[sidGk]; // IOC Canvas 副本（有实际 shape 子节点）

      if (!iconSym && !iconCopy) continue;

      // 若主画布无该 SYMBOL（纯 IOC 定义），从副本合成 canonical 节点
      if (!iconSym && iconCopy) {
        iconSym = JSON.parse(JSON.stringify(iconCopy));
        var iconParts = sidGk.split(':');
        iconSym.guid = { sessionID: parseInt(iconParts[0]), localID: parseInt(iconParts[1]) };
      }

      collectedGuids[sidGk] = true;
      var cleanedIcon = cleanNode(iconSym);

      // 若父节点不在已收录集合，重挂到合成 IOC Canvas
      var iconParentGk = cleanedIcon.parentIndex && cleanedIcon.parentIndex.guid &&
        (cleanedIcon.parentIndex.guid.sessionID + ':' + cleanedIcon.parentIndex.guid.localID);
      if (!iconParentGk || !collectedGuids[iconParentGk]) {
        cleanedIcon.parentIndex = {
          guid: { sessionID: SYNTHETIC_IOC_GUID.sessionID, localID: SYNTHETIC_IOC_GUID.localID },
          position: (cleanedIcon.parentIndex && cleanedIcon.parentIndex.position) || '"',
        };
      }
      componentNodes.push(cleanedIcon);

      // 优先从 IOC Canvas 副本收集子节点（副本包含实际 shape，主画布 SYMBOL 通常为空壳）
      var iconSubtreeRoot = iconCopy
        ? (iconCopy.guid.sessionID + ':' + iconCopy.guid.localID)
        : sidGk;
      var beforeIconCount = componentNodes.length;
      collectSubtree(iconSubtreeRoot, childrenOf, globalGuidToNode, collectedGuids, componentNodes);

      // ★ 与 2-7 相同的 parentIndex 修复：
      //   子节点的 parentIndex.guid 指向 IOC Canvas 副本 GUID，
      //   但 SYMBOL 本身用的是 canonical GUID，需要重写才能让 ir-to-figma 正确建立父子关系。
      if (iconCopy) {
        var iconCopyGk = iconCopy.guid.sessionID + ':' + iconCopy.guid.localID;
        var iconCanonParts = sidGk.split(':');
        var iconCanonGuid = { sessionID: parseInt(iconCanonParts[0]), localID: parseInt(iconCanonParts[1]) };
        for (var fixJ = beforeIconCount; fixJ < componentNodes.length; fixJ++) {
          var fixM = componentNodes[fixJ];
          if (!fixM || !fixM.parentIndex || !fixM.parentIndex.guid) continue;
          var fixMPGk = fixM.parentIndex.guid.sessionID + ':' + fixM.parentIndex.guid.localID;
          if (fixMPGk === iconCopyGk) {
            fixM.parentIndex = { guid: iconCanonGuid, position: fixM.parentIndex.position };
          }
        }
      }
    }
  }

  // ── 2-8b. collectColorStyleNodes：收录 IOC Canvas 下的颜色样式节点 ──────────
  // Template 中 IOC Canvas 直接子节点里带有 styleType（FILL/STROKE/TEXT）的 ROUNDED_RECTANGLE
  // 是 Figma 颜色样式的"样式锚点"——INSTANCE.symbolData.symbolOverrides 通过
  // styleIdForFill.assetRef.key 引用它们来覆写图标/文字颜色。
  // 若不将它们纳入 componentNodes → iocNodes，生成的剪贴板里就没有样式节点，
  // Figma 无法解析 styleIdForFill → 颜色退化为 SYMBOL 默认（通常是灰色）。
  (function collectColorStyleNodes() {
    for (var _csfi = 0; _csfi < fileResults.length; _csfi++) {
      var _csfr = fileResults[_csfi];
      var _csNodes = _csfr.nodeChanges;
      // 找本文件的 IOC Canvas GUID
      var _csIocGk = null;
      for (var _csni = 0; _csni < _csNodes.length; _csni++) {
        var _csn = _csNodes[_csni];
        if (_csn.internalOnly === true ||
            (_csn.type === 'CANVAS' && _csn.name && _csn.name.indexOf('Internal Only') !== -1)) {
          _csIocGk = _csn.guid.sessionID + ':' + _csn.guid.localID;
          break;
        }
      }
      if (!_csIocGk) continue;
      for (var _csni2 = 0; _csni2 < _csNodes.length; _csni2++) {
        var _csn2 = _csNodes[_csni2];
        if (!_csn2.styleType) continue;                          // 只收 color style 节点
        if (!_csn2.parentIndex || !_csn2.parentIndex.guid) continue;
        var _csPGk = _csn2.parentIndex.guid.sessionID + ':' + _csn2.parentIndex.guid.localID;
        if (_csPGk !== _csIocGk) continue;                       // 只收 IOC Canvas 直接子节点
        var _csGk = _csn2.guid.sessionID + ':' + _csn2.guid.localID;
        if (collectedGuids[_csGk]) continue;                     // 去重
        collectedGuids[_csGk] = true;
        var _cleanedStyle = cleanNode(_csn2);
        // 重挂到合成 IOC Canvas（统一父节点）
        _cleanedStyle.parentIndex = {
          guid: { sessionID: SYNTHETIC_IOC_GUID.sessionID, localID: SYNTHETIC_IOC_GUID.localID },
          position: (_cleanedStyle.parentIndex && _cleanedStyle.parentIndex.position) || '"',
        };
        componentNodes.push(_cleanedStyle);
      }
    }
  })();

  // ── 2-9. relinkHollowSymbolReferences（关键修复：Checkbox 图标空框 bug）──
  (function relinkHollowSymbols() {
    var byGuid = Object.create(null);
    var localChildOf = Object.create(null);
    componentNodes.forEach(function(n) {
      if (!n.guid) return;
      var gk = n.guid.sessionID + ':' + n.guid.localID;
      byGuid[gk] = n;
    });
    componentNodes.forEach(function(n) {
      if (!n.guid || !n.parentIndex || !n.parentIndex.guid) return;
      var gk  = n.guid.sessionID + ':' + n.guid.localID;
      var pgk = n.parentIndex.guid.sessionID + ':' + n.parentIndex.guid.localID;
      if (!localChildOf[pgk]) localChildOf[pgk] = [];
      localChildOf[pgk].push(gk);
    });

    function isRenderable(t) {
      return t === 'TEXT' || t === 'ROUNDED_RECTANGLE' || t === 'VECTOR' || t === 'ELLIPSE' ||
             t === 'STAR' || t === 'POLYGON' || t === 'BOOLEAN_OPERATION' || t === 'LINE' ||
             t === 'FRAME' || t === 'INSTANCE';
    }
    function hasRenderableChild(gk, childMap, nodeMap) {
      var stack = (childMap[gk] || []).slice();
      var seen  = Object.create(null);
      while (stack.length) {
        var ck = stack.pop();
        if (!ck || seen[ck]) continue;
        seen[ck] = true;
        var n = nodeMap[ck];
        if (!n) continue;
        if (isRenderable(n.type)) return true;
        var kids = childMap[ck] || [];
        for (var i = 0; i < kids.length; i++) stack.push(kids[i]);
      }
      return false;
    }

    // ★ 核心：从全局节点全集建立 nonHollowByName，扩大搜索范围
    var nonHollowByName = Object.create(null);
    var globalKeys = Object.keys(globalGuidToNode);
    for (var gi = 0; gi < globalKeys.length; gi++) {
      var gn = globalGuidToNode[globalKeys[gi]];
      if (!gn || gn.type !== 'SYMBOL') continue;
      if (!hasRenderableChild(globalKeys[gi], childrenOf, globalGuidToNode)) continue;
      var nm = gn.name || '';
      if (!nm) continue;
      if (!nonHollowByName[nm]) nonHollowByName[nm] = [];
      nonHollowByName[nm].push(gn.guid);
    }

    var fixed = 0, unresolved = 0;
    componentNodes.forEach(function(n) {
      if (n.type !== 'INSTANCE' || !n.symbolData || !n.symbolData.symbolID) return;
      var sid2 = n.symbolData.symbolID;
      var sgk3 = sid2.sessionID + ':' + sid2.localID;
      var sym  = byGuid[sgk3] || globalGuidToNode[sgk3];
      if (!sym || sym.type !== 'SYMBOL') return;
      if (hasRenderableChild(sgk3, localChildOf, byGuid) ||
          hasRenderableChild(sgk3, childrenOf, globalGuidToNode)) return;

      var replacement = null;
      if (sym.publishID) {
        var pgk3 = sym.publishID.sessionID + ':' + sym.publishID.localID;
        var orig  = globalGuidToNode[pgk3];
        if (orig && orig.type === 'SYMBOL' &&
            hasRenderableChild(pgk3, childrenOf, globalGuidToNode)) {
          replacement = orig.guid;
        }
      }
      if (!replacement) {
        var cands = nonHollowByName[sym.name || ''] || [];
        if (cands.length) replacement = cands[0];
      }

      if (replacement) {
        n.symbolData = Object.assign({}, n.symbolData, {
          symbolID: { sessionID: replacement.sessionID, localID: replacement.localID },
        });
        var replGk = replacement.sessionID + ':' + replacement.localID;
        if (!collectedGuids[replGk]) {
          var replNode = globalGuidToNode[replGk];
          if (replNode) {
            collectedGuids[replGk] = true;
            componentNodes.push(cleanNode(replNode));
            collectSubtree(replGk, childrenOf, globalGuidToNode, collectedGuids, componentNodes);
          }
        }
        fixed++;
      } else {
        unresolved++;
      }
    });

    if (fixed || unresolved) {
      console.log('[html-templates-loader] 空壳 symbolID 重定向：修复', fixed, '个，未命中', unresolved, '个');
    }
  })();

  // ── 2-10. 合并 blobs ─────────────────────────────────────────────────────
  var mergedBlobs = [];
  for (var fi4 = 0; fi4 < fileResults.length; fi4++) {
    var rawBlobs = fileResults[fi4].rawBlobs;
    for (var bi2 = 0; bi2 < rawBlobs.length; bi2++) {
      var b64 = blobToBase64(rawBlobs[bi2]);
      if (b64) mergedBlobs.push(b64);
    }
  }

  // ── 2-11. 按所属文件 blobOffset 对节点做 blob 引用 remap ────────────────
  var gkToFileOffset = Object.create(null);
  for (var fi5 = 0; fi5 < fileResults.length; fi5++) {
    var fr5    = fileResults[fi5];
    var offset = fr5._blobOffset;
    var nodes5 = fr5.nodeChanges;
    for (var ni6 = 0; ni6 < nodes5.length; ni6++) {
      var nd6 = nodes5[ni6];
      if (!nd6.guid) continue;
      var gk6 = nd6.guid.sessionID + ':' + nd6.guid.localID;
      if (gkToFileOffset[gk6] === undefined) gkToFileOffset[gk6] = offset;
    }
  }

  for (var ci2 = 0; ci2 < componentNodes.length; ci2++) {
    var cn = componentNodes[ci2];
    if (!cn.guid) continue;
    var cnGk  = cn.guid.sessionID + ':' + cn.guid.localID;
    var cnOff = gkToFileOffset[cnGk];
    if (cnOff && cnOff > 0) componentNodes[ci2] = remapBlobRefs(cn, cnOff);
  }

  // ── 2-12. 回写 componentKey 和 symbolDescription 到 SYMBOL 节点 ──────────
  // canonical GUID 节点可能来自主画布（无 componentKey），IOC Canvas 副本节点才有。
  // component-library-resolver 的降级路径需要 iocNodes 中 SYMBOL 同时具备两者。
  var guidToComponentKey = Object.create(null);
  for (var ck3 in componentKeyIndex) {
    var e3 = componentKeyIndex[ck3];
    guidToComponentKey[e3.sessionID + ':' + e3.localID] = ck3;
  }
  for (var ci3 = 0; ci3 < componentNodes.length; ci3++) {
    var cn3 = componentNodes[ci3];
    if (!cn3 || cn3.type !== 'SYMBOL' || !cn3.guid) continue;
    var cn3Gk = cn3.guid.sessionID + ':' + cn3.guid.localID;
    // 回写 componentKey（从 componentKeyIndex 反查）
    if (!cn3.componentKey && guidToComponentKey[cn3Gk]) {
      cn3.componentKey = guidToComponentKey[cn3Gk];
    }
    // 回写 symbolDescription（从 IOC Canvas 副本节点补充）
    if (!cn3.symbolDescription) {
      var iocCopyForDesc = canonicalToIocCopy[cn3Gk];
      if (iocCopyForDesc && iocCopyForDesc.symbolDescription) {
        cn3.symbolDescription = iocCopyForDesc.symbolDescription;
      }
    }
  }

  // 合成 IOC Canvas 节点
  var iocCanvasNode = {
    guid:              { sessionID: SYNTHETIC_IOC_GUID.sessionID, localID: SYNTHETIC_IOC_GUID.localID },
    phase:             'CREATED',
    parentIndex:       { guid: { sessionID: 0, localID: 0 }, position: '"' },
    type:              'CANVAS',
    name:              'Internal Only Canvas',
    visible:           false,
    opacity:           1,
    transform:         { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
    backgroundOpacity: 1,
    backgroundEnabled: true,
    internalOnly:      true,
  };

  var iocNodes = [iocCanvasNode].concat(componentNodes);

  return {
    fileKey:           fileKey,
    iocNodes:          iocNodes,
    componentKeyIndex: componentKeyIndex,
    componentLibrary:  [],
    blobs:             mergedBlobs,
  };
}

// ─── 公开接口 ─────────────────────────────────────────────────────────────────

/**
 * @param {Array<{ fileName: string, htmlContent: string }>} sources
 * @param {{ kiwiSchema: object, inflateDeps: { inflateRaw, inflate, ungzip, zstdDecompress? } }} deps
 * @returns {{ fileKey, iocNodes, componentKeyIndex, componentLibrary, blobs } | null}
 */
module.exports = function buildTemplate(sources, deps) {
  if (!deps || !deps.kiwiSchema || !deps.inflateDeps) {
    throw new Error('[html-templates-loader] deps.kiwiSchema / deps.inflateDeps 不能为空');
  }
  if (!Array.isArray(sources) || !sources.length) {
    console.warn('[html-templates-loader] sources 为空');
    return null;
  }

  var fileResults = [];
  for (var i = 0; i < sources.length; i++) {
    try {
      fileResults.push(decodeOneSource(sources[i], deps));
    } catch (e) {
      console.warn('[html-templates-loader] 跳过解码失败的模板', sources[i].fileName, ':', e.message);
    }
  }

  if (!fileResults.length) return null;

  var tpl = mergeFileResults(fileResults);

  console.log(
    '[html-templates-loader] 加载完成：' + sources.length + ' 个模板，' +
    Object.keys(tpl.componentKeyIndex).length + ' 个变体，' +
    tpl.iocNodes.length + ' 个节点，' +
    tpl.blobs.length + ' 个 blobs'
  );

  return tpl;
};
