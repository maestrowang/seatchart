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

  console.log('=== Test 1: section order -- Templates between View and Save & Load ===');
  const titles = Array.from(doc.querySelectorAll('.section h3')).map(h=>h.textContent.replace('▾','').trim());
  console.log('Section titles in order:', titles);
  const idxView = titles.indexOf('View');
  const idxTemplates = titles.indexOf('Templates');
  const idxSaveLoad = titles.indexOf('Save & Load');
  const orderCorrect = idxView < idxTemplates && idxTemplates < idxSaveLoad;
  console.log('Templates sits between View and Save & Load:', orderCorrect);

  console.log('=== Test 2: Templates is collapsible and defaults to collapsed ===');
  const templatesSection = doc.getElementById('section-templates');
  const isCollapsible = !!templatesSection.querySelector('h3.collapsible');
  const isCollapsedByDefault = templatesSection.classList.contains('collapsed');
  console.log('Templates header is collapsible:', isCollapsible);
  console.log('Templates collapsed by default:', isCollapsedByDefault);

  console.log('=== Test 3: clicking Templates header toggles it ===');
  const templatesH3 = templatesSection.querySelector('h3.collapsible');
  templatesH3.dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  const expandedAfterClick = !templatesSection.classList.contains('collapsed');
  console.log('Templates expanded after click:', expandedAfterClick);
  templatesH3.dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  const collapsedAgain = templatesSection.classList.contains('collapsed');
  console.log('Templates collapsed again after second click:', collapsedAgain);

  console.log('=== Test 4: Collapse All / Expand All now include Templates ===');
  doc.getElementById('expandAllBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  const expandedByExpandAll = !templatesSection.classList.contains('collapsed');
  console.log('Templates expanded by Expand All:', expandedByExpandAll);
  doc.getElementById('collapseAllBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  const collapsedByCollapseAll = templatesSection.classList.contains('collapsed');
  console.log('Templates collapsed by Collapse All:', collapsedByCollapseAll);

  console.log('=== Test 5: Export remains the only permanently non-collapsible section ===');
  const exportH3 = Array.from(doc.querySelectorAll('.section h3')).find(h=>h.textContent.includes('Export'));
  const exportNotCollapsible = !exportH3.classList.contains('collapsible');
  console.log('Export still not collapsible:', exportNotCollapsible);

  console.log('=== Test 6: Templates content (template list, refresh button) still present and functional ===');
  const hasTemplateList = !!doc.getElementById('templateList');
  const hasRefreshBtn = !!doc.getElementById('refreshTemplatesBtn');
  console.log('templateList element present:', hasTemplateList);
  console.log('refreshTemplatesBtn element present:', hasRefreshBtn);

  const pass = orderCorrect && isCollapsible && isCollapsedByDefault && expandedAfterClick && collapsedAgain &&
               expandedByExpandAll && collapsedByCollapseAll && exportNotCollapsible && hasTemplateList && hasRefreshBtn;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
