export function createReadCache(fetcher,clock=Date.now){
 const saved=new Map(),pending=new Map(),generation=new Map();
 async function read(path,{force=false,maxAge=15000}={}){
  if(pending.has(path))return pending.get(path);
  const old=saved.get(path);if(!force&&old&&clock()-old.at<maxAge)return old.value;
  const revision=generation.get(path)||0;
  const request=Promise.resolve().then(()=>fetcher(path)).then(value=>{if(revision===(generation.get(path)||0))saved.set(path,{value,at:clock()});return value;}).finally(()=>{if(pending.get(path)===request)pending.delete(path);});
  pending.set(path,request);return request;
 }
 read.invalidate=path=>{saved.delete(path);pending.delete(path);generation.set(path,(generation.get(path)||0)+1);};
 return read;
}
