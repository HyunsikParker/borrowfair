import test from 'node:test';
import assert from 'node:assert/strict';
import { solve, validateBoard, verifyPlan, explain, dayNumber, dailyUsage } from '../src/engine.js';
import { exampleBoard, blankBoard } from '../src/example.js';
test('fictional example serves 9 borrowers versus 6 first-come, with valid plans',()=>{
 const b=exampleBoard(),r=solve(b);assert.equal(r.selected.length,9);assert.equal(r.firstCome.length,6);assert.equal(r.complete,true);assert.deepEqual(verifyPlan(b,r.selected),[]);assert.deepEqual(verifyPlan(b,r.firstCome),[]);
});
test('one extra tripod serves Ian; comparison does not mutate original input',()=>{
 const b=exampleBoard(),c=structuredClone(b);c.resources[2].units++;const r=solve(c);assert.equal(r.selected.length,10);assert.ok(r.selected.includes('R11'));assert.equal(b.resources[2].units,2);
});
test('one extra camera cannot solve a microphone conflict in the bundled request',()=>{
 const b=exampleBoard();b.resources[0].units++;assert.equal(solve(b).selected.length,9);
});
test('pinning the long loan changes the result, and duplicate-borrower pins fail visibly',()=>{
 const b=exampleBoard();b.pins=['R01'];const r=solve(b);assert.ok(r.selected.includes('R01'));assert.equal(r.selected.length,6);b.pins.push('R05');assert.equal(solve(b).status,'conflict');
});
test('zero-stock pin conflicts never silently drop a keep',()=>{
 const b=exampleBoard();b.resources[0].units=0;b.pins=['R02'];assert.equal(solve(b).status,'conflict');
});
test('return boundary can be reused, and quantities are counted for bundles',()=>{
 const b=exampleBoard();b.requests=b.requests.filter(r=>['R02','R03','R04'].includes(r.id));assert.equal(solve(b).selected.length,3);b.requests[1].needs.camera=2;assert.equal(solve(b).selected.length,2);assert.ok(explain(b,solve(b),'R03')[0].includes('insufficient'));
});
test('a bounded result remains valid and does not claim completed search',()=>{
 const b=exampleBoard(),r=solve(b,{maxNodes:1});assert.equal(r.complete,false);assert.equal(r.nodes,1);assert.deepEqual(verifyPlan(b,r.selected),[]);
});
test('calendar dates, duplicate IDs, aliases, quantities and window limits validate',()=>{
 assert.ok(Number.isNaN(dayNumber('2026-02-30')));assert.ok(Number.isFinite(dayNumber('2028-02-29')));
 for(const mutate of [b=>b.requests[0].end=b.requests[0].start,b=>b.requests[1].id='R01',b=>b.requests[0].needs.camera=1.5,b=>b.requests[0].end='2026-12-30',b=>b.requests[4].previousLoans=99,b=>b.pins=['unknown'],b=>b.resources[0].units=-1]){const b=exampleBoard();mutate(b);assert.ok(validateBoard(b).length);assert.equal(solve(b).status,'invalid');}
});
test('empty round is valid; capacity chart reports actual selected usage',()=>{
 assert.equal(solve(blankBoard()).selected.length,0);const b=exampleBoard(),r=solve(b),u=dailyUsage(b,r.selected);assert.equal(u.dates.length,7);for(const row of u.rows)assert.ok(row.usage.every(n=>n<=row.units));assert.equal(u.rows[0].usage[6],1);
});
test('request order does not change complete-search result',()=>{
 const b=exampleBoard(),expected=solve(b).selected;b.requests.reverse();assert.deepEqual(solve(b).selected,expected);
});
// Separate exhaustive oracle: enumerate subsets; count occupancy directly, without solver helpers.
function oracle(b){
 let best=null,bestScore=null;
 for(let mask=0;mask<2**b.requests.length;mask++){
  const rows=b.requests.filter((_,i)=>mask&(2**i)),ids=rows.map(r=>r.id).sort();
  if(b.pins.some(id=>!ids.includes(id)))continue;
  if(new Set(rows.map(r=>r.borrower.toLowerCase())).size!==rows.length)continue;
  let feasible=true;
  for(const type of b.resources)for(let d=1;d<=12;d++){
   const used=rows.filter(r=>Number(r.start.slice(-2))<=d&&Number(r.end.slice(-2))>d).reduce((s,r)=>s+(r.needs[type.id]||0),0);
   if(used>type.units)feasible=false;
  }
  if(!feasible)continue;
  const score=[rows.length,-rows.reduce((s,r)=>s+r.previousLoans,0),-rows.reduce((s,r)=>s+Number(r.received.slice(-2)),0)];
  const better=best===null||score[0]>bestScore[0]||score[0]===bestScore[0]&&(score[1]>bestScore[1]||score[1]===bestScore[1]&&(score[2]>bestScore[2]||score[2]===bestScore[2]&&ids.join('|')<best.join('|')));
  if(better){best=ids;bestScore=score;}
 }
 return best;
}
test('400 deterministic random small rounds match an independent exhaustive oracle',()=>{
 let seed=20261101;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let c=0;c<400;c++){
  const b=blankBoard();b.resources=[{id:'a',name:'Camera',units:rand(3)},{id:'b',name:'Sound',units:rand(3)}];
  const counts=Array.from({length:6},()=>rand(4)),count=4+rand(5);
  for(let i=0;i<count;i++){const person=rand(6),s=3+rand(5),end=s+1+rand(3),needs=rand(2)?{a:1+rand(2)}:{b:1+rand(2)};if(rand(4)===0){needs.a=1;needs.b=1;}b.requests.push({id:`R${i}`,borrower:`person${person}`,purpose:'Oracle fixture',start:`2026-11-${String(s).padStart(2,'0')}`,end:`2026-11-${String(end).padStart(2,'0')}`,received:`2026-11-0${1+rand(2)}`,previousLoans:counts[person],needs});}
  if(rand(3)===0)b.pins=[b.requests[rand(count)].id];
  const expected=oracle(b),actual=solve(b);
  if(expected===null)assert.equal(actual.status,'conflict',`case${c}`);else {assert.equal(actual.complete,true,`case${c}`);assert.deepEqual(actual.selected,expected,`case${c}`);}
 }
});
