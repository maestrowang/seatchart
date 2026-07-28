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
  const chartData = JSON.parse(fs.readFileSync('/home/claude/row6_bug.json', 'utf8'));

  console.log('=== Test 1: row spacing no longer collapses rows 5&6 (0-indexed 4&5) onto the same radius ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);
  const allIds = window.eval("chart.seats.filter(s=>!s.hidden).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(allIds)})`);
  await wait(10);
  doc.getElementById('rowSpacingSlider').value = 130;
  doc.getElementById('rowSpacingSlider').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const radii = JSON.parse(window.eval('JSON.stringify(chart.rowRadii)'));
  console.log('rowRadii after row spacing 130%:', radii);
  const noCollision1 = radii[4] !== radii[5] && (radii[5] - radii[4]) >= 19;
  console.log('Rows 5 & 6 maintain separation:', noCollision1);

  console.log('=== Test 2: stage spacing also no longer merges rows 5&6, even WITHOUT touching row spacing first ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);
  window.eval(`setSelection(${JSON.stringify(allIds)})`);
  await wait(10);
  doc.getElementById('stageSpacingSlider').value = 130;
  doc.getElementById('stageSpacingSlider').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const row4Y = JSON.parse(window.eval("JSON.stringify(chart.seats.filter(s=>s.row===4).map(s=>Math.round(s.y)))"));
  const row5Y = JSON.parse(window.eval("JSON.stringify(chart.seats.filter(s=>s.row===5).map(s=>Math.round(s.y)))"));
  console.log('Row 5 (UI) Y positions:', row4Y);
  console.log('Row 6 (UI) Y positions:', row5Y);
  const noMerge = row4Y[0] !== row5Y[0];
  console.log('Rows no longer merged (different Y):', noMerge);

  console.log('=== Test 3: rows that START at the same depth can never be driven apart-then-crossed ===');
  // The old code carried a repair function that pulled apart row radii which had
  // collided. The unified model makes collisions structurally impossible instead:
  // row spacing scales the GAPS between depth bands, so a positive gap can never
  // become negative and rows cannot swap. Verify that guarantee directly.
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);
  window.eval('clearSelection()');
  await wait(10);
  const depthsAt = async v => {
    const el = doc.getElementById('rowSpacingSlider');
    el.value = v; el.dispatchEvent(new window.Event('input', {bubbles:true}));
    await wait(8);
    return JSON.parse(window.eval(`JSON.stringify(Array.from({length:chart.rowIndex},(_,i)=>{
      const rs = chart.seats.filter(s=>s.row===i && !s.hidden);
      return rs.length ? rs.reduce((a,s)=>a+s.y,0)/rs.length : null;
    }))`));
  };
  doc.getElementById('rowSpacingSlider').dispatchEvent(new window.MouseEvent('mousedown',{bubbles:true}));
  let neverCrossed = true;
  for(const v of [60,80,100,120,140,160]){
    const ys = (await depthsAt(v)).filter(y=>y!==null);
    for(let i=1;i<ys.length;i++) if(ys[i] > ys[i-1] - 0.01) neverCrossed = false;
  }
  doc.getElementById('rowSpacingSlider').dispatchEvent(new window.Event('change',{bubbles:true}));
  const allSeparated = neverCrossed;
  console.log('Rows stay strictly ordered by depth across the entire slider range:', allSeparated);

  console.log('=== Test 4: re-applying the chart\'s CURRENT value leaves every row exactly where it was ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);
  window.eval('clearSelection()');
  await wait(10);
  // Neutral is whatever this chart was saved at -- not necessarily 100.
  const neutralValue = window.eval('chart.rowSpacing || 100');
  const beforeNeutral = JSON.parse(window.eval('JSON.stringify(chart.seats.map(s=>s.y))'));
  const el4 = doc.getElementById('rowSpacingSlider');
  el4.dispatchEvent(new window.MouseEvent('mousedown',{bubbles:true}));
  el4.value = neutralValue; el4.dispatchEvent(new window.Event('input',{bubbles:true}));
  await wait(10);
  el4.dispatchEvent(new window.Event('change',{bubbles:true}));
  const afterNeutral = JSON.parse(window.eval('JSON.stringify(chart.seats.map(s=>s.y))'));
  const drift = Math.max(...beforeNeutral.map((y,i)=>Math.abs(y-afterNeutral[i])));
  const unchanged = drift < 1e-6;
  console.log(`Re-applying the chart's own value (${neutralValue}%) left every row untouched:`, unchanged, `(drift ${drift.toExponential(1)})`);

  const pass = noCollision1 && noMerge && allSeparated && unchanged;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
