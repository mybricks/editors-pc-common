import React, { useCallback, useState } from 'react';
import { EditorProps } from '../interface';
import { isValid } from '../utils';
import css from './index.less';

export default function FN({ editConfig }: EditorProps): any {
  const { value, options } = editConfig;
  const { readonly = false } = options || {};

  const [checked, setChecked] = useState(isValid(value.get()) ? value.get() : false);

  const onChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.checked;
    setChecked(nextValue);
    value.set(nextValue);
  }, [value]);

  return (
    <div className={css['editor-switch']}>
      <label className={css.switch}>
        <input
          className={css.input}
          type="checkbox"
          disabled={readonly}
          checked={checked}
          onChange={onChange}
        />
        <span className={css.slider} />
      </label>
    </div>
  );
}
