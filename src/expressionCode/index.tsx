import React, { useEffect, useMemo, useRef, useState } from 'react';
import MonacoEditor from '@mybricks/code-editor';
import Monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { EditorProps } from '../interface';
import {
  defaultEditorOptions,
  ensureLanguageRegistered,
  languageName,
  setLanguageSuggestions,
  themeName
} from './utils';
import css from './style.less';

let monacoProvider: any;
export default function ({ editConfig }: EditorProps) {
  const monacoRef = useRef<any>({});
  const editorRef = useRef<any>({});
  const { value, options, getDefaultOptions } = editConfig;
  const valConfig = value.get();
  const defaultOptions = useMemo(() => getDefaultOptions?.('expcode') ?? {}, []);
  const [val, setVal] = useState<any>(
    typeof valConfig === 'string' ? valConfig : valConfig?.value
  );
  const [showPlaceholder, setShowPlaceholder] = useState(!val);
  const [editorHeight, setEditorHeight] = useState(24 * 3);

  const suggestions = valConfig?.suggestions || options?.suggestions || [];
  const onMonacoMounted = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco
  ) => {
    monacoRef.current = monaco;
    ensureLanguageRegistered(monaco);
    monacoProvider?.dispose();
    monacoProvider = setLanguageSuggestions(monaco, suggestions);
    editor.onDidBlurEditorWidget(() => {
      setShowPlaceholder(!editor.getValue());
    });

    editor.onDidFocusEditorWidget(() => {
      setShowPlaceholder(false);
    });
    editorRef.current = editor;
    if (typeof options?.run === 'function') {
      const markers = options?.run(val);
      if (Array.isArray(markers)) {
        monacoRef.current.editor.setModelMarkers(
          editorRef.current.getModel(),
          'owner',
          markers
        );
      }
    }
  };

  useEffect(() => {
    return () => {
      monacoProvider?.dispose();
      onMouseUp();
    };
  }, []);

  useEffect(() => {
    if (options?.autoSize) {
      const line = `${val}`.split('\n').length;
      if (21 * line > editorHeight) {
        setEditorHeight(21 * line);
      }
    }
  }, [val, editorHeight]);

  const onMouseMove = (e: MouseEvent) => {
    setEditorHeight((oldData) =>
      oldData + e.movementY < 24 * 3 ? 24 * 3 : oldData + e.movementY
    );
  };
  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      className={css.editorWrap}
      onClick={() => {
        editorRef.current?.trigger?.('', 'editor.action.triggerSuggest', '');
      }}
    >
      {options.placeholder && showPlaceholder ? (
        <div className={css.placeholder}>{options.placeholder}</div>
      ) : null}
      <MonacoEditor
        {...defaultEditorOptions}
        onMounted={onMonacoMounted}
        value={val}
        height={`${editorHeight}px`}
        language={languageName}
        theme={themeName}
        CDN={defaultOptions.CDN}
        onChange={(codeVal: string) => {
          setVal(codeVal);
          value.set(codeVal);
          if (typeof options?.run === 'function') {
            const markers = options?.run(codeVal);
            if (Array.isArray(markers)) {
              monacoRef.current.editor.setModelMarkers(
                editorRef.current.getModel(),
                'owner',
                markers
              );
            }
          }
          // monacoProvider?.dispose();
          // monacoProvider = setLanguageSuggestions(
          //   monacoRef.current,
          //   suggestions
          // );
        }}
      />
      <div
        className={css.dragLine}
        onMouseDown={() => {
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        }}
      />
    </div>
  );
}
