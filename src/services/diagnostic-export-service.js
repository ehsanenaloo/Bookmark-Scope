/* Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License. */
import { getDiagnosticEvents, awaitPendingDiagnosticWrites } from './diagnostics-service.js';
import { getManifest } from '../platform/browser-api.js';

const SCOPES=new Set(['background','dashboard','popup','options','app']);
const EVENTS=new Set(['init_started','init_completed','init_failed','import_succeeded','import_failed','import_warning','restore_completed','tags_load_failed','tags_pruned_orphans','mode_updated','sidebar_toggled','preference_updated','bg_health_scan_fetch_failed','bg_health_scan_notification_failed','bg_health_scan_skipped_no_permission']);
const METRICS=new Set(['count','failed','merged','skipped','notAttempted','scanned','broken','newBroken','removed','total','completed','needsReload','tagsTouched','collapsed']);
export function redactDiagnosticEvents(entries) {
  return (entries||[]).map(entry=>{
    const metrics={};for(const [key,value] of Object.entries(entry?.details||{}))if(METRICS.has(key) && (typeof value==='boolean' || typeof value==='number' && Number.isFinite(value)))metrics[key]=value;
    return {ts:typeof entry?.ts==='string' && !Number.isNaN(Date.parse(entry.ts))?new Date(entry.ts).toISOString():null,scope:SCOPES.has(entry?.scope)?entry.scope:'other',event:EVENTS.has(entry?.event)?entry.event:'other',level:['debug','info','warn','error'].includes(entry?.level)?entry.level:'info',metrics};
  });
}
export async function createDiagnosticExport() {
  await awaitPendingDiagnosticWrites();
  return {format:'bookmark-scope-diagnostics',version:1,extensionVersion:getManifest().version,createdAt:new Date().toISOString(),redaction:'allowlisted-fields-only',events:redactDiagnosticEvents(await getDiagnosticEvents())};
}
