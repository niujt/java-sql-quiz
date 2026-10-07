const $=s=>document.querySelector(s),app=$('#app');
const SUBJ={java:{name:'Java',ico:'☕',desc:'基础 · OOP · 集合 · 并发 · JVM'},sql:{name:'SQL',ico:'🗄️',desc:'查询 · 连接 · 索引 · 事务 · 优化（MySQL InnoDB）'}};
const LV={1:{name:'初级',desc:'语法与基础概念'},2:{name:'中级',desc:'常用原理与实践'},3:{name:'高级',desc:'底层机制与调优'}};
const BY_ID=Object.fromEntries(QUESTIONS.map(q=>[q.id,q]));
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
['jsq_wrong','jsq_stats'].forEach(k=>localStorage.removeItem(k)); // 旧版数据（按下标存储）已不兼容
let wrong=load('jsq_wrong_v2',[]).filter(id=>BY_ID[id]);
let stats=load('jsq_stats_v2',{});
const st=k=>stats[k]||(stats[k]={done:{},right:0,total:0});
let S=null,count=load('jsq_count',20);
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pool=(c,l)=>QUESTIONS.filter(q=>(!c||q.c===c)&&(!l||q.l===l));
const prog=(c,l)=>{const s=st(c+'-'+l),n=pool(c,l).length,d=Object.keys(s.done).length;return {d,n,pct:Math.round(d/n*100),acc:s.total?Math.round(s.right/s.total*100):0,total:s.total}};
const bar=p=>`<div class="bar"><i style="width:${p}%"></i></div>`;
function card(cls,ico,title,desc,act,extra=''){return `<button class="cat ${cls}" data-act="${act}" onclick="${act}"><div class="ico">${ico}</div><div style="flex:1;min-width:0"><b>${title}</b><small>${desc}</small>${extra}</div><span class="arr">›</span></button>`}
function home(){
  S=null;if(location.hash)history.replaceState(null,'',location.pathname);
  const sp=c=>{let d=0,n=0;[1,2,3].forEach(l=>{const p=prog(c,l);d+=p.d;n+=p.n});return {d,n,pct:Math.round(d/n*100)}};
  app.innerHTML=`<h1>Java & SQL 刷题</h1><p class="sub">分级练习 · 即时反馈 · 错题自动收录</p>
  <div class="cats">${['java','sql'].map(c=>{const p=sp(c);return card(c,SUBJ[c].ico,SUBJ[c].name,`${SUBJ[c].desc}<br>已练 ${p.d}/${p.n}`,`levels('${c}')`,bar(p.pct))}).join('')}
  ${card('mix','🔀','混合练习',`两科全级别随机 ${count} 题`,`start('mix')`)}
  ${card('wrong','📕','错题本',`当前 ${wrong.length} 题，答对即移出`,`wrongBook()`)}</div>
  <h2>每次练习题数</h2><div class="seg">${[10,20,50,0].map(n=>`<button class="${n===count?'on':''}" onclick="setCount(${n})">${n||'全部'}</button>`).join('')}</div>
  <h2>学习进度</h2><div class="card">${['java','sql'].map(c=>[1,2,3].map(l=>{const p=prog(c,l);return `<div class="row"><span>${SUBJ[c].name} · ${LV[l].name}</span><span>${p.d}/${p.n} · 正确率 ${p.acc}%</span></div>${bar(p.pct)}`}).join('')).join('')}</div>
  <p class="center"><button class="link" onclick="resetAll()">重置全部记录</button></p>`;
}
function setCount(n){count=n;save('jsq_count',n);home()}
function levels(c){
  S=null;
  app.innerHTML=`<div class="top"><button class="link" onclick="home()">‹ 首页</button><span></span></div><h1>${SUBJ[c].ico} ${SUBJ[c].name}</h1><p class="sub">选择难度（每级 100 题，每次 ${count||'全部'} 题）</p>
  <div class="cats">${[1,2,3].map(l=>{const p=prog(c,l);return card('lv'+l,['🌱','🚀','🔥'][l-1],LV[l].name,`${LV[l].desc} · 已练 ${p.d}/${p.n} · 正确率 ${p.acc}%`,`start('${c}',${l})`,bar(p.pct))}).join('')}
  ${card('mix','🎲',SUBJ[c].name+' 全部级别',`三个级别随机混合`,`start('${c}',0)`)}</div>`;
}
function wrongBook(){
  S=null;
  app.innerHTML=`<div class="top"><button class="link" onclick="home()">‹ 首页</button><span></span></div><h1>📕 错题本</h1><p class="sub">共 ${wrong.length} 题</p>
  ${wrong.length?`<button class="btn" onclick="start('wrong')">重做全部错题</button><div class="card" style="margin-top:14px">${wrong.map(id=>{const q=BY_ID[id];return `<div class="wl"><span class="tag">${SUBJ[q.c].name} · ${LV[q.l].name}</span> ${esc(q.q)}<div class="ans">✔ ${esc(q.o[q.a])}</div></div>`}).join('')}</div><p class="center"><button class="link" onclick="clearWrong()">清空错题本</button></p>`:'<div class="card center">暂无错题，继续保持！</div>'}`;
}
function start(k,l){
  let qs,title;
  if(k==='wrong'){qs=wrong.map(id=>BY_ID[id]);title='错题重做'}
  else if(k==='mix'){qs=QUESTIONS;title='混合练习'}
  else{qs=pool(k,l||0);title=SUBJ[k].name+(l?' · '+LV[l].name:' · 全部')}
  if(!qs.length){alert('错题本是空的，太棒了！');return}
  qs=shuffle(qs);if(k!=='wrong'&&count)qs=qs.slice(0,count);
  S={k,l,title,qs:qs.map(q=>({q,ord:shuffle([0,1,2,3])})),i:0,right:0};show();
}
function show(){
  const {q,ord}=S.qs[S.i];
  app.innerHTML=`<div class="top"><button class="link" onclick="if(confirm('退出本次练习？'))home()">‹ 退出</button><span>${S.title} · ${S.i+1}/${S.qs.length}</span><span>✔ ${S.right}</span></div>
  ${bar(S.i/S.qs.length*100)}<div class="card" style="margin-top:14px"><span class="tag">${SUBJ[q.c].name} · ${LV[q.l].name}</span><p class="q">${esc(q.q)}</p>
  ${ord.map((o,n)=>`<button class="opt" data-o="${o}" onclick="pick(${o})">${'ABCD'[n]}. ${esc(q.o[o])}</button>`).join('')}<div id="fb"></div></div>`;
  window.scrollTo(0,0);
}
function pick(o){
  const {q}=S.qs[S.i],ok=o===q.a;
  document.querySelectorAll('.opt').forEach(b=>{b.disabled=true;const v=+b.dataset.o;if(v===q.a)b.classList.add('ok');else if(v===o)b.classList.add('bad')});
  const s=st(q.c+'-'+q.l);s.total++;s.done[q.id]=1;
  if(ok){S.right++;s.right++;if(S.k==='wrong')wrong=wrong.filter(x=>x!==q.id)}else if(!wrong.includes(q.id))wrong.push(q.id);
  save('jsq_wrong_v2',wrong);save('jsq_stats_v2',stats);
  const last=S.i===S.qs.length-1;
  $('#fb').innerHTML=`<div class="fb ${ok?'ok':'bad'}"><b>${ok?'✅ 回答正确':'❌ 回答错误'}</b><br>${esc(q.e)}</div><button class="btn" id="next" onclick="next()">${last?'查看成绩':'下一题'}</button>`;
  $('#fb').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function next(){S.i++;S.i<S.qs.length?show():result()}
function result(){
  const n=S.qs.length,p=Math.round(S.right/n*100),again=S.k==='wrong'?"start('wrong')":S.k==='mix'?"start('mix')":`start('${S.k}',${S.l||0})`;
  app.innerHTML=`<h1>练习完成</h1><p class="sub">${S.title}</p><div class="card"><div class="big">${p}%</div>
  <p class="center">答对 ${S.right} / ${n} 题 ${p>=90?'🎉 优秀！':p>=60?'👍 继续加油':'💪 多练几遍'}</p>
  <button class="btn" onclick="${again}">再练一次</button>${wrong.length?`<button class="btn ghost" onclick="start('wrong')">重做错题（${wrong.length}）</button>`:''}
  <button class="btn ghost" onclick="home()">返回首页</button></div>`;
}
function clearWrong(){if(confirm('确定清空错题本？')){wrong=[];save('jsq_wrong_v2',wrong);wrongBook()}}
function resetAll(){if(confirm('确定重置所有记录？')){['jsq_wrong_v2','jsq_stats_v2'].forEach(k=>localStorage.removeItem(k));location.reload()}}
// 直达：#start=java-2 / #start=sql / #start=mix / #start=wrong
function route(){const m=location.hash.match(/start=(java|sql|mix|wrong)(?:-(\d))?/);
if(m){m[1]==='mix'||m[1]==='wrong'?start(m[1]):start(m[1],+m[2]||0);if(!S)home()}else if(!S)home()}
window.addEventListener('hashchange',route);route();
