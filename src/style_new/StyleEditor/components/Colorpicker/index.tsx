import React, {
  useRef,
  useState,
  useEffect,
  ReactNode,
  useCallback
} from 'react'
import { createPortal } from 'react-dom'

import Sketch from '@mybricks/color-picker'

import css from './index.less'

interface ColorpickerProps {
  value: string
  onChange(value: string): void
  children: ReactNode
}

export function Colorpicker ({value, onChange, children}: ColorpickerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const childRef = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)
  const [open, setOpen] = useState(false)

  const handleColorpickerClick = useCallback(() => {
    setShow(true)
    setOpen(true)
  }, [])

  const handleColorSketchChange = useCallback((value) => {
    onChange(value)
  }, [])

  const handleClick = useCallback((event) => {
    if (!childRef.current!.contains(event.target)) {
      setOpen(false)
    }
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
        className={css.Colorpicker}
        onClick={handleColorpickerClick}
      >
        {children}
      </div>
      {show && createPortal(
        <ColorSketch
          value={value}
          onChange={handleColorSketchChange}
          open={open}
          positionElement={ref.current!}
          childRef={childRef}
        />, document.body)}
    </>
  )
}

interface ColorSketchProps {
  value: string
  onChange: (value: any) => void
  open: boolean
  positionElement: HTMLDivElement
  childRef: React.RefObject<HTMLDivElement>
}

function ColorSketch ({
  open,
  positionElement,
  onChange,
  value,
  childRef
}: ColorSketchProps) {
  const ref = childRef

  useEffect(() => {
    const menusContainer = ref.current!
    if (open) {
      const positionElementBct = positionElement.getBoundingClientRect()
      const menusContainerBct = ref.current!.getBoundingClientRect()
      const totalHeight = window.innerHeight || document.documentElement.clientHeight
      const top = positionElementBct.top + positionElementBct.height
      const right = positionElementBct.left + positionElementBct.width
      const letf = right - menusContainerBct.width
      const bottom = top + menusContainerBct.height

      if (bottom > totalHeight) {
        // 目前判断下方是否超出即可
        // 向上
        menusContainer.style.top = (positionElementBct.top - menusContainerBct.height) + 'px'
      } else {
        menusContainer.style.top = top + 'px'
      }

      // menusContainer.style.width = positionElementBct.width + 'px'
      menusContainer.style.left = letf + 'px'
      menusContainer.style.visibility = 'visible'
    } else {
      menusContainer.style.visibility = 'hidden'
    }
  }, [open])

  return (
    <div ref={ref} className={css.colorSketch}>
      <Sketch
        color={value}
        onChange={onChange}
      />
    </div>
  )
}