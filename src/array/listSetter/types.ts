type ActiveId = string | null;
type EditId = string | null;

type ListSetterProps = {
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

type TagType = {
  color: string;
  text: string;
}

type TitleProps = {
  items: string | Array<string>;
  heavy?: boolean;
};

export type { ListSetterProps, TitleProps, ActiveId, EditId, TagType };
