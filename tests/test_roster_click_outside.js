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

  console.log('=== Test 1: opening the panel via toggle button ===');
  doc.getElementById('rosterToggleBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  console.log('Panel open:', doc.getElementById('rosterPanel').classList.contains('show'));

  console.log('=== Test 2: clicking OUTSIDE the panel closes it ===');
  const outsideEl = doc.getElementById('chart'); // the canvas, clearly outside the panel
  outsideEl.dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  console.log('Panel closed after outside click:', !doc.getElementById('rosterPanel').classList.contains('show'));

  console.log('=== Test 3: clicking INSIDE the panel does NOT close it ===');
  doc.getElementById('rosterToggleBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  console.log('Panel reopened:', doc.getElementById('rosterPanel').classList.contains('show'));
  doc.getElementById('rosterPanel').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  console.log('Panel STILL open after clicking inside it:', doc.getElementById('rosterPanel').classList.contains('show'));

  console.log('=== Test 4: clicking the section select (inside panel) does not close it ===');
  doc.getElementById('rosterSectionSelect').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  console.log('Panel still open after interacting with its own controls:', doc.getElementById('rosterPanel').classList.contains('show'));

  console.log('=== Test 5: clicking the toggle button again closes it (not reopened by the outside-click listener) ===');
  doc.getElementById('rosterToggleBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  console.log('Panel closed via toggle button:', !doc.getElementById('rosterPanel').classList.contains('show'));

  const pass = !doc.getElementById('rosterPanel').classList.contains('show');
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
