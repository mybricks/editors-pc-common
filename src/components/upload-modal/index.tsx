import React, { useCallback, useEffect, useMemo } from "react";
import { message, Modal, Button, Switch } from "antd";
import { IgnoreObservable, useObservable, uuid } from "@mybricks/rxui";

import css from "./index.less";
import { NS_MB_Emits } from "../../types";

import { blobToBase64 } from "../../utils";

type UploadType = "image/*" | "video/*";

class Ctx {
  url?: string;

  base64: string;

  @IgnoreObservable
  imgBlob;

  title!: string;

  container?: any;
  type!: UploadType;
  visible!: boolean;
  compress: boolean;
  emitProject: NS_MB_Emits.Project;
}

export default function UploaderModal({
  title,
  value,
  type,
  visible,
  onOk,
  onCancel,
  fileSizeLimit,
  useBase64Only,
  upload: PropsUpload,
}) {
  const ctx: Ctx = useObservable(Ctx, (next) => {
    next({
      upload: PropsUpload,
      type,
      title,
      url: "",
      // bgUrl: '',
      container: void 0,
      compress: false,
    });
  });

  useEffect(() => {
    if (visible) {
      ctx.url = value || "";
    }
  }, [visible]);

  const uploadTips = useMemo(() => {
    if (fileSizeLimit && fileSizeLimit > 0) {
      if (fileSizeLimit < 1024) {
        return `文件大小不超过${fileSizeLimit}KB`;
      } else {
        return `文件大小不超过${fileSizeLimit / 1024}MB`;
      }
    }
    return "";
  }, [fileSizeLimit]);

  const beforeUpload = useCallback(
    (file) => {
      return new Promise((resovled, rejected) => {
        if (!fileSizeLimit || fileSizeLimit <= 0) {
          resovled();
          return;
        }

        if (file.size > fileSizeLimit * 1024) {
          rejected(`文件大小超过限制`);
          return;
        }

        resovled();
      });
    },
    [fileSizeLimit]
  );

  const close = useCallback(() => {
    onCancel();
    ctx.url = "";
  }, []);

  const onConfirm = useCallback(() => {
    onOk({
      url: ctx.url,
      b64: ctx.base64,
      imgBlob: ctx.imgBlob,
    });
    ctx.url = "";
  }, []);

  const paste = useCallback((e) => {
    const cbd = e.clipboardData;

    if (!(e.clipboardData && e.clipboardData.items)) return;
    if (
      cbd.items &&
      cbd.items.length === 2 &&
      cbd.items[0].kind === "string" &&
      cbd.items[1].kind === "file" &&
      cbd.types &&
      cbd.types.length === 2 &&
      cbd.types[0] === "text/plain" &&
      cbd.types[1] === "Files"
    )
      return;
    for (let i = 0; i < cbd.items.length; i++) {
      const item = cbd.items[i];
      if (item.kind == "file") {
        const file = item.getAsFile();
        if (file?.size === 0) return;
        beforeUpload(file)
          .then(() => {
            upload(file, ctx);
            e.target.value = "";
          })
          .catch((err) => {
            message.error(err);
            e.target.value = "";
          });
      }
    }
  }, []);

  const hasValue = value !== undefined; // 决定是否展示输入框

  return (
    <>
      <Modal
        title={ctx.title}
        visible={visible}
        className={css.customModal}
        width={520}
        bodyStyle={{ padding: "8px 24px" }}
        footer={[
          <div className={css["editor-upload__footBtn"]} key="button">
            <div
              className={`${css["editor-upload__footBtn-determine"]} ${css.custom_antd_button}`}
              style={{ width: 100 }}
            >
              <Button
                onClick={onConfirm}
                disabled={ctx.base64 ? false : true}
                size="small"
                style={{ width: 70 }}
              >
                确定
              </Button>
            </div>
          </div>,
        ]}
        onCancel={close}
        getContainer={() => document.body}
      >
        <input
          type="file"
          accept={ctx.type}
          ref={(node) => (ctx.container = node)}
          className={css["editor-upload__input"]}
          onChange={(evt) => {
            const file: any =
              (evt.target && evt.target.files && evt.target.files[0]) || null;
            if (file) {
              beforeUpload(file)
                .then(() => {
                  upload(file, ctx);
                  evt.target.value = "";
                })
                .catch((err) => {
                  message.error(err);
                  evt.target.value = "";
                });
            }
          }}
        />
        <div
          className={css.custom_antd_button}
          style={{ display: "flex", alignItems: "center" }}
        >
          {hasValue && (
            <div
              style={{
                display: "flex",
                flex: 1,
                alignItems: "center",
                fontSize: 12,
              }}
            >
              <input
                className={css.input}
                placeholder="图片地址"
                value={ctx.url}
                onChange={(e) => {
                  ctx.url = e.target.value;
                }}
              />
            </div>
          )}
          {/* {ctx.type === 'image/*' && <Switch checked={ctx.compress} onChange={(val) => (ctx.compress = val)} checkedChildren="压缩" unCheckedChildren="原图" style={{ margin: '0 10px' }} />} */}
          <Button
            style={{ width: 70 }}
            onClick={() => {
              ctx.container?.click();
            }}
            size="small"
          >
            文件选择
          </Button>

          {uploadTips && (
            <div className={css["editor-upload__tips"]}>{uploadTips}</div>
          )}
        </div>
        {ctx.type === "image/*" ? (
          <div
            className={css["editor-upload__modal"]}
            onDrop={(evt: any) => {
              evt.preventDefault();
              const file = evt.dataTransfer.files[0];
              if (file?.type && /^(image\/)/.test(file.type)) {
                beforeUpload(file)
                  .then(() => {
                    upload(file, ctx);
                  })
                  .catch((err) => {
                    message.error(err);
                  });
              }
            }}
          >
            <textarea
              onPaste={paste}
              className={css["editor-upload__modal-text"]}
              ref={(e) => {
                if (ctx.visible) {
                  e?.focus();
                } else if (e) {
                  e.value = "";
                }
              }}
            />
            <div className={css["editor-upload__modal-placeholder"]}>
              {
                !ctx.base64 ? (
                  <div className={css["editor-upload__modal-placeholder-text"]}>
                    <div>可直接粘贴截屏内容或拖拽图片文件</div>
                    <div>若粘贴后未响应请点击此处后再试</div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      className={css["editor-upload__modal-placeholder-img"]}
                      src={ctx.base64}
                      alt="请确认图片地址是否正确"
                    />
                  </div>
                )
                // <div className={css['editor-upload__modal-placeholder-img']} style={{ backgroundImage: ctx.bgUrl }} />
              }
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

async function upload(file: any, ctx: Ctx) {
  try {
    if (typeof ctx.upload === "function" && !useBase64Only) {
      const [url] = await ctx.upload([file], { compress: ctx.compress });
      ctx.url = url;
      ctx.base64 = url;
      ctx.imgBlob = file;
    } else {
      const filePath = `images/${uuid()}.png`;

      blobToBase64(file).then((b64) => {
        ctx.url = filePath;
        ctx.base64 = b64;
        ctx.imgBlob = file;
      });
    }

    return;
  } catch (e) {
    message.error(`上传失败，请稍后重试！${e}`);
  }
}
