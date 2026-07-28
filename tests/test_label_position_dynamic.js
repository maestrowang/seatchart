const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const noop = () => {};
const drawnChips = [];
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop,
  arc: noop, rect: noop, fillRect: noop, strokeRect: noop, fillText: noop, setLineDash: noop,
  measureText: (t) => ({ width: (t||'').length * 8 }),
  clearRect: noop, drawImage: noop, ellipse: noop,
  roundRect(x,y,w,h){ drawnChips.push({x, y, w, h}); },
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

  console.log('=== Test 1: single-word name (1 line) -- label position ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(1, 'straight');
    chart.seats[0].preset='Cello'; chart.seats[0].color='#79CC3E'; chart.seats[0].label='Vc';
    chart.rosters['Cello'] = ['Cher'];
    chart.showRosterNames = true; chart.showLabels = true;
  `);
  await wait(20);
  drawnChips.length = 0;
  window.eval('render()');
  console.log('Chips drawn (1-line name):', JSON.stringify(drawnChips));
  const labelChip1 = drawnChips[0];
  const nameChip1 = drawnChips[1];
  const nameBottom1 = nameChip1.y + nameChip1.h;
  const labelTop1 = labelChip1.y;
  const gap1 = labelTop1 - nameBottom1;
  console.log('1-line name chip bottom:', nameBottom1, '| label chip top:', labelTop1, '| gap:', gap1);
  const noOverlap1 = gap1 >= 0;
  console.log('No overlap (1-line case):', noOverlap1);

  console.log('=== Test 2: two-word name (2 lines) -- label pushed further down ===');
  window.eval(`chart.rosters['Cello'] = ['Alice Chen'];`);
  await wait(10);
  drawnChips.length = 0;
  window.eval('render()');
  console.log('Chips drawn (2-line name):', JSON.stringify(drawnChips));
  const labelChip2 = drawnChips[0];
  const nameChip2 = drawnChips[1];
  const nameBottom2 = nameChip2.y + nameChip2.h;
  const labelTop2 = labelChip2.y;
  const gap2 = labelTop2 - nameBottom2;
  console.log('2-line name chip bottom:', nameBottom2, '| label chip top:', labelTop2, '| gap:', gap2);
  const noOverlap2 = gap2 >= 0;
  console.log('No overlap (2-line case):', noOverlap2);

  console.log('=== Test 3: 2-line name pushes the label further down than 1-line did ===');
  const labelPushedDown = labelChip2.y > labelChip1.y;
  console.log('Label Y position further down for 2-line name:', labelPushedDown);
  console.log('1-line label Y:', labelChip1.y, '| 2-line label Y:', labelChip2.y);

  const pass = noOverlap1 && noOverlap2 && labelPushedDown;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
