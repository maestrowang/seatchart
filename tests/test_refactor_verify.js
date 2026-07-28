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

  console.log('=== Set up: a 1-seat section and a 9-seat straight-row section ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(10, 'straight');
    const seats = chart.seats.filter(s=>s.row===0).sort((a,b)=>a.x-b.x);
    seats[0].preset='Tuba'; seats[0].color='#888';
    seats.slice(1,10).forEach(s=>{ s.preset='Cello'; s.color='#79CC3E'; });
  `);
  await wait(20);

  console.log('=== Test 1: computeAllSeatRanks includes the 1-seat Tuba group (rank 1) ===');
  const allRanks = window.eval(`
    const r = computeAllSeatRanks();
    const tuba = chart.seats.find(s=>s.preset==='Tuba');
    r.get(tuba.id)
  `);
  console.log('Tuba gets rank 1 in the unfiltered computation:', allRanks === 1);

  console.log('=== Test 2: computeSeatRanks (display) still excludes the 1-seat Tuba group ===');
  const displayHasTuba = window.eval(`
    const r = computeSeatRanks();
    const tuba = chart.seats.find(s=>s.preset==='Tuba');
    r.has(tuba.id)
  `);
  console.log('Tuba excluded from display ranks (as before):', !displayHasTuba);

  console.log('=== Test 3: Cello (9 seats, straight row) ranks identically in both, inner-first ===');
  const celloAllRanks = JSON.parse(window.eval(`
    const r = computeAllSeatRanks();
    JSON.stringify(chart.seats.filter(s=>s.preset==='Cello').sort((a,b)=>a.x-b.x).map(s=>r.get(s.id)))
  `));
  const celloDisplayRanks = JSON.parse(window.eval(`
    const r = computeSeatRanks();
    JSON.stringify(chart.seats.filter(s=>s.preset==='Cello').sort((a,b)=>a.x-b.x).map(s=>r.get(s.id)))
  `));
  console.log('All-ranks Cello:', celloAllRanks);
  console.log('Display-ranks Cello:', celloDisplayRanks);
  console.log('Identical between both functions:', JSON.stringify(celloAllRanks)===JSON.stringify(celloDisplayRanks));

  console.log('=== Test 4: manually hiding Cello section removes it from display but not from all-ranks ===');
  window.eval("chart.seatRankSettings['Cello'] = { style:'default', invert:false, hidden:true };");
  const celloAllRanksAfterHide = window.eval(`
    const r = computeAllSeatRanks();
    chart.seats.filter(s=>s.preset==='Cello').every(s=>r.has(s.id))
  `);
  const celloDisplayAfterHide = window.eval(`
    const r = computeSeatRanks();
    chart.seats.filter(s=>s.preset==='Cello').some(s=>r.has(s.id))
  `);
  console.log('computeAllSeatRanks still has Cello ranks (unaffected by hidden flag):', celloAllRanksAfterHide);
  console.log('computeSeatRanks correctly excludes hidden Cello:', !celloDisplayAfterHide);

  const pass = allRanks===1 && !displayHasTuba && JSON.stringify(celloAllRanks)===JSON.stringify(celloDisplayRanks) &&
               celloAllRanksAfterHide && !celloDisplayAfterHide;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
