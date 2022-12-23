import React, { useCallback, useMemo, useState } from 'react';
import { Drawer, Radio, Input } from 'antd';
import * as icons from '@ant-design/icons';
import { CloseOutlined } from '@ant-design/icons';
import { isValid } from '../utils';
import { useComputed, useObservable } from '@mybricks/rxui';
// import { EditorProps } from '../index'
import css from './index.less';
import {
  directionListLined, 
  tipListLined, 
  editListLined, 
  dataListLined, 
  brandListLined, 
  universalListLined,
  directionListFilled,
  tipListFilled,
  editListFilled,
  dataListFilled,
  brandListFilled,
  universalListFilled
} from './iconList'

const { Search } = Input;
const IconList = Object.keys(icons).filter(key => key.endsWith('ed'));

const Icon = (props: any) => {
  const {
    type,
    fontSize,
    color,
    spin,
    className,
    rotate
  } = props

  // @ts-ignore
  const RenderIcon = icons[type]

  if (!RenderIcon) return <></>

  return <RenderIcon
    style={{ fontSize, color }}
    spin={spin}
    className={className}
    rotate={rotate}
  />
}

export default function ({ editConfig }): any {
  const { value, options = {} } = editConfig;
  const { readonly = false } = options;
  const model: any = useObservable({ length: 80, value }, [value]);
  const [lineStyle, setlineStyle] = useState('outLined');
  const [direction, setDirection] = useState<string[]>(directionListLined);
  const [tip, setTip] = useState<string[]>(tipListLined);
  const [edit, setEdit] = useState<string[]>(editListLined);
  const [data, setData] = useState<string[]>(dataListLined);
  const [brand, setBrand] = useState<string[]>(brandListLined);
  const [universal, setUniversal] = useState<string[]>(universalListLined);
  
  const [directionFilled, setDirectionFilled] = useState<string[]>(directionListFilled);
  const [tipFilled, setTipFilled] = useState<string[]>(tipListFilled);
  const [editFilled, setEditFilled] = useState<string[]>(editListFilled);
  const [dataFilled, setDataFilled] = useState<string[]>(dataListFilled);
  const [brandFilled, setBrandFilled] = useState<string[]>(brandListFilled);
  const [universalFilled, setUniversalFilled] = useState<string[]>(universalListFilled);

  useComputed(() => {
    model.val = isValid(value.get()) ? String(value.get()) : '';
  });

  const updateVal = useCallback((item) => {
    model.val = item;
    model.value.set(item);
    close();
  }, []);

  const modalContext = useObservable({
    visible: false,
  });

  const toggle = useCallback(() => {
    if (readonly) return;
    modalContext.visible = !modalContext.visible;
    setTimeout(() => {
      model.length = renderIcons.length;
    }, 0);
  }, []);

  const close = useCallback(() => {
    modalContext.visible = false;
    model.length = 80;
  }, []);

  const renderIcons = useMemo(() => {
    if (readonly) return [];

    return IconList.map((item: string) => (
      <div
        key={item}
        className={css.icon}
        onClick={() => {
          updateVal(item);
        }}
      >
        <Icon type={item} fontSize={40} />
      </div>
    ));
  }, []);

  const onSearch = useCallback((value: string) => {
    let val = value.toLowerCase();
    //做出响应
    let directions = directionListLined.filter((item)=>{
      return item.toLowerCase().indexOf(val) !== -1
    })
    setDirection(directions)
    let tips = tipListLined.filter((item)=>{
      return item.toLowerCase().indexOf(val) !== -1
    })
    setTip(tips)
    let edits = editListLined.filter((item)=>{
      return item.toLowerCase().indexOf(val) !== -1
    })
    setEdit(edits)
    let datas = dataListLined.filter((item)=>{
      return item.toLowerCase().indexOf(val) !== -1
    })
    setData(datas)
    let brands = brandListLined.filter((item)=>{
      return item.toLowerCase().indexOf(val) !== -1
    })
    setBrand(brands)
    let universals = universalListLined.filter((item)=>{
      return item.toLowerCase().indexOf(val) !== -1
    })
    setUniversal(universals)

    let directionsFilled = directionListFilled.filter((item)=>{
      return item.toLowerCase().indexOf(val) !== -1
    })
    setDirectionFilled(directionsFilled)
    let tipsFilled = tipListFilled.filter((item)=>{
      return item.toLowerCase().indexOf(val) !== -1
    })
    setTipFilled(tipsFilled)
    let editsFilled = editListFilled.filter((item)=>{
      return item.toLowerCase().indexOf(val) !== -1
    })
    setEditFilled(editsFilled)
    let datasFilled = dataListFilled.filter((item)=>{
      return item.toLowerCase().indexOf(val) !== -1
    })
    setDataFilled(datasFilled)
    let brandsFilled = brandListFilled.filter((item)=>{
      return item.toLowerCase().indexOf(val) !== -1
    })
    setBrandFilled(brandsFilled)
    let universalsFilled = universalListFilled.filter((item)=>{
      return item.toLowerCase().indexOf(val) !== -1
    })
    setUniversalFilled(universalsFilled)

  }, []);

  const onChange = useCallback((e) => {
    let value = e.target.value.toLowerCase();
    //做出响应
    let directions = directionListLined.filter((item)=>{
      return item.toLowerCase().indexOf(value) !== -1
    })
    setDirection(directions)
    let tips = tipListLined.filter((item)=>{
      return item.toLowerCase().indexOf(value) !== -1
    })
    setTip(tips)
    let edits = editListLined.filter((item)=>{
      return item.toLowerCase().indexOf(value) !== -1
    })
    setEdit(edits)
    let datas = dataListLined.filter((item)=>{
      return item.toLowerCase().indexOf(value) !== -1
    })
    setData(datas)
    let brands = brandListLined.filter((item)=>{
      return item.toLowerCase().indexOf(value) !== -1
    })
    setBrand(brands)
    let universals = universalListLined.filter((item)=>{
      return item.toLowerCase().indexOf(value) !== -1
    })
    setUniversal(universals)

    let directionsFilled = directionListFilled.filter((item)=>{
      return item.toLowerCase().indexOf(value) !== -1
    })
    setDirectionFilled(directionsFilled)
    let tipsFilled = tipListFilled.filter((item)=>{
      return item.toLowerCase().indexOf(value) !== -1
    })
    setTipFilled(tipsFilled)
    let editsFilled = editListFilled.filter((item)=>{
      return item.toLowerCase().indexOf(value) !== -1
    })
    setEditFilled(editsFilled)
    let datasFilled = dataListFilled.filter((item)=>{
      return item.toLowerCase().indexOf(value) !== -1
    })
    setDataFilled(datasFilled)
    let brandsFilled = brandListFilled.filter((item)=>{
      return item.toLowerCase().indexOf(value) !== -1
    })
    setBrandFilled(brandsFilled)
    let universalsFilled = universalListFilled.filter((item)=>{
      return item.toLowerCase().indexOf(value) !== -1
    })
    setUniversalFilled(universalsFilled)
    
  }, []);

  //线框风格
  const renderOutlinedIcons = useMemo(() => {
    if (readonly) return [];

    return (
      <>
      <div className={css.classTitle}>方向性图标</div>
      <div className={css.iconWrapper}>
        {direction.map((item: string) => (
          <div
            key={item}
            className={css.icon}
            onClick={() => {
              updateVal(item);
            }}
          >
            <Icon type={item} fontSize={40} />
          </div>
        ))}
      </div>
      <div className={css.classTitle}>提示建议性图标</div>
      <div className={css.iconWrapper}>
        {tip.map((item: string) => (
          <div
            key={item}
            className={css.icon}
            onClick={() => {
              updateVal(item);
            }}
          >
            <Icon type={item} fontSize={40} />
          </div>
        ))}
      </div>
      <div className={css.classTitle}>编辑类图标</div>
      <div className={css.iconWrapper}>
        {edit.map((item: string) => (
          <div
            key={item}
            className={css.icon}
            onClick={() => {
              updateVal(item);
            }}
          >
            <Icon type={item} fontSize={40} />
          </div>
        ))}
      </div>
      <div className={css.classTitle}>数据类图标</div>
      <div className={css.iconWrapper}>
        {data.map((item: string) => (
          <div
            key={item}
            className={css.icon}
            onClick={() => {
              updateVal(item);
            }}
          >
            <Icon type={item} fontSize={40} />
          </div>
        ))}
      </div>
      <div className={css.classTitle}>品牌和标识图标</div>
      <div className={css.iconWrapper}>
        {brand.map((item: string) => (
          <div
            key={item}
            className={css.icon}
            onClick={() => {
              updateVal(item);
            }}
          >
            <Icon type={item} fontSize={40} />
          </div>
        ))}
      </div>
      <div className={css.classTitle}>网站通用图标</div>
      <div className={css.iconWrapper}>
        {universal.map((item: string) => (
          <div
            key={item}
            className={css.icon}
            onClick={() => {
              updateVal(item);
            }}
          >
            <Icon type={item} fontSize={40} />
          </div>
        ))}
      </div>
    </>
    );
  }, [direction, tip, edit, data, brand, universal]);


  //实底风格
  const renderFilledIcons = useMemo(() => {
    if (readonly) return [];

    return (
      <>
      <div className={css.classTitle}>方向性图标</div>
      <div className={css.iconWrapper}>
        {directionFilled.map((item: string) => (
          <div
            key={item}
            className={css.icon}
            onClick={() => {
              updateVal(item);
            }}
          >
            <Icon type={item} fontSize={40} />
          </div>
        ))}
      </div>
      <div className={css.classTitle}>提示建议性图标</div>
      <div className={css.iconWrapper}>
        {tipFilled.map((item: string) => (
          <div
            key={item}
            className={css.icon}
            onClick={() => {
              updateVal(item);
            }}
          >
            <Icon type={item} fontSize={40} />
          </div>
        ))}
      </div>
      <div className={css.classTitle}>编辑类图标</div>
      <div className={css.iconWrapper}>
        {editFilled.map((item: string) => (
          <div
            key={item}
            className={css.icon}
            onClick={() => {
              updateVal(item);
            }}
          >
            <Icon type={item} fontSize={40} />
          </div>
        ))}
      </div>
      <div className={css.classTitle}>数据类图标</div>
      <div className={css.iconWrapper}>
        {dataFilled.map((item: string) => (
          <div
            key={item}
            className={css.icon}
            onClick={() => {
              updateVal(item);
            }}
          >
            <Icon type={item} fontSize={40} />
          </div>
        ))}
      </div>
      <div className={css.classTitle}>品牌和标识图标</div>
      <div className={css.iconWrapper}>
        {brandFilled.map((item: string) => (
          <div
            key={item}
            className={css.icon}
            onClick={() => {
              updateVal(item);
            }}
          >
            <Icon type={item} fontSize={40} />
          </div>
        ))}
      </div>
      <div className={css.classTitle}>网站通用图标</div>
      <div className={css.iconWrapper}>
        {universalFilled.map((item: string) => (
          <div
            key={item}
            className={css.icon}
            onClick={() => {
              updateVal(item);
            }}
          >
            <Icon type={item} fontSize={40} />
          </div>
        ))}
      </div>
    </>
    );
  }, [directionFilled, tipFilled, editFilled, dataFilled, brandFilled, universalFilled]);

  return (
    <div className={css['editor-icon']}>
      <button
        className={css['editor-icon__button']}
        onClick={toggle}
        style={{ cursor: readonly ? 'defatult' : 'pointer' }}
      >
        {readonly ? (
          <Icon type={model.val} />
        ) : (
          <span>
            <Icon
              type={model.val}
              className={css['editor-icon__button-editIcon']}
            />
            {`${modalContext.visible ? '关闭' : '打开'}`}图标选择器
          </span>
        )}
      </button>
      <Drawer
        className={`${css.iconBody} fangzhou-theme`}
        bodyStyle={{
          padding: 0,
          borderLeft: '1px solid #bbb',
          backgroundColor: '#F7F7F7',
          overflow: 'auto'
        }}
        placement="right"
        mask={false}
        closable={false}
        destroyOnClose={true}
        visible={modalContext.visible}
        onClose={close}
        width={390}
        getContainer={() => document.querySelector('div[class^="lyStage-"]')}
        style={{ position: 'absolute' }}
      >
        <div className={css.sticky}>
          <div className={css['drawerTitle']}>
            {'选择图标'}
            <CloseOutlined onClick={close} />
          </div>
          <div className={css.styleChoose}>
            <div>
              <Radio.Group value={lineStyle} onChange={(e) => setlineStyle(e.target.value)}>
                <Radio.Button value="outLined">线框风格</Radio.Button>
                <Radio.Button value="Filled">实底风格</Radio.Button>
              </Radio.Group>
            </div>
            <span>
              <Search placeholder="在此搜索图标" allowClear onSearch={onSearch} onChange={onChange} style={{ width: 180 }} />
            </span>
          </div>
        </div>
        <div>
          {lineStyle === "outLined" ? (renderOutlinedIcons): (renderFilledIcons)}
        </div>
      </Drawer>
    </div >
  );
}
