import React from 'react';

import { EditorProps } from '../interface';

export default function ({ editConfig }: EditorProps): JSX.Element {
  const { value, options = {}, ...otherEditConfigs } = editConfig;
  const { render: CustomRender, ...otherOptions } = options;

  return typeof CustomRender === 'function' ? (
    CustomRender({ editConfig: { ...otherEditConfigs, value, options: { ...otherOptions } } })
  ) : (
    <CustomRender editConfig={{ ...otherEditConfigs, value, options: { ...otherOptions } }} />
  );
}
