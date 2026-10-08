import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePocketHtml,parsePinboardJson,parseRaindropCsv,detectImportFormat } from '../../extension/src/services/third-party-import.js';
import { createCsv,parseImportedText,_internals } from '../../extension/src/dashboard/import-export-tools.js';
import { importBookmarks,loadImportJournal } from '../../extension/src/services/import-service.js';
import { fakeBrowser,folder } from '../helpers/browser.mjs';

for(const [encoded,decoded] of [
  ['a=1&amp;b=2','a=1&b=2'],['x=&#34;hi&#34;','x="hi"'],['a=1&#x26;b=2','a=1&b=2'],['x=&amp;#x26;','x=&#x26;'],['x=&quot;a&gt;b&quot;','x="a>b"']
])test(`Pocket attribute entity ${encoded}`,()=>{
  const parsed=parsePocketHtml(`<a href="https://example.test/?${encoded}">Title &amp; more</a>`);
  assert.equal(parsed.bookmarks[0].url,'https://example.test/?'+decoded);assert.equal(parsed.bookmarks[0].title,'Title & more');
});
for(const url of ['javascript&#58;alert(1)','data&#58;text/html,hi','file:///a','invalid'])test(`Pocket rejects unsafe decoded URL ${url}`,()=>assert.equal(parsePocketHtml(`<a href="${url}">x</a>`).bookmarks.length,0));
test('attribute name matching ignores data-href; malformed numeric entities do not throw',()=>{
  assert.equal(parsePocketHtml('<a data-href="https://example.test/">x</a>').bookmarks.length,0);
  assert.doesNotThrow(()=>parsePocketHtml('<a href="https://example.test/?x=&#99999999;">x</a>'));
});
for(const title of ['=1+1','+SUM(A1)','-1+2','@cmd','\t=cmd','\r=cmd','\n=cmd','  =cmd',"'literal",'a,b','He said "hi"','line1\nline2'])test(`spreadsheet text protection and round trip ${JSON.stringify(title)}`,()=>{
  const item={title,url:'https://example.test/',path:'Work',dateAdded:1700000000000,tags:['work','two words']};
  const csv=createCsv([item]);const raw=_internals.parseCsv(csv)[1][0];
  if(/^(?:\s*[=+@-]|[\t\r\n]|')/.test(title))assert.ok(raw.startsWith("'"));
  assert.deepEqual(parseImportedText(csv,'test.csv')[0],item);
});
test('legacy CSV cells are not unescaped without the declared encoding',()=>assert.equal(parseImportedText("Title,URL\n'abc,https://example.test/",'old.csv')[0].title,"'abc"));
test('JSON interchange preserves tags, date and path and handles malformed containers',()=>{
  const item={title:'A',url:'https://a.test/',path:'Folder / Child',dateAdded:42,tags:['work']};
  assert.deepEqual(parseImportedText(JSON.stringify([item]),'a.json'),[item]);
  for(const value of ['{','null','{"bookmarks":3}'])assert.deepEqual(parseImportedText(value,'a.json'),[]);
});
test('Pinboard and Raindrop retain tags and reject unsupported URLs',()=>{
  assert.deepEqual(parsePinboardJson(JSON.stringify([{href:'https://a.test/',description:'A',tags:'work urgent'},{href:'javascript:bad'}])).bookmarks[0].tags,['work','urgent']);
  assert.equal(parseRaindropCsv('id,title,url,tags\n1,A,https://a.test/,work').bookmarks.length,1);
  assert.equal(detectImportFormat('ril_export.html','<DL><DT><A href="x">'), 'pocket');
});
for(const failAt of [0,1,2])test(`import creation failure at ${failAt} keeps earlier tags and records every outcome`,async()=>{
  const x=fakeBrowser([folder('P')]);const items=['A','B','C'].map(id=>({title:id,url:`https://${id}.test/`,tags:['work']}));
  x.failures.create.add(items[failAt].url);const result=await importBookmarks(items,'P');
  assert.equal(result.created,2);assert.equal(result.failed,1);assert.equal(Object.keys(x.stored.tagsByBookmark).length,2);
  const journal=await loadImportJournal();assert.equal(journal[result.operation.id].status,'partial');assert.equal(journal[result.operation.id].items.length,3);
});
test('tag persistence failure rolls back only its created bookmark',async()=>{
  const x=fakeBrowser([folder('P')]);x.failures.set=values=>'tagsByBookmark' in values;
  const result=await importBookmarks([{title:'A',url:'https://a.test/',tags:['work']}],'P');
  assert.equal(result.created,0);assert.equal(result.failed,1);assert.equal(result.operation.items[0].status,'rolled-back');assert.equal(x.find('P').children.length,0);
});
test('failed rollback retains the surviving ID in the recovery journal',async()=>{
  const x=fakeBrowser([folder('P')]);x.failures.set=values=>'tagsByBookmark' in values;x.failures.remove.add('created-1');
  const result=await importBookmarks([{title:'A',url:'https://a.test/',tags:['work']}],'P');assert.equal(result.created,1);
  assert.equal(result.operation.items[0].status,'metadata-failed');assert.equal((await loadImportJournal())[result.operation.id].items[0].id,'created-1');
});
test('journal persistence failure stops further creation and exposes partial accounting',async()=>{
  const x=fakeBrowser([folder('P')]);let writes=0;x.failures.set=values=>'importJournal' in values && ++writes>1;
  const result=await importBookmarks([{url:'https://a.test/'},{url:'https://b.test/'}],'P');assert.equal(x.calls.creates.length,1);assert.equal(result.created,1);assert.equal(result.notAttempted,1);assert.ok(result.storageFailure);
});
