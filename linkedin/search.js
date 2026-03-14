/* @meta
{
  "name": "linkedin/search",
  "description": "搜索 LinkedIn 帖子",
  "domain": "www.linkedin.com",
  "args": {
    "query": {"required": true, "description": "Search keyword"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site linkedin/search \"AI agent\""
}
*/

async function(args) {
  if (!args.query) return {error: 'Missing argument: query'};

  const jsessionid = document.cookie.split(';').map(c => c.trim())
    .find(c => c.startsWith('JSESSIONID='))?.split('=').slice(1).join('=');
  if (!jsessionid) return {error: 'No JSESSIONID cookie'};
  const csrfToken = jsessionid.replace(/"/g, '');

  const searchUrl = '/search/results/content/?keywords=' + encodeURIComponent(args.query);
  const resp = await fetch(searchUrl, {
    credentials: 'include',
    headers: { 'csrf-token': csrfToken }
  });

  if (!resp.ok) return {error: 'HTTP ' + resp.status};

  const html = await resp.text();
  
  // Look at the "Everyone" context - wider range to see surrounding structure
  let idx = html.indexOf('Everyone is talking about AI agents');
  const wideContext = idx !== -1 ? html.substring(Math.max(0, idx - 2000), idx + 1000) : 'NOT FOUND';
  
  // Find author name patterns near posts - look for aria-label with 关注
  const followSamples = [];
  idx = -1;
  for (let i = 0; i < 5; i++) {
    idx = html.indexOf('aria-label', idx + 1);
    if (idx === -1) break;
    // Skip if too early in the document (header/nav stuff)
    if (idx < 400000) continue;
    followSamples.push({
      pos: idx,
      context: html.substring(idx, idx + 200)
    });
  }
  
  // Look for "accessibilityText" or "title" patterns that might have author names
  const titleSamples = [];
  idx = 700000;
  for (let i = 0; i < 5; i++) {
    idx = html.indexOf('accessibilityText', idx + 1);
    if (idx === -1) break;
    titleSamples.push({
      pos: idx,
      context: html.substring(Math.max(0, idx - 100), idx + 300)
    });
  }
  
  // Look for "actorName" or "name" near the post area
  const nameSamples = [];
  idx = 700000;
  for (let i = 0; i < 5; i++) {
    idx = html.indexOf('actorName', idx + 1);
    if (idx === -1) break;
    nameSamples.push({
      pos: idx,
      context: html.substring(Math.max(0, idx - 100), idx + 300)
    });
  }

  // Look for patterns around "commentaryViewType" which seems to mark posts
  const commentaryViewSamples = [];
  idx = 700000;
  for (let i = 0; i < 3; i++) {
    idx = html.indexOf('commentaryViewType', idx + 1);
    if (idx === -1) break;
    commentaryViewSamples.push({
      pos: idx,
      // Get wide context going forward to see what follows
      context: html.substring(Math.max(0, idx - 500), idx + 2000)
    });
  }

  return {
    htmlLen: html.length,
    wideContextLen: wideContext.length,
    wideContext: wideContext.substring(0, 3000),
    followSamples,
    titleSamples,
    nameSamples,
    commentaryViewSamples: commentaryViewSamples.map(s => ({pos: s.pos, context: s.context.substring(0, 1500)}))
  };
}
