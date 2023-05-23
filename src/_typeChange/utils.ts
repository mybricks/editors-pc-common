import {
  XPATH_ARRAY,
  SCHEMA_TYPE_TO_STYLE,
  SCHEMA_TYPE_TO_CHINESE_MAP
} from './constants'

import type { Schema, SchemaType } from './types'

export function getTypeTitleBySchema(schema: Schema) {
  const { type } = schema
  let title = SCHEMA_TYPE_TO_CHINESE_MAP[type]

  switch (type) {
    case 'object':
      title = `${schema.properties ? '' : '任意'}` + title
      break
    case 'array':
      title = `${schema.items ? '' : '任意'}` + title
      break
    default:
      break
  }

  return title
}

export function ifTypeObjMatch(schema0: Schema, schema1: Schema) {
  if (schema0.type === 'object' && schema1.type === 'object') {
    const pro0 = schema0.properties
    const pro1 = schema1.properties

    if (pro0 && (pro1 === void 0 || pro1 && Object.keys(pro1).length === 0)) {
      return true
    }

    if (!pro0 || !pro1) {
      return false
    }

    const pk0 = Object.keys(pro0)
    const pk1 = Object.keys(pro1)
    if (pk0.sort().toString() === pk1.sort().toString()) {
      if (pk0.find(key => {
        return pro0[key].type !== pro1[key].type
      })) {
        return false
      } else {
        return true
      }
    }
  }

  return false
}

export function isTypeEqual(schema0: Schema, schema1: Schema) {
  if (schema0.type === schema1.type) {
    if (schema0.type === 'object') {
      if (!ifTypeObjMatch(schema0, schema1)) {
        return false
      }
    } else if (schema0.type === 'array') {
      if (!isTypeAryMatch(schema0, schema1)) {
        return false
      }
    }
    return true
  }
  return false
}

export function isTypeMatch(schema0: Schema, schema1: Schema) {
  if (isTypeEqual(schema0, schema1)) {
    return true
  } else if (schema1.type === 'any') {
    return true
  } else if (schema0.type === 'boolean') {
    if (schema1.type.match(/number|string/gi)) {
      return true
    } else {
      return false
    }
  } else if (schema0.type === 'number') {
    if (schema1.type.match(/boolean|string/gi)) {
      return true
    } else {
      return false
    }
  } else if (schema0.type === 'string') {
    if (schema1.type.match(/boolean/gi)) {
      return true
    } else {
      return false
    }
  } else {
    return false
  }
}

export function getAutoChangeScript(schema0: Schema, schema1: Schema) {
  if (isTypeEqual(schema0, schema1) || schema1.type === 'any') {
    return `
      function(val){
         return val
      }
    `
  } else {
    if (schema0.type === 'string') {
      switch (schema1.type) {
        case 'boolean': {
          return `function(val){
            return true
          }`
        }
        default: {
          return
        }
      }
    } else if (schema0.type === 'number') {
      switch (schema1.type) {
        case 'string': {
          return `function(val){
            return String(val)
          }`
        }
        case 'boolean': {
          return `function(val){
            return val>0
          }`
        }
        default: {
          return
        }
      }
    } else if (schema0.type === 'boolean') {
      switch (schema1.type) {
        case 'string': {
          return `function(val){
            return val?'true'|'false'
          }`
        }
        case 'number': {
          return `function(val){
            return val?1:0
          }`
        }
        default: {
          return
        }
      }
    } else {
      return
    }
  }
}

export function isXpathMatch(xpath0: string, xpath1: string) {
  if (xpath0.endsWith('/[key]')&&!xpath1.endsWith('/[key]')) {
    return false
  }
  if (!xpath0.endsWith('/[key]')&&xpath1.endsWith('/[key]')) {
    return false
  }
  if (xpath0.endsWith('/[value]')&&!xpath1.endsWith('/[value]')) {
    return false
  }
  if (!xpath0.endsWith('/[value]')&&xpath1.endsWith('/[value]')) {
    return false
  }

  const ia0 = xpath0.indexOf(XPATH_ARRAY), ia1 = xpath1.indexOf(XPATH_ARRAY)

  if (ia0 < 0 && ia1 < 0) {
    return true
  }

  const i0 = xpath0.indexOf(XPATH_ARRAY), i1 = xpath1.indexOf(XPATH_ARRAY)
  if (i0 >= 0) {
    if (i1 < 0) {
      return false
    } else {
      const sub0 = xpath0.substring(i0 + XPATH_ARRAY.length)
      const sub1 = xpath1.substring(i1 + XPATH_ARRAY.length)

      if (isXpathMatch(sub0, sub1)) {
        return true
      } else {
        return false
      }
    }
  } else if (i1 >= 0) {
    return false
  }

  const ary0 = xpath0.split('/'), ary1 = xpath1.split('/')
  const notFoundArray = ary0.find((now, idx) => {
    if (now === XPATH_ARRAY) {
      if (ary1[idx] !== XPATH_ARRAY) {
        return true
      }
    }
  })

  if (notFoundArray) {
    return false
  }

  return true
}

export function isTypeAryMatch(schema0: Schema, schema1: Schema) {
  if (schema0.type === 'array' && schema1.type === 'array') {
    const item0 = schema0.items
    const item1 = schema1.items

    if (item0 && item1 === void 0) {
      return true
    }

    if (!item0 || !item1) {
      return false
    }

    return isTypeMatch(item0, item1)
  } else {
    return false
  }
}

export function getPinTypeStyle(type: SchemaType) {
  return SCHEMA_TYPE_TO_STYLE[type || 'unknown']
}

export function getPosition(element: HTMLElement, relativeDom?: HTMLElement) {
  if (relativeDom) {
    let currPo = element.getBoundingClientRect()
    let targetPo = relativeDom.getBoundingClientRect()

    return {
      x: currPo.left - targetPo.left,
      y: currPo.top - targetPo.top,
      w: element.offsetWidth,
      h: element.offsetHeight
    }
  } else {
    const po = element.getBoundingClientRect()
    return {
      x: po.left,
      y: po.top,
      w: element.offsetWidth,
      h: element.offsetHeight
    }
  }
}

export function drag(
  e: React.MouseEvent<HTMLElement, MouseEvent>,
  cb: (
    arg0: {
      po: {x: number, y: number}
      epo: {ex: number, ey: number}
      dpo: {dx: number, dy: number}
      adpo: {adx: number, ady: number}
      targetStyle: {x: number, y: number, w: number, h: number}
    },
    arg2: 'start' | 'moving' | 'finish',
    arg3: HTMLElement
  ) => void
) {
  const dom = e.currentTarget
  const w = dom.offsetWidth
  const h = dom.offsetHeight
  const po = getPosition(dom)
  const parentPo = {x: 0, y: 0}

  let odx = e.pageX - po.x, ody = e.pageY - po.y
  let x = 0, y = 0, ex = 0, ey = 0
  let state = ''

  function handleMouseMove(e: React.MouseEvent<HTMLElement, MouseEvent>) {
    const adx = e.pageX - odx, ady = e.pageY - ody
    const dx = adx - x, dy = ady - y

    x = e.pageX - odx
    y = e.pageY - ody
    ex = e.pageX - parentPo.x
    ey = e.pageY - parentPo.y

    if(state ==='finish'){
      cb(
        {
          po: {x, y},
          epo: {ex, ey},
          dpo: {dx:0, dy:0},
          adpo: {adx, ady},
          targetStyle: {
            x: po.x,
            y: po.y,
            w,
            h
          }
        },
        state,
        dom
      )
    }else{
      if (dx != 0 || dy != 0) {
        cb(
          {
            po: {x, y},
            epo: {ex, ey},
            dpo: {dx, dy},
            adpo: {adx, ady},
            targetStyle: {
              x: po.x,
              y: po.y,
              w,
              h
            }
          },
          state = state ? 'moving' : 'start',
          dom
        )
      }
    }
  }

  let moving = false

  document.onmousemove = (e: any) => {
    if (!moving) {
      moving = true
    }
    try {
      handleMouseMove(e)
    } catch (ex) {
      console.error(ex)
    }
  }

  document.onmouseup = (e: any) => {
    try {
      if (state) {
        state = 'finish'
        handleMouseMove(e)
      }
    } catch (ex) {
      throw ex
    } finally {
      document.onmousemove = null
      document.onmouseup = null
    }
  }
}

export function eventOperation (callback: Function) {
  function fn(event: Event) {
    callback && callback(event)
  }

  fn.stop = function (event: Event) {
    if (typeof event.stopPropagation === 'function') {
      event.stopPropagation()
    } else {
      // TODO?
      // @ts-ignore
      const fn = event.evt?.stopPropagation

      if (typeof fn === 'function') {
        fn()
        event.cancelBubble = true
      }
    }

    fn(event)
  } as unknown as React.MouseEventHandler

  return fn
}

// TODO: script 模版
export function transScript() {
  return function (oriVal) {
    const cons = '__cons__'
    const toSchema = '__toSchema__' as any

    function getValInFrom(xpath, fromVal) {
      const ary = xpath.split('/')
      let tv = fromVal
      ary.forEach(now => {
        if (now !== '') {
          if (tv === void 0 || typeof tv !== 'object' || Array.isArray(tv)) {
            throw new Error('Invalid datasource type in ' + xpath)
          }
          tv = tv[now]
        }
      })

      return tv
    }

    function transVal(val, schema) {
      if (schema.type.match(/object|array/)) {
        return val
      } else if (val === void 0 || val === null) {
        return val
      } else if (schema.type === 'boolean') {
        if (typeof val === 'boolean') {
          return val
        } else if (typeof val === 'number') {
          return !!val
        } else if (typeof val === 'string') {
          return true
        } else {
          return false
        }
      } else if (schema.type === 'number') {
        if (typeof val === 'number') {
          return val
        } else if (typeof val === 'boolean') {
          return val ? 1 : 0
        } else {
          return 0
        }
      } else if (schema.type === 'string') {
        if (typeof val === 'string') {
          return val
        } else if (typeof val == 'boolean' || typeof val == 'boolean') {
          return String(val)
        } else {
          return val
        }
      }
      return val
    }

    function proAry({key, schema, xpath}) {
      let con = cons.find(con => con.to === xpath)
      if (con) {
        //return getValInFrom(xpath, oriVal)///TODO Test
        return getValInFrom(con.from, oriVal)
      }

      let oriAryVal

      //if (items.type === 'object') {//found in sub type
      const nXpath = xpath + '/__XPATH_ARRAY__'
      con = cons.find(con => con.to === nXpath)
      if (con) {//直接对应的情况
        const fromAryPath = con.from.substring(0, con.from.lastIndexOf('/__XPATH_ARRAY__'))
        if (fromAryPath !== '') {
          oriAryVal = getValInFrom(fromAryPath, oriVal)
          if (oriAryVal && !Array.isArray(oriAryVal)) {
            throw new Error(con.from + ' is not array.')
          }

          return oriAryVal
        } else {//oriVal是数组的情况
          const rtn = []
          const tpath = con.from.substring('/__XPATH_ARRAY__'.length)
          oriVal.forEach(oriVal => {
            rtn.push(getValInFrom(tpath, oriVal))
          })

          return rtn
        }
      }

      const items = schema.items
      if (items.type === 'object') {//found in sub type
        const props = items.properties, keys = Object.keys(props)
        if (keys.length > 0) {
          keys.find(key => {
            const nXpath = xpath + '/__XPATH_ARRAY__/' + key
            const con = cons.find(con => con.to === nXpath)

            if (con) {
              const fromAryPath = con.from.substring(0, con.from.lastIndexOf('/__XPATH_ARRAY__'))
              oriAryVal = getValInFrom(fromAryPath, oriVal)

              if (oriAryVal && !Array.isArray(oriAryVal)) {
                throw new Error(con.from + ' is not array.')
              }
              return true
            } else {
              // debugger
              // throw new Error(nXpath + ' not found.')
            }
          })
        }

        if (oriAryVal) {
          const rtn = []
          oriAryVal.forEach(oriVal => {
            const tObj = {}
            for (let pro in props) {
              const nXpath = xpath + '/__XPATH_ARRAY__/' + pro
              const con = cons.find(con => con.to === nXpath)
              if (con) {
                const subPath = con.from.substring(con.from.lastIndexOf('/__XPATH_ARRAY__') + '/__XPATH_ARRAY__/'.length)
                const tVal = getValInFrom(subPath, oriVal)

                tObj[pro] = transVal(tVal, props[pro])
              } else {
                const nSchema = props[pro]
                if (nSchema.type === 'object') {
                  const tVal = proObj({schema: nSchema, xpath: nXpath, curValInAry: oriVal})
                  tObj[pro] = transVal(tVal, nSchema)
                } else if (nSchema.type === 'array') {
                  const tVal = proAry({schema: nSchema, xpath: nXpath})
                  tObj[pro] = transVal(tVal, nSchema)
                } else {
                  // debugger
                  // throw new Error(nXpath + ' not found.')
                }
              }
            }
            rtn.push(tObj)
          })

          return rtn
        }
      }
    }

    function proItem({schema, xpath}) {
      const con = cons.find(con => con.to === xpath)
      if (con) {
        const val = getValInFrom(con.from, oriVal)
        return transVal(val, schema)
      } else {
        //debugger
        throw new Error(xpath + ' not found')
      }
    }

    function proObj({key, schema, xpath, curValInAry}) {
      const obj = {}

      const con = cons.find(con => con.to === xpath)
      if (con) {//直接对应的情况
        const fromPath = con.from
        const oriAryVal = getValInFrom(fromPath, oriVal)
        if (oriAryVal && typeof oriAryVal !== 'object') {
          throw new Error(con.from + ' is not object.')
        }
        return oriAryVal
      }

      const props = schema.properties
      for (let nm in props) {
        const kv = props[nm]

        if (curValInAry) {
          const nXpath = xpath + '/' + nm
          const con = cons.find(con => con.to === nXpath)
          if (con) {
            const subPath = con.from.substring(con.from.lastIndexOf('/__XPATH_ARRAY__') + '/__XPATH_ARRAY__/'.length)
            const tVal = getValInFrom(subPath, curValInAry)

            obj[nm] = transVal(tVal, kv)
          } else {
            //debugger
            throw new Error(nXpath + ' not found')
          }
        } else {
          const nXpath = xpath + '/' + nm
          const con = cons.find(con => con.to === nXpath)
          let val
          if (con) {
            val = getValInFrom(con.from, oriVal)
            obj[nm] = transVal(val, kv)
          } else {
            if (kv.type === 'object') {
              const val = proObj({schema: kv, xpath: nXpath})
              obj[nm] = transVal(val, kv)
            } else if (kv.type === 'array') {
              const val = proAry({schema: kv, xpath: nXpath})
              obj[nm] = transVal(val, kv)
            } else {
              obj[nm] = transVal(undefined, kv)
            }
          }
        }
      }

      return obj
    }

    if (toSchema.type === 'object') {
      return proObj({schema: toSchema, xpath: ''})
    } else if (toSchema.type === 'array') {
      return proAry({schema: toSchema, xpath: ''})
    } else {
      return proItem({schema: toSchema, xpath: ''})
    }
  }
}