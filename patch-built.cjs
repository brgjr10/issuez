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
  'const cyclePriorityPatched=async(e,r)=>{const t=["todo","in-progress","done"],o=c().issues.find(h=>h.repo_full===e&&h.number===r);' +
  'if(!o)return;const s=getPriority(o)||"none",n=["critical","high","medium","low"],i=n.indexOf(s),' +
  'a=i>=0?n[(i+1)%n.length]:"critical",l="priority:"+a,g=e.split("/")[0],d=e.split("/")[1],w=[];' +
  'i>=0&&w.push(ie(g,d,r,"priority:"+s).catch(()=>{})),w.push(re(g,d,r,l));' +
  'try{await Promise.all(w),f("Priority set to "+P[a],"success");' +
  'const u={...o,labels:o.labels.filter(t=>!t.name.startsWith("priority:")).concat({name:l,color:"b60205"})};' +
  'a({issues:c().issues.map(t=>t.repo_full===o.repo_full&&t.number===o.number?u:t),' +
  'filteredIssues:c().filteredIssues.map(t=>t.repo_full===o.repo_full&&t.number===o.number?u:t),selectedIssue:u}),' +
  'g(),setTimeout(()=>O(e,r),200)}catch(h){f(h.message,"error")}};window._cyclePriority=cyclePriorityPatched;';

if (!html.includes('cyclePriorityPatched=')) {
  html = html.replace('</script>', cyclePriorityCode + '</script>');
  console.log('Added cyclePriority function');
}

// 4. Add CSS for issue-gh-link by injecting the full styles.css
const cssPath = path.join(__dirname, 'src', 'styles.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

if (!html.includes('data-theme=rainbow')) {
  const cssStart = html.indexOf('<style id="theme-styles"></style>');
  if (cssStart >= 0) {
    html = html.replace('<style id="theme-styles"></style>', '<style id="theme-styles">\n' + cssContent + '\n</style>');
    console.log('Injected full styles.css');
  }
}

fs.writeFileSync(distHtmlPath, html);
// Don't overwrite root index.html - keep it as clean entry point for builds
console.log('Patched dist/index.html');
