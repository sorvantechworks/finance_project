/* ClearPath Cloud V2
   1) Put your Supabase URL and anon key below.
   2) Never put a Supabase service_role key in this file.
*/
const SUPABASE_URL = "PASTE_YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_KEY";
const configured = !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const sb = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = n => `${state.profile?.currency || "$"}${Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0})}`;
const monthKey = () => $("#monthSelect").value;
const todayMonth = () => new Date().toISOString().slice(0,7);
let state = {profile:{name:"Friend",email:"",currency:"$"}, months:{}, loans:[], chits:[], debts:[], activity:[]};
let currentUser = null;

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function toast(msg,bad=false){const t=$("#toast");t.textContent=msg;t.className=bad?"bad":"show";setTimeout(()=>t.className="",2600)}
function fmtMonth(k){return new Date(k+"-01T12:00:00").toLocaleDateString(undefined,{month:"long",year:"numeric"})}
function ensureMonth(k){if(!state.months[k])state.months[k]={income:0,note:"",expenses:{rent:0,food:0,travel:0,phone:0,misc:0,other:0}};return state.months[k]}
function living(k){const e=ensureMonth(k).expenses;return Object.values(e).reduce((a,b)=>a+Number(b||0),0)}
function emi(){return state.loans.reduce((a,x)=>a+Number(x.emi||0),0)}
function chits(){return state.chits.reduce((a,x)=>a+Number(x.monthly||0),0)}
function free(k){return Number(ensureMonth(k).income||0)-living(k)-emi()-chits()}
function loanBal(x){return Math.max(0,Number(x.balance||0))}
function debtBal(x){return Math.max(0,Number(x.balance||0))}
function buffer(k){return Math.max(0,Number(ensureMonth(k).income||0)*.10)}

async function dbGet(){
  if(!configured) return loadLocalFallback();
  const {data:profile,error:pErr}=await sb.from("profiles").select("name,email,currency").eq("id",currentUser.id).maybeSingle();
  if(pErr) throw pErr;
  state.profile=profile||{name:currentUser.user_metadata?.name||"Friend",email:currentUser.email||"",currency:"$"};
  if(!profile) await sb.from("profiles").upsert({id:currentUser.id,...state.profile});
  const [m,l,c,d,a]=await Promise.all([
    sb.from("monthly_finance").select("*").eq("user_id",currentUser.id),
    sb.from("loans").select("*").eq("user_id",currentUser.id).order("created_at"),
    sb.from("chits").select("*").eq("user_id",currentUser.id).order("created_at"),
    sb.from("temporary_debts").select("*").eq("user_id",currentUser.id).order("created_at"),
    sb.from("activity").select("*").eq("user_id",currentUser.id).order("created_at",{ascending:false}).limit(100)
  ]);
  for(const r of [m,l,c,d,a]) if(r.error) throw r.error;
  state.months={};m.data.forEach(x=>state.months[x.month]={income:Number(x.income||0),note:x.note||"",expenses:x.expenses||{rent:0,food:0,travel:0,phone:0,misc:0,other:0}});
  state.loans=l.data||[];state.chits=c.data||[];state.debts=d.data||[];state.activity=a.data||[];
  ensureMonth(todayMonth());
}
function loadLocalFallback(){const raw=localStorage.getItem("clearpath_cloud_v2");if(raw)state=JSON.parse(raw);ensureMonth(todayMonth())}
async function saveMonth(){
  const k=monthKey(),m=ensureMonth(k);
  if(!configured){localStorage.setItem("clearpath_cloud_v2",JSON.stringify(state));return}
  const {error}=await sb.from("monthly_finance").upsert({user_id:currentUser.id,month:k,income:Number(m.income||0),note:m.note||"",expenses:m.expenses},{onConflict:"user_id,month"});
  if(error) throw error;
}
async function saveProfile(){
  if(!configured){localStorage.setItem("clearpath_cloud_v2",JSON.stringify(state));return}
  const {error}=await sb.from("profiles").upsert({id:currentUser.id,name:state.profile.name,email:state.profile.email,currency:state.profile.currency});
  if(error)throw error;
}
async function addRecord(table,payload){if(!configured){state[payload._arr].push({...payload,id:crypto.randomUUID()});delete state[payload._arr];localStorage.setItem("clearpath_cloud_v2",JSON.stringify(state));return}const {error}=await sb.from(table).insert({user_id:currentUser.id,...payload});if(error)throw error;await dbGet()}
async function updateRecord(table,id,payload){if(!configured){Object.assign(state[payload._arr].find(x=>x.id===id),payload);delete payload._arr;localStorage.setItem("clearpath_cloud_v2",JSON.stringify(state));return}const {error}=await sb.from(table).update(payload).eq("id",id).eq("user_id",currentUser.id);if(error)throw error;await dbGet()}
async function deleteRecord(table,id,arr){if(!configured){state[arr]=state[arr].filter(x=>x.id!==id);localStorage.setItem("clearpath_cloud_v2",JSON.stringify(state));return}const {error}=await sb.from(table).delete().eq("id",id).eq("user_id",currentUser.id);if(error)throw error;await dbGet()}
async function logActivity(type,description,amount=0){if(!configured){state.activity.unshift({id:crypto.randomUUID(),created_at:new Date().toISOString(),type,description,amount});localStorage.setItem("clearpath_cloud_v2",JSON.stringify(state));return}await sb.from("activity").insert({user_id:currentUser.id,type,description,amount})}

function renderAll(){renderHeader();renderDashboard();renderIncome();renderExpenses();renderLoans();renderChits();renderDebts();renderActivity();renderSettings()}
function renderHeader(){
  $("#sideName").textContent=state.profile.name||"Friend";$("#sideEmail").textContent=currentUser?.email||state.profile.email||"";
  $("#avatar").textContent=(state.profile.name||"F").trim().charAt(0).toUpperCase();
  const sel=$("#monthSelect"), old=sel.value||todayMonth(); const months=[];
  for(let i=0;i<13;i++){const d=new Date();d.setMonth(d.getMonth()-6+i);months.push(d.toISOString().slice(0,7))}
  sel.innerHTML=months.map(x=>`<option value="${x}">${fmtMonth(x)}</option>`).join("");sel.value=months.includes(old)?old:todayMonth();
}
function renderDashboard(){
  const k=monthKey(),m=ensureMonth(k),inc=Number(m.income||0),lv=living(k),e=emi(),c=chits(),fc=free(k),bf=buffer(k),temp=state.debts.reduce((a,x)=>a+debtBal(x),0),lb=state.loans.reduce((a,x)=>a+loanBal(x),0);
  const largest=[...state.loans].sort((a,b)=>Number(b.emi)-Number(a.emi))[0];
  let plan;
  if(fc<0)plan=`You're short by ${money(Math.abs(fc))} this month. Protect essentials first and don't add extra debt payments.`;
  else if(fc<bf)plan=`Cash is tight. Keep about ${money(bf)} as a buffer before making accelerated payments.`;
  else{
    const tempPay=Math.min(temp,Math.max(25,Math.round(fc*.2)));
    const extraPool=Math.max(0,fc-bf-tempPay);
    if(largest && extraPool>=2*Number(largest.emi||0)) plan=`After essentials, buffer and a small temporary-debt payment, a 3× EMI payment on ${esc(largest.name)} can fit this month.`;
    else plan=`After essentials and your buffer, about ${money(Math.max(0,fc-bf))} remains for flexible debt repayment or savings.`;
  }
  $("#page-dashboard").innerHTML=`
  <div class="hero"><p class="eyebrow">MONTHLY PLAN · ${esc(fmtMonth(k))}</p><h1>Good money decisions start with visibility.</h1><p>${esc(plan)}</p>
  <div class="hero-meta"><div><strong>${money(inc)}</strong><span>income</span></div><div><strong>${money(Math.max(0,fc))}</strong><span>free cash</span></div><div><strong>${money(lb+temp)}</strong><span>debt remaining</span></div></div></div>
  <div class="stats">
    ${stat("Income",inc,"Monthly earnings")}
    ${stat("Living costs",lv,"Essential spending")}
    ${stat("EMI + chits",e+c,"Mandatory commitments")}
    ${stat("Free cash",fc,fc>=0?"Available after commitments":"Deficit — review costs",fc>=0?"positive":"negative")}
  </div>
  <div class="grid-2">
    <div class="card"><div class="card-head"><h3>Cash-flow allocation</h3><span class="small muted">${esc(fmtMonth(k))}</span></div>
      ${allocation("Living costs",lv,inc)}${allocation("Loan EMIs",e,inc)}${allocation("Chits",c,inc)}${allocation("Free cash",Math.max(0,fc),inc)}
    </div>
    <div class="card"><div class="card-head"><h3>Debt snapshot</h3><button class="mini-btn" data-page-jump="loans">View loans</button></div>
      <div class="metric-row"><span>Loans outstanding</span><strong>${money(lb)}</strong></div>
      <div class="metric-row"><span>Temporary debts</span><strong>${money(temp)}</strong></div>
      <div class="metric-row"><span>Monthly EMI</span><strong>${money(e)}</strong></div>
      <div class="metric-row"><span>Monthly chit commitments</span><strong>${money(c)}</strong></div>
    </div>
  </div>
  <div class="grid-2 equal" style="margin-top:16px">
    <div class="card"><div class="card-head"><h3>Planning rules</h3></div><div class="metric-row"><span>Emergency buffer target</span><strong>${money(bf)}</strong></div><div class="metric-row"><span>Suggested temp-debt share</span><strong>~20% of free cash</strong></div><div class="metric-row"><span>Accelerated EMI</span><strong>3× EMI = EMI + 2× extra</strong></div></div>
    <div class="card"><div class="card-head"><h3>Quick actions</h3></div><div class="item-actions"><button class="btn secondary" data-open="income">Add income</button><button class="btn secondary" data-open="loan">Add loan</button><button class="btn secondary" data-open="debt">Add debt</button></div><div class="notice">This is a planning model, not professional financial advice.</div></div>
  </div>`;
}
function stat(label,val,note,cls=""){return `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value ${cls}">${money(val)}</div><div class="stat-note">${note}</div></div>`}
function allocation(name,val,total){const pct=total>0?Math.min(100,val/total*100):0;return `<div class="allocation"><div class="alloc-head"><span>${name}</span><strong>${money(val)}</strong></div><div class="progress"><span style="width:${pct}%"></span></div></div>`}
function renderIncome(){const k=monthKey(),m=ensureMonth(k);$("#page-income").innerHTML=pageTitle("Income","Set your take-home income for the selected month.","Save income",`<div class="card"><form id="incomeForm" class="form-grid"><label>Monthly income<input name="income" type="number" min="0" step="0.01" value="${m.income||""}" placeholder="0"></label><label class="full-col">Note<input name="note" value="${esc(m.note)}" placeholder="Pay cycle, overtime, tips, etc."></label><div class="full-col modal-actions"><button class="btn primary">Save income</button></div></form></div>`) }
function renderExpenses(){const k=monthKey(),e=ensureMonth(k).expenses;$("#page-expenses").innerHTML=pageTitle("Living costs","Your essential monthly survival expenses.","Save costs",`<div class="card"><form id="expenseForm" class="form-grid">${["rent","food","travel","phone","misc","other"].map(x=>`<label>${cap(x)}<input name="${x}" type="number" min="0" step="0.01" value="${e[x]||""}" placeholder="0"></label>`).join("")}<div class="full-col modal-actions"><button class="btn primary">Save living costs</button></div></form></div>`) }
function cap(x){return x[0].toUpperCase()+x.slice(1)}
function pageTitle(title,sub,btn,body){return `<div class="section-title"><div><h1>${title}</h1><p>${sub}</p></div><button class="btn primary" data-open="${btn==="Save income"?"income":btn==="Save costs"?"expenses":title.toLowerCase().includes("loan")?"loan":title.toLowerCase().includes("chit")?"chit":"debt"}">${btn}</button></div>${body}`}
function renderLoans(){
  const rows=state.loans.map(x=>`<div class="item"><div class="item-main"><strong>${esc(x.name)}</strong><span>${Number(x.rate||0)}% interest · ${money(x.emi)} EMI · 3× EMI = ${money(Number(x.emi||0)*3)}</span></div><div class="item-right"><strong>${money(loanBal(x))}</strong><span class="small muted">balance</span></div><div class="item-actions"><button class="mini-btn" data-pay-loan="${x.id}">Payment</button><button class="mini-btn" data-delete-loan="${x.id}">Delete</button></div></div>`).join("");
  $("#page-loans").innerHTML=pageTitle("Loans","Track outstanding balances, EMI and accelerated-payment capacity.","Add loan",`<div class="list">${rows||empty("No loans yet","Add a loan to start planning repayments.")}</div>`)
}
function renderChits(){const rows=state.chits.map(x=>`<div class="item"><div class="item-main"><strong>${esc(x.name)}</strong><span>${x.note?esc(x.note):"Monthly commitment"}</span></div><div class="item-right"><strong>${money(x.monthly)}</strong><span class="small muted">per month</span></div><div class="item-actions"><button class="mini-btn" data-delete-chit="${x.id}">Delete</button></div></div>`).join("");$("#page-chits").innerHTML=pageTitle("Chits","Keep chits separate from loans, but include their monthly commitment in planning.","Add chit",`<div class="list">${rows||empty("No chits yet","Add your monthly chit commitments here.")}</div>`)}
function renderDebts(){const rows=state.debts.map(x=>`<div class="item"><div class="item-main"><strong>${esc(x.name)}</strong><span>${esc(x.note||"Family / friend temporary debt")}</span></div><div class="item-right"><strong>${money(debtBal(x))}</strong><span class="small muted">remaining</span></div><div class="item-actions"><button class="mini-btn" data-pay-debt="${x.id}">Repay</button><button class="mini-btn" data-delete-debt="${x.id}">Delete</button></div></div>`).join("");$("#page-debts").innerHTML=pageTitle("Temporary debts","Small, manageable repayments rather than treating these like high-pressure loans.","Add debt",`<div class="list">${rows||empty("No temporary debts","Add money owed to family or friends.")}</div>`)}
function empty(a,b){return `<div class="empty"><strong>${a}</strong>${b}</div>`}
function renderActivity(){const rows=state.activity.map(x=>`<div class="history-row"><div class="muted">${new Date(x.created_at).toLocaleDateString()}</div><div>${esc(x.description)}</div><div style="text-align:right"><strong>${x.amount?money(x.amount):""}</strong></div></div>`).join("");$("#page-activity").innerHTML=`<div class="section-title"><div><h1>Activity</h1><p>Your recent updates and repayments.</p></div></div><div class="card tableish">${rows||empty("No activity yet","Your changes will appear here.")}</div>`}
function renderSettings(){$("#page-settings").innerHTML=`<div class="section-title"><div><h1>Settings</h1><p>Profile and account controls.</p></div></div><div class="card settings-box"><form id="settingsForm" class="form-grid"><label>Name<input name="name" value="${esc(state.profile.name)}"></label><label>Currency symbol<input name="currency" maxlength="4" value="${esc(state.profile.currency||"$")}"></label><label class="full-col">Account email<input value="${esc(currentUser?.email||state.profile.email)}" disabled></label><div class="full-col modal-actions"><button class="btn primary">Save settings</button></div></form><div class="security-box"><strong>Cloud account active</strong><p>Your records are linked to your signed-in account and protected by database row-level security when Supabase is configured.</p></div></div>`}
function openModal(type,id=null){
  let x=id?[...state.loans,...state.chits,...state.debts].find(a=>a.id===id):null, html="";
  if(type==="income"){$("#authLogin");return}
  if(type==="loan")html=`<h2>${x?"Edit":"Add"} loan</h2><form id="modalForm" data-type="loan" class="stack"><label>Loan name<input name="name" required value="${esc(x?.name||"")}"></label><label>Outstanding balance<input name="balance" type="number" min="0" required value="${x?.balance??""}"></label><label>Monthly EMI<input name="emi" type="number" min="0" required value="${x?.emi??""}"></label><label>Interest rate %<input name="rate" type="number" min="0" step=".01" value="${x?.rate??""}"></label><div class="modal-actions"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn primary">Save loan</button></div></form>`;
  if(type==="chit")html=`<h2>Add chit</h2><form id="modalForm" data-type="chit" class="stack"><label>Name<input name="name" required></label><label>Monthly contribution<input name="monthly" type="number" min="0" required></label><label>Note<input name="note" placeholder="Optional"></label><div class="modal-actions"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn primary">Save chit</button></div></form>`;
  if(type==="debt")html=`<h2>Add temporary debt</h2><form id="modalForm" data-type="debt" class="stack"><label>Person / description<input name="name" required placeholder="e.g. Mom"></label><label>Balance owed<input name="balance" type="number" min="0" required></label><label>Note<input name="note" placeholder="Small installments are okay"></label><div class="modal-actions"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn primary">Save debt</button></div></form>`;
  $("#modalBody").innerHTML=html;$("#modal").classList.remove("hidden");
}
function openPayment(kind,id){
  const x=(kind==="loan"?state.loans:state.debts).find(a=>a.id===id);const max=kind==="loan"?loanBal(x):debtBal(x);
  $("#modalBody").innerHTML=`<h2>${kind==="loan"?"Record loan payment":"Record temporary-debt repayment"}</h2><p class="muted small">Remaining before payment: ${money(max)}</p><form id="modalForm" data-type="${kind}-payment" data-id="${id}" class="stack"><label>Payment amount<input name="amount" type="number" min="0.01" max="${max}" step=".01" required></label><label>Note<input name="note" placeholder="Optional"></label><div class="modal-actions"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn primary">Record payment</button></div></form>`;$("#modal").classList.remove("hidden")
}
function closeModal(){$("#modal").classList.add("hidden")}
async function submitModal(form){
  const fd=new FormData(form),o=Object.fromEntries(fd.entries()),type=form.dataset.type;
  try{
    if(type==="loan"){await addRecord("loans",{name:o.name,balance:Number(o.balance),emi:Number(o.emi),rate:Number(o.rate||0)});await logActivity("loan",`Added loan: ${o.name}`,Number(o.balance))}
    if(type==="chit"){await addRecord("chits",{name:o.name,monthly:Number(o.monthly),note:o.note||""});await logActivity("chit",`Added chit: ${o.name}`,Number(o.monthly))}
    if(type==="debt"){await addRecord("temporary_debts",{name:o.name,balance:Number(o.balance),note:o.note||""});await logActivity("debt",`Added temporary debt: ${o.name}`,Number(o.balance))}
    if(type==="loan-payment"){const x=state.loans.find(a=>a.id===form.dataset.id),amt=Math.min(Number(o.amount),loanBal(x));await updateRecord("loans",x.id,{balance:loanBal(x)-amt});await logActivity("payment",`Loan payment: ${x.name}`,amt)}
    if(type==="debt-payment"){const x=state.debts.find(a=>a.id===form.dataset.id),amt=Math.min(Number(o.amount),debtBal(x));await updateRecord("temporary_debts",x.id,{balance:debtBal(x)-amt});await logActivity("repayment",`Temporary debt repayment: ${x.name}`,amt)}
    closeModal();renderAll();toast("Saved")
  }catch(e){toast(e.message||"Could not save",true)}
}

function setupEvents(){
  $("#monthSelect").addEventListener("change",renderAll);
  $("#loginForm").addEventListener("submit",async e=>{e.preventDefault();await signIn()});
  $("#signupForm").addEventListener("submit",async e=>{e.preventDefault();await signUp()});
  $("#showSignup").onclick=()=>{$("#authLogin").classList.add("hidden");$("#authSignup").classList.remove("hidden")};
  $("#showLogin").onclick=()=>{$("#authSignup").classList.add("hidden");$("#authLogin").classList.remove("hidden")};
  $("#logoutBtn").onclick=logout;
  $("#modalClose").onclick=closeModal;$(".modal-backdrop").onclick=closeModal;
  $("#quickAdd").onclick=()=>openModal("loan");
  $("#mobileMenu").onclick=()=>$("#sidebar").classList.toggle("open");
  document.addEventListener("click",async e=>{
    const nav=e.target.closest("[data-page]");if(nav){$$(".nav-item").forEach(x=>x.classList.remove("active"));nav.classList.add("active");$$(".page").forEach(x=>x.classList.remove("active"));$("#page-"+nav.dataset.page).classList.add("active");$("#pageTitle").textContent=nav.textContent.trim();$("#sidebar").classList.remove("open");return}
    const jump=e.target.closest("[data-page-jump]");if(jump){$(`[data-page="${jump.dataset.pageJump}"]`)?.click();return}
    const op=e.target.closest("[data-open]");if(op){const t=op.dataset.open;if(t==="income"){$(`[data-page="income"]`).click();return}if(t==="expenses"){$(`[data-page="expenses"]`).click();return}openModal(t);return}
    if(e.target.closest("[data-close]"))closeModal();
    if(e.target.closest("[data-pay-loan]"))openPayment("loan",e.target.closest("[data-pay-loan]").dataset.payLoan);
    if(e.target.closest("[data-pay-debt]"))openPayment("debt",e.target.closest("[data-pay-debt]").dataset.payDebt);
    const del=e.target.closest("[data-delete-loan],[data-delete-chit],[data-delete-debt]");
    if(del && confirm("Delete this item?")){try{if(del.dataset.deleteLoan)await deleteRecord("loans",del.dataset.deleteLoan,"loans");if(del.dataset.deleteChit)await deleteRecord("chits",del.dataset.deleteChit,"chits");if(del.dataset.deleteDebt)await deleteRecord("temporary_debts",del.dataset.deleteDebt,"debts");renderAll();toast("Deleted")}catch(err){toast(err.message,true)}}
  });
  document.addEventListener("submit",async e=>{
    if(e.target.id==="modalForm"){e.preventDefault();await submitModal(e.target)}
    if(e.target.id==="incomeForm"){e.preventDefault();const fd=new FormData(e.target),m=ensureMonth(monthKey());m.income=Number(fd.get("income")||0);m.note=fd.get("note")||"";try{await saveMonth();await logActivity("income",`Updated income for ${fmtMonth(monthKey())}`,m.income);renderAll();toast("Income saved")}catch(err){toast(err.message,true)}}
    if(e.target.id==="expenseForm"){e.preventDefault();const fd=new FormData(e.target),m=ensureMonth(monthKey());for(const x of ["rent","food","travel","phone","misc","other"])m.expenses[x]=Number(fd.get(x)||0);try{await saveMonth();await logActivity("expense",`Updated living costs for ${fmtMonth(monthKey())}`,living(monthKey()));renderAll();toast("Living costs saved")}catch(err){toast(err.message,true)}}
    if(e.target.id==="settingsForm"){e.preventDefault();const fd=new FormData(e.target);state.profile.name=fd.get("name")||"Friend";state.profile.currency=fd.get("currency")||"$";try{await saveProfile();renderAll();toast("Settings saved")}catch(err){toast(err.message,true)}}
  });
}
async function signIn(){
  if(!configured){$("#authError").textContent="Supabase is not configured. Add your project URL and anon key in script.js.";return}
  $("#authError").textContent="";
  const {data,error}=await sb.auth.signInWithPassword({email:$("#loginEmail").value,password:$("#loginPassword").value});
  if(error){$("#authError").textContent=error.message;return}
  currentUser=data.user;await enterApp()
}
async function signUp(){
  if(!configured){$("#signupError").textContent="Supabase is not configured. Add your project URL and anon key in script.js.";return}
  $("#signupError").textContent="";
  const {data,error}=await sb.auth.signUp({email:$("#signupEmail").value,password:$("#signupPassword").value,options:{data:{name:$("#signupName").value}}});
  if(error){$("#signupError").textContent=error.message;return}
  if(data.user){currentUser=data.user;await enterApp()}else $("#signupError").textContent="Check your email to confirm the account, then sign in."
}
async function enterApp(){
  $("#authScreen").classList.add("hidden");$("#app").classList.remove("hidden");
  try{await dbGet();renderAll()}catch(e){toast(e.message||"Could not load account",true)}
}
async function logout(){
  try{
    if(configured){const {error}=await sb.auth.signOut();if(error)throw error}
    currentUser=null;state={profile:{name:"Friend",email:"",currency:"$"},months:{},loans:[],chits:[],debts:[],activity:[]};
    $("#app").classList.add("hidden");$("#authScreen").classList.remove("hidden");$("#loginPassword").value="";
    toast("Signed out")
  }catch(e){toast(e.message||"Sign out failed",true)}
}
async function boot(){
  setupEvents();
  if(!configured){$("#authError").textContent="Setup needed: add your Supabase URL and anon key to script.js.";return}
  const {data}=await sb.auth.getSession();if(data.session){currentUser=data.session.user;await enterApp()}
  sb.auth.onAuthStateChange(async(_event,session)=>{if(session && !currentUser){currentUser=session.user;await enterApp()}});
}
boot();
