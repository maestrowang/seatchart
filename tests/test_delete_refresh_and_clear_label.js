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

  console.log('=== Set up: assign an instrument to 3 seats ===');
  window.eval(`
    const seats = chart.seats.slice(0,3);
    seats.forEach(s=>{ s.preset='Violin 1'; s.color='#3EA6CC'; });
  `);
  window.eval('refreshAutoGroupList()');
  await wait(20);

  console.log('=== Test: keyboard delete refreshes the group count ===');
  const listBefore = doc.getElementById('autoGroupList').innerHTML;
  console.log('Auto-group list before delete:', listBefore.includes('Violin 1 (3)'));

  const seatToDelete = window.eval("chart.seats.filter(s=>s.preset==='Violin 1')[0].id");
  window.eval(`setSelection(['${seatToDelete}'])`);
  await wait(10);
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
  await wait(20);
  const listAfter = doc.getElementById('autoGroupList').innerHTML;
  console.log('Auto-group list after keyboard delete:', listAfter);
  const countUpdated = listAfter.includes('Violin 1 (2)');
  console.log('Group count correctly updated to 2:', countUpdated);

  const pass = countUpdated;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
