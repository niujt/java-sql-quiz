const $=s=>document.querySelector(s),app=$('#app');
const SUBJ={java:{name:'Java'},boot:{name:'Spring Boot'},sql:{name:'SQL'},ai:{name:'AI'}};
const GROUP={java:['java','boot'],sql:['sql'],ai:['ai']}; // 首页卡片 → 包含的科目
const LV={1:{name:'初级'},2:{name:'中级'},3:{name:'高级'}};
const BY_ID=Object.fromEntries(QUESTIONS.map(q=>[q.id,q]));
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
// Keep legacy storage untouched until the user explicitly clears all learning records.
const LEARNING_KEYS=['jsq_wrong','jsq_stats','jsq_wrong_v2','jsq_stats_v2','jsq_count','jsq_history_v1'];
const savedHistory=load('jsq_history_v1',[]);
let sessions=Array.isArray(savedHistory)?savedHistory.filter(h=>h&&typeof h.id==='string'&&Number.isFinite(h.startedAt)&&Number.isFinite(new Date(h.startedAt).getTime())&&Number.isFinite(h.updatedAt)&&Number.isInteger(h.answered)&&h.answered>0&&Number.isInteger(h.total)&&h.total>=h.answered&&Number.isInteger(h.right)&&h.right>=0&&h.right<=h.answered):[];
let wrong=load('jsq_wrong_v2',[]).filter(id=>BY_ID[id]);
let stats=load('jsq_stats_v2',{});
const st=k=>stats[k]||(stats[k]={done:{},right:0,total:0});
let S=null,count=load('jsq_count',20),cur=null;
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pool=(c,l)=>QUESTIONS.filter(q=>(!c||q.c===c)&&(!l||q.l===l));
const prog=(c,l)=>{const s=st(c+'-'+l),n=pool(c,l).length,d=Object.keys(s.done).length;return {d,n,pct:d/n*100,acc:s.total?Math.round(s.right/s.total*100):0,total:s.total}};
const bar=(p,from=0)=>`<div class="bar"><i data-w="${p}" style="width:${from}%"></i></div>`;

// 场景切换：新画面插入在前，旧画面绝对定位后淡出（不阻塞点击）
const BRAND=`<span class="brand">刷题</span>`;
function render(html,dir='fwd',nav={}){
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  const tb=$('#topbar');tb.className=nav.cls||'';
  tb.innerHTML=`<div class="nav-l">${nav.l||''}</div><div class="nav-c">${nav.c||BRAND}</div><div class="nav-r">${nav.r||''}</div>${nav.bar||''}`;
  const el=document.createElement('section');el.className='screen enter-'+dir;el.innerHTML=html;
  el.querySelectorAll('.tile,.cat,.opt,.wl,.btn,.links,.seg,.rise,.group').forEach((x,i)=>{x.classList.add('st');x.style.setProperty('--i',i)});
  const old=cur;cur=el;app.prepend(el);
  if(old){old.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));old.inert=true;old.className='screen leave-'+dir;setTimeout(()=>old.remove(),RM?0:500)}
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.querySelectorAll('.bar i[data-w]').forEach(i=>i.style.width=i.dataset.w+'%')));
  window.scrollTo({top:0});return el;
}
const row=(cls,title,meta,act,p)=>`<button class="cat ${cls}" onclick="${act}"><span class="t">${title}</span><span class="m">${meta}</span><span class="chev">›</span>${p!=null?bar(p):''}</button>`;
const backL=(f='home()')=>`<button class="link" onclick="${f}">‹ 刷题</button>`;
const TILE={java:{eb:'Java · Spring Boot',tag:'从语法到 JVM，从 IoC 到自动配置。'},sql:{eb:'MySQL InnoDB',tag:'查询、索引、事务与执行计划。'},ai:{eb:'机器学习 · 大模型',tag:'从梯度下降到 RAG 与 Agent。'}};
function home(dir='back'){
  recordSession('ended');S=null;if(location.hash)history.replaceState(null,'',location.pathname);
  const sp=g=>{let d=0,n=0;GROUP[g].forEach(c=>[1,2,3].forEach(l=>{const p=prog(c,l);d+=p.d;n+=p.n}));return {d,n,pct:d/n*100}};
  render(`<header class="heroBox"><p class="eyebrow rise">${QUESTIONS.length} 道精选题 · 三级进阶</p><h1 class="hero">每天练一点。</h1><p class="lead rise">从理解，到熟练。</p></header>
  <nav class="links" aria-label="快捷练习"><button class="quick mix" onclick="start('mix')"><span class="quick-icon" aria-hidden="true">↗</span><span>混合练习<small>随机出题，查漏补缺</small></span><span class="chev" aria-hidden="true">›</span></button><button class="quick wrong" onclick="wrongBook()"><span class="quick-icon" aria-hidden="true">↺</span><span>错题本<small>${wrong.length?`${wrong.length} 题待复习`:'回顾每一次进步'}</small></span><span class="chev" aria-hidden="true">›</span></button></nav>
  <div class="practice-settings"><span id="count-label">每次题量</span><div class="seg" role="group" aria-labelledby="count-label">${[10,20,50,0].map(n=>`<button class="${n===count?'on':''}" aria-pressed="${n===count}" onclick="setCount(${n})">${n||'全部'}</button>`).join('')}</div></div>
  <button class="history-entry" onclick="historyBook()"><span>历史记录</span><span class="history-entry-meta">${sessions.length?`${sessions.length} 次练习`:"查看学习记录"}<span aria-hidden="true"> ›</span></span></button>
  <h2 class="sect section-label">按方向练习</h2><div class="tiles">${Object.keys(GROUP).map(g=>{const p=sp(g);return `<button class="tile ${g}" onclick="levels('${g}')"><span class="tile-copy"><span class="t">${SUBJ[g].name}</span><span class="tag">${TILE[g].tag}</span><span class="m">已练 ${p.d} / ${p.n} 题</span>${bar(p.pct)}</span><span class="tile-arrow" aria-hidden="true">↗</span></button>`}).join('')}</div>`,dir,{cls:'home'});
}
function setCount(n){count=n;save('jsq_count',n);cur.querySelectorAll('.seg button').forEach(b=>{const selected=b.textContent===(n?String(n):'全部');b.classList.toggle('on',selected);b.setAttribute('aria-pressed',selected)})}
function levels(g,dir='fwd'){
  S=null;const cs=GROUP[g];
  const block=c=>`<div class="group list" data-subj="${c}">${[1,2,3].map(l=>{const p=prog(c,l);return row(c+' lv'+l,LV[l].name,p.total?`${p.d} / ${p.n} · ${p.acc}%`:`${p.d} / ${p.n}`,`start('${c}',${l})`,p.pct)}).join('')}
  ${row(c+' all','全部级别','',`start('${c}',0)`)}</div>`;
  render(`<h1 class="hero">${SUBJ[g].name}</h1><p class="lead rise">选择级别，开始练习。</p>${cs.map(c=>`${cs.length>1?`<h2 class="sect rise">${c==='java'?'Java 基础':SUBJ[c].name}</h2>`:''}${block(c)}`).join('')}`,dir,{l:backL(),c:BRAND});
}
function wrongBook(){
  S=null;
  render(`<p class="eyebrow rise">复习</p><h1 class="hero">错题本</h1>${wrong.length?`<button class="btn" onclick="start('wrong')">重做 ${wrong.length} 题</button><div class="group list">${wrong.map(id=>{const q=BY_ID[id];return `<div class="wl"><span class="wtag">${SUBJ[q.c].name} · ${LV[q.l].name}</span>${esc(q.q)}<div class="ans">${esc(q.o[q.a])}</div></div>`}).join('')}</div><button class="link danger" onclick="clearWrong()">清空错题本</button>`:'<p class="lead rise">暂无错题。</p>'}
  <button class="link danger rise" onclick="resetAll()">清空全部学习记录</button>`,'fwd',{l:backL(),c:'<span class="brand">错题本</span>'});
}
function start(k,l){
  let qs,title;
  if(k==='wrong'){qs=wrong.map(id=>BY_ID[id]);title='错题重做'}
  else if(k==='mix'){qs=QUESTIONS;title='混合练习'}
  else{qs=pool(k,l||0);title=SUBJ[k].name+(l?' · '+LV[l].name:'')}
  if(!qs.length){alert('暂无错题');return}
  qs=shuffle(qs);if(k!=='wrong'&&count)qs=qs.slice(0,count);
  S={id:typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2),startedAt:Date.now(),attempted:0,k,l,title,qs:qs.map(q=>({q,ord:shuffle([0,1,2,3])})),i:0,right:0};show('fwd');
}
function show(dir='next'){
  S.answered=false;
  const {q,ord}=S.qs[S.i],n=S.qs.length;
  render(`<div class="qwrap"><p class="eyebrow rise">${SUBJ[q.c].name} · ${LV[q.l].name}</p><p class="q">${esc(q.q)}</p>
  <div class="opts">${ord.map((o,k)=>`<button class="opt" data-o="${o}" onclick="pick(${o})"><span class="key">${'ABCD'[k]}</span><span class="otext">${esc(q.o[o])}</span></button>`).join('')}</div><div id="fb" aria-live="polite" aria-atomic="true"></div></div>`,dir,
  {cls:'quiz',l:`<button class="link" aria-label="退出练习" onclick="requestExit()">✕</button>`,c:`<span class="count">${S.i+1} / ${n}</span>`,r:`<span class="score">${S.right}</span>`,bar:bar((S.i+1)/n*100,S.i/n*100)});
  const screen=cur,progress=(S.i+1)/n*100;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{const fill=$('#topbar .bar i');if(cur===screen&&fill)fill.style.width=progress+'%'}));
}
function pick(o){
  if(!S||S.answered||S.finished)return;
  S.answered=true;
  const {q}=S.qs[S.i],ok=o===q.a;
  cur.querySelectorAll('.opt').forEach(b=>{b.disabled=true;const v=+b.dataset.o;if(v===q.a)b.classList.add('ok');else if(v===o)b.classList.add('bad');else b.classList.add('dim')});
  const s=st(q.c+'-'+q.l);s.total++;s.done[q.id]=1;
  if(ok){S.right++;s.right++;if(S.k==='wrong')wrong=wrong.filter(x=>x!==q.id)}else if(!wrong.includes(q.id))wrong.push(q.id);
  save('jsq_wrong_v2',wrong);save('jsq_stats_v2',stats);
  S.attempted++;recordSession();
  const sc=$('#topbar .score');if(sc){sc.textContent=S.right;if(ok){sc.classList.remove('pop');void sc.offsetWidth;sc.classList.add('pop')}}
  if(navigator.vibrate)try{navigator.vibrate(ok?10:[12,40,12])}catch(e){}
  const last=S.i===S.qs.length-1;
  $('#fb').innerHTML=`<div class="fb ${ok?'ok':'bad'}"><b>${ok?'回答正确':'回答错误'}</b>${esc(q.e)}</div><button class="btn" id="next" onclick="next()">${last?'查看成绩':'下一题'}</button>`;
  setTimeout(()=>$('#next')&&$('#next').scrollIntoView({behavior:RM?'auto':'smooth',block:'nearest'}),150);
}
function next(){if(!S||!S.answered||S.finished)return;S.answered=false;S.i++;S.i<S.qs.length?show('next'):result()}
function result(){
  S.finished=true;
  const n=S.qs.length,p=Math.round(S.right/n*100),again=S.k==='wrong'?"start('wrong')":S.k==='mix'?"start('mix')":`start('${S.k}',${S.l||0})`;
  render(`<div class="reveal"><p class="eyebrow rise">${S.title}</p><div class="num grad2"><span id="pct">0</span><small>%</small></div>
  ${bar(p)}<p class="lead rise">答对 ${S.right} / ${n} 题。${p>=90?'出色。':p>=60?'不错，继续。':'再来一次。'}</p></div>
  <button class="btn" onclick="${again}">再练一次</button>${wrong.length?`<button class="btn ghost" onclick="start('wrong')">错题本 ${wrong.length}</button>`:''}
  <button class="btn ghost" onclick="home()">返回首页</button>`,'zoom',{l:'',c:'<span class="brand">成绩</span>'});
  const el=$('#pct'),dur=RM?0:1600,t0=performance.now()+300;
  const tick=t=>{const k=Math.min(1,Math.max(0,(t-t0)/dur||1)),e=1-Math.pow(1-k,4);el.textContent=Math.round(p*e);if(k<1)requestAnimationFrame(tick)};requestAnimationFrame(tick);
}
// One row per practice, saved after every answer so interrupted sessions remain visible.
function recordSession(status='unfinished'){
  if(!S||!S.attempted)return;
  const entry={id:S.id,startedAt:S.startedAt,updatedAt:Date.now(),title:S.title,k:S.k,l:S.l||0,answered:S.attempted,total:S.qs.length,right:S.right,status:S.attempted===S.qs.length?'completed':status};
  const i=sessions.findIndex(h=>h.id===entry.id);
  if(i===-1)sessions.unshift(entry);else sessions[i]=entry;
  save('jsq_history_v1',sessions);
}
function historyBook(limit=20){
  recordSession('ended');S=null;
  const all=Object.values(stats),answered=all.reduce((n,s)=>n+(s.total||0),0),right=all.reduce((n,s)=>n+(s.right||0),0);
  const date=t=>new Date(t).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
  const ordered=sessions.slice().sort((a,b)=>b.startedAt-a.startedAt);
  render(`<h1 class="hero">历史记录</h1><p class="history-note rise">保存在当前浏览器，不跨设备同步。</p>
  <div class="history-summary"><div><strong>${answered}</strong><span>累计答题次数</span></div><div><strong>${answered?Math.round(right/answered*100)+'%':'—'}</strong><span>累计正确率</span></div><div><strong>${wrong.length}</strong><span>错题待复习</span></div></div>
  <p class="history-note">练习明细从现在开始记录。此前的练习没有明细，已有进度仍计入累计统计。</p>
  <h2 class="sect section-label">练习明细</h2>${ordered.length?`<div class="group history-list">${ordered.slice(0,limit).map(h=>`<article class="history-item"><div class="history-heading"><h3>${esc(h.title||'练习')}</h3><span class="history-status ${h.status==='completed'?'complete':''}">${h.status==='completed'?'已完成':h.status==='ended'?'已退出':'未完成'}</span></div><time datetime="${new Date(h.startedAt).toISOString()}">${date(h.startedAt)}</time><div class="history-detail"><span>已答 ${h.answered} / ${h.total} 题 · 答对 ${h.right} 题</span><strong>${Math.round(h.right/h.answered*100)}%</strong></div></article>`).join('')}</div>${ordered.length>limit?`<button class="btn ghost" onclick="historyBook(${limit+20})">查看更多记录</button>`:''}`:'<div class="history-empty"><p>还没有练习明细</p><span>开始答题后，这里会记录时间、进度与成绩。</span><button class="btn" onclick="start(&quot;mix&quot;)">开始练习</button></div>'}
  <button class="link danger" onclick="resetAll()">清空全部学习记录</button>`,'fwd',{l:backL(),c:BRAND});
}
// Native <dialog> provides focus trapping, Escape dismissal and inert background.
function confirmAction({title,description,action,label='确认'}){
  if(document.querySelector('dialog[open]'))return;
  const trigger=document.activeElement,dialog=document.createElement('dialog');
  dialog.className='confirm-dialog';dialog.setAttribute('aria-labelledby','confirm-title');dialog.setAttribute('aria-describedby','confirm-description');
  dialog.innerHTML=`<h2 id="confirm-title">${title}</h2><p id="confirm-description">${description}</p><div class="dialog-actions"><button class="btn ghost" data-cancel autofocus>取消</button><button class="btn" data-confirm>${label}</button></div>`;
  document.body.append(dialog);
  const cleanup=()=>{dialog.remove();if(trigger?.isConnected)trigger.focus()};
  dialog.addEventListener('close',cleanup,{once:true});
  dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
  dialog.querySelector('[data-confirm]').onclick=()=>{dialog.close();action()};
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()});
  dialog.showModal();
}
function requestExit(){confirmAction({title:'退出本次练习？',description:'已答题目和错题记录会保留。本次练习进度将结束。',label:'退出练习',action:()=>home()})}
function clearWrong(){confirmAction({title:'清空错题本？',description:'已保存的错题将被移除，练习记录不受影响。',label:'清空错题',action:()=>{wrong=[];save('jsq_wrong_v2',wrong);wrongBook()}})}
function resetAll(){confirmAction({title:'清空全部学习记录？',description:'将清空当前浏览器中的历史记录、答题进度、练习统计和错题本，并将每次题量恢复为 20 题。保留全部题目。清空后无法恢复。',label:'全部清空',action:()=>{LEARNING_KEYS.forEach(k=>localStorage.removeItem(k));S=null;wrong=[];stats={};sessions=[];count=20;home()}})}
// 直达：#start=java-2 / #start=boot-1 / #start=ai-3 / #start=sql / #start=mix / #start=wrong
function route(){const m=location.hash.match(/start=(java|boot|sql|ai|mix|wrong)(?:-(\d))?/);
if(m){m[1]==='mix'||m[1]==='wrong'?start(m[1]):start(m[1],+m[2]||0);if(!S)home('fwd')}else if(!S)home('fwd')}
window.addEventListener('hashchange',route);route();
