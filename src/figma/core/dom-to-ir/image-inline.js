/**
 * ============================================================
 * image-inline.js  —  异步图片内联层
 * ============================================================
 * 职责：
 *   - fetchImageAsBase64DataUrl：fetch 远程图片并转为 base64 data URL
 *   - inlineImageFillsInTree：递归遍历 JSON 节点树，将所有图片 URL 内联为 base64
 * 规则：此层为异步（返回 Promise），不参与主流程 walk，仅在用户选择「带图片导出」时调用。
 * ============================================================
 */

function fetchImageBlob(url) {
  return fetch(url, { mode: 'cors' })
    .then(function (res) { return res.ok ? res.blob() : Promise.reject(new Error(res.statusText)); });
}

function estimateBytesFromDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  var comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  var b64 = dataUrl.slice(comma + 1);
  return Math.max(0, Math.floor((b64.length * 3) / 4));
}

function blobToDataUrl(blob, sourceUrl) {
  var mimeType = blob.type || '';
  if (mimeType.indexOf('svg') >= 0 || (sourceUrl && sourceUrl.toLowerCase().endsWith('.svg'))) {
    // SVG 转 PNG：通过 Image + Canvas 光栅化
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onloadend = function () {
        var svgDataUrl = reader.result;
        var img = new window.Image();
        img.onload = function () {
          var canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 400;
          canvas.height = img.naturalHeight || 400;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          try {
            resolve(canvas.toDataURL('image/png'));
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = reject;
        img.src = svgDataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  // 非 SVG 直接转 base64 data URL
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onloadend = function () { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 从 data URL 的 base64 body 计算 SHA-1 hash，返回 40 位小写十六进制字符串。
 * 仅在支持 crypto.subtle 的环境（现代浏览器）下运行，否则返回 null。
 */
function computeDataUrlSha1Hex(dataUrl) {
  if (typeof crypto === 'undefined' || !crypto.subtle || !crypto.subtle.digest) return Promise.resolve(null);
  var comma = dataUrl ? dataUrl.indexOf(',') : -1;
  if (comma < 0) return Promise.resolve(null);
  try {
    var b64 = dataUrl.slice(comma + 1);
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return crypto.subtle.digest('SHA-1', bytes).then(function (hashBuf) {
      return Array.from(new Uint8Array(hashBuf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  } catch (e) {
    return Promise.resolve(null);
  }
}

/** 将 URL 转为 base64 data URL，供 Figma 插件直接解码使用。SVG 会先绘制到 Canvas 再转 PNG。失败时保留 url。 */
function fetchImageAsBase64DataUrl(url) {
  var startAt = Date.now();
  console.log('[image inline] 开始拉取', url);
  return fetchImageBlob(url)
    .then(function (blob) {
      return blobToDataUrl(blob, url).then(function (dataUrl) {
        console.log('[image inline] 拉取成功', {
          url: url,
          mime: blob && blob.type,
          blobBytes: blob && blob.size,
          base64Bytes: estimateBytesFromDataUrl(dataUrl),
          ms: Date.now() - startAt,
        });
        return dataUrl;
      });
    })
    .catch(function (err) {
      console.warn('[image inline] 拉取失败', {
        url: url,
        ms: Date.now() - startAt,
        message: err && err.message,
      });
      throw err;
    });
}

/**
 * 将 CSS linear-gradient/radial-gradient 字符串渲染为指定平铺尺寸的 PNG base64 data URL。
 * 使用 SVG foreignObject 将 CSS 背景交给浏览器渲染引擎处理，避免手动解析渐变角度。
 * 纯 CSS 内容（无外部 URL 引用）不会污染 Canvas，可安全调用 toDataURL。
 */
function renderTiledGradientToDataUrl(bgImage, tileW, tileH) {
  return new Promise(function (resolve, reject) {
    // 转义 HTML 属性中的特殊字符（gradient 字符串里偶尔含双引号）
    var escapedBgImage = bgImage.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    var svgStr = '<svg xmlns="http://www.w3.org/2000/svg"'
      + ' width="' + tileW + '" height="' + tileH + '">'
      + '<foreignObject width="' + tileW + '" height="' + tileH + '">'
      + '<div xmlns="http://www.w3.org/1999/xhtml"'
      + ' style="width:' + tileW + 'px;height:' + tileH + 'px;'
      + 'background-image:' + escapedBgImage + ';'
      + 'background-size:' + tileW + 'px ' + tileH + 'px;'
      + 'background-repeat:no-repeat;">'
      + '</div>'
      + '</foreignObject>'
      + '</svg>';
    var svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    var img = new window.Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = tileW;
      canvas.height = tileH;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = function () {
      reject(new Error('[tiled-gradient] SVG foreignObject render failed for: ' + bgImage.slice(0, 80)));
    };
    img.src = svgDataUrl;
  });
}

/** 递归将树中 style.fills 里 type===IMAGE 且仅有 url 的项，请求图片并写入 content（base64 data URL）。 */
function inlineImageFillsInTree(obj, options) {
  if (!obj) return Promise.resolve();
  var ctxOptions = options || {};
  if (!ctxOptions.__imageInlineStats) {
    ctxOptions.__imageInlineStats = { attempts: 0, success: 0, failed: 0 };
  }
  if (ctxOptions.__imageInlineDepth == null) ctxOptions.__imageInlineDepth = 0;
  var isRoot = ctxOptions.__imageInlineDepth === 0;
  ctxOptions.__imageInlineDepth += 1;
  var stats = ctxOptions.__imageInlineStats;
  var promises = [];

  // 处理 style.fills 里的 IMAGE fill 和 TILED_GRADIENT fill
  var style = obj.style;
  if (style && style.fills && Array.isArray(style.fills)) {
    style.fills.forEach(function (fill, i) {
      if (fill && fill.type === 'IMAGE' && fill.url && !fill.content) {
        console.log('[DBG image-inline] 发现 IMAGE fill，准备拉取', { nodeName: obj.name, nodeType: obj.type, url: fill.url });
        stats.attempts += 1;
        promises.push(
          fetchImageAsBase64DataUrl(fill.url).then(function (dataUrl) {
            return computeDataUrlSha1Hex(dataUrl).then(function (sha1hex) {
              // 保留原 fill 上的所有字段（如 scaleMode、scalingFactor），仅替换 content，清除 url
              style.fills[i] = Object.assign({}, fill, { content: dataUrl, imageHashHex: sha1hex || undefined, url: undefined });
              stats.success += 1;
              console.log('[DBG image-inline] IMAGE fill 内联写入 content 成功', { nodeName: obj.name, contentPrefix: dataUrl ? dataUrl.slice(0, 40) : 'null', contentLen: dataUrl ? dataUrl.length : 0, sha1hex: sha1hex ? sha1hex.slice(0, 16) + '...' : 'N/A' });
            });
          }).catch(function (err) {
            stats.failed += 1;
            console.warn('[image fill] 内联失败（可能是跨域/CORS）', fill.url, err && err.message);
          })
        );
      } else if (fill && fill.type === 'IMAGE' && fill.content) {
        console.log('[DBG image-inline] IMAGE fill 已有 content，跳过拉取', { nodeName: obj.name, contentPrefix: fill.content.slice(0, 40) });
      } else if (fill && fill.type === 'IMAGE') {
        console.warn('[DBG image-inline] IMAGE fill 无 url 也无 content，将被忽略', { nodeName: obj.name, fill: fill });
      } else if (fill && fill.type === 'TILED_GRADIENT' && fill.bgImage) {
        // 平铺渐变：用 Canvas+SVG foreignObject 渲染平铺单元格，以 IMAGE TILE 写入 Figma
        stats.attempts += 1;
        var _tileW = fill.bgSizeW || 100;
        var _tileH = fill.bgSizeH || 100;
        promises.push(
          renderTiledGradientToDataUrl(fill.bgImage, _tileW, _tileH).then(function (dataUrl) {
            style.fills[i] = { type: 'IMAGE', content: dataUrl, scaleMode: 'TILE' };
            stats.success += 1;
            console.log('[tiled-gradient] 渲染成功', { tileW: _tileW, tileH: _tileH });
          }).catch(function (err) {
            // 降级：移除该 fill，避免 TILED_GRADIENT 泄漏到消费端
            style.fills[i] = null;
            stats.failed += 1;
            console.warn('[tiled-gradient] 渲染失败，已降级移除该 fill', err && err.message);
          })
        );
      }
    });
    // 清理降级后的 null 项（TILED_GRADIENT 渲染失败时置 null）
    // 放在 Promise.all 之后统一清理，见下方 then 链
  }

  // 处理 type==='image' 节点的 content 字段（img 标签 src），将 URL 内联为 base64
  if (obj.type === 'image' && obj.content && typeof obj.content === 'string' && !obj.content.startsWith('data:')) {
    console.log('[DBG image-inline] 发现 image 节点，准备拉取 src', { nodeName: obj.name, url: obj.content });
    stats.attempts += 1;
    promises.push(
      fetchImageAsBase64DataUrl(obj.content).then(function (dataUrl) {
        return computeDataUrlSha1Hex(dataUrl).then(function (sha1hex) {
          obj.content = dataUrl;
          if (sha1hex) obj.imageHashHex = sha1hex;
          stats.success += 1;
          console.log('[DBG image-inline] image 节点 src 内联成功', { nodeName: obj.name, contentPrefix: dataUrl ? dataUrl.slice(0, 40) : 'null', contentLen: dataUrl ? dataUrl.length : 0, sha1hex: sha1hex ? sha1hex.slice(0, 16) + '...' : 'N/A' });
        });
      }).catch(function (err) {
        stats.failed += 1;
        console.warn('[image node] 内联失败（可能是跨域/CORS）', obj.content, err && err.message);
      })
    );
  } else if (obj.type === 'image') {
    console.log('[DBG image-inline] image 节点状态检查', { nodeName: obj.name, hasContent: !!obj.content, isDataUrl: obj.content && obj.content.startsWith('data:'), contentPrefix: obj.content ? String(obj.content).slice(0, 60) : 'null' });
  }

  return Promise.all(promises).then(function () {
    // 清理 TILED_GRADIENT 渲染失败后置 null 的 fill 项
    if (style && style.fills && Array.isArray(style.fills)) {
      style.fills = style.fills.filter(function (f) { return f != null; });
    }
    var children = obj.children;
    if (children && children.length) {
      return Promise.all(children.map(function (child) { return inlineImageFillsInTree(child, ctxOptions); }));
    }
  }).then(function () {
    ctxOptions.__imageInlineDepth -= 1;
    if (isRoot) {
      console.log('[image inline] 导出内联完成', {
        attempts: stats.attempts,
        success: stats.success,
        failed: stats.failed,
      });
    }
  });
}


if (typeof module !== 'undefined') {
  module.exports = {
    fetchImageAsBase64DataUrl: fetchImageAsBase64DataUrl,
    inlineImageFillsInTree: inlineImageFillsInTree,
  };
}
