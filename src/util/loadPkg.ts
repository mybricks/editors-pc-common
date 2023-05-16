export function loadPkg(src: string, varName: any) {
  return new Promise((resolve) => {
    if (window[varName]) {
      return resolve(window[varName]);
    }
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = src;
    script.onload = function () {
      resolve(window[varName as any]);
    };
    document.head.appendChild(script);
  });
}
