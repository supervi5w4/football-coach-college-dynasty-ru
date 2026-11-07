import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const element = () => ({nodeType:1,childNodes:[],closest:()=>null,hasAttribute:()=>false,appendChild(){},setAttribute(){}});
const context = {document:{documentElement:element(),head:element(),createElement:element},window:{},Node:{TEXT_NODE:3,ELEMENT_NODE:1},MutationObserver:class{observe(){}disconnect(){}}};
vm.runInNewContext(fs.readFileSync('build/fccd-ru.js','utf8'),context);
const templates = JSON.parse(fs.readFileSync('src/templates.json','utf8'));
const expand = s => s.replace(/\{(\d+)\}/g,(_,i)=>'ДАННЫЕ_'+String.fromCharCode(1040+Number(i)));
for (const [source, translated] of templates) {
  assert.equal(context.window.__fccdRu.translate(expand(source)), expand(translated), source);
}
console.log(JSON.stringify({templatesPassed:templates.length}));
