import React, { useEffect, useCallback, useState } from 'react';
import { AutoComplete, Button, Checkbox, Drawer, Input, Tooltip } from 'antd';
import { useObservable } from '@mybricks/rxui';
import { PlusOutlined, DeleteOutlined, CloseOutlined } from '@ant-design/icons';
import { isValid, deepCopy, uuid } from '../utils';
import css from './index.less';

function getIds(length: number) {
  const ids = new Array(length).fill(null).map(def => uuid());
  return ids;
}
export default function ({ editConfig }: any): any {
  const { value, options = {} } = editConfig;
  const {
    kType = 'text',
    option,
    readonly = false,
    notaddel = false,
    noteditkey = false,
    noteditvalue = false,
    title = editConfig.title,
    kPlaceholder = 'Key',
    vPlaceholder = 'Value',
    addTip = '添加键值对',
    displayType
  } = options;
  const [drawerVisible, setDrawerVisible] = useState(false);
  const model: any = useObservable(
    {
      val: isValid(value.get()) ? deepCopy(value.get()) : [],
      checked: [],
      k: [],
      v: [],
      ids: [],
      autoOptions: option,
      value,
      checkedIds: []
    },
    [value]
  );

  const update = useCallback(() => {
    const res: any = {};
    const checkStatus: boolean[] = [];
    model.checkedIds = model.checkedIds
      .filter((id: string) => {
        const idx = model.ids.findIndex((def: string) => def === id);
        return idx > -1 && model.k[idx] && model.k[idx]?.length
      })
      .filter((id: string, i: number, self: string[]) => self.indexOf(id) === i);
    model.k.forEach((item: string, idx: number) => {
      const id = model.ids[idx];
      checkStatus[idx] = false;
      if (item && item.length && model.checkedIds.includes(id)) {
        res[item] = model.v[idx];
        checkStatus[idx] = true;
      } else if (model.checkedIds.includes(id) && !item) {
        model.checkedIds = model.checkedIds.filter((def: string) => def !== id);
      }
    });
    const allValue: any = [];
    model.k.forEach((item: string, idx: number) => {
      const val = model.v[idx];
      allValue.push({ key: item, value: val, checked: checkStatus[idx] });
    });
    model.value.set(allValue);
  }, []);

  const add = useCallback(() => {
    model.k.push('');
    model.v.push('');
    model.ids.push(uuid());
  }, []);

  const del = useCallback((idx) => {
    model.k.splice(idx, 1);
    model.v.splice(idx, 1);
    model.ids.splice(idx, 1);
    update();
  }, []);

  const autoChange = useCallback((v, idx) => {
    model.k[idx] = v;
    update();
  }, []);

  useEffect(() => {
    model.val.forEach(({ key, value, checked }: { key: any, value: any, checked: boolean }) => {
      model.k.push(key);
      model.v.push(value);
      model.checked.push(checked);
    });
    model.ids = getIds(model.k.length);
    model.checkedIds = model.ids.filter((id: string, inx: number) => model.checked[inx]);
  }, []);

  const inputStyle = {
    lineHeight: '22px',
    borderRadius: '4px',
    border: "1px solid #d9d9d9"
  }
  const size = displayType === 'button' ? 'middle' : 'small';

  const kInput = useCallback((idx) => {
    if (kType === 'text') {
      return (
        <Input
          placeholder={kPlaceholder}
          style={inputStyle}
          disabled={readonly || noteditkey}
          value={model.k[idx]}
          onChange={(evt) => {
            model.k[idx] = evt.target.value;
          }}
          onKeyPress={(evt) => {
            if (evt.key !== 'Enter') return;
            // if (evt.which !== 13) return
            update();
          }}
          onBlur={update}
          size={size}
        />
      );
    } else if (kType === 'auto') {
      return !readonly && !noteditkey ? (
        <AutoComplete
          value={model.k[idx]}
          options={model.k[idx] && model.k[idx].length ? [] : model.autoOptions}
          dropdownMatchSelectWidth={200}
          placeholder={kPlaceholder}
          onChange={(v) => autoChange(v, idx)}
          size={size}
        />
      ) : (
        <Input
          style={inputStyle}
          placeholder={kPlaceholder}
          disabled={readonly || noteditkey}
          value={model.k[idx]}
          size={size}
        />
      );
    }
  }, []);

  const mapEditor = <React.Fragment>
    {model.k.map((item: any, idx: number) => {
      const id = model.ids[idx];
      return (
        <div key={`item_${idx}`} className={css['editor-map__item']}>
          <Checkbox
            style={{ marginRight: '10px' }}
            onChange={({ target }) => {
              const { checked } = target;
              checked ? model.checkedIds.push(id) : model.checkedIds = model.checkedIds.filter((def: string) => def !== id);
              update();
            }}
            checked={item && model.checkedIds.includes(id)}
            onClick={(e) => {
              e.stopPropagation()
            }}
          />
          <Tooltip title={model.k[idx]} placement="left">
            {displayType === 'button' ?
              <div style={{ minWidth: '20%' }}>
                {kInput(idx)}
              </div> :
              kInput(idx)
            }
          </Tooltip>

          <span className={css['editor-map__item-equal']}>:</span>
          <Tooltip title={model.v[idx]} placement="left">
            <Input
              style={inputStyle}
              placeholder={vPlaceholder}
              value={model.v[idx]}
              disabled={readonly || noteditvalue}
              onChange={(evt) => {
                model.v[idx] = evt.target.value;
              }}
              onKeyPress={(evt) => {
                if (evt.key !== 'Enter') return;
                // if (evt.which !== 13) return
                update();
              }}
              onBlur={update}
              size={size}
            />
          </Tooltip>
          {!readonly && !notaddel && (
            <div className={css['editor-map__item-del']}>
              <DeleteOutlined onClick={() => del(idx)} />
            </div>
          )}
        </div>
      );
    })}
    {!readonly && !notaddel && (
      <div className={css['editor-map__add']}>
        <Button
          icon={<PlusOutlined />}
          type="dashed"
          size={'middle'}
          block
          onClick={add}
        >
          {addTip}
        </Button>
      </div>
    )}
  </React.Fragment>;

  return (
    <div className={`${css['editor-map']} fangzhou-theme`}>
      {displayType === 'button' &&
        <button onClick={() => setDrawerVisible(!drawerVisible)}>{title}</button>}
      {displayType === 'button' &&
        <Drawer
          className={`${css['drawerWrapper']} fangzhou-theme`}
          rootClassName={`${css['drawerWrapper']} fangzhou-theme`}
          bodyStyle={{
            borderLeft: '1px solid #bbb',
            backgroundColor: '#F7F7F7',
            padding: '10px',
          }}
          placement="right"
          mask={false}
          closable={false}
          size='large'
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          getContainer={() => document.querySelector('div[class^="lyStage-"]')}
          style={{ position: 'absolute' }}
          rootStyle={{position: "absolute",left:'unset'}}
        >
          <div
            className={`${css['drawerTitle']}`}
          >
            {title}
            <CloseOutlined onClick={() => setDrawerVisible(false)} />
          </div>
          {mapEditor}
        </Drawer>
      }
      {displayType !== 'button' && mapEditor}
    </div>
  );
}
