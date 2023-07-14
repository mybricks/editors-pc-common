import React, {
  useRef,
  useState,
  useEffect,
  ReactNode,
  useCallback
} from 'react'
import { createPortal } from 'react-dom' 

import { CheckOutlined } from '../'

import css from './index.less'

interface DropdownProps {
  value: any
  options: Array<{label: string | number, value: any}>
  children: ReactNode
  onClick: (value: any) => void
  className?: string
}

export function Dropdown ({
  value,
  options,
  children,
  onClick,
  className
}: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)
  const [open, setOpen] = useState(false)
  
  const handleDropDownClick = useCallback(() => {
    setShow(true)
    setOpen(true)
  }, [])

  const handleItemClick = useCallback((value) => {
    onClick(value)
  }, [])

  const handleClick = useCallback(() => {
    setOpen(false)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        // TODO
        document.addEventListener('click', handleClick)
      })
    } else {
      document.removeEventListener('click', handleClick)
    }
  }, [open])

  useEffect(() => {
    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [])
  
  return (
    <>
      <div
        ref={ref}
        className={`${css.dropDown}${className ? ` ${className}` : ''}`}
        onClick={handleDropDownClick}
      >
        {children}
      </div>
      {show && createPortal(
        <Items
          value={value}
          options={options}
          positionElement={ref.current!}
          open={open}
          onClick={handleItemClick}
        />, document.body)}
    </>
  )
}

interface ItemsProps {
  value: any
  options: Array<{label: string | number, value: any}>
  onClick: (value: any) => void
  open: boolean
  positionElement: HTMLDivElement
}

function Items({
  open,
  options,
  positionElement,
  onClick,
  value: currentValue
}: ItemsProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const menusContainer = ref.current!
    if (open) {
      const positionElementBct = positionElement.getBoundingClientRect()
      const menusContainerBct = ref.current!.getBoundingClientRect()
      const totalHeight = window.innerHeight || document.documentElement.clientHeight
      const top = positionElementBct.top + positionElementBct.height
      const right = positionElementBct.left + positionElementBct.width
      const letf = right - positionElementBct.width
      const bottom = top + menusContainerBct.height

      if (bottom > totalHeight) {
        // 目前判断下方是否超出即可
        // 向上
        menusContainer.style.top = (positionElementBct.top - menusContainerBct.height) + 'px'
      } else {
        menusContainer.style.top = top + 'px'
      }

      // 保证完全展示
      if (menusContainerBct.width > positionElementBct.width) {
        menusContainer.style.left = letf - menusContainerBct.width + positionElementBct.width + 'px'
      } else {
        menusContainer.style.width = positionElementBct.width + 'px'
        menusContainer.style.left = letf + 'px'
      }

      
      
      menusContainer.style.visibility = 'visible'
    } else {
      menusContainer.style.visibility = 'hidden'
    }
  }, [open])

  return (
    <div ref={ref} className={css.items}>
      {options.map(({label, value}, index) => {
        return (
          <div key={index} className={css.item} onClick={() => onClick(value)}>
            {value === currentValue ? <CheckOutlined /> : <></>}
            {label}
          </div>
        )
      })}
    </div>
  )
}
