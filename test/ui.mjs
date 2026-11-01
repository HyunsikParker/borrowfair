import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const output=path.resolve(process.env.BORROWFAIR_TEST_OUTPUT||'artifacts');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.BORROWFAIR_BROWSER_CHANNEL||'chrome',args:['--window-size=1440,1200','--disable-gpu']});
const browserVersion=browser.version();
const results=[],base=process.env.BORROWFAIR_URL||'http://127.0.0.1:4193';
const ready=async(p,n=9)=>p.getByRole('heading',{name:`${n} of 11 borrowers fit`,exact:true}).waitFor();
async function run(name,fn){const c=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));try{await p.goto(base);await ready(p);await fn(p,c);assert.deepEqual(errs,[]);results.push({name,status:'passed'});console.log('PASS',name);}catch(e){results.push({name,status:'failed',error:e.stack});console.log('FAIL',name,e.message);await p.screenshot({path:path.join(output,`failure-${results.length}.png`),fullPage:true});}finally{await c.close();}}
await run('initial plan, return-day table, desktop and narrow layout',async p=>{
 assert.equal(await p.getByText('Search complete for this input',{exact:true}).count(),1);
 await p.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
 for(const width of [768,390,320]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at${width}`);}
 await p.setViewportSize({width:390,height:844});assert.equal(await p.locator('.brand').count(),1);await p.screenshot({path:path.join(output,'mobile.png'),fullPage:false});
 await p.getByRole('heading',{name:'9 of 11 borrowers fit',exact:true}).scrollIntoViewIfNeeded();await p.screenshot({path:path.join(output,'mobile-plan.png'),fullPage:false});
 await p.getByRole('button',{name:'How it works',exact:true}).click();await p.getByRole('heading',{name:'A planning aid for one lending round'}).waitFor();
});
await run('keep changes allocation; conflicting keeps stop the plan',async p=>{
 await p.getByRole('button',{name:'Keep R01',exact:true}).click();await ready(p,6);
 await p.getByRole('button',{name:'Keep R05',exact:true}).click();await p.getByRole('heading',{name:'Plan needs attention'}).waitFor();
 assert.equal(await p.getByRole('button',{name:'Export plan',exact:true}).count(),0);
 await p.getByRole('button',{name:'Release all keeps'}).click();await ready(p);
});
await run('extra-unit comparison is unapplied until explicit action',async p=>{
 await p.getByRole('button',{name:'Compare extra unit'}).click();await p.getByRole('heading',{name:'10 borrowers with 3 Tripod units'}).waitFor();
 assert.equal(await p.locator('#stock-summary').innerText(),'Camera\n1\nMicrophone\n1\nTripod\n2');
 await p.getByRole('button',{name:'Apply extra unit'}).click();await ready(p,10);
 assert.ok((await p.locator('#stock-summary').innerText()).endsWith('Tripod\n3'));
 await p.reload();await ready(p,10);
});
await run('request validation, edit, quantities and explicit removal',async p=>{
 await p.getByRole('button',{name:'Add request',exact:true}).click();
 await p.getByLabel('Borrower alias',{exact:true}).fill('Tess');await p.getByLabel('Purpose or project',{exact:true}).fill('A fictional new request');
 await p.getByLabel('Pickup date (included)',{exact:true}).fill('2026-11-10');await p.getByLabel('Return date (not occupied)',{exact:true}).fill('2026-11-10');
 await p.locator('input[name="need-tripod"]').fill('1');await p.getByRole('button',{name:'Save changes',exact:true}).click();
 assert.ok((await p.locator('#edit-error').innerText()).includes('return must follow'));
 await p.getByLabel('Return date (not occupied)',{exact:true}).fill('2026-11-12');await p.getByRole('button',{name:'Save changes',exact:true}).click();
 await p.locator('#editor').waitFor({state:'hidden'});await p.getByRole('button',{name:'Requests & equipment'}).click();
 await p.getByRole('button',{name:'Edit R13',exact:true}).click();assert.equal(await p.getByLabel('Borrower alias',{exact:true}).inputValue(),'Tess');await p.getByRole('button',{name:'Cancel',exact:true}).click();
 p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'Remove R13',exact:true}).click();await p.getByRole('button',{name:'Edit R13',exact:true}).waitFor({state:'hidden'});
});
await run('export round trip and malformed import preserve workspace',async p=>{
 const dl=p.waitForEvent('download');await p.getByRole('button',{name:'Export workspace',exact:true}).click();const d=await dl,content=await fs.readFile(await d.path(),'utf8');const parsed=JSON.parse(content);assert.equal(parsed.requests.length,12);
 await p.getByRole('button',{name:'Workspace options',exact:true}).click();await p.getByLabel('Restore a workspace backup').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
 await p.locator('#import-preview').getByText(/Current workspace unchanged/).waitFor();
 parsed.title='Restored lending round';await p.getByLabel('Restore a workspace backup').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(parsed))});
 await p.locator('#import-preview').getByRole('heading',{name:'Restored lending round'}).waitFor();assert.equal(await p.getByRole('heading',{name:'Film club lending week',exact:true}).count(),1);p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'Replace current workspace',exact:true}).click();
 await p.getByRole('heading',{name:'Restored lending round',exact:true}).waitFor();await ready(p);
});
await run('keyboard dialog closes and returns focus; editing controls are labeled',async p=>{
 await p.getByRole('button',{name:'Add request',exact:true}).focus();await p.keyboard.press('Enter');await p.locator('#editor').waitFor({state:'visible'});
 await p.keyboard.press('Escape');assert.equal(await p.getByRole('button',{name:'Add request',exact:true}).evaluate(e=>e===document.activeElement),true);
 await p.getByRole('button',{name:'Requests & equipment'}).click();assert.equal(await p.getByRole('spinbutton',{name:'Camera available units'}).count(),1);
});
await run('another tab cannot silently replace a stale workspace',async(p,c)=>{
 const second=await c.newPage();await second.goto(base);await ready(second);
 await p.getByRole('button',{name:'Keep R01',exact:true}).click();await ready(p,6);await second.getByRole('button',{name:'Reload saved workspace'}).waitFor();
 await second.getByRole('button',{name:'Keep R02',exact:true}).click();assert.deepEqual(await second.evaluate(()=>JSON.parse(localStorage.getItem('borrowfair.workspace.v1')).pins),['R01']);
 await second.getByRole('button',{name:'Reload saved workspace'}).click();await ready(second,6);
});
await run('zero available units produce a valid reduced plan and clear conflict reasons',async p=>{
 await p.getByRole('button',{name:'Requests & equipment'}).click();await p.getByRole('spinbutton',{name:'Camera available units'}).fill('0');await p.locator('[data-stock="camera"]').getByRole('button',{name:'Save',exact:true}).click();
 await p.getByRole('button',{name:'Allocation plan'}).click();await ready(p,5);const row=p.locator('.loan-row').filter({has:p.getByRole('button',{name:'Keep R02',exact:true})});await row.getByRole('button',{name:'Why not selected?'}).click();assert.ok((await row.innerText()).includes('insufficient units'));
});
await run('storage write failure keeps an exportable unsaved draft',async p=>{
 await p.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError');};});
 await p.getByRole('button',{name:'Keep R01',exact:true}).click();await ready(p,6);assert.equal(await p.locator('#save-state').innerText(),'Not saved');assert.ok((await p.locator('#storage-notice').innerText()).includes('current draft'));
 const dl=p.waitForEvent('download');await p.getByRole('button',{name:'Export workspace',exact:true}).click();assert.deepEqual(JSON.parse(await fs.readFile(await(await dl).path(),'utf8')).pins,['R01']);
});
// A separate context tests unreadable saved bytes before the app loads.
{
 const c=await browser.newContext(),p=await c.newPage();
 try{await p.goto(base);await ready(p);await p.evaluate(()=>localStorage.setItem('borrowfair.workspace.v1','{bad original'));await p.reload();await p.getByRole('button',{name:'Download unreadable data'}).waitFor();assert.equal(await p.evaluate(()=>localStorage.getItem('borrowfair.workspace.v1')),'{bad original');await p.getByRole('button',{name:'Workspace options',exact:true}).click();p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'Start a blank workspace',exact:true}).click();await p.getByRole('button',{name:'Download unreadable data'}).waitFor({state:'hidden'});await p.getByRole('heading',{name:'New lending round',exact:true}).waitFor();assert.equal(JSON.parse(await p.evaluate(()=>localStorage.getItem('borrowfair.workspace.v1'))).requests.length,0);results.push({name:'unreadable storage preserved until explicit replacement',status:'passed'});console.log('PASS unreadable storage');}catch(e){results.push({name:'unreadable storage',status:'failed',error:e.stack});}finally{await c.close();}
}
await browser.close();
await fs.writeFile(path.join(output,'ui-results.json'),JSON.stringify({at:new Date().toISOString(),browser:'Google Chrome through Playwright',browserVersion,results},null,2));
if(results.some(r=>r.status!=='passed'))process.exitCode=1;
