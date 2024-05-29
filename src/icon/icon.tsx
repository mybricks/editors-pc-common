import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Drawer, Radio, Input, Popover } from "antd";
import * as icons from "@ant-design/icons";
import { CloseOutlined } from "@ant-design/icons";
import { isValid } from "../utils";
import { useComputed, useObservable } from "@mybricks/rxui";
// import { EditorProps } from '../index'
import css from "./index.less";
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
  universalListFilled,
} from "./iconList";
import { extractListFormIconfontJS, parse, domToString } from "./utils/iconfont";

import { EditorProps } from "@/interface";

const { Search } = Input;
const IconList = Object.keys(icons ?? {}).filter((key) => key.endsWith("ed"));

const Icon = (props: any) => {
  const { type, fontSize, color, spin, className, rotate } = props;

  // @ts-ignore
  const RenderIcon = icons[type];

  if (!RenderIcon) return <></>;

  return <RenderIcon style={{ fontSize, color }} spin={spin} className={className} rotate={rotate} />;
};

const defaultList = [
  {
    title: "线框风格",
    key: "outLined"
  },
  {
    title: "实底风格",
    key: "Filled"
  },
]

export default function ({ editConfig }: EditorProps): any {
  const { value, options = {} } = editConfig;
  const { readonly = false, defaultIcon = true, iconFont = true, extras } = options;
  const model: any = useObservable({ length: 80, value }, [value]);
  const [lineStyle, setlineStyle] = useState("outLined");
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

  const [newList, setNewList] = useState<string[]>([]);
  const [iconList, setIconList] = useState<string[]>([]);
  const [id, setID] = useState<string>("");

  //应用侧实现
  const getList = async (url: string) => {
    return fetch(url)
      .then((res) => res.text())
      .then((res) => {
        let newList = extractListFormIconfontJS(res);
        return newList;
      });
  };

  useEffect(() => {
    if (editConfig?.fontJS) {
      getList(editConfig.fontJS).then((res) => {
        setNewList(res);
      });
    }
  }, []);

  useEffect(() => {
    setIconList(newList);
  }, [newList]);

  useComputed(() => {
    model.val = isValid(value.get()) ? String(value.get()) : "";
  });

  const updateVal = useCallback(
    (item) => {
      let svgIcon;
      let realIcon = <></>;
      let realIconStr;
      if (lineStyle === "Iconfont") {
        setID(item);
        svgIcon = document.getElementById(item);
        realIcon = parse(svgIcon.innerHTML);
        realIconStr = domToString(realIcon);
        model.val = realIconStr;
        model.value.set(realIconStr);
        close();
      } else {
        model.val = item;
        model.value.set(item);
        close();
      }
    },
    [lineStyle]
  );

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

  const onSearch = useCallback(
    (value: string) => {
      let val = value.toLowerCase();
      //做出响应
      let directions = directionListLined.filter((item) => {
        return item.toLowerCase().indexOf(val) !== -1;
      });
      setDirection(directions);
      let tips = tipListLined.filter((item) => {
        return item.toLowerCase().indexOf(val) !== -1;
      });
      setTip(tips);
      let edits = editListLined.filter((item) => {
        return item.toLowerCase().indexOf(val) !== -1;
      });
      setEdit(edits);
      let datas = dataListLined.filter((item) => {
        return item.toLowerCase().indexOf(val) !== -1;
      });
      setData(datas);
      let brands = brandListLined.filter((item) => {
        return item.toLowerCase().indexOf(val) !== -1;
      });
      setBrand(brands);
      let universals = universalListLined.filter((item) => {
        return item.toLowerCase().indexOf(val) !== -1;
      });
      setUniversal(universals);

      let directionsFilled = directionListFilled.filter((item) => {
        return item.toLowerCase().indexOf(val) !== -1;
      });
      setDirectionFilled(directionsFilled);
      let tipsFilled = tipListFilled.filter((item) => {
        return item.toLowerCase().indexOf(val) !== -1;
      });
      setTipFilled(tipsFilled);
      let editsFilled = editListFilled.filter((item) => {
        return item.toLowerCase().indexOf(val) !== -1;
      });
      setEditFilled(editsFilled);
      let datasFilled = dataListFilled.filter((item) => {
        return item.toLowerCase().indexOf(val) !== -1;
      });
      setDataFilled(datasFilled);
      let brandsFilled = brandListFilled.filter((item) => {
        return item.toLowerCase().indexOf(val) !== -1;
      });
      setBrandFilled(brandsFilled);
      let universalsFilled = universalListFilled.filter((item) => {
        return item.toLowerCase().indexOf(val) !== -1;
      });
      setUniversalFilled(universalsFilled);

      let filteredList = newList.filter((item) => {
        return item.toLowerCase().indexOf(val) !== -1;
      });
      setIconList(filteredList);
    },
    [newList, iconList]
  );

  const [searchedText, setSearchedText] = useState("");
  const onChange = useCallback(
    (e) => {
      setSearchedText(e.target.value);
      let value = e.target.value.toLowerCase();
      //做出响应
      let directions = directionListLined.filter((item) => {
        return item.toLowerCase().indexOf(value) !== -1;
      });
      setDirection(directions);
      let tips = tipListLined.filter((item) => {
        return item.toLowerCase().indexOf(value) !== -1;
      });
      setTip(tips);
      let edits = editListLined.filter((item) => {
        return item.toLowerCase().indexOf(value) !== -1;
      });
      setEdit(edits);
      let datas = dataListLined.filter((item) => {
        return item.toLowerCase().indexOf(value) !== -1;
      });
      setData(datas);
      let brands = brandListLined.filter((item) => {
        return item.toLowerCase().indexOf(value) !== -1;
      });
      setBrand(brands);
      let universals = universalListLined.filter((item) => {
        return item.toLowerCase().indexOf(value) !== -1;
      });
      setUniversal(universals);

      let directionsFilled = directionListFilled.filter((item) => {
        return item.toLowerCase().indexOf(value) !== -1;
      });
      setDirectionFilled(directionsFilled);
      let tipsFilled = tipListFilled.filter((item) => {
        return item.toLowerCase().indexOf(value) !== -1;
      });
      setTipFilled(tipsFilled);
      let editsFilled = editListFilled.filter((item) => {
        return item.toLowerCase().indexOf(value) !== -1;
      });
      setEditFilled(editsFilled);
      let datasFilled = dataListFilled.filter((item) => {
        return item.toLowerCase().indexOf(value) !== -1;
      });
      setDataFilled(datasFilled);
      let brandsFilled = brandListFilled.filter((item) => {
        return item.toLowerCase().indexOf(value) !== -1;
      });
      setBrandFilled(brandsFilled);
      let universalsFilled = universalListFilled.filter((item) => {
        return item.toLowerCase().indexOf(value) !== -1;
      });
      setUniversalFilled(universalsFilled);

      let filteredList = newList.filter((item) => {
        return item.toLowerCase().indexOf(value) !== -1;
      });
      setIconList(filteredList);
    },
    [newList, iconList]
  );

  //线框风格
  const renderOutlinedIcons = useMemo(() => {
    if (readonly) return [];

    return (
      <>
        <div className={css.classTitle}>方向性图标</div>
        <div className={css.iconWrapper}>
          {direction.map((item: string) => (
            <Popover trigger={"hover"} content={<span className={css.popoverText}>{item}</span>}>
              <div
                key={item}
                className={css.icon}
                onClick={() => {
                  updateVal(item);
                }}
              >
                <Icon type={item} fontSize={30} />
                <span className={css.text}>{item}</span>
              </div>
            </Popover>
          ))}
        </div>
        <div className={css.classTitle}>提示建议性图标</div>
        <div className={css.iconWrapper}>
          {tip.map((item: string) => (
            <Popover trigger={"hover"} content={<span className={css.popoverText}>{item}</span>}>
              <div
                key={item}
                className={css.icon}
                onClick={() => {
                  updateVal(item);
                }}
              >
                <Icon type={item} fontSize={30} />
                <span className={css.text}>{item}</span>
              </div>
            </Popover>
          ))}
        </div>
        <div className={css.classTitle}>编辑类图标</div>
        <div className={css.iconWrapper}>
          {edit.map((item: string) => (
            <Popover trigger={"hover"} content={<span className={css.popoverText}>{item}</span>}>
              <div
                key={item}
                className={css.icon}
                onClick={() => {
                  updateVal(item);
                }}
              >
                <Icon type={item} fontSize={30} />
                <span className={css.text}>{item}</span>
              </div>
            </Popover>
          ))}
        </div>
        <div className={css.classTitle}>数据类图标</div>
        <div className={css.iconWrapper}>
          {data.map((item: string) => (
            <Popover trigger={"hover"} content={<span className={css.popoverText}>{item}</span>}>
              <div
                key={item}
                className={css.icon}
                onClick={() => {
                  updateVal(item);
                }}
              >
                <Icon type={item} fontSize={30} />
                <span className={css.text}>{item}</span>
              </div>
            </Popover>
          ))}
        </div>
        <div className={css.classTitle}>品牌和标识图标</div>
        <div className={css.iconWrapper}>
          {brand.map((item: string) => (
            <Popover trigger={"hover"} content={<span className={css.popoverText}>{item}</span>}>
              <div
                key={item}
                className={css.icon}
                onClick={() => {
                  updateVal(item);
                }}
              >
                <Icon type={item} fontSize={30} />
                <span className={css.text}>{item}</span>
              </div>
            </Popover>
          ))}
        </div>
        <div className={css.classTitle}>网站通用图标</div>
        <div className={css.iconWrapper}>
          {universal.map((item: string) => (
            <Popover trigger={"hover"} content={<span className={css.popoverText}>{item}</span>}>
              <div
                key={item}
                className={css.icon}
                onClick={() => {
                  updateVal(item);
                }}
              >
                <Icon type={item} fontSize={30} />
                <span className={css.text}>{item}</span>
              </div>
            </Popover>
          ))}
        </div>
      </>
    );
  }, [direction, tip, edit, data, brand, universal, lineStyle]);

  //实底风格
  const renderFilledIcons = useMemo(() => {
    if (readonly) return [];

    return (
      <>
        <div className={css.classTitle}>方向性图标</div>
        <div className={css.iconWrapper}>
          {directionFilled.map((item: string) => (
            <Popover trigger={"hover"} content={<span className={css.popoverText}>{item}</span>}>
              <div
                key={item}
                className={css.icon}
                onClick={() => {
                  updateVal(item);
                }}
              >
                <Icon type={item} fontSize={30} />
                <span className={css.text}>{item}</span>
              </div>
            </Popover>
          ))}
        </div>
        <div className={css.classTitle}>提示建议性图标</div>
        <div className={css.iconWrapper}>
          {tipFilled.map((item: string) => (
            <Popover trigger={"hover"} content={<span className={css.popoverText}>{item}</span>}>
              <div
                key={item}
                className={css.icon}
                onClick={() => {
                  updateVal(item);
                }}
              >
                <Icon type={item} fontSize={30} />
                <span className={css.text}>{item}</span>
              </div>
            </Popover>
          ))}
        </div>
        <div className={css.classTitle}>编辑类图标</div>
        <div className={css.iconWrapper}>
          {editFilled.map((item: string) => (
            <Popover trigger={"hover"} content={<span className={css.popoverText}>{item}</span>}>
              <div
                key={item}
                className={css.icon}
                onClick={() => {
                  updateVal(item);
                }}
              >
                <Icon type={item} fontSize={30} />
                <span className={css.text}>{item}</span>
              </div>
            </Popover>
          ))}
        </div>
        <div className={css.classTitle}>数据类图标</div>
        <div className={css.iconWrapper}>
          {dataFilled.map((item: string) => (
            <Popover trigger={"hover"} content={<span className={css.popoverText}>{item}</span>}>
              <div
                key={item}
                className={css.icon}
                onClick={() => {
                  updateVal(item);
                }}
              >
                <Icon type={item} fontSize={30} />
                <span className={css.text}>{item}</span>
              </div>
            </Popover>
          ))}
        </div>
        <div className={css.classTitle}>品牌和标识图标</div>
        <div className={css.iconWrapper}>
          {brandFilled.map((item: string) => (
            <Popover trigger={"hover"} content={<span className={css.popoverText}>{item}</span>}>
              <div
                key={item}
                className={css.icon}
                onClick={() => {
                  updateVal(item);
                }}
              >
                <Icon type={item} fontSize={30} />
                <span className={css.text}>{item}</span>
              </div>
            </Popover>
          ))}
        </div>
        <div className={css.classTitle}>网站通用图标</div>
        <div className={css.iconWrapper}>
          {universalFilled.map((item: string) => (
            <Popover trigger={"hover"} content={<span className={css.popoverText}>{item}</span>}>
              <div
                key={item}
                className={css.icon}
                onClick={() => {
                  updateVal(item);
                }}
              >
                <Icon type={item} fontSize={30} />
                <span className={css.text}>{item}</span>
              </div>
            </Popover>
          ))}
        </div>
      </>
    );
  }, [directionFilled, tipFilled, editFilled, dataFilled, brandFilled, universalFilled, lineStyle]);

  //Iconfont
  const renderSingleIcon = (icon: string) => {
    return (
      <Popover trigger={"hover"} content={<span className={css.popoverText}>{icon}</span>}>
        <div
          className={css.icon}
          key={icon}
          onClick={() => {
            updateVal(icon);
          }}
        >
          <svg width="30" height="30">
            <use xlinkHref={`#${icon}`}></use>
          </svg>
          <span className={css.text}>{icon}</span>
        </div>
      </Popover>
    );
  };

  const renderIconfont = useMemo(() => {
    return (
      <>
        {newList.length !== 0 && Array.isArray(newList) ? (
          <div className={css.iconWrapper}>
            {iconList.map((item) => {
              return renderSingleIcon(item);
            })}
          </div>
        ) : (
          <div className={css.empty}>
            <Icon fontSize={60} type={"ExclamationCircleOutlined"}></Icon>
            <div className={css.emptyContent}>暂未添加图标库，请先添加 Iconfont JS链接，或检查其是否正确</div>
          </div>
        )}
      </>
    );
  }, [newList, lineStyle, iconList]);

  const [extraDataListMap, setExtraDataListMap] = useState<Record<string, Record<string, string>>>({});
  const extraList = useMemo(() => editConfig.getDefaultOptions("icon")?.extras ?? [], []);
  const [extraLoading, setExtraLoading] = useState(false);
  const [comExtraDataListMap, setComExtraDataListMap] = useState<Record<string, Record<string, string>>>({});
  const comExtraList = useMemo(() => extras ?? [], []);
  const [comExtraLoading, setComExtraLoading] = useState(false);

  //默认lineStyle处理
  useEffect(() => {
    if (defaultIcon === false) {
      setlineStyle("Iconfont");
    }
    if(defaultIcon === false && iconFont === false) {
      const totalExtraList = [...extraList, ...comExtraList];
      setlineStyle(totalExtraList[0].key)
    }
  }, [extraList, comExtraList]);

  useEffect(() => {
    extraList.forEach(({ key, dataFetcher }) => {
      if (dataFetcher && key === lineStyle) {
        setExtraLoading(true);
        dataFetcher()
          .then((data) => {
            setExtraDataListMap((prev) => {
              prev[key] = data;
              return Object.assign({}, prev);
            });
          })
          .finally(() => {
            setExtraLoading(false);
          });
      }
    });
    comExtraList.forEach(({ key, dataFetcher }) => {
      if (dataFetcher && key === lineStyle) {
        setComExtraLoading(true);
        dataFetcher()
          .then((data) => {
            setComExtraDataListMap((prev) => {
              prev[key] = data;
              return Object.assign({}, prev);
            });
          })
          .finally(() => {
            setComExtraLoading(false);
          });
      }
    });
  }, [lineStyle]);

  const renderSVG = useCallback(
    (key: string, loading, listMap: Record<string, Record<string, string>>) => {
      const icons = listMap[key] ?? {};
      const isEmpty =
        Object.values(icons).filter(({ title }) =>
          searchedText ? title.toLowerCase().indexOf(searchedText.toLowerCase()) !== -1 : true
        ).length === 0;
      return loading ? (
        <div className={css.loading}>加载中...</div>
      ) : isEmpty ? (
        <div className={css.loading}>暂无数据</div>
      ) : (
        <div className={css.iconWrapper}>
          {Object.keys(icons).map((iconNamespace) => {
            const { title, svg } = icons[iconNamespace];
            const isFilter = searchedText && title.toLowerCase().indexOf(searchedText.toLowerCase()) === -1;
            if (isFilter) {
              return null;
            }
            return (
              <Popover trigger={"hover"} content={<span className={css.popoverText}>{title}</span>}>
                <div
                  className={css.icon}
                  key={iconNamespace}
                  onClick={() => {
                    model.val = svg;
                    model.value.set(svg);
                    close();
                  }}
                >
                  <div dangerouslySetInnerHTML={{ __html: svg }} style={{ fontSize: 22 }}></div>
                  <span className={css.text}>{title}</span>
                </div>
              </Popover>
            );
          })}
        </div>
      );
    },
    [extraDataListMap, comExtraDataListMap, close, model, extraLoading, comExtraLoading, searchedText]
  )

  return (
    <div className={css["editor-icon"]}>
      <button
        className={css["editor-icon__button"]}
        onClick={toggle}
        style={{ cursor: readonly ? "default" : "pointer" }}
      >
        {readonly ? (
          <Icon type={model.val} />
        ) : (
          <span>
            {lineStyle !== "Iconfont" ? (
              <Icon type={model.val} className={css["editor-icon__button-editIcon"]} />
            ) : (
              <span className={css["editor-icon__button-editIcon"]} style={{ verticalAlign: "middle" }}>
                <svg width="12" height="12">
                  <use xlinkHref={`#${id}`}></use>
                </svg>
              </span>
            )}
            {`${modalContext.visible ? "关闭" : "打开"}`}图标选择器
          </span>
        )}
      </button>
      <Drawer
        className={`${css.iconBody} fangzhou-theme`}
        bodyStyle={{
          padding: 0,
          borderLeft: "1px solid #bbb",
          backgroundColor: "#F7F7F7",
          overflow: "auto",
        }}
        placement="right"
        mask={false}
        closable={false}
        destroyOnClose={true}
        visible={modalContext.visible}
        onClose={close}
        width={650}
        getContainer={() => document.querySelector('div[class^="lyStage-"]')}
        style={{ position: "absolute" }}
      >
        <div className={css.sticky}>
          <div className={css["drawerTitle"]}>
            {"选择图标"}
            <CloseOutlined onClick={close} />
          </div>
          <div className={css.styleChoose}>
            <div>
              <Radio.Group
                value={lineStyle}
                onChange={(e) => {
                  setlineStyle(e.target.value);
                }}
              >
                {defaultIcon ? defaultList.map((item)=>{
                  return <Radio.Button value={item.key}>{item.title}</Radio.Button>;
                }) : void 0}
                {iconFont ? <Radio.Button value="Iconfont">Iconfont</Radio.Button> : void 0}
                {extraList.map((item:any) => {
                  return <Radio.Button value={item.key}>{item.title}</Radio.Button>;
                })}
                {comExtraList.map((item:any) => {
                  return <Radio.Button value={item.key}>{item.title}</Radio.Button>;
                })}
              </Radio.Group>
            </div>
            <span>
              <Search
                placeholder="在此搜索图标"
                allowClear
                onSearch={onSearch}
                onChange={onChange}
                style={{ width: 180 }}
              />
            </span>
          </div>
        </div>
        <div>
          {lineStyle === "outLined" && defaultIcon && renderOutlinedIcons}
          {lineStyle === "Filled" && defaultIcon && renderFilledIcons}
          {lineStyle === "Iconfont"&& iconFont && renderIconfont}
          {extraList.map((item:any) => {
            return <>{lineStyle === item.key && renderSVG(item.key, extraLoading, extraDataListMap)}</>;
          })}
          {comExtraList.map((item:any) => {
            return <>{lineStyle === item.key && renderSVG(item.key, comExtraLoading, comExtraDataListMap)}</>;
          })}
        </div>
      </Drawer>
    </div>
  );
}
