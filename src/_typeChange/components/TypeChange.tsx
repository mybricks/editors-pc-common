import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  useLayoutEffect
} from 'react'

import { Con } from './Con' 
import { ToRender } from './ToRender'
import { FromRender } from './FromRender'
import { XPATH_ARRAY } from '../constants'
import { transScript, getPosition, getTypeTitleBySchema } from '../utils'

import type {
  Mover,
  ConAry,
  FocusCon,
  TypeChangeProps,
  RefContextAsType,
  MoverContextAsType,
  ConAryContextAsType,
  FocusConContextAsType,
  HoverFromXpathContextAsType
} from '../types'

import css from './TypeChange.less'

export const RefContext = createContext({} as RefContextAsType)
export const MoverContext = createContext({} as MoverContextAsType)
export const ConAryContext = createContext({} as ConAryContextAsType)
export const FocusConContext = createContext({} as FocusConContextAsType)
export const HoverFromXpathContext = createContext({} as HoverFromXpathContextAsType)

export function TypeChange ({
  conAry: defaultConAry,
  toSchema,
  fromSchema,
  onComplete
}: TypeChangeProps) {
  const toRef = useRef<HTMLDivElement>(null)
  const fromRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const [refState] = useState({
    toRef,
    fromRef,
    scrollRef,
    contentRef
  })
  const [showCons, setShowCons] = useState(false)
  const [mover, setMover] = useState<Mover>(void 0)
  const [focusCon, setFocusCon] = useState<FocusCon>(void 0)
  const [conAry, setConAry] = useState<ConAry>(defaultConAry)
  const [hoverFromXpath, setHoverFromXpath] = useState<string | undefined>(void 0)

  const blur = useCallback(() => {
    setFocusCon(void 0)
  }, [])

  const finishMover = useCallback(() => {
    if (hoverFromXpath !== void 0 && !conAry?.find((con) => con.from === hoverFromXpath && con.to === mover!.xpath)) {
      const finalConAry = conAry?.filter((con) => {
        if (con.to !== mover!.xpath) {
          return true
        }
      }) || []

      finalConAry.push({
        from: hoverFromXpath,
        to: mover!.xpath
      })

      setConAry(finalConAry)
    }

    setMover(void 0)
  }, [mover])

  const delFocusCon = useCallback(() => {
    if (focusCon) {
      setConAry(conAry!.filter((con) => {
        return con.from !== focusCon.fromXpath || con.to !== focusCon.toXpath
      }))
    }
  }, [focusCon])
  
  const handleConfirmClick = useCallback(() => {
    if (conAry && conAry.length > 0) {
      // let script = transScript.toString()
      let script = transScript

      script = script.replaceAll(`__XPATH_ARRAY__`, XPATH_ARRAY)
      script = script.replaceAll(/['"]__cons__['"]/gi, JSON.stringify(conAry))
      script = script.substring(script.indexOf(`return`) + 7, script.length - 1)
      script = script.replaceAll(/['"]__toSchema__['"]/gi, JSON.stringify(toSchema))
      
      onComplete({
        title: `${getTypeTitleBySchema(fromSchema)} > ${getTypeTitleBySchema(toSchema)}`,
        conAry,
        script
      })
    } else {
      onComplete()
    }
  }, [conAry])

  const description: JSX.Element = useMemo(() => {
    return (
      <div className={css.desc}>
        <p style={{fontStyle: 'normal'}}>[使用说明]</p>
        <p>1.拖动右侧的字段（控制点）与左侧的字段相连接，完成从输入到输出的转换.</p>
        <p>2.点击连线，在弹出的菜单中可以完成删除等各类操作.</p>
      </div>
    )
  }, [])

  useLayoutEffect(() => {
    setShowCons(true)
  }, [])

  return (
    <div className={css.editor} onClick={blur}>
      <div className={css.toolbar}>
        <button onClick={handleConfirmClick}>确定</button>
      </div>
      <RefContext.Provider value={refState}>
        <MoverContext.Provider value={{mover, setMover, finishMover}}>
          <ConAryContext.Provider value={{conAry, setConAry}}>
            <FocusConContext.Provider value={{focusCon, setFocusCon, delFocusCon}}>
              <HoverFromXpathContext.Provider value={{hoverFromXpath, setHoverFromXpath}}>
                <div className={css.content} ref={contentRef}>
                  <div className={css.scroll} ref={scrollRef}>
                    <div className={css.from} ref={fromRef}>
                      <FromRender schema={fromSchema} />
                    </div>
                    <div className={css.to} ref={toRef}>
                      <ToRender schema={toSchema}/>
                    </div>
                    {showCons && <Cons />}
                  </div>
                </div>
              </HoverFromXpathContext.Provider>
            </FocusConContext.Provider>
          </ConAryContext.Provider>
        </MoverContext.Provider>
      </RefContext.Provider>
      {description}
    </div>
  )
}

function Cons() {
  const { mover } = useContext(MoverContext)
  const { conAry, setConAry } = useContext(ConAryContext)
  const {
    toRef,
    fromRef,
    scrollRef,
    contentRef
  } = useContext(RefContext)

  const moverStyle = useMemo(() => {
    const style: {[key: string]: any} = {}

    if (mover) {
      const po = getPosition(scrollRef.current!)
      const st = contentRef.current!.scrollTop

      style.display = ''
      style.left = mover.x - po.x
      style.top = mover.y - po.y

      if (style.top - st < 0) {
        contentRef.current!.scrollTop = st - 20
      } else {
        if ((style.top - st + 30) > contentRef.current!.offsetHeight) {
          contentRef.current!.scrollTop = st + 20
        }
      }
    } else {
      style.display = 'none'
    }

    return style
  }, [mover])

  useEffect(() => {
    if (conAry) {
      const ary: ConAry = []
      conAry.forEach((con) => {
        const fromEle = fromRef.current!.querySelector(`[data-xpath='${con.from}']`) as HTMLElement
        const toEle = toRef.current!.querySelector(`[data-xpath='${con.to}']`) as HTMLElement
  
        if (fromEle && toEle) {
          ary.push(con)
        }
      })
  
      if (ary.length !== conAry.length) {
        setConAry(ary)
      }
    }
  }, [])

  return (
    <div className={css.relations}>
      <svg>
        {
          conAry?.map((con) => {
            return (
              <Con key={`${con.from}-${con.to}`} fromXpath={con.from} toXpath={con.to}/>  
            )
          })
        }
      </svg>
      <div className={css.mover} style={moverStyle}>
        {mover?.title}
      </div>
      <ConMenu />
    </div>
  )
}

function ConMenu() {
  const { focusCon, delFocusCon } = useContext(FocusConContext)

  return useMemo(() => {
    const style: {[key: string]: any} = {}

    if (focusCon) {
      style.display = 'block'
      style.left = focusCon.position.x
      style.top = focusCon.position.y
    }

    return (
      <div className={css.conMenu} style={style}>
        <div className={css.menuItem} onClick={delFocusCon}>删除</div>
      </div>
    )
  }, [focusCon])
}
