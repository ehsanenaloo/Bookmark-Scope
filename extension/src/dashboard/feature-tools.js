/* Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License. */
import { featureText as l } from '../locales/feature-messages.js';
import { createSnapshot, validateSnapshot, restoreSnapshot, loadRestoreJournal } from '../services/snapshot-service.js';
import { applySmartView, loadSmartViews, saveSmartView, deleteSmartView } from '../services/smart-view-service.js';
import { applyTagPreview, buildTagPreview, buildDuplicatePreview, prepareDuplicateMerge, writableFolders, flattenLiveTree } from '../services/maintenance-preview-service.js';
import { loadTagsMap } from '../services/tag-service.js';
import { buildImportPreview, importBookmarks } from '../services/import-service.js';
import { createDiagnosticExport } from '../services/diagnostic-export-service.js';
import { createScanJob, loadScanJob, controlScanJob, runScanJob, scanCoverage, buildScanTargets } from '../services/scan-job-service.js';
import { getBookmarkTree } from '../platform/browser-api.js';
import { runtimeMessages } from '../runtime/messages.js';

export function createFeatureTools({state,create,trapFocus,t,setToast,downloadTextFile,refreshData,render,savePreferences,recalculateVisibleBookmarks,getSelectedBookmarks,handleDeleteMany,ensureHealthPermission,inspectUrlHealth,sendMessage,commands,logger}) {
  let dialog=null;
  let stopScan=false;
  let runningJob=null;
  let lastTagUndo=[];
  const options=()=>({ignoreQueryString:state.ignoreQueryString,ignoreHashFragment:state.ignoreHashFragment});
  const targetRows=()=>getSelectedBookmarks().length?getSelectedBookmarks():state.visibleBookmarks;
  const scopeText=rows=>l(getSelectedBookmarks().length?'Selected bookmarks':'Visible bookmarks (current filters)')+': '+rows.length;
  function resultText(label,values){return l(label)+': '+values.join(' / ');}
  async function refresh(){state.tagsByBookmark=await loadTagsMap();await refreshData();render();}
  function closeDialog(){
    if(!dialog)return;
    const {overlay,release,previous,onClose}=dialog;dialog=null;
    release();overlay.remove();onClose?.();
    if(previous?.isConnected)previous.focus();else document.querySelector('input[type="search"]')?.focus();
  }
  function openDialog(title,build,onClose){
    closeDialog();
    const previous=document.activeElement;
    const overlay=create('div','modal-overlay feature-overlay');
    const modal=create('section','modal-card feature-dialog');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',l(title));modal.tabIndex=-1;
    const head=create('div','feature-dialog-head');head.append(create('h2','',l(title)));
    const close=create('button','ghost-button',t('Close'));close.type='button';close.addEventListener('click',closeDialog);head.append(close);
    const body=create('div','feature-dialog-body');const status=create('div','helper-text feature-status');status.setAttribute('role','status');
    modal.append(head,body,status);overlay.append(modal);document.body.append(overlay);
    const report=error=>{status.textContent=error?.message||String(error);status.classList.add('error');};
    function button(label,handler,parent=body,{enabled=()=>true,primary=false}={}){
      const btn=create('button',primary?'primary-button':'ghost-button',l(label));btn.type='button';btn.dataset.featureAction=label;
      let busy=false;
      btn.updateAvailability=()=>{btn.disabled=busy || Boolean(btn.dataset.applied) || !enabled();};
      btn.addEventListener('click',async()=>{
        if(btn.disabled)return;
        const hadFocus=document.activeElement===btn;busy=true;btn.setAttribute('aria-busy','true');btn.updateAvailability();
        if(hadFocus)modal.focus();
        status.textContent='';status.classList.remove('error');
        try{await handler();}catch(error){report(error);}finally{
          busy=false;btn.removeAttribute('aria-busy');btn.updateAvailability();
          if(hadFocus && btn.isConnected && !btn.disabled && document.activeElement===modal)btn.focus();
        }
      });parent.append(btn);btn.updateAvailability();return btn;
    }
    function field(label,node){const wrapper=create('label','feature-field');node.setAttribute('aria-label',l(label));wrapper.append(create('span','',l(label)),node);body.append(wrapper);return node;}
    function select(label,values){const node=create('select','select');for(const [value,text] of values){const option=create('option','',l(text));option.value=value;node.append(option);}field(label,node);return node;}
    build({body,status,button,field,select,report});
    const release=trapFocus(modal);dialog={overlay,release,previous,onClose};
    overlay.addEventListener('click',event=>{if(event.target===overlay)closeDialog();});
    overlay.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();closeDialog();}});
    return dialog;
  }
  function technicalDetails(parent,value){const details=create('details','feature-details');details.append(create('summary','',l('Technical details')));const content=create('pre','feature-preview');content.textContent=JSON.stringify(value,null,2);details.append(content);parent.append(details);}
  function previewRows(parent,rows,describe){
    const list=create('ul','feature-preview-list');
    for(const row of rows.slice(0,200)){const item=create('li','feature-preview-row');item.append(create('strong','',row.title||row.url||t('(Untitled bookmark)')));if(row.url)item.append(create('div','',row.url));if(row.path)item.append(create('div','helper-text',row.path));describe?.(item,row);list.append(item);}
    parent.append(list);if(rows.length>200)parent.append(create('p','helper-text',l('Showing the first 200 items. Counts include all items.')));
  }
  function operationResults(parent,items){
    const labels={completed:'Created',created:'Created; metadata pending',merged:'Tags merged',skipped:'Skipped match',failed:'Failed',pending:'Not attempted',excluded:'Excluded: unsupported URL', 'rolled-back':'Creation removed after metadata failure','metadata-failed':'Created; metadata failed','journal-failed':'Created; journal failed'};
    const results=create('section','feature-operation-results');results.append(create('h3','',l('Results')));
    previewRows(results,items,(item,row)=>{item.append(create('div','helper-text',l(labels[row.status]||'Failed')));if(row.error)item.append(create('div','error',row.error));});parent.append(results);
  }
  function snapshotTree(parent,nodes,excluded){
    let remaining=200;
    function visit(parent,items){const list=create('ul','feature-snapshot-tree');parent.append(list);for(const node of items){if(remaining--<=0)break;const item=create('li');list.append(item);if(node.type==='folder'){const folder=create('details');folder.append(create('summary','',node.title||l('Untitled folder')));item.append(folder);visit(folder,node.children);}else{item.append(create('strong','',node.title||node.url),create('div','',node.url));if(excluded.has(node.sourceId))item.append(create('span','helper-text',l('Excluded: unsupported URL')));if(node.tags.length)item.append(create('div','helper-text',l('Tags')+': '+node.tags.join(', ')));}}}visit(parent,nodes);
    if(remaining<0)parent.append(create('p','helper-text',l('Showing the first 200 items. Counts include all items.')));
  }
  async function destinations(select){const folders=await writableFolders();for(const folder of folders){const option=create('option','',folder.title);option.value=folder.id;select.append(option);}if(!folders.length)throw new Error('No writable destination folders.');}
  function pickFile(handler){const input=create('input');input.type='file';input.accept='.json';input.addEventListener('change',async()=>{try{const file=input.files?.[0];if(!file)return;if(file.size>10*1024*1024)throw new Error('File exceeds 10 MiB.');await handler(JSON.parse(await file.text()));}catch(error){setToast(error.message,{error:true});}finally{input.remove();}});input.hidden=true;document.body.append(input);input.click();}
  async function exportSnapshot(){const snapshot=await createSnapshot();downloadTextFile('bookmark-scope-snapshot.json',JSON.stringify(snapshot,null,2),'application/json');}
  function pickSnapshot(){pickFile(showSnapshotRestore);}
  async function showSnapshotRestore(snapshot){
    const preview=validateSnapshot(snapshot);
    const sourceNodes=new Map();const visit=nodes=>{for(const node of nodes){sourceNodes.set(node.sourceId,node);if(node.children)visit(node.children);}};visit(snapshot.roots);
    openDialog('Restore snapshot',({body,status,button,select,report})=>{
      body.append(create('p','',l('Restore adds a new folder. Original IDs and dates cannot be restored.')));
      body.append(create('p','',resultText('Folders / bookmarks / excluded',[preview.folders,preview.bookmarks,preview.excluded.length])));
      const destination=select('Destination',[]);
      snapshotTree(body,snapshot.roots,new Set(preview.excluded));technicalDetails(body,snapshot);
      body.append(create('p','helper-text',l('Snapshots and recovery journals contain bookmark URLs, titles and tags. Review them before sharing.')));
      const apply=button('Restore into new folder',async()=>{
        const result=await restoreSnapshot(snapshot,destination.value);
        status.textContent=resultText('Created / excluded / failed / remaining',[result.created,result.excluded,result.failed,result.notAttempted])+(result.storageError?' '+result.storageError:'');
        status.classList.toggle('error',Boolean(result.failed || result.storageError));
        logger?.info('restore_completed',{count:result.created,failed:result.failed,notAttempted:result.notAttempted});
        apply.dataset.applied='true';apply.disabled=true;
        const attempted=new Set(result.operation.items.map(item=>item.sourceId));
        operationResults(body,[...result.operation.items.map(item=>({...sourceNodes.get(item.sourceId),...item})),...[...sourceNodes.values()].filter(node=>!attempted.has(node.sourceId)).map(node=>({...node,status:preview.excluded.includes(node.sourceId)?'excluded':'pending'}))]);await refresh();
        if(result.failed || result.storageError)body.append(create('p','helper-text',l('Inspect the recovery journal and current bookmarks before retrying. Retrying may create additional copies.')));
      },body,{primary:true,enabled:()=>Boolean(destination.value)});
      destination.addEventListener('change',()=>apply.updateAvailability());destinations(destination).then(()=>apply.updateAvailability()).catch(report);
      button('Recovery journal',async()=>downloadTextFile('bookmark-scope-restore-journal.json',JSON.stringify(await loadRestoreJournal(),null,2),'application/json'));
    });
  }
  async function showDuplicatePreview(){
    const tags=await loadTagsMap();const groups=buildDuplicatePreview(state.visibleBookmarks,tags,options(),state.mergeStrategy);
    if(!groups.length){setToast(t('No duplicate groups in this view. The merge cannon has no target.'),{error:true});return;}
    openDialog('Duplicate preview',({body,button})=>{
      body.append(create('p','',l('Visible bookmarks (current filters)')+': '+state.visibleBookmarks.length));
      const removalCount=groups.reduce((count,group)=>count+group.rows.length-1,0);
      body.append(create('p','',l('Duplicate groups')+': '+groups.length+' · '+l('Bookmarks to remove')+': '+removalCount));
      body.append(create('p','',l('Choose the survivor. Deleted entries can be undone; merged survivor tags remain.')));
      for(const [index,group] of groups.entries()){
        const section=create('fieldset','feature-group');section.append(create('legend','',group.key));
        for(const row of group.rows){const label=create('label','feature-survivor');const radio=create('input');radio.type='radio';radio.name='survivor-'+index;radio.value=row.id;radio.checked=row.id===group.survivorId;
          radio.addEventListener('change',()=>{group.survivorId=row.id;});label.append(radio,create('span','',`${row.title}\n${row.url}\n${row.path||''}\n${row.dateAdded?new Date(row.dateAdded).toISOString():''}\n${row.tags.join(', ')}`));section.append(label);}
        section.append(create('div','helper-text',l('Merge tags')+': '+[...new Set(group.rows.flatMap(row=>row.tags))].join(', ')));body.append(section);
      }
      button('Merge and remove duplicates',async()=>{const prepared=await prepareDuplicateMerge(groups,options());state.tagsByBookmark=prepared.map;closeDialog();await handleDeleteMany(prepared.toDelete,{skipConfirm:true,expectedNodes:new Map(prepared.toDelete.map(row=>[row.id,row]))});},body,{primary:true});
    });
  }
  async function showSavedViews(){
    let views=await loadSmartViews();
    openDialog('Saved views',({body,status,button,field,select})=>{
      const choice=select('Saved views',[['', 'New view'],...views.map(view=>[view.id,view.name])]);
      const name=field('View name',create('input','input'));name.maxLength=80;
      const selected=()=>views.some(view=>view.id===choice.value);
      const updateButtons=()=>{save.updateAvailability();open.updateAvailability();remove.updateAvailability();};
      choice.addEventListener('change',()=>{name.value=views.find(view=>view.id===choice.value)?.name||'';updateButtons();});
      name.addEventListener('input',updateButtons);
      function populate(id){choice.replaceChildren();for(const [value,text] of [['',l('New view')],...views.map(view=>[view.id,view.name])]){const option=create('option','',text);option.value=value;choice.append(option);}choice.value=id;name.value=views.find(view=>view.id===id)?.name||'';updateButtons();}
      const save=button('Save view',async()=>{const saved=await saveSmartView({...state,id:choice.value||undefined,name:name.value});const index=views.findIndex(view=>view.id===saved.id);if(index<0)views.push(saved);else views[index]=saved;populate(saved.id);status.textContent=l('View saved')+': '+saved.name;},body,{primary:true,enabled:()=>Boolean(name.value.trim())});
      const open=button('Open view',async()=>{const view=views.find(view=>view.id===choice.value);applySmartView(view,state);await savePreferences();recalculateVisibleBookmarks();closeDialog();render();},body,{enabled:selected});
      const remove=button('Delete view',async()=>{await deleteSmartView(choice.value);views=await loadSmartViews();populate('');status.textContent=l('View deleted');},body,{enabled:selected});
      updateButtons();
    });
  }
  function showBulkTags(){
    openDialog('Bulk tags',({body,status,button,field,select})=>{
      const targets=[...targetRows()];body.append(create('p','',scopeText(targets)));
      const operation=select('Bulk tags',[['add','Add tag'],['remove','Remove tag'],['rename','Rename tag'],['merge','Merge tag']]);
      const source=field('Source tag',create('input','input')),target=field('Target tag',create('input','input'));
      const previewNode=create('div','feature-tag-preview');body.append(previewNode);let preview=null;
      function updateFields(){source.parentElement.hidden=operation.value==='add';target.parentElement.hidden=operation.value==='remove';const sourceLabel=operation.value==='remove'?'Tag to remove':'Source tag';const targetLabel=operation.value==='add'?'Tag to add':'Target tag';source.parentElement.firstChild.textContent=l(sourceLabel);target.parentElement.firstChild.textContent=l(targetLabel);source.setAttribute('aria-label',l(sourceLabel));target.setAttribute('aria-label',l(targetLabel));}
      function invalidate(){preview=null;previewNode.replaceChildren();updateFields();apply.updateAvailability();}
      for(const input of [operation,source,target])input.addEventListener('input',invalidate);
      operation.addEventListener('change',invalidate);
      button('Preview',async()=>{preview=buildTagPreview(targets,await loadTagsMap(),{operation:operation.value,source:source.value,target:target.value});previewNode.replaceChildren();previewNode.append(create('p','',l('Bookmarks to change')+': '+preview.length));const rows=preview.map(item=>({...targets.find(row=>row.id===item.id),...item}));previewRows(previewNode,rows,(item,row)=>{item.append(create('div','',l('Before')+': '+(row.before.join(', ')||l('No tags'))),create('div','',l('After')+': '+(row.after.join(', ')||l('No tags'))));});technicalDetails(previewNode,preview);apply.updateAvailability();},body,{enabled:()=>targets.length>0});
      const apply=button('Apply tag changes',async()=>{
        const result=await applyTagPreview(preview);if(result.applied.length)lastTagUndo=result.applied;preview=null;previewNode.replaceChildren();
        status.textContent=resultText('Changed / missing / conflicting',[result.changed,result.missing,result.conflicting]);
        try{await refresh();}finally{undo.updateAvailability();}
      },body,{primary:true,enabled:()=>Boolean(preview?.length)});
      const undo=button('Undo tag changes',async()=>{const result=await undoBulkTags(false);status.textContent=resultText('Changed / missing / conflicting',[result.changed,result.missing,result.conflicting]);status.classList.toggle('error',result.conflicting>0 || result.missing>0);},body,{enabled:()=>lastTagUndo.length>0});
      updateFields();
    });
  }
  async function undoBulkTags(notify=true){const result=await applyTagPreview(lastTagUndo,{undo:true});lastTagUndo=lastTagUndo.filter(item=>!result.applied.includes(item));await refresh();if(notify)setToast(resultText('Changed / missing / conflicting',[result.changed,result.missing,result.conflicting]),{error:result.conflicting>0,persist:lastTagUndo.length>0,actionLabel:lastTagUndo.length?t('Undo'):'',action:lastTagUndo.length?()=>undoBulkTags():null});return result;}
  async function showImportPreview(items,warnings=[],parserExcluded=0){
    const preview=buildImportPreview(items,flattenLiveTree(await getBookmarkTree()),options());
    openDialog('Import bookmarks…',({body,status,button,select,report})=>{
      body.append(create('p','',l('Imports are flat; folder paths and original dates are descriptive.')));
      body.append(create('p','',l('Supported bookmarks in this file')+': '+preview.rows.length));
      body.append(create('p','',resultText('Matches / repeated / excluded',[preview.matches,preview.repeated,preview.excluded+parserExcluded])));
      const destination=select('Destination',[]);
      const policy=select('Duplicate policy',[['skip','Skip matches'],['keep','Keep all'],['merge','Merge tags']]);
      for(const warning of warnings)body.append(create('p','helper-text',String(warning?.message||warning)));
      if(preview.excludedRows.length){body.append(create('h3','',l('Excluded items')));previewRows(body,preview.excludedRows,(item)=>item.append(create('div','helper-text',l('Excluded: unsupported URL'))));}
      const content=create('div');body.append(content);
      const updatePreview=()=>{content.replaceChildren();previewRows(content,preview.rows,(item,row)=>{const match=row.existingId || row.repeated;const action=match && policy.value==='skip'?'Will skip match':match && policy.value==='merge'?'Will merge tags':'Will create bookmark';item.append(create('div','helper-text',l(action)));if(row.tags.length)item.append(create('div','helper-text',l('Tags')+': '+row.tags.join(', ')));});};
      policy.addEventListener('change',updatePreview);updatePreview();technicalDetails(body,{warnings,items:preview.rows});
      body.append(create('p','helper-text',l('The preview uses current matches. Import rechecks the library before applying.')));
      const apply=button('Import bookmarks',async()=>{
        const result=await importBookmarks(preview.rows,destination.value,{policy:policy.value,parseOptions:options(),validateDestination:true});
        status.textContent=resultText('Created / merged / skipped / failed / remaining',[result.created,result.merged,result.skipped,result.failed,result.notAttempted])+(result.storageFailure?' '+result.storageFailure:'');
        status.classList.toggle('error',Boolean(result.failed || result.storageFailure));
        logger?.info('import_succeeded',{count:result.created,merged:result.merged,skipped:result.skipped,failed:result.failed,notAttempted:result.notAttempted});
        apply.dataset.applied='true';apply.disabled=true;operationResults(body,[...result.operation.items,...preview.rows.slice(result.operation.items.length).map(item=>({...item,status:'pending'}))]);
        // Applied item IDs are downloadable even if a journal write failed.
        button('Recovery journal',()=>downloadTextFile('bookmark-scope-import-recovery.json',JSON.stringify(result.operation,null,2),'application/json'));
        if(result.failed || result.storageFailure)body.append(create('p','helper-text',l('Inspect the recovery journal and current bookmarks before retrying. Retrying may create additional copies.')));
        await refresh();
      },body,{primary:true,enabled:()=>Boolean(preview.rows.length && destination.value)});
      destination.addEventListener('change',()=>apply.updateAvailability());destinations(destination).then(()=>apply.updateAvailability()).catch(report);
      body.append(create('p','helper-text',l('Snapshots and recovery journals contain bookmark URLs, titles and tags. Review them before sharing.')));
    });
  }
  async function showDiagnostics(){
    const payload=await createDiagnosticExport();
    openDialog('Diagnostic export',({body,button})=>{
      body.append(create('p','',l('Only allowlisted diagnostic fields are included. Review this file before sharing.')));
      body.append(create('p','helper-text',l('Includes event types, timestamps and numeric counts. Excludes bookmark URLs, titles, IDs, tags and error text.')));
      const content=create('pre','feature-preview');content.textContent=JSON.stringify(payload,null,2);body.append(content);
      button('Download',()=>downloadTextFile('bookmark-scope-diagnostics.json',JSON.stringify(payload,null,2),'application/json'));
    });
  }
  async function pauseScan(status='paused'){
    stopScan=true;
    const job=runningJob||await loadScanJob();if(job)await controlScanJob(job.id,status);
    for(const id of state.inspectControllers)await sendMessage(runtimeMessages.abortUrlHealth(id));
  }
  async function showScan(){
    let job=await loadScanJob();
    let open=true;
    const targets=[...targetRows()];const eligible=buildScanTargets(targets,options());
    openDialog('Resumable scan',({body,status,button})=>{
      body.append(create('p','',scopeText(targets)));
      body.append(create('p','',l('Unique supported URLs to check')+': '+eligible.length));
      body.append(create('p','',l('A paused scan can be resumed after reopening the dashboard.')));
      body.append(create('p','helper-text',l('Closing this dialog pauses the scan. Reopen Resumable scan to continue.')));
      const progress=create('div','feature-scan-progress');progress.setAttribute('aria-live','polite');body.append(progress);
      const labels={none:'No saved scan',ready:'Ready to start',running:'Scanning',paused:'Paused',canceled:'Canceled',completed:'Completed'};
      let controls=[];
      const unavailable=()=>state.isInspectingHealth || state.inspectLaunchPending || state.resumableScanRunning;
      const unfinished=()=>job && !['completed','canceled'].includes(job.status);
      const update=current=>{job=current;const values=scanCoverage(current);progress.textContent=resultText('Completed / total / remaining',[values.completed,values.total,values.remaining])+' · '+l(labels[values.status]);for(const control of controls)control.updateAvailability();};update(job);
      const execute=async()=>{
        if(state.isInspectingHealth || state.inspectLaunchPending || state.resumableScanRunning)throw new Error('An inspection is already running.');
        if(!await ensureHealthPermission())throw new Error('Health scan permission denied.');
        if(!open){await controlScanJob(job.id,'paused');return;}
        stopScan=false;runningJob=job;state.resumableScanRunning=true;
        update(job);
        try{job=await runScanJob(job.id,{fetchHealth:inspectUrlHealth,onProgress:update,shouldStop:()=>stopScan});update(job);await refresh();}
        finally{runningJob=null;state.resumableScanRunning=false;job=await loadScanJob();update(job);}
      };
      const acknowledge=create('input');acknowledge.type='checkbox';const label=create('label','feature-field');label.append(acknowledge,create('span','',l('Starting a new scan replaces the previous progress.')));body.append(label);
      const start=button('Start new scan',async()=>{if(!await ensureHealthPermission())throw new Error('Health scan permission denied.');if(!open)return;job=await createScanJob(targets,options());update(job);await execute();},body,{primary:true,enabled:()=>!unavailable() && eligible.length>0 && eligible.length<=50000 && (!unfinished() || acknowledge.checked)});
      const resume=button('Resume scan',execute,body,{enabled:()=>!unavailable() && Boolean(job && ['ready','paused'].includes(job.status))});
      const pause=button('Pause scan',async()=>{await pauseScan();update(await loadScanJob());},body,{enabled:()=>job?.status==='running' || Boolean(runningJob)});
      const cancel=button('Cancel scan',async()=>{await pauseScan('canceled');update(await loadScanJob());},body,{enabled:()=>Boolean(unfinished())});
      controls=[start,resume,pause,cancel];acknowledge.addEventListener('change',()=>update(job));update(job);
    },()=>{open=false;if(runningJob)void pauseScan().catch(error=>setToast(error.message,{error:true}));});
  }
  function showPalette(){
    openDialog('Command palette',({body,field})=>{
      const search=field('Search commands',create('input','input'));search.type='search';search.autocomplete='off';search.placeholder=l('Search commands');
      const list=create('div','feature-command-list');body.append(list);let index=0;
      const update=()=>{
        list.replaceChildren();const entries=commands().list().filter(command=>l(command.label).toLocaleLowerCase().includes(search.value.toLocaleLowerCase()));
        index=Math.min(index,Math.max(0,entries.length-1));
        if(!entries.length)list.append(create('p','',l('No commands found')));
        entries.forEach((entry,i)=>{const button=create('button','ghost-button feature-command'+(i===index?' active':''),l(entry.label));button.type='button';button.dataset.command=entry.name;
          button.addEventListener('click',async()=>{closeDialog();try{await commands().run(entry.name);}catch(error){setToast(error.message,{error:true});}});list.append(button);});
      };search.addEventListener('input',()=>{index=0;update();});
      search.addEventListener('keydown',event=>{const buttons=[...list.querySelectorAll('button')];if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();index=(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%Math.max(1,buttons.length);update();list.querySelector('.active')?.scrollIntoView({block:'nearest'});}else if(event.key==='Enter'){event.preventDefault();buttons[index]?.click();}});update();queueMicrotask(()=>search.focus());
    });
  }
  const commandGroups=[['Organize',['savedViews','bulkTags','duplicatePreview','deleteSelected']],['Check links',['resumableScan','inspectVisible','repairRedirects']],['Backup and import',['snapshotExport','snapshotRestore','importPreview','exportCsv']],['Troubleshoot',['diagnosticExport','clearHealth']]];
  async function appendScanSummary(parent){
    const job=await loadScanJob();if(!parent.isConnected || !job || ['completed','canceled'].includes(job.status))return;
    const values=scanCoverage(job);const summary=create('button','ghost-button feature-scan-summary',l('Saved scan progress')+': '+values.completed+' / '+values.total);summary.type='button';summary.addEventListener('click',()=>showScan().catch(error=>setToast(error.message,{error:true})));parent.append(summary);
  }
  function showLibraryTools(){openDialog('Library tools',({body,button,report})=>{
    body.append(create('p','helper-text',l('Use Resumable scan for saved progress; Inspect visible checks the current targets once. Snapshots include folders and tags.')));
    body.append(create('p','helper-text',l('Snapshots and recovery journals contain bookmark URLs, titles and tags. Review them before sharing.')));
    appendScanSummary(body).catch(report);
    const entries=commands().list();
    for(const [title,names] of commandGroups){const group=create('section','feature-command-group');group.append(create('h3','',l(title)));body.append(group);for(const name of names){const entry=entries.find(command=>command.name===name);if(entry)button(entry.label,async()=>{closeDialog();await commands().run(entry.name);},group);}}
  });}
  window.addEventListener('pagehide',()=>{if(runningJob){stopScan=true;void pauseScan().catch(()=>{});}},{once:true});
  return {exportSnapshot,pickSnapshot,showSnapshotRestore,showDuplicatePreview,showSavedViews,showBulkTags,showImportPreview,showDiagnostics,showScan,showPalette,showLibraryTools,closeDialog,isDialogOpen:()=>Boolean(dialog),undoBulkTags,appendScanSummary};
}
