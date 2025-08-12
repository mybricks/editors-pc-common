export type ActiveId = string | null;
export type EditId = string | null;

export type ListSetterProps = {
  onSelect?: (activeId: string, activeIndex: number) => void;
  onAdd?: (id: string) => void | object;
  onChange: Function;
  onRemove?: (id: string) => void;
  value: any;
  locales: any;
  items: Array<any>;
  getTitle: (item: any, index: number) => string | Array<string>;
  draggable: boolean;
  editable: boolean;
  /** 是否支持批量编辑 */
  batchEditable?: boolean;
  /** 批量编辑时Drawer宽度 */
  batchWidth?: string|number;
  selectable: boolean;
  deletable: boolean;
  addable: boolean;
  addText?: string;
  customOptRender?: any;
  extraContext?: any;
  cdnMap: any;
  defaultSelect?: string;
  /** 获取应用层配置的 editor options */
  getDefaultOptions?(key: string): any;
  handleDelete?: (item: any) => boolean;
  tagsRender?: (item: any) => Array<TagType>;
};

export type TagType = {
  color: string;
  text: string;
}

export type TitleProps = {
  items: string | Array<string>;
  heavy?: boolean;
};


