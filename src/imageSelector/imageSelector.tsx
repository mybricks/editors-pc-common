import { isValid } from '../utils';
// import { message, Modal, Button } from 'antd'
import { useComputed, useObservable } from '@mybricks/rxui';
import React, {
  useCallback,
  // useCallback,
  useEffect,
} from 'react';
import { createPortal } from 'react-dom';
import css from './index.less';
import { EditorProps } from '@/interface';
// import {uploadFilesToCDN} from '@fangzhou/sdk';
// import { uuid } from '../utils';
import UploadModal from '../components/upload-modal';

class Ctx {
  node: any;
  isError: boolean = false;
  showPic: boolean = false;
  picStyle: any;
}

export default function ({ editConfig }: EditorProps): any {
  // let container: any = null
  const { value, options = {} } = editConfig;
  const { readonly, fileType } = options;
  // const { env = 'dev' } = config
  // const env = 'dev';

  const model: any = useObservable({ value });
  const modalContext = useObservable({
    visible: false,
    // url: '',
    type: '',
    title: '',
  });
  const ctx: Ctx = useObservable(Ctx, (next) => {
    next({
      node: void 0,
      isError: true,
      showPic: false,
      picStyle: {},
    });
  });

  useComputed(() => {
    const val = value.get();
    model.val = isValid(val) ? val : '';
  });

  const getStyle = useCallback(() => {
    if (!ctx.node) return;
    const po = ctx.node.getBoundingClientRect();
    ctx.picStyle = {
      position: 'fixed',
      left: po.x,
      top: po.y + po.height,
      width: po.width,
    };
    ctx.showPic = true;
  }, []);

  // const paste = useCallback((e) => {
  //   const cbd = e.clipboardData

  //   if (!(e.clipboardData && e.clipboardData.items)) return
  //   if(cbd.items && cbd.items.length === 2 && cbd.items[0].kind === "string" && cbd.items[1].kind === "file" && cbd.types && cbd.types.length === 2 && cbd.types[0] === "text/plain" && cbd.types[1] === "Files") return
  //   for(let i = 0; i < cbd.items.length; i++) {
  //     const item = cbd.items[i]
  //     if(item.kind == "file"){
  //       const file = item.getAsFile()
  //       if (file?.size === 0) return
  //       upload(file, modalContext)
  //       e.target.value = ''
  //     }
  //   }
  // }, [])

  useEffect(() => {
    switch (fileType) {
      case 'image':
        modalContext.type = 'image/*';
        modalContext.title = '上传图片';
        break;
      case 'video':
        modalContext.type = 'video/*';
        modalContext.title = '上传视频';
        break;
      default:
        modalContext.type = 'image/*';
        modalContext.title = '上传图片';
        break;
    }
  }, []);

  return (
    <div className={css['editor-upload']}>
      <div
        ref={(node) => (ctx.node = node)}
        className={css.container}
        onMouseEnter={() => {
          getStyle();
        }}
        onMouseLeave={() => {
          ctx.showPic = false;
        }}
      >
        <input
          className={css.input}
          value={model.val}
          onFocus={(e) => {
            e.target?.select && e.target.select();
          }}
          onChange={(e) => {
            model.val = e.target.value;
          }}
          onBlur={() => {
            model.value.set(model.val);
          }}
          onKeyUp={(e) => {
            if (e.key === 'Enter' && e.code === 'Enter') {
              // @ts-ignore
              e.target.blur && e.target.blur();
            }
          }}
        />
        <button
          className={css.btn}
          onClick={() => {
            !readonly && (modalContext.visible = true);
          }}
        >
          上传
        </button>
      </div>
      {ctx.showPic &&
        createPortal(
          <div
            className={css.pic}
            style={{ ...ctx.picStyle, display: ctx.showPic ? 'block' : 'none' }}
          >
            <img
              style={{ display: ctx.isError ? 'none' : 'block' }}
              src={model.val}
              onError={() => {
                ctx.isError = true;
              }}
              onLoad={() => {
                ctx.isError = false;
              }}
            />
            <div style={{ display: !ctx.isError ? 'none' : 'block' }}>
              请上传图片或填入正确图片地址
            </div>
          </div>,
          document.body
        )}
      {/* {model.val ? (<div
        className={css['editor-upload__img']}
        style={{
          backgroundImage: modalContext.type === 'image/*' ? `url(${model.val})`
          : (modalContext.type === 'video/*' ?
          `url('http://power-os.oss-cn-hangzhou.aliyuncs.com/poweros/57aa82b6-2b8a-4807-9b88-156ba6540469.png')`
          : undefined)
        }}
        onClick={() => {
          !readonly && (modalContext.visible = true)
        }}
      />) : (
        <div
          className={css['editor-upload__btn']}
          style={{cursor: readonly ? 'default' : 'pointer'}}
          onClick={() => {
            !readonly && (modalContext.visible = true)
          }}>
          +
        </div>
      )} */}
      {/* <input
        type='file'
        accept={modalContext.type}
        ref={(node) => container = node}
        className={css['editor-upload__input']}
        onChange={(evt) => {
          const file: any = (evt.target && evt.target.files && evt.target.files[0]) || null
          if (file) {
            upload(file, modalContext)
            evt.target.value = ''
          }
        }}
      /> */}
      <UploadModal
        type="image/*"
        title="上传图片"
        visible={modalContext.visible}
        onOk={(url) => {
          const type = Object.prototype.toString.call(url);
          
          let val;

          switch (type) {
            case '[object String]':
              if (url.length) {
                val = url;
              }
              break;
            case '[object Object]':
              if (typeof url.b64 === "string") {
                val = url.b64;
              }
              break;
            default:
              break;
          }

          if (val) {
            model.val = val;
            model.value.set(model.val);
            modalContext.visible = false;
          }
        }}
        onCancel={() => {
          modalContext.visible = false;
        }}
      />
    </div>
  );
}

// function resetTextArea(e: any) {
//   e.value = ''
// }

// function upload(file: any, modalContext: any) {

//   uploadFilesToCDN([file], {allowHash: "true"} ).then(res => {
//     if (res && res.result === 1 && res.data.success) {
//       const data = res.data.fileResults || []
//       const url = data.map((item: any) => item.cdnUrl);
//       if (url.length) {
//         modalContext.url = url
//         message.success('上传成功')
//       } else {
//         message.error(`上传失败，请稍后重试！${res.statusText}`)
//       }
//     } else {
//       message.error(`上传失败，请稍后重试！${res.statusText}`)
//     }
//   });
// }

// <Modal
//         title={modalContext.title}
//         visible={modalContext.visible}
//         width={520}
//         bodyStyle={{
//           padding: '8px 24px'
//         }}
//         footer={[
//           <div className={css['editor-upload__footBtn']} key="button">
//             <div
//               className={`${css['editor-upload__footBtn-determine']} ${css.custom_antd_button}`}
//               // style={modalContext.url?.length ? {} : disabledStyle}
//               style={{width: 100}}
//             >
//               <Button
//                 onClick={() => {
// if (!modalContext.url?.length) return
// model.val = modalContext.url
// model.value.set(model.val)
// modalContext.url = ''
// modalContext.visible = false
//                 }}
//                 disabled={modalContext.url?.length ? false : true}
//                 size="small"
//               >确定</Button>
//             </div>
//           </div>
//         ]}
//         onCancel={() => {
//           modalContext.visible = false
//           modalContext.url = ''
//         }}
//       >
//         {/* <div className={css['editor-upload__modalbtn']} onClick={() => {
//           container?.click()
//         }}>文件选择</div> */}
//         <div className={css.custom_antd_button} style={{width: 100}}>
//           <Button
//             onClick={() => {
//               container?.click()
//             }}
//             size="small"
//           >文件选择</Button>
//         </div>
//         {
//           modalContext.type === 'image/*' ?
//           <div className={css['editor-upload__modal']}>
//             <textarea
//               onPaste={paste}
//               className={css['editor-upload__modal-text']}
//               ref={e => {
//                 if (modalContext.visible) {
//                   e?.focus()
//                 } else if (e) {
//                   resetTextArea(e)
//                 }
//               }}
//             />
//             <div className={css['editor-upload__modal-placeholder']}>
//               {!modalContext.url?.length ?
//                 <div className={css['editor-upload__modal-placeholder-text']}>
//                   <div>可直接粘贴截屏内容</div>
//                   <div>若粘贴后未响应请点击此处后再试</div>
//                 </div> :
//                 <div className={css['editor-upload__modal-placeholder-img']} style={{backgroundImage:`url(${modalContext.url})`}}/>
//               }
//             </div>
//           </div>
//           :
//           <div className={css['editor-upload__modal']}
//             style={{
//               border: '1px dashed #999999',
//               width: '100%',
//               height: '200px',
//               marginTop: '10px'
//             }}>
//             {!modalContext.url?.length ?
//             <div className={css['editor-upload__modal-placeholder-text']}>
//               <div>请选择本地文件</div>
//             </div>
//             :
//             <div
//               style={{
//                 border: "1px solid black",
//                 backgroundColor: "black",
//                 width: '100%',
//                 height: 0,
//                 position: 'relative',
//                 paddingTop: '200px'
//               }}
//             >
//               <video
//                 controls
//                 {...{
//                   height: "100%",
//                   width: "100%",
//                   preload: "metadata"
//                 }}
//                 style={{objectFit: 'contain', position: "absolute", top: "0px"} }
//                 src={modalContext.url || undefined}
//               />
//             </div>
//             }
//           </div>
//         }
//       </Modal>
