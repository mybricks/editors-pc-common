import React, {
  useMemo,
  useState,
  useEffect,
  useContext,
  useCallback
} from 'react'

import { XPATH_ARRAY } from '../constants'
import { useUpdateEffect } from '../../hooks'
import { RefContext, MoverContext, ConAryContext } from './TypeChange'
import { drag, getPinTypeStyle, getTypeTitleBySchema } from '../utils'

import type {
  ProObjProps,
  ProAryProps,
  ProEnumProps,
  ProItemProps,
  ToRenderProps,
  ProIndexObjProps
} from '../types'

import css from './ToRender.less'

export function ToRender ({schema}: ToRenderProps) {
  const { mover } = useContext(MoverContext)

  return schema ? (
    <div className={`${css.schema} ${mover ? css.draging : ''}`}>
      <div className={css.tt}>到</div>
      {['unknown', 'follow'].includes(schema.type) ? (
        <div className={css.invalid}>（无效的类型）</div>
      ) : (
        <ProItem val={schema} xpath={''} root={true}/>
      )}
    </div>
  ) : null
}

function ProItem({
  val,
  xpath,
  keyName,
  root = false
}: ProItemProps) {
  const { fromRef } = useContext(RefContext)
  const { conAry } = useContext(ConAryContext)
  const { setMover, finishMover } = useContext(MoverContext)

  const [hasCon, setHasCon] = useState()
  const [move, setMove] = useState(false)

  const childItem = useMemo(() => {
    let jsx = <></>

    switch (val.type) {
      case 'array':
        jsx = <ProAry items={val.items} xpath={xpath}/>
        break
      case 'object':
        jsx = <ProObj properties={val.properties} xpath={xpath}/>
        break
      case 'indexObject':
        jsx = <ProIndexObj properties={val.properties} xpath={xpath}/>
        break
      case 'enum':
        jsx = <ProEnum items={val.items}/>
        break
    }

    return jsx
  }, [])

  const typeStyle = useMemo(() => {
    return getPinTypeStyle(val.type)
  }, [])

  const [_hasCon, hasChildrenCon, hasParentCon] = useMemo(() => {
    if (!conAry) {
      return [void 0, void 0, void 0]
    }
    const hasCon = conAry.find(con => con.to === xpath)
    const hasChildrenCon = conAry.find(con => {
      if (!hasCon && con.to.indexOf(xpath + '/') === 0) {
        return true
      }
    })
    const hasParentCon = conAry.find(() => {
      if (!hasCon) {
        let tPath = ''
        const ary = xpath.split('/')
        const has = ary.find(now => {
          tPath += `/${now}`
          tPath = tPath.replace(/\/\//, '/')
          if (conAry.find(con => con.to === tPath)) {
            return true
          }
        })

        return has
      }
    })

    return [hasCon, hasChildrenCon, hasParentCon]
  }, [conAry])

  const handleMouseDown = useCallback((e) => {
    const point = e.target as HTMLElement

    drag(e, ({epo: {ex, ey}, dpo: {dx, dy}}, state) => {
      if (state == 'start') {
        point.style.visibility = 'hidden'
        setMover({
          x: ex + 3,
          y: ey - 14,
          title: keyName as string,
          schema: val,
          xpath
        })
        setMove(true)
      }
      if (state == 'moving') {
        setMover((mover) => {
          return {
            ...mover!,
            x: mover!.x + dx,
            y: mover!.y + dy
          }
        })
        setMove(true)
      }
      if (state == 'finish') {
        point.style.visibility = 'visible'
        setMove(false)
      }
    })
  }, [])

  useEffect(() => {
    setHasCon(hasCon)
    if (hasCon) {
      const fromEle = fromRef.current?.querySelector(`[data-xpath='${xpath}']`) as HTMLElement
      if (!fromEle) {
        setHasCon(void 0)
      }
    }
  }, [_hasCon])

  useUpdateEffect(() => {
    if (!move) {
      finishMover()
    }
  }, [move])

  return (
    <div key={keyName} className={`${css.item} ${root ? css.rootItem : ''}`}>
      <div data-xpath={xpath} className={`${css.keyName} ${hasCon ? css.done : ''}`}>
        {
          !hasCon && !hasChildrenCon && !hasParentCon ? (
            <span
              data-not-connect={1}
              className={`${css.point}`}
              style={{left: -7, top: 11, borderColor: typeStyle.strokeColor, backgroundColor: typeStyle.fillColor}}
              onMouseDown={handleMouseDown}
            />
          ) : null
        }
        {keyName}
        <span className={css.typeName} style={{color: typeStyle.strokeColor}}>
          ({getTypeTitleBySchema(val)})
        </span>
      </div>
      {childItem}
    </div>
  )
}


function ProAry({items, xpath}: ProAryProps) {
  return items ? <ProItem val={items} xpath={`${xpath}/${XPATH_ARRAY}`}/> : null
}

function ProObj({properties, xpath}: ProObjProps) {
  return properties ? (
    <>
      {
        Object.keys(properties).map(key => {
          return <ProItem key={key} val={properties[key]} xpath={`${xpath}/${key}`} keyName={key}/>
        })
      }
    </>
  ) : null
}

function ProIndexObj({properties, xpath}: ProIndexObjProps) {
  return properties ? (
    <>
      <ProItem val={properties['key']} xpath={`${xpath}/[key]`} keyName={'索引'}/>
      <ProItem val={properties['value']} xpath={`${xpath}/[value]`} keyName={'值'}/>
    </>
  ) : null
}

function ProEnum({items}: ProEnumProps) {
  return items ? (
    <>
      {
        items.map((item, idx) => {
          const { type, value } = item
          const style = getPinTypeStyle(type)
          const finalValue = item.type === 'string' ? `"${value}"` : value
      
          return (
            <div key={idx} className={`${css.item}`}>
              <div className={css.keyName}>
                {finalValue}
                <span className={css.typeName} style={{color: style.strokeColor}}>
                  ({getTypeTitleBySchema(item)})
                </span>
              </div>
            </div>
          )
        })
      }
    </>
  ) : null
}
