import React, { useContext, createContext } from 'react'

const StyleEditorContext = createContext<StyleEditorProviderProps['value']>({})

interface StyleEditorProviderProps {
  value: {
    upload?: (files: Array<File>) => Array<string>
    // upload config 参数 compress
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
