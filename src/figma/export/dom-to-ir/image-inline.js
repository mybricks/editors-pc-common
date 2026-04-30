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
  return fetchImageBlob(url)
    .then(function (blob) {
      return blobToDataUrl(blob, url);
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
 * 将完整 CSS 背景（多层 gradient + 可选背景色）按节点尺寸栅格化为 PNG data URL。
 * 用于多重渐变降级导出：避免 Figma 原生渐变能力不足导致失真。
 */
function renderCssBackgroundToDataUrl(bgImage, bgColor, outW, outH, cssBackground) {
  return new Promise(function (resolve, reject) {
    if (typeof document === 'undefined') {
      reject(new Error('[css-gradient] no document'));
      return;
    }
    var w = Math.max(1, Math.round(outW || 1));
    var h = Math.max(1, Math.round(outH || 1));
    var escapedBgImage = String(bgImage || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    var escapedBgColor = bgColor ? String(bgColor).replace(/&/g, '&amp;').replace(/"/g, '&quot;') : '';
    var escapedCssBackground = cssBackground ? String(cssBackground).replace(/&/g, '&amp;').replace(/"/g, '&quot;') : '';
    var bgStyle = '';
    if (escapedCssBackground && escapedCssBackground.indexOf('gradient') >= 0) {
      // 优先使用原始 background 整串，避免重组 background-image/background-size 造成颜色偏差
      bgStyle = 'background:' + escapedCssBackground + ';';
    } else {
      bgStyle =
        (escapedBgColor ? 'background-color:' + escapedBgColor + ';' : '')
        + 'background-image:' + escapedBgImage + ';';
    }
    var svgStr = '<svg xmlns="http://www.w3.org/2000/svg"'
      + ' width="' + w + '" height="' + h + '">'
      + '<foreignObject width="' + w + '" height="' + h + '">'
      + '<div xmlns="http://www.w3.org/1999/xhtml"'
      + ' style="width:' + w + 'px;height:' + h + 'px;'
      + bgStyle
      + 'background-position:0 0;">'
      + '</div>'
      + '</foreignObject>'
      + '</svg>';
    var svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    var img = new window.Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = function () {
      reject(new Error('[css-gradient] SVG foreignObject render failed'));
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

/**
 * 预处理并着色 CSS mask 图标 SVG（纯字符串 regex，不经 DOMParser→XMLSerializer）：
 *
 * 1. 移除所有 mix-blend-mode 声明（pass-through 或 normal）
 *    - pass-through 是非标准值，Canvas 渲染时整组透明；
 *    - 即使替换为 normal，显式声明仍会强制创建 isolated compositing group，
 *      SVG 作为外部图片加载进 Canvas 时该离屏缓冲区可能为 0×0 → 透明。
 *    → 直接移除，默认 normal 行为不触发隔离合成。
 * 2. 修正 fill-rule 大写（NONZERO/EVENODD → nonzero/evenodd）
 * 3. 将所有非 none/transparent/url 的 fill 值替换为 fillColor（直接烘焙颜色）
 *    → 栅格化后无需 destination-in 合成，避免透明导致空白
 *
 * 不使用 DOMParser+XMLSerializer：序列化复杂 SVG 时可能引入多余 xmlns 声明，
 * 导致 Canvas 渲染异常（已通过 getImageData 确认）。
 */
function preprocessAndRecolorMaskSvg(svgContent, fillColor) {
  if (!svgContent || typeof svgContent !== 'string') return svgContent;

  var result = svgContent;

  // 0. 确保 svg 根有 width/height 属性。Chromium 中 <img> 加载只有 viewBox 没有
  //    width/height 的 SVG 时，naturalWidth/naturalHeight 会是 0，导致 drawImage 输出空白。
  result = result.replace(/<svg\b([^>]*)>/i, function (m, attrs) {
    var hasW = /\bwidth\s*=/i.test(attrs);
    var hasH = /\bheight\s*=/i.test(attrs);
    if (hasW && hasH) return m;
    var vb = attrs.match(/\bviewBox\s*=\s*["']\s*[-\d.eE]+\s+[-\d.eE]+\s+([-\d.eE]+)\s+([-\d.eE]+)\s*["']/i);
    var vbW = vb ? vb[1] : '24';
    var vbH = vb ? vb[2] : '24';
    var inj = '';
    if (!hasW) inj += ' width="' + vbW + '"';
    if (!hasH) inj += ' height="' + vbH + '"';
    return '<svg' + attrs + inj + '>';
  });

  // 1. 移除根 svg 元素上的 fill="none" / fill="transparent" 属性。
  //    某些渲染器会把根 fill 强制传播到子元素，覆盖 g/path 上的 fill。
  result = result.replace(/(<svg\b[^>]*?)\bfill\s*=\s*"(?:none|transparent)"/i, '$1');
  result = result.replace(/(<svg\b[^>]*?)\bfill\s*=\s*'(?:none|transparent)'/i, '$1');

  // 2. 移除所有 mix-blend-mode 声明（pass-through 或 normal）
  //    原因：pass-through 是非标准值；显式 normal 也会强制创建隔离合成组。
  //    Canvas 加载 SVG 时该离屏缓冲区可能被分配为 0×0，导致整个 <g> 渲染为透明。
  result = result.replace(/;\s*mix-blend-mode\s*:\s*[^;}"']+/gi, '');
  result = result.replace(/mix-blend-mode\s*:\s*[^;}"']+;\s*/gi, '');
  result = result.replace(/mix-blend-mode\s*:\s*[^;}"']+/gi, '');

  // 2. fill-rule 大写 → 小写
  result = result.replace(/\bfill-rule\s*=\s*"NONZERO"/g, 'fill-rule="nonzero"');
  result = result.replace(/\bfill-rule\s*=\s*"EVENODD"/g, 'fill-rule="evenodd"');
  result = result.replace(/\bfill-rule\s*=\s*'NONZERO'/g, "fill-rule='nonzero'");
  result = result.replace(/\bfill-rule\s*=\s*'EVENODD'/g, "fill-rule='evenodd'");

  // 3. 烘焙颜色（仅在 fillColor 有效时）
  if (fillColor) {
    // 替换 fill="<色值>" 属性（保留 fill="none"、fill="transparent"、fill="url(...)"）
    result = result.replace(/\bfill="([^"]*)"/g, function (m, val) {
      var v = val.trim().toLowerCase();
      if (!v || v === 'none' || v === 'transparent' || v.indexOf('url(') === 0) return m;
      return 'fill="' + fillColor + '"';
    });
    result = result.replace(/\bfill='([^']*)'/g, function (m, val) {
      var v = val.trim().toLowerCase();
      if (!v || v === 'none' || v === 'transparent' || v.indexOf('url(') === 0) return m;
      return "fill='" + fillColor + "'";
    });
    // 替换 style 属性内的 fill: <色值>
    result = result.replace(/\bfill\s*:\s*(?!none\b|transparent\b|url\()([^;}"']+)/gi, 'fill:' + fillColor);
  }

  return result;
}

/**
 * CSS mask 图标着色：将已栅格化的 SVG data URL（原始颜色）用 Canvas destination-in 合成，
 * 替换为 fillColor 指定的颜色。等价于 CSS `mask` 的渲染效果：
 *   1. 用 fillColor 填充整张画布
 *   2. 用 SVG 的 alpha 通道做 destination-in 遮罩（只保留 SVG 不透明区域内的 fillColor）
 * 失败时回退返回原 dataUrl。
 */
function _applyColorToMaskImageDataUrl(svgDataUrl, fillColor) {
  return new Promise(function (resolve) {
    if (!svgDataUrl || svgDataUrl.length < 100) {
      resolve(svgDataUrl);
      return;
    }
    var img = new window.Image();
    img.onload = function () {
      try {
        var cw = img.width || img.naturalWidth || 1;
        var ch = img.height || img.naturalHeight || 1;
        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext('2d');
        if (!ctx) { resolve(svgDataUrl); return; }

        // 步骤 1：用目标颜色填充整张画布
        ctx.fillStyle = fillColor;
        ctx.fillRect(0, 0, cw, ch);
        // 步骤 2：destination-in —— 保留与 SVG 不透明像素重叠的区域（形状遮罩）
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(img, 0, 0, cw, ch);

        var _result = canvas.toDataURL('image/png');
        resolve(_result);
      } catch (_eComposite) {
        resolve(svgDataUrl);
      }
    };
    img.onerror = function () {
      resolve(svgDataUrl);
    };
    img.src = svgDataUrl;
  });
}

/**
 * 将内联 SVG 字符串按给定尺寸栅格化为 PNG data URL。
 * 默认使用 2x 渲染，提升粘贴到 Figma 后的观感清晰度。
 */
function rasterizeInlineSvgToPngDataUrl(svgContent, outW, outH, scaleFactor) {
  return new Promise(function (resolve, reject) {
    if (!svgContent || typeof svgContent !== 'string') {
      reject(new Error('[svg-inline] invalid svg content'));
      return;
    }
    var w = Math.max(1, Math.round(outW || 1));
    var h = Math.max(1, Math.round(outH || 1));
    var scale = Number(scaleFactor);
    if (!(scale > 0)) scale = 2;
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));
    var canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    var ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('[svg-inline] canvas context unavailable'));
      return;
    }
    var img = new window.Image();
    var objectUrl = null;
    img.onload = function () {
      try {
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      } finally {
        if (objectUrl && window.URL && typeof window.URL.revokeObjectURL === 'function') {
          window.URL.revokeObjectURL(objectUrl);
        }
      }
    };
    img.onerror = function () {
      if (objectUrl && window.URL && typeof window.URL.revokeObjectURL === 'function') {
        window.URL.revokeObjectURL(objectUrl);
      }
      reject(new Error('[svg-inline] image decode failed'));
    };
    try {
      if (window.URL && typeof window.URL.createObjectURL === 'function') {
        objectUrl = window.URL.createObjectURL(new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' }));
        img.src = objectUrl;
      } else {
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);
      }
    } catch (e2) {
      reject(e2);
    }
  });
}

/**
 * 采样统计 dataURL 图片 alpha 覆盖率（0~1）。
 * 用于识别“看似成功但实际全透明”的 PNG，避免将空白位图写入剪贴板。
 */
function inspectDataUrlAlphaCoverage(dataUrl) {
  return new Promise(function (resolve) {
    if (!dataUrl || typeof dataUrl !== 'string' || dataUrl.indexOf('data:image/') !== 0) {
      resolve({ alphaCoverage: 0, nonTransparentSamples: 0, totalSamples: 0, width: 0, height: 0 });
      return;
    }
    try {
      var img = new window.Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width || 0;
          var h = img.naturalHeight || img.height || 0;
          if (!(w > 0 && h > 0)) {
            resolve({ alphaCoverage: 0, nonTransparentSamples: 0, totalSamples: 0, width: w, height: h });
            return;
          }
          var c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          var ctx = c.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve({ alphaCoverage: 0, nonTransparentSamples: 0, totalSamples: 0, width: w, height: h });
            return;
          }
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          var data = ctx.getImageData(0, 0, w, h).data;
          var stride = Math.max(1, Math.floor(Math.max(w, h) / 64));
          var total = 0;
          var opaque = 0;
          for (var y = 0; y < h; y += stride) {
            for (var x = 0; x < w; x += stride) {
              total += 1;
              var idx = ((y * w + x) << 2) + 3;
              if (data[idx] > 8) opaque += 1;
            }
          }
          resolve({
            alphaCoverage: total ? (opaque / total) : 0,
            nonTransparentSamples: opaque,
            totalSamples: total,
            width: w,
            height: h,
          });
        } catch (_eInspect) {
          resolve({ alphaCoverage: 0, nonTransparentSamples: 0, totalSamples: 0, width: 0, height: 0 });
        }
      };
      img.onerror = function () {
        resolve({ alphaCoverage: 0, nonTransparentSamples: 0, totalSamples: 0, width: 0, height: 0 });
      };
      img.src = dataUrl;
    } catch (_eOuter) {
      resolve({ alphaCoverage: 0, nonTransparentSamples: 0, totalSamples: 0, width: 0, height: 0 });
    }
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
  ctxOptions.__imageInlineDepth += 1;
  var stats = ctxOptions.__imageInlineStats;
  var promises = [];

  // 处理 style.fills 里的 IMAGE fill 和 TILED_GRADIENT fill
  var style = obj.style;
  if (style && style.fills && Array.isArray(style.fills)) {
    style.fills.forEach(function (fill, i) {
      if (fill && fill.type === 'IMAGE' && fill.cssGradient && !fill.content) {
        // 多重渐变降级：按节点尺寸栅格化为单张位图（FILL）。
        stats.attempts += 1;
        var _cssBgW = style && style.width;
        var _cssBgH = style && style.height;
        if (!(_cssBgW > 0 && _cssBgH > 0)) {
          style.fills[i] = null;
          stats.failed += 1;
          console.warn('[css-gradient] 缺少有效尺寸，无法栅格化', { nodeName: obj.name, width: _cssBgW, height: _cssBgH });
        } else {
          promises.push(
            renderCssBackgroundToDataUrl(fill.cssGradient, fill.cssBackgroundColor, _cssBgW, _cssBgH, fill.cssBackground).then(function (dataUrl) {
              return computeDataUrlSha1Hex(dataUrl).then(function (sha1hex) {
                style.fills[i] = Object.assign({}, fill, {
                  content: dataUrl,
                  imageHashHex: sha1hex || undefined,
                  scaleMode: fill.scaleMode || 'FILL',
                  cssGradient: undefined,
                  cssBackgroundColor: undefined,
                  cssBackground: undefined,
                  url: undefined,
                });
                stats.success += 1;
              });
            }).catch(function (err) {
              style.fills[i] = null;
              stats.failed += 1;
              console.warn('[css-gradient] 栅格化失败，已移除该 fill', err && err.message);
            })
          );
        }
      } else if (fill && fill.type === 'IMAGE' && fill.url && !fill.content) {
        stats.attempts += 1;
        promises.push(
          fetchImageAsBase64DataUrl(fill.url).then(function (dataUrl) {
            return computeDataUrlSha1Hex(dataUrl).then(function (sha1hex) {
              // 保留原 fill 上的所有字段（如 scaleMode、scalingFactor），仅替换 content，清除 url
              style.fills[i] = Object.assign({}, fill, { content: dataUrl, imageHashHex: sha1hex || undefined, url: undefined });
              stats.success += 1;
            });
          }).catch(function (err) {
            stats.failed += 1;
            console.warn('[image fill] 内联失败（可能是跨域/CORS）', fill.url, err && err.message);
          })
        );
      } else if (fill && fill.type === 'IMAGE' && !fill.url && !fill.content) {
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
    stats.attempts += 1;
    promises.push(
      fetchImageAsBase64DataUrl(obj.content).then(function (dataUrl) {
        return computeDataUrlSha1Hex(dataUrl).then(function (sha1hex) {
          obj.content = dataUrl;
          if (sha1hex) obj.imageHashHex = sha1hex;
          stats.success += 1;
        });
      }).catch(function (err) {
        stats.failed += 1;
        console.warn('[image node] 内联失败（可能是跨域/CORS）', obj.content, err && err.message);
      })
    );
  }

  // 在保真优先模式下，将 SVG 节点直接栅格化为图片节点，避免复杂矢量解析造成还原偏差。
  var _svgExportMode = String((ctxOptions && ctxOptions.svgExportMode) || 'vector').toLowerCase();
  if (obj.type === 'svg' && _svgExportMode === 'image') {
    var _svgStyle = obj.style || {};
    var _svgMarkup = _svgStyle.svgContent;
    // CSS mask 图标：提前捕获 maskFillColor（闭包变量，避免 promise 链内读取时 obj.style 已被替换）
    var _svgMaskFill = _svgStyle.maskFillColor || null;
    // CSS mask 单色图标优先保留为矢量：
    // 1) 避免小尺寸高透明 PNG 在 Figma Fill 预览面板中的不稳定回显
    // 2) 保留可缩放性，避免锯齿
    if (_svgMaskFill && _svgMarkup) {
      // 注意：保持 obj.type === 'svg'，后续由 ir-to-figma 的 convertSvgNode 走矢量路径，
      // 并使用 style.maskFillColor 作为最终填充色。
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
      });
    }
    if (typeof _svgMarkup === 'string' && _svgMarkup) {
      stats.attempts += 1;
      var _svgW = _svgStyle.width || 24;
      var _svgH = _svgStyle.height || 24;
      var _svgScale = Number(ctxOptions && ctxOptions.svgRasterScale);
      if (!(_svgScale > 0)) _svgScale = 2;
      // CSS mask 图标：动态提高渲染分辨率，保证最短边 ≥ 64px，消除小图标锯齿
      // 例：16px 图标 → ceil(64/16)=4x → 64px；24px → ceil(64/24)=3x → 72px；48px+ → 保持原倍率
      var _maskScale = _svgMaskFill
        ? Math.max(_svgScale, Math.ceil(64 / Math.max(1, Math.min(_svgW, _svgH))))
        : _svgScale;
      // CSS mask 图标：预处理修正非标准 CSS + 烘焙颜色（fill 直接替换为 maskFillColor），
      // 然后直接栅格化，无需 destination-in 合成（避免 SVG 透明导致空白）
      var _svgMarkupForRaster = _svgMaskFill
        ? preprocessAndRecolorMaskSvg(_svgMarkup, _svgMaskFill)
        : _svgMarkup;
      var _rasterP = _svgMaskFill
        ? rasterizeInlineSvgToPngDataUrl(_svgMarkupForRaster, _svgW, _svgH, _maskScale).then(function (dataUrl) {
            return inspectDataUrlAlphaCoverage(dataUrl).then(function (_alphaMeta) {
              // 覆盖率过低视为“实质空白图”，回退矢量导出，避免把透明 PNG 写入剪贴板。
              if ((_alphaMeta.alphaCoverage || 0) < 0.003) {
                throw new Error('[mask-icon] alpha coverage too low: ' + (_alphaMeta.alphaCoverage || 0));
              }
              return dataUrl;
            });
          }).then(function (dataUrl) {
            return dataUrl;
          })
        : rasterizeInlineSvgToPngDataUrl(_svgMarkup, _svgW, _svgH, _svgScale);
      promises.push(
        _rasterP.then(function (dataUrl) {
          return computeDataUrlSha1Hex(dataUrl).then(function (sha1hex) {
            obj.type = 'image';
            obj.content = dataUrl;
            if (sha1hex) obj.imageHashHex = sha1hex;
            var _nextStyle = Object.assign({}, _svgStyle, { svgContent: undefined, fills: undefined });
            obj.style = _nextStyle;
            stats.success += 1;
          });
        }).catch(function (err) {
          stats.failed += 1;
          console.warn('[svg-inline] 栅格化失败，回退矢量导出', { nodeName: obj.name, message: err && err.message });
        })
      );
    }
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
  });
}


if (typeof module !== 'undefined') {
  module.exports = {
    fetchImageAsBase64DataUrl: fetchImageAsBase64DataUrl,
    inlineImageFillsInTree: inlineImageFillsInTree,
  };
}
