import React, {
  useMemo,
  useState,
  useEffect,
  useContext,
  useCallback
} from 'react'

import {
  isTypeMatch,
  isXpathMatch,
  getPinTypeStyle,
  getTypeTitleBySchema
} from '../utils'
import {
  RefContext,
  MoverContext,
  ConAryContext,
  HoverFromXpathContext
} from './TypeChange'
import { XPATH_ARRAY } from '../constants'

import type {
  ProObjProps,
  ProAryProps,
  ProEnumProps,
  ProItemProps,
  FromRenderProps,
  ProIndexObjProps
} from '../types'

import css from './FromRender.less'

export function FromRender ({schema}: FromRenderProps) {
  const { mover } = useContext(MoverContext)

  return schema ? (
    <div className={`${css.schema} ${mover ? css.draging : ''}`}>
      <div className={css.tt}>从</div>
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
  const { toRef } = useContext(RefContext)
  const { mover } = useContext(MoverContext)
  const { conAry } = useContext(ConAryContext)
  const { setHoverFromXpath } = useContext(HoverFromXpathContext)

  const [matchMover, setMatchMover] = useState(false)
  const [hasCon, setHasCon] = useState(!!conAry?.find(con => con.from === xpath))

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

  const handleMouseOver = useCallback(() => {
    if (matchMover) {
      setHoverFromXpath(xpath)
     }
  }, [matchMover])

  const handleMouseOut = useCallback(() => {
    if (matchMover) {
      setHoverFromXpath(void 0)
    }
  }, [matchMover])

  useEffect(() => {
    if (mover) {
      if (isXpathMatch(xpath, mover.xpath)) {
        const toSchema = mover.schema

        if (isTypeMatch(val, toSchema)) {
          setMatchMover(true)
        } else {
          setMatchMover(false)
        }
      }
    } else {
      setMatchMover(false)
    }
  }, [mover])

  useEffect(() => {
    if (hasCon) {
      const toEle = toRef.current!.querySelector(`[data-xpath='${xpath}']`) as HTMLElement
      if (!toEle) {
        setHasCon(false)
      }
    }
  }, [])

  return (
    <div key={keyName} className={`${css.item} ${root ? css.rootItem : ''}`}>
      <div
        className={`${css.keyName} ${hasCon ? css.done : ''} ${matchMover ? css.match : ''}`}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
      >
        <span
          className={`${css.point}`}
          data-xpath={xpath}
          style={{
            borderColor: typeStyle.strokeColor,
            backgroundColor: typeStyle.strokeColor,
            visibility: hasCon ? 'visible' : 'hidden'
          }}
        />
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
