const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
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

  console.log('=== Set up: select a seat, focus a slider ===');
  window.eval('selectSeat(chart.seats[0])');
  await wait(10);
  const slider = doc.getElementById('seatSpacing');
  slider.focus();
  console.log('Slider has focus:', doc.activeElement === slider);

  console.log('=== Test 1: pressing Escape while slider is focused blurs it (does not clear selection) ===');
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(10);
  const blurredCorrectly = doc.activeElement !== slider;
  console.log('Slider no longer focused:', blurredCorrectly);
  const selectionPreserved = window.eval('selection.size') === 1;
  console.log('Selection was NOT cleared by this Escape press:', selectionPreserved);

  console.log('=== Test 2: pressing Escape AGAIN (slider no longer focused) now clears selection normally ===');
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(10);
  const selectionClearedSecondTime = window.eval('selection.size') === 0;
  console.log('Selection cleared on the second Escape:', selectionClearedSecondTime);

  console.log('=== Test 3: Escape with NO slider focused behaves normally (baseline, unaffected) ===');
  window.eval('selectSeat(chart.seats[0])');
  await wait(10);
  doc.body.focus();
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(10);
  const normalEscapeStillWorks = window.eval('selection.size') === 0;
  console.log('Normal Escape (no slider focus) still clears selection immediately:', normalEscapeStillWorks);

  const pass = blurredCorrectly && selectionPreserved && selectionClearedSecondTime && normalEscapeStillWorks;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
