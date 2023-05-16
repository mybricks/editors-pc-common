export interface T_Bg {
  bgColor?: string;
  bgImage?: string;
}

export function bg2Arr(background: string = ''): string[] {
  let images: string[] = [];
  let count = 0;
  let idx = 0;
  for (let i = 0; i < background.length; i++) {
    if (background[i] === '(') {
      count = count + 1;
    } else if (background[i] === ')') {
      count = count - 1;
    }
    if (background[i] === ',' && count === 0) {
      images.push(background.slice(idx, i).trim());
      idx = i + 1;
    }
  }
  images.push(background.slice(idx, background.length).trim());
  return images;
}

export function bgParse(background: string = ''): T_Bg {
  const images = bg2Arr(background);
  return {
    bgColor: images.pop() || 'transparent',
    bgImage: images.shift() || 'url() center top / 100% 100% no-repeat',
  };
}

export function bgStringify({ bgColor, bgImage }: T_Bg): string {
  return [bgImage, bgColor].filter((item) => item).join(',');
}

export function setBgColor(color: string, background: string): string {
  const { bgImage } = bgParse(background);
  return bgStringify({
    bgColor: color,
    bgImage,
  });
}

export function setBgImage(image: string, background: string): string {
  const { bgColor = 'transparent' } = bgParse(background);
  return bgStringify({
    bgColor,
    bgImage: image,
  });
}

interface AnyObject {
  [key: string]: any
}

export function initValues(defaultValue: AnyObject, mergeValue: AnyObject): AnyObject {
  const result: AnyObject = {}
  Object.entries(defaultValue).forEach(([key, value]) => {
    result[key] = mergeValue.hasOwnProperty(key) ? mergeValue[key] : value
  })

  return result
}
