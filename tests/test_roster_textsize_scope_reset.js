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

  console.log('=== Set up: global roster text scale + one seat with its own custom scale ===');
  window.eval(`
    chart.rosterTextScale = 130;
    chart.seats[0].rosterTextScale = 145;
  `);
  await wait(20);

  console.log('=== Test 1: no selection shows the GLOBAL value ===');
  window.eval('selectSeat(null)');
  await wait(10);
  const noSelValue = doc.getElementById('rosterTextSize').value;
  const noSelLabel = doc.getElementById('rosterTextSizeLabel').textContent;
  console.log('Slider value with no selection:', noSelValue, '| label:', noSelLabel);
  const noSelCorrect = noSelValue === '130' && noSelLabel === 'Roster text size';

  console.log('=== Test 2: selecting a seat resets the slider to neutral 100 (scoped) ===');
  window.eval('selectSeat(chart.seats[0])');
  await wait(10);
  const selValue = doc.getElementById('rosterTextSize').value;
  const selLabel = doc.getElementById('rosterTextSizeLabel').textContent;
  console.log('Slider value with seat selected:', selValue, '| label:', selLabel);
  const selCorrect = selValue === '100' && selLabel === 'Roster text size (selected)';

  console.log('=== Test 3: selecting a DIFFERENT seat also resets to 100, not stuck at old value ===');
  window.eval('document.getElementById("rosterTextSize").value = 150;'); // simulate user having adjusted it
  window.eval('selectSeat(null)');
  await wait(10);
  window.eval('selectSeat(chart.seats[1])');
  await wait(10);
  const secondSelValue = doc.getElementById('rosterTextSize').value;
  console.log('Slider value after selecting a new seat:', secondSelValue);
  const secondSelCorrect = secondSelValue === '100';

  console.log('=== Test 4: deselecting again reverts to the global value ===');
  window.eval('selectSeat(null)');
  await wait(10);
  const backToGlobal = doc.getElementById('rosterTextSize').value === '130';
  console.log('Reverted to global value after deselecting:', backToGlobal);

  console.log('=== Test 5: batch (multi-seat) selection also resets to neutral 100 ===');
  window.eval(`setSelection([chart.seats[0].id, chart.seats[1].id])`);
  await wait(10);
  const batchValue = doc.getElementById('rosterTextSize').value;
  console.log('Slider value for batch selection:', batchValue);
  const batchCorrect = batchValue === '100';

  const pass = noSelCorrect && selCorrect && secondSelCorrect && backToGlobal && batchCorrect;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
