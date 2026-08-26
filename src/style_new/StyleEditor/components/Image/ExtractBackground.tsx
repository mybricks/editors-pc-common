import { findCssFunctionCalls } from '../../../core/css-functions';

export const ExtractBackground = (
  css: string,
  type: "all" | "image" | "gradient" = "all"
) => {
  if (!css) return [];

  const calls = findCssFunctionCalls(css, ['linear-gradient', 'radial-gradient', 'url']);
  return calls
    .filter((call) => {
      const name = call.name.toLowerCase();
      if (type === 'image') return name === 'url';
      if (type === 'gradient') return name === 'linear-gradient' || name === 'radial-gradient';
      return true;
    })
    .map((call) => call.value.trim());
};
