import React from 'react';

const KEYFRAMES_ID = 'vibeui-spin-keyframes';
const KEYFRAMES_CSS =
  '@keyframes vibeui-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}' +
  '@keyframes vibeui-progress-slide{0%{transform:translateX(-120%)}100%{transform:translateX(240%)}}';

export function SpinIcon() {
  React.useEffect(() => {
    if (!document.getElementById(KEYFRAMES_ID)) {
      const s = document.createElement('style');
      s.id = KEYFRAMES_ID;
      s.textContent = KEYFRAMES_CSS;
      document.head.appendChild(s);
    }
  }, []);

  return (
    <span
      style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        marginRight: 5,
        verticalAlign: 'middle',
        flexShrink: 0,
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'vibeui-spin 0.7s linear infinite',
        willChange: 'transform',
      }}
    />
  );
}
