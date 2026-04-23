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

var parseLinearGradientFromBgImage = (function () {
  try {
    if (typeof require !== 'undefined') {
      return require('./css-parsers').parseLinearGradientFromBgImage;
    }
  } catch (e) {}
  return function () {
    return null;
  };
})();

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
 * 将可解析的 linear-gradient 用 Canvas 2D 绘成平铺单元 PNG（与 CSS 角度约定一致：0°=上、顺时针）。
 * 优先于 SVG foreignObject：部分 WebView/Electron 中 foreignObject 栅格化失败会导致斜条纹等平铺渐变丢失。
 */
function tryRenderTiledLinearGradientCanvas(bgImage, tileW, tileH, options) {
  if (typeof document === 'undefined') return null;
  var parseFn =
    options && typeof options.parseLinearGradientFromBgImage === 'function'
      ? options.parseLinearGradientFromBgImage
      : parseLinearGradientFromBgImage;
  var parsed;
  try {
    parsed = parseFn(bgImage);
  } catch (e) {
    return null;
  }
  if (!parsed || parsed.type !== 'GRADIENT_LINEAR' || !parsed.gradientStops || parsed.gradientStops.length < 2) {
    return null;
  }
  var W = Math.max(1, Math.round(tileW || 1));
  var H = Math.max(1, Math.round(tileH || 1));
  var canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  var ctx = canvas.getContext('2d');
  if (!ctx) return null;
  var angleDeg = parsed.angle != null ? parsed.angle : 180;
  var rad = (angleDeg * Math.PI) / 180;
  var dx = Math.sin(rad);
  var dy = -Math.cos(rad);
  var cx = W / 2;
  var cy = H / 2;
  var L = Math.sqrt(W * W + H * H) / 2;
  var g;
  try {
    g = ctx.createLinearGradient(cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L);
  } catch (e1) {
    return null;
  }
  var stops = parsed.gradientStops;
  for (var i = 0; i < stops.length; i++) {
    var gs = stops[i];
    var p = gs.position;
    if (p == null || typeof p !== 'number' || isNaN(p)) {
      p = i / Math.max(stops.length - 1, 1);
    }
    var col = gs.color;
    if (col == null || col === '') continue;
    try {
      g.addColorStop(Math.max(0, Math.min(1, p)), typeof col === 'string' ? col : String(col));
    } catch (e2) {
      return null;
    }
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  try {
    return canvas.toDataURL('image/png');
  } catch (e3) {
    return null;
  }
}

/**
 * 将 CSS linear-gradient/radial-gradient 字符串渲染为指定平铺尺寸的 PNG base64 data URL。
 * 线性渐变优先走 Canvas（与 css-parsers 解析结果一致）；解析失败或非线性时再使用 SVG foreignObject。
 */
function renderTiledGradientToDataUrl(bgImage, tileW, tileH, options) {
  return new Promise(function (resolve, reject) {
    var tw = Math.max(1, Math.round(tileW || 1));
    var th = Math.max(1, Math.round(tileH || 1));
    var canvasDataUrl = tryRenderTiledLinearGradientCanvas(bgImage, tw, th, options);
    if (canvasDataUrl) {
      resolve(canvasDataUrl);
      return;
    }
    // 转义 HTML 属性中的特殊字符（gradient 字符串里偶尔含双引号）
    var escapedBgImage = bgImage.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    var svgStr = '<svg xmlns="http://www.w3.org/2000/svg"'
      + ' width="' + tw + '" height="' + th + '">'
      + '<foreignObject width="' + tw + '" height="' + th + '">'
      + '<div xmlns="http://www.w3.org/1999/xhtml"'
      + ' style="width:' + tw + 'px;height:' + th + 'px;'
      + 'background-image:' + escapedBgImage + ';'
      + 'background-size:' + tw + 'px ' + th + 'px;'
      + 'background-repeat:no-repeat;">'
      + '</div>'
      + '</foreignObject>'
      + '</svg>';
    var svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    var img = new window.Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
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

/**
 * 将小单元纹理重复铺满整张 Frame，导出为单张 PNG（FILL）。
 * 剪贴板粘贴到 Figma 时，FRAME 上 imageScaleMode=TILE 可能不生效或显示异常；
 * 预合成整幅可避免依赖 Figma 的平铺填充。
 */
function rasterizeTilePatternToFullDataUrl(tileDataUrl, outW, outH) {
  return new Promise(function (resolve, reject) {
    if (typeof document === 'undefined') {
      reject(new Error('[tiled-gradient] no document'));
      return;
    }
    var w = Math.max(1, Math.round(outW || 1));
    var h = Math.max(1, Math.round(outH || 1));
    var MAX = 8192;
    if (w > MAX || h > MAX) {
      reject(new Error('[tiled-gradient] frame exceeds ' + MAX + 'px'));
      return;
    }
    var img = new window.Image();
    img.onload = function () {
      try {
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('[tiled-gradient] no 2d context'));
          return;
        }
        var pat = ctx.createPattern(img, 'repeat');
        if (!pat) {
          reject(new Error('[tiled-gradient] createPattern failed'));
          return;
        }
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = function () {
      reject(new Error('[tiled-gradient] tile bitmap load failed'));
    };
    img.src = tileDataUrl;
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
        // 平铺渐变：先栅格单元格，再尽量预合成与 Frame 同尺寸的整图 + FILL（Figma 剪贴板对 TILE 常不可靠）
        stats.attempts += 1;
        var _tileW = fill.bgSizeW || 100;
        var _tileH = fill.bgSizeH || 100;
        var _frameW = style && style.width;
        var _frameH = style && style.height;
        promises.push(
          renderTiledGradientToDataUrl(fill.bgImage, _tileW, _tileH, ctxOptions).then(function (tileDataUrl) {
            var useFull =
              _frameW != null &&
              _frameH != null &&
              _frameW > 0 &&
              _frameH > 0 &&
              typeof document !== 'undefined';
            if (useFull) {
              return rasterizeTilePatternToFullDataUrl(tileDataUrl, _frameW, _frameH).then(function (fullDataUrl) {
                return computeDataUrlSha1Hex(fullDataUrl).then(function (sha1hex) {
                  style.fills[i] = {
                    type: 'IMAGE',
                    content: fullDataUrl,
                    scaleMode: 'FILL',
                    imageHashHex: sha1hex || undefined,
                  };
                  stats.success += 1;
                  console.log('[tiled-gradient] 预合成整幅 FILL', { frameW: _frameW, frameH: _frameH, tileW: _tileW, tileH: _tileH });
                });
              }).catch(function (e2) {
                console.warn('[tiled-gradient] 预合成整幅失败，回退 TILE', e2 && e2.message);
                return computeDataUrlSha1Hex(tileDataUrl).then(function (sha1hex) {
                  style.fills[i] = {
                    type: 'IMAGE',
                    content: tileDataUrl,
                    scaleMode: 'TILE',
                    imageHashHex: sha1hex || undefined,
                  };
                  stats.success += 1;
                });
              });
            }
            return computeDataUrlSha1Hex(tileDataUrl).then(function (sha1hex) {
              style.fills[i] = {
                type: 'IMAGE',
                content: tileDataUrl,
                scaleMode: 'TILE',
                imageHashHex: sha1hex || undefined,
              };
              stats.success += 1;
              console.log('[tiled-gradient] 渲染成功 TILE（无 frame 尺寸）', { tileW: _tileW, tileH: _tileH });
            });
          }).catch(function (err) {
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
