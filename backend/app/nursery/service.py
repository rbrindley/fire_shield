"""Nursery plant search service — Nature Hills integration."""

import logging
import re
import urllib.parse

import httpx

logger = logging.getLogger(__name__)

NURSERY_NAME = "Succulents Box"
NURSERY_SEARCH_URL = "https://www.succulentsbox.com/search"
NURSERY_BASE = "https://www.succulentsbox.com"

# Browser-like headers to avoid basic bot detection
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

# Demo catalog — hardcoded Shopify products for reliable demo presentations
# variant_id is the Shopify variant used for add-to-cart URLs
DEMO_CATALOG: dict[str, list[dict]] = {
    "aloe": [
        {
            "name": "Aloe Vera — 3\" Pot",
            "price": "$21.50",
            "url": f"{NURSERY_BASE}/products/aloe-vera-1",
            "variant_id": "47209292824750",
        },
        {
            "name": "Aloe 'Snow' — 4\" Pot",
            "price": "$10.99",
            "url": f"{NURSERY_BASE}/products/aloe-snow",
            "variant_id": "47478416703662",
        },
    ],
    "agave": [
        {
            "name": "Blue Glow Agave Century Plant — 2\" Pot",
            "price": "$9.99",
            "url": f"{NURSERY_BASE}/products/blue-glow-agave-century-plant",
            "variant_id": "44087609458862",
        },
    ],
    "lavender": [
        {
            "name": "Phenomenal Lavender",
            "price": "$12.59",
            "url": "https://www.highcountrygardens.com/products/perennial-lavandula-intermedia-phenomenal",
            "variant_id": None,  # High Country Gardens — no direct cart URL
        },
    ],
}


async def search_nursery(
    plant_name: str,
    scientific_name: str | None = None,
    quantity: int = 1,
) -> dict:
    """Search Nature Hills Nursery for a plant.

    Returns a dict with:
    - search_url: Direct link to search results (always available)
    - products: List of {name, price, url, add_to_cart_url} if found
    - source: "demo_catalog", "scraped", or "search_url_only"
    """
    query = plant_name
    if scientific_name:
        query = f"{plant_name} {scientific_name}"

    search_url = f"{NURSERY_SEARCH_URL}?q={urllib.parse.quote(query)}"

    # Check demo catalog first (case-insensitive)
    lookup_key = plant_name.lower().strip()
    if lookup_key in DEMO_CATALOG:
        products = []
        for p in DEMO_CATALOG[lookup_key]:
            product = {**p, "quantity": quantity}
            # Build Shopify add-to-cart URL if variant_id is available
            if p.get("variant_id"):
                product["add_to_cart_url"] = (
                    f"{NURSERY_BASE}/cart/add"
                    f"?id={p['variant_id']}&quantity={quantity}"
                    f"&return_to=/cart"
                )
            else:
                product["add_to_cart_url"] = p["url"]
            products.append(product)
        return {
            "plant_name": plant_name,
            "nursery": NURSERY_NAME,
            "search_url": search_url,
            "products": products,
            "quantity": quantity,
            "source": "demo_catalog",
        }

    result = {
        "plant_name": plant_name,
        "nursery": NURSERY_NAME,
        "search_url": search_url,
        "products": [],
        "quantity": quantity,
        "source": "search_url_only",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(search_url, headers=HEADERS)

            if resp.status_code != 200:
                logger.info(
                    f"{NURSERY_NAME} returned {resp.status_code} for '{query}'"
                )
                return result

            html = resp.text

            products = _parse_search_results(html)
            if products:
                result["products"] = products
                result["source"] = "scraped"
                logger.info(
                    f"Found {len(products)} products for '{query}' at {NURSERY_NAME}"
                )

    except httpx.TimeoutException:
        logger.info(f"Timeout searching {NURSERY_NAME} for '{query}'")
    except Exception as e:
        logger.info(f"Failed to scrape {NURSERY_NAME} for '{query}': {e}")

    return result


def _parse_search_results(html: str) -> list[dict]:
    """Extract product names, prices, and URLs from Nature Hills search HTML.

    Uses basic regex — no BeautifulSoup dependency needed.
    Falls back gracefully if the HTML structure changes.
    """
    products = []

    # Look for product links with prices in the search results
    # Nature Hills uses structured product cards
    product_pattern = re.compile(
        r'<a[^>]+href="(https://www\.naturehills\.com/[^"]+)"[^>]*class="[^"]*product[^"]*"[^>]*>'
        r'[^<]*<[^>]*>([^<]+)',
        re.IGNORECASE,
    )

    price_pattern = re.compile(
        r'\$(\d+\.\d{2})',
    )

    # Simpler approach: find product-name + price pairs
    name_matches = re.findall(
        r'product-item-link[^>]*href="([^"]+)"[^>]*>\s*([^<]+)',
        html,
        re.IGNORECASE,
    )

    prices = price_pattern.findall(html)

    for i, (url, name) in enumerate(name_matches[:5]):
        product = {
            "name": name.strip(),
            "url": url.strip(),
            "price": f"${prices[i]}" if i < len(prices) else None,
        }
        products.append(product)

    return products
