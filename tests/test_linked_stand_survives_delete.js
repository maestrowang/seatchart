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

  console.log('=== Test 1: single-seat delete (Delete button) leaves partner with a solo stand ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(4, 'straight');
    const seats = chart.seats.filter(s=>s.row===0);
    seats[0].standPartner = seats[1].id;
    seats[1].standPartner = seats[0].id;
  `);
  await wait(20);
  const partnerA = window.eval("chart.seats.filter(s=>s.row===0)[0].id");
  const partnerB = window.eval("chart.seats.filter(s=>s.row===0)[1].id");
  window.eval(`selectSeat(getSeat('${partnerA}'))`);
  await wait(10);
  doc.getElementById('deleteSeatBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  const partnerBStillExists = window.eval(`!!getSeat('${partnerB}')`);
  const partnerBHasStand = window.eval(`getSeat('${partnerB}').stand`);
  const partnerBNoLongerLinked = window.eval(`getSeat('${partnerB}').standPartner`) === null;
  console.log('Partner B still exists:', partnerBStillExists);
  console.log('Partner B now has a solo stand:', partnerBHasStand);
  console.log('Partner B no longer linked to deleted partner:', partnerBNoLongerLinked);

  console.log('=== Test 2: batch delete leaves the remaining partner with a solo stand ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(4, 'straight');
    const seats = chart.seats.filter(s=>s.row===0);
    seats[2].standPartner = seats[3].id;
    seats[3].standPartner = seats[2].id;
  `);
  await wait(20);
  const seatToDelete = window.eval("chart.seats.filter(s=>s.row===0)[2].id");
  const remainingPartner = window.eval("chart.seats.filter(s=>s.row===0)[3].id");
  window.eval(`setSelection(['${seatToDelete}'])`);
  await wait(10);
  doc.getElementById('batchDeleteBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  const batchPartnerHasStand = window.eval(`getSeat('${remainingPartner}').stand`);
  console.log('Remaining partner has a solo stand after batch delete:', batchPartnerHasStand);

  console.log('=== Test 3: keyboard delete (Delete key) leaves the remaining partner with a solo stand ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(4, 'straight');
    const seats = chart.seats.filter(s=>s.row===0);
    seats[0].standPartner = seats[1].id;
    seats[1].standPartner = seats[0].id;
  `);
  await wait(20);
  const kbDeleteId = window.eval("chart.seats.filter(s=>s.row===0)[0].id");
  const kbRemainingId = window.eval("chart.seats.filter(s=>s.row===0)[1].id");
  window.eval(`setSelection(['${kbDeleteId}'])`);
  await wait(10);
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
  await wait(20);
  const kbPartnerHasStand = window.eval(`getSeat('${kbRemainingId}').stand`);
  console.log('Remaining partner has a solo stand after keyboard delete:', kbPartnerHasStand);

  console.log('=== Test 4: explicit "Unlink" button still behaves as before (both lose the stand) ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(4, 'straight');
    const seats = chart.seats.filter(s=>s.row===0);
    seats[0].standPartner = seats[1].id;
    seats[1].standPartner = seats[0].id;
  `);
  await wait(20);
  const unlinkA = window.eval("chart.seats.filter(s=>s.row===0)[0].id");
  const unlinkB = window.eval("chart.seats.filter(s=>s.row===0)[1].id");
  window.eval(`selectSeat(getSeat('${unlinkA}'))`);
  await wait(10);
  doc.getElementById('unlinkStandBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  const unlinkAStand = window.eval(`getSeat('${unlinkA}').stand`);
  const unlinkBStand = window.eval(`getSeat('${unlinkB}').stand`);
  console.log('After explicit Unlink, neither seat auto-gains a solo stand (unchanged behavior):', !unlinkAStand && !unlinkBStand);

  const pass = partnerBStillExists && partnerBHasStand && partnerBNoLongerLinked &&
               batchPartnerHasStand && kbPartnerHasStand && !unlinkAStand && !unlinkBStand;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
