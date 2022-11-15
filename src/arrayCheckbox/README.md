# ArrayCheckbox 编辑器

> 数组多选框编辑器，支持固定数组的多选和编辑功能，内部支持渲染其他编辑器

## API

| 属性      |                                               说明 |                          类型                           | 默认值 | 必选 |
| :-------- | -------------------------------------------------: | :-----------------------------------------------------: | :----: | :--: |
| items     |                              内部需要渲染的其他编辑器 |                      Array\<any\>                       |   -    |  -   |
| getTitle  |        要渲染的标题栏内容，如果里面有图片地址则会渲染图片 | (item: any, index: number) => string \| Array\<string\> |   -    |  -   |
| editable  |                                    是否展示编辑图标 |                         boolean                         |  true  |  -   |
| checkField  |                            勾选/启用操作对应的字段 |               string                          |  _checked  |  -   |
| visilbeField  |                            控制数组项显隐的字段 |               string                          |    |  -   |