import React, {
  useMemo, 
  useState,
  useEffect,
  useCallback
} from "react";
import { Drawer } from "antd";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined"

import css from "./index.less";

function windowComlibsEdit () {
  return (window as any)["__comlibs_edit_"];
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

  if (!["[object String]", "[object Array]"].includes(schemaType)) return [];

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

export default function ({ editConfig }: any) {
  const { value, options } = editConfig;
  const { schema, type } = options;

  const TypeRender = useMemo(() => {
    if (type === "add") {
      return <TypeAdd value={value} schema={schema}/>;
    } else {
      return <TypeSelect value={value} schema={schema}/>;
    }
  }, [])

  return (
    <div className={css.container}>
      {TypeRender}
    </div>
  );
}

function ComSelectView ({onClick, show, schema}: any): JSX.Element {
  if (!show) return <></>;

  const componentOptions = getComponentsWithSchema(schema);

  return (
    <Drawer
      className={css.drawer}
      width={440}
      bodyStyle={{
        borderLeft: '1px solid #bbb',
        backgroundColor: '#F7F7F7',
        padding: 5,
      }}
      visible={show}
      closable={false}
      mask={false}
      placement="right"
      // @ts-ignore
      getContainer={() =>
        document.querySelector('div[class^="lyStage-"]') ||
        document.querySelector('#root div[class^="sketchSection"]')
      }
      style={{ position: 'absolute' }}
    >
      <div className={css.coms}>
        {componentOptions.map((componentOption: any) => {
          const { title, icon, preview } = componentOption;

          return (
            <div
              className={css.item}
              onClick={() => onClick(componentOption)}
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
    </Drawer>
  );
}

function TypeSelect ({value, schema}: any): JSX.Element {
  const [componentSelectViewOpen, setComponentSelectViewOpen] = useState(false);
  const [selectedComponentInfo, setSelectedComponentInfo] = useState(null);

  const ComponentBox = useMemo(() => {
    if (!selectedComponentInfo) {
      return <div>点击选择组件</div>;
    }

    const { icon, title, preview } = selectedComponentInfo as {icon?: string, title?: string, preview?: string};

    return <RenderImg icon={icon} title={title} preview={preview}/>
  }, [selectedComponentInfo]);

  const setComponentNamespace = useCallback((ComponentInfo) => {
    const { namespace } = ComponentInfo;

    value.set(namespace);
    setSelectedComponentInfo(ComponentInfo);
    setComponentSelectViewOpen(false);
  }, []);

  const deleteComponentNamespace = useCallback(() => {
    value.set("");
    setSelectedComponentInfo(null);
  }, []);

  const switchComponentSelectView = useCallback(() => {
    setComponentSelectViewOpen(!componentSelectViewOpen);
  }, [componentSelectViewOpen]);

  const DeleteComponentIcon = useMemo(() => {
    if (!selectedComponentInfo) return <></>;

    return (
      <div
        className={css.delete}
        onClick={deleteComponentNamespace}
      >
        <DeleteOutlined/>
      </div>
    )
  }, [selectedComponentInfo]);

  const RenderComSelectView = useMemo(() => {
    if (!componentSelectViewOpen) return <></>;

    return <ComSelectView show={componentSelectViewOpen} schema={schema} onClick={setComponentNamespace}/>
  }, [componentSelectViewOpen]);

  useEffect(() => {
    const namespace = value.get();

    getComponentWithNamespace(namespace).then((r: any) => {
      setSelectedComponentInfo(r);
    });
  }, []);

  return (
    <div className={css.action}>
      <div
        className={css.tplWrapper}
        onClick={switchComponentSelectView}
      >
        {ComponentBox}
      </div>
      {DeleteComponentIcon}
      {RenderComSelectView}
    </div>
  )
}

function TypeAdd ({value, schema}: any) {
  const [componentSelectViewOpen, setComponentSelectViewOpen] = useState(false);

  const setComponentNamespace = useCallback((ComponentInfo) => {
    const { namespace } = ComponentInfo;

    value.set(namespace);
    setComponentSelectViewOpen(false);
  }, []);

  const switchComponentSelectView = useCallback(() => {
    setComponentSelectViewOpen(!componentSelectViewOpen);
  }, [componentSelectViewOpen]);

  const RenderComSelectView = useMemo(() => {
    if (!componentSelectViewOpen) return <></>;

    return <ComSelectView show={componentSelectViewOpen} schema={schema} onClick={setComponentNamespace}/>
  }, [componentSelectViewOpen])

  const AddButton = useMemo(() => {
    return <button className={css.button} onClick={switchComponentSelectView}>点击选择组件</button>;
  }, []);

  return (
    <>
      {AddButton}
      {RenderComSelectView}
    </>
  );
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
