// Dashboard feature checks used by acceptance.mjs. Synthetic bookmarks and a disposable profile only.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

export async function waitForStorage(worker,page,key,predicate) {
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){
    const value=await worker.evaluate(async key=>(await chrome.storage.local.get(key))[key],key);
    if(predicate(value))return value;
    await page.waitForTimeout(25); // Observe state; never repeat an action.
  }
  throw new Error('Storage condition timed out: '+key);
}

export async function runBrowserFeatures({page,worker,origin,profile,results,ids}) {
  const reload=async()=>{await page.goto(origin+'pages/dashboard/dashboard.html');await page.waitForSelector('[data-library-tools]');};
  const open=async label=>{await page.locator('[data-library-tools]').click();await page.locator(`[data-feature-action="${label}"]`).click();};
  const close=async()=>{await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();};
  const waitStatus=async pattern=>{try{await page.waitForFunction(pattern=>new RegExp(pattern).test(document.querySelector('.feature-status')?.textContent||''),pattern);}catch(error){throw new Error(error.message+'; dialog='+await page.locator('.feature-dialog').textContent());}};

  await reload();
  const source=await page.evaluate(async id=>{
    const original=(await chrome.bookmarks.get(id))[0];
    const duplicate=await chrome.bookmarks.create({parentId:original.parentId,title:'One duplicate',url:original.url});
    const tags=await import(chrome.runtime.getURL('src/services/tag-service.js'));
    await tags.updateTagsMap(map=>tags.setTagsForBookmark(map,duplicate.id,['duplicate-tag']));
    return {original,duplicate};
  },ids[0]);
  await reload();await open('Duplicate preview');
  await page.locator(`.feature-survivor input[value="${ids[0]}"]`).check();
  assert.ok((await page.locator('.feature-dialog').textContent()).includes('duplicate-tag'));
  await page.evaluate(()=>{globalThis.acceptanceTagChanges=[];chrome.storage.onChanged.addListener(changes=>{if(changes.tagsByBookmark)globalThis.acceptanceTagChanges.push(changes.tagsByBookmark.newValue);});});
  await page.locator('[data-feature-action="Merge and remove duplicates"]').click();
  await page.waitForSelector('.feature-overlay',{state:'detached'});
  await page.getByRole('button',{name:'Undo',exact:true}).waitFor();
  assert.equal(await worker.evaluate(async id=>{
    const tree=await chrome.bookmarks.getTree();
    const exists=nodes=>nodes.some(node=>node.id===id || exists(node.children||[]));return exists(tree);
  },source.duplicate.id),false);
  const survivor=await worker.evaluate(async id=>({node:(await chrome.bookmarks.get(id))[0],tags:(await chrome.storage.local.get('tagsByBookmark')).tagsByBookmark[id]}),ids[0]);
  assert.equal(survivor.node.title,source.original.title);assert.ok(survivor.tags.includes('duplicate-tag'),JSON.stringify({source,survivor,changes:await page.evaluate(()=>globalThis.acceptanceTagChanges)}));
  results.checks.push({name:'Duplicate preview: visible duplicate survivor preview transfers tags and deletes only other identity',passed:true});

  await reload();await open('Saved views');
  await page.getByRole('textbox',{name:'View name',exact:true}).fill('Acceptance view');
  await page.locator('[data-feature-action="Save view"]').click();
  const saved=(await waitForStorage(worker,page,'smartViews',views=>views?.some(view=>view.name==='Acceptance view'))).find(view=>view.name==='Acceptance view');
  await page.locator('.feature-field select').selectOption(saved.id);
  await page.locator('[data-feature-action="Open view"]').click();await page.waitForSelector('.feature-overlay',{state:'detached'});
  results.checks.push({name:'Saved views: save and apply named live view through dashboard UI',passed:true,version:saved.version});

  await open('Bulk tags');
  await page.getByRole('textbox',{name:'Tag to add',exact:true}).fill('acceptance-bulk');
  await page.locator('[data-feature-action="Preview"]').click();
  await page.waitForFunction(()=>document.querySelector('.feature-preview')?.textContent.includes('acceptance-bulk'));
  await page.locator('[data-feature-action="Apply tag changes"]').click();await waitStatus('Changed / missing / conflicting: [1-9]');
  assert.ok(await worker.evaluate(async id=>(await chrome.storage.local.get('tagsByBookmark')).tagsByBookmark[id].includes('acceptance-bulk'),ids[0]));
  await page.locator('[data-feature-action="Undo tag changes"]').click();await close();
  await waitForStorage(worker,page,'tagsByBookmark',tags=>!tags?.[ids[0]]?.includes('acceptance-bulk'));
  results.checks.push({name:'Bulk tag preview: visible bulk tag preview, application and Undo',passed:true});

  const snapshot=await page.evaluate(async()=> (await import(chrome.runtime.getURL('src/services/snapshot-service.js'))).createSnapshot());
  const snapshotPath=path.join(profile,'snapshot.json');fs.writeFileSync(snapshotPath,JSON.stringify(snapshot));
  await page.locator('[data-library-tools]').click();
  const snapshotChooser=page.waitForEvent('filechooser');await page.locator('[data-feature-action="Restore snapshot"]').click();await (await snapshotChooser).setFiles(snapshotPath);
  await page.waitForSelector('[data-feature-action="Restore into new folder"]');assert.ok((await page.locator('.feature-dialog').textContent()).includes('Original IDs and dates'));
  await page.locator('[data-feature-action="Restore into new folder"]').click();await waitStatus('Created / excluded / failed / remaining: [1-9]');
  const restore=await worker.evaluate(async()=> (await chrome.storage.local.get('snapshotRestoreJournal')).snapshotRestoreJournal[0]);
  assert.equal(restore.status,'completed');assert.ok(restore.items.some(item=>item.sourceId===ids[0]&&item.id!==ids[0]));
  assert.equal(await page.locator('[data-feature-action="Restore into new folder"]').isDisabled(),true);
  await close();results.checks.push({name:'Snapshot restore: visible versioned snapshot restore remaps real browser IDs and persists journal',passed:true});

  await reload();const importPath=path.join(profile,'import.json');fs.writeFileSync(importPath,JSON.stringify([{title:'Imported duplicate',url:source.original.url,tags:['import-merge']},{title:'Import fresh',url:'https://import-fresh.test/',tags:['fresh']} ]));
  await page.locator('[data-library-tools]').click();const chooser=page.waitForEvent('filechooser');await page.locator('[data-feature-action="Import bookmarks…"]').click();await (await chooser).setFiles(importPath);
  await page.waitForSelector('[data-feature-action="Import bookmarks"]');await page.getByLabel('Duplicate policy',{exact:true}).selectOption('merge');
  const before=await worker.evaluate(async()=>{const tree=await chrome.bookmarks.getTree();let count=0;const visit=nodes=>{for(const node of nodes){if(node.url)count++;visit(node.children||[]);}};visit(tree);return count;});
  assert.ok(!(await worker.evaluate(async id=>(await chrome.storage.local.get('tagsByBookmark')).tagsByBookmark[id]?.includes('import-merge'),ids[0])));
  await page.locator('[data-feature-action="Import bookmarks"]').click();await waitStatus('Created / merged / skipped / failed / remaining: 1 / 1 / 0 / 0 / 0');
  const after=await worker.evaluate(async()=>{const tree=await chrome.bookmarks.getTree();let count=0;const visit=nodes=>{for(const node of nodes){if(node.url)count++;visit(node.children||[]);}};visit(tree);return count;});assert.equal(after,before+1);
  assert.ok(await worker.evaluate(async id=>(await chrome.storage.local.get('tagsByBookmark')).tagsByBookmark[id]?.includes('import-merge'),ids[0]));await close();
  results.checks.push({name:'Import preview: visible import dry preview, selected duplicate merge and applied counts',passed:true});

  await page.evaluate(async()=>{
    const diagnostics=await import(chrome.runtime.getURL('src/services/diagnostics-service.js'));
    diagnostics.createLogger('dashboard').error('import_failed',{url:'https://secret-user.test/',message:'secret-title',count:1});await diagnostics.awaitPendingDiagnosticWrites();
  });
  await open('Diagnostic export');const diagnosticText=await page.locator('.feature-preview').textContent();assert.ok(!diagnosticText.includes('secret-user'));assert.ok(!diagnosticText.includes('secret-title'));assert.ok(JSON.parse(diagnosticText).events.some(event=>event.event==='import_failed'));
  const download=page.waitForEvent('download');await page.locator('[data-feature-action="Download"]').click();await (await download).saveAs(path.join(profile,'diagnostics.json'));await close();
  results.checks.push({name:'Diagnostics: exact diagnostic preview/download omits free text and bookmark URLs',passed:true});

  await page.locator('[data-library-tools]').focus();await page.keyboard.press('Control+Shift+P');await page.getByRole('searchbox',{name:'Search commands',exact:true}).fill('Saved');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'Saved views',exact:true}).waitFor();await page.keyboard.press('Escape');
  await page.locator('[data-library-tools]').focus();await page.evaluate(()=>document.documentElement.dir='rtl');await page.keyboard.press('Control+Shift+P');
  const direction=await page.locator('.feature-dialog').evaluate(node=>getComputedStyle(node).direction);assert.equal(direction,'rtl');
  await page.keyboard.press('Shift+Tab');assert.ok(await page.locator('.feature-dialog').evaluate(node=>node.contains(document.activeElement)));
  await page.keyboard.press('Escape');assert.equal(await page.locator('[data-library-tools]').evaluate(node=>document.activeElement===node),true);await page.evaluate(()=>document.documentElement.dir='ltr');
  results.checks.push({name:'Command palette: palette search/Arrow/Enter/Escape, Tab trap, RTL and focus restoration',passed:true});

  await page.evaluate(async()=>{const platform=await import(chrome.runtime.getURL('src/platform/browser-api.js'));platform.setChromeApiForTesting({...chrome,permissions:{contains:async()=>false,request:async()=>false}});});
  await open('Resumable scan');await page.locator('[data-feature-action="Start new scan"]').click();await waitStatus('permission denied');await close();
  await page.evaluate(async()=>{const platform=await import(chrome.runtime.getURL('src/platform/browser-api.js'));platform.setChromeApiForTesting(null);});
  const controlled=await page.evaluate(async()=>{
    const platform=await import(chrome.runtime.getURL('src/platform/browser-api.js'));
    platform.setChromeApiForTesting({...chrome,permissions:{contains:async()=>true}});
    try{
      const jobs=await import(chrome.runtime.getURL('src/services/scan-job-service.js'));
      const job=await jobs.createScanJob([{url:'https://resume-one.test/'},{url:'https://resume-two.test/'}]);
      await jobs.runScanJob(job.id,{fetchHealth:async()=>({status:'healthy',checkedAt:Date.now()}),onProgress:async current=>{await jobs.controlScanJob(current.id,'paused');}});
      return jobs.scanCoverage(await jobs.loadScanJob());
    }finally{platform.setChromeApiForTesting(null);}
  });assert.equal(controlled.completed,1);assert.equal(controlled.remaining,1);
  await reload();await open('Resumable scan');assert.ok((await page.locator('.feature-scan-progress').textContent()).includes('1 / 2 / 1'));await close();
  const resumed=await page.evaluate(async()=>{
    const platform=await import(chrome.runtime.getURL('src/platform/browser-api.js'));platform.setChromeApiForTesting({...chrome,permissions:{contains:async()=>true}});
    try{const jobs=await import(chrome.runtime.getURL('src/services/scan-job-service.js'));const job=await jobs.loadScanJob();let calls=0;const result=await jobs.runScanJob(job.id,{fetchHealth:async()=>{calls++;return {status:'healthy',checkedAt:Date.now()};}});return {...jobs.scanCoverage(result),calls};}finally{platform.setChromeApiForTesting(null);}
  });assert.equal(resumed.calls,1);assert.equal(resumed.status,'completed');
  results.checks.push({name:'Resumable scan: controlled UI permission denial and persisted page-reload resume with controlled fetch/permission boundary',passed:true,completed:resumed.completed});
}
