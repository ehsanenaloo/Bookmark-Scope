/* Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License. */
import { STORAGE_KEYS, OPTIONAL_HOST_PATTERNS } from '../constants.js';
import { containsPermissions } from '../platform/browser-api.js';
import { getLocalStorage, setLocalStorage, withStorageLock } from './storage-service.js';
import { getHealthCacheGeneration, writeHealthRecord } from './health-cache-service.js';
import { shouldSkipHealthCheck } from '../background/health-check.js';
import { urlIdentity } from './maintenance-preview-service.js';

export async function loadScanJob() {
  const job=(await getLocalStorage([STORAGE_KEYS.HEALTH_SCAN_JOB]))[STORAGE_KEYS.HEALTH_SCAN_JOB];
  if(!job)return null;
  if(job.version!==1 || !Array.isArray(job.targets) || !Array.isArray(job.completed) || !['ready','running','paused','canceled','completed'].includes(job.status))throw new Error('Invalid scan job.');
  return job;
}
export function scanCoverage(job) {
  const total=job?.targets?.length||0;const completed=new Set(job?.completed||[]).size;
  return {total,completed,remaining:Math.max(0,total-completed),status:job?.status||'none'};
}
async function mutateJob(id,mutate) {
  return withStorageLock(async()=>{
    const job=await loadScanJob();if(job?.id!==id)throw new Error('Scan job changed.');
    await mutate(job);await setLocalStorage({[STORAGE_KEYS.HEALTH_SCAN_JOB]:job});return job;
  });
}
export function buildScanTargets(bookmarks,options={}) {
    return [...new Map(bookmarks.filter(row=>!shouldSkipHealthCheck(row.url)).map(row=>{
      let valid=false;try{valid=['http:','https:'].includes(new URL(row.url).protocol);}catch{}
      return valid?[urlIdentity(row.url,options),{key:urlIdentity(row.url,options),url:row.url}]:['',null];
    }).filter(([,row])=>row)).values()];
}
export async function createScanJob(bookmarks,options={}) {
  return navigator.locks.request('bookmark-scope-manual-scan',{ifAvailable:true},async lock=>{
    if(!lock)throw new Error('A scan is already running.');
    const targets=buildScanTargets(bookmarks,options);
    if(!targets.length || targets.length>50000)throw new Error('Scan needs between 1 and 50,000 supported URLs.');
    const job={version:1,id:crypto.randomUUID(),createdAt:Date.now(),status:'ready',targets,completed:[],outcomes:{}};
    await withStorageLock(()=>setLocalStorage({[STORAGE_KEYS.HEALTH_SCAN_JOB]:job}));return job;
  });
}
export async function controlScanJob(id,status) {
  if(!['paused','canceled'].includes(status))throw new Error('Invalid scan control.');
  return mutateJob(id,job=>{if(job.status==='completed' || job.status==='canceled')return;job.status=status;});
}
export async function runScanJob(id,{fetchHealth,onProgress=()=>{},shouldStop=()=>false}={}) {
  if(typeof fetchHealth!=='function')throw new Error('Scan requires a health request function.');
  return navigator.locks.request('bookmark-scope-manual-scan',{ifAvailable:true},async lock=>{
    if(!lock)throw new Error('A scan is already running.');
    let job=await loadScanJob();if(job?.id!==id || job.status==='canceled')throw new Error('Scan is unavailable or canceled.');
    if(job.status==='completed')return job;
    if(!await containsPermissions({origins:[...OPTIONAL_HOST_PATTERNS]}))throw new Error('Health scan permission is required.');
    const generation=await getHealthCacheGeneration();
    job=await mutateJob(id,current=>{if(current.status==='canceled')throw new Error('Scan was canceled.');current.status='running';});
    try{
      for(const target of job.targets){
        job=await loadScanJob();
        if(job.id!==id)throw new Error('Scan job changed.');
        if(job.status!=='running' || shouldStop())break;
        if(job.completed.includes(target.key))continue;
        const record=await fetchHealth(target.url);
        const current=await loadScanJob();
        if(current.id!==id || current.status!=='running' || shouldStop())break;
        if(!record || record.aborted) {await controlScanJob(id,'paused');break;}
        if(!await writeHealthRecord(target.key,record,generation)){await controlScanJob(id,'paused');break;}
        job=await mutateJob(id,latest=>{
          if(latest.status!=='running')return;
          if(!latest.completed.includes(target.key))latest.completed.push(target.key);
          latest.outcomes[target.key]=record.status;
          if(latest.completed.length===latest.targets.length)latest.status='completed';
        });await onProgress(job);
      }
    }finally{
      job=await loadScanJob();
      if(job?.id===id && job.status==='running')job=await controlScanJob(id,'paused');
    }return job;
  });
}
