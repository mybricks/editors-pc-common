import React, { useCallback, useState } from 'react';

import { AutoComplete } from 'antd';
import { debounce } from '../util/lodash';
import { EditorProps } from '../interface';
import { useObservable } from '@mybricks/rxui';
import { getOptionsFromEditor, isValid } from '../utils';

import css from './index.less';
import { editorsConfigKey } from '../constant';

export interface Options {
  label: string,
  value: string
}


export default ({ onSearch, mapToOption }:any) => function ({ editConfig }: EditorProps): JSX.Element {
  const [option, setOption] = useState<any>([]);
  const [removeOptions, setRemoveOption] = useState<Array<any>>([]);

  let timeout: ReturnType<typeof setTimeout> | null;
  let currentValue: string;

  const { value, options } = editConfig;
  const model = useObservable(
    { val: isValid(value.get()) ? value.get() : '', value },
    [value]
  );

  const handel = useCallback((value: string) => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    currentValue = value;
    
    const fn = () => {
      onSearch(value).then((list:any) => {
        setRemoveOption(list)
        const items = list.map(mapToOption)
        setOption(items)
      })
    }
    timeout = setTimeout(fn, 300);
  },[]);
  

  //动态态配置下拉选项
  const handleSearch = useCallback((val: string) => {
    if (val) {
      handel(val);
    } else {
      setOption([]);
    }
  },[])

  const setVal = useCallback(() => {
    model.value.set(model.val);   
  }, []);

  const debouncedSetVal = debounce(setVal, 300);
  const updateVal = useCallback((val: any) => {
    model.val = val;
    debouncedSetVal();
  }, []);


  const updateSelectVal = useCallback((value)=>{
    let valueArr = option.map((item:any)=> item.value);
    let index = valueArr.indexOf(value);
    if(index !== -1){
      let realVal = removeOptions[index];
      model.val = realVal;
      debouncedSetVal();
    }
  },[removeOptions, option])

  
  const defaultValueMap = (val: string | Options) => {
    if(typeof val === 'string'){
      return val;
    }else{
      let mapVal = [val].map(mapToOption)[0]?.value;
      return mapVal;
    }
  }

  return (
    <div className={`${css['editor-autoComplete']} fangzhou-theme`}>
      <AutoComplete
        size={(window as any)[editorsConfigKey]?.size || 'small'}
        defaultValue={defaultValueMap(model.val)}
        filterOption={true}
        onChange={updateVal}
        optionFilterProp={"label"}
        onSelect={updateSelectVal}
        
        onSearch={handleSearch}
        options={option}
      />
    </div>
  );
}
