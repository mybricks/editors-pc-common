import React, {useMemo, useCallback} from 'react';

import {Ctx} from '../Style';
import GreyContainer from './greyContainer';
import {Popover, Switch, Form} from 'antd';
import ColorEditor from '../../components/color-editor';
import SettingOutlined from '@ant-design/icons/SettingOutlined';
import {observe, useComputed, useObservable} from '@mybricks/rxui';

import css from './index.less';

/**
 * Radius与位置的对应
 */
enum BorderRadiusStyleMap {
  Top = 'TopLeft',
  Right = 'TopRight',
  Bottom = 'BottomRight',
  Left = 'BottomLeft'
}

/**
 * 默认值
 */
enum BorderStyleDefaultValueMap {
  Color = '',
  Width = '0px',
  Style = 'none',
  Radius = '0px'
}

/**
 * key对应解释
 */
enum PositionEnToCh {
  Top = '上边框',
  Right = '右边框',
  Bottom = '下边框',
  Left = '左边框'
}

/**
 * Radius的key对应解释
 */
enum RadiusPositionEnToCh {
  Top = '左上角',
  Right = '右上角',
  Bottom = '右下角',
  Left = '左下角'
}

class EditCtx {
  borderColor!: string;
  borderStyle!: string;
  borderWidth!: string;
  borderRadius!: string;
  /**
   * 拆分方位的样式
   */
  borderConfig!: T_Config;
  /**
   * 各方向是否展示单独的配置
   */
  borderShowConfigMap!: T_StringBooleanMap
}

/**
 * 这一串type看着好累，好好学学ts吧，应该能精简？
 */
type T_StringAnyMap = { [key: string]: any; };
type T_StringBooleanMap = { [key: string]: boolean; };
type T_TypeRadius = 'Radius';
type T_TypeDefault = 'Color' | 'Width' | 'Style';
type T_Type = T_TypeDefault | T_TypeRadius;
type T_PositionRadius =
  BorderRadiusStyleMap.Top
  | BorderRadiusStyleMap.Right
  | BorderRadiusStyleMap.Bottom
  | BorderRadiusStyleMap.Left;
type T_Position = 'Top' | 'Right' | 'Bottom' | 'Left';
type T_ConfigKey = `border${T_Position}${T_TypeDefault}` | `border${T_PositionRadius}${T_TypeRadius}`;
type T_Config = { [key in T_ConfigKey]?: string; };
type T_BorderStyleKey = `border${T_Type}`;
type T_DefaultBorderStyle = { [key in T_BorderStyleKey]: string; };

/**
 * 配置项
 */
const borderTypes: Array<T_Type> = ['Color', 'Width', 'Style', 'Radius'];
const borderTypesLength: number = borderTypes.length;
/**
 * 方向
 */
const borderPositions: Array<T_Position> = ['Top', 'Right', 'Bottom', 'Left'];
/**
 * 位数对应的方向
 */
const commonIndexToPosition = {
  0: 'Top',
  1: 'Right',
  2: 'Bottom',
  3: 'Left'
}
/**
 * Radius位数对应的方向
 */
const radiusIndexToPosition = {
  0: BorderRadiusStyleMap.Top,
  1: BorderRadiusStyleMap.Right,
  2: BorderRadiusStyleMap.Bottom,
  3: BorderRadiusStyleMap.Left
}

/**
 * isDiscardedStyle
 * @param obj 当前配置内容
 * @returns 是（true）否（false）旧数据
 */
function isDiscardedStyle(obj: T_StringAnyMap): boolean {
  /**
   * 目前只有color、width、style、radius四种编辑项，多出来的按旧数据处理
   */
  return Object.keys(obj).filter(key => key.startsWith('border')).length > borderTypesLength;
}

/**
 * 旧数据兼容
 */
function getDiscardedStyleConfig(obj: T_StringAnyMap): {
  borderConfig: T_Config,
  borderShowConfigMap: T_StringBooleanMap,
  defaultBorderStyle: T_DefaultBorderStyle
} {
  const borderConfig: T_Config = {};
  const borderShowConfigMap: T_StringBooleanMap = {
    Top: false,
    Right: false,
    Bottom: false,
    Left: false
  };

  borderTypes.forEach((type: T_Type) => {
    const isRadius: boolean = type === 'Radius';

    borderPositions.forEach((position: T_Position) => {
      const parentKey: T_BorderStyleKey = `border${type}`;
      const childKey: T_ConfigKey = `border${isRadius ? BorderRadiusStyleMap[position] : position}${type}` as T_ConfigKey;
      const hasValue = childKey in obj;

      borderConfig[childKey] = hasValue ? obj[childKey] : obj[parentKey] || BorderStyleDefaultValueMap[type];

      if (hasValue && obj[childKey] !== obj[parentKey]) {
        borderShowConfigMap[position] = true;
      }

      Reflect.deleteProperty(obj, childKey);
    });
  });

  return {
    borderConfig,
    borderShowConfigMap,
    defaultBorderStyle: {
      borderColor: obj.borderColor,
      borderStyle: obj.borderStyle,
      borderWidth: obj.borderWidth,
      borderRadius: obj.borderRadius
    }
  };
}

/**
 * 将样式拆分为各方向
 */
function getStyleConfig(obj: T_StringAnyMap): {
  borderConfig: T_Config,
  borderShowConfigMap: T_StringBooleanMap,
  defaultBorderStyle: T_DefaultBorderStyle
} {
  const borderConfig: T_Config = {};
  const defaultBorderStyle: T_DefaultBorderStyle = {
    borderColor: '',
    borderStyle: 'none',
    borderWidth: '0px',
    borderRadius: '0px'
  };

  let borderShowConfigMap: T_StringBooleanMap = {
    Top: false,
    Right: false,
    Bottom: false,
    Left: false
  };

  borderTypes.forEach((type: T_Type) => {
    const isRadius: boolean = type === 'Radius';
    const key: T_BorderStyleKey = `border${type}`;
    const curValue: string = obj[key];
    const curValueAry: Array<string> = curValue.split(' ').slice(0, 4);
    const curValueAryLength: number = curValueAry.length;
    const valueCountMap: T_StringAnyMap = {};

    /**
     * 长度只有1和4
     * 1:默认值
     * 4:变更一次后即为4
     */
    if (curValueAryLength === 1) {
      curValueAry.push(...Array.from({length: 3}, () => curValue));
    }

    let maxCount: number = 0;

    curValueAry.forEach((value: string, index: number) => {
      // @ts-ignore
      const position = isRadius ? radiusIndexToPosition[index] : commonIndexToPosition[index];
      const key: T_ConfigKey = `border${position}${type}` as T_ConfigKey;

      borderConfig[key] = value;

      if (!valueCountMap[value]) {
        valueCountMap[value] = 1;

        if (!maxCount) {
          maxCount = 1;
        }
      } else {
        valueCountMap[value] = valueCountMap[value] + 1;

        if (valueCountMap[value] > maxCount) {
          maxCount = valueCountMap[value];
        }
      }
      ;
    });

    const maxCountValue = Object.keys(valueCountMap).reduce((p, c) => {
      const pv = valueCountMap[p];
      const cv = valueCountMap[c];

      if (pv === cv) {
        return p;
      } else if (pv > cv) {
        return p
      }

      return c;
    });

    switch (maxCount) {
      case 1:
        borderShowConfigMap = {
          Top: true,
          Right: true,
          Bottom: true,
          Left: true
        };
        break;
      case 2:
      case 3:
        curValueAry.forEach((value: string, index: number) => {
          if (value !== maxCountValue) {
            // @ts-ignore
            borderShowConfigMap[commonIndexToPosition[index]] = true;
          }
          ;
        });
        break;
      case 4:
      default:
        break;
    }

    defaultBorderStyle[key] = maxCountValue;
  });

  return {
    borderConfig,
    borderShowConfigMap,
    defaultBorderStyle
  };
}

export default function (): JSX.Element {
  const ctx: Ctx = observe(Ctx, {from: 'parents'});
  const editCtx: EditCtx = useObservable(EditCtx, (next) => {
    const {
      borderConfig,
      borderShowConfigMap,
      defaultBorderStyle
    } = isDiscardedStyle(ctx.val) ? getDiscardedStyleConfig(ctx.val) : getStyleConfig(ctx.val);

    next({
      borderConfig,
      borderShowConfigMap,
      ...defaultBorderStyle
    });
  });

  /**
   * 设置样式，执行value.set
   */
  const setStyle: () => void = useCallback(() => {
    const resultStyleMap = {
      Color: '',
      Style: '',
      Width: '',
      Radius: ''
    };

    borderTypes.forEach((type: T_Type) => {
      const isRadius: boolean = type === 'Radius';

      borderPositions.forEach((position: T_Position) => {
        const key: T_ConfigKey = `border${isRadius ? BorderRadiusStyleMap[position] : position}${type}` as T_ConfigKey;
        const value: any = editCtx.borderConfig[key];

        if (!resultStyleMap[type]) {
          resultStyleMap[type] = value
        } else {
          resultStyleMap[type] = resultStyleMap[type] + ` ${value}`;
        }
      });
    });

    ctx.set({
      borderColor: resultStyleMap.Color,
      borderWidth: resultStyleMap.Width,
      borderStyle: resultStyleMap.Style,
      borderRadius: resultStyleMap.Radius,
    });
  }, []);

  /**
   * 重置某个方向的配置
   */
  const resetPositionConfig: (position: T_Position) => void = useCallback((position: T_Position) => {
    borderTypes.forEach((type: T_Type) => {
      const parentKey: T_BorderStyleKey = `border${type}`;
      const childKey: T_ConfigKey = `border${type === 'Radius' ? BorderRadiusStyleMap[position] : position}${type}` as T_ConfigKey;
      editCtx.borderConfig[childKey] = editCtx[parentKey];
    });

    setStyle();
  }, []);

  /**
   * 配置方向是否开启配置的开关
   */
  const switchPositionConfigOnchange: (position: T_Position) => void = useCallback((position: T_Position) => {
    editCtx.borderShowConfigMap[position] = !editCtx.borderShowConfigMap[position];

    resetPositionConfig(position);
  }, []);

  /**
   * 主配置变更
   */
  const defaultEditorOnchange: (value: any, type: T_Type) => void = useCallback((value, type) => {
    editCtx[`border${type}`] = value;

    const isRadius = type === 'Radius';
    const {borderConfig, borderShowConfigMap} = editCtx;

    (Object.keys(borderShowConfigMap) as Array<T_Position>).forEach((position: T_Position) => {
      const show = borderShowConfigMap[position];

      if (!show) {
        borderConfig[`border${isRadius ? BorderRadiusStyleMap[position] : position}${type}` as T_ConfigKey] = value;
      }
      ;
    });

    setStyle();
  }, []);

  /**
   * 各方向配置变更
   */
  const positionEditorOnchange = useCallback((value: any, key: T_ConfigKey) => {
    editCtx.borderConfig[key] = value;

    setStyle();
  }, []);

  /**
   * 各方向配置开关组件
   */
  const RenderSwitchPositionConfigBar: JSX.Element = useMemo(() => {
    return (
      <Form size='small'>
        <Form.Item label='上边框'>
          <Switch
            size='small'
            onChange={() => switchPositionConfigOnchange('Top')}
            defaultChecked={editCtx.borderShowConfigMap.Top}
          ></Switch>
        </Form.Item>
        <Form.Item label='右边框'>
          <Switch
            size='small'
            onChange={() => switchPositionConfigOnchange('Right')}
            defaultChecked={editCtx.borderShowConfigMap.Right}
          ></Switch>
        </Form.Item>
        <Form.Item label='下边框'>
          <Switch
            size='small'
            onChange={() => switchPositionConfigOnchange('Bottom')}
            defaultChecked={editCtx.borderShowConfigMap.Bottom}
          ></Switch>
        </Form.Item>
        <Form.Item label='左边框'>
          <Switch
            size='small'
            onChange={() => switchPositionConfigOnchange('Left')}
            defaultChecked={editCtx.borderShowConfigMap.Left}
          ></Switch>
        </Form.Item>
      </Form>
    );
  }, []);

  /**
   * 各方向配置组件
   */
  const RenderPositionConfig: JSX.Element[] = useComputed(() => {
    return borderPositions.map((position: T_Position) => {
      const showConfig: boolean = editCtx.borderShowConfigMap[position];

      return (
        <div key={position}>
          {showConfig ? (
            <>
              <div className={css.editorTitle}>{PositionEnToCh[position]}</div>
              <div className={css.toolbar}>
                <ColorEditor
                  style={{marginRight: 3, flex: 1}}
                  value={
                    editCtx.borderConfig[`border${position}Color`] || BorderStyleDefaultValueMap.Color
                  }
                  onChange={(value) => positionEditorOnchange(value, `border${position}Color`)}
                />
                <GreyContainer
                  type='input'
                  label='大小(px)'
                  onBlurFnKey='>0'
                  regexFnKey='number'
                  style={{marginRight: 3, flex: 1}}
                  defaultValue={parseInt(
                    editCtx.borderConfig[`border${position}Width`] || BorderStyleDefaultValueMap.Width
                  )}
                  onChange={(value) => positionEditorOnchange(`${value}px`, `border${position}Width`)}
                />
                <GreyContainer
                  label='类型'
                  type='select'
                  optionsKey='borderStyle'
                  style={{cursor: 'pointer', marginRight: 3, flex: 1}}
                  defaultValue={
                    editCtx.borderConfig[`border${position}Style`] || BorderStyleDefaultValueMap.Style
                  }
                  onChange={(value) => positionEditorOnchange(value, `border${position}Style`)}
                />
                <GreyContainer
                  type='input'
                  label={RadiusPositionEnToCh[position]}
                  onBlurFnKey='>0'
                  regexFnKey='number'
                  style={{flex: 1}}
                  defaultValue={
                    parseInt(editCtx.borderConfig[`border${BorderRadiusStyleMap[position]}Radius`] || BorderStyleDefaultValueMap.Radius)
                  }
                  onChange={(value) => positionEditorOnchange(`${value}px`, `border${BorderRadiusStyleMap[position]}Radius`)}
                />
              </div>
            </>
          ) : <></>}
        </div>
      );
    });
  });

  return (
    <div className={css.editorContainer}>
      <div className={css.editorTitle}>
        边框
        <div className={css.actions}>
          <Popover
            title='配置'
            arrowPointAtCenter
            placement='leftTop'
            overlayClassName={css.pceditorStylePopover}
            content={() => {
              return RenderSwitchPositionConfigBar;
            }}
          >
            <span style={{height: 18}}>{<SettingOutlined/>}</span>
          </Popover>
        </div>
      </div>
      <div className={css.toolbar}>
        <div className={css.item}>
          <ColorEditor
            style={{marginRight: 3}}
            value={editCtx.borderColor}
            onChange={(value) => defaultEditorOnchange(value, 'Color')}
          />
          <label className={css.label}>颜色</label>
        </div>

        <GreyContainer
          type='input'
          label='大小(px)'
          onBlurFnKey='>0'
          regexFnKey='number'
          style={{marginRight: 3, flex: 1}}
          defaultValue={parseInt(editCtx.borderWidth)}
          onChange={(value) => defaultEditorOnchange(`${value}px`, 'Width')}
        />
        <GreyContainer
          label='类型'
          type='select'
          optionsKey='borderStyle'
          style={{marginRight: 3, cursor: 'pointer', flex: 1}}
          defaultValue={editCtx.borderStyle}
          onChange={(value) => defaultEditorOnchange(value, 'Style')}
        />
        <GreyContainer
          type='input'
          label='圆角(px)'
          onBlurFnKey='>0'
          regexFnKey='number'
          style={{flex: 1}}
          defaultValue={parseInt(editCtx.borderRadius)}
          onChange={(value) => defaultEditorOnchange(`${value}px`, 'Radius')}
        />
      </div>
      {RenderPositionConfig}
    </div>
  );
}
