const fs = require('fs');
const path = require('path');

const distHtmlPath = path.join(__dirname, 'dist', 'index.html');
const rootHtmlPath = path.join(__dirname, 'index.html');

let html = fs.readFileSync(distHtmlPath, 'utf-8');

// 1. Add helper functions
const helperCode = 
  'function getPriority(e){return e.labels.find(t=>t.name.startsWith("priority:"))?.name.replace("priority:","")||null}' +
  'function getStatus(e){return e.labels.find(t=>t.name.startsWith("status:"))?.name.replace("status:","")||null}' +
  'function getPrioritySortValue(e){const t=getPriority(e);return PRIORITY_ORDER[t]??99}';

if (!html.includes('function getPriority(')) {
  html = html.replace('<script type="module" crossorigin>', '<script type="module" crossorigin>' + helperCode);
  console.log('Added helper functions');
}

// 2. Add cyclePriority function before </script>
const cyclePriorityCode = 
  'async function F(e,r){const t=["todo","in-progress","done"],o=c().issues.find(h=>h.repo_full===e&&h.number===r);' +
  'if(!o)return;const s=getPriority(o)||"none",n=["critical","high","medium","low"],i=n.indexOf(s),' +
  'a=i>=0?n[(i+1)%n.length]:"critical",l="priority:"+a,g=e.split("/")[0],d=e.split("/")[1],w=[];' +
  'i>=0&&w.push(ie(g,d,r,"priority:"+s).catch(()=>{})),w.push(re(g,d,r,l));' +
  'try{await Promise.all(w),f("Priority set to "+P[a],"success");' +
  'const u={...o,labels:o.labels.filter(t=>!t.name.startsWith("priority:")).concat({name:l,color:"b60205"})};' +
  'a({issues:c().issues.map(t=>t.repo_full===o.repo_full&&t.number===o.number?u:t),' +
  'filteredIssues:c().filteredIssues.map(t=>t.repo_full===o.repo_full&&t.number===o.number?u:t),selectedIssue:u}),' +
  'g(),setTimeout(()=>O(e,r),200)}catch(h){f(h.message,"error")}}';

if (!html.includes('async function F(e,r){')) {
  html = html.replace('</script>', cyclePriorityCode + '</script>');
  console.log('Added cyclePriority function');
}

// 3. Add window._cyclePriority global
if (!html.includes('window._cyclePriority=')) {
  html = html.replace('window._cycleStatus=', 'window._cycleStatus=,window._cyclePriority=F,').replace(',,', ',');
  console.log('Added window._cyclePriority global');
}

// 4. Add GitHub links
let linkPatched = 0;
html = html.replace(/\$\{d\(n\.title\)\}\<\/span\>/g, () => { linkPatched++; return '${d(n.title)}</span><a class="issue-gh-link" href="${n.html_url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">GitHub</a>'; });
html = html.replace(/\$\{d\(o\.title\)\}\<\/div\>/g, () => { linkPatched++; return '${d(o.title)} <a href="${o.html_url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="font-size:0.75rem; opacity:0.7;">\u2197</a></div>'; });
console.log('Patched ' + linkPatched + ' GitHub links');

// 5. Add CSS for issue-gh-link
if (!html.includes('.issue-gh-link{')) {
  html = html.replace('.issue-title{', '.issue-title{display:inline}.issue-gh-link{font-size:.75rem;opacity:.7;margin-left:.5rem;white-space:nowrap}.issue-gh-link:hover{opacity:1}.issue-title{');
  console.log('Added issue-gh-link CSS');
}

fs.writeFileSync(distHtmlPath, html);
fs.writeFileSync(rootHtmlPath, html);
console.log('All patches applied to index.html');
