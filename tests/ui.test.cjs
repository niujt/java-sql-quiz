const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {JSDOM} = require('jsdom');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'questions.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
function setup({hash='', wrong=[], stats={}, count=20, storage={}}={}) {
  const dom = new JSDOM('<header id="topbar"></header><main id="app"></main>', {url:'https://quiz.test/'+hash,runScripts:'dangerously'});
  const w=dom.window, frames=[];
  w.matchMedia=()=>({matches:true}); w.scrollTo=()=>{};
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.requestAnimationFrame=fn=>frames.push(fn);
  w.setTimeout=()=>0; // Transitions/scroll timers do not affect quiz state.
  w.alert=()=>{};
  // jsdom does not implement native dialog. This only models open/close events;
  // real browser focus trapping, Escape, backdrop and layout need browser QA.
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
  w.localStorage.setItem('jsq_count',JSON.stringify(count));
  w.localStorage.setItem('jsq_wrong_v2',JSON.stringify(wrong));
  w.localStorage.setItem('jsq_stats_v2',JSON.stringify(stats));
  for(const [key,value] of Object.entries(storage))w.localStorage.setItem(key,value);
  w.eval(source+'\n'+app+'\nwindow.testApi={get S(){return S},get cur(){return cur},get wrong(){return wrong},get stats(){return stats},get count(){return count},get sessions(){return sessions},historyBook,resetAll,QUESTIONS,home,levels,start,pick,next,requestExit,wrongBook,setCount,clearWrong};');
  const api=w.testApi;
  const click=selector=>{const b=api.cur.querySelector(selector)||w.document.querySelector(selector);assert.ok(b,selector);b.click();};
  return {w,api,click,frames,flush(){let n=0;while(frames.length){assert.ok(n++<1000,'finite animation queue');frames.shift()(100000)}},close(){dom.window.close()}};
}
const json=x=>JSON.parse(JSON.stringify(x));
const total=a=>Object.values(a.stats).reduce((n,s)=>n+s.total,0);
const correct=a=>a.pick(a.S.qs[a.S.i].q.a);

test('question bank is byte-identical to git baseline; 1200 valid unique questions',()=>{
  assert.equal(source,execFileSync('git',['show','HEAD:questions.js'],{cwd:root,encoding:'utf8'}));
  const h=setup(),qs=h.api.QUESTIONS;
  assert.equal(qs.length,1200);assert.equal(new Set(qs.map(q=>q.id)).size,1200);
  for(const q of qs){assert.ok(['java','boot','sql','ai'].includes(q.c));assert.ok([1,2,3].includes(q.l));assert.equal(q.o.length,4);assert.ok(q.a>=0&&q.a<4);assert.ok(q.q&&q.e)}
  h.close();
});
test('home quick links, selected count and reload persistence',()=>{
  const h=setup(),{api:a,w,click}=h;
  assert.equal(a.cur.querySelectorAll('.quick').length,2);assert.equal(a.cur.querySelectorAll('.tile').length,3);
  for(const n of [10,20,50,0]){click(`.seg button:nth-child(${[10,20,50,0].indexOf(n)+1})`);assert.equal(a.count,n);assert.equal(a.cur.querySelectorAll('[aria-pressed="true"]').length,1);assert.equal(w.localStorage.getItem('jsq_count'),String(n));click('.quick.mix');assert.equal(a.S.qs.length,n||1200);a.home()}
  click('.quick.wrong');assert.match(a.cur.textContent,/暂无错题/);h.close();
  const reload=setup({count:50});assert.equal(reload.api.count,50);assert.equal(reload.api.cur.querySelector('[aria-pressed="true"]').textContent,'50');reload.api.start('mix');assert.equal(reload.api.S.qs.length,50);reload.close();
});
test('all subject and level entry routes provide the matching pool',()=>{
  const h=setup(),{api:a,click}=h;
  a.setCount(0);
  for(const group of ['java','sql','ai']){a.levels(group);assert.equal(a.cur.querySelectorAll('.group').length,group==='java'?2:1)}
  for(const subject of ['java','boot','sql','ai'])for(const level of [0,1,2,3]){
    a.levels(subject==='boot'?'java':subject);
    click(`[data-subj="${subject}"] .${level?'lv'+level:'all'}`);
    assert.equal(a.S.qs.length,level?100:300);assert.ok(a.S.qs.every(({q})=>q.c===subject&&(!level||q.l===level)));
  }
  h.close();
});
test('answers recorded once; double next cannot skip; correct and incorrect feedback',()=>{
  const h=setup(),{api:a}=h;a.start('java',1);
  a.next();assert.equal(a.S.i,0);
  const q=a.S.qs[0].q;correct(a);a.pick((q.a+1)%4);
  assert.equal(total(a),1);assert.equal(a.S.right,1);assert.equal(a.cur.querySelectorAll('.opt:disabled').length,4);assert.equal(a.cur.querySelectorAll('.opt.ok').length,1);assert.match(a.cur.querySelector('#fb').textContent,/回答正确/);
  a.next();a.next();assert.equal(a.S.i,1);
  const q2=a.S.qs[1].q;a.pick((q2.a+1)%4);a.pick(q2.a);
  assert.equal(total(a),2);assert.equal(a.S.right,1);assert.deepEqual(json(a.wrong),[q2.id]);assert.equal(a.cur.querySelectorAll('.opt.bad').length,1);assert.match(a.cur.querySelector('#fb').textContent,/回答错误/);
  assert.equal(JSON.parse(h.w.localStorage.getItem('jsq_stats_v2'))['java-1'].total,2);h.close();
});
test('last question produces result once and retry preserves subject/level/count',()=>{
  const h=setup(),{api:a,click}=h;a.setCount(10);a.start('sql',2);
  for(let i=0;i<10;i++){assert.equal(a.S.i,i);correct(a);click('#next');a.next()}
  assert.equal(a.S.finished,true);assert.equal(a.S.i,10);assert.equal(total(a),10);assert.match(a.cur.textContent,/答对 10 \/ 10/);h.flush();assert.equal(a.cur.querySelector('#pct').textContent,'100');
  click('.btn');assert.equal(a.S.k,'sql');assert.equal(a.S.l,2);assert.equal(a.S.qs.length,10);assert.equal(a.S.i,0);assert.equal(a.S.right,0);assert.equal(total(a),10);h.close();
});
test('exit cancel preserves both unanswered and answered question; confirm preserves saved stats',()=>{
  const h=setup(),{api:a,w}=h;a.start('ai',3);
  for(const answered of [false,true]){if(answered)correct(a);const snapshot=json(a.S);a.requestExit();a.requestExit();assert.equal(w.document.querySelectorAll('dialog').length,1);w.document.querySelector('[data-cancel]').click();assert.deepEqual(json(a.S),snapshot);assert.equal(w.document.querySelector('dialog'),null)}
  const saved=w.localStorage.getItem('jsq_stats_v2');a.requestExit();w.document.querySelector('[data-confirm]').click();assert.equal(a.S,null);assert.ok(a.cur.querySelector('.heroBox'));assert.equal(w.localStorage.getItem('jsq_stats_v2'),saved);assert.equal(total(a),1);assert.equal(w.document.querySelector('dialog'),null);h.close();
});
test('wrong redo removes only correct answers and ignores count limit',()=>{
  const ids=['java-1-001','sql-2-001','ai-3-001'];const h=setup({wrong:ids}),{api:a}=h;
  a.setCount(10);a.start('wrong');assert.equal(a.S.qs.length,3);const first=a.S.qs[0].q,second=a.S.qs[1].q;
  correct(a);assert.ok(!a.wrong.includes(first.id));a.next();a.pick((second.a+1)%4);assert.equal(a.wrong.length,2);assert.ok(a.wrong.includes(second.id));assert.ok(a.wrong.includes(a.S.qs[2].q.id));assert.deepEqual(JSON.parse(h.w.localStorage.getItem('jsq_wrong_v2')),json(a.wrong));h.close();
});
test('rapid navigation safely discards stale animation and closes an open dialog',()=>{
  const h=setup(),{api:a,w}=h;a.start('mix');a.requestExit();a.home();assert.equal(w.document.querySelector('dialog'),null);assert.doesNotThrow(()=>h.flush());
  a.start('java',1);a.start('sql',2);assert.doesNotThrow(()=>h.flush());assert.equal(w.document.querySelector('#topbar .bar i').style.width,'5%');h.close();
});
test('deep links support all subjects, mixed practice and empty wrong list',()=>{
  for(const route of ['java-2','boot-1','sql','ai-3','mix','wrong']){const h=setup({hash:'#start='+route});if(route==='wrong')assert.equal(h.api.S,null);else assert.equal(h.api.S.k,route.split('-')[0]);h.close()}
});

test('wrong redo is not truncated by per-session count and clearing requires confirmation',()=>{
  const ids=Array.from({length:12},(_,i)=>'java-1-'+String(i+1).padStart(3,'0'));
  const h=setup({wrong:ids,count:10}),{api:a,w}=h;
  a.start('wrong');assert.equal(a.S.qs.length,12);correct(a);const saved=w.localStorage.getItem('jsq_stats_v2');a.wrongBook();
  a.clearWrong();w.document.querySelector('[data-cancel]').click();assert.equal(a.wrong.length,11);
  a.clearWrong();w.document.querySelector('[data-confirm]').click();assert.equal(a.wrong.length,0);assert.equal(w.localStorage.getItem('jsq_wrong_v2'),'[]');assert.equal(w.localStorage.getItem('jsq_stats_v2'),saved);h.close();
});

test('wrong redo final result can return home after resolving every saved item',()=>{
  const h=setup({wrong:['sql-1-001']}),{api:a,click}=h;a.start('wrong');correct(a);a.next();assert.equal(a.S.finished,true);assert.equal(a.wrong.length,0);assert.match(a.cur.textContent,/答对 1 \/ 1/);
  const home=[...a.cur.querySelectorAll('button')].find(b=>b.textContent==='返回首页');home.click();assert.equal(a.S,null);assert.ok(a.cur.querySelector('.heroBox'));h.close();
});

// Every persistence/deletion check runs against a fresh, disposable jsdom origin.
const snapshotStorage=w=>Object.fromEntries(Object.keys(w.localStorage).sort().map(k=>[k,w.localStorage.getItem(k)]));
const history=w=>JSON.parse(w.localStorage.getItem('jsq_history_v1')||'[]');
const learningKeys=['jsq_wrong','jsq_stats','jsq_wrong_v2','jsq_stats_v2','jsq_count','jsq_history_v1'];

test('existing aggregate progress loads without fabricated history or storage migration',()=>{
  const prior={'java-1':{done:{'java-1-001':1},right:4,total:7}};
  const h=setup({stats:prior,wrong:['java-1-001'],count:50,storage:{jsq_wrong:'["legacy-question"]',jsq_stats:'{"legacy":true}',otherApp:'keep'}});
  try{
    const before=snapshotStorage(h.w);h.api.historyBook();
    assert.equal(h.api.sessions.length,0);assert.equal(h.api.cur.querySelectorAll('.history-item').length,0);
    assert.deepEqual([...h.api.cur.querySelectorAll('.history-summary strong')].map(el=>el.textContent),['7','57%','1']);
    assert.equal(h.api.count,50);assert.deepEqual(json(h.api.wrong),['java-1-001']);assert.deepEqual(snapshotStorage(h.w),before);
    assert.equal(h.w.localStorage.getItem('jsq_history_v1'),null);
  }finally{h.close()}
});

test('history starts only after answering, persists each answer across reload, and ignores repeated picks',()=>{
  const h=setup({count:10});let saved;
  try{
    const a=h.api;a.start('java',1);a.home();a.historyBook();
    assert.equal(a.sessions.length,0);assert.equal(h.w.localStorage.getItem('jsq_history_v1'),null);
    a.start('java',1);correct(a);const first=history(h.w);
    assert.equal(first.length,1);assert.equal(first[0].status,'unfinished');assert.equal(first[0].answered,1);assert.equal(first[0].right,1);assert.equal(first[0].total,10);
    assert.ok(first[0].id);assert.ok(Number.isFinite(first[0].startedAt));assert.ok(first[0].updatedAt>=first[0].startedAt);
    a.pick((a.S.qs[0].q.a+1)%4);assert.deepEqual(history(h.w),first);
    a.next();a.pick((a.S.qs[1].q.a+1)%4);const second=history(h.w);
    assert.equal(second.length,1);assert.equal(second[0].id,first[0].id);assert.equal(second[0].answered,2);assert.equal(second[0].right,1);assert.equal(second[0].status,'unfinished');
    saved=snapshotStorage(h.w);
  }finally{h.close()}
  const reload=setup({storage:saved});
  try{reload.api.historyBook();assert.equal(reload.api.S,null);assert.equal(reload.api.sessions.length,1);assert.match(reload.api.cur.textContent,/未完成/);assert.match(reload.api.cur.textContent,/已答 2 \/ 10 题 · 答对 1 题/);assert.equal(reload.api.cur.querySelector('.history-detail strong').textContent,'50%');assert.deepEqual(snapshotStorage(reload.w),saved)}finally{reload.close()}
});

test('confirmed exit and history navigation record ended sessions once, preserving completed status',()=>{
  const h=setup({count:10}),a=h.api;
  try{
    a.start('sql',1);correct(a);a.requestExit();h.w.document.querySelector('[data-confirm]').click();
    assert.equal(history(h.w).length,1);assert.equal(history(h.w)[0].status,'ended');a.home();a.historyBook();assert.equal(history(h.w).length,1);
    a.start('ai',2);correct(a);a.historyBook();assert.equal(history(h.w).length,2);assert.equal(history(h.w)[0].status,'ended');
    a.start('sql',2);for(let i=0;i<10;i++){correct(a);a.next();a.next()}
    const completed=history(h.w);assert.equal(completed.length,3);assert.equal(completed[0].status,'completed');assert.equal(completed[0].answered,10);assert.equal(completed[0].right,10);
    a.next();a.pick(0);assert.deepEqual(history(h.w),completed);a.home();a.historyBook();
    assert.equal(history(h.w).length,3);assert.equal(history(h.w)[0].status,'completed');assert.equal(a.cur.querySelectorAll('.history-status.complete').length,1);
  }finally{h.close()}
});

test('wrong redo has its own persisted completed history without losing earlier attempts',()=>{
  const h=setup({count:10}),a=h.api;
  try{
    a.start('java',1);const q=a.S.qs[0].q;a.pick((q.a+1)%4);a.home();
    const original=json(history(h.w)[0]);a.start('wrong');assert.equal(a.S.qs.length,1);correct(a);a.next();
    const rows=history(h.w);assert.equal(rows.length,2);assert.equal(rows[0].k,'wrong');assert.equal(rows[0].title,'错题重做');assert.equal(rows[0].status,'completed');assert.equal(rows[0].total,1);assert.equal(rows[0].right,1);assert.deepEqual(rows[1],original);assert.equal(a.wrong.length,0);
  }finally{h.close()}
});

test('history safely escapes stored titles and paginates newest-first in groups of 20',()=>{
  const rows=Array.from({length:45},(_,i)=>({id:'session-'+i,startedAt:1700000000000+i*1000,updatedAt:1700000000000+i*1000,title:i===44?'<img src=x onerror="window.injected=true"> & "title"':'Practice '+i,answered:1,total:10,right:i%2,status:'ended'}));
  const h=setup({storage:{jsq_history_v1:JSON.stringify(rows)}}),a=h.api;
  try{
    a.historyBook();assert.equal(a.cur.querySelectorAll('.history-item').length,20);assert.equal(a.cur.querySelector('h3').textContent,rows[44].title);assert.equal(a.cur.querySelector('img'),null);assert.equal(h.w.injected,undefined);
    assert.equal(a.cur.querySelector('time').dateTime,new Date(rows[44].startedAt).toISOString());
    const more=()=>[...a.cur.querySelectorAll('button')].find(b=>b.textContent==='查看更多记录');
    more().click();assert.equal(a.cur.querySelectorAll('.history-item').length,40);more().click();assert.equal(a.cur.querySelectorAll('.history-item').length,45);assert.equal(more(),undefined);assert.equal(a.cur.querySelectorAll('h3')[44].textContent,'Practice 0');
  }finally{h.close()}
});

test('empty history CTA actual inline onclick starts mixed practice without recording an unanswered session',()=>{
  const h=setup(),a=h.api;
  try{h.click('.history-entry');assert.ok(a.cur.querySelector('.history-empty'));h.click('.history-empty button');assert.equal(a.S.k,'mix');assert.equal(a.S.qs.length,20);assert.equal(a.S.attempted,0);assert.equal(a.cur.querySelectorAll('.opt').length,4);assert.equal(h.w.localStorage.getItem('jsq_history_v1'),null)}finally{h.close()}
});

test('cancel reset preserves all storage and live session; confirmed reset removes exact whitelist only and cannot resurrect it',()=>{
  const unrelated={otherApp:'preserve',jsq_stats_v3:'future unrelated key',jsq_history_v1_backup:'backup',jsq_count_extra:'value'};
  const h=setup({count:50,storage:{...unrelated,jsq_wrong:'["legacy"]',jsq_stats:'{"legacy":1}'}}),a=h.api;
  try{
    a.start('java',1);a.pick((a.S.qs[0].q.a+1)%4);
    const bank=JSON.stringify(a.QUESTIONS),session=json(a.S),storage=snapshotStorage(h.w),stats=json(a.stats),wrong=json(a.wrong),rows=json(a.sessions);
    assert.ok(learningKeys.every(k=>h.w.localStorage.getItem(k)!==null));
    a.resetAll();a.resetAll();assert.equal(h.w.document.querySelectorAll('dialog').length,1);assert.match(h.w.document.querySelector('dialog').textContent,/无法恢复/);h.w.document.querySelector('[data-cancel]').click();
    assert.deepEqual(snapshotStorage(h.w),storage);assert.deepEqual(json(a.S),session);assert.deepEqual(json(a.stats),stats);assert.deepEqual(json(a.wrong),wrong);assert.deepEqual(json(a.sessions),rows);assert.equal(a.count,50);
    a.resetAll();h.w.document.querySelector('[data-confirm]').click();
    const verify=()=>{assert.deepEqual(snapshotStorage(h.w),unrelated);assert.ok(learningKeys.every(k=>h.w.localStorage.getItem(k)===null));assert.equal(a.S,null);assert.equal(a.count,20);assert.equal(total(a),0);assert.equal(a.wrong.length,0);assert.equal(a.sessions.length,0);assert.equal(JSON.stringify(a.QUESTIONS),bank)};
    verify();assert.equal(a.cur.querySelector('[aria-pressed="true"]').textContent,'20');a.home();a.historyBook();verify();assert.ok(a.cur.querySelector('.history-empty'));
    a.resetAll();h.w.document.querySelector('[data-confirm]').click();verify();a.home();verify();
    a.start('mix');assert.equal(a.S.qs.length,20);assert.equal(h.w.localStorage.getItem('jsq_history_v1'),null);a.home();verify();
  }finally{h.close()}
});

test('malformed history is ignored safely without deleting original stored data',()=>{
  const good={id:'valid',startedAt:1700000000000,updatedAt:1700000000000,title:'Valid',answered:1,total:2,right:1,status:'unfinished'};
  const badRows=[null,{}, {...good,id:2},{...good,startedAt:1e100},{...good,answered:0},{...good,total:0},{...good,right:2}];
  for(const raw of ['{bad json','{}',JSON.stringify([...badRows,good])]){
    const h=setup({storage:{jsq_history_v1:raw}});
    try{assert.doesNotThrow(()=>h.api.historyBook());assert.equal(h.api.sessions.length,raw.startsWith('[')?1:0);assert.equal(h.w.localStorage.getItem('jsq_history_v1'),raw)}finally{h.close()}
  }
});
