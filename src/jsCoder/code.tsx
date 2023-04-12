import React, {
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useState,
} from 'react';
import { isValid, safeDecodeURIComponent } from '../utils';
import { useObservable,useComputed, getPosition, dragable } from '@mybricks/rxui';
import { FullscreenOutlined } from '@ant-design/icons';
import MonacoEditor from '@mybricks/code-editor';
import { transformCodeByBabel } from './utils';
import css from './index.less';

const ICONS = {
  min: (
    <svg
      viewBox='0 0 1024 1024'
      version='1.1'
      xmlns='http://www.w3.org/2000/svg'
      p-id='6239'
      width='12'
      height='12'
    >
      <path
        d='M78.633918 396.690788l858.20393 0 0 158.309562-858.20393 0 0-158.309562Z'
        p-id='6240'
      ></path>
    </svg>
  ),
  recover: (
    <svg
      viewBox='0 0 1024 1024'
      version='1.1'
      xmlns='http://www.w3.org/2000/svg'
      p-id='3949'
      width='12'
      height='12'
    >
      <path
        d='M739.95130434 284.04869566v658.32336695H81.62793739V284.04869566h658.32336695m0.60787015-75.98376812H80.4121971c-41.33516985 0-75.37589797 33.43285797-75.37589797 75.37589797V943.5878029c0 41.33516985 33.43285797 75.37589797 75.37589797 75.37589797h660.14697739c41.33516985 0 75.37589797-33.43285797 75.37589797-75.37589797V283.44082551c0-41.94304-33.43285797-75.37589797-75.37589797-75.37589797z'
        p-id='3950'
        fill='#555555'
      ></path>
      <path
        d='M944.19567304 5.64416928H282.83295536c-41.33516985 0-74.16015768 33.43285797-74.76802782 74.16015768v77.1995084h75.98376812V81.62793739h658.32336695v658.32336695h-75.98376812V815.93507246H943.5878029c41.33516985 0 74.16015768-33.43285797 74.76802782-74.76802782V79.80432696c0-40.72729971-33.43285797-74.16015768-74.16015768-74.16015768z'
        p-id='3951'
        fill='#555555'
      ></path>
    </svg>
  ),
  close: (
    <svg
      viewBox='0 0 1024 1024'
      version='1.1'
      xmlns='http://www.w3.org/2000/svg'
      p-id='7239'
      width='12'
      height='12'
    >
      <path
        d='M426.1888 522.717867L40.004267 136.533333 136.533333 40.004267l386.184534 386.184533L908.9024 40.004267 1005.431467 136.533333 619.178667 522.717867l386.184533 386.184533-96.529067 96.529067L522.717867 619.178667 136.533333 1005.431467 40.004267 908.9024l386.184533-386.184533z'
        p-id='7240'
      ></path>
    </svg>
  ),
};

function getLinenumbers(str = '') {
  if (!str) return 0;
  return str.split(/\r|\n|\r\n/).length;
}
const languageMap: { [language: string]: string } = {
  jsx: 'javascript',
};

const getFnString = (fnBody: string, fnParams: string[]) => {
  return fnParams
    ? `export default function ({ ${fnParams.join(',')}}) {
      ${fnBody}
    }`
    : fnBody;
};

const appendToList = (list: any[], value: string) => {
  list[list.length - 1] = `${list[list.length - 1]}${value}`;
};

const getExtraLibBySchema = (schema: any) => {
  if (!schema) return '';
  const list = [`declare var inputValue`];

  const dfs = (schema: any, isArray = false) => {
    if (!schema) return;
    const { type } = schema;
    switch (type) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'any':
      case 'unknown':
        appendToList(list, `: ${type}${isArray ? '[]' : ''}`);
        break;
      case 'object':
        appendToList(list, `: {`);
        Object.keys(schema.properties || {}).forEach((key) => {
          list.push(`${key}`);
          dfs(schema.properties[key]);
        });
        list.push(`}${isArray ? '[]' : ''}`);
        break;
      case 'array':
        dfs(schema.items, true);
        break;
    }
  };

  const startParse = (schema: any) => {
    if (schema.type === 'object') {
      if (!schema.properties) {
        list[0] = `declare var inputValue: { [key: string]: any }`;
        return;
      }
      dfs(schema);
    } else if (schema.type === 'array') {
      if (!schema.items) {
        list[0] = `declare var inputValue: any[]`;
        return;
      }
      if (schema.items.type === 'object') {
        if (!schema.items.properties) {
          list[0] = `declare var inputValue: any[]`;
        }
      } else {
        list[0] = `declare var inputValue: ${schema.items.type}[];`;
        return;
      }
      dfs(schema.items, true);
    } else {
      return `declae var inputValue: ${schema.type}`;
    }
  };

  startParse(schema);

  return list.join(`\n`);
};

const formatValue = (val: string, options?: any) => {
  const { babel, fnParams } = options || {};
  const { presets: babelPresets } = babel || {};
  if (typeof val !== 'string') {
    return val;
  }
  if (!babel || !(window as any).Babel) {
    return encodeURIComponent(val);
  }
  try {
    return {
      ...transformCodeByBabel(
        encodeURIComponent(getFnString(val, fnParams)),
        {
          presets: babelPresets || ['env'],
        }
      ),
      code: encodeURIComponent(val),
    };
  } catch (e) {}
  return val;
};

export default function ({ editConfig, env }: any): JSX.Element {
  const { value, options = {}, spaCtx } = editConfig;
  const commentRef: any = useRef();
  const editorRef = useRef({});
  const [render, setRender] = useState(0);

  const forceRender = useCallback(() => setRender(Math.random()), []);

  const getVal = useComputed(() => {
    const val = value.get()
    return isValid(val)
      ? String(
        safeDecodeURIComponent(
          `${
            typeof val === 'string'
              ? val
              : val?.code || ''
          }`
        )
      )
      : '';
  })

  useEffect(() => {
    if (options.forceRender) {
      Object.defineProperty(options.forceRender, 'run', {
        get() {
          forceRender();
          return () => {};
        },
        configurable: true,
      });
    }
  }, []);

  // const schemaExtraLib = useMemo(() => {
  //   return getExtraLibBySchema(options.schema);
  // }, [options.schema]);

  const {
    language = 'javascript',
    comments = '',
    readonly,
    displayType,
    commentVisible = true,
    enableFullscreen = true,
  } = options;

  const model: any = useObservable({
    value,
    val: getVal,
    fullScreen: false,
    width: options.width,
    title: options.title || '编辑代码',
    commentHeight: comments ? 400 : 0,
    icon: 'min',
    iconsVisible: false,
  },[getVal]);

  const updateVal = useCallback(
    (val) => {
      model.value.set(formatValue(val, options));
    },
    []
  );

  const modalContext = useObservable({
    visible: false,
    commentVisible,
  });

  const onMounted = (monaco: any, editor: any) => {
    model.iconsVisible = true;
  };

  const onClose = () => {
    model.iconsVisible = false;
    modalContext.visible = false;
  };

  const onCommentIconClick = useCallback(() => {
    modalContext.commentVisible = !modalContext.commentVisible;
  }, []);

  const moveConsole = (evt: any) => {
    let { h } = getPosition(commentRef.current);
    dragable(evt, ({ dpo: { dy } }, state: any) => {
      if (state == 'moving') {
        model.commentHeight = h -= dy;
      }
    });
  };

  const onIconClick = (type: string) => {
    if (type === 'recover') {
      model.commentHeight = 0;
    } else {
      model.commentHeight = 400;
    }
    model.icon = type;
  };

  const onMonacoMounted = (editor: any) => {
    editorRef.current = editor;
  };

  const onFormatIconClick = useCallback(() => {
    editorRef.current?.getAction?.(['editor.action.formatDocument'])._run();
  }, [editorRef.current]);

  const renderToolbar = useMemo(() => {
    return (
      <div className={css['editor-code__modal-toolbar']}>
          <svg
            viewBox='0 0 1024 1024'
            version='1.1'
            xmlns='http://www.w3.org/2000/svg'
            p-id='3890'
            width='24'
            height='24'
            onClick={onFormatIconClick}
          >
            <path
              d='M541.141333 268.864l61.717334 16.938667-132.394667 482.474666-61.717333-16.938666 132.394666-482.474667zM329.002667 298.666667l44.885333 45.610666-175.36 172.586667 175.04 167.573333-44.266667 46.229334L106.666667 517.504 329.002667 298.666667z m355.882666 0l222.336 218.837333L684.586667 730.666667l-44.266667-46.229334 175.018667-167.573333L640 344.277333 684.885333 298.666667z'
              p-id='3891'
            ></path>
          </svg>
      </div>
    );
  }, []);

  const fnBodyRender = useCallback(
    (className: string) => {
      if (!options.fnParams) return null;
      const shouldFormatParams =
        options.fnParams.length > (modalContext.visible ? 8 : 3);
      const paramsRender = shouldFormatParams
        ? `${options.fnParams.join(`,\n  `)}`
        : options.fnParams.join(', ');

      return (
        <div className={[css.mockFn].concat(className).join(' ')}>
          {shouldFormatParams
            ? `({\n  ${paramsRender}\n}) => {`
            : `({ ${paramsRender} }) => {`}
        </div>
      );
    },
    [options.fnParams]
  );

  const onBlur = useCallback((editor, monaco, container) => {
    if (monaco) {
      updateVal(editor.getValue())
    }
    if (options.onBlur) {
      options.onBlur(editor, monaco, container)
    }
  }, []);

  const open = useCallback(() => {
    if (!modalContext.visible) {
      modalContext.visible = true;
      spaCtx.popView(
        model.title,
        () => {
          return (
            <div className={css['editor-code__modal']}>
              {renderToolbar}
              {modalContext.visible && (
                <>
                  {fnBodyRender(css['mockFn-header'])}
                  <div
                    style={{
                      height: `calc(100% - ${
                        model.commentHeight + 30 + (options.fnParams ? 36 : 0)
                      }px)`,
                    }}
                  >
                    <MonacoEditor
                      onMounted={onMonacoMounted}
                      value={getVal}
                      readOnly={readonly}
                      onChange={onChange}
                      {...options}
                      onBlur={onBlur}
                      fnParams={options.fnParams}
                      extraLib={`${options.extraLib || ''}`}
                      height='100%'
                      width='100%'
                      env={env}
                      language={languageMap[language] || language}
                    />
                  </div>
                  {options.fnParams ? <div className={css.mockFn}>{'}'}</div> : ''}
                  {comments && (
                    <>
                      <div
                      // className={css.sperH}
                      // onMouseDown={evt(moveConsole).stop}
                      // onClick={evt().stop}
                      />
                      <div className={css.icons}>
                        <div className={css['icons__left']}>注释</div>
                        <div className={css['icons__right']}>
                          {model.icon === 'min' && (
                            <div onClick={() => onIconClick('recover')}>
                              {ICONS.min}
                            </div>
                          )}
                          {model.icon === 'recover' && (
                            <div onClick={() => onIconClick('min')}>
                              {ICONS.recover}
                            </div>
                          )}
                        </div>
                      </div>
                      <div
                        ref={commentRef}
                        style={{ height: model.commentHeight }}
                      >
                        <MonacoEditor
                          value={comments}
                          readOnly
                          width='100%'
                          height='100%'
                          lineNumbers='off'
                          env={env}
                          useExtraLib={false}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          );
        },
        {
          onClose() {
            onClose();
          },
        }
      );
    }
  }, []);

  const onChange: any = useCallback((v: string, e: any) => {
    // model.val = v;
    updateVal(v);
  }, []);

  const RenderInEditView: JSX.Element = useMemo(() => {
    const { title } = model;
    if (displayType === 'button') {
      return <button onClick={open}>{title}</button>;
    }
    return (
      <div className={css['editor-code__container']}>
        <div className={css['editor-code__modal']}>
          <div className={css['editor-code__header']}>
            {renderToolbar}
            <div className={css['editor-code__title']}>{title}</div>
            {enableFullscreen && (
              <div>
                <div className={css.action} onClick={open}>
                  <FullscreenOutlined />
                </div>
              </div>
            )}
          </div>
          {!modalContext.visible && (
            <>
              {fnBodyRender(css['mockFn-header__min'])}
              <MonacoEditor
                onMounted={onMonacoMounted}
                value={getVal}
                readOnly={readonly}
                onChange={onChange}
                {...options}
                onBlur={onBlur}
                fnParams={options.fnParams}
                extraLib={`$${options.extraLib || ''}`}
                width='100%'
                height='100%'
                env={env}
                className={css['editor-code__min-container']}
                language={languageMap[language] || language}
              />
              {options.fnParams ? <div className={css.mockFn}>{'}'}</div> : ''}
            </>
          )}
        </div>
      </div>
    );
  }, [modalContext.visible, render, model.val]);

  return <div className={css['editor-code']}>{RenderInEditView}</div>;
}
