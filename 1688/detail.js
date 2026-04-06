/* @meta
{
  "name": "1688/detail",
  "description": "Get detailed information of a 1688 product (Name, URL, Main Image, Price, Reviews, Attributes)",
  "domain": "detail.1688.com",
  "args": {
    "urlOrId": {"required": true, "description": "1688 Product Offer ID or Full URL"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site 1688/detail 12345678"
}
*/

async function(args) {
  if (!args.urlOrId) return {error: 'Missing argument: urlOrId'};
  
  // Parse ID out of the passed string (if it's a URL or just ID)
  let offerId = args.urlOrId;
  const matchUrl = args.urlOrId.match(/offer\/(\d+)\.html/);
  if (matchUrl) {
    offerId = matchUrl[1];
  } else if (!/^\d+$/.test(offerId)) {
    return {error: 'Invalid urlOrId format', hint: 'Must be a numeric offer ID or detail.1688.com URL'};
  }
  
  const targetUrl = `https://detail.1688.com/offer/${offerId}.html`;
  const resp = await fetch(targetUrl, {credentials: 'include'});
  
  if (!resp.ok) {
    return {error: 'HTTP ' + resp.status, hint: 'Failed to access 1688 product page.'};
  }
  
  const text = await resp.text();
  
  // We'll create a structured response object
  const details = {
    url: targetUrl,
    title: '',
    price: '',
    imageUrl: '',
    attributes: {},
    reviews: []
  };

  // 1688 often embeds critical data in window.__INIT_DATA
  const initDataMatch = text.match(/window\.__INIT_DATA[\s=]+({.+?})[\s;]*<\/script>/s);
  
  if (initDataMatch && initDataMatch[1]) {
    try {
      const initData = JSON.parse(initDataMatch[1]);
      const globalData = initData?.globalData || {};
      
      // Attempt to extract from globalData structure
      if (globalData.title) details.title = globalData.title;
      if (globalData.images && globalData.images.length > 0) {
        details.imageUrl = globalData.images[0];
      }
      
      // Extract price (could be range)
      if (globalData.skuModel?.skuPriceScale) {
        details.price = globalData.skuModel.skuPriceScale;
      } else if (globalData.orderParamModel?.orderParam?.price) {
        details.price = globalData.orderParamModel.orderParam.price;
      }
      
      // Extract attributes
      if (Array.isArray(globalData.skuModel?.skuProps)) {
        globalData.skuModel.skuProps.forEach(prop => {
          details.attributes[prop.prop] = prop.value?.map(v => v.name).join(', ');
        });
      }
      
      // General product properties
      if (Array.isArray(globalData.moduleData?.components)) {
        const propComponent = globalData.moduleData.components.find(c => c.componentType === 'customAttribute');
        if (propComponent?.data?.attributes) {
          propComponent.data.attributes.forEach(attr => {
            details.attributes[attr.name] = attr.value;
          });
        }
      }
    } catch (e) {
      console.error('JSON Parsing failed for 1688 detail page: ', e);
    }
  }

  // Backup regex scraping for the HTML page directly if JSON mapping fails
  if (!details.title) {
    const titleMatch = text.match(/<h1[^>]*>([^<]+)<\/h1>/) || text.match(/<title>([^<]+)<\/title>/);
    details.title = titleMatch ? titleMatch[1].trim() : '';
  }
  
  if (!details.imageUrl) {
    const imgMatch = text.match(/<img[^>]+id="dt-tab-0"[^>]+src="([^"]+)"/i) || text.match(/<img[^>]+class="[^"]*img[-_]detail[^"]*"[^>]+src="([^"]+)"/i);
    details.imageUrl = imgMatch ? imgMatch[1] : '';
  }
  
  if (!details.price) {
    const priceMatch = text.match(/<span[^>]+class="price[^"]*"[^>]*>([^<]+)<\/span>/i);
    details.price = priceMatch ? priceMatch[1].trim() : '';
  }
  
  // Note: Reviews (评价) are usually loaded asynchronously through an API endpoint.
  // bb-sites adapters usually just return what's available without navigating.
  // Since fetching reviews requires a signed mtop request on 1688, we might not get full reviews 
  // via simple HTML fetch unless we hit the specific mtop endpoint which requires signing. 
  // We'll note this limitation in the output or try to extract review count.
  const reviewCountMatch = text.match(/累计评价<\/span>\s*<em[^>]*>(\d+|\d+[万+]+)<\/em>/);
  if (reviewCountMatch) {
    details.reviews = { summary: `Total Reviews: ${reviewCountMatch[1]} (Full reviews require mtop API access)` };
  } else {
    details.reviews = { summary: 'Detailed reviews load asynchronously via mtop and cannot be statically fetched.' };
  }

  return details;
}
