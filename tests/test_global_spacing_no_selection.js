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
  const chartData = JSON.parse(fs.readFileSync(__dirname + '/row6_bug2.json', 'utf8'));

  async function reload(){
    window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
    await wait(50);
    window.eval('clearSelection()');
    await wait(10);
  }

  console.log('=== Test 1: NO selection, seat spacing moves manually-moved seats in row 6 ===');
  await reload();
  console.log('selection size:', window.eval('selection.size'));
  const timpaniId = window.eval("chart.seats.find(s=>s.preset==='Timpani').id");
  const otherManualId = window.eval("chart.seats.filter(s=>s.row===5 && s.preset!=='Timpani')[0].id");
  const before1 = window.eval(`getSeat('${otherManualId}').x`);
  const slider1 = doc.getElementById('seatSpacing');
  slider1.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider1.value = 90;
  slider1.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const after1 = window.eval(`getSeat('${otherManualId}').x`);
  console.log('Manually-moved seat x before/after (no selection, seat spacing):', before1, '->', after1);
  const test1 = before1 !== after1;
  console.log('Manually-moved seat moved with NO selection:', test1);
  console.log('chart.seatSpacing updated:', window.eval('chart.seatSpacing'));

  console.log('=== Test 2: NO selection, row spacing moves manually-moved seats ===');
  await reload();
  const before2 = window.eval(`getSeat('${otherManualId}').y`);
  const slider2 = doc.getElementById('rowSpacingSlider');
  slider2.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider2.value = 110;
  slider2.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const after2 = window.eval(`getSeat('${otherManualId}').y`);
  console.log('Manually-moved seat y before/after (no selection, row spacing):', before2, '->', after2);
  const test2 = before2 !== after2;
  console.log('Manually-moved seat moved with NO selection:', test2);

  console.log('=== Test 3: NO selection, stage spacing moves manually-moved seats ===');
  await reload();
  const before3 = window.eval(`getSeat('${otherManualId}').y`);
  const slider3 = doc.getElementById('stageSpacingSlider');
  slider3.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider3.value = 110;
  slider3.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const after3 = window.eval(`getSeat('${otherManualId}').y`);
  console.log('Manually-moved seat y before/after (no selection, stage spacing):', before3, '->', after3);
  const test3 = before3 !== after3;
  console.log('Manually-moved seat moved with NO selection:', test3);

  console.log('=== Test 4: freeform chairs move with seat spacing (no selection) ===');
  await reload();
  const freeformId = window.eval("chart.seats.find(s=>s.row===-1).id");
  const before4 = JSON.parse(window.eval(`JSON.stringify({x:getSeat('${freeformId}').x, y:getSeat('${freeformId}').y})`));
  const slider4 = doc.getElementById('seatSpacing');
  slider4.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider4.value = 130;
  slider4.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const after4 = JSON.parse(window.eval(`JSON.stringify({x:getSeat('${freeformId}').x, y:getSeat('${freeformId}').y})`));
  console.log('Freeform chair before/after (seat spacing):', before4, after4);
  const test4 = before4.x !== after4.x || before4.y !== after4.y;
  console.log('Freeform chair moved with seat spacing:', test4);

  console.log('=== Test 5: freeform chairs move with row spacing (no selection) ===');
  await reload();
  const before5 = JSON.parse(window.eval(`JSON.stringify({x:getSeat('${freeformId}').x, y:getSeat('${freeformId}').y})`));
  const slider5 = doc.getElementById('rowSpacingSlider');
  slider5.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider5.value = 120;
  slider5.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const after5 = JSON.parse(window.eval(`JSON.stringify({x:getSeat('${freeformId}').x, y:getSeat('${freeformId}').y})`));
  console.log('Freeform chair before/after (row spacing):', before5, after5);
  const test5 = before5.x !== after5.x || before5.y !== after5.y;
  console.log('Freeform chair moved with row spacing:', test5);

  console.log('=== Test 6: freeform chairs move with stage spacing (already worked, re-verify) ===');
  await reload();
  const before6 = window.eval(`getSeat('${freeformId}').y`);
  const slider6 = doc.getElementById('stageSpacingSlider');
  slider6.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider6.value = 110;
  slider6.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const after6 = window.eval(`getSeat('${freeformId}').y`);
  const test6 = before6 !== after6;
  console.log('Freeform chair moved with stage spacing:', test6);

  console.log('=== Test 7: WITH an explicit selection (not the whole chart), unselected manual seats stay untouched ===');
  await reload();
  const arcRowIds = window.eval("chart.seats.filter(s=>s.row===0).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(arcRowIds)})`);
  await wait(10);
  const before7 = window.eval(`getSeat('${otherManualId}').x`);
  const slider7 = doc.getElementById('seatSpacing');
  slider7.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider7.value = 130;
  slider7.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const after7 = window.eval(`getSeat('${otherManualId}').x`);
  const test7 = before7 === after7;
  console.log('Row6 manual seat untouched when a DIFFERENT row is explicitly selected:', test7);

  const pass = test1 && test2 && test3 && test4 && test5 && test6 && test7;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
