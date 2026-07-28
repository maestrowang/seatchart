const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/test.html', 'utf8');
const noop = () => {};
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop,
  arc: noop, rect: noop, fillRect: noop, strokeRect: noop, fillText: noop, setLineDash: noop,
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
  const canvasEl = doc.getElementById('chart');

  console.log('=== Set up: a text box AND a seat with a label, at different positions ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(2, 'straight');
    chart.textBoxes.push({ id: 'tb-1', x: 100, y: 100, text: 'Original Text', fontSize: 16, bold:false, italic:false, underline:false, align:'center' });
  `);
  await wait(20);

  console.log('=== Test 1: double-click on the text box opens its inline editor ===');
  const tbScreen = window.eval("flipPoint(getTextBox('tb-1').x, getTextBox('tb-1').y)");
  canvasEl.dispatchEvent(new window.MouseEvent('dblclick', { bubbles:true, clientX: tbScreen.x, clientY: tbScreen.y }));
  await wait(20);
  const editor = doc.querySelector('.inline-seat-editor');
  console.log('Editor appeared:', !!editor);
  const prefilledOk = editor && editor.value === 'Original Text';
  console.log('Pre-filled with text box content:', prefilledOk);

  console.log('=== Test 2: editing commits back to the text box (via blur) ===');
  editor.value = 'Updated Text';
  editor.dispatchEvent(new window.Event('blur', { bubbles: true }));
  await wait(20);
  const updated = window.eval("getTextBox('tb-1').text") === 'Updated Text';
  console.log('Text box content updated:', updated);

  console.log('=== Test 3: double-click on a SEAT (not overlapping the text box) still edits the seat ===');
  const seatId = window.eval('chart.seats[0].id');
  window.eval(`getSeat('${seatId}').label = 'SeatLabel';`);
  const seatScreen = window.eval(`flipPoint(getSeat('${seatId}').x, getSeat('${seatId}').y)`);
  canvasEl.dispatchEvent(new window.MouseEvent('dblclick', { bubbles:true, clientX: seatScreen.x, clientY: seatScreen.y }));
  await wait(20);
  const seatEditor = doc.querySelector('.inline-seat-editor');
  console.log('Seat editor appeared with the seat label (not text box logic interfering):', seatEditor && seatEditor.value === 'SeatLabel');
  seatEditor.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  const pass = !!editor && prefilledOk && updated && seatEditor && seatEditor.value==='SeatLabel';
  console.log(pass ? 'PART 3: PASS' : 'PART 3: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('PART 3: FAIL'); });
