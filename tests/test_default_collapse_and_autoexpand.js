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

  console.log('=== Test 1: default collapse states on fresh load ===');
  const states = {
    'section-build-rows': doc.getElementById('section-build-rows').classList.contains('collapsed'),
    'section-selection': doc.getElementById('section-selection').classList.contains('collapsed'),
    'section-tools': doc.getElementById('section-tools').classList.contains('collapsed'),
    'section-groups': doc.getElementById('section-groups').classList.contains('collapsed'),
    'section-view': doc.getElementById('section-view').classList.contains('collapsed'),
    'section-save-load': doc.getElementById('section-save-load').classList.contains('collapsed'),
  };
  console.log('Collapsed states:', JSON.stringify(states));
  const defaultsCorrect = states['section-build-rows']===false && states['section-selection']===true &&
                           states['section-tools']===false && states['section-groups']===true &&
                           states['section-view']===false && states['section-save-load']===true;
  console.log('Defaults match spec (Build Rows/Tools/View expanded, Selection/Groups/Save&Load collapsed):', defaultsCorrect);

  console.log('=== Test 2: selecting a seat auto-expands Selection ===');
  window.eval('selectSeat(chart.seats[0])');
  await wait(10);
  const selectionExpanded = !doc.getElementById('section-selection').classList.contains('collapsed');
  console.log('Selection section auto-expanded:', selectionExpanded);

  console.log('=== Test 3: manually re-collapsing Selection, then selecting again re-expands it ===');
  doc.getElementById('section-selection').classList.add('collapsed');
  window.eval('selectSeat(null)');
  await wait(10);
  window.eval('selectSeat(chart.seats[1])');
  await wait(10);
  const reExpanded = !doc.getElementById('section-selection').classList.contains('collapsed');
  console.log('Re-expanded after being manually collapsed then re-selecting:', reExpanded);

  console.log('=== Test 4: assigning an instrument (creating a group) auto-expands Groups ===');
  console.log('Groups collapsed before:', doc.getElementById('section-groups').classList.contains('collapsed'));
  window.eval(`
    chart.seats[0].preset = 'Violin 1';
    chart.seats[0].color = '#3EA6CC';
    refreshAutoGroupList();
  `);
  await wait(10);
  const groupsExpanded = !doc.getElementById('section-groups').classList.contains('collapsed');
  console.log('Groups section auto-expanded after group creation:', groupsExpanded);

  console.log('=== Test 5: creating a custom group also auto-expands Groups ===');
  doc.getElementById('section-groups').classList.add('collapsed');
  window.eval(`
    chart.groups.push({ id: uid(), name: 'Test Group', seatIds: [chart.seats[0].id] });
    refreshCustomGroupList();
  `);
  await wait(10);
  const groupsExpandedAgain = !doc.getElementById('section-groups').classList.contains('collapsed');
  console.log('Groups section auto-expanded after custom group creation:', groupsExpandedAgain);

  console.log('=== Test 6: podium selection also auto-expands Selection ===');
  doc.getElementById('section-selection').classList.add('collapsed');
  window.eval(`chart.podium.enabled = true; selectPodium();`);
  await wait(10);
  const podiumExpanded = !doc.getElementById('section-selection').classList.contains('collapsed');
  console.log('Selection auto-expanded on podium select:', podiumExpanded);

  const pass = defaultsCorrect && selectionExpanded && reExpanded && groupsExpanded && groupsExpandedAgain && podiumExpanded;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
