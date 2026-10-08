import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUrlSafe, getRegistrableDomain, matchesMode } from '../src/url-utils.js';
import { detectDuplicates } from '../src/bookmark-utils.js';

for (const [a,b,equal] of [
  ['https://example.test:8443/a','https://example.test:9443/a',false],
  ['https://example.test:443/a/','https://example.test/a',true],
  ['http://example.test:80/a','http://example.test/a',true],
  ['http://example.test/a','https://example.test/a',false],
  ['https://[::1]:8443/a','https://[::1]:9443/a',false],
]) test(`page identity ${a} / ${b}`,()=> {
  assert.equal(matchesMode({parsed:parseUrlSafe(a)},parseUrlSafe(b),'page'),equal);
});
test('duplicate detection keeps distinct services and host scope stays hostname-based',()=>{
  const items=['8443','9443'].map((port,id)=>({id:String(id),title:'service',url:`https://example.test:${port}/`,parsed:parseUrlSafe(`https://example.test:${port}/`)}));
  assert.ok(detectDuplicates(items).every(item=>!item.isDuplicate));
  assert.equal(matchesMode(items[0],items[1].parsed,'host'),true);
  assert.match(items[0].parsed.displayUrl,/:8443/);
});
for (const [host,domain] of [
  ['a.example.co.uk','example.co.uk'],['alice.github.io','alice.github.io'],
  ['bob.blogspot.com','bob.blogspot.com'],['x.a.ck','x.a.ck'],['x.www.ck','www.ck'],
  ['a.city.kawasaki.jp','city.kawasaki.jp'],['localhost','localhost'],
  ['127.0.0.1','127.0.0.1'],['[::1]','[::1]'],['www.bücher.de','xn--bcher-kva.de'],
  ['example.com.','example.com'],['com','com'],
]) test(`registrable domain ${host}`,()=>assert.equal(getRegistrableDomain(host),domain));
test('parse options and invalid schemes retain their established contract',()=>{
  assert.equal(parseUrlSafe('https://a.test/a/?x=1#b',{ignoreQueryString:true,ignoreHashFragment:false}).normalizedPageKey,'https://a.test/a#b');
  for(const url of ['file:///a','javascript:alert(1)','invalid'])assert.equal(parseUrlSafe(url).valid,false);
});
