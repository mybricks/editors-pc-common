import React, { CSSProperties, useCallback, useMemo, useState } from "react";

import {
  Panel,
  InputNumber,
  PaddingAllOutlined,
  PaddingTopOutlined,
  PaddingLeftOutlined,
  PaddingRightOutlined,
  PaddingBottomOutlined,
} from "../../style_new/StyleEditor/components";
import { allEqual } from "../../style_new/StyleEditor/utils";

import { Ctx } from "../Style";
import { initValues } from "../utils";
// import GreyContainer from "./greyContainer";
import { observe, useObservable } from "@mybricks/rxui";

import css from "./index.less";

class EditCtx {
  paddingTop!: string;
  paddingBottom!: string;
  paddingLeft!: string;
  paddingRight!: string;
}

export default function () {
  const ctx: Ctx = observe(Ctx, { from: "parents" });
  const editCtx: EditCtx = useObservable(EditCtx, (next) => {
    next(
      initValues(
        {
          paddingTop: "0px",
          paddingBottom: "0px",
          paddingLeft: "0px",
          paddingRight: "0px",
        },
        ctx.val
      )
    );
  });
  const [toggle, setToggle] = useState(getToggleDefaultValue(editCtx));
  const handleChange = useCallback((value: any) => {
    ctx.set({ ...value });
  }, []);

  const paddingConfig = useMemo(() => {
    if (toggle) {
      return (
        <div className={css.row}>
          <Panel.Content style={{ padding: 3 }}>
            <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
              <div
                className={css.icon}
                data-mybricks-tip={`{content:'统一设置',position:'left'}`}
              >
                <PaddingAllOutlined />
              </div>
              <InputNumber
                defaultValue={editCtx.paddingTop}
                onChange={(value) =>
                  handleChange({
                    paddingTop: value,
                    paddingRight: value,
                    paddingBottom: value,
                    paddingLeft: value,
                  })
                }
              />
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'统一设置',position:'left'}`}
            className={css.actionIcon}
            onClick={() => setToggle(false)}
          >
            <PaddingAllOutlined />
          </div>
        </div>
      );
    } else {
      return (
        <div className={css.row}>
          <Panel.Content style={{ padding: 3 }}>
            <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
              <div className={css.icon} data-mybricks-tip={"上边距"}>
                <PaddingTopOutlined />
              </div>
              <InputNumber
                tip="上边距"
                defaultValue={editCtx.paddingTop}
                onChange={(value) => handleChange({ paddingTop: value })}
              />
              <div className={css.icon} data-mybricks-tip={"右边距"}>
                <PaddingRightOutlined />
              </div>
              <InputNumber
                tip="右边距"
                defaultValue={editCtx.paddingRight}
                onChange={(value) => handleChange({ paddingRight: value })}
              />
              <div className={css.icon} data-mybricks-tip={"下边距"}>
                <PaddingBottomOutlined />
              </div>
              <InputNumber
                tip="下边距"
                defaultValue={editCtx.paddingBottom}
                onChange={(value) => handleChange({ paddingBottom: value })}
              />
              <div className={css.icon} data-mybricks-tip={"左边距"}>
                <PaddingLeftOutlined />
              </div>
              <InputNumber
                tip="左边距"
                defaultValue={editCtx.paddingLeft}
                onChange={(value) => handleChange({ paddingLeft: value })}
              />
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'分别设置',position:'left'}`}
            className={css.actionIcon}
            onClick={() => setToggle(true)}
          >
            <PaddingTopOutlined />
          </div>
        </div>
      );
    }
  }, [toggle]);

  return (
    <div className={css.padding}>
      <Panel title="内边距">{paddingConfig}</Panel>
    </div>
  );
}

function getToggleDefaultValue(value: CSSProperties): boolean {
  return allEqual([
    value.paddingTop,
    value.paddingRight,
    value.paddingBottom,
    value.paddingLeft,
  ]);
}
