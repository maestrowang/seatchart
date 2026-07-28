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

  console.log('=== Test 1: clicking the Text Box tool enters textbox mode ===');
  doc.getElementById('textBoxTool').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  console.log('mode is textbox:', window.eval("mode") === 'textbox');
  console.log('Button shows toggled state:', doc.getElementById('textBoxTool').classList.contains('toggled'));

  console.log('=== Test 2: clicking the canvas creates a text box and opens inline editing ===');
  const beforeCount = window.eval('chart.textBoxes.length');
  canvasEl.dispatchEvent(new window.MouseEvent('mousedown', { bubbles:true, clientX: 400, clientY: 300 }));
  await wait(20);
  const afterCount = window.eval('chart.textBoxes.length');
  console.log('Text box count before/after:', beforeCount, afterCount);
  const created = afterCount === beforeCount + 1;
  console.log('Text box created:', created);
  const editorAppeared = !!doc.querySelector('.inline-seat-editor');
  console.log('Inline editor opened immediately:', editorAppeared);
  console.log('Mode reset to null after placement:', window.eval("mode") === null);

  console.log('=== Test 3: typing and committing (via blur) sets the text box content ===');
  const editor = doc.querySelector('.inline-seat-editor');
  editor.value = 'Intermission';
  editor.dispatchEvent(new window.Event('blur', { bubbles: true }));
  await wait(20);
  const tbId = window.eval('chart.textBoxes[0].id');
  const tbText = window.eval(`getTextBox('${tbId}').text`);
  console.log('Text box text committed:', tbText === 'Intermission');

  console.log('=== Test 4: text box was auto-selected, inspector shows it ===');
  const inspectorVisible = doc.getElementById('textBoxInspector').style.display === 'block';
  console.log('Text box inspector visible:', inspectorVisible);
  const contentInputValue = doc.getElementById('textBoxContentInput').value;
  console.log('Content input reflects the text:', contentInputValue === 'Intermission');

  console.log('=== Test 5: font size slider updates the text box ===');
  doc.getElementById('textBoxFontSize').value = 28;
  doc.getElementById('textBoxFontSize').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(10);
  console.log('Font size updated:', window.eval(`getTextBox('${tbId}').fontSize`) === 28);

  console.log('=== Test 6: bold/italic/underline toggles work ===');
  doc.getElementById('textBoxBoldBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  doc.getElementById('textBoxItalicBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  doc.getElementById('textBoxUnderlineBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  const boldOn = window.eval(`getTextBox('${tbId}').bold`) === true;
  const italicOn = window.eval(`getTextBox('${tbId}').italic`) === true;
  const underlineOn = window.eval(`getTextBox('${tbId}').underline`) === true;
  console.log('Bold/Italic/Underline all set:', boldOn, italicOn, underlineOn);
  const boldBtnToggled = doc.getElementById('textBoxBoldBtn').classList.contains('toggled');
  console.log('Bold button shows toggled state:', boldBtnToggled);

  console.log('=== Test 7: alignment buttons work ===');
  doc.getElementById('textBoxAlignRightBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  const alignRight = window.eval(`getTextBox('${tbId}').align`) === 'right';
  const rightBtnToggled = doc.getElementById('textBoxAlignRightBtn').classList.contains('toggled');
  const centerBtnUntoggled = !doc.getElementById('textBoxAlignCenterBtn').classList.contains('toggled');
  console.log('Alignment set to right:', alignRight);
  console.log('Right button toggled, center button not:', rightBtnToggled && centerBtnUntoggled);

  const pass1 = created && editorAppeared && tbText==='Intermission' && inspectorVisible && contentInputValue==='Intermission' &&
                window.eval(`getTextBox('${tbId}').fontSize`)===28 && boldOn && italicOn && underlineOn && boldBtnToggled &&
                alignRight && rightBtnToggled && centerBtnUntoggled;
  console.log(pass1 ? 'PART 1: PASS' : 'PART 1: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('PART 1: FAIL'); });
