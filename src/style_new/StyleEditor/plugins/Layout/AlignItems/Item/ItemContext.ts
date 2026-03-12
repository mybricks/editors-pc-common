import { createContext, CSSProperties } from "react";
const FlexContext = createContext<{
  flexDirection: CSSProperties["flexDirection"];
  hover: boolean;
  active: boolean;
}>({
  flexDirection: "row",
  hover: false,
  active: false,
});
export default FlexContext;
