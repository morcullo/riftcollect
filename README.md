# RiftCollect

RiftCollect uses a GitHub Actions cache of TCGCSV data instead of calling TCGCSV during searches.

## Repository structure

```text
index.html
vercel.json
data/riftbound.json
scripts/update_riftbound.py
.github/workflows/update-riftbound.yml
```

Push these files to the root of the GitHub repository connected to Vercel.

The GitHub Action runs daily and can also be run manually:
GitHub → Actions → Update Riftbound Data → Run workflow.

When the Action commits a new catalog, the GitHub→Vercel integration automatically deploys it.
