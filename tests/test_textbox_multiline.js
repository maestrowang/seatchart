const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/test.html', 'utf8');
const noop = () => {};
const drawnLines = [];
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop,
  arc: noop, rect: noop, fillRect: noop, strokeRect: noop,
  fillText(text){ drawnLines.push(text); },
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

  console.log('=== Test 1: a multi-line text box renders each line separately ===');
  window.eval(`
    chart.textBoxes.push({ id: 'tb1', x: 400, y: 300, text: 'Line One\\nLine Two\\nLine Three', fontSize: 16, bold:false, italic:false, underline:false, align:'center' });
  `);
  await wait(20);
  drawnLines.length = 0;
  window.eval('render()');
  console.log('Drawn lines:', drawnLines);
  const allThreeDrawn = drawnLines.includes('Line One') && drawnLines.includes('Line Two') && drawnLines.includes('Line Three');
  console.log('All 3 lines drawn separately:', allThreeDrawn);

  console.log('=== Test 2: textBoxMetrics reports height scaling with line count ===');
  const metrics1 = window.eval(`textBoxMetrics(getTextBox('tb1'))`);
  const heightFor3Lines = window.eval(`textBoxMetrics(getTextBox('tb1')).height`);
  window.eval(`getTextBox('tb1').text = 'Just one line';`);
  const heightFor1Line = window.eval(`textBoxMetrics(getTextBox('tb1')).height`);
  console.log('Height for 3 lines:', heightFor3Lines, '| height for 1 line:', heightFor1Line);
  const heightScales = heightFor3Lines > heightFor1Line * 2.5;
  console.log('Height correctly scales with line count:', heightScales);
  window.eval(`getTextBox('tb1').text = 'Line One\\nLine Two\\nLine Three';`);

  console.log('=== Test 3: hit-testing (textBoxAt) accounts for the taller multi-line box ===');
  const hitAtCenter = window.eval(`
    const tb = getTextBox('tb1');
    const screen = flipPoint(tb.x, tb.y);
    !!textBoxAt(screen.x, screen.y)
  `);
  const hitBelowOldSingleLineBounds = window.eval(`
    const tb = getTextBox('tb1');
    const screen = flipPoint(tb.x, tb.y + 20); // well below where a 1-line box would end, but within a 3-line box
    !!textBoxAt(screen.x, screen.y)
  `);
  console.log('Hit test at center works:', hitAtCenter);
  console.log('Hit test extends correctly to cover the taller multi-line box:', hitBelowOldSingleLineBounds);

  console.log('=== Test 4: inline editor is now a TEXTAREA, and Enter creates a newline (does not commit) ===');
  doc.getElementById('textBoxTool').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  window.eval(`getTextBox('tb1').text = 'Start';`);
  window.eval(`selectTextBox(getTextBox('tb1'))`);
  window.eval(`startInlineTextBoxEdit(getTextBox('tb1'))`);
  await wait(10);
  const editor = doc.querySelector('.inline-seat-editor');
  console.log('Editor tag name:', editor.tagName);
  const isTextarea = editor.tagName === 'TEXTAREA';
  console.log('Editor is a TEXTAREA (not a single-line input):', isTextarea);

  editor.value = 'First line';
  editor.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await wait(10);
  const stillPresent = !!doc.querySelector('.inline-seat-editor');
  console.log('Editor still present after Enter (did NOT commit/exit):', stillPresent);

  // Simulate the natural browser behavior: Enter in a textarea inserts a newline into .value
  editor.value = 'First line\nSecond line';
  await wait(10);
  console.log('Editor value after simulated newline entry:', JSON.stringify(editor.value));

  console.log('=== Test 5: blur commits the multi-line text correctly ===');
  editor.dispatchEvent(new window.Event('blur', {bubbles:true}));
  await wait(20);
  const committedText = window.eval(`getTextBox('tb1').text`);
  console.log('Committed text:', JSON.stringify(committedText));
  const committedCorrectly = committedText === 'First line\nSecond line';
  console.log('Multi-line text committed correctly on blur:', committedCorrectly);

  console.log('=== Test 6: Escape still cancels without saving ===');
  window.eval(`startInlineTextBoxEdit(getTextBox('tb1'))`);
  await wait(10);
  const editor2 = doc.querySelector('.inline-seat-editor');
  editor2.value = 'Should not be saved\nmulti-line';
  editor2.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(20);
  const afterEscape = window.eval(`getTextBox('tb1').text`);
  const escapeWorked = afterEscape === 'First line\nSecond line';
  console.log('Text unchanged after Escape:', escapeWorked);

  console.log('=== Test 7: sidebar Text field is now a textarea ===');
  const sidebarField = doc.getElementById('textBoxContentInput');
  console.log('Sidebar field tag:', sidebarField.tagName);
  const sidebarIsTextarea = sidebarField.tagName === 'TEXTAREA';
  console.log('Sidebar Text field is a textarea:', sidebarIsTextarea);

  const pass = allThreeDrawn && heightScales && hitAtCenter && hitBelowOldSingleLineBounds &&
               isTextarea && stillPresent && committedCorrectly && escapeWorked && sidebarIsTextarea;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
