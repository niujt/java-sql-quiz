const $=s=>document.querySelector(s),app=$('#app');
const NAMES={java:'Java',sql:'SQL',mix:'混合练习',wrong:'错题重做'};
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
let wrong=load('jsq_wrong',[]),stats=load('jsq_stats',{java:{done:{},right:0,total:0},sql:{done:{},right:0,total:0}});
let S=null;
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function home(){
  S=null;const cnt=c=>QUESTIONS.filter(q=>q.c===c).length;
  const card=(k,ico,desc,pct)=>`<button class="cat ${k}" onclick="start('${k}')"><div class="ico">${ico}</div><div style="flex:1"><b>${NAMES[k]}</b><small>${desc}</small>${pct!=null?`<div class="bar"><i style="width:${pct}%"></i></div>`:''}</div></button>`;
  const pc=c=>Math.round(Object.keys(stats[c].done).length/cnt(c)*100);
  const st=c=>{const s=stats[c];return `<div class="stat"><small>${NAMES[c]} 已练 / 总题</small><b>${Object.keys(s.done).length}</b> / ${cnt(c)}<small>正确率 ${s.total?Math.round(s.right/s.total*100):0}%（共答 ${s.total} 次）</small></div>`};
  app.innerHTML=`<h1>Java & SQL 刷题</h1><p class="sub">每次一题，即时反馈，错题自动收录</p>
  <div class="cats">${card('java','☕','基础 · OOP · 集合 · 异常 · 多线程 · JVM',pc('java'))}
  ${card('sql','🗄️','查询 · 连接 · 分组 · 子查询 · 索引 · 事务',pc('sql'))}
  ${card('mix','🔀','两科随机混合，共 '+QUESTIONS.length+' 题')}
  ${card('wrong','📕','错题本：当前 '+wrong.length+' 题')}</div>
  <h2>学习进度</h2><div class="card"><div class="stats">${st('java')}${st('sql')}</div></div>
  ${wrong.length?`<h2>错题本</h2><div class="card">${wrong.map(id=>`<div class="wl">${esc(QUESTIONS[id].q)}</div>`).join('')}<button class="link" onclick="clearWrong()">清空错题本</button></div>`:''}
  <p class="center"><button class="link" onclick="resetAll()">重置全部记录</button></p>`;
}
function start(k){
  let qs=k==='mix'?QUESTIONS:k==='wrong'?wrong.map(i=>QUESTIONS[i]).filter(Boolean):QUESTIONS.filter(q=>q.c===k);
  if(!qs.length){alert('错题本是空的，太棒了！');return}
  S={k,qs:shuffle(qs).map(q=>({q,ord:shuffle([0,1,2,3].slice(0,q.o.length))})),i:0,right:0};show();
}
function show(){
  const {q,ord}=S.qs[S.i];
  app.innerHTML=`<div class="top"><button class="link" onclick="if(confirm('退出本次练习？'))home()">‹ 返回</button><span>${NAMES[S.k]} · ${S.i+1}/${S.qs.length}</span><span>✔ ${S.right}</span></div>
  <div class="bar" style="margin-bottom:14px"><i style="width:${S.i/S.qs.length*100}%"></i></div>
  <div class="card"><span class="tag">${q.c==='java'?'Java':'SQL'} · ${q.t}</span><p class="q">${esc(q.q)}</p>
  ${ord.map((o,n)=>`<button class="opt" data-o="${o}" onclick="pick(${o})">${'ABCD'[n]}. ${esc(q.o[o])}</button>`).join('')}<div id="fb"></div></div>`;
}
function pick(o){
  const {q}=S.qs[S.i],ok=o===q.a;
  document.querySelectorAll('.opt').forEach(b=>{b.disabled=true;const v=+b.dataset.o;if(v===q.a)b.classList.add('ok');else if(v===o)b.classList.add('bad')});
  const s=stats[q.c];s.total++;s.done[q.id]=1;
  if(ok){S.right++;s.right++;if(S.k==='wrong')wrong=wrong.filter(x=>x!==q.id)}else if(!wrong.includes(q.id))wrong.push(q.id);
  save('jsq_wrong',wrong);save('jsq_stats',stats);
  const last=S.i===S.qs.length-1;
  $('#fb').innerHTML=`<div class="fb ${ok?'ok':'bad'}"><b>${ok?'✅ 回答正确':'❌ 回答错误'}</b><br>${esc(q.e)}</div><button class="btn" onclick="next()">${last?'查看成绩':'下一题'}</button>`;
  $('#fb').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function next(){S.i++;S.i<S.qs.length?show():result()}
function result(){
  const n=S.qs.length,p=Math.round(S.right/n*100);
  app.innerHTML=`<h1>练习完成</h1><p class="sub">${NAMES[S.k]}</p><div class="card"><div class="big">${p}%</div>
  <p class="center">答对 ${S.right} / ${n} 题 ${p>=90?'🎉 优秀！':p>=60?'👍 继续加油':'💪 多练几遍'}</p>
  <button class="btn" onclick="start('${S.k}')">再练一次</button>${wrong.length?`<button class="btn ghost" onclick="start('wrong')">重做错题（${wrong.length}）</button>`:''}
  <button class="btn ghost" onclick="home()">返回首页</button></div>`;
}
function clearWrong(){if(confirm('确定清空错题本？')){wrong=[];save('jsq_wrong',wrong);home()}}
function resetAll(){if(confirm('确定重置所有记录？')){localStorage.removeItem('jsq_wrong');localStorage.removeItem('jsq_stats');location.reload()}}
const m=location.hash.match(/start=(\w+)/);m&&NAMES[m[1]]?start(m[1]):home();
