import { resolve } from "path";

const typeMap: {
  [key: string]: string;
} = {
  NULL: "[object Null]",
  ARRAY: "[object Array]",
  OBJECT: "[object Object]",
  STRING: "[object String]",
  NUMBER: "[object Number]",
  BOOLEAN: "[object Boolean]",
  FUNCTION: "[object Function]",
  FORMDATA: "[object FormData]",
  UNDEFINED: "[object Undefined]",
};

export function blobToBase64(blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const a = new FileReader();
    a.onload = (e) => {
      resolve(e.target.result);
    };
    a.onerror = (e) => {
      reject(e);
    };
    a.readAsDataURL(blob);
  });
}

export function isValid(val: any) {
  return val !== null && val !== undefined;
}

export function isArray(val: any) {
  return Object.prototype.toString.call(val) === "[object Array]";
}

export function uuid() {
  let len = 6,
    seed = "abcdefhijkmnprstwxyz",
    maxPos = seed.length;
  let rtn = "";
  for (let i = 0; i < len; i++) {
    rtn += seed.charAt(Math.floor(Math.random() * maxPos));
  }
  return "u_" + rtn;
}

export function getPosition(ele: any, relativeDom?: any) {
  if (relativeDom) {
    let currPo = ele.getBoundingClientRect();
    let targetPo = relativeDom.getBoundingClientRect();

    return {
      x: currPo.left - targetPo.left,
      y: currPo.top - targetPo.top,
      w: ele.offsetWidth,
      h: ele.offsetHeight,
    };
  } else {
    let po = ele.getBoundingClientRect();

    return { x: po.left, y: po.top, w: ele.offsetWidth, h: ele.offsetHeight };
  }
}

export function deepCopy(obj: any, cache: any = []) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  const hit: any = cache.filter((c: any) => c.original === obj)[0];
  if (hit) {
    return hit.copy;
  }
  const copy: any = Array.isArray(obj) ? [] : {};

  cache.push({
    original: obj,
    copy,
  });

  Object.keys(obj).forEach((key) => {
    copy[key] = deepCopy(obj[key], cache);
  });

  return copy;
}

// export function loadScript(src: string, varName: string) {
//   return new Promise((resolve, reject) => {
//     const script = document.createElement('script');
//     script.type = 'text/javascript';
//     script.src = src;
//     script.onload = function () {
//       resolve(window[varName as any]);
//     };
//     document.head.appendChild(script);
//     // document.body.appendChild(script);
//     // (function (script) {
//     //   script.onload = function () {
//     //     alert('loaded.');
//     //     resolve(window[(varName as any)]);
//     //   }
//     // })(script);
//   });
// }

export function loadScript(
  src: string,
  cb: Function = () => {},
  win = window,
  doc = document
) {
  const script: any = doc.createElement("script");
  const head: HTMLHeadElement = doc.getElementsByTagName("head")[0];
  script.type = "text/javascript";
  script.charset = "UTF-8";
  script.src = src;
  head.appendChild(script);
  if (script.addEventListener) {
    script.addEventListener("load", cb, false);
  } else if (script.attachEvent) {
    script.attachEvent("onreadystatechange", function () {
      const target: any = win.event && win.event.srcElement;
      if (target && target.readyState == "loaded") {
        cb();
      }
    });
  }
}

export function typeCheck(variable: any, type: string): boolean {
  const checkType = /^\[.*\]$/.test(type) ? type : typeMap[type.toUpperCase()];

  return Object.prototype.toString.call(variable) === checkType;
}

// export function babelTransform(val = '<></>', presets = ['react', 'es2015']) {
//   let code = `(function () {
//     return React.createElement(
//       "span",
//       null,
//       "语法错误"
//     );
//   })`;
//   try {
//     code = babelStandalone.transform(val, { presets }).code;
//     code = code.replace("'use strict';", '').trim();
//   } catch {}

//   return code;
// }

export function hasScripts(src: string, doc = document) {
  let bool = false;
  const scripts = doc.getElementsByTagName("script");
  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].src === src) {
      bool = true;
    }
  }

  return bool;
}

export function getCurrentNodeByClassName(e: any, cn: string): any {
  const className = e.className || e.target.className;
  const resMatch = (className.baseVal || className).match(new RegExp(cn));

  if (resMatch && resMatch.input.includes(cn)) {
    return e.target || e;
  } else {
    return getCurrentNodeByClassName(e.parentNode || e.target.parentNode, cn);
  }
}

/**
 * 获取editor传入的options--支持传入function | array | object
 * @param {function | array | object} options editor传入的options
 * @param {boolean} isArr 是否输出数组
 * @returns {array | object}
 */
export function getOptionsFromEditor(options: any): any {
  if (typeof options === "function") {
    const res = options();
    return Array.isArray(res) ? { options: res } : res;
  }
  if (Array.isArray(options)) {
    return { options };
  }
  return options;
}

export function hashCode(str: string) {
  var hash = 0;
  if (str.length == 0) return hash;
  for (var i = 0; i < str.length; i++) {
    var char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

export function getQuery() {
  const res: any = {};
  let query = location.search;
  query = query.trim().replace(/^(\?|#|&)/, "");
  if (!query) {
    return res;
  }
  query.split("&").forEach((param) => {
    const parts = param.replace(/\+/g, " ").split("=");
    // @ts-ignore
    const key = decodeURIComponent(parts.shift());
    const val = parts.length > 0 ? decodeURIComponent(parts.join("=")) : null;
    if (res[key] === undefined) {
      res[key] = val;
    } else if (Array.isArray(res[key])) {
      res[key].push(val);
    } else {
      res[key] = [res[key], val];
    }
  });
  const { id, version, ...other } = res;
  return { ...other };
}

export function safeDecodeURIComponent(uri: any) {
  try {
    let result = decodeURIComponent(uri);
    return result;
  } catch (e) {
    //console.error("safeDecodeURIComponent", uri, e);
    return uri;
  }
}

export function ajax(url: string, options: any) {
  return new Promise((resolve, reject) => {
    fetch(url, options)
      .then((res: any) => res.json())
      .then((data) => resolve(data))
      .catch((error) => reject(error));
  });
}

export function arrayMoveMutable(array, fromIndex, toIndex) {
	const startIndex = fromIndex < 0 ? array.length + fromIndex : fromIndex;

	if (startIndex >= 0 && startIndex < array.length) {
		const endIndex = toIndex < 0 ? array.length + toIndex : toIndex;

		const [item] = array.splice(fromIndex, 1);
		array.splice(endIndex, 0, item);
	}
}

export function arrayMoveImmutable(array, fromIndex, toIndex) {
	const newArray = [...array];
	arrayMoveMutable(newArray, fromIndex, toIndex);
	return newArray;
}

export function copyText(txt: string): boolean {
  const input = document.createElement('input')
  document.body.appendChild(input)
  input.value = txt
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
  return true;
}