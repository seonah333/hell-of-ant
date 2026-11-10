/* HELL OF ANT 행사 캘린더 · app.js */
(() => {
"use strict";

/* ---------- constants & helpers ---------- */
const GENRES=["TECHNO","HOUSE","TECH HOUSE","TRANCE","HARD DANCE","DNB","DUBSTEP","BASS","EDM","POP","ROCK","LIVE","ETC"];
const WD=["SUN","MON","TUE","WED","THU","FRI","SAT"];
const PAGE=24;
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
const S={events:new Map(),pending:[],q:"",date:"upcoming",pick:"",genre:"",shown:PAGE,open:null,confirm:false,
  editing:null,editingPending:false,rejecting:null,loaded:false,user:null,isAdmin:false,adminName:"",flyer:{path:null,file:null,url:null}};

const CFG=window.HOA_CONFIG||{};
const sb=(CFG.supabaseUrl&&CFG.supabaseAnonKey&&window.supabase)?window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey):null;
const flyerUrl=path=>path&&sb?sb.storage.from("flyers").getPublicUrl(path).data.publicUrl:"";
const fromRow=r=>({id:r.id,status:r.status,title:r.title,start:r.start_date,end:r.end_date||"",time:r.start_time||"",venue:r.venue||"",
  genres:r.genres||[],url:r.url||"",memo:r.memo||"",flyerPath:r.flyer_path||"",flyer:flyerUrl(r.flyer_path),credit:r.credit||"",
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
function textHit(e){if(!S.q)return true;const q=S.q.toLowerCase();return [e.title,e.venue,e.memo,e.credit,(e.genres||[]).join(" ")].some(v=>String(v||"").toLowerCase().includes(q))}
function list(ignore){
  const out=[];
  for(const [,e] of S.events){
    if(!inDate(e)||!textHit(e))continue;
    if(ignore!=="genre"&&S.genre&&!(e.genres||[]).includes(S.genre))continue;
    out.push(e);
  }
  const past=S.date==="past"&&!S.pick;
  return out.sort((a,b)=>(past?b.start.localeCompare(a.start):a.start.localeCompare(b.start))||(a.time||"99").localeCompare(b.time||"99"));
}

/* ---------- render ---------- */
function renderFilters(){
  $("dateTags").innerHTML=DATE_OPTS.map(o=>`<button class="tag kr" data-date="${o.id}" aria-pressed="${!S.pick&&S.date===o.id}">${o.label}</button>`).join("")+
    `<label class="tag kr" aria-pressed="${!!S.pick}"><select id="pick" aria-label="연도와 월 선택"><option value="">날짜 선택</option>${monthOptions().map(m=>`<option value="${m}" ${m===S.pick?"selected":""}>${m.replace("-",".")}</option>`).join("")}</select></label>`;
  const gc={};list("genre").forEach(e=>(e.genres||[]).forEach(g=>gc[g]=(gc[g]||0)+1));
  $("genreTags").innerHTML=`<button class="tag" data-genre="" aria-pressed="${!S.genre}">ALL</button>`+
    GENRES.filter(g=>gc[g]||g===S.genre).map(g=>`<button class="tag" data-genre="${esc(g)}" aria-pressed="${S.genre===g}">${esc(g)} <span class="n">${gc[g]||0}</span></button>`).join("");
}
function genInner(e){return `<span>${md(e.start)} ${wd(e.start)}</span><b>${esc(e.title)}</b><span>${esc(e.venue)}</span>`}
function flyerHTML(e){
  return e.flyer?`<img src="${esc(e.flyer)}" alt="${esc(e.title)} 플라이어" loading="lazy" data-h="${hue(e.title)}" data-gen="${esc(genInner(e))}">`
    :`<div class="gen" style="--h:${hue(e.title)}">${genInner(e)}</div>`;
}
document.addEventListener("error",ev=>{const img=ev.target;if(!(img instanceof HTMLImageElement)||!img.dataset.gen)return;
  const d=document.createElement("div");d.className="gen";d.style.setProperty("--h",img.dataset.h||"0");d.innerHTML=img.dataset.gen;img.replaceWith(d)},true);

function renderNext(){
  const t=today();let best=null;
  for(const [,e] of S.events){if(endOf(e)<t)continue;if(!best||e.start<best.start||(e.start===best.start&&(e.time||"99")<(best.time||"99")))best=e}
  if(!best){$("nextBox").innerHTML=`<div class="next empty"><div><div class="k">NEXT UP</div><div class="t">${S.loaded||!sb?"아직 예정된 일정이 없어요":"일정을 불러오는 중이에요…"}</div></div></div>`;return}
  $("nextBox").innerHTML=`<button class="next" data-open="${esc(best.id)}"><div class="dd">${best.start<=t?"NOW":dday(best.start)}</div>
    <div style="min-width:0"><div class="k">NEXT UP · ${md(best.start)} ${wd(best.start)}${best.time?" · "+esc(best.time):""}</div><div class="t">${esc(best.title)}</div>${best.venue?`<div class="m">${esc(best.venue)}</div>`:""}</div>
    <span class="go">자세히 보기 →</span></button>`;
}
function renderGrid(){
  const items=list(),t=today();
  $("count").textContent=`${items.length}개 일정`;
  $("grid").innerHTML=items.slice(0,S.shown).map(e=>{
    const range=e.end&&e.end>e.start?`<small>– ${md(e.end)} ${wd(e.end)}</small>`:"";
    return `<button class="card${endOf(e)<t?" past":""}" data-open="${esc(e.id)}">
      <div class="flyer">${flyerHTML(e)}</div>
      <div class="cbody">
        ${e.venue?`<div class="venue">${esc(e.venue)}</div>`:""}
        <div class="date">${md(e.start)} ${wd(e.start)}${range}</div>
        <div class="ctitle">${esc(e.title)}</div>
        ${e.time?`<div class="ctime">${esc(e.time)}</div>`:""}
        ${(e.genres||[]).length?`<div class="gtags">${e.genres.map(x=>`<span>${esc(x)}</span>`).join("")}</div>`:""}
      </div></button>`;
  }).join("");
  $("moreBtn").hidden=items.length<=S.shown;
  const blank=$("blank");
  if(items.length){blank.hidden=true;return}
  blank.hidden=false;
  if(sb&&!S.loaded){blank.innerHTML=`<b>LOADING</b>일정을 불러오는 중이에요…`;return}
  const filtered=S.q||S.genre||S.pick||S.date!=="upcoming";
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
function render(){renderFilters();renderNext();renderGrid();renderStats();renderAdmin();if(S.open)renderDetail()}

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
    ${(e.genres||[]).length?`<div class="gtags">${e.genres.map(x=>`<span>${esc(x)}</span>`).join("")}</div>`:""}
    <div class="facts">
      <div><b>TIME</b><span>${esc(e.time||"미정")}</span></div>
      <div><b>VENUE</b><span>${esc(e.venue||"미정")}</span></div>
    </div>
    ${e.memo?`<div class="memo">${esc(e.memo)}</div>`:""}
    ${e.url&&/^https?:\/\//i.test(e.url)?`<a class="link" href="${esc(e.url)}" target="_blank" rel="noopener">예매·정보 링크 열기 ↗</a>`:""}
    <div class="who reg">등록: ${esc(e.postedBy||"운영진")}${credit}</div>
    ${S.isAdmin?(S.confirm?`<div class="confirm">“${esc(e.title)}” 일정을 삭제할까요? 되돌릴 수 없어요.<div class="acts"><button class="pill danger kr" id="delYes">삭제</button><button class="pill kr" id="delNo">취소</button></div></div>`:
      `<div class="acts"><button class="pill kr" id="editBtn">수정</button><button class="pill kr" id="delBtn">삭제</button></div>`):""}
  </div></div>`;
}
function openDetail(id){S.open=id;S.confirm=false;$("detailScrim").hidden=false;renderDetail()}
function closeDetail(){S.open=null;S.confirm=false;$("detailScrim").hidden=true}

function renderReview(){
  const box=$("reviewList");
  if(!S.pending.length){box.innerHTML=`<div class="blank"><b>ALL CLEAR</b>승인 대기 중인 제보가 없어요.</div>`;return}
  box.innerHTML=S.pending.map(e=>{
    const c=e.contact||{};
    const range=e.end&&e.end>e.start?` – ${md(e.end)} ${wd(e.end)}`:"";
    return `<article class="pend">
      <div class="flyer">${flyerHTML(e)}</div>
      <div class="pinfo">
        <div class="date">${md(e.start)} ${wd(e.start)}${range}${e.time?` · ${esc(e.time)}`:""}</div>
        <div class="ctitle">${esc(e.title)}</div>
        ${e.venue?`<div class="venue">${esc(e.venue)}</div>`:""}
        ${(e.genres||[]).length?`<div class="gtags">${e.genres.map(x=>`<span>${esc(x)}</span>`).join("")}</div>`:""}
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
  S.events=new Map(data.map(r=>[r.id,fromRow(r)]));S.loaded=true;setStatus("");render();
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
  renderAdmin();await loadPending();if(S.open)renderDetail();
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
  if(ev.target.id==="resetBtn"){S.q="";$("q").value="";S.genre="";S.pick="";S.date="upcoming";S.shown=PAGE;render()}
  if(ev.target.closest("#emptyAdd"))openForm(null);
});
$("dateTags").addEventListener("click",e=>{const b=e.target.closest("[data-date]");if(!b)return;S.date=b.dataset.date;S.pick="";S.shown=PAGE;render()});
$("dateTags").addEventListener("change",e=>{if(e.target.id==="pick"){S.pick=e.target.value;S.shown=PAGE;render()}});
$("genreTags").addEventListener("click",e=>{const b=e.target.closest("[data-genre]");if(!b)return;S.genre=b.dataset.genre;S.shown=PAGE;render()});
let qT;$("q").addEventListener("input",e=>{clearTimeout(qT);qT=setTimeout(()=>{S.q=e.target.value.trim();S.shown=PAGE;render()},120)});
$("moreBtn").onclick=()=>{S.shown+=PAGE;renderGrid()};
$("addBtn").onclick=()=>openForm(null);
$("toTop").onclick=()=>window.scrollTo({top:0,behavior:reduced()?"auto":"smooth"});
$("reviewBtn").onclick=()=>{S.rejecting=null;renderReview();openSheet("reviewScrim");loadPending()};
$("adminLink").onclick=async()=>{
  if(!sb){toast("아직 서비스 설정이 끝나지 않았어요");return}
  if(S.user){await sb.auth.signOut();toast("로그아웃했어요");return}
  $("l-msg").textContent="운영진으로 등록된 이메일로 로그인 링크를 보내드려요.";$("l-email").value="";openSheet("loginScrim");setTimeout(()=>$("l-email").focus(),30);
};

$("detailScrim").addEventListener("click",async e=>{
  if(e.target===$("detailScrim")||e.target.closest("#closeDetail")){closeDetail();return}
  const t=e.target.closest("button");if(!t)return;
  if(t.id==="delBtn"){S.confirm=true;renderDetail()}
  else if(t.id==="delNo"){S.confirm=false;renderDetail()}
  else if(t.id==="delYes"){await removeEvent(S.open)}
  else if(t.id==="editBtn"){const id=S.open;closeDetail();openForm(id)}
});
$("reviewScrim").addEventListener("click",async e=>{
  if(e.target===$("reviewScrim")||e.target.closest("#closeReview")){closeSheet("reviewScrim");return}
  const t=e.target.closest("button");if(!t)return;const d=t.dataset;
  if(d.approve){t.disabled=true;await approve(d.approve,null)}
  else if(d.editPending){closeSheet("reviewScrim");openForm(d.editPending,true)}
  else if(d.reject){S.rejecting=d.reject;renderReview()}
  else if(d.rejNo){S.rejecting=null;renderReview()}
  else if(d.rejYes){t.disabled=true;await removeEvent(d.rejYes,true)}
});
["loginScrim","doneScrim"].forEach(id=>$(id).addEventListener("click",e=>{if(e.target===$(id)||e.target.closest("[data-close]"))closeSheet(id)}));
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;
  for(const id of ["formScrim","loginScrim","doneScrim","reviewScrim"])if(!$(id).hidden){id==="formScrim"?closeForm():closeSheet(id);return}
  if(!$("detailScrim").hidden)closeDetail()});

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();const email=$("l-email").value.trim();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){$("l-msg").textContent="이메일 주소를 확인해 주세요.";return}
  const b=$("l-send");b.disabled=true;b.textContent="보내는 중…";
  const {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}});
  b.disabled=false;b.textContent="로그인 링크 받기";
  $("l-msg").textContent=error?(/signup|not allowed|not found/i.test(error.message)?"운영진으로 등록된 이메일이 아니에요.":"링크를 보내지 못했어요. 잠시 후 다시 시도해 주세요."):`${email} 로 로그인 링크를 보냈어요. 메일함에서 링크를 눌러 주세요.`;
});

/* ---------- form ---------- */
let fGenres=new Set();
function renderFormGenres(){$("f-genres").innerHTML=GENRES.map(g=>`<button type="button" class="tag" data-fg="${esc(g)}" aria-pressed="${fGenres.has(g)}">${esc(g)}</button>`).join("")}
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
  $("f-venue").value=e?.venue||"";$("f-url").value=e?.url||"";$("f-memo").value=e?.memo||"";
  $("f-insta").value="";$("f-note").value="";$("f-credit").checked=true;$("f-hp").value="";
  $("submitter").hidden=admin;
  fGenres=new Set(e?.genres||[]);renderFormGenres();
  $("f-flyer").value="";S.flyer={path:e?.flyerPath||null,file:null,url:e?.flyer||null};setFlyerPreview(S.flyer.url);
  $("f-flyer-msg").textContent="정사각형 이미지를 추천해요. 없으면 제목으로 포스터를 만들어 보여줘요.";
  ["title","start","end","insta"].forEach(k=>{$(`f-${k}-err`).hidden=true;$(`f-${k}-wrap`).classList.remove("bad")});
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
  const errs={title:!title,start:!start||(!admin&&start<addDays(today(),-1)),end:!!(end&&start&&end<start),insta:!admin&&!/^[a-z0-9._]{1,30}$/.test(insta)};
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
        p_flyer:flyerPath,p_instagram:insta,p_note:$("f-note").value.trim(),p_credit:$("f-credit").checked});
      if(error)throw error;
      closeForm();openSheet("doneScrim");return;
    }
    const url=$("f-url").value.trim();
    const row={title,start_date:start,end_date:end&&end>start?end:null,start_time:$("f-time").value||null,venue:$("f-venue").value.trim()||null,
      genres,url:/^https?:\/\//i.test(url)?url:null,memo:$("f-memo").value.trim()||null,flyer_path:flyerPath};
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
      :/past_date/.test(m)?"이미 지난 날짜는 제보할 수 없어요"
      :/row-level security|permission/i.test(m)?"운영진만 할 수 있는 작업이에요"
      :"보내지 못했어요. 잠시 후 다시 시도해 주세요");
  }finally{btn.disabled=false;btn.textContent=label}
});

async function approve(id){
  const {error}=await sb.from("events").update({status:"approved",posted_by_name:S.adminName,reviewed_at:new Date().toISOString(),reviewed_by:S.user.id}).eq("id",id);
  if(error){toast("승인하지 못했어요. 다시 시도해 주세요");renderReview();return}
  toast("승인해서 게시했어요");await Promise.all([loadEvents(),loadPending()]);renderReview();
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

/* ---------- boot ---------- */
render();
if(!sb){
  S.loaded=true;
  setStatus(window.supabase?"config.js 에 Supabase 주소와 키를 넣으면 서비스가 시작돼요.":"서비스에 연결하지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.");
  render();
}else{
  const timer=setTimeout(()=>{if(!S.loaded)setStatus("일정을 불러오는 데 시간이 걸리고 있어요…")},8000);
  loadEvents().finally(()=>clearTimeout(timer));
  // supabase-js: don't await other calls inside this callback; defer instead
  sb.auth.onAuthStateChange((_evt,session)=>{setTimeout(()=>refreshAuth(session),0)});
}
})();
