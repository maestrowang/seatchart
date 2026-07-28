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

  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(2, 'straight');
    chart.seats.forEach(s=>{ s.preset='Cello'; s.color='#79CC3E'; s.label='Vc'; });
    chart.rosters['Cello'] = ['Someone With A Long Name'];
    chart.showLabels = true; chart.showRosterNames = true;
  `);
  await wait(20);

  console.log('=== Test 1: roster name editor is wider than the label editor ===');
  const nameSeatId = window.eval(`
    const ranks = computeAllSeatRanks();
    chart.seats.find(s=>ranks.get(s.id)===1).id
  `);
  window.eval(`startInlineTextEdit(getSeat('${nameSeatId}'), 'name')`);
  await wait(10);
  const nameEditor = doc.querySelector('.inline-seat-editor');
  const nameWidth = parseFloat(nameEditor.style.width);
  console.log('Name editor width:', nameWidth);
  nameEditor.remove();

  window.eval(`startInlineTextEdit(getSeat('${nameSeatId}'), 'label')`);
  await wait(10);
  const labelEditor = doc.querySelector('.inline-seat-editor');
  const labelWidth = parseFloat(labelEditor.style.width);
  console.log('Label editor width:', labelWidth);

  const wider = nameWidth > labelWidth;
  const meaningfullyBigger = nameWidth >= 150;
  console.log('Name editor is wider than label editor:', wider);
  console.log('Name editor is meaningfully large (>=150px):', meaningfullyBigger);

  const pass = wider && meaningfullyBigger;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
