const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const noop = () => {};
const drawLog = [];
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop,
  fill(){ drawLog.push({op:'fill', fillStyle:this._fillStyle}); },
  stroke: noop,
  arc: noop, rect: noop, fillRect: noop, strokeRect: noop,
  fillText(text){ drawLog.push({op:'text', text, fillStyle:this._fillStyle}); },
  setLineDash: noop,
  measureText: (t) => ({ width: (t||'').length * 8 }),
  clearRect: noop, drawImage: noop, ellipse: noop,
  roundRect(x,y,w,h){ drawLog.push({op:'roundRect', x, y, w, h, fillStyle:this._fillStyle}); },
  bezierCurveTo: noop, quadraticCurveTo: noop,
  getImageData(x,y,w,h){ return { data: new Uint8ClampedArray(w*h*4).fill(128), width:w, height:h }; },
  putImageData: noop,
};
const dom = new JSDOM(html, {
  url: 'https://example.github.io/seating-chart/',
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  beforeParse(window){
    window.HTMLCanvasElement.prototype.getContext = function(){
      const proxy = new Proxy(fakeCtxProto, {
        get(target, prop){
          if(prop === 'fillStyle') return target._fillStyle;
          if(prop in target) return target[prop];
          if(typeof prop === 'string' && (prop.endsWith('Style')||prop==='font'||prop==='lineWidth'||prop==='lineCap'||prop==='globalAlpha'||prop==='textAlign'||prop==='textBaseline')) return '';
          return noop;
        },
        set(target, prop, val){ if(prop==='fillStyle') target._fillStyle = val; return true; }
      });
      return proxy;
    };
    window.HTMLCanvasElement.prototype.getBoundingClientRect = function(){
      return { left: 0, top: 0, width: this.width, height: this.height };
    };
  }
});
const { window } = dom;
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
(async()=>{
  await wait(300);
  const doc = window.document;

  console.log('=== Set up: two overlapping-ish seats, one with a roster name, one without ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(2, 'straight');
    chart.seats[0].preset='Cello'; chart.seats[0].color='#1A1A5E'; chart.seats[0].label='Vc';
    chart.seats[1].preset='Violin 1'; chart.seats[1].color='#3EA6CC'; chart.seats[1].label='Vln1';
    chart.rosters['Cello'] = ['Alice Chen'];
    chart.showRosterNames = true; chart.showLabels = true;
  `);
  await wait(20);

  console.log('=== Test 1: colored chip background uses the seat instrument color ===');
  drawLog.length = 0;
  window.eval('render()');
  const roundRects = drawLog.filter(d=>d.op==='roundRect');
  console.log('roundRect fill colors:', roundRects.map(r=>r.fillStyle));
  const usesColoredBg = roundRects.some(r=>r.fillStyle && r.fillStyle.includes('rgba(26,26,94'));
  console.log('Chip background uses the dark navy instrument color:', usesColoredBg);

  console.log('=== Test 2: text color contrasts against the dark chip (should be light) ===');
  const textEntries = drawLog.filter(d=>d.op==='text' && d.text==='Alice');
  console.log('Text fill style for name on dark chip:', textEntries.map(t=>t.fillStyle));
  const lightTextUsed = textEntries.some(t=>t.fillStyle === '#F7F3E9');
  console.log('Light text color used for contrast on dark background:', lightTextUsed);

  console.log('=== Test 3: black & white export reverts to default cream/dark regardless of seat color ===');
  window.eval("exportRenderOptions = { whiteBg:true, skipGrid:true, bw:true };");
  drawLog.length = 0;
  window.eval('render()');
  window.eval("exportRenderOptions = null;");
  const roundRectsBW = drawLog.filter(d=>d.op==='roundRect');
  const revertedToDefaultBg = roundRectsBW.every(r=>r.fillStyle === 'rgba(247,243,233,0.5)');
  console.log('All chip backgrounds reverted to default cream in BW mode:', revertedToDefaultBg);
  const textEntriesBW = drawLog.filter(d=>d.op==='text' && d.text==='Alice');
  const darkTextInBW = textEntriesBW.every(t=>t.fillStyle === '#242019');
  console.log('Text reverted to default dark color in BW mode:', darkTextInBW);

  console.log('=== Test 4: last-selected seat gets drawn last (on top) ===');
  window.eval('selectSeat(chart.seats[0])');
  await wait(10);
  console.log('lastInteractedSeatId set:', window.eval('lastInteractedSeatId') === window.eval('chart.seats[0].id'));
  const drawOrder = window.eval(`seatsInDrawOrder().map(s=>s.id)`);
  const seat0Id = window.eval('chart.seats[0].id');
  const isLast = drawOrder[drawOrder.length-1] === seat0Id;
  console.log('Selected seat is last in draw order:', isLast);

  console.log('=== Test 5: after deselecting, the seat STAYS on top (persists) ===');
  window.eval('selectSeat(null)');
  await wait(10);
  const stillLastInteracted = window.eval('lastInteractedSeatId') === seat0Id;
  const drawOrderAfterDeselect = window.eval(`seatsInDrawOrder().map(s=>s.id)`);
  const stillLastInOrder = drawOrderAfterDeselect[drawOrderAfterDeselect.length-1] === seat0Id;
  console.log('lastInteractedSeatId persists after deselect:', stillLastInteracted);
  console.log('Still drawn last after deselecting:', stillLastInOrder);

  console.log('=== Test 6: selecting a DIFFERENT seat replaces the top spot ===');
  window.eval('selectSeat(chart.seats[1])');
  await wait(10);
  const seat1Id = window.eval('chart.seats[1].id');
  const newDrawOrder = window.eval(`seatsInDrawOrder().map(s=>s.id)`);
  const newSeatIsLast = newDrawOrder[newDrawOrder.length-1] === seat1Id;
  console.log('New selection now takes the top spot:', newSeatIsLast);

  const pass = usesColoredBg && lightTextUsed && revertedToDefaultBg && darkTextInBW &&
               isLast && stillLastInteracted && stillLastInOrder && newSeatIsLast;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
