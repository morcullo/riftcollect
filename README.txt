RiftCollect V1 — corrected Riftcodex integration

This is a single HTML/CSS/JavaScript web app.

Riftcodex v0.2.0 documents:
GET https://api.riftcodex.com/cards/name?fuzzy=...
GET https://api.riftcodex.com/cards/search?query=...
GET https://api.riftcodex.com/cards

This build uses /cards/name with fuzzy matching because the app is searching by card name. It reads:
- id
- name
- set.label
- classification.rarity
- media.image_url

Riftcodex documents all read operations as unauthenticated and JSON.
If you open index.html directly as file://, browser security/CORS behavior can prevent API requests. Serve it with a local web server or deploy it to HTTPS.

Collection data is stored in localStorage for this prototype.
