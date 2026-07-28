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

  console.log('=== Set up: assign an instrument to seats 1-3 in row 0 ===');
  window.eval(`
    const seats = chart.seats.filter(s=>s.row===0).sort((a,b)=>a.rowT-b.rowT).slice(0,3);
    seats.forEach(s=>{ s.preset='Violin 1'; s.color='#3EA6CC'; s.label='Vln1'; });
  `);
  window.eval('refreshAutoGroupList()');
  await wait(20);
  const listBefore = doc.getElementById('autoGroupList').innerHTML;
  console.log('Group list before reset:', listBefore.includes('Violin 1 (3)'));

  console.log('=== Test 1: single-seat Reset button fully resets one seat ===');
  const seatIds = window.eval("chart.seats.filter(s=>s.preset==='Violin 1').sort((a,b)=>a.rowT-b.rowT).map(s=>s.id)");
  const targetId = seatIds[0]; // the first (position #1) of this group
  window.eval(`selectSeat(getSeat('${targetId}'))`);
  await wait(10);
  doc.getElementById('clearLabelBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);

  const resetSeat = window.eval(`
    JSON.stringify({ preset: getSeat('${targetId}').preset, color: getSeat('${targetId}').color, label: getSeat('${targetId}').label })
  `);
  console.log('Seat after reset:', resetSeat);
  const parsed = JSON.parse(resetSeat);
  console.log('Preset cleared:', parsed.preset === '');
  console.log('Color reset to default (#B9AF95):', parsed.color === '#B9AF95');
  console.log('Label restored to plain row-position number:', parsed.label === '1');

  console.log('=== Test 2: group count updates after single reset ===');
  const listAfterSingle = doc.getElementById('autoGroupList').innerHTML;
  console.log('Group list after single reset:', listAfterSingle);
  const countUpdatedSingle = listAfterSingle.includes('Violin 1 (2)');
  console.log('Group count correctly dropped to 2:', countUpdatedSingle);

  console.log('=== Test 3: batch Reset Seats resets multiple seats and updates group count ===');
  const remainingIds = window.eval("chart.seats.filter(s=>s.preset==='Violin 1').map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(remainingIds)})`);
  await wait(10);
  doc.getElementById('batchClearLabelBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  const afterBatch = window.eval(`
    JSON.stringify(${JSON.stringify(remainingIds)}.map(id=>({preset:getSeat(id).preset, color:getSeat(id).color, label:getSeat(id).label})))
  `);
  console.log('Seats after batch reset:', afterBatch);
  const batchParsed = JSON.parse(afterBatch);
  const allReset = batchParsed.every(s=>s.preset==='' && s.color==='#B9AF95');
  console.log('All seats fully reset (preset+color):', allReset);
  const labelsAreNumbers = batchParsed.every(s=>/^\d+$/.test(s.label));
  console.log('All labels are plain numbers:', labelsAreNumbers);

  const listAfterBatch = doc.getElementById('autoGroupList').innerHTML;
  console.log('Group list after batch reset:', listAfterBatch);
  const groupGone = !listAfterBatch.includes('Violin 1');
  console.log('Violin 1 group entirely gone from the list:', groupGone);

  console.log('=== Test 4: seats were NOT deleted ===');
  const totalSeatsIntact = window.eval(`${JSON.stringify(remainingIds)}.every(id=>!!getSeat(id))`);
  console.log('All seats still exist:', totalSeatsIntact);

  const pass = parsed.preset==='' && parsed.color==='#B9AF95' && parsed.label==='1' &&
               countUpdatedSingle && allReset && labelsAreNumbers && groupGone && totalSeatsIntact;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
