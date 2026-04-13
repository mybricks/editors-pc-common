import React from 'react';
import { figmaButtonStyle } from './styles';
import type { FigmaImportItem } from '../types';

export interface SyncFromFigmaBtnProps {
  onSync: (items: FigmaImportItem[]) => void;
}

const PLUGIN_URL = 'https://p66-ec.becukwai.com/udata/pkg/eshop/VibeUI/1.0.0/VibeUI.zip';

function showPluginModal() {
  const Modal = (window as any).antd?.Modal;
  const h = (window as any).React?.createElement;
  if (!Modal || !h) return;

  const wrapCls = 'vibeui-modal-rounded';
  if (!document.getElementById(wrapCls)) {
    const s = document.createElement('style');
    s.id = wrapCls;
    s.textContent = `.${wrapCls} .ant-modal-content { border-radius: 15px !important; overflow: hidden; }`;
    document.head.appendChild(s);
  }

  const InfoCircleOutlined = (window as any).icons?.InfoCircleOutlined;
  const icon = InfoCircleOutlined ? h(InfoCircleOutlined, { style: { color: 'var(--mybricks-color-primary)' } }) : null;

  Modal.info({
    title: 'VibeUI Figma 插件使用教程',
    width: 520,
    okText: '知道了',
    wrapClassName: wrapCls,
    icon,
    okButtonProps: {
      style: {
        backgroundColor: 'var(--mybricks-color-primary)',
        borderColor: 'var(--mybricks-color-primary)',
        borderRadius: '8px',
      },
    },
    content: h('div', { style: { lineHeight: '1.8', fontSize: '14px' } },
      h('div', { style: { marginBottom: 12, padding: '10px 12px', backgroundColor: 'var(--mybricks-background2, #f5f7fa)', borderRadius: 8 } },
        h('div', { style: { fontSize: 13, color: 'var(--mybricks-font-color2, #666)', marginBottom: 6 } },
          '下载完成后，点击浏览器右上角的', h('b', null, '下载图标'), '，找到 ', h('b', null, 'VibeUI.zip'), ' 文件：'),
        h('img', { src: 'https://p66-ec.becukwai.com/udata/pkg/eshop/VibeUI/image001.png', style: { width: '100%', borderRadius: 6, border: '1px solid var(--mybricks-border-color, #e0e0e0)', display: 'block' } }),
      ),
      h('h3', { style: { marginTop: 12, marginBottom: 4 } }, '安装步骤'),
      h('ol', { style: { paddingLeft: 20 } },
        h('li', null, '解压下载的 ', h('b', null, 'VibeUI.zip')),
        h('li', null, '打开 Figma，点击菜单 ', h('b', null, 'Plugins → Development → Import plugin from manifest…')),
        h('li', null, '选择解压后文件夹中的 ', h('b', null, 'manifest.json'), ' 文件'),
        h('li', null, '插件安装成功后，可在 ', h('b', null, 'Plugins → VibeUI'), ' 中找到并运行'),
      ),
      h('h3', { style: { marginTop: 12, marginBottom: 4 } }, '使用说明'),
      h('ul', { style: { paddingLeft: 20 } },
        h('li', null,
          h('b', null, '灵创 → Figma'),
          '：在画布中选中页面，点击 ', h('b', null, '复制到 Figma'),
          '，然后在 Figma 中直接按 ', h('b', null, 'Ctrl + V'), ' 粘贴即可，', h('b', null, '无需插件'),
        ),
        h('li', null,
          h('b', null, 'Figma → 灵创'),
          '：需要安装 VibeUI 插件。在 Figma 中打开插件，复制样式数据，回到灵创点击 ', h('b', null, '从 Figma 同步样式'),
        ),
      ),
    ),
  });
}

const FigmaLogo = () => (
  <svg width="10" height="15" viewBox="0 0 38 57" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE" />
    <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0ACF83" />
    <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262" />
    <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E" />
    <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF" />
  </svg>
);

function DownloadPluginBtn() {
  const [loading, setLoading] = React.useState(false);

  const handleDownload = () => {
    if (loading) return;
    const message = (window as any).antd?.message;
    setLoading(true);
    fetch(PLUGIN_URL)
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = 'VibeUI.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        setLoading(false);
        if (message) message.success('VibeUI Figma 插件下载成功，请打开下载文件夹查看');
        showPluginModal();
      })
      .catch(() => {
        window.open(PLUGIN_URL, '_blank');
        setLoading(false);
        if (message) message.success('已在新标签页中开始下载');
        showPluginModal();
      });
  };

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleDownload}
      data-mybricks-tip={`{content:'下载 Figma 插件',position:'left'}`}
      style={{
        ...figmaButtonStyle,
        width: 'auto',
        flex: 'none',
        gap: 4,
        opacity: loading ? 0.6 : 1,
        cursor: loading ? 'not-allowed' : 'pointer',
        padding: '0 6px',
      }}
    >
      {loading ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ animation: 'vibeui-spin 0.8s linear infinite', display: 'block' }}>
          <style>{`@keyframes vibeui-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      ) : (
        <FigmaLogo />
      )}
      <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
        {loading ? '下载中' : '下载插件'}
      </span>
    </button>
  );
}

export function SyncFromFigmaBtn({ onSync }: SyncFromFigmaBtnProps) {
  const handleClick = () => {
    navigator.clipboard.readText().then(
      (text) => {
        if (!text || String(text).trim() === '') {
          alert('剪切板无内容，请先从 Figma 复制后再同步');
          return;
        }
        try {
          const parsed = JSON.parse(text);
          const figmaItems: FigmaImportItem[] = Array.isArray(parsed) ? parsed : [parsed];
          onSync(figmaItems);
        } catch (e) {
          console.error('[从 Figma 同步] 剪切板内容不是合法 JSON', e);
          alert('剪切板内容不是合法 JSON，请确认已从 Figma 正确复制');
        }
      },
      (err) => {
        console.error('[从 Figma 同步] 读取剪切板失败', err);
        alert('读取剪切板失败，请检查浏览器权限或剪切板是否有内容');
      }
    );
  };

  return (
    <div style={{ padding: '4px 0', display: 'flex', gap: 4 }}>
      <button type="button" onClick={handleClick} style={{ ...figmaButtonStyle, flex: 1 }}>
        从 Figma 同步样式
      </button>
      <DownloadPluginBtn />
    </div>
  );
}
