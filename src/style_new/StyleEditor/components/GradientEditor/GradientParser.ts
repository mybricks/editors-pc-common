import gradient from "./Parser";
import { GradientStop, GradientType } from "./constants";
import { uuid } from "../../../../utils";
import Color from "color";

export const ParseGradient = (
  gradientString: string
): {
  type: GradientType;
  direction: string;
  stops: GradientStop[];
} => {
  let type: GradientType = "linear-gradient";
  let direction = "90";
  let stops: GradientStop[] = [];
  if (gradientString && gradientString !== "none") {
    const gradientData = gradient(gradientString)?.[0];
    if (!!gradientData) {
      type = gradientData.type;
      direction = Array.isArray(gradientData.orientation)
        ? gradientData.orientation[0]?.value
        : gradientData.orientation?.value;
      stops =
        // @ts-ignore
        gradientData?.colorStops?.map((colorStop) => ({
          color:
            colorStop.type === "var-color"
              ? `var(${colorStop?.value as string})`
              : colorStop.type === "literal" || colorStop.type === "hex"
              ? Color(
                  colorStop.type === "hex"
                    ? "#" + colorStop.value
                    : colorStop.value
                )
                  .rgb()
                  .string()
              : `rgba(${(colorStop?.value as string[])?.join(",")})`,
          position: Number(colorStop?.length?.value || 0),
          id: uuid(),
        })) || [];
    }
  }

  return { type, direction, stops };
};
