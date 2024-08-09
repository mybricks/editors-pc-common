# Array 编辑器

> 数组编辑器，支持针对数组的添加、删除、拖拽调换位置等功能，内部支持渲染其他编辑器

## DEMO

![demo](https://ali2.a.kwimgs.com/kos/nlav11092/image.8803171e83b79771.png)

## API

| 属性      |                                               说明 |                          类型                           | 默认值 | 必选 |
| :-------- | -------------------------------------------------: | :-----------------------------------------------------: | :----: | :--: |
| items     |                           内部需要渲染的其他编辑器 |                      Array\<any\>                       |   -    |  -   |
| getTitle  | 要渲染的标题栏内容，如果里面有图片地址则会渲染图片 | (item: any, index: number) => string \| Array\<string\> |   -    |  -   |
| onSelect  |                           数组某个元素高亮时的回调 |     (activeId: string, activeIndex: number) => void     |   -    |  -   |
| onAdd     | 数组元素添加时的回调，返回对象则会把对象当作初始值 |             (id: string) => void \| object              |   -    |  -   |
| onRemove  |                               数组元素删除时的回调 |           (id: string, index: number) => void           |   -    |  -   |
| draggable |                               能否拖拽移动数组元素 |                         boolean                         |  true  |  -   |
| editable  |                                   是否展示编辑图标 |                         boolean                         |  true  |  -   |
| handleDelete  |                                   是否展示编辑图标函数，返回true展示、false不展示 |                         (item: any) => boolean;                         |  -  |  -   |
| tagsRender  |                                   渲染标签 |                         tagsRender?: (item: any) => Array<{color: string, text: string}>;                         |  -  |  -   |
