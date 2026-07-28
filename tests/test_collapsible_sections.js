const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/test.html', 'utf8');
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

  console.log('=== Test 1: section order -- Build Rows, Selection, Tools ===');
  const titles = Array.from(doc.querySelectorAll('.section h3')).map(h=>h.textContent.replace('▾','').trim());
  console.log('Section titles in order:', titles);
  const idxBuild = titles.indexOf('Build Rows');
  const idxSelection = titles.indexOf('Selection');
  const idxTools = titles.indexOf('Tools');
  const orderCorrect = idxBuild < idxSelection && idxSelection < idxTools;
  console.log('Selection sits between Build Rows and Tools:', orderCorrect);

  console.log('=== Test 2: Export is NOT collapsible (Templates now IS) ===');
  const exportH3 = Array.from(doc.querySelectorAll('.section h3')).find(h=>h.textContent.includes('Export'));
  const templatesH3check = Array.from(doc.querySelectorAll('.section h3')).find(h=>h.textContent.includes('Templates'));
  const exportNotCollapsible = !exportH3.classList.contains('collapsible');
  const templatesIsNowCollapsible = templatesH3check.classList.contains('collapsible');
  console.log('Export header not collapsible:', exportNotCollapsible);
  console.log('Templates header IS collapsible:', templatesIsNowCollapsible);

  console.log('=== Test 3: clicking a collapsible header collapses it ===');
  const buildRowsH3 = Array.from(doc.querySelectorAll('.section h3.collapsible')).find(h=>h.textContent.includes('Build Rows'));
  const buildRowsSection = buildRowsH3.closest('.section');
  buildRowsH3.dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  const collapsedNow = buildRowsSection.classList.contains('collapsed');
  console.log('Build Rows section collapsed after click:', collapsedNow);
  buildRowsH3.dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  const expandedAgain = !buildRowsSection.classList.contains('collapsed');
  console.log('Expanded again after second click:', expandedAgain);

  console.log('=== Test 4: Collapse All collapses every collapsible section (now including Templates), but not Export ===');
  doc.getElementById('collapseAllBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  const allCollapsibleCollapsed = Array.from(doc.querySelectorAll('.section h3.collapsible')).every(h=>h.closest('.section').classList.contains('collapsed'));
  const exportStillOpen = !exportH3.closest('.section').classList.contains('collapsed');
  console.log('All collapsible sections collapsed:', allCollapsibleCollapsed);
  console.log('Export section unaffected (no collapsed class):', exportStillOpen);

  console.log('=== Test 5: Expand All reverses it ===');
  doc.getElementById('expandAllBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  const allExpanded = Array.from(doc.querySelectorAll('.section h3.collapsible')).every(h=>!h.closest('.section').classList.contains('collapsed'));
  console.log('All sections expanded again:', allExpanded);

  console.log('=== Test 6: divider exists between Flip and Notes ===');
  const flipDiv = doc.getElementById('flipChart').closest('.checkline');
  const notesLabel = doc.getElementById('notesInput').closest('label');
  const siblingBetween = flipDiv.nextElementSibling;
  const hasDivider = siblingBetween && siblingBetween.style.borderBottom && siblingBetween !== notesLabel;
  console.log('Divider element between Flip and Notes:', hasDivider);

  const pass = orderCorrect && exportNotCollapsible && templatesIsNowCollapsible && collapsedNow && expandedAgain &&
               allCollapsibleCollapsed && exportStillOpen && allExpanded && hasDivider;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
