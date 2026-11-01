import { validateBoard, dailyUsage, explain, dateString, dayNumber, borrowerKey } from './engine.js';
import { exampleBoard, blankBoard } from './example.js';
const $ = s => document.querySelector(s);
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const clone = b => structuredClone(b);
const KEY = 'borrowfair.workspace.v1';
let board = exampleBoard(), baseRaw = null, blocked = false, invalidRaw = null, savingError = '', activeView = 'plan';
let result = null, worker, scenarioWorker, generation = 0, comparison = null, editorAction = null, pendingImport = null;
const shortDate = s => new Date(s + 'T00:00:00Z').toLocaleDateString('en', { month:'short', day:'numeric', timeZone:'UTC' });
const dateRange = r => `${shortDate(r.start)} → ${shortDate(r.end)}`;
const kit = r => Object.entries(r.needs).map(([id,n]) => `${n} ${board.resources.find(x => x.id === id)?.name || id}`).join(' + ');
const errorText = e => e instanceof Error ? e.message : String(e);
try { baseRaw = localStorage.getItem(KEY); if (baseRaw) { const saved = JSON.parse(baseRaw); const errors = validateBoard(saved); if (errors.length) throw new Error(errors.join(' ')); board = saved; } } catch (e) { if (baseRaw !== null) { invalidRaw = baseRaw; board = blankBoard(); blocked = true; } savingError = `Saved workspace could not be read: ${errorText(e)}`; }
function download(name, data, type='application/json') {
  const url = URL.createObjectURL(new Blob([typeof data === 'string' ? data : JSON.stringify(data,null,2)], { type }));
  const a = document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function storageNotice() {
  const box = $('#storage-notice'); box.hidden = !blocked && !savingError;
  if (box.hidden) return;
  box.replaceChildren();
  const p=document.createElement('p');p.textContent=invalidRaw !== null ? 'The saved file is unreadable. It has not been replaced. Download it before starting again or restore a valid backup.' : blocked ? 'This workspace changed in another tab. Your visible draft has not been overwritten. Export it or reload the saved workspace before editing.' : `${savingError} Your current draft is still on screen. Export a backup before leaving.`;box.append(p);
  if (invalidRaw !== null) { const b=document.createElement('button');b.textContent='Download unreadable data';b.onclick=()=>download('borrowfair-unreadable.txt',invalidRaw,'text/plain');box.append(b); }
  if (blocked && invalidRaw === null) { const b=document.createElement('button');b.textContent='Reload saved workspace';b.onclick=()=>location.reload();box.append(b); }
  const b=document.createElement('button');b.textContent='Open recovery options';b.onclick=()=>$('#options').showModal();box.append(b);
}
async function commit(next, { replace = false }={}) {
  const errors=validateBoard(next); if(errors.length) { alert(errors.join('\n')); return false; }
  const work=()=>{
    if(blocked&&!replace) { storageNotice(); $('#storage-notice').scrollIntoView({block:'center'}); return false; }
    let raw; try { raw=localStorage.getItem(KEY); } catch { raw=baseRaw; }
    if(!replace && raw!==baseRaw) { blocked=true;storageNotice();return false; }
    board=next; savingError='';
    try { const encoded=JSON.stringify(board);localStorage.setItem(KEY,encoded);baseRaw=encoded;blocked=false;invalidRaw=null;$('#save-state').textContent='Saved on this device'; }
    catch { savingError='Browser storage is unavailable.';$('#save-state').textContent='Not saved'; if(replace){blocked=false;invalidRaw=null;} }
    render(); startPlan(); return true;
  };
  return navigator.locks ? navigator.locks.request('borrowfair.workspace.write',work) : work();
}
window.addEventListener('storage',e=>{if((e.key===KEY||e.key===null)&&e.newValue!==baseRaw){blocked=true;storageNotice();}});
function setView(name) { activeView=name; for(const n of ['plan','inputs','guide']) $(`#view-${n}`).hidden=n!==name; document.querySelectorAll('[data-view]').forEach(b=>{if(b.dataset.view===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}); }
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('#policy-link').onclick=e=>{e.preventDefault();setView('guide');$('#policy-detail').focus();};
$('#edit-stock').onclick=()=>setView('inputs');
$('#export-workspace').onclick=()=>download('borrowfair-workspace.json',board);
$('#open-options').onclick=()=>$('#options').showModal();
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
function field(label,name,value,type='text',extra='') { return `<label class="field">${esc(label)}<input name="${esc(name)}" type="${type}" value="${esc(value)}" ${extra}></label>`; }
function openEditor(title,fields,action) { $('#editor-title').textContent=title;$('#editor-fields').innerHTML=fields;$('#edit-error').textContent='';editorAction=action;$('#editor').showModal(); }
$('#edit-form').onsubmit=async e=>{e.preventDefault();try{const next=editorAction(new FormData(e.currentTarget));const errors=validateBoard(next);if(errors.length){$('#edit-error').textContent=errors.join(' ');return;}if(await commit(next))$('#editor').close();}catch(err){$('#edit-error').textContent=errorText(err);}};
function requestEditor(id) {
  if(!board.resources.length){setView('inputs');$('#add-equipment').focus();return;}
  const today=new Date().toISOString().slice(0,10), start=board.requests[0]?.start||today;
  const r=board.requests.find(r=>r.id===id)||{id:'',borrower:'',purpose:'',start,end:dateString(dayNumber(start)+1),received:today<start?today:start,previousLoans:0,needs:{}};
  openEditor(id?`Edit ${id}`:'Add request',`${field('Borrower alias','borrower',r.borrower,'text','required maxlength="50" autocomplete="off"')}${field('Purpose or project','purpose',r.purpose,'text','required maxlength="120"')}<div class="field-grid">${field('Pickup date (included)','start',r.start,'date','required')}${field('Return date (not occupied)','end',r.end,'date','required')}</div><div class="field-grid">${field('Request received','received',r.received,'date','required')}${field('Previous loans','previousLoans',r.previousLoans,'number','required min="0" max="1000" step="1"')}</div><p><small>Previous loans applies to all requests using this alias. Multiple requests are alternatives; only one can be selected.</small></p><fieldset><legend>Equipment needed together</legend><div class="need-grid">${board.resources.map(t=>field(t.name,`need-${t.id}`,r.needs[t.id]||0,'number','required min="0" max="20" step="1"')).join('')}</div><small>Enter 0 for equipment not needed.</small></fieldset>`,f=>{
    const next=clone(board);let newId=id;
    if(!newId){let i=1;while(next.requests.some(x=>x.id===`R${String(i).padStart(2,'0')}`))i++;newId=`R${String(i).padStart(2,'0')}`;}
    const req={id:newId,borrower:f.get('borrower').trim(),purpose:f.get('purpose').trim(),start:f.get('start'),end:f.get('end'),received:f.get('received'),previousLoans:Number(f.get('previousLoans')),needs:Object.fromEntries(next.resources.map(t=>[t.id,Number(f.get(`need-${t.id}`))]).filter(([,n])=>n!==0))};
    next.requests=next.requests.filter(x=>x.id!==newId);next.requests.push(req);for(const x of next.requests)if(borrowerKey(x)===borrowerKey(req))x.previousLoans=req.previousLoans;
    return next;
  });
}
$('#add-request').onclick=()=>requestEditor();
$('#add-equipment').onclick=()=>openEditor('Add equipment',field('Equipment name','name','','text','required maxlength="60"')+field('Available units','units',1,'number','required min="0" max="20" step="1"'),f=>{const n=clone(board);let i=1;while(n.resources.some(x=>x.id===`item${i}`))i++;n.resources.push({id:`item${i}`,name:f.get('name').trim(),units:Number(f.get('units'))});return n;});
$('#rename-workspace').onclick=()=>{$('#options').close();openEditor('Rename workspace',field('Workspace name','title',board.title,'text','required maxlength="90"'),f=>({...clone(board),title:f.get('title').trim()}));};
async function replaceBoard(next,message) { if(confirm(message)){if(await commit(next,{replace:true})){$('#options').close();setView('plan');}} }
$('#load-example').onclick=()=>replaceBoard(exampleBoard(),'Replace the current workspace with the fictional example? Export your current work first if needed.');
$('#start-blank').onclick=()=>replaceBoard(blankBoard(),'Replace the current workspace with a blank round? Export your current work first if needed.');
$('#import-file').onchange=async e=>{pendingImport=null;const box=$('#import-preview');box.replaceChildren();const f=e.target.files[0];if(!f)return;try{if(f.size>128000)throw new Error('Workspace files must be no larger than 128 KB.');const parsed=JSON.parse(await f.text());const errors=validateBoard(parsed);if(errors.length)throw new Error(errors.join(' '));pendingImport=parsed;box.className='import-box';box.innerHTML=`<h3>${esc(parsed.title)}</h3><p>${parsed.requests.length} requests, ${parsed.resources.length} equipment types. No changes have been made.</p><button id="confirm-import">Replace current workspace</button>`;$('#confirm-import').onclick=()=>replaceBoard(clone(pendingImport),'Replace this workspace with the previewed file? Current work will be replaced.');}catch(err){box.className='form-error';box.setAttribute('role','alert');box.textContent=`Cannot restore: ${errorText(err)} Current workspace unchanged.`;}};
function render() {
  $('#round-title').textContent=board.title;$('#mode-label').textContent=board.mode==='example'?'Fictional example · edit it to explore':'Your lending round';
  if(!savingError)$('#save-state').textContent=baseRaw?'Saved on this device':'Example not yet saved';
  $('#stock-summary').innerHTML=board.resources.length?board.resources.map(r=>`<div class="stock-row"><span>${esc(r.name)}</span><strong>${r.units}</strong></div>`).join(''):'<p>No equipment yet.</p>';
  $('#inventory-editor').innerHTML=board.resources.map(r=>`<form class="inventory-form" data-stock="${r.id}"><label>${esc(r.name)}<input name="name" aria-label="${esc(r.name)} name" value="${esc(r.name)}" required maxlength="60"></label><label>Available units<input name="units" aria-label="${esc(r.name)} available units" type="number" min="0" max="20" step="1" value="${r.units}" required></label><button type="submit">Save</button><button type="button" data-remove-type="${r.id}" class="danger-button">Remove</button></form>`).join('')||'<p class="empty">Add your first equipment type, then enter requests.</p>';
  $('#requests-editor').innerHTML=board.requests.length?`<div class="loan-list">${board.requests.map(r=>`<article class="loan-row"><div><h3>${esc(r.borrower)}<small>${esc(r.id)} · ${esc(r.purpose)}</small></h3><p class="loan-meta">${esc(kit(r))} · ${dateRange(r)}</p><p>Received ${esc(r.received)} · ${r.previousLoans} previous loans</p></div><div class="loan-actions"><button data-edit-request="${r.id}" aria-label="Edit ${r.id}">Edit</button><button data-remove-request="${r.id}" aria-label="Remove ${r.id}" class="danger-button">Remove</button></div></article>`).join('')}</div>`:'<p class="empty">No requests yet. Add equipment, then choose Add request.</p>';
  document.querySelectorAll('[data-stock]').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form),n=clone(board),r=n.resources.find(x=>x.id===form.dataset.stock);r.name=f.get('name').trim();r.units=Number(f.get('units'));await commit(n);});
  document.querySelectorAll('[data-remove-type]').forEach(b=>b.onclick=async()=>{const id=b.dataset.removeType;if(board.requests.some(r=>r.needs[id])){alert('This equipment is used by a request. Edit or remove those requests first.');return;}const n=clone(board);n.resources=n.resources.filter(r=>r.id!==id);await commit(n);});
  document.querySelectorAll('[data-edit-request]').forEach(b=>b.onclick=()=>requestEditor(b.dataset.editRequest));
  document.querySelectorAll('[data-remove-request]').forEach(b=>b.onclick=async()=>{const id=b.dataset.removeRequest;if(!confirm(`Remove request ${id}?`))return;const n=clone(board);n.requests=n.requests.filter(r=>r.id!==id);n.pins=n.pins.filter(p=>p!==id);await commit(n);});
  storageNotice();setView(activeView);
}
function startPlan() {
  worker?.terminate();scenarioWorker?.terminate();comparison=null;result=null;generation++;const id=generation;
  $('#plan-output').replaceChildren();$('#plan-state').textContent='Comparing requests…';
  worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  worker.onerror=()=>{if(id!==generation)return;$('#plan-state').textContent='The planner could not run. Reload the page; your workspace can still be exported.';worker.terminate();};
  worker.onmessage=e=>{if(e.data.id!==generation)return;result=e.data.result;worker.terminate();renderPlan();};
  worker.postMessage({id,board});
}
function loanRow(r, selected) {
  const kept=board.pins.includes(r.id);
  return `<article class="loan-row ${kept?'kept':''}"><div><h3>${esc(r.borrower)}<small>${esc(r.id)} · ${esc(r.purpose)}</small></h3><p class="loan-meta">${esc(kit(r))} · ${dateRange(r)}</p><p>${r.previousLoans} previous loans${kept?' · Kept by you':''}</p></div><div class="loan-actions"><button data-reason="${r.id}" aria-expanded="false" aria-controls="reason-${r.id}">Why ${selected?'selected':'not selected'}?</button><button data-keep="${r.id}" aria-label="${kept?'Release keep for':'Keep'} ${r.id}">${kept?'Release keep':'Keep'}</button></div><div class="reason" id="reason-${r.id}" hidden><ul>${explain(board,result,r.id).map(s=>`<li>${esc(s)}</li>`).join('')}</ul></div></article>`;
}
function renderPlan() {
  $('#plan-state').textContent='';const out=$('#plan-output');
  if(result.status!=='ready'){out.innerHTML=`<div class="notice danger"><h2>Plan needs attention</h2>${result.errors.map(s=>`<p>${esc(s)}</p>`).join('')}${board.pins.length?'<button id="release-all">Release all keeps</button>':''}</div>`;$('#release-all')?.addEventListener('click',()=>commit({...clone(board),pins:[]}));return;}
  if(!board.requests.length){out.innerHTML='<div class="empty"><h2>Start with your equipment</h2><p>Add equipment types and available units, then enter a few loan requests.</p><button id="empty-add">Add equipment</button></div>';$('#empty-add').onclick=()=>$('#add-equipment').click();return;}
  const usage=dailyUsage(board,result.selected),chosen=board.requests.filter(r=>result.selected.includes(r.id)).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id)),waiting=board.requests.filter(r=>!result.selected.includes(r.id));
  out.innerHTML=`<div class="result-summary"><div><h2>${chosen.length} of ${new Set(board.requests.map(borrowerKey)).size} borrowers fit</h2><p>First-come comparison: ${result.firstCome.length} borrowers with the same equipment and keeps.</p><span class="status-chip ${result.complete?'':'limited'}">${result.complete?'Search complete for this input':'Best plan found so far · optimality not proven'}</span></div><button id="export-plan">Export plan</button></div><div class="capacity-wrap" tabindex="0" role="region" aria-label="Daily equipment use; scroll horizontally if needed"><table class="capacity"><caption>Equipment in use each day</caption><thead><tr><th scope="col">Equipment</th>${usage.dates.map(d=>`<th scope="col">${shortDate(d)}</th>`).join('')}</tr></thead><tbody>${usage.rows.map(r=>`<tr><th scope="row">${esc(r.name)}</th>${r.usage.map((v,i)=>`<td class="${r.units===0?'zero':v===r.units?'full':v?'some':''}" title="${esc(r.name)} on ${usage.dates[i]}: ${v} of ${r.units} units">${v}/${r.units}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="table-note">Used / available units. A return date is free for another pickup.</p><div class="section-heading"><h2>Selected requests (${chosen.length})</h2></div><div class="loan-list">${chosen.map(r=>loanRow(r,true)).join('')||'<p>No request fits the current constraints.</p>'}</div><div class="section-heading"><h2>Not selected (${waiting.length})</h2></div><div class="loan-list">${waiting.map(r=>loanRow(r,false)).join('')||'<p>All requests are selected.</p>'}</div><section class="scenario" aria-label="Extra equipment comparison"><h2>Would one extra unit help?</h2><p>Compare the same requests with one more unit. Your current inventory stays unchanged.</p><div class="scenario-controls"><label>Equipment type<select id="scenario-type">${board.resources.map(r=>`<option value="${r.id}" ${r.id==='tripod'?'selected':''}>${esc(r.name)} (${r.units} available)</option>`).join('')}</select></label><button id="compare-extra">Compare extra unit</button></div><div id="scenario-output" role="status" aria-live="polite"></div></section>`;
  $('#export-plan').onclick=()=>download('borrowfair-draft-plan.json',{kind:'BorrowFair draft allocation, not a reservation',exportedAt:new Date().toISOString(),workspace:board,rule:'Maximize borrowers, then minimize total previous loans, then prefer earlier request dates; one request per borrower; keeps mandatory.',result,decisions:board.requests.map(r=>({id:r.id,borrower:r.borrower,selected:result.selected.includes(r.id),reasons:explain(board,result,r.id)}))});
  out.querySelectorAll('[data-reason]').forEach(b=>b.onclick=()=>{const box=$(`#reason-${b.dataset.reason}`);box.hidden=!box.hidden;b.setAttribute('aria-expanded',String(!box.hidden));});
  out.querySelectorAll('[data-keep]').forEach(b=>b.onclick=()=>{const n=clone(board),id=b.dataset.keep;n.pins=n.pins.includes(id)?n.pins.filter(x=>x!==id):[...n.pins,id];return commit(n);});
  $('#compare-extra').onclick=compareExtra;
  $('#scenario-type').onchange=()=>{scenarioWorker?.terminate();comparison=null;$('#scenario-output').textContent='';$('#compare-extra').disabled=false;};
}
function compareExtra() {
  const id=$('#scenario-type').value,stock=board.resources.find(r=>r.id===id),area=$('#scenario-output');
  if(stock.units>=20){area.textContent='The prototype supports at most 20 units per equipment type.';return;}
  const candidate=clone(board);candidate.resources.find(r=>r.id===id).units++;
  const currentGeneration=generation;scenarioWorker?.terminate();$('#compare-extra').disabled=true;area.textContent='Comparing the extra unit…';
  scenarioWorker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  scenarioWorker.onerror=()=>{area.textContent='Comparison could not run. Your inventory is unchanged.';$('#compare-extra').disabled=false;scenarioWorker.terminate();};
  scenarioWorker.onmessage=e=>{if(currentGeneration!==generation)return;scenarioWorker.terminate();$('#compare-extra').disabled=false;const other=e.data.result;
    if(other.status!=='ready'){area.textContent=other.errors.join(' ');return;}
    comparison={candidate,result:other};const before=new Set(board.requests.filter(r=>result.selected.includes(r.id)).map(borrowerKey)),after=new Set(board.requests.filter(r=>other.selected.includes(r.id)).map(borrowerKey));
    const names=keys=>[...keys].map(k=>board.requests.find(r=>borrowerKey(r)===k).borrower).join(', ')||'None';
    const added=new Set([...after].filter(k=>!before.has(k))),lost=new Set([...before].filter(k=>!after.has(k)));
    area.innerHTML=`<div class="scenario-result"><h3>${after.size} borrowers with ${stock.units+1} ${esc(stock.name)} units</h3><p>${after.size-before.size>=0?'+':''}${after.size-before.size} borrowers compared with this plan. ${other.complete?'Extra-unit search complete.':'Extra-unit search reached its limit; improvement beyond this result is unproven.'}</p><p><strong>Added:</strong> ${esc(names(added))}<br><strong>Displaced:</strong> ${esc(names(lost))}</p><p>No inventory changes saved.</p><button id="apply-extra" class="primary">Apply extra unit</button></div>`;
    $('#apply-extra').onclick=()=>commit(comparison.candidate);
  };
  scenarioWorker.postMessage({id:currentGeneration,board:candidate});
}
render();startPlan();
