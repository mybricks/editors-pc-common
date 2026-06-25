import { useState, useEffect, useLayoutEffect } from 'react'

function useWebDarkMode(): boolean {
	const [isDark, setIsDark] = useState(() =>
		window.matchMedia('(prefers-color-scheme: dark)').matches
	);

	useLayoutEffect(() => {
		const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
		function handleModeChange(e: MediaQueryListEvent) {
			setIsDark(e.matches);
		}
		darkModeQuery.addEventListener('change', handleModeChange);
		return () => {
			darkModeQuery.removeEventListener('change', handleModeChange);
		};
	}, []);

	return isDark;
}

function isVSCodeDark(): boolean {
  return (
    document.body.classList.contains('vscode-dark') ||
    document.body.classList.contains('vscode-high-contrast')
  )
}

/**
 * 感知 VS Code 主题（暗黑 / 亮色）
 */
function useVSCodeDarkMode() {
  const [isDark, setIsDark] = useState(isVSCodeDark)

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(isVSCodeDark())
    })
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return isDark
}

export function useDarkMode(): boolean {
  const isVSCode = typeof (window as any).acquireVsCodeApi === 'function'
  return isVSCode ? useVSCodeDarkMode() : useWebDarkMode()
}