const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/test.html', 'utf8');
const noop = () => {};
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop,
  arc: noop, rect: noop, fillRect: noop, strokeRect: noop, fillText: noop, setLineDash: noop,
  measureText: () => ({ width: 10 }), clearRect: noop, drawImage: noop, ellipse: noop, roundRect: noop,
  bezierCurveTo: noop, quadraticCurveTo: noop,
  getImageData(x,y,w,h){ return { data: new Uint8ClampedArray(w*h*4).fill(128), width:w, height:h }; },
  putImageData: noop,
};
const dom = new JSDOM(html, {
  url: 'https://example.github.io/seating-chart/',
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  beforeParse(window){
    window.HTMLCanvasElement.prototype.getContext = function(){
      return new Proxy(fakeCtxProto, {
        get(target, prop){
          if(prop in target) return target[prop];
          if(typeof prop === 'string' && (prop.endsWith('Style')||prop==='font'||prop==='lineWidth'||prop==='lineCap'||prop==='globalAlpha'||prop==='textAlign'||prop==='textBaseline')) return '';
          return noop;
        }, set(){ return true; }
      });
    };
  }
});
const { window } = dom;
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
(async()=>{
  await wait(300);
  const doc = window.document;

  console.log('=== Set up: select a seat, focus the slider (matching real browser behavior) ===');
  window.eval('selectSeat(chart.seats[0])');
  await wait(10);
  const slider = doc.getElementById('seatSpacing');
  slider.focus();
  console.log('Slider has focus:', doc.activeElement === slider);

  console.log('=== Test: dispatch Escape keydown DIRECTLY ON THE SLIDER (realistic e.target) ===');
  // This matches what a real browser does: the focused element IS the event target,
  // not window -- my earlier test incorrectly dispatched on window directly, masking
  // the actual bug (the input/textarea/select early-exit guard skipping the check).
  slider.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(10);
  const blurredCorrectly = doc.activeElement !== slider;
  console.log('Slider no longer focused after Escape (dispatched on slider itself):', blurredCorrectly);
  const selectionPreserved = window.eval('selection.size') === 1;
  console.log('Selection was NOT cleared by this Escape press:', selectionPreserved);

  console.log('=== Test 2: second Escape (nothing focused) now clears selection ===');
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(10);
  const clearedNow = window.eval('selection.size') === 0;
  console.log('Selection cleared on the follow-up Escape:', clearedNow);

  console.log('=== Test 3: text input fields still correctly ignore this global handler (regression check) ===');
  window.eval('selectSeat(chart.seats[0])');
  await wait(10);
  const textInput = doc.getElementById('labelInput');
  textInput.value = 'test value';
  textInput.focus();
  textInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(10);
  const textInputUnaffected = textInput.value === 'test value' && window.eval('selection.size') === 1;
  console.log('Text input escape did not trigger global clearSelection (still correctly ignored):', textInputUnaffected);

  const pass = blurredCorrectly && selectionPreserved && clearedNow && textInputUnaffected;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
