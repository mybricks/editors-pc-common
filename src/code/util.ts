import { isValid, safeDecodeURIComponent } from "../utils";
export const getComputedValue = (
  value: string | { code: string; transformCode: string }
) => {
  return isValid(value)
    ? String(
        safeDecodeURIComponent(
          `${typeof value === "string" ? value : value?.code || ""}`
        )
      )
    : "";
};

export const getFnString = (fnBody: string, fnParams: string[]) => {
  return fnParams
    ? `export default function ({ ${fnParams.join(",")}}) {
      ${fnBody}
    }`
    : fnBody;
};

export const formatValue = (value: string) => {
  if (/export\s+default.*async.*function.*\(/g.test(value)) {
    value = value.replace(
      /export\s+default.*function.*\(/g,
      "_RTFN_ = async function _RT_("
    );
  } else if (/export\s+default.*function.*\(/g.test(value)) {
    value = value.replace(
      /export\s+default.*function.*\(/g,
      "_RTFN_ = function _RT_("
    );
  } else {
    value = `_RTFN_ = ${value} `;
  }
  return value;
};

export const safeEncoder = (str: string) => {
  try {
    return encodeURIComponent(str)
  } catch (error) {
    return str
  }
}
