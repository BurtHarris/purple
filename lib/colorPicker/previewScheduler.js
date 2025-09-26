/* lib/colorPicker/previewScheduler.js
   Small debounced scheduler for preview writes.
   createPreviewScheduler({ writeFn, debounceMs = 120 }) => { schedule, flush, dispose }
*/

module.exports.createPreviewScheduler = function createPreviewScheduler({ writeFn, debounceMs = 120 } = {}) {
  let timer = null;
  let pending = null;
  let disposed = false;

  const schedule = (obj) => {
    if (disposed) return;
    pending = obj;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      const toSend = pending;
      pending = null;
      try { await writeFn(toSend); } catch (e) { /* ignore */ }
    }, debounceMs);
  };

  const flush = async () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending) {
      const toSend = pending;
      pending = null;
      try { await writeFn(toSend); } catch (e) { /* ignore */ }
    }
  };

  const dispose = () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };

  return { schedule, flush, dispose };
};
