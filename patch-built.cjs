const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf-8');

// Add onclick handlers to priority badges
html = html.replace(
  /priority-badge priority-\$\{n\.priority\|\|"none"\}">/g,
  'priority-badge priority-${n.priority||"none"}" onclick="window._cyclePriority(\'${n.repo_full}\', ${n.number})" title="Click to change priority">'
);

html = html.replace(
  /priority-badge priority-\$\{o\.priority\|\|"none"\}">/g,
  'priority-badge priority-${o.priority||"none"}" onclick="event.stopPropagation(); window._cyclePriority(\'${o.repo_full}\', ${o.number})" title="Click to change priority">'
);

html = html.replace(
  /priority-badge priority-\$\{r\.priority\|\|"none"\}">/g,
  'priority-badge priority-${r.priority||"none"}" onclick="event.stopPropagation(); window._cyclePriority(\'${r.repo_full}\', ${r.number})" title="Click to change priority">'
);

// Add window._cyclePriority global
html = html.replace(
  'window._cycleStatus = cycleStatus;',
  'window._cycleStatus = cycleStatus;\n  window._cyclePriority = cyclePriority;'
);

fs.writeFileSync(htmlPath, html);
console.log('Patched priority badges and added cyclePriority global');
