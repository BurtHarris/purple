const { expect } = require('chai');
const { createPreviewScheduler } = require('../../lib/paletteEditor/previewScheduler');

describe('previewScheduler', function() {
  it('debounces writes and calls writeFn with last value', function(done) {
    this.timeout(3000);
    const calls = [];
    const writeFn = async (obj) => { calls.push(obj); };
    const scheduler = createPreviewScheduler({ writeFn, debounceMs: 100 });

    scheduler.schedule({ a: 1 });
    scheduler.schedule({ a: 2 });
    scheduler.schedule({ a: 3 });

    setTimeout(() => {
      try {
        expect(calls.length).to.equal(1);
        expect(calls[0]).to.deep.equal({ a: 3 });
        done();
      } catch (e) { done(e); }
    }, 300);
  });

  it('flush forces immediate write', async function() {
    const calls = [];
    const writeFn = async (obj) => { calls.push(obj); };
    const scheduler = createPreviewScheduler({ writeFn, debounceMs: 500 });
    scheduler.schedule({ b: 5 });
    await scheduler.flush();
    expect(calls.length).to.equal(1);
    expect(calls[0]).to.deep.equal({ b: 5 });
  });
});
