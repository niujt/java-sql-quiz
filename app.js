const $=s=>document.querySelector(s),app=$('#app');
const SUBJ={java:{name:'Java'},boot:{name:'Spring Boot'},sql:{name:'SQL'},ai:{name:'AI'}};
const GROUP={java:['java','boot'],sql:['sql'],ai:['ai']}; // 首页卡片 → 包含的科目
const LV={1:{name:'初级'},2:{name:'中级'},3:{name:'高级'}};
const BY_ID=Object.fromEntries(QUESTIONS.map(q=>[q.id,q]));
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
['jsq_wrong','jsq_stats'].forEach(k=>localStorage.removeItem(k)); // 旧版数据（按下标存储）已不兼容
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
function render(html,dir='fwd',topbar=''){
  $('#topbar').innerHTML=topbar;$('#topbar').classList.toggle('show',!!topbar);
  const el=document.createElement('section');el.className='screen enter-'+dir;el.innerHTML=html;
  el.querySelectorAll('.cat,.opt,.wl,.btn,.links,.seg,.rise').forEach((x,i)=>{x.classList.add('st');x.style.setProperty('--i',i)});
  const old=cur;cur=el;app.prepend(el);
  if(old){old.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));old.inert=true;old.className='screen leave-'+dir;setTimeout(()=>old.remove(),RM?0:450)}
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.querySelectorAll('.bar i[data-w]').forEach(i=>i.style.width=i.dataset.w+'%')));
  window.scrollTo({top:0});return el;
}
const row=(cls,title,meta,act,p)=>`<button class="cat ${cls}" onclick="${act}"><span class="t">${title}</span><span class="m">${meta}</span>${p!=null?bar(p):''}</button>`;
const backBar=(f='home()')=>`<button class="link" onclick="${f}">‹ 返回</button>`;
function home(dir='back'){
  S=null;if(location.hash)history.replaceState(null,'',location.pathname);
  const sp=g=>{let d=0,n=0;GROUP[g].forEach(c=>[1,2,3].forEach(l=>{const p=prog(c,l);d+=p.d;n+=p.n}));return {d,n,pct:d/n*100}};
  render(`<h1 class="hero">刷题。</h1><p class="lead rise">Java · SQL · AI，${QUESTIONS.length} 题。</p>
  <div class="list">${Object.keys(GROUP).map(c=>{const p=sp(c);return row(c,SUBJ[c].name,`${p.d} / ${p.n}`,`levels('${c}')`,p.pct)}).join('')}</div>
  <nav class="links"><button class="link cat mix" onclick="start('mix')">混合</button><button class="link cat wrong" onclick="wrongBook()">错题本${wrong.length?` ${wrong.length}`:''}</button></nav>
  <div class="seg">${[10,20,50,0].map(n=>`<button class="${n===count?'on':''}" onclick="setCount(${n})">${n||'全部'}</button>`).join('')}</div>`,dir);
}
function setCount(n){count=n;save('jsq_count',n);cur.querySelectorAll('.seg button').forEach(b=>b.classList.toggle('on',b.textContent===(n?String(n):'全部')));cur.querySelector('.mix')}
function levels(g,dir='fwd'){
  S=null;const cs=GROUP[g];
  const block=c=>`<div class="list" data-subj="${c}">${[1,2,3].map(l=>{const p=prog(c,l);return row(c+' lv'+l,LV[l].name,p.total?`${p.d} / ${p.n} · ${p.acc}%`:`${p.d} / ${p.n}`,`start('${c}',${l})`,p.pct)}).join('')}
  ${row(c+' all','全部','',`start('${c}',0)`)}</div>`;
  render(`<h1 class="hero">${SUBJ[g].name}</h1>${cs.length>1?cs.map(c=>`<h2 class="sect rise">${SUBJ[c].name}</h2>${block(c)}`).join(''):block(g)}`,dir,backBar());
}
function wrongBook(){
  S=null;
  render(`<h1 class="hero">错题本</h1>${wrong.length?`<button class="btn" onclick="start('wrong')">重做 ${wrong.length} 题</button><div class="list">${wrong.map(id=>{const q=BY_ID[id];return `<div class="wl">${esc(q.q)}<div class="ans">${esc(q.o[q.a])}</div></div>`}).join('')}</div><button class="link danger" onclick="clearWrong()">清空</button>`:'<p class="lead rise">暂无错题。</p>'}
  <button class="link danger rise" onclick="resetAll()">重置全部记录</button>`,'fwd',backBar());
}
function start(k,l){
  let qs,title;
  if(k==='wrong'){qs=wrong.map(id=>BY_ID[id]);title='错题重做'}
  else if(k==='mix'){qs=QUESTIONS;title='混合'}
  else{qs=pool(k,l||0);title=SUBJ[k].name+(l?' · '+LV[l].name:'')}
  if(!qs.length){alert('暂无错题');return}
  qs=shuffle(qs);if(k!=='wrong'&&count)qs=qs.slice(0,count);
  S={k,l,title,qs:qs.map(q=>({q,ord:shuffle([0,1,2,3])})),i:0,right:0};show('fwd');
}
function show(dir='next'){
  const {q,ord}=S.qs[S.i],n=S.qs.length;
  render(`<div class="qwrap"><p class="kicker rise">${SUBJ[q.c].name} · ${LV[q.l].name}</p><p class="q">${esc(q.q)}</p>
  <div class="opts">${ord.map(o=>`<button class="opt" data-o="${o}" onclick="pick(${o})">${esc(q.o[o])}</button>`).join('')}</div><div id="fb"></div></div>`,dir,
  `<button class="link" onclick="if(confirm('退出本次练习？'))home()">✕</button><span class="count">${S.i+1} / ${n}</span><span class="score">${S.right}</span>${bar((S.i+1)/n*100,S.i/n*100)}`);
  requestAnimationFrame(()=>requestAnimationFrame(()=>$('#topbar .bar i').style.width=((S.i+1)/n*100)+'%'));
}
function pick(o){
  const {q}=S.qs[S.i],ok=o===q.a;
  cur.querySelectorAll('.opt').forEach(b=>{b.disabled=true;const v=+b.dataset.o;if(v===q.a)b.classList.add('ok');else if(v===o)b.classList.add('bad');else b.classList.add('dim')});
  const s=st(q.c+'-'+q.l);s.total++;s.done[q.id]=1;
  if(ok){S.right++;s.right++;if(S.k==='wrong')wrong=wrong.filter(x=>x!==q.id)}else if(!wrong.includes(q.id))wrong.push(q.id);
  save('jsq_wrong_v2',wrong);save('jsq_stats_v2',stats);
  const sc=$('#topbar .score');if(sc){sc.textContent=S.right;if(ok){sc.classList.remove('pop');void sc.offsetWidth;sc.classList.add('pop')}}
  const last=S.i===S.qs.length-1;
  $('#fb').innerHTML=`<p class="fb ${ok?'ok':'bad'}"><b>${ok?'正确':'错误'}</b>${esc(q.e)}</p><button class="btn" id="next" onclick="next()">${last?'完成':'下一题'}</button>`;
  setTimeout(()=>$('#next')&&$('#next').scrollIntoView({behavior:RM?'auto':'smooth',block:'nearest'}),120);
}
function next(){S.i++;S.i<S.qs.length?show('next'):result()}
function result(){
  const n=S.qs.length,p=Math.round(S.right/n*100),again=S.k==='wrong'?"start('wrong')":S.k==='mix'?"start('mix')":`start('${S.k}',${S.l||0})`;
  const C=2*Math.PI*88;
  render(`<div class="reveal"><p class="kicker rise">${S.title}</p><div class="ring"><svg viewBox="0 0 200 200"><circle class="track" cx="100" cy="100" r="88"/><circle class="arc" cx="100" cy="100" r="88" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${C*(1-p/100)}"/></svg><div class="num"><span id="pct">0</span><small>%</small></div></div>
  <p class="lead rise">${S.right} / ${n} · ${p>=90?'出色。':p>=60?'不错。':'再来一次。'}</p></div>
  <button class="btn" onclick="${again}">再练一次</button>${wrong.length?`<button class="btn ghost" onclick="start('wrong')">错题本 ${wrong.length}</button>`:''}
  <button class="btn ghost" onclick="home()">首页</button>`,'zoom');
  const arc=cur.querySelector('.arc'),el=$('#pct'),dur=RM?0:1400,t0=performance.now()+250;
  setTimeout(()=>arc.style.strokeDashoffset=arc.dataset.off,RM?0:250);
  const tick=t=>{const k=Math.min(1,Math.max(0,(t-t0)/dur||1)),e=1-Math.pow(1-k,4);el.textContent=Math.round(p*e);if(k<1)requestAnimationFrame(tick)};requestAnimationFrame(tick);
}
function clearWrong(){if(confirm('确定清空错题本？')){wrong=[];save('jsq_wrong_v2',wrong);wrongBook()}}
function resetAll(){if(confirm('确定重置所有记录？')){['jsq_wrong_v2','jsq_stats_v2'].forEach(k=>localStorage.removeItem(k));location.reload()}}
// 直达：#start=java-2 / #start=boot-1 / #start=ai-3 / #start=sql / #start=mix / #start=wrong
function route(){const m=location.hash.match(/start=(java|boot|sql|ai|mix|wrong)(?:-(\d))?/);
if(m){m[1]==='mix'||m[1]==='wrong'?start(m[1]):start(m[1],+m[2]||0);if(!S)home('fwd')}else if(!S)home('fwd')}
window.addEventListener('hashchange',route);route();
