import http from 'node:http';
const secret=process.env.AUTO_APPLY_WORKER_SECRET;
const port=Number(process.env.PORT||8788);
http.createServer(async(req,res)=>{
  if(req.method!=='POST'||req.url!=='/tasks/start'){res.writeHead(404).end(JSON.stringify({error:'Not found'}));return;}
  if(req.headers.authorization!==`Bearer ${secret}`){res.writeHead(401).end(JSON.stringify({error:'Unauthorized'}));return;}
  let body='';for await(const chunk of req)body+=chunk;
  const task=JSON.parse(body);
  // Production implementation: call Skyvern task API here, pass task.application.job_url,
  // task.profile, task.resume, and task.instructions. Pause before final submit.
  res.writeHead(501,{'content-type':'application/json'}).end(JSON.stringify({error:'Connect this adapter to Skyvern before enabling live automation.'}));
}).listen(port,()=>console.log(`CarrerNaviq worker adapter listening on ${port}`));
