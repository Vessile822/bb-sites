/* @meta
{
  "name": "1688/search",
  "description": "Search for products on 1688 and retrieve name, price, image, and URL",
  "domain": "s.1688.com",
  "args": {
    "keyword": {"required": true, "description": "Search keyword for finding products"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site 1688/search 键盘"
}
*/

async function(args) {
  if (!args.keyword) return {error: 'Missing argument: keyword'};
  
  // Fetch the search HTML page
  const url = `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(args.keyword)}&n=y&netType=1%2C11`;
  const resp = await fetch(url, {credentials: 'include'});
  
  if (!resp.ok) {
    return {
      error: 'HTTP ' + resp.status,
      hint: 'Your browser might be blocked by 1688 anti-bot, or not logged in.'
    };
  }
  
  const text = await resp.text();
  
  // Attempt to parse the injected __INIT_DATA object from the 1688 response page
  const initDataMatch = text.match(/window\.__INIT_DATA[\s=]+({.+?})[\s;]*<\/script>/s);
  let products = [];
  
  if (initDataMatch && initDataMatch[1]) {
    try {
      const initData = JSON.parse(initDataMatch[1]);
      // Extract from the typical 1688 data structure
      // Note: Data structure might change, so we try multiple common paths
      let offerList = [];
      const globalData = initData?.globalData || initData?.data || {};
      
      const findOfferList = (obj) => {
        if (!obj) return null;
        if (Array.isArray(obj.offerList)) return obj.offerList;
        for (const key in obj) {
          if (typeof obj[key] === 'object') {
            const found = findOfferList(obj[key]);
            if (found) return found;
          }
        }
        return null;
      };
      
      offerList = findOfferList(initData) || [];
      
      products = offerList.map((item) => ({
        title: item.information?.subject || item.title || '',
        url: item.information?.detailUrl || item.detailUrl || '',
        imageUrl: item.image?.imgUrl || item.imgUrl || '',
        price: item.price?.priceInfo?.price || item.price || '',
        sales: item.saleQuantity || '',
        company: item.company?.name || ''
      }));
    } catch (e) {
      console.error('Failed to parse __INIT_DATA:', e);
    }
  }
  
  // Fallback to basic DOM parsing if we're evaluating on the page directly and the URL matches
  if (products.length === 0 && window.location.href.includes('offer_search.htm')) {
    const items = document.querySelectorAll('.offer-list-row-offer, .sm-offer-item');
    items.forEach(item => {
      const titleEl = item.querySelector('.title, .offer-title, [title]');
      const priceEl = item.querySelector('.price, .offer-price');
      const imgEl = item.querySelector('img');
      const linkEl = item.querySelector('a');
      
      if (titleEl && linkEl) {
        products.push({
          title: titleEl.innerText || titleEl.getAttribute('title'),
          url: linkEl.href,
          imageUrl: imgEl ? (imgEl.src || imgEl.getAttribute('data-src')) : '',
          price: priceEl ? priceEl.innerText : ''
        });
      }
    });
  }
  
  if (products.length === 0) {
    return {
      error: 'Data extraction failed', 
      hint: '1688 may have changed its page structure, or blocked the request.'
    };
  }
  
  return {
    keyword: args.keyword,
    count: products.length,
    products: products
  };
}
