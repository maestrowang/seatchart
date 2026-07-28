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
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(4, 'straight');
    chart.seats.forEach(s=>{ s.preset='Cello'; s.color='#79CC3E'; });
    chart.rosters['Cello'] = ['A','B','C','D'];
    chart.rosterTextScale = 130;
    shuffleRosterSection('Cello', false);
  `);
  await wait(20);

  console.log('=== Test 1: save/load preserves rosterTextScale and rosterShuffle ===');
  const beforeSave = window.eval("JSON.stringify({scale: chart.rosterTextScale, shuffle: chart.rosterShuffle})");
  const json = window.eval('JSON.stringify(chart)');
  const reloaded = JSON.parse(json);
  window.eval(`applyLoadedChartData(${JSON.stringify(reloaded)}, 'test')`);
  await wait(20);
  const afterLoad = window.eval("JSON.stringify({scale: chart.rosterTextScale, shuffle: chart.rosterShuffle})");
  console.log('Before:', beforeSave);
  console.log('After: ', afterLoad);
  console.log('Round-trip preserved exactly:', beforeSave === afterLoad);

  console.log('=== Test 2: old file without these fields migrates safely ===');
  const oldFile = { title:'Old', seats:[], rowIndex:0 };
  window.eval(`applyLoadedChartData(${JSON.stringify(oldFile)}, 'old')`);
  await wait(20);
  const migrated = window.eval("JSON.stringify({scale: chart.rosterTextScale, shuffle: chart.rosterShuffle})");
  console.log('Migrated defaults:', migrated);
  const migratedOk = migrated === JSON.stringify({scale:100, shuffle:{}});
  console.log('Correct defaults applied:', migratedOk);

  const pass = beforeSave === afterLoad && migratedOk;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
