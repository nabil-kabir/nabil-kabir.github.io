import {toCloud,fromCloud,diff,applyPatch,docOps,mergeDeep,sameCloud,DEL} from './src/core.js';
import assert from 'node:assert/strict';
const J=o=>JSON.parse(JSON.stringify(o));
const st={habits:[{id:'h1',name:'Push day',goal:9,subs:[{id:'h1x1',name:'Bench'},{id:'h1x2',name:'Dips'}]},{id:'h2',name:'Steps',goal:25,subs:[]}],
 months:{'2026-10':{h1:[3,1,3],h1x1:[1],h2:[]},'2026-09':{}},trash:[{tid:'ta',kind:'sub',item:{id:'h1x9',name:'Curl'},parentId:'h1',parentName:'Push day',index:2,removedAt:'2026-10-01T00:00:00Z'}]};
const c=toCloud(st);
const back=fromCloud(c);
assert.deepEqual(back.habits,st.habits);
assert.deepEqual(back.months,{'2026-10':{h1:[1,3],h1x1:[1]}});
assert.equal(back.trash.length,1);
assert.ok(sameCloud(toCloud(back),c));
// server doc store simulation
function server(){const docs={meta:{},months:{}};return{docs,write(ops){ops.forEach(o=>{if(o.doc==='meta')applyPatch(docs.meta,J2(o.data));else{docs.months[o.ym]=docs.months[o.ym]||{};applyPatch(docs.months[o.ym],J2(o.data));}});}};}
const J2=o=>o; // keep DEL sentinel identity
const S=server(); S.write(docOps(null,c));
assert.ok(sameCloud(toCloud(fromCloud(S.docs)),c));
// device A ticks h2 day 5, device B unticks h1 day 1 and renames h2, concurrently from same base
const base=J(S.docs);
const A=fromCloud(base); A.months['2026-10'].h2=[5];
const B=fromCloud(base); B.months['2026-10'].h1=[3]; B.habits[1].name='10k steps';
S.write(docOps(base,toCloud(A))); S.write(docOps(base,toCloud(B)));
const R=fromCloud(S.docs);
assert.deepEqual(R.months['2026-10'],{h1:[3],h1x1:[1],h2:[5]});
assert.equal(R.habits[1].name,'10k steps');
// remove habit h2 on A
const base2=J(S.docs); const A2=fromCloud(base2); const h=A2.habits.splice(1,1)[0]; A2.trash.unshift({tid:'tb',kind:'habit',item:h,index:1,removedAt:'2026-10-15T00:00:00Z'});
S.write(docOps(base2,toCloud(A2)));
const R2=fromCloud(S.docs); assert.equal(R2.habits.length,1); assert.equal(R2.trash[0].tid,'tb');
// unticking every box in a month clears the month
const base3=J(S.docs); const A3=fromCloud(base3); A3.months['2026-10']={};
const ops=docOps(base3,toCloud(A3)); assert.equal(ops.length,1); S.write(ops);
assert.deepEqual(fromCloud(S.docs).months,{});
// merge guest data into account: union
const acct=toCloud({habits:[{id:'h1',name:'Push day',goal:9,subs:[]}],months:{'2026-10':{h1:[1]}},trash:[]});
const guest=toCloud({habits:[{id:'h1',name:'Push day',goal:9,subs:[]},{id:'hz',name:'Read',goal:10,subs:[]}],months:{'2026-10':{h1:[2]},'2026-08':{hz:[4]}},trash:[]});
const M=fromCloud(mergeDeep(acct,guest));
assert.deepEqual(M.months,{'2026-10':{h1:[1,2]},'2026-08':{hz:[4]}}); assert.equal(M.habits.length,2);
// trash entry for an item that is live again is hidden
const dup=toCloud({habits:[{id:'h1',name:'P',goal:1,subs:[]}],months:{},trash:[{tid:'tc',kind:'habit',item:{id:'h1',name:'P',subs:[]},index:0,removedAt:'x'}]});
assert.equal(fromCloud(dup).trash.length,0);
console.log('core tests passed');
