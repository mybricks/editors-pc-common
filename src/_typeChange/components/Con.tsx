import React, {
  useRef,
  useMemo,
  useContext,
  useCallback
} from 'react'

import { uuid } from '../../utils'
import { getPosition, eventOperation } from '../utils'
import { RefContext, FocusConContext } from './TypeChange'

import type { ConProps } from '../types'

import css from './Con.less'

export function Con ({fromXpath, toXpath}: ConProps) {
  const { toRef, fromRef, scrollRef } = useContext(RefContext)
  const { focusCon, setFocusCon } = useContext(FocusConContext)
  
  const lineRef = useRef<SVGPathElement>() as React.RefObject<SVGPathElement>
  
  const cid = useMemo(() => uuid(), [])

  const [fxy, txy, lines, borderColor] = useMemo(() => {
    const fromEle = fromRef.current!.querySelector(`[data-xpath='${fromXpath}']`) as HTMLElement
    const toEle = toRef.current!.querySelector(`[data-xpath='${toXpath}']`) as HTMLElement

    const fromPo = getPosition(fromEle, scrollRef.current!), toPo = getPosition(toEle, scrollRef.current!)
    const fxr = Math.round(fromPo.x + fromEle.offsetWidth / 2), fyr = Math.round(fromPo.y + fromEle.offsetHeight / 2), txr = Math.round(toPo.x), tyr = Math.round(toPo.y + 1)
    const fxy = [fxr, fyr]
    const txy = [txr - 10, tyr + Math.round(toEle.offsetHeight / 2) - 1.5]
    const half = [fxr+(txy[0]-fxr)/2,fyr+(txy[1]-fyr)/2]
    const lines = `M ${fxy.join(',')} C ${half[0]},${fyr} ${half[0]},${txy[1]} ${txy.join(',')} L ${txy.join(',')}`
    return [fxy, txy, lines, fromEle.style.borderColor]
  }, [])

  const focus = useCallback(() => {
    setFocusCon({
      id: cid,
      fromXpath,
      toXpath,
      position: {
        x: fxy[0] + Math.round(txy[0] - fxy[0]) / 2,
        y: Math.min(fxy[1], txy[1]) + Math.abs(txy[1] - fxy[1]) / 2 + 5,
      }
    })
  }, [])

  const key = useCallback(() => {
    return `${fromXpath}-${toXpath}`
  }, [fromXpath, toXpath])

  return lines ? (
    <>
      <defs>
        <marker
          id={key()}
          refX='6'
          refY='6'
          orient='auto'
          markerWidth='1'
          markerHeight='1'
          viewBox='0 0 12 12'
          markerUnits='strokeWidth'
        >
          <path d='M2,2 L10,6 L2,10 L2,2' style={{fill: borderColor}}/>
        </marker>
      </defs>
      <path
        ref={lineRef}
        className={`${css.bgLine}`}
        d={lines}
        fill={'none'}
        markerEnd={`url(#${key()})`}
        onClick={eventOperation(focus).stop}
      />
      <path
        d={lines}
        fill={'none'}
        style={{stroke: borderColor}}
        className={`${focusCon?.id === cid ? css.focus : ''}`}
      />
    </>
  ) : null
}
