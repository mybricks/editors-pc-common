interface Cate {
  title: string;
  items: any[];
}

interface ValueGetProps<IData = any> {
  data: IData;
  slots: any;
  style: any;
}

type EditorItem = EditorText | EditorSelect | EditorExcel;

type SelectOptions = Array<{ label: string; value: string }>;

type ExcelOptions = Array<{ key: string; title: string }>;

interface EditorBase<IData = any> {
  title: string;
  value: {
    get: ({ data }: { data: IData }) => any;
    set: ({ data }: { data: IData }, value: any) => any;
  };
}

interface EditorText<IData = any> extends EditorBase {
  type: "Text";
}

interface EditorSelect<IData = any> extends EditorBase {
  type: "Select";
  options: SelectOptions | (({ data }: { data: IData }) => SelectOptions);
}

interface EditorExcel<IData = any> extends EditorBase {
  type: "Excel";
  options?: ExcelOptions | (({ data }: { data: IData }) => ExcelOptions);
}

interface Configuration<Data = any> {
  "@resize": {
    options?: ["height", "width"];
    ifVisible: ({ data }: { data: Data }) => boolean;
  };
  /**
   * 初始化
   */
  "@init": (
    { data, slots, style }: { data: Data; slots; style },
    cate0?: Cate,
    cate1?: Cate
  ) => void;
  ":root": EditorItem[];
}
