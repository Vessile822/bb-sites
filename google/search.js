/* @meta
{
  "name": "google/search",
  "description": "Google 搜索",
  "domain": "www.google.com",
  "args": {
    "query": {"required": true, "description": "Search query"},
    "count": {"required": false, "description": "Number of results (default 10)"}
  },
  "readOnly": true,
  "example": "bb-browser site google/search \"bb-browser\""
}
*/

async function(args) {
  if (!args.query) return {error: 'Missing argument: query', hint: 'Provide a search query string'};
  const num = args.count || 10;
  const url = 'https://www.google.com/search?q=' + encodeURIComponent(args.query) + '&num=' + num;
  const resp = await fetch(url, {credentials: 'include'});
  if (!resp.ok) return {error: 'HTTP ' + resp.status, hint: 'Make sure a google.com tab is open'};
  const html = await resp.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const items = doc.querySelectorAll('div.g');
  const results = [];
  items.forEach(el => {
    const anchor = el.querySelector('a[href]');
    const heading = el.querySelector('h3');
    if (!anchor || !heading) return;
    const link = anchor.getAttribute('href');
    if (!link || link.startsWith('/search')) return;
    // Snippet lives in various containers; grab the first sizeable text block after the heading
    let snippet = '';
    const spans = el.querySelectorAll('span');
    for (const sp of spans) {
      const txt = sp.textContent.trim();
      if (txt.length > 40 && txt !== heading.textContent.trim()) {
        snippet = txt;
        break;
      }
    }
    if (!snippet) {
      // fallback: grab text from the element excluding the heading/link area
      const cloned = el.cloneNode(true);
      const h = cloned.querySelector('h3');
      if (h) h.remove();
      const a = cloned.querySelector('a');
      if (a) a.remove();
      snippet = cloned.textContent.trim().substring(0, 300);
    }
    results.push({title: heading.textContent.trim(), url: link, snippet: snippet});
  });
  return {query: args.query, count: results.length, results: results};
}
