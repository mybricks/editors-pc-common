import React, {
  useMemo, 
  useState,
  useEffect,
  useCallback
} from 'react'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'

import css from './index.less'

function windowComlibsEdit () {
  return (window as any)['__comlibs_edit_']
}

async function getComponentWithNamespace (namespace: any) {
  return new Promise((resolve) => {
    if (!namespace) {
      resolve(null);
      return;
    };

    let rst;

    const comlibs = windowComlibsEdit();
    const cb = (com: any) => {
      const { comAray, namespace: comNamespace } = com;
      
      if (Array.isArray(comAray)) {
        return deepFind(comAray, cb)
      }

      if (namespace === comNamespace) {
        rst = com;
        return true;
      }

      return false;
    }

    comlibs.find((comlib: any) => {
      const { comAray } = comlib;
  
      return deepFind(comAray, cb);
    });

    resolve(rst);
  });
}

function deepFind(ary: any, cb: any) {
  return ary.find((item: any) => {
    return cb(item);
  })
}

/**
 * 组件库信息
 */
interface ComponentLibrary {
  /**
   * 唯一id
   */
  id: string

  /**
   * 标题
   */
  title: string

  /**
   * 版本号
   */
  version: string

  /**
   * 组件列表
   */
  comAray: Array<Component | ComponentsCollection>
}

interface Component {
  /**
   * 标题
   */
  title: string

  /**
   * 唯一命名空间
   */
  namespace: string

  /**
   * 图标
   */
  icon: string

  /**
   * 预览图
   */
  preview: string

  /**
   * 是否启用
   */
  enable?: boolean

  /**
   * 组件类型，不传就是ui组件
   */
  rtType?: 'js' | 'js-autorun'

  /**
   * ui组件用于匹配插槽可拖入和自身可被拖入的组件
   */
  schema?: string

  /**
   * 是否被隐藏（仍然可用）
   */
  visibility: boolean
}


interface ComponentsCollection {
  /**
   * 组件列表
   */
  comAray: Array<Component | ComponentsCollection>
}

type ShowComponentLibraries = Array<{
  /**
   * 标题
   */
  title: string

  /**
   * 版本
   */
  version: string

  /**
   * 组件列表
   */
  components: Array<Component>
}>

/**
 * 获取可展示的组件库列表
 */
function getComponentLibraries ({ schema, rtType }: { schema: Options['schema'], rtType: Options['rtType'] }): ShowComponentLibraries {
  const schemaType = Object.prototype.toString.call(schema);

  if (!['[object String]', '[object Array]', '[object Undefined]'].includes(schemaType)) return [];

  const componentLibraries = windowComlibsEdit();

  const result: any = []

  componentLibraries.forEach((componentLibrary: ComponentLibrary) => {
    const components = traverseComponents(componentLibrary, { schema, rtType })

    if (components.length) {
      result.push({
        title: componentLibrary.title,
        version: componentLibrary.version,
        components
      })
    }
  })

  return result
}

/**
 * 判断组件是否应该显示
 */
function showComponent(props: Component, { schema, rtType }: { schema: Options['schema'], rtType: Options['rtType'] }) {
  const {
    enable,
    rtType: comRtType,
    schema: comSchema,
    namespace,
    visibility
  } = props;

  let bool = false
  
  if (namespace) {
    // 非启用
    if (enable !== void 0 && enable === false) {
      return bool
    }
    // 启动但不展示的
    if (visibility !== void 0 && visibility === false) {
      return bool
    }
    // 全部组件
    if (!schema) {
      // 全部类型
      switch (rtType) {
        case 'js':
          // 计算组件
          if (comRtType?.startsWith(rtType)) {
            bool = true
          }
          break
        case 'ui':
          // ui组件
          if (!comRtType || comRtType.match(/vue|react/gi)) {
            bool = true
          }
          break
        default:
          // 所有组件
          bool = true
          break
      }
    } else {
      switch (rtType) {
        case 'js':
          if (comRtType?.startsWith(rtType)) {
            if (ifSlotSchemaMatch(schema, comSchema)) {
              bool = true
            }
          }
          break
        case 'ui':
          if (!comRtType || comRtType.match(/vue|react/gi)) {
            if (ifSlotSchemaMatch(schema, comSchema)) {
              bool = true
            }
          }
          break
        default:
          if (ifSlotSchemaMatch(schema, comSchema)) {
            bool = true
          }
          break
      }
    }
  }

  return bool
}

/**
 * 遍历组件库
 */
function traverseComponents(props: Component | ComponentsCollection, { schema, rtType }: { schema: Options['schema'], rtType: Options['rtType'] }, result: Array<Component> = []) {
  if ("comAray" in props) {
    const { comAray } = props
    if (Array.isArray(comAray)) {
      comAray.forEach((com) => {
        traverseComponents(com, { schema, rtType }, result)
      })
    }
  } else {
    if (showComponent(props, { schema, rtType })) {
      result.push(props)
    }
  }

  return result
}

/**
 * 功能:
 * -
 */
interface Options {
  /**
   * 选择类型
   * - add - 添加
   * - 其它 - 替换
   */
  type: string

  /**
   * 通过 namesapce 匹配可选的组件
   * - 不填写 全部组件
   */
  schema: string

  /**
   * 匹配可选组件类型
   * - js 计算组件
   * - ui ui组件
   * - 不填写 全部组件
   */
  rtType: string
}

type PopView = (title: string, fn: ({close}: {close: () => void}) => JSX.Element, options: {width: number, beforeEditView: boolean}) => void

interface EditConfig {
  options: Options
  popView: PopView
  value: {
    set: (value: string | null | Component) => void
    get: () => string | null | Component
  }
}

interface Props {
  editConfig: EditConfig
}

export default function (props: Props) {
  const render = useMemo(() => {
    const { options, popView, value } = props.editConfig
    const { schema, rtType} = options
    const componentLibraries = getComponentLibraries({schema, rtType: rtType || 'ui'})
    const handleClick = (component: Component | null) => {
      if (!rtType) {
        // TODO: 因为之前默认是取namesapce的，临时过渡
        value.set(component ? component.namespace : null)
      } else {
        value.set(component || null)
      }
    }
    
    let jsx = <></>

    switch (options.type) {
      case 'add':
        jsx = <AddComponent onClick={handleClick} popView={popView} componentLibraries={componentLibraries}/>
        break
      default:
        jsx = <SelectComponent defaultValue={value.get()} onClick={handleClick} popView={popView} componentLibraries={componentLibraries}/>
        break
    }

    return (
      <div className={css.container}>
        {jsx}
      </div>
    )
  }, [])

  return render
}

function CaretRightSvg() {
  return <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3732" width="16" height="16"><path d="M836.512 512l-648.992-512 0 1024 648.992-512z" p-id="3733"></path></svg>
}

// 步骤 1: 添加防抖函数
function debounce(func: any, delay: number) {
  let timeoutId: any;
  
  return function(...args: any) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

function PopView ({componentLibraries, onClick}: {componentLibraries: ShowComponentLibraries, onClick: (component: Component) => void}) {
  const [showComponentLibraries, setShowComponentLibraries] = useState(componentLibraries)
  const [componentLibraryOpenMap, setComponentLibraryOpenMap] = useState(componentLibraries.reduce((p, _c, index) => {
    p[index] = true
    return p
  }, {} as any))

  const searchInput = useMemo(() => {
    function handleSearchInputChange (e: React.ChangeEvent<HTMLInputElement>) {
      const value = e.target.value.toLowerCase()
      if (value) {
        const showComponentLibraries: ShowComponentLibraries = []
        componentLibraries.forEach(({ title, version, components }) => {
          const likeTitleComponents = components.filter(({title}) => {
            return title.toLowerCase().indexOf(value) !== -1
          })
          if (likeTitleComponents.length) {
            showComponentLibraries.push({
              title,
              version,
              components: likeTitleComponents
            })
          }
        })
        setShowComponentLibraries(showComponentLibraries)
      } else {
        setShowComponentLibraries(componentLibraries)
      }
    }
    const debouncedHandleInputChange = debounce(handleSearchInputChange, 300);
    return (
      <div className={css.search}>
        <svg viewBox='0 0 1057 1024' version='1.1' xmlns='http://www.w3.org/2000/svg' p-id='6542' width='16' height='16'><path d='M835.847314 455.613421c0-212.727502-171.486774-385.271307-383.107696-385.271307C241.135212 70.35863 69.648437 242.869403 69.648437 455.613421c0 212.760534 171.486774 385.271307 383.091181 385.271307 109.666973 0 211.769567-46.525883 283.961486-126.645534a384.891436 384.891436 0 0 0 99.14621-258.625773zM1045.634948 962.757107c33.560736 32.421125-14.583725 83.257712-48.144461 50.853103L763.176429 787.28995a449.79975 449.79975 0 0 1-310.436811 123.953408C202.735255 911.243358 0 707.269395 0 455.613421S202.735255 0 452.739618 0C702.760497 0 905.495752 203.957447 905.495752 455.613421a455.662969 455.662969 0 0 1-95.330989 279.716846l235.486702 227.42684z' p-id='6543'></path></svg>
        <input placeholder='搜索' onChange={debouncedHandleInputChange} autoFocus/>
      </div>
    )
  }, [])

  function componentLibraryHeaderClick(index: number) {
    setComponentLibraryOpenMap({
      ...componentLibraryOpenMap,
      [index]: !componentLibraryOpenMap[index]
    })
  }

  return (
    <>
      <div className={css.popToolbar}>
        {searchInput}
      </div>
      <div className={css.popView}>
        <div className={css.list}>
          {showComponentLibraries?.length ? showComponentLibraries.map(({ title, version, components }, index) => {
            const open = componentLibraryOpenMap[index]
            return (
              <div key={index} className={css.comlib}>
                <div className={css.header} onClick={() => componentLibraryHeaderClick(index)}>
                  <div className={`${css.title}${open ? ` ${css.open}` : ''}`}>
                    <CaretRightSvg />
                    <span className={css.name}>{title}</span>
                    <span className={css.version}>({version})</span>
                  </div>
                </div>
                <div className={css.body} style={{display: open ? 'flex' : 'none'}}>
                  {components.map((component) => {
                    const { namespace, title, icon, preview } = component
                    return (
                      <div
                        key={namespace}
                        className={css.item}
                        onClick={() => onClick(component)}
                      >
                        <div style={{overflow: 'hidden'}}>
                          <div className={css.content}>
                            <RenderImg icon={icon} title={title} preview={preview}/>
                          </div>
                          <div className={css.itemTitle}>
                            {title}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          }) : <div className={css.noMatch}>没有匹配的组件</div>}
        </div>
      </div>
    </>
  )
}

function AddComponent ({onClick, popView, componentLibraries}: {onClick: ({ namespace }: Component) => void, popView: PopView, componentLibraries: ShowComponentLibraries}) {
  const handleClick = useCallback(() => {
    popView('选择组件', ({close}) => {
      return (
        <PopView
          componentLibraries={componentLibraries}
          onClick={(component: Component) => {
            onClick(component)
            close()
          }}
        />
      )
    }, {width: 380, beforeEditView: true})
  },[])

  return (
    <button onClick={handleClick}>添加组件</button>
  )
}

function SelectComponent ({defaultValue, onClick, popView, componentLibraries}: {defaultValue: string | null | Component,onClick: (arg0: Component | null) => void, popView: PopView, componentLibraries: ShowComponentLibraries}) {
  const [component, setComponent] = useState<Component | null>(null)

  const handleClick = useCallback(() => {
    popView('选择组件', ({close}) => {
      return (
        <PopView
          componentLibraries={componentLibraries}
          onClick={(component: Component) => {
            onClick(component)
            setComponent(component)
            close()
          }}
        />
      )
    }, {width: 380, beforeEditView: true})
  },[])

  const handleDeleteClick = useCallback(() => {
    onClick(null)
    setComponent(null)
  }, [])
  
  const componentBox = useMemo(() => {
    let jsx = <div>点击选择组件</div>

    if (component) {
      jsx = <RenderImg {...component}/>
    }
    
    return (
      <>
        <div className={css.box} onClick={handleClick}>
          {jsx}
        </div>
        <div
          className={css.delete}
          style={{visibility: component ? 'visible' : 'hidden'}}
          onClick={handleDeleteClick}
        >
          <DeleteOutlined/>
        </div>
      </>
    )
  }, [component])

  useEffect(() => {
    if (defaultValue) {
      getComponentWithNamespace(typeof defaultValue === 'string' ? defaultValue : defaultValue.namespace).then((component) => {
        setComponent(component as Component)
      })
    }
  }, [])

  return (
    <div className={css.selectContainer}>
      {componentBox}
    </div>
  )
}

function ifSlotSchemaMatch(parentSchema: string | string[], comSchema?: string): boolean {
  if (parentSchema || comSchema) {
    if (!(parentSchema && comSchema)) {
      return false;
    }

    if (Array.isArray(comSchema)) {
      if (comSchema.find(sc => {
        const sChild = sc.toLowerCase();
        if (Array.isArray(parentSchema)) {
          return parentSchema.find(ps => ifSlotSchemaMatch(ps.toLowerCase(), sChild))
        }
        return (ifSchemaMatch(parentSchema.toLowerCase(), sChild))
      })) {
        return true
      }
    } else if (typeof comSchema === 'string') {
      const sChild = comSchema.toLowerCase();
      if (Array.isArray(parentSchema)) {
        return !!parentSchema.find(ps => ifSlotSchemaMatch(ps.toLowerCase(), sChild))
      }
      return ifSchemaMatch(parentSchema.toLowerCase(), sChild)
    }
    return false
  }

  return true;
}

function ifSchemaMatch(sParent: string, sChild: string) {
  if (sParent === sChild) {
    return true
  } else {
    let ti = sParent.endsWith('*') ? sParent.length - 1 : 0;
    if (ti > 0) {
      sParent = sParent.substring(0, ti);
    }

    ti = sChild.endsWith('*') ? sChild.length - 1 : 0;
    if (ti > 0) {
      sChild = sChild.substring(0, ti);
    }

    return sChild.startsWith(sParent);
  }
}

function RenderImg ({icon = '', title = '', preview = ''}: any): JSX.Element {
  let jsx = <div className={css.comIconFallback}>{title?.substr(0, 1)}</div>
  if (icon) {
    if (!(icon === './icon.png' || !/^(https:)/.test(icon)) || icon.startsWith('data:image/')) {
      jsx = (
        <div
          className={css.img}
          style={{backgroundImage: `url(${icon})`, width: 24, height: 24}}
        />
      )
    }
  }

  if (preview) {
    if (!(preview === './preview.png' || !/^(https:)/.test(preview))) {
      jsx = (
        <div
          className={css.img}
          style={{backgroundImage: `url(${preview})`}}
        />
      )
    }
  }

  return jsx;
}
