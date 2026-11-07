import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const element=()=>({nodeType:1,childNodes:[],closest:()=>null,hasAttribute:()=>false,appendChild(){},setAttribute(){}});
const context={document:{documentElement:element(),head:element(),createElement:element},window:{},Node:{TEXT_NODE:3,ELEMENT_NODE:1},MutationObserver:class{observe(){}disconnect(){}}};
vm.runInNewContext(fs.readFileSync('build/fccd-ru.js','utf8'),context);
const corpus=JSON.parse(fs.readFileSync('tests/news.json','utf8').replace(/^\uFEFF/,''));
for(const source of corpus){
 const actual=context.window.__fccdRu.translate(source);
 assert.notEqual(actual,source,source);
 assert.doesNotMatch(actual,/defeated|earning|this week's|\byards\b|\bfell\b|\bmoved\b|take on|takes on|allowing|teams are|has the| and | or | while |\bpack\b|\bupcoming\b/,actual);
 assert.deepEqual((actual.match(/\d+(?:\.\d+)?/g)||[]).sort(),(source.replace(/Top-(?:5|10)/g,'').match(/\d+(?:\.\d+)?/g)||[]).sort(),'News numbers changed: '+source);
}
console.log(JSON.stringify({realNewsPassed:corpus.length}));
