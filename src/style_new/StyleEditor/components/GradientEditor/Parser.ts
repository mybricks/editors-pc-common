const tokens = {
  linearGradient: /^(\-(webkit|o|ms|moz)\-)?(linear\-gradient)/i,
  repeatingLinearGradient: /^(\-(webkit|o|ms|moz)\-)?(repeating\-linear\-gradient)/i,
  radialGradient: /^(\-(webkit|o|ms|moz)\-)?(radial\-gradient)/i,
  repeatingRadialGradient: /^(\-(webkit|o|ms|moz)\-)?(repeating\-radial\-gradient)/i,
  sideOrCorner:
    /^to (left (top|bottom)|right (top|bottom)|top (left|right)|bottom (left|right)|left|right|top|bottom)/i,
  extentKeywords: /^(closest\-side|closest\-corner|farthest\-side|farthest\-corner|contain|cover)/,
  positionKeywords: /^(left|center|right|top|bottom)/i,
  pixelValue: /^(-?(([0-9]*\.[0-9]+)|([0-9]+\.?)))px/,
  percentageValue: /^(-?(([0-9]*\.[0-9]+)|([0-9]+\.?)))\%/,
  emValue: /^(-?(([0-9]*\.[0-9]+)|([0-9]+\.?)))em/,
  angleValue: /^(-?(([0-9]*\.[0-9]+)|([0-9]+\.?)))deg/,
  startCall: /^\(/,
  endCall: /^\)/,
  comma: /^,/,
  hexColor: /^\#([0-9a-fA-F]+)/,
  literalColor: /^([a-zA-Z]+)/,
  rgbColor: /^rgb/i,
  rgbaColor: /^rgba/i,
  number: /^(([0-9]*\.[0-9]+)|([0-9]+\.?))/
};

type GradientType =
  | 'linear-gradient'
  | 'repeating-linear-gradient'
  | 'radial-gradient'
  | 'repeating-radial-gradient';

let input = '';

const error = (msg: string) => {
  const err = new Error(input + ': ' + msg);
  throw err;
};

const getAST = () => {
  const ast = matchListDefinitions();

  if (input.length > 0) {
    error('Invalid input not EOF');
  }

  return ast;
};

const matchListDefinitions = () => {
  return matchListing(matchDefinition);
};

const matchDefinition = () => {
  return (
    matchGradient('linear-gradient', tokens.linearGradient, matchLinearOrientation) ||
    matchGradient(
      'repeating-linear-gradient',
      tokens.repeatingLinearGradient,
      matchLinearOrientation
    ) ||
    matchGradient('radial-gradient', tokens.radialGradient, matchListRadialOrientations) ||
    matchGradient(
      'repeating-radial-gradient',
      tokens.repeatingRadialGradient,
      matchListRadialOrientations
    )
  );
};

const matchGradient = (
  gradientType: GradientType,
  pattern: RegExp,
  orientationMatcher: () => any
) => {
  return matchCall(pattern, () => {
    const orientation = orientationMatcher();
    if (orientation) {
      if (!scan(tokens.comma)) {
        error('Missing comma before color stops');
      }
    }

    return {
      type: gradientType,
      orientation: orientation,
      colorStops: matchListing(matchColorStop)
    };
  });
};

const matchCall = (pattern: RegExp, callback: (props: any) => any) => {
  const captures = scan(pattern);

  if (captures) {
    if (!scan(tokens.startCall)) {
      error('Missing (');
    }

    const result = callback(captures);

    if (!scan(tokens.endCall)) {
      error('Missing )');
    }

    return result;
  }
};

const matchLinearOrientation = () => {
  return matchSideOrCorner() || matchAngle();
};

const matchSideOrCorner = () => {
  return match('directional', tokens.sideOrCorner, 1);
};

const matchAngle = () => {
  return match('angular', tokens.angleValue, 1);
};

const matchListRadialOrientations = () => {
  let radialOrientations,
    radialOrientation = matchRadialOrientation(),
    lookaheadCache;

  if (radialOrientation) {
    radialOrientations = [];
    radialOrientations.push(radialOrientation);

    lookaheadCache = input;
    if (scan(tokens.comma)) {
      radialOrientation = matchRadialOrientation();
      if (radialOrientation) {
        radialOrientations.push(radialOrientation);
      } else {
        input = lookaheadCache;
      }
    }
  }

  return radialOrientations;
};

const matchRadialOrientation = () => {
  let radialType: any = matchCircle() || matchEllipse();

  if (radialType) {
    radialType.at = matchAtPosition();
  } else {
    const extent = matchExtentKeyword();
    if (extent) {
      radialType = extent;
      const positionAt = matchAtPosition();
      if (positionAt) {
        radialType.at = positionAt;
      }
    } else {
      const defaultPosition = matchPositioning();
      if (defaultPosition) {
        radialType = {
          type: 'default-radial',
          at: defaultPosition
        };
      }
    }
  }

  return radialType;
};

const matchCircle = () => {
  const circle = match('shape', /^(circle)/i, 0);

  if (circle) {
    circle.style = matchLength() || matchExtentKeyword();
  }

  return circle;
};

const matchEllipse = () => {
  const ellipse = match('shape', /^(ellipse)/i, 0);

  if (ellipse) {
    ellipse.style = matchDistance() || matchExtentKeyword();
  }

  return ellipse;
};

const matchExtentKeyword = () => {
  return match('extent-keyword', tokens.extentKeywords, 1);
};

const matchAtPosition = () => {
  if (match('position', /^at/, 0)) {
    const positioning = matchPositioning();

    if (!positioning) {
      error('Missing positioning value');
    }

    return positioning;
  }
};

const matchPositioning = () => {
  const location = matchCoordinates();

  if (location.x || location.y) {
    return {
      type: 'position',
      value: location
    };
  }
};

const matchCoordinates = () => {
  return {
    x: matchDistance(),
    y: matchDistance()
  };
};

const matchListing = (matcher: () => any) => {
  let captures = matcher();
  const result = [];

  if (captures) {
    result.push(captures);
    while (scan(tokens.comma)) {
      captures = matcher();
      if (captures) {
        result.push(captures);
      } else {
        error('One extra comma');
      }
    }
  }

  return result;
};

const matchColorStop = () => {
  const color = matchColor();

  if (!color) {
    error('Expected color definition');
  }

  color.length = matchDistance();
  return color;
};

const matchColor = () => {
  return matchHexColor() || matchRGBAColor() || matchRGBColor() || matchLiteralColor();
};

const matchLiteralColor = () => {
  return match('literal', tokens.literalColor, 0);
};

const matchHexColor = () => {
  return match('hex', tokens.hexColor, 1);
};

const matchRGBColor = () => {
  return matchCall(tokens.rgbColor, () => {
    return {
      type: 'rgb',
      value: matchListing(matchNumber)
    };
  });
};

const matchRGBAColor = () => {
  return matchCall(tokens.rgbaColor, () => {
    return {
      type: 'rgba',
      value: matchListing(matchNumber)
    };
  });
};

const matchNumber = () => {
  return scan(tokens.number)?.[1];
};

const matchDistance = () => {
  return match('%', tokens.percentageValue, 1) || matchPositionKeyword() || matchLength();
};

const matchPositionKeyword = () => {
  return match('position-keyword', tokens.positionKeywords, 1);
};

const matchLength = () => {
  return match('px', tokens.pixelValue, 1) || match('em', tokens.emValue, 1);
};

const match = (
  type: string,
  pattern: RegExp,
  captureIndex: number
): Record<string, any> | undefined => {
  const captures = scan(pattern);
  if (captures) {
    return {
      type: type,
      value: captures[captureIndex]
    };
  }
  return void 0;
};

const scan = (regexp: RegExp) => {
  let captures, blankCaptures;

  blankCaptures = /^[\n\r\t\s]+/.exec(input);
  if (blankCaptures) {
    consume(blankCaptures[0].length);
  }

  captures = regexp.exec(input);
  if (captures) {
    consume(captures[0].length);
  }

  return captures;
};

const consume = (size: number) => {
  input = input.slice(size);
};

const GradientParser = (code: string) => {
  input = code.toString();
  return getAST();
};

export default GradientParser;
