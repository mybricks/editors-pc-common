import React from "react";
import LayoutEditor from "../../../../layout";
import { Panel } from "../../components";
import type { ChangeEvent, PanelBaseProps } from "../../type";

interface LayoutProps extends PanelBaseProps {
  value: Record<string, any>;
  onChange: ChangeEvent;
}

export function Layout({ value, onChange, showTitle, collapse }: LayoutProps) {

  const editConfig = {
    value: {
      get: () => Object.fromEntries(
        Object.entries(value ?? {}).filter(([, v]) => v != null)
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


  return (
    <Panel title="布局" showTitle={showTitle} collapse={collapse}>
      <LayoutEditor editConfig={editConfig as any} />
    </Panel>
  );
}
