const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/test.html', 'utf8');
const noop = () => {};
const drawCalls = [];
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop,
  arc: noop, rect: noop, fillRect: noop, strokeRect: noop,
  fillText(text, x, y){ drawCalls.push({text, x, y}); },
  setLineDash: noop,
  measureText: (t) => ({ width: (t||'').length * 6 }),
  clearRect: noop, drawImage: noop, ellipse: noop,
  roundRect(x,y,w,h,r){ drawCalls.push({op:'roundRect', x, y, w, h}); },
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

  console.log('=== Test 1: wrapNameForDisplay splits at first space ===');
  console.log(window.eval("JSON.stringify(wrapNameForDisplay('Alice Chen'))"));
  console.log(window.eval("JSON.stringify(wrapNameForDisplay('Cher'))"));
  console.log(window.eval("JSON.stringify(wrapNameForDisplay('Mary Jane Watson'))"));
  const wrapOk = window.eval("JSON.stringify(wrapNameForDisplay('Alice Chen'))") === '["Alice","Chen"]' &&
                 window.eval("JSON.stringify(wrapNameForDisplay('Cher'))") === '["Cher"]' &&
                 window.eval("JSON.stringify(wrapNameForDisplay('Mary Jane Watson'))") === '["Mary","Jane Watson"]';
  console.log('Wrapping logic correct:', wrapOk);

  console.log('=== Set up a seat with a roster name and an instrument label ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(3, 'straight');
    chart.seats.forEach(s=>{ s.preset='Violin 1'; s.color='#3EA6CC'; s.label='Vln1'; });
    chart.rosters['Violin 1'] = ['Alice Chen'];
    chart.showRosterNames = true;
    chart.showLabels = true;
  `);
  await wait(20);

  console.log('=== Test 2: rendering draws a rounded chip background + wrapped name ===');
  drawCalls.length = 0;
  window.eval('render()');
  const roundRectCalls = drawCalls.filter(c=>c.op==='roundRect');
  console.log('roundRect (chip background) drawn:', roundRectCalls.length > 0);
  const textCalls = drawCalls.filter(c=>c.text);
  const hasAliceLine = textCalls.some(c=>c.text==='Alice');
  const hasChenLine = textCalls.some(c=>c.text==='Chen');
  console.log('Name wrapped onto 2 separate fillText calls (Alice / Chen):', hasAliceLine && hasChenLine);
  const hasInstrumentLabelToo = textCalls.some(c=>c.text==='Vln1');
  console.log('Instrument label ALSO drawn (moved below, not hidden):', hasInstrumentLabelToo);

  console.log('=== Test 3: independent toggles -- showLabels off, showRosterNames on ===');
  window.eval('chart.showLabels = false; chart.showRosterNames = true;');
  drawCalls.length = 0;
  window.eval('render()');
  const textCalls2 = drawCalls.filter(c=>c.text);
  const nameStillShows = textCalls2.some(c=>c.text==='Alice');
  const labelHidden = !textCalls2.some(c=>c.text==='Vln1');
  console.log('Name still shows when showLabels is off:', nameStillShows);
  console.log('Instrument label correctly hidden:', labelHidden);

  console.log('=== Test 4: independent toggles -- showRosterNames off, showLabels on ===');
  window.eval('chart.showLabels = true; chart.showRosterNames = false;');
  drawCalls.length = 0;
  window.eval('render()');
  const textCalls3 = drawCalls.filter(c=>c.text);
  const nameHidden = !textCalls3.some(c=>c.text==='Alice');
  const labelRevertsToNormalPosition = textCalls3.some(c=>c.text==='Vln1');
  console.log('Name correctly hidden:', nameHidden);
  console.log('Instrument label shown again (reverted):', labelRevertsToNormalPosition);

  console.log('=== Test 5: seat with NO roster name uses normal label position (revert) ===');
  window.eval(`
    chart.showRosterNames = true; chart.showLabels = true;
    chart.rosters['Violin 1'] = []; // no names at all now
  `);
  drawCalls.length = 0;
  window.eval('render()');
  const textCalls4 = drawCalls.filter(c=>c.text);
  const labelNormalWhenNoName = textCalls4.some(c=>c.text==='Vln1');
  console.log('Label shows normally when no roster name exists:', labelNormalWhenNoName);

  const pass = wrapOk && roundRectCalls.length>0 && hasAliceLine && hasChenLine && hasInstrumentLabelToo &&
               nameStillShows && labelHidden && nameHidden && labelRevertsToNormalPosition && labelNormalWhenNoName;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
