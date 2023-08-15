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

const judgeFun = (item:any) => {"lable" in item && "value" in item && Object.keys.length === 2}

export default function ({editConfig}: EditorProps): JSX.Element {
  const [option, setOption] = useState<any>([]);
  const [removeOptions, setRemoveOption] = useState<Array<any>>([]);

  let timeout: ReturnType<typeof setTimeout> | null;
  let currentValue: string;

  const { value, options } = editConfig;
  const model = useObservable(
    { val: isValid(value.get()) ? value.get() : '', value },
    [value]
  );

  const { onSearch, mapToOption } = options;
  //1、onSearch的入参是value, 出参是接口实际返回的值或给定的列表数据
  //2、mapToOption，是实际列表=>自动完成数据源的映射函数

  const handel = useCallback((value: string) => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    currentValue = value;
    
    const fn = () => {
      onSearch(value).then((list:any) => {
        setRemoveOption(list);
        if(mapToOption){
          const items = list.map(mapToOption)
          setOption(items)
        }else{
          if(list.every(judgeFun)){
            setOption(list)
          }else{
            setOption([])
          }
        }
      })
    }
    timeout = setTimeout(fn, 300);
  },[]);
  

  //动态态配置下拉选项
  const handleSearch = useCallback((val: string) => {
    if (val && onSearch) {
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
    }else if(val && mapToOption){
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
