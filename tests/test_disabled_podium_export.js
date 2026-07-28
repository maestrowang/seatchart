const { JSDOM } = require('jsdom'); const fs=require('fs');
const html=fs.readFileSync('/home/claude/test.html','utf8'); const noop=()=>{};
const drawn=[];
const c={save:noop,restore:noop,translate:noop,scale:noop,rotate:noop,beginPath:noop,moveTo:noop,lineTo:noop,closePath:noop,fill:noop,
  stroke(){ drawn.push({op:'stroke', dash:this._dash}); },
  arc:noop, rect(){ drawn.push({op:'rect'}); }, fillRect:noop, strokeRect:noop,
  fillText(t){ drawn.push({op:'text', t}); },
  setLineDash(d){ this._dash = d && d.length ? d.slice() : null; },
  measureText:t=>({width:(t||'').length*7}), clearRect:noop, drawImage:noop, ellipse:noop, roundRect:noop,
  bezierCurveTo:noop, quadraticCurveTo:noop,
  getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(128),width:w,height:h}), putImageData:noop};
const dom=new JSDOM(html,{url:'https://x.io/',runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,
 beforeParse(w){w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy(c,{get(t,p){if(p in t)return t[p];if(typeof p==='string'&&(p.endsWith('Style')||['font','lineWidth','lineCap','globalAlpha','textAlign','textBaseline'].includes(p)))return '';return noop;},set(){return true;}});};}});
const {window}=dom; const wait=ms=>new Promise(r=>setTimeout(r,ms));
const R=[]; const rec=(n,ok,d='')=>R.push({n,ok,d});
(async()=>{
  await wait(300);
  window.eval('chart.seats=[];chart.rowIndex=0;chart.rowRadii=[];chart.rowShapes=[];chart.rowSagittaBase=[];chart.rowWidthBase=[];chart.rowSpanRad=[];chart.rowGapBase=[];chart.rowSeatSpacingPct=[];chart.edgeK=undefined;chart.standPositions={};');
  await wait(5);
  window.eval('addRow(6,"arc")'); await wait(15);
  window.eval('chart.podium.enabled=false;'); await wait(5);

  // The prompt is wrapped to fit its box, so it arrives as several short lines
  // ("Click to" / "enable" / "podium"). Join them before matching.
  const hasPrompt = () => /clicktoenablepodium/i.test(
    drawn.filter(d=>d.op==='text').map(d=>d.t||'').join('').replace(/\s+/g,''));
  // Other things legitimately draw dashed lines (hidden seats, the stage floor),
  // so look for the placeholder's own outlined box rather than any dash at all.
  const hasPlaceholderBox = () => drawn.some(d=>d.op==='rect');

  // on screen the placeholder should still guide the user
  drawn.length=0; window.eval('exportRenderOptions=null; render();'); await wait(10);
  rec('on screen: dashed placeholder box is shown', hasPlaceholderBox());
  rec('on screen: "Click to enable podium" is shown', hasPrompt());

  // in every export mode it should be absent
  for(const mode of ['screen','print-color','print-bw']){
    drawn.length=0;
    window.eval(`composeExportCanvas('${mode}',1)`); await wait(10);
    rec(`export "${mode}": no "Click to enable podium" text`, !hasPrompt());
    rec(`export "${mode}": no placeholder box`, !hasPlaceholderBox());
  }

  // an ENABLED podium must still export normally
  window.eval('chart.podium.enabled=true; chart.podium.label="Podium";'); await wait(5);
  drawn.length=0;
  window.eval("composeExportCanvas('print-color',1)"); await wait(10);
  rec('an enabled podium still exports', drawn.some(d=>d.op==='text' && /Podium/.test(d.t||'')));

  window.eval('exportRenderOptions=null;');
  R.forEach(r=>console.log(`  ${r.ok?'PASS':'FAIL'}  ${r.n}${r.d?'  '+r.d:''}`));
  const f=R.filter(r=>!r.ok).length;
  console.log(`\n${R.length-f}/${R.length} checks passed`);
  console.log(f===0?'RESULT: PASS':'RESULT: FAIL');
})().catch(e=>{console.error('ERROR:',e);console.log('RESULT: FAIL');});
