interface Props {
  presets?: string[];
  plugins?: string[]; 
  errorCallback?: (val: any) => void;
  babelInstance?: any;
}

const transformCodeByBabel = (val: string, props?: Props) => {
  const {
    presets,
    plugins,
    errorCallback,
    babelInstance = (window as any)?.Babel
  } = props || {};
  const res = {
    code: val,
    transformCode: ''
  };
  if (
    typeof babelInstance?.transform !== 'function' ||
    typeof val !== 'string'
  ) {
    return res;
  }
  try {
    let temp = decodeURIComponent(val);
    if (/export\s+default.*async.*function.*\(/g.test(temp)) {
      temp = temp.replace(
        /export\s+default.*function.*\(/g,
        '_RTFN_ = async function _RT_('
      );
    } else if (/export\s+default.*function.*\(/g.test(temp)) {
      temp = temp.replace(
        /export\s+default.*function.*\(/g,
        '_RTFN_ = function _RT_('
      );
    } else {
      temp = `_RTFN_ = ${temp} `
    }
    res.transformCode = encodeURIComponent(
      babelInstance.transform(temp, {
        presets,
        comments: false,
        plugins,
        filename: 'types.d.ts'
      }).code
    );
    res.transformCode = `${encodeURIComponent(`(function() { var _RTFN_; \n`)}${
      res.transformCode
    }${encodeURIComponent(`\n; return _RTFN_; })()`)}`;
  } catch (e) {
    if (typeof errorCallback === 'function') {
      errorCallback(e);
    }
    return res;
  }
  return res;
};

export { transformCodeByBabel }