/* HELL OF ANT 행사 캘린더 · app.js */
(() => {
"use strict";

/* ---------- constants & helpers ---------- */
const GENRES=["MEET UP","TECHNO","HOUSE","TECH HOUSE","TRANCE","HARD DANCE","DNB","DUBSTEP","BASS","EDM","POP","ROCK","LIVE","ETC"];
const WD=["SUN","MON","TUE","WED","THU","FRI","SAT"];
const PAGE=24;
const HL_GENRES=new Set(["MEET UP"]);   // 보라색 테두리로 강조할 장르
const hl=g=>HL_GENRES.has(g)?" hl":"";
const gtags=list=>`<div class="gtags">${list.map(x=>`<span class="${hl(x).trim()}">${esc(x)}</span>`).join("")}</div>`;
const DATE_OPTS=[{id:"upcoming",label:"예정 전체"},{id:"today",label:"오늘"},{id:"week",label:"7일 이내"},{id:"month30",label:"30일 이내"},{id:"past",label:"지난 일정"}];
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,"0");
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return ymd(d)};
const today=()=>ymd(new Date());
const ym=s=>s.slice(0,7);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const md=s=>{const d=parse(s);return `${pad(d.getMonth()+1)}.${pad(d.getDate())}`};
const wd=s=>WD[parse(s).getDay()];
const endOf=e=>e.end&&e.end>=e.start?e.end:e.start;
const hue=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))%360;return h};
const dday=s=>{const n=Math.round((parse(s)-parse(today()))/864e5);return n<=0?"TODAY":"D-"+n};
const reduced=()=>matchMedia("(prefers-reduced-motion:reduce)").matches;
const uuid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));

/* ---------- state ---------- */
const VIEW_KEY="hoa_view";
const readView=()=>{try{return localStorage.getItem(VIEW_KEY)==="cal"?"cal":"list"}catch(_){return "list"}};
const S={events:new Map(),pending:[],q:"",date:"upcoming",pick:"",genres:new Set(),shown:PAGE,open:null,confirm:false,view:readView(),calMonth:"",sel:"",member:null,isKakao:false,counts:new Map(),att:new Map(),myAtt:new Set(),meTab:"up",peopleQ:"",adminMembers:null,memberQ:"",blocking:null,reviewTab:"events",leaving:false,
  editing:null,editingPending:false,rejecting:null,loaded:false,user:null,isAdmin:false,adminName:"",flyer:{path:null,file:null,url:null}};

const CFG=window.HOA_CONFIG||{};
const sb=(CFG.supabaseUrl&&CFG.supabaseAnonKey&&window.supabase)?window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey):null;
const flyerUrl=path=>path&&sb?sb.storage.from("flyers").getPublicUrl(path).data.publicUrl:"";
const fromRow=r=>({id:r.id,status:r.status,title:r.title,start:r.start_date,end:r.end_date||"",time:r.start_time||"",venue:r.venue||"",
  genres:r.genres||[],url:r.url||"",kakao:r.kakao_url||"",memo:r.memo||"",flyerPath:r.flyer_path||"",flyer:flyerUrl(r.flyer_path),credit:r.credit||"",
  postedBy:r.posted_by_name||"",contact:(r.event_contacts&&(Array.isArray(r.event_contacts)?r.event_contacts[0]:r.event_contacts))||null});

/* ---------- filtering ---------- */
function monthOptions(){const set=new Set(),d=new Date();d.setDate(1);d.setMonth(d.getMonth()-6);
  for(let i=0;i<19;i++){set.add(ym(ymd(d)));d.setMonth(d.getMonth()+1)}
  for(const [,e] of S.events){set.add(ym(e.start));if(e.end)set.add(ym(e.end))}
  return [...set].sort()}
function inDate(e){
  const s=e.start,end=endOf(e),t=today();
  if(S.pick)return s<=S.pick+"-31"&&end>=S.pick+"-01";
  switch(S.date){
    case "today":return s<=t&&t<=end;
    case "week":return s<=addDays(t,6)&&end>=t;
    case "month30":return s<=addDays(t,29)&&end>=t;
    case "past":return end<t;
    default:return end>=t;
  }
}
function genreHit(e){return !S.genres.size||(e.genres||[]).some(g=>S.genres.has(g))}
function textHit(e){if(!S.q)return true;const q=S.q.toLowerCase();return [e.title,e.venue,e.memo,e.credit,(e.genres||[]).join(" ")].some(v=>String(v||"").toLowerCase().includes(q))}
function list(ignore){
  const out=[];
  for(const [,e] of S.events){
    if(!inDate(e)||!textHit(e))continue;
    if(ignore!=="genre"&&!genreHit(e))continue;
    out.push(e);
  }
  const past=S.date==="past"&&!S.pick;
  return out.sort((a,b)=>(past?b.start.localeCompare(a.start):a.start.localeCompare(b.start))||(a.time||"99").localeCompare(b.time||"99"));
}

/* ---------- render ---------- */
const GENRE_KEY="hoa_genre_open";
function readGenreOpen(){try{const v=localStorage.getItem(GENRE_KEY);if(v!==null)return v==="1"}catch(_){}return !matchMedia("(max-width:760px)").matches}
S.genreOpen=readGenreOpen();
function renderGenreToggle(){
  const g=$("genreGroup");if(!g)return;
  g.classList.toggle("collapsed",!S.genreOpen);
  $("genreToggle").setAttribute("aria-expanded",String(S.genreOpen));
  $("genreSel").textContent=S.genreOpen?"":(S.genres.size?`· ${[...S.genres][0]}${S.genres.size>1?` 외 ${S.genres.size-1}`:""}`:"· ALL");
  $("genreHint").textContent=S.genreOpen?"접기":"펼치기";
}
function renderFilters(){
  $("dateTags").innerHTML=DATE_OPTS.map(o=>`<button class="tag kr" data-date="${o.id}" aria-pressed="${!S.pick&&S.date===o.id}">${o.label}</button>`).join("")+
    `<label class="tag kr" aria-pressed="${!!S.pick}"><select id="pick" aria-label="연도와 월 선택"><option value="">날짜 선택</option>${monthOptions().map(m=>`<option value="${m}" ${m===S.pick?"selected":""}>${m.replace("-",".")}</option>`).join("")}</select></label>`;
  const gc={};list("genre").forEach(e=>(e.genres||[]).forEach(g=>gc[g]=(gc[g]||0)+1));
  $("genreTags").innerHTML=`<button class="tag" data-genre="" aria-pressed="${!S.genres.size}">ALL</button>`+
    GENRES.filter(g=>gc[g]||S.genres.has(g)).map(g=>`<button class="tag${hl(g)}" data-genre="${esc(g)}" aria-pressed="${S.genres.has(g)}">${esc(g)} <span class="n">${gc[g]||0}</span></button>`).join("");
  renderGenreToggle();
}
function genInner(e){return `<span>${md(e.start)} ${wd(e.start)}</span><b>${esc(e.title)}</b>`}
/* default poster: config.js 의 defaultPoster 이미지가 있으면 플라이어 없는 일정에 사용 */
const DEFAULT_POSTER=typeof CFG.defaultPoster==="string"&&/^[\w./-]+$/.test(CFG.defaultPoster)?CFG.defaultPoster:"";
const DEFAULT_TEXT=CFG.defaultPosterText!==false;
const KAKAO_RE=/^https:\/\/(open|pf|qr)\.kakao\.com\//i;
function flyerHTML(e){
  if(e.flyer)return `<img src="${esc(e.flyer)}" alt="${esc(e.title)} 플라이어" loading="lazy" data-h="${hue(e.title)}" data-gen="${esc(genInner(e))}">`;
  if(DEFAULT_POSTER)return `<div class="gen custom${DEFAULT_TEXT?"":" bare"}" style="--h:${hue(e.title)};--poster-img:url('${DEFAULT_POSTER}')" role="img" aria-label="${esc(e.title)}">${DEFAULT_TEXT?genInner(e):""}</div>`;
  return `<div class="gen" style="--h:${hue(e.title)}">${genInner(e)}</div>`;
}
document.addEventListener("error",ev=>{const img=ev.target;if(!(img instanceof HTMLImageElement)||!img.dataset.gen)return;
  const d=document.createElement("div");d.className="gen";d.style.setProperty("--h",img.dataset.h||"0");d.innerHTML=img.dataset.gen;img.replaceWith(d)},true);

/* NEXT UP 배너: 오늘 행사가 여러 개면 자동으로 넘겨 보여줘요 */
const ROTATE_MS=4000;
let nextTimer=null,nextIdx=0,nextKey="",nextPaused=false;
let lastNextId=null;
function nextInner(e,label){
  const anim=lastNextId!==null&&lastNextId!==e.id;lastNextId=e.id;
  return `<div class="dd">${label}</div>
    <div class="rot${anim?" anim":""}" style="min-width:0"><div class="k">${label==="TODAY"?(e.end&&e.end>e.start?`${md(e.start)} – ${md(e.end)}`:`${md(e.start)} ${wd(e.start)}`):`NEXT UP · ${md(e.start)} ${wd(e.start)}`}</div><div class="t">${esc(e.title)}</div>${e.venue?`<div class="m">${esc(e.venue)}</div>`:""}</div>
    <span class="go">자세히 보기 →</span>`;
}
function renderNext(){
  const t=today(),todays=[];let best=null;
  for(const [,e] of S.events){
    if(endOf(e)<t)continue;
    if(e.start<=t)todays.push(e);
    else if(!best||e.start<best.start||(e.start===best.start&&(e.time||"99")<(best.time||"99")))best=e;
  }
  clearInterval(nextTimer);nextTimer=null;
  if(!todays.length&&!best){nextKey="";$("nextBox").innerHTML=`<div class="next empty"><div><div class="k">NEXT UP</div><div class="t">${S.loaded||!sb?"아직 예정된 일정이 없어요":"일정을 불러오는 중이에요…"}</div></div></div>`;return}
  if(!todays.length){nextKey="";$("nextBox").innerHTML=`<button class="next" data-open="${esc(best.id)}">${nextInner(best,dday(best.start))}</button>`;return}
  todays.sort((a,b)=>((a.start<t)-(b.start<t))||(a.time||"99").localeCompare(b.time||"99"));
  const key=todays.map(e=>e.id).join(",");if(key!==nextKey){nextKey=key;nextIdx=0}
  nextIdx%=todays.length;
  const n=todays.length,e=todays[nextIdx];
  $("nextBox").innerHTML=`<div class="nextwrap${n>1?" multi":""}"><button class="next" data-open="${esc(e.id)}" aria-label="오늘 일정 ${n}개 중 ${nextIdx+1}번째: ${esc(e.title)}">${nextInner(e,"TODAY")}</button>`+
    (n>1?`<div class="npager" role="group" aria-label="오늘 일정 넘기기"><span class="nnum">${nextIdx+1}/${n}</span>${todays.map((x,i)=>`<button type="button" class="ndot" data-next-i="${i}" aria-label="${i+1}번째 일정 보기" aria-current="${i===nextIdx}"></button>`).join("")}</div>`:"")+`</div>`;
  if(n>1&&!reduced())nextTimer=setInterval(()=>{if(nextPaused||document.hidden)return;showNext(nextIdx+1)},ROTATE_MS);
}
function showNext(i){
  const box=$("nextBox"),btn=box.querySelector(".next");if(!btn)return;
  btn.classList.add("swap");
  setTimeout(()=>{const keep=nextTimer;nextTimer=null;clearInterval(keep);nextIdx=i;renderNext()},reduced()?0:220);
}
$("nextBox").addEventListener("click",e=>{const d=e.target.closest("[data-next-i]");if(d){e.stopPropagation();showNext(Number(d.dataset.nextI))}});
let nHover=false,nFocus=false;const syncPause=()=>{nextPaused=nHover||nFocus};
$("nextBox").addEventListener("pointerenter",e=>{if(e.pointerType==="mouse"){nHover=true;syncPause()}});
$("nextBox").addEventListener("pointerleave",()=>{nHover=false;syncPause()});
$("nextBox").addEventListener("focusin",e=>{nFocus=e.target.matches(":focus-visible");syncPause()});
$("nextBox").addEventListener("focusout",()=>{nFocus=false;syncPause()});
function renderGrid(){
  const items=list(),t=today();
  $("count").textContent=`${items.length}개 일정`;
  $("grid").innerHTML=items.slice(0,S.shown).map(e=>{
    const range=e.end&&e.end>e.start?`<small>– ${md(e.end)} ${wd(e.end)}</small>`:"";
    return `<button class="card${endOf(e)<t?" past":""}" data-open="${esc(e.id)}">
      <div class="flyer">${flyerHTML(e)}</div>
      <div class="cbody">
        <div class="date">${md(e.start)} ${wd(e.start)}${range}</div>
        <div class="ctitle">${esc(e.title)}</div>
        <div class="cmeta">${esc([e.venue,e.time].filter(Boolean).join(" · "))||"&nbsp;"}</div>
        <div class="cfoot">${(e.genres||[]).length?gtags(e.genres):""}${attLine(e)}</div>
      </div></button>`;
  }).join("");
  $("moreBtn").hidden=items.length<=S.shown;
  const blank=$("blank");
  if(items.length){blank.hidden=true;return}
  blank.hidden=false;
  if(sb&&!S.loaded){blank.innerHTML=`<b>LOADING</b>일정을 불러오는 중이에요…`;return}
  const filtered=S.q||S.genres.size||S.pick||S.date!=="upcoming";
  blank.innerHTML=filtered&&S.events.size?`<b>NO EVENTS</b>조건에 맞는 일정이 없어요.<button class="pill kr" id="resetBtn">필터 초기화</button>`
    :`<b>NO EVENTS YET</b>가고 싶은 공연이나 파티를 제보해 주세요. 운영진이 확인한 뒤 게시해요.${sb?`<button class="pill solid" id="emptyAdd">+ ADD EVENT</button>`:""}`;
}
function renderStats(){
  const t=today(),m=t.slice(0,7);let up=0,mo=0,all=0;
  for(const [,e] of S.events){all++;const end=endOf(e);if(end>=t)up++;if(e.start.slice(0,7)<=m&&end.slice(0,7)>=m)mo++}
  const ready=S.loaded||!sb;
  $("stUp").textContent=ready?up:"–";$("stMonth").textContent=ready?mo:"–";$("stAll").textContent=ready?all:"–";
}
function renderAdmin(){
  $("reviewBtn").hidden=!S.isAdmin;
  $("pendN").textContent=S.pending.length;
  $("reviewBtn").classList.toggle("has",S.pending.length>0);
  $("adminLink").textContent=S.user?(S.isAdmin?`운영진 ${S.adminName} · 로그아웃`:"로그아웃"):"운영진 로그인";
}
function renderView(){
  const cal=S.view==="cal";
  $("listView").hidden=cal;$("calView").hidden=!cal;$("dateGroup").hidden=cal;
  document.querySelectorAll("#viewSeg [data-view]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.view===S.view)));
}
function render(){renderView();renderAccount();renderCrew();renderFilters();renderNext();if(S.view==="cal")renderCal();else renderGrid();renderStats();renderAdmin();if(S.open)renderDetail();if(!$("meScrim").hidden)renderMe();if(!$("peopleScrim").hidden)renderPeople()}

/* ---------- calendar ---------- */
const KWD=["일","월","화","수","목","금","토"];
const monthAdd=(m,n)=>{const [y,mo]=m.split("-").map(Number);const d=new Date(y,mo-1+n,1);return `${d.getFullYear()}-${pad(d.getMonth()+1)}`};
function calEvents(){
  const out=[];
  for(const [,e] of S.events){if(!textHit(e))continue;if(!genreHit(e))continue;out.push(e)}
  return out.sort((a,b)=>a.start.localeCompare(b.start)||(a.time||"99").localeCompare(b.time||"99"));
}
function onDay(evs,day){return evs.filter(e=>e.start<=day&&endOf(e)>=day)}
function renderCal(){
  const t=today();if(!S.calMonth)S.calMonth=ym(t);
  const m=S.calMonth,evs=calEvents(),first=parse(m+"-01"),startDow=first.getDay();
  const dim=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
  const cells=Math.ceil((startDow+dim)/7)*7;
  const inMonth=evs.filter(e=>e.start<=m+"-31"&&endOf(e)>=m+"-01");
  if(!S.sel||ym(S.sel)!==m){const firstEv=inMonth.find(e=>e.start>=m+"-01");S.sel=ym(t)===m?t:(firstEv?firstEv.start:m+"-01")}
  $("calTitle").textContent=m.replace("-",".");
  $("calCount").innerHTML=`이번 달 <b>${inMonth.length}</b>개`;
  $("calDow").innerHTML=WD.map((d,i)=>`<span class="${i===0||i===6?"we":""}" aria-hidden="true">${matchMedia("(max-width:900px)").matches?d[0]:d}</span>`).join("");
  let html="";
  for(let i=0;i<cells;i++){
    const dn=i-startDow+1;
    if(dn<1||dn>dim){const d=new Date(first.getFullYear(),first.getMonth(),dn);html+=`<div class="day out" aria-hidden="true"><div class="n"><i>${d.getDate()}</i></div></div>`;continue}
    const day=`${m}-${pad(dn)}`,list=onDay(evs,day),n=list.length;
    const cls=["day",day<t?"past":"",day===t?"today":"",day===S.sel?"sel":""].filter(Boolean).join(" ");
    const label=`${Number(m.slice(5))}월 ${dn}일 ${KWD[parse(day).getDay()]}요일, 일정 ${n}개`;
    html+=`<button type="button" class="${cls}" data-day="${day}" aria-pressed="${day===S.sel}" aria-label="${label}"><div class="n"><i>${dn}</i>${n>2?`<span class="k">${n}</span>`:""}</div>`+
      list.slice(0,2).map(e=>`<span class="ev${(e.genres||[]).some(g=>HL_GENRES.has(g))?" hl":""}${e.start<day?" cont":""}">${esc(e.title)}</span>`).join("")+
      (n>2?`<span class="evmore">+${n-2}개 더보기</span>`:"")+
      `<span class="dots">${list.slice(0,3).map(()=>"<i></i>").join("")}${n>3?'<i class="p">+</i>':""}</span></button>`;
  }
  $("calDays").innerHTML=html;
  renderDayPanel(evs,inMonth);
}
function renderDayPanel(evs,inMonth){
  const day=S.sel,t=today(),list=onDay(evs,day).sort((a,b)=>((a.start<day)-(b.start<day))||(a.time||"99").localeCompare(b.time||"99"));
  const head=`<div class="dph"><b>${md(day)} ${wd(day)}</b><span>${list.length?list.length+"개 일정":""}</span></div>`;
  if(!list.length){
    let body;
    if(sb&&!S.loaded)body="일정을 불러오는 중이에요…";
    else if(!inMonth.length){
      const nextEv=evs.find(e=>ym(e.start)>S.calMonth),prevEv=[...evs].reverse().find(e=>ym(endOf(e))<S.calMonth);
      const filtered=S.q||S.genres.size;
      body=`${filtered?"조건에 맞는 일정이 이 달엔 없어요.":"이 달엔 아직 일정이 없어요."}`+
        (nextEv?`<button type="button" class="pill" data-cal-go="${ym(nextEv.start)}">다음 일정 있는 달로 →</button>`:prevEv?`<button type="button" class="pill" data-cal-go="${ym(prevEv.start)}">← 이전 일정 있는 달로</button>`:"")+
        (filtered?`<button type="button" class="pill kr" id="resetBtn">필터 초기화</button>`:"");
    }else body="이 날은 일정이 없어요.";
    $("dayPanel").innerHTML=head+`<div class="dempty">${body}</div>`;return;
  }
  $("dayPanel").innerHTML=head+list.map(e=>{
    const range=e.end&&e.end>e.start?`${md(e.start)}–${md(e.end)}`:"";
    const meta=[range,e.time,e.venue].filter(Boolean).map(esc).join(" · ");
    return `<button type="button" class="dli${endOf(e)<t?" past":""}" data-open="${esc(e.id)}"><div class="th" aria-hidden="true">${flyerHTML(e)}</div><div style="min-width:0"><div class="t">${esc(e.title)}</div>${meta?`<div class="m">${meta}</div>`:""}${(e.genres||[]).length?gtags(e.genres.slice(0,3)):""}${attLine(e)}</div></button>`;
  }).join("");
}
function setView(v){
  if(v===S.view)return;
  if(v==="cal"){S.calMonth=S.pick||ym(today());S.sel=""}
  else{S.date="upcoming";S.pick="";S.shown=PAGE}
  S.view=v;try{localStorage.setItem(VIEW_KEY,v)}catch(_){}
  render();
}
$("viewSeg").addEventListener("click",e=>{const b=e.target.closest("[data-view]");if(b)setView(b.dataset.view)});
$("calView").addEventListener("click",e=>{
  const c=e.target.closest("[data-cal]");
  if(c){const a=c.dataset.cal;if(a==="today"){S.calMonth=ym(today());S.sel=today()}else{S.calMonth=monthAdd(S.calMonth,a==="prev"?-1:1);S.sel=""}renderCal();return}
  const g=e.target.closest("[data-cal-go]");if(g){S.calMonth=g.dataset.calGo;S.sel="";renderCal();return}
  const d=e.target.closest("[data-day]");
  if(d){S.sel=d.dataset.day;renderCal();
    if(matchMedia("(max-width:900px)").matches){const p=$("dayPanel"),r=p.getBoundingClientRect();if(r.top>innerHeight-120)p.scrollIntoView({behavior:reduced()?"auto":"smooth",block:"start"})}}
});
let calMQ=matchMedia("(max-width:900px)");calMQ.addEventListener?.("change",()=>{if(S.view==="cal")renderCal()});

function renderDetail(){
  const e=S.events.get(S.open)||S.pending.find(p=>p.id===S.open);
  if(!e){closeDetail();return}
  const range=e.end&&e.end>e.start?` – ${md(e.end)} ${wd(e.end)}`:"";
  const credit=e.credit?` · 제보 <a href="https://www.instagram.com/${encodeURIComponent(e.credit)}/" target="_blank" rel="noopener">@${esc(e.credit)}</a>`:"";
  $("detail").innerHTML=`<div class="closebar"><button class="close" id="closeDetail" aria-label="닫기"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2 2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></div>
  <div class="detail"><div class="flyer">${flyerHTML(e)}</div>
  <div class="dinfo">
    <div class="date">${md(e.start)} ${wd(e.start)}${range}</div>
    <h2>${esc(e.title)}</h2>
    ${(e.genres||[]).length?gtags(e.genres):""}
    ${attendHTML(e)}
    <div class="facts">
      <div><b>TIME</b><span>${esc(e.time||"미정")}</span></div>
      <div><b>VENUE</b><span>${esc(e.venue||"미정")}</span></div>
    </div>
    ${e.memo?`<div class="memo">${esc(e.memo)}</div>`:""}
    ${e.url&&/^https?:\/\//i.test(e.url)?`<a class="link" href="${esc(e.url)}" target="_blank" rel="noopener">예매·정보 링크 열기 ↗</a>`:""}
    ${e.kakao&&KAKAO_RE.test(e.kakao)?`<a class="kakao" href="${esc(e.kakao)}" target="_blank" rel="noopener"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4C7 4 3 7.1 3 11c0 2.5 1.7 4.7 4.2 5.9L6.5 20l3.6-2.3c.6.1 1.2.1 1.9.1 5 0 9-3.1 9-7s-4-6.8-9-6.8z" fill="currentColor"/></svg><span><b>카카오톡 오픈채팅방</b><small>이 행사 같이 갈 사람 모이는 방</small></span><i aria-hidden="true">↗</i></a>`:""}
    <div class="who reg">등록: ${esc(e.postedBy||"운영진")}${credit}</div>
    ${S.isAdmin&&S.confirm?`<div class="confirm">“${esc(e.title)}” 일정을 삭제할까요? 되돌릴 수 없어요.<div class="acts"><button class="pill danger kr" id="delYes">삭제</button><button class="pill kr" id="delNo">취소</button></div></div>`:
      `<div class="acts">${e.status!=="pending"?`<button class="pill solid kr share-btn" id="shareBtn"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2M5 5l3-3 3 3M3 8v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg> 공유하기</button>`:""}${S.isAdmin?`<button class="pill kr" id="editBtn">수정</button><button class="pill kr" id="delBtn">삭제</button>`:""}</div>`}
  </div></div>`;
}
/* ---------- deep link & share ---------- */
const eventUrl=id=>`${location.origin}${location.pathname}?e=${encodeURIComponent(id)}`;
// 공유용 주소: /s/<ID> 는 서버에서 이벤트 포스터·제목을 미리보기(메타태그)로 붙여줘요. 로컬 파일로 열었을 땐 일반 주소를 써요.
const shareUrl=id=>location.protocol.startsWith("http")?`${location.origin}/s/${encodeURIComponent(id)}`:eventUrl(id);
function setUrl(id){try{history.replaceState(null,"",id?eventUrl(id):location.pathname)}catch(_){}}
function openDetail(id){S.open=id;S.confirm=false;$("detailScrim").hidden=false;renderDetail();if(S.events.has(id))setUrl(id)}
function closeDetail(){S.open=null;S.confirm=false;$("detailScrim").hidden=true;setUrl(null)}
let deepLinked=false;
function openDeepLink(){
  if(deepLinked)return;deepLinked=true;
  const id=new URLSearchParams(location.search).get("e");if(!id)return;
  if(S.events.has(id))openDetail(id);else{toast("찾을 수 없거나 삭제된 일정이에요");setUrl(null)}
}

const KAKAO_KEY=typeof CFG.kakaoJsKey==="string"&&/^[0-9a-f]{20,40}$/i.test(CFG.kakaoJsKey.trim())?CFG.kakaoJsKey.trim():"";
let kakaoReady=null;
function loadKakao(){
  if(!KAKAO_KEY)return Promise.reject(new Error("no_key"));
  if(kakaoReady)return kakaoReady;
  kakaoReady=new Promise((res,rej)=>{
    if(window.Kakao){try{if(!Kakao.isInitialized())Kakao.init(KAKAO_KEY);res(Kakao)}catch(err){rej(err)}return}
    const sc=document.createElement("script");sc.src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";sc.crossOrigin="anonymous";sc.async=true;
    sc.onload=()=>{try{if(!Kakao.isInitialized())Kakao.init(KAKAO_KEY);res(Kakao)}catch(err){rej(err)}};
    sc.onerror=()=>{kakaoReady=null;rej(new Error("sdk_load"))};
    document.head.appendChild(sc);
  });
  return kakaoReady;
}
function absUrl(u){try{return new URL(u,location.href).href}catch(_){return ""}}
function shareImage(e){return e.flyer?e.flyer:(DEFAULT_POSTER?absUrl(DEFAULT_POSTER):"")}
function shareText(e){return `${md(e.start)} ${wd(e.start)}${e.time?" "+e.time:""}${e.venue?" · "+e.venue:""}`}
let shareEvent=null;
function openShare(e){
  shareEvent=e;
  $("shareTitle").textContent=e.title;$("shareMeta").textContent=shareText(e);
  $("shareUrl").value=shareUrl(e.id);$("copyBtn").textContent="복사";
  $("kakaoShareBtn").hidden=!KAKAO_KEY;
  $("nativeShareBtn").hidden=!navigator.share;
  $("shareHint").hidden=!!KAKAO_KEY;
  openSheet("shareScrim");if(KAKAO_KEY)loadKakao().catch(()=>{});
}
async function copyShareUrl(){
  const v=$("shareUrl").value;
  try{await navigator.clipboard.writeText(v);$("copyBtn").textContent="복사됨 ✓";toast("링크를 복사했어요")}
  catch(_){const i=$("shareUrl");i.focus();i.select();try{document.execCommand("copy");$("copyBtn").textContent="복사됨 ✓";toast("링크를 복사했어요")}catch(__){toast("링크를 길게 눌러 복사해 주세요")}}
}
async function kakaoShare(){
  const e=shareEvent;if(!e)return;
  try{
    const K=await loadKakao();const url=shareUrl(e.id),img=shareImage(e);
    const link={mobileWebUrl:url,webUrl:url};
    if(img)K.Share.sendDefault({objectType:"feed",content:{title:e.title,description:shareText(e),imageUrl:img,link},buttons:[{title:"일정 보기",link}]});
    else K.Share.sendDefault({objectType:"text",text:`${e.title}\n${shareText(e)}`,link,buttonTitle:"일정 보기"});
  }catch(err){toast("카카오톡 공유를 열지 못했어요. 링크를 복사해서 보내주세요")}
}
async function nativeShare(){
  const e=shareEvent;if(!e||!navigator.share)return;
  try{await navigator.share({title:e.title,text:`${e.title} · ${shareText(e)}`,url:shareUrl(e.id)})}catch(_){}
}

function renderReview(){
  const box=$("reviewList");
  const tabs=`<div class="rtabs" role="group" aria-label="운영"><button type="button" data-rtab="events" aria-pressed="${S.reviewTab!=="members"}">행사 제보 ${S.pending.length}</button><button type="button" data-rtab="members" aria-pressed="${S.reviewTab==="members"}">멤버${S.adminMembers?" "+S.adminMembers.filter(m=>m.status==="member").length:""}</button></div>`;
  if(S.reviewTab==="members"){box.innerHTML=tabs+renderMembersAdmin();return}
  if(!S.pending.length){box.innerHTML=tabs+`<div class="blank" style="margin:16px 22px 22px"><b>ALL CLEAR</b>승인 대기 중인 제보가 없어요.</div>`;return}
  box.innerHTML=tabs+S.pending.map(e=>{
    const c=e.contact||{};
    const range=e.end&&e.end>e.start?` – ${md(e.end)} ${wd(e.end)}`:"";
    return `<article class="pend">
      <div class="flyer">${flyerHTML(e)}</div>
      <div class="pinfo">
        <div class="date">${md(e.start)} ${wd(e.start)}${range}${e.time?` · ${esc(e.time)}`:""}</div>
        <div class="ctitle">${esc(e.title)}</div>
        ${e.venue?`<div class="venue">${esc(e.venue)}</div>`:""}
        ${(e.genres||[]).length?gtags(e.genres):""}
        ${e.memo?`<div class="memo">${esc(e.memo)}</div>`:""}
        ${e.url&&/^https?:\/\//i.test(e.url)?`<a class="link" href="${esc(e.url)}" target="_blank" rel="noopener">링크 확인 ↗</a>`:""}
        <div class="who">제보자 ${c.instagram?`<a href="https://www.instagram.com/${encodeURIComponent(c.instagram)}/" target="_blank" rel="noopener">@${esc(c.instagram)}</a>`:"알 수 없음"}${e.credit?" · 표시 동의":" · 표시 비동의"}</div>
        ${c.note?`<div class="note">“${esc(c.note)}”</div>`:""}
        ${S.rejecting===e.id?`<div class="confirm">이 제보를 반려하고 삭제할까요? 되돌릴 수 없어요.<div class="acts"><button class="pill danger kr" data-rej-yes="${esc(e.id)}">반려</button><button class="pill kr" data-rej-no="1">취소</button></div></div>`:
        `<div class="acts"><button class="pill solid kr" data-approve="${esc(e.id)}">승인</button><button class="pill kr" data-edit-pending="${esc(e.id)}">수정 후 승인</button><button class="pill kr" data-reject="${esc(e.id)}">반려</button></div>`}
      </div></article>`;
  }).join("");
}

function setStatus(m){const el=$("status");if(m){el.textContent=m;el.hidden=false}else el.hidden=true}
let tT;function toast(m){const t=$("toast");t.textContent=m;t.hidden=false;clearTimeout(tT);tT=setTimeout(()=>t.hidden=true,2800)}
function openSheet(id){$(id).hidden=false}
function closeSheet(id){$(id).hidden=true}

/* ---------- data ---------- */
async function loadEvents(){
  if(!sb)return;
  const {data,error}=await sb.from("events").select("*").eq("status","approved").order("start_date",{ascending:true}).limit(1000);
  if(error){setStatus("일정을 불러오지 못했어요. 잠시 후 새로고침해 주세요.");S.loaded=true;render();return}
  S.events=new Map(data.map(r=>[r.id,fromRow(r)]));S.loaded=true;setStatus("");render();openDeepLink();
}
async function loadPending(){
  if(!sb||!S.isAdmin){S.pending=[];renderAdmin();return}
  const {data,error}=await sb.from("events").select("*, event_contacts(instagram,note)").eq("status","pending").order("created_at",{ascending:true}).limit(300);
  if(error){toast("승인 대기 목록을 불러오지 못했어요");return}
  S.pending=data.map(fromRow);renderAdmin();if(!$("reviewScrim").hidden)renderReview();
}
async function refreshAuth(session){
  S.user=session?.user||null;S.isAdmin=false;S.adminName="";
  if(S.user){
    const {data}=await sb.rpc("is_admin");S.isAdmin=!!data;
    if(S.isAdmin){const r=await sb.from("admins").select("display_name").eq("user_id",S.user.id).maybeSingle();S.adminName=r.data?.display_name||"운영진"}
  }
  await loadMe();
  if(S.isKakao&&!S.member)openJoin();else runAfterLogin();
  S.adminMembers=null;
  render();await Promise.all([loadPending(),loadAttendance()]);
}

/* image: shrink large photos before upload */
async function prepareImage(file){
  if(file.type==="image/gif"||file.size<700*1024)return {blob:file,ext:(file.type.split("/")[1]||"jpg").replace("jpeg","jpg"),type:file.type};
  try{
    const bmp=await createImageBitmap(file);const max=1600,k=Math.min(1,max/Math.max(bmp.width,bmp.height));
    const c=document.createElement("canvas");c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);
    c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
    const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.86));
    return blob?{blob,ext:"jpg",type:"image/jpeg"}:{blob:file,ext:"jpg",type:file.type};
  }catch(_){return {blob:file,ext:(file.type.split("/")[1]||"jpg").replace("jpeg","jpg"),type:file.type}}
}
async function uploadFlyer(file,folder){
  const img=await prepareImage(file);
  if(img.blob.size>5*1024*1024)throw {code:"too_large"};
  const path=`${folder}/${uuid()}.${img.ext}`;
  const {error}=await sb.storage.from("flyers").upload(path,img.blob,{contentType:img.type,upsert:false});
  if(error)throw error;
  return path;
}

/* ---------- interactions ---------- */
document.addEventListener("click",ev=>{
  const o=ev.target.closest("[data-open]");if(o){openDetail(o.dataset.open);return}
  if(ev.target.id==="resetBtn"){S.q="";$("q").value="";S.genres.clear();S.pick="";S.date="upcoming";S.shown=PAGE;render()}
  if(ev.target.closest("#emptyAdd"))requestAdd();
});
$("dateTags").addEventListener("click",e=>{const b=e.target.closest("[data-date]");if(!b)return;S.date=b.dataset.date;S.pick="";S.shown=PAGE;render()});
$("dateTags").addEventListener("change",e=>{if(e.target.id==="pick"){S.pick=e.target.value;S.shown=PAGE;render()}});
$("genreToggle").addEventListener("click",()=>{S.genreOpen=!S.genreOpen;try{localStorage.setItem(GENRE_KEY,S.genreOpen?"1":"0")}catch(_){}renderGenreToggle()});
$("genreTags").addEventListener("click",e=>{const b=e.target.closest("[data-genre]");if(!b)return;const g=b.dataset.genre;if(!g)S.genres.clear();else S.genres.has(g)?S.genres.delete(g):S.genres.add(g);S.shown=PAGE;render()});
let qT;$("q").addEventListener("input",e=>{clearTimeout(qT);qT=setTimeout(()=>{S.q=e.target.value.trim();S.shown=PAGE;render()},120)});
$("moreBtn").onclick=()=>{S.shown+=PAGE;renderGrid()};
$("addBtn").onclick=()=>requestAdd();
(function fab(){
  const b=$("addBtn");let ticking=false;
  const upd=()=>{ticking=false;b.classList.toggle("mini",scrollY>120)};
  addEventListener("scroll",()=>{if(!ticking){ticking=true;requestAnimationFrame(upd)}},{passive:true});upd();
})();
$("copyBtn").onclick=copyShareUrl;
$("shareUrl").addEventListener("focus",e=>e.target.select());
$("kakaoShareBtn").onclick=kakaoShare;
$("nativeShareBtn").onclick=nativeShare;
$("toTop").onclick=()=>window.scrollTo({top:0,behavior:reduced()?"auto":"smooth"});
$("reviewBtn").onclick=()=>{S.rejecting=null;S.blocking=null;if(S.reviewTab==="members")loadMembersAdmin();renderReview();openSheet("reviewScrim");loadPending()};
$("adminLink").onclick=async()=>{
  if(!sb){toast("아직 서비스 설정이 끝나지 않았어요");return}
  if(S.user){await sb.auth.signOut();toast("로그아웃했어요");return}
  $("l-msg").textContent="운영진 계정의 이메일과 비밀번호를 입력해 주세요.";$("l-msg").classList.remove("bad");$("l-email").value="";$("l-pw").value="";openSheet("loginScrim");setTimeout(()=>$("l-email").focus(),30);
};

$("detailScrim").addEventListener("click",async e=>{
  if(e.target===$("detailScrim")||e.target.closest("#closeDetail")){closeDetail();return}
  const t=e.target.closest("button");if(!t)return;
  if(t.id==="attendBtn"){toggleAttend(S.open);return}
  if(t.id==="peopleBtn"){openPeople(S.open);return}
  if(t.id==="delBtn"){S.confirm=true;renderDetail()}
  else if(t.id==="delNo"){S.confirm=false;renderDetail()}
  else if(t.id==="delYes"){await removeEvent(S.open)}
  else if(t.id==="editBtn"){const id=S.open;closeDetail();openForm(id)}
  else if(t.id==="shareBtn"){const ev=S.events.get(S.open);if(ev)openShare(ev)}
});
$("reviewScrim").addEventListener("click",async e=>{
  if(e.target===$("reviewScrim")||e.target.closest("#closeReview")){closeSheet("reviewScrim");return}
  const t=e.target.closest("button");if(!t)return;const d=t.dataset;
  if(d.rtab){S.reviewTab=d.rtab;S.blocking=null;if(d.rtab==="members")loadMembersAdmin();renderReview();return}
  if(d.block){S.blocking=d.block;renderReview();return}
  if(d.blockNo){S.blocking=null;renderReview();return}
  if(d.blockYes){t.disabled=true;await setBlocked(d.blockYes,true);return}
  if(d.unblock){t.disabled=true;await setBlocked(d.unblock,false);return}
  if(d.approve){t.disabled=true;await approve(d.approve,null)}
  else if(d.editPending){closeSheet("reviewScrim");openForm(d.editPending,true)}
  else if(d.reject){S.rejecting=d.reject;renderReview()}
  else if(d.rejNo){S.rejecting=null;renderReview()}
  else if(d.rejYes){t.disabled=true;await removeEvent(d.rejYes,true)}
});
["loginScrim","doneScrim","shareScrim"].forEach(id=>$(id).addEventListener("click",e=>{if(e.target===$(id)||e.target.closest("[data-close]"))closeSheet(id)}));
$("reviewList").addEventListener("input",e=>{if(e.target.id==="memberQ"){S.memberQ=e.target.value;const pos=e.target.selectionStart;renderReview();const i=$("memberQ");if(i){i.focus();i.setSelectionRange(pos,pos)}}});
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;
  for(const id of ["gateScrim","peopleScrim","joinScrim","meScrim","shareScrim","formScrim","loginScrim","doneScrim","reviewScrim"])if(!$(id).hidden){id==="formScrim"?closeForm():closeSheet(id);return}
  if(!$("detailScrim").hidden)closeDetail()});

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=$("l-email").value.trim(),password=$("l-pw").value;
  const msg=t=>{$("l-msg").textContent=t;$("l-msg").classList.add("bad")};
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){msg("이메일 주소를 확인해 주세요.");$("l-email").focus();return}
  if(!password){msg("비밀번호를 입력해 주세요.");$("l-pw").focus();return}
  const b=$("l-send");b.disabled=true;b.textContent="로그인 중…";
  const {error}=await sb.auth.signInWithPassword({email,password});
  b.disabled=false;b.textContent="로그인";
  if(error){
    msg(/invalid login credentials/i.test(error.message)?"이메일 또는 비밀번호가 맞지 않아요."
      :/email not confirmed/i.test(error.message)?"아직 확인되지 않은 계정이에요. 대표 운영진에게 계정 확인을 요청해 주세요."
      :/rate|too many/i.test(error.message)?"로그인 시도가 많아요. 잠시 후 다시 시도해 주세요."
      :"로그인하지 못했어요. 잠시 후 다시 시도해 주세요.");
    $("l-pw").value="";$("l-pw").focus();return;
  }
  $("l-pw").value="";closeSheet("loginScrim");toast("운영진으로 로그인했어요");
});

/* ---------- form ---------- */
let fGenres=new Set();
function renderFormGenres(){$("f-genres").innerHTML=GENRES.map(g=>`<button type="button" class="tag${hl(g)}" data-fg="${esc(g)}" aria-pressed="${fGenres.has(g)}">${esc(g)}</button>`).join("")}
$("f-genres").addEventListener("click",e=>{const b=e.target.closest("[data-fg]");if(!b)return;const g=b.dataset.fg;fGenres.has(g)?fGenres.delete(g):fGenres.add(g);b.setAttribute("aria-pressed",fGenres.has(g))});
function setFlyerPreview(url){const img=$("f-flyer-img");if(url){img.src=url;img.hidden=false;$("f-flyer-ph").hidden=true;$("f-flyer-clear").hidden=false}else{img.removeAttribute("src");img.hidden=true;$("f-flyer-ph").hidden=false;$("f-flyer-clear").hidden=true}}
$("f-flyer").addEventListener("change",e=>{
  const f=e.target.files&&e.target.files[0];if(!f)return;
  if(!/^image\/(png|jpeg|webp|gif)$/.test(f.type)){toast("PNG, JPG, WEBP, GIF 이미지만 올릴 수 있어요");e.target.value="";return}
  if(f.size>20*1024*1024){toast("20MB 이하 이미지만 올릴 수 있어요");e.target.value="";return}
  if(S.flyer.url&&S.flyer.url.startsWith("blob:"))URL.revokeObjectURL(S.flyer.url);
  S.flyer={path:null,file:f,url:URL.createObjectURL(f)};setFlyerPreview(S.flyer.url);$("f-flyer-msg").textContent=f.name;
});
$("f-flyer-clear").onclick=()=>{S.flyer={path:null,file:null,url:null};$("f-flyer").value="";setFlyerPreview(null);$("f-flyer-msg").textContent="플라이어 없이 저장하면 제목으로 포스터를 만들어 보여줘요."};

function openForm(id,fromPending){
  if(!sb){toast("아직 서비스 설정이 끝나지 않았어요");return}
  const e=id?(S.events.get(id)||S.pending.find(p=>p.id===id)):null;
  S.editing=id||null;S.editingPending=!!fromPending;
  const admin=S.isAdmin;
  $("formTitle").textContent=!admin?"SUBMIT EVENT":fromPending?"REVIEW EVENT":id?"EDIT EVENT":"ADD EVENT";
  $("formLead").textContent=admin?(fromPending?"내용을 다듬은 뒤 승인하면 바로 게시돼요.":"운영진이 등록한 일정은 바로 게시돼요."):"제보한 일정은 운영진이 확인한 뒤 게시돼요.";
  $("f-title").value=e?.title||"";$("f-start").value=e?.start||(S.pick&&S.pick!==ym(today())?S.pick+"-01":today());$("f-end").value=e?.end||"";$("f-time").value=e?.time||"";
  $("f-venue").value=e?.venue||"";$("f-url").value=e?.url||"";$("f-kakao").value=e?.kakao||"";$("f-memo").value=e?.memo||"";
  $("f-insta").value=S.member?.instagram?"@"+S.member.instagram:"";$("f-note").value="";$("f-credit").checked=true;$("f-hp").value="";
  $("submitter").hidden=admin;
  fGenres=new Set(e?.genres||[]);renderFormGenres();
  $("f-flyer").value="";S.flyer={path:e?.flyerPath||null,file:null,url:e?.flyer||null};setFlyerPreview(S.flyer.url);
  $("f-flyer-msg").textContent="세로형 포스터(A4 비율) 이미지를 추천해요. 없으면 제목으로 포스터를 만들어 보여줘요.";
  ["title","start","end","insta","kakao"].forEach(k=>{$(`f-${k}-err`).hidden=true;$(`f-${k}-wrap`).classList.remove("bad")});
  $("saveBtn").textContent=!admin?"제보하기":fromPending?"승인하고 게시":"저장";
  openSheet("formScrim");setTimeout(()=>$("f-title").focus(),30);
}
function closeForm(){closeSheet("formScrim");S.editing=null;S.editingPending=false;if(S.flyer.url&&S.flyer.url.startsWith("blob:"))URL.revokeObjectURL(S.flyer.url)}
$("cancelBtn").onclick=closeForm;
$("formScrim").addEventListener("click",e=>{if(e.target===$("formScrim"))closeForm()});
$("f-title").addEventListener("blur",()=>{const bad=!$("f-title").value.trim();$("f-title-err").hidden=!bad;$("f-title-wrap").classList.toggle("bad",bad)});

$("form").addEventListener("submit",async ev=>{
  ev.preventDefault();
  const admin=S.isAdmin;
  const title=$("f-title").value.trim(),start=$("f-start").value,end=$("f-end").value;
  const insta=$("f-insta").value.trim().replace(/^@+/,"").toLowerCase();
  const kakao=$("f-kakao").value.trim();
  const errs={title:!title,start:!start||(!admin&&start<addDays(today(),-1)),end:!!(end&&start&&end<start),kakao:!!kakao&&!KAKAO_RE.test(kakao),insta:!admin&&!/^[a-z0-9._]{1,30}$/.test(insta)};
  for(const k in errs){$(`f-${k}-err`).hidden=!errs[k];$(`f-${k}-wrap`).classList.toggle("bad",errs[k])}
  if(Object.values(errs).some(Boolean)){const first=Object.keys(errs).find(k=>errs[k]);$(`f-${first}`)?.focus();return}
  if($("f-hp").value){closeForm();openSheet("doneScrim");return}  // bot trap
  const btn=$("saveBtn"),label=btn.textContent;btn.disabled=true;btn.textContent="보내는 중…";
  try{
    let flyerPath=S.flyer.path||null;
    if(S.flyer.file){
      try{flyerPath=await uploadFlyer(S.flyer.file,admin?"events":"submissions")}
      catch(err){toast(err&&err.code==="too_large"?"이미지가 너무 커요. 5MB 이하로 줄여 주세요":"플라이어를 올리지 못했어요. 이미지 없이 진행할게요");flyerPath=S.flyer.path||null}
    }
    const genres=GENRES.filter(g=>fGenres.has(g));
    if(!admin){
      const {error}=await sb.rpc("submit_event",{p_title:title,p_start:start,p_end:end&&end>start?end:null,p_time:$("f-time").value||"",
        p_venue:$("f-venue").value.trim(),p_genres:genres,p_url:$("f-url").value.trim()||null,p_memo:$("f-memo").value.trim(),
        p_flyer:flyerPath,p_instagram:insta,p_note:$("f-note").value.trim(),p_credit:$("f-credit").checked,p_kakao:kakao||null});
      if(error)throw error;
      closeForm();openSheet("doneScrim");return;
    }
    const url=$("f-url").value.trim();
    const row={title,start_date:start,end_date:end&&end>start?end:null,start_time:$("f-time").value||null,venue:$("f-venue").value.trim()||null,
      genres,url:/^https?:\/\//i.test(url)?url:null,kakao_url:kakao||null,memo:$("f-memo").value.trim()||null,flyer_path:flyerPath};
    let id=S.editing;
    if(id){
      if(S.editingPending)Object.assign(row,{status:"approved",posted_by_name:S.adminName,reviewed_at:new Date().toISOString(),reviewed_by:S.user.id});
      const {error}=await sb.from("events").update(row).eq("id",id);if(error)throw error;
    }else{
      Object.assign(row,{status:"approved",posted_by_name:S.adminName,reviewed_at:new Date().toISOString(),reviewed_by:S.user.id});
      const {data,error}=await sb.from("events").insert(row).select("id").single();if(error)throw error;id=data.id;
    }
    const wasPending=S.editingPending,wasEdit=!!S.editing;closeForm();
    toast(wasPending?"승인해서 게시했어요":wasEdit?"일정을 저장했어요":"일정을 게시했어요");
    await Promise.all([loadEvents(),loadPending()]);if(S.events.has(id))openDetail(id);
  }catch(err){
    const m=String(err&&err.message||"");
    toast(/too_many_submissions/.test(m)?"제보가 많아요. 1시간 뒤에 다시 제보해 주세요"
      :/queue_full/.test(m)?"지금은 제보가 밀려 있어요. 잠시 후 다시 시도해 주세요"
      :/invalid_instagram/.test(m)?"인스타그램 아이디를 확인해 주세요"
      :/invalid_kakao/.test(m)?"카카오톡 오픈채팅 링크를 확인해 주세요"
      :/past_date/.test(m)?"이미 지난 날짜는 제보할 수 없어요"
      :/row-level security|permission/i.test(m)?"운영진만 할 수 있는 작업이에요"
      :"보내지 못했어요. 잠시 후 다시 시도해 주세요");
  }finally{btn.disabled=false;btn.textContent=label}
});

async function approve(id){
  const {error}=await sb.from("events").update({status:"approved",posted_by_name:S.adminName,reviewed_at:new Date().toISOString(),reviewed_by:S.user.id}).eq("id",id);
  if(error){toast("승인하지 못했어요. 다시 시도해 주세요");renderReview();return}
  toast("승인해서 게시했어요");await Promise.all([loadEvents(),loadPending()]);loadCounts();renderReview();
}
async function removeEvent(id,isReject){
  const e=S.events.get(id)||S.pending.find(p=>p.id===id);
  const {error}=await sb.from("events").delete().eq("id",id);
  if(error){toast("삭제하지 못했어요. 다시 시도해 주세요");return}
  if(e&&e.flyerPath)await sb.storage.from("flyers").remove([e.flyerPath]).catch(()=>{});
  S.rejecting=null;if(!isReject)closeDetail();
  toast(isReject?"제보를 반려했어요":"일정을 삭제했어요");
  await Promise.all([loadEvents(),loadPending()]);if(isReject)renderReview();
}

/* ---------- members · 갈래요 ---------- */
const AVC=["#b9a8ff","#fda4af","#86efac","#fcd34d","#93c5fd","#f0abfc","#fdba74","#a5f3fc"];
function avatar(m,cls=""){
  const name=m?.nickname||"?";
  if(m?.avatar_url&&/^https:\/\//i.test(m.avatar_url))return `<img class="av ${cls}" src="${esc(m.avatar_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  return `<span class="av ${cls}" style="background:${AVC[hue(name)%AVC.length]}" aria-hidden="true">${esc([...name][0]||"?")}</span>`;
}
function avStack(list,max=3,total){
  const n=total??list.length,shown=list.slice(0,max);
  return `<span class="avs">${shown.map(a=>avatar(a.m)).join("")}${n>shown.length?`<span class="av more">+${n-shown.length}</span>`:""}</span>`;
}
const ghosts=n=>`<span class="ghosts">${Array.from({length:Math.min(n,4)},(_,i)=>`<span class="ghost" style="background:${AVC[(i*3+1)%AVC.length]}"></span>`).join("")}</span>`;
const isMember=()=>S.member?.status==="member";
const canSeeCrew=()=>isMember()||S.isAdmin;
const countOf=id=>S.counts.get(id)||0;
const mine=id=>S.myAtt.has(id);
function attendeesOf(id){
  const list=(S.att.get(id)||[]).filter(a=>a.m);
  return list.sort((a,b)=>(b.user_id===S.user?.id)-(a.user_id===S.user?.id)||a.created_at.localeCompare(b.created_at));
}
function attLine(e){
  const n=countOf(e.id);if(!n)return "";
  const past=endOf(e)<today();
  return `<div class="attline${mine(e.id)?" mine":""}">♥ ${mine(e.id)?(n>1?`나 포함 ${n}명`:"나도 가요"):`${n}명이 ${past?"갔어요":"가요"}`}</div>`;
}
async function loadCounts(){
  if(!sb)return;
  const {data,error}=await sb.rpc("attend_counts");
  if(error)return;
  S.counts=new Map(data.map(r=>[r.event_id,r.n]));render();
}
async function loadAttendance(){
  S.att=new Map();S.myAtt=new Set();
  if(!sb||!canSeeCrew()){render();return}
  const {data,error}=await sb.from("attendance").select("event_id,user_id,created_at,members(nickname,avatar_url,instagram,genres)").limit(5000);
  if(error){render();return}
  for(const r of data){
    if(!r.members)continue;
    const a={user_id:r.user_id,created_at:r.created_at,m:r.members};
    if(!S.att.has(r.event_id))S.att.set(r.event_id,[]);
    S.att.get(r.event_id).push(a);
    if(r.user_id===S.user?.id)S.myAtt.add(r.event_id);
  }
  render();
}
async function loadMe(){
  S.member=null;S.isKakao=false;
  if(!S.user)return;
  S.isKakao=S.user.app_metadata?.provider==="kakao"||(S.user.identities||[]).some(i=>i.provider==="kakao");
  const {data}=await sb.from("members").select("*").eq("user_id",S.user.id).maybeSingle();
  S.member=data||null;
}

/* account chrome */
function renderAccount(){
  const kb=$("kakaoBtn"),mb=$("meBtn");
  kb.hidden=true;
  const guest=!!sb&&!S.user;
  mb.hidden=!(S.isKakao||guest);
  mb.classList.toggle("guest",guest);
  mb.setAttribute("aria-label",guest?"로그인":"내 정보");
  if(guest)mb.innerHTML='<svg width="17" height="17" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.4" r="2.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.8 14c.6-2.8 2.8-4.3 5.2-4.3s4.6 1.5 5.2 4.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  else if(S.isKakao)mb.innerHTML=avatar(S.member||{nickname:kakaoName()});
}
const kakaoName=()=>S.user?.user_metadata?.name||S.user?.user_metadata?.full_name||S.user?.user_metadata?.nickname||"";
const kakaoAvatar=()=>{const u=S.user?.user_metadata?.avatar_url||S.user?.user_metadata?.picture||"";return u.replace(/^http:\/\//i,"https://")};
const AFTER_KEY="hoa_after_login";
function requestAdd(){
  if(!sb){toast("아직 서비스 설정이 끝나지 않았어요");return}
  if(S.isAdmin){openForm(null);return}
  if(!S.user){openGate(null,"add");return}
  if(S.member?.status==="blocked"){toast("이용이 제한된 계정이에요");return}
  if(!S.member){try{sessionStorage.setItem(AFTER_KEY,"add")}catch(_){}openJoin();return}
  openForm(null);
}
function runAfterLogin(){
  let a=null;try{a=sessionStorage.getItem(AFTER_KEY)}catch(_){}
  if(a!=="add"||!S.member||S.member.status!=="member")return;
  try{sessionStorage.removeItem(AFTER_KEY)}catch(_){}
  openForm(null);
}
async function kakaoLogin(after){
  if(!sb){toast("아직 서비스 설정이 끝나지 않았어요");return}
  try{after?sessionStorage.setItem(AFTER_KEY,after):sessionStorage.removeItem(AFTER_KEY)}catch(_){}
  const {error}=await sb.auth.signInWithOAuth({provider:"kakao",options:{redirectTo:location.origin+location.pathname+location.search}});
  if(error)toast("카카오 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요");
}

/* crew week */
function weekRange(){
  const d=parse(today()),dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow);
  const start=ymd(d);return [start,addDays(start,6)];
}
const SHOW_CREW=false; // 초반 참여 인원이 적어서 잠시 숨김. true 로 바꾸면 다시 보여요
function renderCrew(){
  const box=$("crewBox");if(!box)return;
  if(!SHOW_CREW){box.innerHTML="";return}
  if(S.member?.status==="blocked"){box.innerHTML=`<div class="notice">이용이 제한된 계정이에요. 운영진에게 인스타그램 DM으로 문의해 주세요.</div>`;return}
  const [ws,we]=weekRange(),t=today();
  const list=[...S.events.values()].filter(e=>e.start<=we&&endOf(e)>=ws&&endOf(e)>=t&&countOf(e.id)>0)
    .sort((a,b)=>a.start.localeCompare(b.start)||(a.time||"99").localeCompare(b.time||"99"));
  const head=`<div class="crew-h"><b>이번 주 개미지옥 동선</b><span>${md(ws)} – ${md(we)}</span></div>`;
  if(canSeeCrew()){
    if(!S.loaded){box.innerHTML="";return}
    if(!list.length){box.innerHTML=`<section class="crew" aria-label="이번 주 개미지옥 동선">${head}<div class="crew-empty">이번 주는 아직 조용해요. 가고 싶은 행사에 갈래요를 눌러 보세요.</div></section>`;return}
    box.innerHTML=`<section class="crew" aria-label="이번 주 개미지옥 동선">${head}${list.map(e=>{
      const d=e.start<ws?ws:e.start,n=countOf(e.id);
      return `<button class="crow" data-open="${esc(e.id)}"><span class="cd">${wd(d)}<b>${parse(d).getDate()}</b></span>
        <span style="min-width:0"><span class="ct" style="display:block">${esc(e.title)}</span><span class="cm" style="display:block">${esc([e.venue,e.time].filter(Boolean).join(" · "))}</span></span>
        <span class="cr">${mine(e.id)?'<span class="badge-me">나도</span>':""}${avStack(attendeesOf(e.id),3,n)}</span></button>`;}).join("")}</section>`;
    return;
  }
  if(!list.length||!sb){box.innerHTML="";return}
  const total=list.reduce((s,e)=>s+countOf(e.id),0);
  box.innerHTML=`<section class="crew" aria-label="이번 주 개미지옥 동선">${head}${list.slice(0,3).map(e=>{const d=e.start<ws?ws:e.start;
    return `<button class="crow" data-open="${esc(e.id)}"><span class="cd">${wd(d)}<b>${parse(d).getDate()}</b></span><span style="min-width:0"><span class="ct" style="display:block">${esc(e.title)}</span><span class="cm" style="display:block">${esc(e.venue||"")}</span></span><span class="cn">${countOf(e.id)}명</span></button>`}).join("")}
    <div class="crew-cta"><p>${ghosts(total)}<span>이번 주 개미지옥 ${total}명이 움직여요. 누가 가는지는 멤버만 볼 수 있어요.</span></p>
    <button class="pill kakao-login lg" type="button" data-kakao="1"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4C7 4 3 7.1 3 11c0 2.5 1.7 4.7 4.2 5.9L6.5 20l3.6-2.3c.6.1 1.2.1 1.9.1 5 0 9-3.1 9-7s-4-6.8-9-6.8z" fill="currentColor"/></svg>${S.user?"멤버 가입하고 같이 가는 사람 보기":"카카오로 시작하고 누가 가는지 보기"}</button></div></section>`;
}

/* detail block */
function attendHTML(e){
  if(e.status==="pending")return "";
  const n=countOf(e.id),on=mine(e.id),past=endOf(e)<t0();
  const verb=past?"갔어요":"가요";
  const people=canSeeCrew()&&n?`${avStack(attendeesOf(e.id),4,n)}<span class="t"><b>${n}명</b>이 ${verb}</span><i>보기 ›</i>`
    :n?`${ghosts(n)}<span class="t"><b>${n}명</b>이 ${verb}</span><i>›</i>`:`<span class="t" style="color:var(--muted)">아직 아무도 없어요. 첫 번째로 눌러 보세요</span>`;
  return `<div class="attend"><button class="pill attend-btn${on?" on":""}" id="attendBtn" type="button" aria-pressed="${on}">${on?"♥":"♡"} ${past?"갔어요":"갈래요"}</button>
    <button class="people" id="peopleBtn" type="button"${n?"":" disabled"}>${people}</button></div>`;
}
const t0=()=>today();
let attBusy=false;
async function toggleAttend(id){
  if(!S.user){openGate(id,"guest");return}
  if(S.isAdmin&&!S.isKakao){toast("운영진 계정으로는 갈래요를 누를 수 없어요. 카카오로 로그인해 주세요");return}
  if(!S.member){openJoin();return}
  if(S.member.status!=="member"){toast("이용이 제한된 계정이에요");return}
  if(attBusy)return;attBusy=true;
  const on=!mine(id),me={user_id:S.user.id,created_at:new Date().toISOString(),m:{nickname:S.member.nickname,avatar_url:S.member.avatar_url,instagram:S.member.instagram,genres:S.member.genres}};
  const apply=v=>{
    if(v){S.myAtt.add(id);if(!S.att.has(id))S.att.set(id,[]);S.att.get(id).push(me);S.counts.set(id,countOf(id)+1)}
    else{S.myAtt.delete(id);S.att.set(id,(S.att.get(id)||[]).filter(a=>a.user_id!==S.user.id));S.counts.set(id,Math.max(0,countOf(id)-1))}
    render();
  };
  apply(on);
  const q=on?sb.from("attendance").insert({event_id:id,user_id:S.user.id}):sb.from("attendance").delete().eq("event_id",id).eq("user_id",S.user.id);
  const {error}=await q;attBusy=false;
  if(error&&!(on&&error.code==="23505")){apply(!on);toast("저장하지 못했어요. 다시 눌러 주세요");return}
  if(on){const e=S.events.get(id);toast(e&&endOf(e)<today()?"다녀온 행사로 기록했어요":"갈래요! 내 일정에 추가했어요")}
}

/* gate (E01) */
function openGate(id,mode){
  const n=id?countOf(id):0;
  S.gateMode=mode;
  if(mode==="login"){
    $("gateTitle").textContent="개미지옥 크루로 시작해요";
    $("gateText").textContent="카카오로 시작하면 가고 싶은 행사에 갈래요를 누르고, 같이 가는 크루를 볼 수 있어요.";
    $("gateGhosts").innerHTML="";
  }else if(mode==="add"){
    $("gateTitle").textContent="로그인하고 행사를 제보해 주세요";
    $("gateText").textContent="카카오로 로그인하면 가고 싶은 행사를 제보할 수 있어요. 운영진이 확인한 뒤 캘린더에 올라가요.";
    $("gateGhosts").innerHTML="";
  }else{
    $("gateTitle").textContent="크루 멤버만 갈래요를 누를 수 있어요";
    $("gateText").textContent=n?`카카오로 시작하면 이 행사에 같이 가는 멤버 ${n}명을 볼 수 있어요.`:"카카오로 시작하면 가고 싶은 행사를 표시하고, 같이 가는 크루를 볼 수 있어요.";
    $("gateGhosts").innerHTML=n?ghosts(n):"";
  }
  openSheet("gateScrim");
}

/* people (S08) */
let peopleFor=null;
function openPeople(id){
  if(!canSeeCrew()){openGate(id,"guest");return}
  peopleFor=id;S.peopleQ="";renderPeople();openSheet("peopleScrim");
}
function renderPeople(){
  const e=S.events.get(peopleFor);if(!e){closeSheet("peopleScrim");return}
  const all=attendeesOf(peopleFor),q=(S.peopleQ||"").toLowerCase();
  const list=q?all.filter(a=>(a.m.nickname+" "+(a.m.instagram||"")).toLowerCase().includes(q)):all;
  $("peopleTitle").textContent=`${endOf(e)<today()?"같이 간":"같이 가는"} 멤버 ${all.length}`;
  $("peopleBody").innerHTML=`<div class="plist">
    <div class="sub" style="color:var(--muted);font-size:13px">${esc(e.title)} · ${md(e.start)} ${wd(e.start)}</div>
    ${all.length>12?`<label class="search"><input id="peopleQ" type="search" placeholder="닉네임 검색" value="${esc(S.peopleQ||"")}" aria-label="닉네임 검색"></label>`:""}
    ${list.map(a=>`<div class="prow">${avatar(a.m)}<span class="pn"><b>${esc(a.m.nickname)}${a.user_id===S.user?.id?'<span class="badge-me">나</span>':""}</b><small>${esc((a.m.genres||[]).join(" · ")||" ")}</small></span>${a.m.instagram?`<a href="https://www.instagram.com/${encodeURIComponent(a.m.instagram)}/" target="_blank" rel="noopener">@${esc(a.m.instagram)} ↗</a>`:""}</div>`).join("")||`<div style="color:var(--muted)">검색 결과가 없어요.</div>`}
  </div>`;
}

/* join (S03) */
let jGenres=new Set(),joinEdit=false;
function openJoin(edit){
  if(!S.user)return;
  joinEdit=!!edit;const m=S.member;
  $("joinTitle").textContent=edit?"EDIT PROFILE":"JOIN";
  $("joinLead").textContent=edit?"닉네임과 인스타그램, 좋아하는 장르를 고칠 수 있어요.":"개미지옥 멤버가 되면 같이 가는 크루를 볼 수 있어요. 가입하면 바로 멤버가 돼요.";
  $("joinProfile").innerHTML=`${avatar({nickname:m?.nickname||kakaoName()||"?",avatar_url:m?.avatar_url||kakaoAvatar()})}<span><b>${esc(kakaoName()||m?.kakao_name||"카카오 계정")}</b><small>카카오 계정으로 로그인했어요</small></span>`;
  $("j-nick").value=m?.nickname||kakaoName().slice(0,20);
  $("j-insta").value=m?.instagram?"@"+m.instagram:"";
  jGenres=new Set(m?.genres||[]);renderJGenres();
  $("j-consent").hidden=!!edit;$("j-age").checked=false;$("j-rule").checked=false;
  ["j-nick-err","j-insta-err","j-consent-err"].forEach(i=>$(i).hidden=true);
  $("j-nick-wrap").classList.remove("bad");$("j-insta-wrap").classList.remove("bad");
  $("joinLater").textContent=edit?"취소":"나중에 할게요";
  $("joinSend").textContent=edit?"저장":"멤버로 시작하기";
  closeSheet("meScrim");closeSheet("gateScrim");openSheet("joinScrim");
  setTimeout(()=>$("j-nick").focus(),30);
}
function renderJGenres(){$("j-genres").innerHTML=GENRES.filter(g=>g!=="ETC").map(g=>`<button type="button" class="tag${hl(g)}" data-jg="${esc(g)}" aria-pressed="${jGenres.has(g)}">${esc(g)}</button>`).join("")}
function joinErr(id,wrap,msg){const el=$(id);el.textContent=msg;el.hidden=!msg;if(wrap)$(wrap).classList.toggle("bad",!!msg)}
async function submitJoin(ev){
  ev.preventDefault();
  const nick=$("j-nick").value.trim(),insta=$("j-insta").value.trim().replace(/^@+/,"").toLowerCase();
  let bad=false;
  joinErr("j-nick-err","j-nick-wrap",!nick?"닉네임을 입력해 주세요.":[...nick].length>20?"20자 이내로 입력해 주세요.":"");if(!nick||[...nick].length>20)bad=true;
  const ib=insta&&!/^[a-z0-9._]{1,30}$/.test(insta);joinErr("j-insta-err","j-insta-wrap",ib?"영문 소문자, 숫자, 마침표, 밑줄만 쓸 수 있어요.":"");if(ib)bad=true;
  if(!joinEdit){const ok=$("j-age").checked&&$("j-rule").checked;$("j-consent-err").hidden=ok;if(!ok)bad=true}
  if(bad){const f=$("joinForm").querySelector(".bad input,.consent .err:not([hidden])");f?.scrollIntoView({block:"center",behavior:reduced()?"auto":"smooth"});return}
  const b=$("joinSend");b.disabled=true;const label=b.textContent;b.textContent="저장 중…";
  const {error}=await sb.rpc("join_member",{p_nickname:nick,p_instagram:insta||null,p_genres:[...jGenres]});
  b.disabled=false;b.textContent=label;
  if(error){
    const m=error.message||"";
    toast(/blocked/.test(m)?"이용이 제한된 계정이에요. 운영진에게 문의해 주세요":/invalid_instagram/.test(m)?"인스타그램 아이디를 확인해 주세요":/invalid_nickname/.test(m)?"닉네임을 확인해 주세요":"저장하지 못했어요. 다시 눌러 주세요");
    return;
  }
  const first=!S.member;
  await loadMe();closeSheet("joinScrim");renderAccount();
  toast(first?"개미지옥 멤버가 됐어요! 가고 싶은 행사에 갈래요를 눌러 보세요":"프로필을 저장했어요");
  await loadAttendance();
  runAfterLogin();
}

/* me (S09) */
function openMe(){
  if(!S.member){openJoin();return}
  S.meTab=S.meTab||"up";S.leaving=false;renderMe();openSheet("meScrim");
}
function renderMe(){
  const m=S.member;if(!m){closeSheet("meScrim");return}
  const t=today(),evs=[...S.myAtt].map(id=>S.events.get(id)).filter(Boolean);
  const up=evs.filter(e=>endOf(e)>=t).sort((a,b)=>a.start.localeCompare(b.start));
  const past=evs.filter(e=>endOf(e)<t).sort((a,b)=>b.start.localeCompare(a.start));
  const list=S.meTab==="past"?past:up;
  $("meBody").innerHTML=`<div class="mebody">
    <div class="mehead">${avatar(m)}<span style="min-width:0;flex:1"><b>${esc(m.nickname)}</b> <span class="badge-me">멤버</span><small>${[m.instagram?"@"+esc(m.instagram):"",esc((m.genres||[]).join(", "))].filter(Boolean).join(" · ")||"프로필을 채워 보세요"}</small></span></div>
    <div class="segtabs" role="group" aria-label="내 일정"><button type="button" data-metab="up" aria-pressed="${S.meTab!=="past"}">다가오는 ${up.length}</button><button type="button" data-metab="past" aria-pressed="${S.meTab==="past"}">다녀온 ${past.length}</button></div>
    <div class="mylist">${list.length?list.map(e=>{const n=countOf(e.id)-1;return `<button type="button" class="dli" data-open="${esc(e.id)}"><div class="th" aria-hidden="true">${flyerHTML(e)}</div><div style="min-width:0"><div class="t">${esc(e.title)}</div><div class="m">${md(e.start)} ${wd(e.start)}${e.venue?" · "+esc(e.venue):""}</div><div class="attline">${n>0?`나 외 ${n}명`:"아직 나 혼자"}</div></div></button>`}).join("")
      :`<div class="crew-empty" style="border:0">${S.meTab==="past"?"다녀온 행사가 아직 없어요.":"아직 갈래요한 행사가 없어요. 이번 주 개미지옥 동선에서 골라 보세요."}</div>`}</div>
    <div class="melinks"><button type="button" class="pill kr" id="meEdit">프로필 수정</button><button type="button" class="pill kr" id="meLogout">로그아웃</button></div>
    ${S.leaving?`<div class="confirm">탈퇴하면 프로필과 갈래요 기록이 바로 지워지고 되돌릴 수 없어요.<div class="acts"><button type="button" class="pill danger kr" id="leaveYes">탈퇴하기</button><button type="button" class="pill kr" id="leaveNo">취소</button></div></div>`
      :`<div class="textlinks"><button type="button" id="meLeave">탈퇴하기</button></div>`}
  </div>`;
}

/* admin: members tab */
async function loadMembersAdmin(){
  if(!S.isAdmin)return;
  const {data,error}=await sb.from("members").select("user_id,nickname,kakao_name,instagram,avatar_url,status,created_at").order("created_at",{ascending:false}).limit(1000);
  if(error){toast("멤버 목록을 불러오지 못했어요");return}
  S.adminMembers=data;if(!$("reviewScrim").hidden)renderReview();
}
function renderMembersAdmin(){
  const all=S.adminMembers;
  if(!all)return `<div class="mlist"><div class="blank"><b>LOADING</b>멤버 목록을 불러오는 중이에요…</div></div>`;
  const q=(S.memberQ||"").toLowerCase();
  const list=q?all.filter(m=>[m.nickname,m.kakao_name,m.instagram].join(" ").toLowerCase().includes(q)):all;
  const n=all.filter(m=>m.status==="member").length;
  return `<div class="mlist"><div class="who" style="padding-top:12px">멤버 ${n}명${all.length>n?` · 차단 ${all.length-n}명`:""} · 카카오로 가입하면 바로 멤버가 돼요</div>
    <label class="search"><input id="memberQ" type="search" placeholder="닉네임, 카카오 이름, 인스타 검색" value="${esc(S.memberQ||"")}" aria-label="멤버 검색"></label>
    ${list.map(m=>`<div class="mrow${m.status==="blocked"?" blocked":""}"><div class="prow">${avatar(m)}<span class="pn"><b>${esc(m.nickname)}${m.status==="blocked"?' <span class="badge-me" style="background:var(--danger)">차단</span>':""}</b><small>카카오: ${esc(m.kakao_name||"-")}${m.instagram?` · @${esc(m.instagram)}`:""} · ${m.created_at.slice(5,10).replace("-",".")} 가입</small></span></div>
      ${S.blocking===m.user_id?`<span class="acts"><button class="pill danger kr" data-block-yes="${esc(m.user_id)}">차단</button><button class="pill kr" data-block-no="1">취소</button></span>`
        :m.status==="blocked"?`<button class="pill kr" data-unblock="${esc(m.user_id)}">해제</button>`:`<button class="pill kr" data-block="${esc(m.user_id)}">차단</button>`}</div>`).join("")||`<div class="who" style="padding:16px 0">${q?"검색 결과가 없어요.":"아직 가입한 멤버가 없어요."}</div>`}
  </div>`;
}
async function setBlocked(uid,blocked){
  const {error}=await sb.from("members").update(blocked?{status:"blocked",blocked_at:new Date().toISOString(),blocked_by:S.user.id}:{status:"member",blocked_at:null,blocked_by:null}).eq("user_id",uid);
  S.blocking=null;
  if(error){toast("처리하지 못했어요. 다시 시도해 주세요");renderReview();return}
  toast(blocked?"차단했어요. 갈래요 목록에서도 빠져요":"차단을 해제했어요");
  await loadMembersAdmin();loadCounts();loadAttendance();
}

/* member events */
$("kakaoBtn").onclick=kakaoLogin;
$("gateKakao").onclick=()=>{closeSheet("gateScrim");const after=S.gateMode==="add"?"add":null;if(S.user){if(after){try{sessionStorage.setItem(AFTER_KEY,after)}catch(_){}}openJoin()}else kakaoLogin(after)};
$("meBtn").onclick=()=>{if(!S.user){openGate(null,"login");return}openMe()};
$("joinForm").addEventListener("submit",submitJoin);
$("joinLater").onclick=()=>closeSheet("joinScrim");
$("j-genres").addEventListener("click",e=>{const b=e.target.closest("[data-jg]");if(!b)return;const g=b.dataset.jg;jGenres.has(g)?jGenres.delete(g):jGenres.add(g);renderJGenres()});
$("j-nick").addEventListener("input",()=>{if(!$("j-nick-err").hidden&&$("j-nick").value.trim())joinErr("j-nick-err","j-nick-wrap","")});
$("j-insta").addEventListener("input",()=>{if(!$("j-insta-err").hidden)joinErr("j-insta-err","j-insta-wrap","")});
["j-age","j-rule"].forEach(id=>$(id).addEventListener("change",()=>{if($("j-age").checked&&$("j-rule").checked)$("j-consent-err").hidden=true}));
$("crewBox").addEventListener("click",e=>{if(e.target.closest("[data-kakao]")){S.user?openJoin():kakaoLogin()}});
$("peopleBody").addEventListener("input",e=>{if(e.target.id==="peopleQ"){S.peopleQ=e.target.value;const pos=e.target.selectionStart;renderPeople();const i=$("peopleQ");if(i){i.focus();i.setSelectionRange(pos,pos)}}});
$("meBody").addEventListener("click",async e=>{
  const t=e.target.closest("button");if(!t)return;
  if(t.dataset.metab){S.meTab=t.dataset.metab;renderMe()}
  else if(t.dataset.open){closeSheet("meScrim")}
  else if(t.id==="meEdit")openJoin(true);
  else if(t.id==="meLogout"){await sb.auth.signOut();closeSheet("meScrim");toast("로그아웃했어요")}
  else if(t.id==="meLeave"){S.leaving=true;renderMe()}
  else if(t.id==="leaveNo"){S.leaving=false;renderMe()}
  else if(t.id==="leaveYes"){t.disabled=true;const {error}=await sb.rpc("delete_me");if(error){t.disabled=false;toast("탈퇴하지 못했어요. 운영진에게 문의해 주세요");return}
    await sb.auth.signOut();closeSheet("meScrim");toast("탈퇴했어요. 그동안 고마웠어요")}
});
["joinScrim","meScrim","peopleScrim","gateScrim"].forEach(id=>$(id).addEventListener("click",e=>{if(e.target===$(id)||e.target.closest("[data-close]"))closeSheet(id)}));
$("peopleBody").addEventListener("click",e=>{if(e.target.closest("[data-open]"))closeSheet("peopleScrim")});

/* OAuth 에러로 돌아온 경우 */
(function oauthError(){
  const h=new URLSearchParams(location.hash.slice(1)),q=new URLSearchParams(location.search);
  const msg=h.get("error_description")||q.get("error_description");
  if(!msg)return;
  try{["error","error_code","error_description"].forEach(k=>q.delete(k));history.replaceState(null,"",location.pathname+(q.toString()?"?"+q:""))}catch(_){}
  setTimeout(()=>toast(/email/i.test(msg)?"카카오 로그인 설정(이메일) 문제로 로그인하지 못했어요. 운영진에게 알려 주세요":/signup|sign up|not allowed/i.test(msg)?"지금은 가입을 받을 수 없어요. 운영진에게 알려 주세요":"카카오 로그인에 실패했어요. 다시 시도해 주세요"),400);
})();

/* ---------- boot ---------- */
render();
if(!sb){
  S.loaded=true;
  setStatus(window.supabase?"config.js 에 Supabase 주소와 키를 넣으면 서비스가 시작돼요.":"서비스에 연결하지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.");
  render();
}else{
  const timer=setTimeout(()=>{if(!S.loaded)setStatus("일정을 불러오는 데 시간이 걸리고 있어요…")},8000);
  loadEvents().finally(()=>clearTimeout(timer));
  loadCounts();
  // supabase-js: don't await other calls inside this callback; defer instead
  sb.auth.onAuthStateChange((_evt,session)=>{setTimeout(()=>refreshAuth(session),0)});
}
})();
