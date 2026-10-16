(function (root) {
  const pending = new Map();
  let sequence = 0;
  const available = () => typeof root.webkit?.messageHandlers?.exportFile?.postMessage === 'function';
  // Only the native controller calls complete after the user dismisses the sheet.
  function complete(id, status) {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    if (status === 'completed') request.resolve();
    else {
      const error = new Error(status === 'cancelled' ? 'İptal edildi' : 'Dosya aktarılamadı');
      error.name = status === 'cancelled' ? 'AbortError' : 'Error';
      request.reject(error);
    }
  }
  async function send(blob, filename, action) {
    if (!available()) throw new Error('Native export unavailable');
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Dosya okunamadı'));
      reader.readAsDataURL(blob);
    });
    const id = String(++sequence);
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      try { root.webkit.messageHandlers.exportFile.postMessage({ id, filename, action, data }); }
      catch (error) { pending.delete(id); reject(error); }
    });
  }
  root.NativeExport = { available, send, complete };
})(globalThis);
