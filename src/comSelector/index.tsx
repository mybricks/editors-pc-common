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

function getComponentsWithSchema (schema: string | string[]): string[] {
  const schemaType = Object.prototype.toString.call(schema);

  if (!['[object String]', '[object Array]'].includes(schemaType)) return [];

  const comlibs = windowComlibsEdit();
  const rst: string[] = [];
  const cb = (com: any) => {
    const {
      enable,
      rtType,
      schema: comSchema,
      comAray,
      namespace,
      visibility
    } = com;
    
    if (Array.isArray(comAray)) {
      return deepFind(comAray, cb)
    } else if (namespace) {
      // 非启用
      if (enable !== void 0 && enable === false) {
        return
      }
      // 启动但不展示的
      if (visibility !== void 0 && visibility === false) {
        return
      }
      // ui组件
      if (!rtType || rtType.match(/vue|react/gi)) {
        if (ifSlotSchemaMatch(schema, comSchema)) {
          rst.push(com);
        }
      }
    }
  }

  comlibs.forEach((comlib: any) => {
    const { comAray } = comlib;

    return deepFind(comAray, cb);
  });

  return rst;
}

interface Options {
  type: string
  schema: string
}

type PopView = (title: string, fn: ({close}: {close: () => void}) => JSX.Element, options: {width: number, beforeEditView: boolean}) => void

interface EditConfig {
  options: Options
  popView: PopView
  value: {
    set: (namespace: string | null) => void
    get: () => string | null
  }
}

interface Props {
  editConfig: EditConfig
}

interface Component {
  title: string
  namespace: string
  icon: string
  preview: string
}

type Components = Component[]

export default function (props: Props) {
  const render = useMemo(() => {
    const { options, popView, value } = props.editConfig
    const components = getComponentsWithSchema(options.schema)
    const handleClick = (component: Component | null) => {
      value.set(component ? component.namespace : null)
    }
    
    let jsx = <></>

    switch (options.type) {
      case 'add':
        jsx = <AddComponent onClick={handleClick} popView={popView} components={components}/>
        break
      default:
        jsx = <SelectComponent defaultValue={value.get()} onClick={handleClick} popView={popView} components={components}/>
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

function PopView ({components, onClick}: {components: Components, onClick: (component: Component) => void}) {
  const [list, setList] = useState(components)

  const handleSearchInputChange = useCallback((e) => {
    const value = e.target.value.toLowerCase()

    if (!value) {
      setList(components)
    } else {
      setList(components.filter(({title}) => {
        return title.toLowerCase().indexOf(value) !== -1
      }))
    }
  }, [])

  const searchInput = useMemo(() => {
    return (
      <div className={css.search}>
        <svg viewBox='0 0 1057 1024' version='1.1' xmlns='http://www.w3.org/2000/svg' p-id='6542' width='16' height='16'><path d='M835.847314 455.613421c0-212.727502-171.486774-385.271307-383.107696-385.271307C241.135212 70.35863 69.648437 242.869403 69.648437 455.613421c0 212.760534 171.486774 385.271307 383.091181 385.271307 109.666973 0 211.769567-46.525883 283.961486-126.645534a384.891436 384.891436 0 0 0 99.14621-258.625773zM1045.634948 962.757107c33.560736 32.421125-14.583725 83.257712-48.144461 50.853103L763.176429 787.28995a449.79975 449.79975 0 0 1-310.436811 123.953408C202.735255 911.243358 0 707.269395 0 455.613421S202.735255 0 452.739618 0C702.760497 0 905.495752 203.957447 905.495752 455.613421a455.662969 455.662969 0 0 1-95.330989 279.716846l235.486702 227.42684z' p-id='6543'></path></svg>
        <input placeholder='搜索' onChange={handleSearchInputChange} autoFocus/>
      </div>
    )
  }, [])

  const componentList = useMemo(() => {
    return (
      <div className={css.list}>
        {list.map((component) => {
          const { namespace, title, icon, preview } = component;
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
    )
  }, [list])

  return (
    <>
      <div className={css.popToolbar}>
        {searchInput}
      </div>
      <div className={css.popView}>
        {componentList}
      </div>
    </>
  )
}

function AddComponent ({onClick, popView, components}: {onClick: ({ namespace }: Component) => void, popView: PopView, components: any[]}) {
  const handleClick = useCallback(() => {
    popView('选择组件', ({close}) => {
      return (
        <PopView
          components={components}
          onClick={(component: Component) => {
            onClick(component)
            close()
          }}
        />
      )
    }, {width: 350, beforeEditView: true})
  },[])

  return (
    <button onClick={handleClick}>添加组件</button>
  )
}

function SelectComponent ({defaultValue, onClick, popView, components}: {defaultValue: string | null,onClick: (arg0: Component | null) => void, popView: PopView, components: any[]}) {
  const [component, setComponent] = useState<Component | null>(null)

  const handleClick = useCallback(() => {
    popView('选择组件', ({close}) => {
      return (
        <PopView
          components={components}
          onClick={(component: Component) => {
            onClick(component)
            setComponent(component)
            close()
          }}
        />
      )
    }, {width: 350, beforeEditView: true})
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
    getComponentWithNamespace(defaultValue).then((component) => {
      setComponent(component as Component)
    })
  }, [])

  return (
    <div className={css.selectContainer}>
      {componentBox}
    </div>
  )
}

function ifSlotSchemaMatch(parentSchema: string | string[], comSchema: string): boolean {
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
    if (!(icon === './icon.png' || !/^(https:)/.test(icon))) {
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
