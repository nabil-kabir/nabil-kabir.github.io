// Injected by tests before the page loads.
(function(){
const isDel=x=>x&&typeof x==='object'&&x.__del===1;
const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x)&&!isDel(x);
function apply(t,p){for(const k of Object.keys(p)){const v=p[k];if(isDel(v))delete t[k];else if(isObj(v)){if(!isObj(t[k]))t[k]={};apply(t[k],v);}else t[k]=v;}return t;}
const S='http://127.0.0.1:8790';
window.__lockinTest={
  config:{apiKey:'demo-key',authDomain:'127.0.0.1',projectId:'demo-lockin',appId:'1:1:web:1'},
  authEmulator:'http://127.0.0.1:9099',
  dataBackend(uid){
    const QK='fakeq-'+uid; let q=[]; try{q=JSON.parse(localStorage.getItem(QK)||'[]');}catch(e){}
    let srv=null, connected=false, onData=null, onState=null, flushing=false, es=null;
    const saveQ=()=>localStorage.setItem(QK,JSON.stringify(q));
    const view=()=>{const v=JSON.parse(JSON.stringify(srv||{meta:null,months:{}}));q.forEach(ops=>ops.forEach(o=>{if(o.doc==='meta'){v.meta=v.meta||{};apply(v.meta,o.data);}else{v.months[o.ym]=v.months[o.ym]||{};apply(v.months[o.ym],o.data);}}));return v;};
    const emit=()=>{const off=!connected||!navigator.onLine;onState&&onState({pending:q.length>0,offline:off});if(!off&&onData){const v=view();onData({meta:v.meta||{},months:v.months});}};
    async function flush(){if(flushing||!q.length||!navigator.onLine)return;flushing=true;
      try{while(q.length){const r=await fetch(S+'/w?uid='+uid,{method:'POST',body:JSON.stringify(q[0])});if(!r.ok)throw 0;q.shift();saveQ();}}catch(e){}
      flushing=false;emit();}
    addEventListener('online',()=>{flush();});
    setInterval(flush,1000);
    return{
      async fetch(){const r=await fetch(S+'/dump?uid='+uid);return r.json();},
      write(ops){q.push(JSON.parse(JSON.stringify(ops)));saveQ();emit();flush();return Promise.resolve();},
      listen(d,s){onData=d;onState=s;
        const open=()=>{es=new EventSource(S+'/s?uid='+uid);es.onmessage=e=>{if(!navigator.onLine)return;srv=JSON.parse(e.data);connected=true;emit();};es.onerror=()=>{connected=false;emit();};};
        open(); addEventListener('offline',()=>{connected=false;emit();}); addEventListener('online',()=>{if(es)es.close();open();});
        flush(); return()=>{if(es)es.close();onData=null;onState=null;};}
    };
  }
};
})();
