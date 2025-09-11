#!/usr/bin/env node
const https = require('https');
const NAME = process.argv[2] || 'RAG Framework App v1';
const TOKEN = process.argv[3];
if (!TOKEN) { console.error('Usage: node get-project-id.js <PROJECT_NAME> <LINEAR_API_TOKEN>'); process.exit(1);} 

function q(query, variables={}){
  return new Promise((resolve,reject)=>{
    const data = JSON.stringify({query, variables});
    const req = https.request({hostname:'api.linear.app', path:'/graphql', method:'POST', headers:{'Content-Type':'application/json','Authorization':`${TOKEN}`,'Content-Length':data.length}}, res=>{
      let body=''; res.on('data',c=>body+=c); res.on('end',()=>{ try{ const r=JSON.parse(body||'{}'); if(r.errors){reject(new Error(JSON.stringify(r.errors)));} else {resolve(r.data);} } catch(e){ reject(e);} });
    });
    req.on('error',reject); req.write(data); req.end();
  });
}

(async()=>{
  const data = await q(`query { projects(first: 50) { nodes { id name url } } }`);
  const nodes = data && data.projects && data.projects.nodes || [];
  const match = nodes.find(p=>p.name === NAME);
  if (!match) { console.error('Not found'); process.exit(2);} 
  console.log(JSON.stringify(match,null,2));
})();

