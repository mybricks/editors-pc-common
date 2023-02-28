# Style 编辑器

> 样式编辑器，支持针对CSS样式进行进行修改

## DEMO

![demo](https://f2.eckwai.com/kos/nlav12333/fangzhou/pub/compress/image-7282d84d-348e-43f4-9731-80d5e11abf24.png)

## API

| 属性      |                                               说明 |                          类型                           | 默认值 | 必选 |
| :-------- | -------------------------------------------------: | :-----------------------------------------------------: | :----: | :--: |
| items     |                           需要使用的CSS属性集合 |                Array\<AttrItem\> | ''                      |   -    |  -   |
| defaultOpen  | 是否默认展开 | boolean| false |   -    |  -   |

## 定义

### AttrItem
属性模型，可以配置需要的CSS属性集合，也可以单独配置对应属性集的option，
```typescript
type AttrTextItem = 'font' | 'border' | 'bgimage' | 'bgcolor' | 'textshadow' | 'shadow'

type AttrItem = AttrTextItem | { use: AttrTextItem, option: any }
```

## demo
比如需要border和font属性集，但是font里面不想要垂直对齐
```typescript
{
  type: 'style',
  options: {
    /** 是否默认展开面板 */
    defaultOpen: true,
    items: [
      'border',
      {
        use: 'font',
        option: {
          /** 关闭垂直对齐 */
          verticalAlign: false
        }
      },
    ],
  }
}

```