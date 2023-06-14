import { useCallback, useState } from 'react'

import { useLatest } from './'

export function useInputNumber<D>(defaultValue?: D, onChange?: (value: string) => void): [string, (value: string) => void] {
  const [value, setValue] = useState<string>(getInitValue(defaultValue))
  const changeRef = useLatest(onChange)

  const handleChange = useCallback((value: string) => {
    let changeValue

    if (!value) {
      changeValue = '0'
    } else {
      const number = parseInt(value)
      if (!isNaN(number) && number >= 0) {
        changeValue = String(number)
      }
    }

    if (changeValue) {
      setValue(changeValue)
      changeRef.current?.(changeValue)
    }
  }, [])

  return [ value, handleChange ]
}

export function getInitValue (defaultValue: any): string {
  const value = parseInt(defaultValue)
  if (!isNaN(value) && value > 0) {
    return String(value)
  }

  return '0'
}
