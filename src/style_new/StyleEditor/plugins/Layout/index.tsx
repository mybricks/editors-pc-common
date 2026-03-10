import React, { useCallback, useEffect, useState } from "react";
import LayoutEditor from "../../../../layout";
import { Panel } from "../../components";
import type { ChangeEvent, PanelBaseProps } from "../../type";

interface LayoutProps extends PanelBaseProps {
  value: Record<string, any>;
  onChange: ChangeEvent;
}

export function Layout({ value, onChange, showTitle, collapse }: LayoutProps) {
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random())
  const [isReset, setIsReset] = useState(false)

  const currentValue = isReset ? {} : (value ?? {})

  const LAYOUT_KEYS = new Set([
    'display', 'position', 'flexDirection', 'alignItems', 'justifyContent',
    'flexWrap', 'rowGap', 'columnGap', 'overflow',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  ])

  const editConfig = {
    value: {
      get: () => Object.fromEntries(
        Object.entries(currentValue).filter(([key, v]) => v != null && LAYOUT_KEYS.has(key))
      ),
      set: (newVal: Record<string, any>) => {
        const NON_CSS_KEYS = new Set(['paddingType']);
        onChange(
          Object.entries(newVal)
            .filter(([key, val]) => !NON_CSS_KEYS.has(key) && val != null)
            .map(([key, val]) => ({ key, value: val }))
        );
      },
    },
  };

  const refresh = useCallback(() => {
    const keys = Object.keys(value ?? {}).filter(key => LAYOUT_KEYS.has(key))
    onChange(keys.map(key => ({ key, value: null })))
    setIsReset(true)
    setForceRenderKey(prev => prev + 1)
  }, [value, onChange])

  useEffect(() => {
    if (isReset && value && Object.keys(value).some(k => value[k] != null)) {
      setIsReset(false)
    }
  }, [value, isReset])

  return (
    <Panel title="布局" showTitle={showTitle} showReset={true} showDelete={false} resetFunction={refresh} collapse={collapse}>
      <React.Fragment key={forceRenderKey}>
        <LayoutEditor editConfig={editConfig as any} />
      </React.Fragment>
    </Panel>
  );
}
