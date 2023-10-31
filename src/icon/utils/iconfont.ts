/**
 * 从 Iconfont 的 js 中抽取图标列表
 * @param jsText
 */

export const extractListFormIconfontJS = (jsText: string): string[] => {
  // https://regex101.com/r/ZxzbHb/1
  const regex = /<symbol id="((?:\w|-)*)"/g;

  return Array.from(jsText.matchAll(regex)).map((i) => i[1]);
};

//生成一定格式的svg
export const parse = (html:any)=>{
  const placeholder = document.createElement("svg");
  placeholder.setAttribute("viewBox","0 0 1024 1024");
  placeholder.setAttribute("focusable","false");
  placeholder.setAttribute("width","1em");
  placeholder.setAttribute("height","1em");
  placeholder.setAttribute("fill","currentColor");
  placeholder.setAttribute("aria-hidden","true");

  placeholder.innerHTML = html;
  return placeholder;
}

//将svg转换为字符串
export const domToString = (node:HTMLDivElement) => {
  let tmpNode = document.createElement('div')
  tmpNode.appendChild(node) 
  let str = tmpNode.innerHTML
  tmpNode = node = null; // 解除引用，以便于垃圾回收  
  return str;
}