import json, os, time, urllib.request
from pathlib import Path

CATEGORY = 89
BASE = "https://tcgcsv.com/tcgplayer"
UA = os.environ.get("TCGCSV_UA", "RiftCollect/1.0")
OUT = Path("data/riftbound.json")

def get_json(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))

def ext(p, name):
    for x in p.get("extendedData") or []:
        if str(x.get("name", "")).lower() == name.lower():
            return x.get("value", "")
    return ""

def main():
    groups = get_json(f"{BASE}/{CATEGORY}/groups").get("results") or []
    if not groups:
        raise RuntimeError("TCGCSV returned no Riftbound groups.")

    cards = []
    for i, g in enumerate(groups):
        if i: time.sleep(.12)
        try:
            products = get_json(f"{BASE}/{CATEGORY}/{g['groupId']}/products").get("results") or []
        except Exception as e:
            print("Skipping group:", g.get("name"), e)
            continue

        for p in products:
            number, rarity = ext(p, "Number"), ext(p, "Rarity")
            if not number and not rarity:
                continue
            cards.append({
                "id": str(p.get("productId")),
                "productId": p.get("productId"),
                "name": p.get("name"),
                "cleanName": p.get("cleanName"),
                "imageUrl": p.get("imageUrl"),
                "setName": g.get("name"),
                "setAbbreviation": g.get("abbreviation") or "",
                "groupId": g.get("groupId"),
                "cardNumber": number,
                "rarity": rarity,
                "tcgplayerUrl": p.get("url"),
            })

    if not cards:
        raise RuntimeError("TCGCSV returned no Riftbound cards.")

    prices = {}
    for i, gid in enumerate(sorted({c["groupId"] for c in cards})):
        if i: time.sleep(.12)
        try:
            rows = get_json(f"{BASE}/{CATEGORY}/{gid}/prices").get("results") or []
        except Exception as e:
            print("Skipping prices for group:", gid, e)
            continue
        for p in rows:
            pid = p.get("productId")
            if pid is None: continue
            key = str(pid)
            if key not in prices or str(p.get("subTypeName") or "").lower() == "normal":
                prices[key] = p

    for c in cards:
        p = prices.get(str(c["productId"]), {})
        c.update({
            "subTypeName": p.get("subTypeName") or "Normal",
            "marketPrice": p.get("marketPrice"),
            "lowPrice": p.get("lowPrice"),
            "midPrice": p.get("midPrice"),
            "highPrice": p.get("highPrice"),
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "categoryId": CATEGORY,
        "cards": cards
    }, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(cards)} cards.")

if __name__ == "__main__":
    main()
