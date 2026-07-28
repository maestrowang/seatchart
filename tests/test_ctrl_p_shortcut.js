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

  console.log('=== Test 1: Ctrl+P opens the app print dialog and prevents default ===');
  const event1 = new window.KeyboardEvent('keydown', { key: 'p', ctrlKey: true, bubbles: true, cancelable: true });
  const defaultPrevented1 = !window.dispatchEvent(event1); // dispatchEvent returns false if preventDefault was called
  await wait(20);
  const overlayVisible1 = doc.getElementById('exportOptionsOverlay').classList.contains('show');
  const titleText1 = doc.getElementById('exportOptionsTitle').textContent;
  console.log('preventDefault called:', defaultPrevented1);
  console.log('Print dialog overlay visible:', overlayVisible1);
  console.log('Dialog title:', titleText1);
  const isCorrectDialog1 = titleText1 === 'Print Chart';

  doc.getElementById('exportOptionsCancelBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);

  console.log('=== Test 2: Cmd+P (metaKey) also works, e.g. on Mac ===');
  const event2 = new window.KeyboardEvent('keydown', { key: 'p', metaKey: true, bubbles: true, cancelable: true });
  const defaultPrevented2 = !window.dispatchEvent(event2);
  await wait(20);
  const overlayVisible2 = doc.getElementById('exportOptionsOverlay').classList.contains('show');
  console.log('preventDefault called (Cmd+P):', defaultPrevented2);
  console.log('Print dialog opened via Cmd+P:', overlayVisible2);
  doc.getElementById('exportOptionsCancelBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);

  console.log('=== Test 3: works even when focus is on a text field (e.g. Notes textarea) ===');
  const notesInput = doc.getElementById('notesInput');
  notesInput.focus();
  const event3 = new window.KeyboardEvent('keydown', { key: 'p', ctrlKey: true, bubbles: true, cancelable: true });
  Object.defineProperty(event3, 'target', { value: notesInput, enumerable: true });
  const defaultPrevented3 = !notesInput.dispatchEvent(event3);
  await wait(20);
  const overlayVisible3 = doc.getElementById('exportOptionsOverlay').classList.contains('show');
  console.log('Works even with a text field focused:', overlayVisible3);
  doc.getElementById('exportOptionsCancelBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);

  console.log('=== Test 4: plain "p" without Ctrl/Cmd does NOT trigger the print dialog ===');
  const event4 = new window.KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true });
  window.dispatchEvent(event4);
  await wait(20);
  const overlayVisible4 = doc.getElementById('exportOptionsOverlay').classList.contains('show');
  console.log('Plain "p" key does NOT open the dialog:', !overlayVisible4);

  const pass = defaultPrevented1 && overlayVisible1 && isCorrectDialog1 && defaultPrevented2 && overlayVisible2 && overlayVisible3 && !overlayVisible4;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
