const CATEGORY = 89;
const BASE = "https://tcgcsv.com/tcgplayer";
const UA = "RiftCollect/1.0";
const CACHE_TTL = 1000 * 60 * 60 * 12;

let cache = {
  groups: null,
  products: null,
  expires: 0,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "s-maxage=300, stale-while-revalidate=3600",
    },
  });
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json",
    },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`TCGCSV request failed (${response.status})`);
  }

  return text;
}

async function fetchJson(url) {
  const text = await fetchText(url);

  try {
    return JSON.parse(text);
  } catch {
    const preview = text.slice(0, 100).replace(/\s+/g, " ").trim();
    throw new Error(
      `TCGCSV returned invalid data${preview ? `: ${preview}` : ""}`
    );
  }
}

function extended(product, key) {
  const item = Array.isArray(product.extendedData)
    ? product.extendedData.find(
        (x) => String(x?.name || "").toLowerCase() === key.toLowerCase()
      )
    : null;
  return item?.value || "";
}

async function loadCatalog() {
  if (cache.products && Date.now() < cache.expires) return cache.products;

  const groupsResponse = await fetchJson(`${BASE}/${CATEGORY}/groups`);
  const groups = Array.isArray(groupsResponse?.results)
    ? groupsResponse.results
    : [];

  if (!groups.length) throw new Error("TCGCSV returned no Riftbound sets.");

  const jobs = groups.map((group, index) =>
    (async () => {
      // Stagger requests instead of hammering TCGCSV simultaneously.
      await sleep(index * 110);
      try {
        const response = await fetchJson(
          `${BASE}/${CATEGORY}/${group.groupId}/products`
        );
        return (Array.isArray(response?.results) ? response.results : [])
          .map((product) => {
            const number = extended(product, "Number");
            const rarity = extended(product, "Rarity");
            if (!number && !rarity) return null;
            return {
              ...product,
              groupId: group.groupId,
              setName: group.name,
              setAbbreviation: group.abbreviation || "",
              cardNumber: number,
              rarity,
            };
          })
          .filter(Boolean);
      } catch {
        return [];
      }
    })()
  );

  const chunks = await Promise.all(jobs);
  const products = chunks.flat();

  if (!products.length) {
    throw new Error("TCGCSV returned no Riftbound card products.");
  }

  cache = {
    groups,
    products,
    expires: Date.now() + CACHE_TTL,
  };

  return products;
}
async function loadPrices(groupIds) {
  const all = await Promise.all(
    groupIds.map(async (groupId, index) => {
      await sleep(index * 110);
      try {
        const response = await fetchJson(
          `${BASE}/${CATEGORY}/${groupId}/prices`
        );
        return Array.isArray(response?.results) ? response.results : [];
      } catch {
        return [];
      }
    })
  );

  const prices = new Map();
  for (const list of all) {
    for (const price of list) {
      const key = `${price.productId}::${price.subTypeName || "Normal"}`;
      prices.set(key, price);
    }
  }
  return prices;
}
function normalize(product, prices) {
  const matches = [...prices.values()].filter(
    (price) => price.productId === product.productId
  );

  const price =
    matches.find((p) => p.subTypeName === "Normal") ||
    matches.find((p) => /foil/i.test(p.subTypeName || "")) ||
    matches[0] ||
    null;

  return {
    id: String(product.productId),
    productId: product.productId,
    name: product.name,
    cleanName: product.cleanName,
    imageUrl: product.imageUrl,
    setName: product.setName,
    setAbbreviation: product.setAbbreviation,
    cardNumber: product.cardNumber,
    rarity: product.rarity,
    tcgplayerUrl: product.url,
    subTypeName: price?.subTypeName || "Normal",
    marketPrice: price?.marketPrice ?? null,
    lowPrice: price?.lowPrice ?? null,
    midPrice: price?.midPrice ?? null,
    highPrice: price?.highPrice ?? null,
  };
}

export default async function handler(request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return jsonResponse(
      { error: "Search must be at least 2 characters." },
      400
    );
  }

  try {
    const products = await loadCatalog();

    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);

    const hits = products
      .filter((product) => {
        const haystack = [
          product.name,
          product.cleanName,
          product.cardNumber,
          product.rarity,
          product.setName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return tokens.every((token) => haystack.includes(token));
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 30);

    if (!hits.length) {
      return jsonResponse({ results: [] });
    }

    const groupIds = [...new Set(hits.map((card) => card.groupId))];
    const prices = await loadPrices(groupIds);

    return jsonResponse({
      results: hits.map((card) => normalize(card, prices)),
    });
  } catch (error) {
    let message = "Unable to load Riftbound data from TCGCSV.";
    if (error instanceof Error && error.message) message = error.message;
    else if (typeof error === "string") message = error;
    else if (error && typeof error === "object") {
      message = String(error.message || error.error || JSON.stringify(error));
    }
    return jsonResponse({ error: message }, 502);
  }
}
