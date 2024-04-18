import React, { useEffect, useCallback } from "react";
import { AutoComplete, Button, Input } from "antd";
import { useObservable } from "@mybricks/rxui";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { isValid, deepCopy } from "../utils";
import css from "./index.less";
import { world } from "../textArea/icons";

interface InputRenderProps {
  type: "text" | "auto";
  options: any;
  notEditable: boolean;
  placeholder: string;
  key: "v" | "k";
  idx: number;
}

interface i18nType {
  id: string;
}

export default function ({ editConfig }: any): any {
  const { value, options = {}, locales } = editConfig;
  const {
    kType = "text",
    vType = "text",
    kOption,
    option,
    readonly = false,
    notaddel = false,
    noteditkey = false,
    noteditvalue = false,
    allowEmptyString = false,
    locale = false,
  } = options;

  const modelVal = isValid(value.get()) ? deepCopy(value.get()) : {};
  const model: any = useObservable(
    {
      val: modelVal,
      k: [],
      v: [],
      kAutoOptions: kOption,
      vAutoOptions: option,
      value,
    },
    [value]
  );

  const autoChange = useCallback((v: string, idx: number, key: "v" | "k") => {
    model[key][idx] = v;
    update();
  }, []);

  const localeEnable = !!locales && !!locale; // 是否启用多语言
  // 打开多语言半屏旋转页面
  const openLocale = useCallback(
    (val: i18nType, index: number) => {
      if (!locales?.edit) {
        console.error(`未找到 locales.edit`);
        return;
      }
      locales.edit({
        value: {
          get() {
            return {
              val,
              curText: getI18nText(val),
            };
          },
          set(item: { id: string }) {
            // 返回带id的就更新对应value 不带id就置“”
            model["v"][index] = item?.id
              ? {
                  id: item?.id,
                }
              : "";
            update();
          },
        },
      });
    },
    [locales]
  );

  // 后面按钮 点击触发 openLocale 选中高亮色
  const addonAfter = useCallback(
    (useLocale = false, val: i18nType, index: number) => {
      return localeEnable ? (
        <span
          className={`${useLocale ? css.useLocale : ""} ${css.icon}`}
          onClick={() => {
            openLocale(val, index);
          }}
          data-mybricks-tip={`多语言`}
        >
          {world}
        </span>
      ) : (
        void 0
      );
    },
    [localeEnable]
  );

  const getI18nText = useCallback(
    (val: i18nType): string => {
      if (!val?.id) {
        // 没有id
        return typeof val === "string" ? val : "";
      }
      const item = locales.searchById(val?.id);
      if (item) {
        return item.getContent("zh");
      } else {
        return `<未找到文案>`;
      }
    },
    [locales]
  );

  const customInput = useCallback(
    ({
      type,
      options,
      notEditable,
      key,
      placeholder,
      idx,
    }: InputRenderProps) => {
      if (type === "text") {
        const isValue = key === "v"; // 是否是键值 只有键值需要配置多语言
        const val = model[key][idx];
        let useLocale = false;
        if (isValue && localeEnable && val && typeof val === "object" && val.id) {
          useLocale = true;
        }
        return (
          <Input
            placeholder={placeholder}
            disabled={readonly || notEditable || useLocale}
            value={useLocale && isValue ? getI18nText(val) : val}
            onChange={(evt) => {
              model[key][idx] = evt.target.value;
            }}
            onKeyPress={(evt) => {
              if (evt.key !== "Enter") return;
              update();
            }}
            onBlur={update}
            addonAfter={isValue && addonAfter(useLocale, val, idx)}
          />
        );
      } else if (type === "auto") {
        return !readonly && !notEditable ? (
          <AutoComplete
            size="small"
            value={model[key][idx]}
            options={model[key][idx] && model[key][idx].length ? [] : options}
            dropdownMatchSelectWidth={200}
            placeholder={placeholder}
            onChange={(v) => autoChange(v, idx, key)}
          />
        ) : (
          <Input
            placeholder={placeholder}
            disabled={readonly || notEditable}
            value={model[key][idx]}
          />
        );
      }
    },
    []
  );

  const update = useCallback(() => {
    const res: any = {};
    model.k.forEach((item: string, idx: number) => {
      const opt = model.kAutoOptions?.find(
        ({ label }: { label: string }) => label === item
      );
      if ((item && item.length) || allowEmptyString) {
        res[opt?.value || item] = model.v[idx];
      }
    });
    model.value.set(res);
  }, []);

  const add = useCallback(() => {
    model.k.push("");
    model.v.push("");
  }, []);

  const del = useCallback((idx: number) => {
    model.k.splice(idx, 1);
    model.v.splice(idx, 1);
    update();
  }, []);

  useEffect(() => {
    model.k = Object.keys(modelVal).map((item) => {
      return (
        model.kAutoOptions?.find(({ value }: { value: any }) => value === item)
          ?.label || item
      );
    });
    model.v = Object.keys(modelVal).map((item) => {
      if (typeof modelVal[item] === "string") {
        return modelVal[item].length ? modelVal[item] : "";
      } else if (modelVal[item]?.id) {
        return modelVal[item];
      }
    });
  }, []);

  return (
    <div className={`${css["editor-map"]} fangzhou-theme`}>
      {model.k.map((item: any, idx: number) => {
        return (
          <div key={`item_${idx}`} className={css["editor-map__item"]}>
            {customInput({
              type: kType,
              options: model.kAutoOptions?.map(
                ({ label }: { label: string }) => ({ label, value: label })
              ),
              notEditable: noteditkey,
              key: "k",
              placeholder: "键名",
              idx,
            })}
            <span className={css["editor-map__item-equal"]}>:</span>
            {customInput({
              type: vType,
              options: model.vAutoOptions,
              notEditable: noteditvalue,
              key: "v",
              placeholder: "键值",
              idx,
            })}
            {!readonly && !notaddel && (
              <div className={css["editor-map__item-del"]}>
                <DeleteOutlined onClick={() => del(idx)} />
              </div>
            )}
          </div>
        );
      })}
      {!readonly && !notaddel && (
        <div className={css["editor-map__add"]}>
          <Button
            icon={<PlusOutlined />}
            type="dashed"
            size="middle"
            block
            onClick={add}
          >
            添加键值对
          </Button>
        </div>
      )}
    </div>
  );
}
