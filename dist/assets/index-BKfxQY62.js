(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))s(n);new MutationObserver(n=>{for(const i of n)if(i.type==="childList")for(const r of i.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&s(r)}).observe(document,{childList:!0,subtree:!0});function o(n){const i={};return n.integrity&&(i.integrity=n.integrity),n.referrerPolicy&&(i.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?i.credentials="include":n.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(n){if(n.ep)return;n.ep=!0;const i=o(n);fetch(n.href,i)}})();const S=(e,t=document)=>t.querySelector(e),Se=(e,t=document)=>Array.from(t.querySelectorAll(e)),f=(e,...t)=>e.reduce((o,s,n)=>o+s+(t[n]??""),""),m=e=>String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]),Ie=(e,t)=>{let o;return(...s)=>{clearTimeout(o),o=setTimeout(()=>e(...s),t)}},Ee=e=>new Date(e).toLocaleDateString(void 0,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),le=e=>{const t=Math.max(0,Math.floor((Date.now()-new Date(e).getTime())/1e3));return t<60?t+"s ago":t<3600?Math.floor(t/60)+"m ago":t<86400?Math.floor(t/3600)+"h ago":Math.floor(t/86400)+"d ago"},xe={critical:0,high:1,medium:2,low:3},D={critical:"Critical",high:"High",medium:"Medium",low:"Low"},M={todo:"To Do","in-progress":"In Progress",done:"Done"},Ae=["critical","high","medium","low"],Le=["todo","in-progress","done"],V="issuez_token",F="issuez_layout",R="issuez_theme",$=e=>{var t;return((t=e.labels.find(o=>o.name.startsWith("priority:")))==null?void 0:t.name.replace("priority:",""))||null},k=e=>{var t;return((t=e.labels.find(o=>o.name.startsWith("status:")))==null?void 0:t.name.replace("status:",""))||null},Z=e=>xe[$(e)]??99,Y=e=>Ae.includes($(e))?$(e):"none",J=e=>Le.includes(k(e))?k(e):"todo",ce=e=>{try{const t=new URL(e);return t.protocol==="https:"&&t.hostname==="github.com"?t.href:""}catch{return""}},Ce=["avatars.githubusercontent.com","camo.githubusercontent.com"],de=e=>{try{const t=new URL(e);return t.protocol==="https:"&&Ce.includes(t.hostname)?t.href:""}catch{return""}},z=e=>/^[0-9a-fA-F]{6}$/.test(String(e))?e:"808080",ue=(e,t,o)=>{const s=o==="desc"?-1:1;return[...e].sort((n,i)=>{let r=0;switch(t){case"priority":r=Z(n)-Z(i);break;case"created":r=new Date(n.created_at)-new Date(i.created_at);break;case"updated":r=new Date(n.updated_at)-new Date(i.updated_at);break;case"repo":r=n.repo.localeCompare(i.repo);break;case"comments":r=n.comments-i.comments;break;default:r=0}return r*s})},pe="https://api.github.com",Te=100,me=6e4,Pe="GitHub secondary rate limit reached — too many requests from this client. Wait a minute and try again.";let L=null,C={remaining:5e3,reset:0};function K(e){L=e}function he(){return!!L}function fe(e=C){return e.remaining>1?0:Math.max(0,e.reset-Date.now())}function Re(){return fe()>me}const W=()=>"GitHub rate limit reached. Try again after "+new Date(C.reset).toLocaleTimeString();function ge(e){const t=e.headers.get("X-RateLimit-Remaining");t!==null&&t!==""&&(C.remaining=parseInt(t,10));const o=e.headers.get("X-RateLimit-Reset");o!==null&&o!==""&&(C.reset=parseInt(o,10)*1e3)}async function ye(e){let t="";try{t=await e.text()}catch(o){return console.warn("[issuez] Could not read the GitHub error body — the response was truncated or the connection dropped.",o),e.statusText||`HTTP ${e.status}`}try{const o=JSON.parse(t);if(typeof(o==null?void 0:o.message)=="string"&&o.message)return o.message;if(Array.isArray(o==null?void 0:o.errors))return o.errors.map(s=>(s==null?void 0:s.message)||(s==null?void 0:s.code)).filter(Boolean).join(", ")}catch{}return t||e.statusText||`HTTP ${e.status}`}async function T(e,t={}){const o=await fetch(`${pe}${e}`,{...t,headers:{Accept:"application/vnd.github+json",Authorization:L?`Bearer ${L}`:void 0,"X-GitHub-Api-Version":"2022-11-28",...t.headers}});if(ge(o),o.status===401)throw new Error("Unauthorized");if(o.status===403&&C.remaining<=0)throw new Error(W());if(!o.ok)throw new Error(await ye(o));return o}async function N(e){const t=[];let o=`${pe}${e}${e.includes("?")?"&":"?"}per_page=${Te}&page=1`;for(;o;){const s=fe();if(s>me)throw new Error(W());s>0&&await new Promise(l=>setTimeout(l,s));const n=await fetch(o,{headers:{Accept:"application/vnd.github+json",Authorization:L?`Bearer ${L}`:void 0,"X-GitHub-Api-Version":"2022-11-28"}});if(ge(n),!n.ok){if(n.status===401)throw new Error("Unauthorized");if(n.status===403&&C.remaining<=0)throw new Error(W());const l=await ye(n);throw n.status===403&&/secondary rate limit/i.test(l)?new Error(Pe):new Error(l)}const i=await n.json();t.push(...i);const r=n.headers.get("Link");if(!r)break;const c=r.match(/<([^>]+)>;\s*rel="next"/);o=c?c[1]:null}return t}async function De(){return(await T("/user")).json()}async function Me(){return N("/user/repos?sort=updated&affiliation=owner,collaborator,organization_member")}async function Ne(){return N("/user/orgs")}async function Ue(e){return N(`/orgs/${encodeURIComponent(e)}/repos?sort=updated&type=all`)}async function ee(e,t,o="open"){return(await N(`/repos/${encodeURIComponent(e)}/${encodeURIComponent(t)}/issues?state=${encodeURIComponent(o)}`)).filter(n=>!n.pull_request)}async function Oe(e,t,o){return(await T(`/repos/${encodeURIComponent(e)}/${encodeURIComponent(t)}/issues/${encodeURIComponent(o)}`)).json()}async function Fe(e,t,o){return await N(`/repos/${encodeURIComponent(e)}/${encodeURIComponent(t)}/issues/${encodeURIComponent(o)}/comments`)}async function ze(e,t,o,s){return(await T(`/repos/${encodeURIComponent(e)}/${encodeURIComponent(t)}/issues/${encodeURIComponent(o)}/comments`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:s})})).json()}async function He(e,t,o,s){return(await T(`/repos/${encodeURIComponent(e)}/${encodeURIComponent(t)}/issues/${encodeURIComponent(o)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)})).json()}async function H(e,t,o,s){return(await T(`/repos/${encodeURIComponent(e)}/${encodeURIComponent(t)}/issues/${encodeURIComponent(o)}/labels`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify([s])})).json()}async function B(e,t,o,s){await T(`/repos/${encodeURIComponent(e)}/${encodeURIComponent(t)}/issues/${encodeURIComponent(o)}/labels/${encodeURIComponent(s)}`,{method:"DELETE"})}function ve(e){var b,v;const t=e.labels.map(u=>({name:u.name,color:u.color})),o=((b=t.find(u=>u.name.startsWith("priority:")))==null?void 0:b.name.replace("priority:",""))||null,s=((v=t.find(u=>u.name.startsWith("status:")))==null?void 0:v.name.replace("status:",""))||null,i=(e.repository_url||"").split("/").filter(Boolean),r=i[i.length-1]||"unknown",l=`${i[i.length-2]||"unknown"}/${r}`;return{id:e.id,number:e.number,title:e.title,body:e.body||"",state:e.state,html_url:e.html_url,created_at:e.created_at,updated_at:e.updated_at,comments:e.comments,user:{login:e.user.login,avatar_url:e.user.avatar_url},repo:r,repo_full:l,labels:t,priority:o,status:s,pull_request:e.pull_request}}const E={user:null,issues:[],filteredIssues:[],repos:[],loading:!1,error:null,selectedIssue:null,searchQuery:"",filterState:"all",filterAssignee:"all",sortBy:"priority",sortDir:"asc",theme:"dark",layout:null,rateLimit:{remaining:5e3,reset:0},showSettings:!1,showWelcome:!1,showArchivedRepos:!1},q=new Set;function Be(e){return q.add(e),()=>q.delete(e)}function d(){return E}function p(e){Object.assign(E,typeof e=="function"?e(E):e),q.forEach(t=>t(E))}function je(){try{const e=localStorage.getItem(F);e&&(E.layout=JSON.parse(e))}catch(e){console.warn(`[issuez] Could not read ${F} from localStorage — the value is corrupt or storage is blocked. Layout customisation will reset until that key is cleared.`,e)}try{const e=localStorage.getItem(R);e&&(E.theme=e)}catch(e){console.warn(`[issuez] Could not read ${R} from localStorage — storage is blocked or full. The theme will fall back to dark on every load.`,e)}}function Ge(){try{localStorage.setItem(F,JSON.stringify(E.layout))}catch(e){console.warn(`[issuez] Could not save ${F} — the quota is exhausted or storage is blocked. Export the layout instead if you need to keep it.`,e)}}function be(){try{localStorage.setItem(R,E.theme)}catch(e){console.warn(`[issuez] Could not save ${R} — the quota is exhausted or storage is blocked. The theme change will not survive a reload.`,e)}}let _=null;function we(){if(_&&_.isConnected)return _;const e=S("#toast-container");return e?(_=e,_):(_=document.createElement("div"),_.className="toast-container",_.id="toast-container",document.body.appendChild(_),_)}function We(){const e=localStorage.getItem(R)||"dark";p({theme:e}),j(e)}function j(e){document.documentElement.setAttribute("data-theme",e)}function g(e,t="info"){const o=document.createElement("div");o.className=`toast ${t}`,o.innerHTML=`<div class="toast-message">${m(e)}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>`,we().appendChild(o),setTimeout(()=>o.remove(),4e3)}function qe(){var t,o,s;const e=d();return he()?f`
    <header class="app-header">
      <div class="app-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          <path d="M9 12h6M9 16h6"/>
        </svg>
        Issuez
      </div>
      <div class="header-actions">
        <select id="theme-select" onchange="window._setTheme(this.value)">
          <option value="dark" ${e.theme==="dark"?"selected":""}>Dark</option>
          <option value="light" ${e.theme==="light"?"selected":""}>Light</option>
                  <option value="bubbles" ${e.theme==="bubbles"?"selected":""}>Bubbles</option>
          <option value="neon" ${e.theme==="neon"?"selected":""}>Neon</option>
          <option value="pink" ${e.theme==="pink"?"selected":""}>Pink</option>
          <option value="rainbow" ${e.theme==="rainbow"?"selected":""}>Rainbow</option>
          <option value="sunset-glow" ${e.theme==="sunset-glow"?"selected":""}>Sunset Glow</option>
          <option value="sky-gradient" ${e.theme==="sky-gradient"?"selected":""}>Sky Gradient</option>
          <option value="berry-cobalt" ${e.theme==="berry-cobalt"?"selected":""}>Berry Cobalt</option>
          <option value="ghost" ${e.theme==="ghost"?"selected":""}>Ghost</option>
          <option value="solar" ${e.theme==="solar"?"selected":""}>Solar</option>
          <option value="eclipse" ${e.theme==="eclipse"?"selected":""}>Eclipse</option>
          <option value="pop" ${e.theme==="pop"?"selected":""}>Pop</option>
          <option value="gold-signal" ${e.theme==="gold-signal"?"selected":""}>Gold Signal</option>
          <option value="moss" ${e.theme==="moss"?"selected":""}>Moss</option>
          <option value="zen" ${e.theme==="zen"?"selected":""}>Zen</option>
          <option value="dusty" ${e.theme==="dusty"?"selected":""}>Dusty</option>
          <option value="violet" ${e.theme==="violet"?"selected":""}>Violet</option>
        </select>
        <div class="user-info">
          <img class="user-avatar" src="${de((t=e.user)==null?void 0:t.avatar_url)}" alt="${m(((o=e.user)==null?void 0:o.login)||"")}">
          <span>${m(((s=e.user)==null?void 0:s.login)||"")}</span>
        </div>
        <button class="small" onclick="window._logout()">Logout</button>
      </div>
    </header>
  `:""}function Ve(){return f`
    <div class="auth-screen">
      <div class="auth-card fade-in">
        <h1>Issuez</h1>
        <p>Cross-repo GitHub issue tracker. No server, no storage — just you and GitHub.</p>
        <div style="text-align:left; margin-bottom:1rem;">
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">
            <strong>How to get a PAT:</strong>
          </p>
          <ol style="font-size:0.85rem; color:var(--text-secondary); padding-left:1.2rem; line-height:1.8;">
            <li>Go to <a href="https://github.com/settings/tokens" target="_blank">github.com/settings/tokens</a></li>
            <li>Click <strong>Generate new token (classic)</strong></li>
            <li>Select scopes: <code style="background:var(--bg-tertiary); padding:0.1rem 0.3rem; border-radius:4px;">repo</code> and <code style="background:var(--bg-tertiary); padding:0.1rem 0.3rem; border-radius:4px;">read:org</code></li>
            <li>Copy the token and paste it below</li>
          </ol>
        </div>
        <form class="auth-methods" onsubmit="event.preventDefault(); window._patLogin()">
          <label class="visually-hidden" for="pat-input">Personal Access Token</label>
          <input type="password" id="pat-input" name="pat" placeholder="ghp_..." autocomplete="off" spellcheck="false" style="margin-bottom:0.5rem;">
          <button class="primary" type="submit" style="width:100%;">Connect with PAT</button>
        </form>
        <p style="margin-top:1rem; font-size:0.8rem; color:var(--text-muted);">
          Your token is kept in this tab's sessionStorage and is sent only to GitHub. It is never written to localStorage or cookies, and is discarded when the tab closes or you log out.
        </p>
      </div>
    </div>
  `}function Ye(){const e=d();return f`
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="search-box">
          <span class="search-icon">&#128269;</span>
          <input type="text" id="search-input" aria-label="Search issues by title or body" placeholder="Search issues..." oninput="window._onSearch(this.value)">
        </div>
        <div class="filter-group">
          <label for="filter-state">State</label>
          <select id="filter-state" onchange="window._setFilter('state', this.value)">
            <option value="all" ${e.filterState==="all"?"selected":""}>All</option>
            <option value="open" ${e.filterState==="open"?"selected":""}>Open</option>
            <option value="closed" ${e.filterState==="closed"?"selected":""}>Closed</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-assignee">Assignee</label>
          <select id="filter-assignee" onchange="window._setFilter('assignee', this.value)">
            <option value="all" ${e.filterAssignee==="all"?"selected":""}>All</option>
            <option value="me" ${e.filterAssignee==="me"?"selected":""}>Assigned to me</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="checkbox-label">
            <input type="checkbox" id="filter-archived" ${e.showArchivedRepos?"checked":""} onchange="window._toggleArchived(this.checked)">
            <span>Show archived repos</span>
          </label>
        </div>
      </div>
      <div class="toolbar-right">
        <button onclick="window._refresh()" title="Refresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          Refresh
        </button>
        <button onclick="window._openSettings()" title="Settings">&#9881; Settings</button>
      </div>
    </div>
  `}function Je(){const e=d(),t=e.filteredIssues.filter(n=>n.state==="open").length,o=e.filteredIssues.filter(n=>n.state==="closed").length,s=e.filteredIssues.filter(n=>$(n)==="critical").length;return f`
    <div class="stats-bar">
      <div class="stat-card"><div class="stat-value">${e.filteredIssues.length}</div><div class="stat-label">Total</div></div>
      <div class="stat-card"><div class="stat-value">${t}</div><div class="stat-label">Open</div></div>
      <div class="stat-card"><div class="stat-value">${o}</div><div class="stat-label">Closed</div></div>
      <div class="stat-card"><div class="stat-value">${s}</div><div class="stat-label">Critical</div></div>
    </div>
  `}function Ke(){const e=d();if(e.loading&&e.filteredIssues.length===0)return f`
      <div class="issues-table-wrapper">
        <table class="issues-table">
          <thead><tr><th>Issue</th><th>Priority</th><th>Status</th><th>Labels</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody>${Array(8).fill(0).map(()=>f`<tr>${Array(6).fill('<td><div class="skeleton" style="width:90%;"></div></td>').join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    `;if(!e.loading&&e.filteredIssues.length===0)return f`
      <div class="issues-table-wrapper empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        <h3>No issues found</h3>
        <p>Try adjusting your search or filters.</p>
      </div>
    `;const t=ue(e.filteredIssues,e.sortBy,e.sortDir),o={};for(const n of t)o[n.repo]||(o[n.repo]=[]),o[n.repo].push(n);const s=n=>e.sortBy!==n?'<span class="sort-arrow">&#8597;</span>':e.sortDir==="asc"?'<span class="sort-arrow">&#8593;</span>':'<span class="sort-arrow">&#8595;</span>';return f`
    <div class="issues-table-wrapper">
      <table class="issues-table">
        <colgroup>
          <col style="width:8%">
          <col style="width:42%">
          <col style="width:7%">
          <col style="width:14%">
          <col style="width:10%">
          <col style="width:19%">
        </colgroup>
        <thead>
          <tr>
            <th role="button" tabindex="0" onclick="window._setSort('priority')" onkeydown="if(event.key==='Enter'||event.key===' ')window._setSort('priority')">Priority ${s("priority")}</th>
            <th>Issue</th>
            <th>Status</th>
            <th>Labels</th>
            <th role="button" tabindex="0" onclick="window._setSort('updated')" onkeydown="if(event.key==='Enter'||event.key===' ')window._setSort('updated')">Updated ${s("updated")}</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(o).map(([n,i])=>f`
            <tr class="repo-group-header"><td colspan="6"><div class="repo-group-header-content">${m(n)} <span class="repo-group-header-count">(${i.length})</span></div></td></tr>
            ${i.map(r=>f`
              <tr>
                <td>
                   <span class="priority-badge priority-${Y(r)}" role="button" tabindex="0" data-repo="${m(r.repo_full)}" data-number="${Number(r.number)||0}" onclick="window._cyclePriorityFromEl(this)" onkeydown="if(event.key==='Enter'||event.key===' ')window._cyclePriorityFromEl(this)" title="Click to change priority">${m(D[$(r)]||"None")}</span>
                </td>
                <td class="issue-cell">
                   <span class="issue-title" role="button" tabindex="0" data-repo="${m(r.repo_full)}" data-number="${Number(r.number)||0}" onclick="window._openIssueFromEl(this)" onkeydown="if(event.key==='Enter'||event.key===' ')window._openIssueFromEl(this)">${m(r.title)}</span>
                   <a class="issue-gh-link" href="${ce(r.html_url)}" target="_blank" rel="noopener noreferrer" aria-label="Open issue on GitHub" onclick="event.stopPropagation()">GitHub</a>
                   <span class="issue-number">#${Number(r.number)||0}</span>
                </td>
                <td>
                   <span class="status-badge status-${J(r)}" role="button" tabindex="0" data-repo="${m(r.repo_full)}" data-number="${Number(r.number)||0}" onclick="window._cycleStatusFromEl(this)" onkeydown="if(event.key==='Enter'||event.key===' ')window._cycleStatusFromEl(this)" title="Click to change status">
                     ${m(M[k(r)]||"To Do")}
                   </span>
                </td>
                 <td>
                   <div class="label-list">
                     ${r.labels.filter(c=>!c.name.startsWith("priority:")&&!c.name.startsWith("status:")).slice(0,3).map(c=>f`<span class="label-chip" style="border-color:#${z(c.color)}40; color:#${z(c.color)};">${m(c.name)}</span>`).join("")}
                     ${r.labels.filter(c=>!c.name.startsWith("priority:")&&!c.name.startsWith("status:")).length>3?f`<span class="label-chip">+${r.labels.filter(c=>!c.name.startsWith("priority:")&&!c.name.startsWith("status:")).length-3}</span>`:""}
                   </div>
                 </td>
                <td style="white-space:nowrap; font-size:0.8rem; color:var(--text-secondary);">${le(r.updated_at)}</td>
                <td>
                  <div class="issue-actions">
                    <button class="small" data-repo="${m(r.repo_full)}" data-number="${Number(r.number)||0}" onclick="window._openIssueFromEl(this)">View</button>
                    <button class="small" data-repo="${m(r.repo_full)}" data-number="${Number(r.number)||0}" onclick="window._toggleIssueStateFromEl(this)">
                      ${r.state==="open"?"Close":"Reopen"}
                    </button>
                  </div>
                </td>
              </tr>
            `).join("")}
          `).join("")}
        </tbody>
      </table>
    </div>
  `}function Qe(){const e=d();if(e.loading&&e.filteredIssues.length===0)return f`
      <div class="issues-cards">
        ${Array(4).fill(0).map(()=>f`
          <div class="issue-card">
            <div class="skeleton" style="width:70%; height:20px;"></div>
            <div class="skeleton" style="width:40%; height:14px; margin-top:0.5rem;"></div>
          </div>
        `).join("")}
      </div>
    `;if(!e.loading&&e.filteredIssues.length===0)return"";const t=ue(e.filteredIssues,e.sortBy,e.sortDir);return f`
    <div class="issues-cards">
      ${t.map(o=>f`
        <div class="issue-card" role="button" tabindex="0" data-repo="${m(o.repo_full)}" data-number="${Number(o.number)||0}" onclick="window._openIssueFromEl(this)" onkeydown="if(event.key==='Enter'||event.key===' ')window._openIssueFromEl(this)">
          <div class="issue-card-header">
            <div>
              <div class="issue-card-title">${m(o.title)} <a href="${ce(o.html_url)}" target="_blank" rel="noopener noreferrer" aria-label="Open issue on GitHub" onclick="event.stopPropagation()" style="font-size:0.75rem; opacity:0.7;">GitHub</a></div>
              <div class="issue-card-meta">
                <span class="issue-card-repo">${m(o.repo)}</span>
                <span>&#183;</span>
                <span>#${Number(o.number)||0}</span>
                <span>&#183;</span>
                <span>${le(o.updated_at)}</span>
              </div>
            </div>
            <span class="priority-badge priority-${Y(o)}" role="button" tabindex="0" data-repo="${m(o.repo_full)}" data-number="${Number(o.number)||0}" onclick="event.stopPropagation(); window._cyclePriorityFromEl(this)" onkeydown="if(event.key==='Enter'||event.key===' ')event.stopPropagation(); window._cyclePriorityFromEl(this)" title="Click to change priority">${m(D[$(o)]||"None")}</span>
          </div>
          <div class="issue-card-footer">
            <span class="status-badge status-${J(o)}" role="button" tabindex="0" data-repo="${m(o.repo_full)}" data-number="${Number(o.number)||0}" onclick="event.stopPropagation(); window._cycleStatusFromEl(this)" onkeydown="if(event.key==='Enter'||event.key===' ')event.stopPropagation(); window._cycleStatusFromEl(this)">
              ${m(M[k(o)]||"To Do")}
            </span>
            <div class="label-list">
              ${o.labels.filter(s=>!s.name.startsWith("priority:")&&!s.name.startsWith("status:")).slice(0,4).map(s=>f`<span class="label-chip" style="border-color:#${z(s.color)}40; color:#${z(s.color)};">${m(s.name)}</span>`).join("")}
            </div>
            <button class="small" data-repo="${m(o.repo_full)}" data-number="${Number(o.number)||0}" onclick="event.stopPropagation(); window._toggleIssueStateFromEl(this)" style="margin-left:auto;">
              ${o.state==="open"?"Close":"Reopen"}
            </button>
          </div>
        </div>
      `).join("")}
    </div>
  `}function Xe(){const e=d();if(!e.selectedIssue)return"";const t=e.selectedIssue;return f`
    <div class="modal-overlay" onclick="if(event.target===this)window._closeIssue()">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="issue-modal-title">
        <div class="modal-header">
          <div>
            <h2 id="issue-modal-title">${m(t.title)}</h2>
            <div class="issue-card-meta" style="margin-top:0.5rem;">
              <span style="font-weight:500;">${m(t.repo_full)}</span>
              <span>&#183;</span>
              <span>#${Number(t.number)||0}</span>
              <span>&#183;</span>
            <span class="priority-badge priority-${Y(t)}" role="button" tabindex="0" data-repo="${m(t.repo_full)}" data-number="${Number(t.number)||0}" onclick="event.stopPropagation(); window._cyclePriorityFromEl(this)" onkeydown="if(event.key==='Enter'||event.key===' ')event.stopPropagation(); window._cyclePriorityFromEl(this)" title="Click to change priority">${m(D[$(t)]||"None")}</span>
              <span>&#183;</span>
              <span class="status-badge status-${J(t)}" role="button" tabindex="0" onclick="window._cycleStatusFromModal()" onkeydown="if(event.key==='Enter'||event.key===' ')window._cycleStatusFromModal()">${m(M[k(t)]||"To Do")}</span>
            </div>
          </div>
          <button class="modal-close" onclick="window._closeIssue()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-section">
            <h3>Description</h3>
            <div style="white-space:pre-wrap; line-height:1.6; font-size:0.9rem;">${m(t.body)||'<em style="color:var(--text-muted);">No description</em>'}</div>
          </div>
          <div class="modal-section">
            <h3>Actions</h3>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
              <button onclick="window._toggleIssueStateFromModal()">${t.state==="open"?"Close Issue":"Reopen Issue"}</button>
              <select id="modal-priority" onchange="window._setPriorityFromModal(this.value)" style="width:auto; min-width:120px;">
                <option value="">Set Priority...</option>
                <option value="critical" ${$(t)==="critical"?"selected":""}>Critical</option>
                <option value="high" ${$(t)==="high"?"selected":""}>High</option>
                <option value="medium" ${$(t)==="medium"?"selected":""}>Medium</option>
                <option value="low" ${$(t)==="low"?"selected":""}>Low</option>
              </select>
              <select id="modal-status" onchange="window._setStatusFromModal(this.value)" style="width:auto; min-width:140px;">
                <option value="">Set Status...</option>
                <option value="todo" ${k(t)==="todo"?"selected":""}>To Do</option>
                <option value="in-progress" ${k(t)==="in-progress"?"selected":""}>In Progress</option>
                <option value="done" ${k(t)==="done"?"selected":""}>Done</option>
              </select>
            </div>
          </div>
          <div class="modal-section">
            <h3>Comments (${t.comments_count||0})</h3>
            <div id="comments-list">
              <div class="loading-spinner"></div>
            </div>
            <div class="comment-form">
              <label class="visually-hidden" for="comment-input">Add a comment</label>
              <textarea id="comment-input" placeholder="Add a comment..."></textarea>
              <button class="primary" onclick="window._submitComment()">Post</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `}function Ze(){const e=d();return f`
    <div class="modal-overlay" onclick="if(event.target===this)window._closeSettings()">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" style="max-width:640px;">
        <div class="modal-header">
          <h2 id="settings-modal-title">Settings</h2>
          <button class="modal-close" onclick="window._closeSettings()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="settings-grid">
            <div class="settings-card">
              <h3>&#127912; Theme</h3>
              <select id="settings-theme" onchange="window._setTheme(this.value)" style="margin-bottom:0.5rem;">
                 <option value="dark" ${e.theme==="dark"?"selected":""}>Dark</option>
                 <option value="light" ${e.theme==="light"?"selected":""}>Light</option>
          <option value="bubbles" ${e.theme==="bubbles"?"selected":""}>Bubbles</option>
                 <option value="neon" ${e.theme==="neon"?"selected":""}>Neon</option>
                 <option value="pink" ${e.theme==="pink"?"selected":""}>Pink</option>
                 <option value="rainbow" ${e.theme==="rainbow"?"selected":""}>Rainbow</option>
                 <option value="sunset-glow" ${e.theme==="sunset-glow"?"selected":""}>Sunset Glow</option>
                 <option value="sky-gradient" ${e.theme==="sky-gradient"?"selected":""}>Sky Gradient</option>
                 <option value="berry-cobalt" ${e.theme==="berry-cobalt"?"selected":""}>Berry Cobalt</option>
                 <option value="ghost" ${e.theme==="ghost"?"selected":""}>Ghost</option>
                 <option value="solar" ${e.theme==="solar"?"selected":""}>Solar</option>
                 <option value="eclipse" ${e.theme==="eclipse"?"selected":""}>Eclipse</option>
                 <option value="pop" ${e.theme==="pop"?"selected":""}>Pop</option>
                 <option value="gold-signal" ${e.theme==="gold-signal"?"selected":""}>Gold Signal</option>
                 <option value="moss" ${e.theme==="moss"?"selected":""}>Moss</option>
                 <option value="zen" ${e.theme==="zen"?"selected":""}>Zen</option>
                 <option value="dusty" ${e.theme==="dusty"?"selected":""}>Dusty</option>
                 <option value="violet" ${e.theme==="violet"?"selected":""}>Violet</option>
               </select>
            </div>
            <div class="settings-card">
              <h3>&#128190; Export Layout</h3>
              <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">Download your layout config as JSON.</p>
              <button onclick="window._exportLayout()">Export Layout</button>
            </div>
            <div class="settings-card">
              <h3>&#128194; Import Layout</h3>
              <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">Upload a previously exported layout file.</p>
              <label class="visually-hidden" for="import-file">Layout JSON file</label>
              <input type="file" id="import-file" accept=".json" onchange="window._importLayout(this)">
            </div>
            <div class="settings-card">
              <h3>&#128275; Security</h3>
              <p style="font-size:0.85rem; color:var(--text-secondary);">No data is stored on any server. Your token lives in this tab's sessionStorage and is discarded when the tab closes or you log out.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `}function et(){return f`
    <div class="modal-overlay" onclick="if(event.target===this)window._closeWelcome()">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title" style="max-width:520px; text-align:center;">
        <div class="modal-header" style="justify-content:center; border-bottom:none;">
          <h2 id="welcome-modal-title" style="font-size:1.5rem;">Welcome to Issuez</h2>
        </div>
        <div class="modal-body">
          <p style="color:var(--text-secondary); margin-bottom:1.5rem; font-size:0.95rem;">
            Your cross-repo GitHub issue dashboard is ready.
            Browse, search, and manage issues across all your repositories in one place.
          </p>
          <button class="primary" onclick="window._closeWelcome()" style="min-width:160px;">Get Started</button>
        </div>
      </div>
    </div>
  `}function tt(){const e=d();return e.error?f`
    <div class="error-state" style="margin:1rem 0;">
      <span>&#9888;</span>
      <div style="flex:1;">
        <strong>Error</strong>
        <div style="font-size:0.85rem; color:var(--text-secondary);">${m(e.error)}</div>
      </div>
      <button onclick="window._dismissError()">Dismiss</button>
    </div>
  `:""}const O=new Map;function ot(e){S("#region-header",e)||(e.innerHTML=f`
    <div id="region-header"></div>
    <main class="app-main">
      <div id="region-error"></div>
      <div id="region-stats"></div>
      <div id="region-toolbar"></div>
      <div id="region-issues"></div>
      <div id="region-cards"></div>
    </main>
    <div id="region-modal"></div>
    <div id="region-settings"></div>
    <div id="region-welcome"></div>
  `,O.clear())}function w(){const e=d(),t=S("#app");if(!t)return;const o=document.activeElement;if(!he()){t.innerHTML=Ve(),O.clear(),ie(null);return}ot(t);const s=[["region-header",qe],["region-error",tt],["region-stats",Je],["region-toolbar",Ye],["region-issues",Ke],["region-cards",Qe],["region-modal",Xe],["region-settings",()=>e.showSettings?Ze():""],["region-welcome",()=>e.showWelcome?et():""]];for(const[n,i]of s){const r=i();if(O.get(n)===r)continue;O.set(n,r);const c=document.getElementById(n);c&&(c.innerHTML=r)}st(),ie(o),we(),gt()}function st(){const e=S("#search-input");e&&e.value!==d().searchQuery&&(e.value=d().searchQuery)}function P(){const e=d();let t=[...e.issues];if(e.searchQuery){const o=e.searchQuery.toLowerCase();t=t.filter(s=>s.title.toLowerCase().includes(o)||s.body.toLowerCase().includes(o))}if(e.filterState!=="all"&&(t=t.filter(o=>o.state===e.filterState)),e.filterAssignee==="me"&&(t=t.filter(o=>{var s;return(s=o.assignees)==null?void 0:s.some(n=>{var i;return n.login===((i=e.user)==null?void 0:i.login)})})),e.showArchivedRepos===!1){const o=new Set((e.repos||[]).filter(s=>s.archived).map(s=>s.full_name));o.size&&(t=t.filter(s=>!o.has(s.repo_full)))}p({filteredIssues:t})}async function Q(){p({loading:!0,error:null});const e=[],t=(o,s)=>(console.warn(`[issuez] Could not ${o}. That source is missing from this dashboard — check the token scopes (repo, read:org), then refresh.`,s),e.push(o),[]);try{const o=await De(),[s,n]=await Promise.all([Me(),Ne().catch(u=>t("list your organizations",u))]),i=await Promise.all(n.map(u=>Ue(u.login).catch(y=>t(`list repositories for ${u.login}`,y)))),r=[...s,...i.flat()],c=Array.from(new Map(r.map(u=>[u.full_name,u])).values());p({repos:c,user:o});const l=[];let b=!1;for(const u of c){if(Re()){b=!0;break}const[y,a]=await Promise.all([ee(u.owner.login,u.name,"open").catch(h=>t(`load open issues for ${u.full_name}`,h)),ee(u.owner.login,u.name,"closed").catch(h=>t(`load closed issues for ${u.full_name}`,h))]);l.push(...y,...a)}const v=l.map(ve);p({issues:v}),P(),b?g("GitHub rate limit reached — showing partial results","error"):e.length?g(`${e.length} source${e.length===1?"":"s"} failed to load — showing partial results`,"error"):g(`Loaded ${v.length} issues`,"success")}catch(o){p({error:o.message}),g(o.message,"error")}finally{p({loading:!1})}}async function nt(e){K(e),sessionStorage.setItem(V,e),w(),await Q(),p({showWelcome:!0})}function rt(){K(null),sessionStorage.removeItem(V),p({user:null,issues:[],filteredIssues:[],repos:[],loading:!1,selectedIssue:null,error:null,showWelcome:!1,showSettings:!1}),w()}async function it(e,t){try{const o=await Oe(e.split("/")[0],e.split("/")[1],t),s=ve(o);s.comments_count=o.comments,p({selectedIssue:s}),w(),A(e,t)}catch(o){g(o.message,"error")}}async function A(e,t){const o=S("#comments-list");if(o)try{const s=await Fe(e.split("/")[0],e.split("/")[1],t);if(s.length===0){o.innerHTML='<p style="color:var(--text-muted); font-size:0.85rem;">No comments yet.</p>';return}o.innerHTML=s.map(n=>f`
      <div class="comment">
        <div class="comment-header">
          <img src="${de(n.user.avatar_url)}" style="width:20px; height:20px; border-radius:50%;" alt="${m(n.user.login)}">
          <span class="comment-author">${m(n.user.login)}</span>
          <span class="comment-date">${Ee(n.created_at)}</span>
        </div>
        <div class="comment-body">${m(n.body)}</div>
      </div>
    `).join("")}catch(s){o.innerHTML=`<div class="error-state">${m(s.message)}</div>`}}async function at(){var s;const e=S("#comment-input"),t=(s=e==null?void 0:e.value)==null?void 0:s.trim();if(!t||!d().selectedIssue)return;const o=d().selectedIssue;try{await ze(o.repo_full.split("/")[0],o.repo_full.split("/")[1],o.number,t),e.value="",g("Comment posted","success"),A(o.repo_full,o.number)}catch(n){g(n.message,"error")}}async function te(e,t){const o=d().issues.find(s=>s.repo_full===e&&s.number===t);if(o)try{const s=o.state==="open"?"closed":"open";await He(e.split("/")[0],e.split("/")[1],t,{state:s}),g(`Issue ${s}`,"success");const n={...o,state:s};p({issues:d().issues.map(i=>i.repo_full===e&&i.number===t?n:i),filteredIssues:d().filteredIssues.map(i=>i.repo_full===e&&i.number===t?n:i),selectedIssue:n}),w(),setTimeout(()=>A(e,t),50)}catch(s){g(s.message,"error")}}async function oe(e,t){const o=["todo","in-progress","done"],s=d().issues.find(v=>v.repo_full===e&&v.number===t);if(!s)return;const n=k(s)||"todo",i=o[(o.indexOf(n)+1)%o.length],r=`status:${i}`,c=e.split("/")[0],l=e.split("/")[1],b=[];n!=="todo"&&b.push(B(c,l,t,`status:${n}`).catch(()=>{})),b.push(H(c,l,t,r));try{await Promise.all(b),g(`Status set to ${M[i]}`,"success");const v=s.labels.filter(y=>!y.name.startsWith("status:")).concat({name:r,color:"a2eeef"}),u={...s,labels:v};p({issues:d().issues.map(y=>y.repo_full===e&&y.number===t?u:y),filteredIssues:d().filteredIssues.map(y=>y.repo_full===e&&y.number===t?u:y),selectedIssue:u}),w(),setTimeout(()=>A(e,t),50)}catch(v){g(v.message,"error")}}async function se(e,t){const o=["critical","high","medium","low"],s=d().issues.find(u=>u.repo_full===e&&u.number===t);if(!s)return;const n=$(s),i=o.indexOf(n||""),r=i>=0?o[(i+1)%o.length]:"critical",c=`priority:${r}`,l=e.split("/")[0],b=e.split("/")[1],v=[];n&&v.push(B(l,b,t,`priority:${n}`).catch(()=>{})),v.push(H(l,b,t,c));try{await Promise.all(v),g(`Priority set to ${D[r]}`,"success");const u=s.labels.filter(a=>!a.name.startsWith("priority:")).concat({name:c,color:"b60205"}),y={...s,labels:u};p({issues:d().issues.map(a=>a.repo_full===e&&a.number===t?y:a),filteredIssues:d().filteredIssues.map(a=>a.repo_full===e&&a.number===t?y:a),selectedIssue:y}),w(),setTimeout(()=>A(e,t),50)}catch(u){g(u.message,"error")}}async function lt(e){const t=d().selectedIssue;if(!t||!e)return;const o=t.repo_full.split("/")[0],s=t.repo_full.split("/")[1],n=[],i=$(t);i&&n.push(B(o,s,t.number,`priority:${i}`).catch(()=>{})),n.push(H(o,s,t.number,`priority:${e}`));try{await Promise.all(n),g(`Priority set to ${D[e]}`,"success");const r=t.labels.filter(l=>!l.name.startsWith("priority:")).concat({name:`priority:${e}`,color:"b60205"}),c={...t,labels:r};p({issues:d().issues.map(l=>l.repo_full===t.repo_full&&l.number===t.number?c:l),filteredIssues:d().filteredIssues.map(l=>l.repo_full===t.repo_full&&l.number===t.number?c:l),selectedIssue:c}),w(),setTimeout(()=>A(t.repo_full,t.number),50)}catch(r){g(r.message,"error")}}async function ct(e){const t=d().selectedIssue;if(!t||!e)return;const o=t.repo_full.split("/")[0],s=t.repo_full.split("/")[1],n=[],i=k(t);i&&i!=="todo"&&n.push(B(o,s,t.number,`status:${i}`).catch(()=>{})),n.push(H(o,s,t.number,`status:${e}`));try{await Promise.all(n),g(`Status set to ${M[e]}`,"success");const r=t.labels.filter(l=>!l.name.startsWith("status:")).concat({name:`status:${e}`,color:"a2eeef"}),c={...t,labels:r};p({issues:d().issues.map(l=>l.repo_full===t.repo_full&&l.number===t.number?c:l),filteredIssues:d().filteredIssues.map(l=>l.repo_full===t.repo_full&&l.number===t.number?c:l),selectedIssue:c}),w(),setTimeout(()=>A(t.repo_full,t.number),50)}catch(r){g(r.message,"error")}}function dt(){x=document.activeElement,p({showSettings:!0})}function ut(){p({showSettings:!1})}function $e(){const e=d();p({layout:{theme:e.theme,sortBy:e.sortBy,sortDir:e.sortDir}}),Ge()}function pt(){const{layout:e}=d();if(e&&typeof e=="object"){const t={};e.sortBy&&(t.sortBy=e.sortBy),e.sortDir&&(t.sortDir=e.sortDir),Object.keys(t).length&&p(t)}}function mt(){const e=d(),t={theme:e.theme,sortBy:e.sortBy,sortDir:e.sortDir,columns:["priority","issue","status","labels","updated","actions"],exportedAt:new Date().toISOString()},o=new Blob([JSON.stringify(t,null,2)],{type:"application/json"}),s=URL.createObjectURL(o),n=document.createElement("a");n.href=s,n.download="issuez-layout.json",n.click(),setTimeout(()=>URL.revokeObjectURL(s),0),g("Layout exported","success")}function ht(e){var s;const t=(s=e.files)==null?void 0:s[0];if(!t)return;const o=new FileReader;o.onload=n=>{try{const i=JSON.parse(n.target.result);i.theme&&(p({theme:i.theme}),j(i.theme),be()),i.sortBy&&p({sortBy:i.sortBy,sortDir:i.sortDir||"asc"}),$e(),g("Layout imported","success")}catch{g("Invalid layout file","error")}},o.readAsText(t)}function ft(){const e=t=>[t.dataset.repo,Number(t.dataset.number)];window._setTheme=t=>{p({theme:t}),j(t),be()},window._logout=rt,window._patLogin=()=>{var o,s;const t=(s=(o=S("#pat-input"))==null?void 0:o.value)==null?void 0:s.trim();if(!t)return g("Enter a PAT","warning");nt(t)},window._onSearch=Ie(t=>{p({searchQuery:t}),P()},200),window._setFilter=(t,o)=>{t==="state"&&p({filterState:o}),t==="assignee"&&p({filterAssignee:o}),P()},window._toggleArchived=t=>{p({showArchivedRepos:t}),P()},window._setSort=t=>{const o=d();o.sortBy===t?p({sortDir:o.sortDir==="asc"?"desc":"asc"}):p({sortBy:t,sortDir:"asc"}),P(),$e(),w()},window._refresh=async()=>{await Q()},window._closeIssue=()=>{p({selectedIssue:null}),w()},window._openSettings=dt,window._closeSettings=ut,window._closeWelcome=()=>{p({showWelcome:!1}),w()},window._toggleIssueStateFromModal=()=>{const t=d().selectedIssue;t&&te(t.repo_full,t.number)},window._cyclePriority=se,window._cycleStatusFromModal=()=>{const t=d().selectedIssue;t&&oe(t.repo_full,t.number)},window._setPriorityFromModal=lt,window._setStatusFromModal=ct,window._submitComment=at,window._exportLayout=mt,window._importLayout=ht,window._dismissError=()=>p({error:null}),window._openIssueFromEl=t=>{x=t,it(...e(t))},window._toggleIssueStateFromEl=t=>te(...e(t)),window._cyclePriorityFromEl=t=>se(...e(t)),window._cycleStatusFromEl=t=>oe(...e(t))}function gt(){document.querySelectorAll("select").forEach(e=>{var v,u,y;if(e.closest(".select-wrapper"))return;const t=document.createElement("div");t.className="select-wrapper";const o=document.createElement("button");o.type="button",o.className="select-trigger",o.id=`${e.id||"select"}-trigger`,o.setAttribute("aria-haspopup","listbox"),o.setAttribute("aria-expanded","false"),o.setAttribute("aria-controls",`${o.id}-listbox`);const s=((v=e.labels)==null?void 0:v[0])||((u=e.closest(".filter-group, .settings-card, div"))==null?void 0:u.querySelector("label"));s&&o.setAttribute("aria-label",s.textContent.trim());const n=document.createElement("span");n.className="select-value",n.textContent=((y=e.options[e.selectedIndex])==null?void 0:y.textContent)||"",o.appendChild(n);const i=document.createElement("div");i.className="select-dropdown",i.id=`${o.id}-listbox`,i.setAttribute("role","listbox"),i.setAttribute("aria-labelledby",o.id);const r=Array.from(e.options).map(a=>{const h=document.createElement("div");return h.className="select-option"+(a.selected?" selected":""),h.textContent=a.textContent,h.dataset.value=a.value,h.setAttribute("role","option"),h.setAttribute("aria-selected",a.selected?"true":"false"),h.tabIndex=a.selected?0:-1,h.addEventListener("click",()=>{ne(e,a.value)}),i.appendChild(h),h});t.appendChild(o),t.appendChild(i),e.parentNode.insertBefore(t,e),t.appendChild(e),e.style.display="none";const c=a=>{G(),t.classList.add("open"),o.setAttribute("aria-expanded","true");const h=Number.isInteger(a)?r[a]:r.find(I=>I.dataset.value===e.value)||r[0];r.forEach(I=>{I.tabIndex=-1}),h&&(h.tabIndex=0,h.focus())},l=a=>{t.classList.remove("open"),o.setAttribute("aria-expanded","false"),a&&o.focus()},b=a=>{const h=Math.max(0,Math.min(r.length-1,a));r.forEach(I=>{I.tabIndex=-1}),r[h].tabIndex=0,r[h].focus()};o.addEventListener("click",a=>{a.stopPropagation(),t.classList.contains("open")?l(!1):c()}),o.addEventListener("keydown",a=>{a.key==="ArrowDown"||a.key==="ArrowUp"?(a.preventDefault(),c()):a.key==="Escape"&&t.classList.contains("open")?(a.preventDefault(),l(!0)):a.key==="Tab"&&l(!1)}),i.addEventListener("keydown",a=>{const h=r.indexOf(document.activeElement);if(a.key==="ArrowDown")a.preventDefault(),b(h+1);else if(a.key==="ArrowUp")a.preventDefault(),b(h<=0?r.length-1:h-1);else if(a.key==="Home")a.preventDefault(),b(0);else if(a.key==="End")a.preventDefault(),b(r.length-1);else if(a.key==="Enter"||a.key===" "){a.preventDefault();const I=r[h];I&&ne(e,I.dataset.value,!0)}else a.key==="Escape"?(a.preventDefault(),l(!0)):a.key==="Tab"&&l(!1)})})}function ne(e,t,o=!1){var s;e.value=t,e.dispatchEvent(new Event("change")),G(),yt(),o&&((s=document.getElementById(`${e.id}-trigger`))==null||s.focus())}function G(){document.querySelectorAll(".select-wrapper.open").forEach(e=>{var t;e.classList.remove("open"),(t=e.querySelector(".select-trigger"))==null||t.setAttribute("aria-expanded","false")})}function yt(){document.querySelectorAll(".select-wrapper").forEach(e=>{var s;const t=e.querySelector("select"),o=e.querySelector(".select-value");t&&o&&(o.textContent=((s=t.options[t.selectedIndex])==null?void 0:s.textContent)||"",e.querySelectorAll(".select-option").forEach(i=>{const r=i.dataset.value===t.value;i.classList.toggle("selected",r),i.setAttribute("aria-selected",r?"true":"false"),i.tabIndex=r?0:-1}))})}function vt(){window.addEventListener("unhandledrejection",e=>{var t;console.error("[issuez] Unhandled promise rejection — a background API call failed and nothing surfaced it.",e.reason),g(((t=e.reason)==null?void 0:t.message)||"Something went wrong","error")}),window.addEventListener("error",e=>{console.error("[issuez] Uncaught error",e.error||e.message)})}let U=null,x=null;const _e=[["region-modal",()=>p({selectedIssue:null})],["region-settings",()=>p({showSettings:!1})],["region-welcome",()=>p({showWelcome:!1})]],re=()=>_e.map(([e])=>S(`#${e} .modal`)).filter(Boolean);function ke(e){return Se('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',e).filter(t=>!t.disabled&&t.tabIndex!==-1)}const X=()=>re()[re().length-1]||null;function ie(e){const t=X();if(t!==U){if(t){!U&&e&&e!==document.body&&(x=e),U=t,(ke(t)[0]||t).focus();return}U=null,x&&x.isConnected&&x.focus(),x=null}}function bt(){const e=X();if(!e)return!1;const t=_e.find(([o])=>S(`#${o} .modal`)===e);return t?(t[1](),w(),!0):!1}function wt(e){const t=X();if(e.key==="Escape"){if(t&&e.defaultPrevented)return;t?(e.preventDefault(),bt()):document.querySelector(".select-wrapper.open")&&G();return}if(e.key!=="Tab"||!t)return;const o=ke(t);if(o.length===0)return;const s=o[0],n=o[o.length-1];!e.shiftKey&&document.activeElement===n?(e.preventDefault(),s.focus()):e.shiftKey&&document.activeElement===s&&(e.preventDefault(),n.focus())}async function ae(){vt(),We(),je(),j(d().theme),pt(),ft(),Be(w),document.addEventListener("click",t=>{t.target.closest(".select-wrapper")||G()}),document.addEventListener("keydown",wt);const e=sessionStorage.getItem(V);e?(K(e),w(),await Q()):w()}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",ae):ae();
