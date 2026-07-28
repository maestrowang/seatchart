const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/test.html', 'utf8');
const noop = () => {};
const drawLog = [];
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop,
  arc: noop, rect: noop, fillRect: noop, strokeRect: noop,
  fillText(text){ drawLog.push(text); },
  setLineDash: noop,
  measureText: (t) => ({ width: (t||'').length * 8 }),
  clearRect: noop, drawImage: noop, ellipse: noop, roundRect: noop,
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

  console.log('=== Set up: 4 seats -- mix of roster-named and plain-labeled, various array orders ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(4, 'straight');
    chart.seats[0].preset='Cello'; chart.seats[0].color='#79CC3E'; chart.seats[0].label='Vc';
    chart.seats[1].preset='Violin 1'; chart.seats[1].color='#3EA6CC'; chart.seats[1].label='Vln1';
    chart.seats[2].preset='Viola'; chart.seats[2].color='#3ECC5C'; chart.seats[2].label='Vla';
    chart.seats[3].preset='Violin 2'; chart.seats[3].color='#3ECCB1'; chart.seats[3].label='Vln2';
    chart.rosters['Cello'] = ['Zack Last']; // deliberately the LAST seat in array order gets a roster name... wait it's seat 0
    chart.rosters['Violin 2'] = ['Wendy Fourth']; // seat 3 (last in array) also gets a name
    chart.showRosterNames = true; chart.showLabels = true;
  `);
  await wait(20);

  console.log('=== Render once and capture the ORDER labels vs chips are drawn ===');
  drawLog.length = 0;
  window.eval('render()');
  console.log('All fillText calls in order:', JSON.stringify(drawLog));

  // Find the index of the LAST plain instrument label draw (Vln1 or Vla, the ones
  // WITHOUT roster names) vs the FIRST roster name chip text draw (Zack or Wendy).
  const labelTexts = ['Vln1', 'Vla', 'Vc', 'Vln2'];
  const nameTexts = ['Zack', 'Last', 'Wendy', 'Fourth'];
  const lastLabelIdx = Math.max(...labelTexts.map(t=>drawLog.lastIndexOf(t)).filter(i=>i>=0));
  const firstNameIdx = Math.min(...nameTexts.map(t=>drawLog.indexOf(t)).filter(i=>i>=0));
  console.log('Last label draw index:', lastLabelIdx, '| First roster-name draw index:', firstNameIdx);
  const chipsAlwaysAfterLabels = firstNameIdx > lastLabelIdx;
  console.log('ALL roster chips draw strictly after ALL labels (guaranteed top layer):', chipsAlwaysAfterLabels);

  console.log(chipsAlwaysAfterLabels ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
