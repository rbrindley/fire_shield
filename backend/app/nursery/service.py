"""Nursery plant search service — Nature Hills integration."""

import logging
import re
import urllib.parse

import httpx

logger = logging.getLogger(__name__)

NATURE_HILLS_SEARCH_URL = "https://www.naturehills.com/catalogsearch/result/"

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


async def search_nursery(
    plant_name: str,
    scientific_name: str | None = None,
) -> dict:
    """Search Nature Hills Nursery for a plant.

    Returns a dict with:
    - search_url: Direct link to search results (always available)
    - products: List of {name, price, url} if scraping succeeds
    - source: "scraped" or "search_url_only"
    """
    query = plant_name
    if scientific_name:
        query = f"{plant_name} {scientific_name}"

    search_url = f"{NATURE_HILLS_SEARCH_URL}?q={urllib.parse.quote(query)}"

    result = {
        "plant_name": plant_name,
        "search_url": search_url,
        "products": [],
        "source": "search_url_only",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(search_url, headers=HEADERS)

            if resp.status_code != 200:
                logger.info(
                    f"Nature Hills returned {resp.status_code} for '{query}'"
                )
                return result

            html = resp.text

            # Try to extract product info from search results
            products = _parse_search_results(html)
            if products:
                result["products"] = products
                result["source"] = "scraped"
                logger.info(
                    f"Found {len(products)} products for '{query}' at Nature Hills"
                )

    except httpx.TimeoutException:
        logger.info(f"Timeout searching Nature Hills for '{query}'")
    except Exception as e:
        logger.info(f"Failed to scrape Nature Hills for '{query}': {e}")

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
