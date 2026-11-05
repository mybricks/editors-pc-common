import React, { ReactNode, useState } from 'react';
import { Panel, Dropdown, DownOutlined, getCssVarName } from '../../../components';
import type { VariableChipMenuOption } from '../../../components/VariableChip';
import lang from '../../../../index.i18n';
import styles from './index.less';

interface GridVariableInputProps {
  value: string;
  resolvedValue?: string;
  display: string;
  prefix?: ReactNode;
  menuOptions: VariableChipMenuOption[];
  onMenuSelect: (value: string) => void;
  onMenuAction: (value: string) => void;
  onInputValue: (value: string) => void;
  onDetach: () => void;
}

// Grid 只需要回显变量、转常量及尺寸菜单；不改动公共胶囊的换绑入口、键盘行为或样式。
export default function GridVariableInput({ value, resolvedValue, display, prefix, menuOptions,
  onMenuSelect, onMenuAction, onInputValue, onDetach }: GridVariableInputProps) {
  const [draft, setDraft] = useState('');
  const varName = getCssVarName(value);
  const commitDraft = (text: string) => {
    setDraft('');
    // 保留胶囊原有的数字/单位入口限制；行列数与尺寸的具体合法性仍由 Grid 各自校验。
    const trimmed = text.trim();
    if (/^-?(?:\d+\.?\d*|\.\d+)([a-z%]*)$/i.test(trimmed)) onInputValue(trimmed);
  };

  return <Panel.Item>
    <div className={styles.variableInput} data-mybricks-tip={JSON.stringify({
      content: `${lang.variablePrefix}${varName || value}${resolvedValue && resolvedValue !== display ? `\n${resolvedValue}` : ''}`,
      position: 'left',
    })}>
      {prefix && <div className={styles.variablePrefix}>{prefix}</div>}
      <div className={styles.variableBody}>
        {!draft && <span className={styles.variableValue}>{display}</span>}
        <input value={draft} spellCheck={false} data-drag-ignore
          onChange={event => setDraft(event.target.value)}
          onBlur={event => commitDraft(event.currentTarget.value)}
          onKeyDown={event => {
            if ((event.key === 'Backspace' || event.key === 'Delete') && !draft) {
              event.preventDefault();
              onDetach();
            } else if (event.key === 'Enter') {
              commitDraft(draft);
            } else if (event.key === 'Escape') {
              // 仅 Grid：取消草稿后失焦不提交，保留原变量绑定。
              setDraft('');
              event.currentTarget.value = '';
              event.currentTarget.blur();
            }
          }} />
      </div>
      <div className={styles.variableArrowWrap}>
        <Dropdown value={varName} options={menuOptions} onClick={onMenuSelect} onAction={onMenuAction}>
          <span className={styles.variableArrow}><DownOutlined /></span>
        </Dropdown>
      </div>
    </div>
  </Panel.Item>;
}
