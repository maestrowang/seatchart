const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
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

  console.log('=== Set up: create a text box directly ===');
  window.eval(`
    chart.textBoxes.push({ id: uid(), x: 400, y: 300, text: 'Program Notes', fontSize: 16, bold:false, italic:false, underline:false, align:'center' });
    render();
  `);
  await wait(20);
  const tbId = window.eval('chart.textBoxes[0].id');

  console.log('=== Test 1: clicking the text box selects it ===');
  const screenPos = window.eval(`flipPoint(getTextBox('${tbId}').x, getTextBox('${tbId}').y)`);
  canvasEl.dispatchEvent(new window.MouseEvent('mousedown', { bubbles:true, clientX: screenPos.x, clientY: screenPos.y }));
  window.dispatchEvent(new window.MouseEvent('mouseup', { bubbles:true }));
  await wait(20);
  const selectedCorrectly = window.eval('selectedTextBoxId') === tbId;
  console.log('Text box selected via click:', selectedCorrectly);

  console.log('=== Test 2: dragging repositions the text box ===');
  canvasEl.dispatchEvent(new window.MouseEvent('mousedown', { bubbles:true, clientX: screenPos.x, clientY: screenPos.y }));
  canvasEl.dispatchEvent(new window.MouseEvent('mousemove', { bubbles:true, clientX: screenPos.x + 50, clientY: screenPos.y + 30 }));
  window.dispatchEvent(new window.MouseEvent('mouseup', { bubbles:true }));
  await wait(20);
  const newX = window.eval(`getTextBox('${tbId}').x`);
  const newY = window.eval(`getTextBox('${tbId}').y`);
  console.log('New position:', newX, newY, '(was 400, 300)');
  const moved = Math.abs(newX - 400) > 10 || Math.abs(newY - 300) > 10;
  console.log('Text box moved:', moved);

  console.log('=== Test 3: selecting a seat deselects the text box (mutual exclusivity) ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(2, 'straight');
  `);
  await wait(20);
  window.eval(`selectSeat(chart.seats[0])`);
  await wait(10);
  const tbDeselected = window.eval('selectedTextBoxId') === null;
  const textBoxPanelHidden = doc.getElementById('textBoxInspector').style.display === 'none';
  console.log('selectedTextBoxId cleared:', tbDeselected);
  console.log('Text box inspector panel hidden:', textBoxPanelHidden);

  console.log('=== Test 4: selecting the text box again deselects the seat ===');
  window.eval(`selectTextBox(getTextBox('${tbId}'))`);
  await wait(10);
  const seatDeselected = window.eval('selectedId') === null && window.eval('selection.size') === 0;
  console.log('Seat selection cleared:', seatDeselected);

  console.log('=== Test 5: Delete key removes the selected text box ===');
  const countBefore = window.eval('chart.textBoxes.length');
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
  await wait(20);
  const countAfter = window.eval('chart.textBoxes.length');
  console.log('Text box count before/after delete:', countBefore, countAfter);
  const deleted = countAfter === countBefore - 1;
  console.log('Text box deleted via keyboard:', deleted);
  console.log('selectedTextBoxId cleared after delete:', window.eval('selectedTextBoxId') === null);

  console.log('=== Test 6: Delete Text Box button also works ===');
  window.eval(`
    const tb2 = { id: uid(), x: 200, y: 200, text: 'Another box', fontSize: 16, bold:false, italic:false, underline:false, align:'center' };
    chart.textBoxes.push(tb2);
    selectTextBox(tb2);
  `);
  await wait(10);
  doc.getElementById('textBoxDeleteBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  const gone = window.eval('chart.textBoxes.length') === 0;
  console.log('Delete button removed the text box:', gone);

  console.log('=== Test 7: save/load round-trip preserves text boxes ===');
  window.eval(`
    chart.textBoxes.push({ id: 'tb-test-1', x: 111, y: 222, text: 'Saved Box', fontSize: 22, bold:true, italic:false, underline:true, align:'left' });
  `);
  const savedJson = window.eval('JSON.stringify(chart)');
  const reloaded = JSON.parse(savedJson);
  window.eval(`applyLoadedChartData(${JSON.stringify(reloaded)}, 'test')`);
  await wait(20);
  const roundTripped = window.eval("JSON.stringify(chart.textBoxes[0])");
  console.log('Text box after round-trip:', roundTripped);
  const roundTripOk = JSON.parse(roundTripped).text === 'Saved Box' && JSON.parse(roundTripped).bold === true;
  console.log('Round-trip preserved correctly:', roundTripOk);

  console.log('=== Test 8: old file without textBoxes migrates safely ===');
  const oldFile = { title:'Old', seats:[], rowIndex:0 };
  window.eval(`applyLoadedChartData(${JSON.stringify(oldFile)}, 'old')`);
  await wait(20);
  const migratedOk = window.eval("Array.isArray(chart.textBoxes) && chart.textBoxes.length===0");
  console.log('Old file migrates to empty array:', migratedOk);

  const pass = selectedCorrectly && moved && tbDeselected && textBoxPanelHidden && seatDeselected &&
               deleted && window.eval('selectedTextBoxId')===null && gone && roundTripOk && migratedOk;
  console.log(pass ? 'PART 2: PASS' : 'PART 2: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('PART 2: FAIL'); });
