const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
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
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(8, 'straight');
    chart.seats.forEach(s=>{ s.preset='Violin 1'; s.color='#3EA6CC'; });
    chart.rosters['Violin 1'] = ['P1','P2','P3','P4','P5','P6','P7','P8'];
    const ranks = computeAllSeatRanks();
    const seats = chart.seats.filter(s=>s.preset==='Violin 1');
    const byRank = {}; seats.forEach(s=>{ byRank[ranks.get(s.id)] = s; });
    byRank[1].standPartner = byRank[2].id; byRank[2].standPartner = byRank[1].id;
  `);
  await wait(20);

  let sawSeparation = false;
  for(let trial = 0; trial < 30; trial++){
    window.eval("revertRosterShuffle('Violin 1'); shuffleRosterSection('Violin 1', false);"); // preservePartners=false
    const result = JSON.parse(window.eval(`
      const ranks = computeAllSeatRanks();
      const a = getRosterAssignments();
      const seats = chart.seats.filter(s=>s.preset==='Violin 1');
      JSON.stringify(seats.sort((x,y)=>ranks.get(x.id)-ranks.get(y.id)).map(s=>a.get(s.id)))
    `));
    const pair12 = [result[0], result[1]].sort();
    const isSeparated = JSON.stringify(pair12) !== JSON.stringify(['P1','P2']);
    if(isSeparated){ sawSeparation = true; break; }
  }
  console.log('Without preserve-partners, P1/P2 got separated at least once across 30 trials:', sawSeparation);
  console.log(sawSeparation ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
