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
    byRank[3].standPartner = byRank[4].id; byRank[4].standPartner = byRank[3].id;
  `);
  await wait(20);

  const blocksDebug = window.eval(`
    const presetName = 'Violin 1';
    const seats = chart.seats.filter(s=>!s.hidden && s.preset === presetName);
    const ranks = computeAllSeatRanks();
    const rankToSeat = {};
    seats.forEach(s=>{ const r = ranks.get(s.id); if(r) rankToSeat[r] = s; });
    const names = chart.rosters[presetName] || [];
    const N = names.length;
    const blocks = [];
    let i = 0;
    const debugLog = [];
    while(i < N){
      const seat = rankToSeat[i+1];
      const nextSeat = rankToSeat[i+2];
      const isPair = seat && nextSeat && seat.standPartner === nextSeat.id;
      debugLog.push({i, rank: i+1, seatId: seat && seat.id, nextRank: i+2, nextSeatId: nextSeat && nextSeat.id, seatPartner: seat && seat.standPartner, isPair});
      if(isPair){
        blocks.push([i, i+1]);
        i += 2;
      } else {
        blocks.push([i]);
        i += 1;
      }
    }
    JSON.stringify({debugLog, blocks})
  `);
  console.log(blocksDebug);
})().catch(e=>console.error('ERROR:', e));
