function copyHtmlByExecCommand(html: string): boolean {
  let copied = false;
  const onCopy = (e: ClipboardEvent) => {
    if (!e.clipboardData) return;
    e.preventDefault();
    e.clipboardData.setData('text/html', html);
    e.clipboardData.setData('text/plain', html);
    copied = true;
  };

  document.addEventListener('copy', onCopy);
  try {
    const ok = document.execCommand('copy');
    return copied && ok;
  } catch (_e) {
    return false;
  } finally {
    document.removeEventListener('copy', onCopy);
  }
}

export function isNotFocusedClipboardError(err: any): boolean {
  const name = String(err?.name || '').toLowerCase();
  const message = String(err?.message || '').toLowerCase();
  return (
    name.includes('notallowed') ||
    message.includes('not focus') ||
    message.includes('not focused') ||
    message.includes('document is not focused')
  );
}

function waitForDocumentFocus(timeoutMs = 5000): Promise<boolean> {
  if (document.hasFocus() && document.visibilityState === 'visible') {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      resolve(ok);
    };
    const onFocus = () => {
      if (document.hasFocus() && document.visibilityState === 'visible') {
        finish(true);
      }
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    try {
      window.focus();
    } catch (_e) {}
  });
}

export async function writeHtmlToClipboard(html: string): Promise<void> {
  const hasClipboardWrite = !!(navigator.clipboard && (window as any).ClipboardItem);
  let lastErr: any = null;

  if (hasClipboardWrite) {
    const clipboardItem = new (window as any).ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([html], { type: 'text/plain' }),
    });
    try {
      await navigator.clipboard.write([clipboardItem]);
      return;
    } catch (err: any) {
      lastErr = err;
      if (isNotFocusedClipboardError(err)) {
        const regainedFocus = await waitForDocumentFocus(6000);
        if (regainedFocus) {
          await navigator.clipboard.write([clipboardItem]);
          return;
        }
      }
    }
  }

  if (copyHtmlByExecCommand(html)) {
    return;
  }

  if (!hasClipboardWrite) {
    throw new Error('当前环境不支持 ClipboardItem，且 execCommand 复制失败');
  }
  throw lastErr || new Error('写入剪贴板失败');
}
