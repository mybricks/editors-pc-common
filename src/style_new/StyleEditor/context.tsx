import React, { useContext, createContext } from 'react'

const StyleEditorContext = createContext<StyleEditorProviderProps['value']>({})

interface StyleEditorProviderProps {
  value: {
    /** 文件上传 */
    upload?: (files: Array<File>) => Array<string>
    /** 颜色可选项 */
    colorOptions?: Array<{
      /** 展示 */
      label: string; 
      /** 值 */
      value: string; 
      /** 值（必须为有效色值，优先级高于value） */
      resetValue?: string;
    }>
  }
  children: React.ReactNode
}

export function StyleEditorProvider ({children, value}: StyleEditorProviderProps) {
  return (
    <StyleEditorContext.Provider value={value}>
      {children}
    </StyleEditorContext.Provider>
  )
}

export function useStyleEditorContext () {
  const context = useContext(StyleEditorContext)

  return context
}
