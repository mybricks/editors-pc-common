import { useCallback, useState } from 'react'

import { useLatest, getInitValue as anyToNumber } from './'

export function useInputNumberObject(defaultValue:{[key: string]: any}, onChange?: (value: {key: string, value: string}) => void, whiteListValues: string[] = []): [{[key: string]: string}, (value: {key: string, value: string}) => void] {
  const [value, setValue] = useState<{[key: string]: any}>(getInitValue(defaultValue, whiteListValues))
  const changeRef = useLatest(onChange)

  const handleChange = useCallback(({key, value}) => {
    let changeValue: string = ''

    if (whiteListValues.includes(value)) {
      changeValue = value
    } else if (!value) {
      changeValue = '0'
    } else {
      const number = parseInt(value)
      if (!isNaN(number) && number >= 0) {
        changeValue = String(number)
      }
    }

    if (changeValue) {
      setValue((val) => {
        return {
          ...val,
          [key]: changeValue
        }
      })
      changeRef.current?.({key, value: changeValue})
    }
  }, [])

  return [ value, handleChange ]
}


function getInitValue (defaultValue: {[key: string]: any}, whiteListValues: String[]): {[key: string]: string} {
  const value: {[key: string]: string} = {}

  Object.keys(defaultValue).forEach((key: string) => {
    const val = defaultValue[key]
    value[key] = whiteListValues.includes(val) ? val : anyToNumber(val)
  })

  return value
}
