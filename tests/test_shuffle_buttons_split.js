const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/test.html', 'utf8');
const noop = () => {};
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop,
  arc: noop, rect: noop, fillRect: noop, strokeRect: noop, fillText: noop, setLineDash: noop,
  measureText: () => ({ width: 20 }), clearRect: noop, drawImage: noop, ellipse: noop, roundRect: noop,
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
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(4, 'straight');
    chart.seats.forEach(s=>{ s.preset='Cello'; s.color='#79CC3E'; });
    chart.rosters['Cello'] = ['A','B','C','D'];
  `);
  await wait(20);
  doc.getElementById('rosterToggleBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  doc.getElementById('rosterSectionSelect').value = 'Cello';
  doc.getElementById('rosterSectionSelect').dispatchEvent(new window.Event('change', {bubbles:true}));
  await wait(20);

  console.log('=== Test 1: dice icon present on Shuffle button ===');
  const shuffleBtnText = doc.getElementById('rosterShuffleBtn').textContent;
  console.log('Shuffle button text:', shuffleBtnText);
  const hasDice = shuffleBtnText.includes('🎲');
  console.log('Has dice icon:', hasDice);

  console.log('=== Test 2: Revert button hidden before shuffling ===');
  const revertHiddenBefore = doc.getElementById('rosterRevertBtn').style.display === 'none';
  console.log('Revert hidden initially:', revertHiddenBefore);

  console.log('=== Test 3: after shuffling, BOTH Shuffle and Revert buttons are visible ===');
  doc.getElementById('rosterShuffleBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  const shuffleStillThere = doc.getElementById('rosterShuffleBtn').textContent.includes('Shuffle');
  const revertVisible = doc.getElementById('rosterRevertBtn').style.display === 'block';
  console.log('Shuffle button still says "Shuffle" (not replaced):', shuffleStillThere);
  console.log('Revert button now visible:', revertVisible);

  console.log('=== Test 4: clicking Shuffle again re-shuffles WITHOUT needing revert first ===');
  const order1 = window.eval("JSON.stringify(chart.rosterShuffle['Cello'])");
  doc.getElementById('rosterShuffleBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  const order2 = window.eval("JSON.stringify(chart.rosterShuffle['Cello'])");
  console.log('Shuffle order 1:', order1, '| order 2:', order2);
  const stillShuffled = doc.getElementById('rosterRevertBtn').style.display === 'block';
  console.log('Still shuffled (revert still available):', stillShuffled);

  console.log('=== Test 5: Revert hides the revert button and note again ===');
  doc.getElementById('rosterRevertBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  const revertHiddenAfter = doc.getElementById('rosterRevertBtn').style.display === 'none';
  const trueOrderRestored = window.eval("JSON.stringify(chart.rosterShuffle['Cello'])") === undefined || window.eval("chart.rosterShuffle['Cello']") === undefined;
  console.log('Revert button hidden again after reverting:', revertHiddenAfter);
  console.log('Shuffle state cleared:', trueOrderRestored);

  const pass = hasDice && revertHiddenBefore && shuffleStillThere && revertVisible && stillShuffled && revertHiddenAfter && trueOrderRestored;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
