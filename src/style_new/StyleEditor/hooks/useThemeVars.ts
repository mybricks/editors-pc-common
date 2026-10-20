import { useMemo } from 'react'

import { useStyleEditorContext } from '../context'
import type { ThemeVar } from '../../core/css-var'

/**
 * 合并读取主题变量：window.MYBRICKS_AICOM_THEME_VARIABLES + editConfig.themeVars
 */
export function useThemeVars(): ThemeVar[] {
  const context = useStyleEditorContext()
  const configThemeVars = context?.editConfig?.themeVars

  return useMemo(() => {
    const fromWindow = (typeof window !== 'undefined'
      ? ((window as any).MYBRICKS_AICOM_THEME_VARIABLES as ThemeVar[] | undefined)
      : undefined) ?? []
    const fromConfig = configThemeVars ?? []
    return [...fromWindow, ...fromConfig]
  }, [configThemeVars])
}
