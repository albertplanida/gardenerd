# Gardenerd screenshots

Captured from the running application with realistic fictional sample data.

- `01-dashboard.png`: dashboard viewport, 3840 x 2160 (16:9).
- `02-growing-journal.png`: expanded cherry tomato journal, 3200 x 2000 (8:5).
- `03-growing-trial.png`: growing trial overview, 3200 x 2000 (8:5).
- `04-growing-trial-full-journal.png`: complete trial card and journal timeline.

Images are captured at 2x resolution. Stock photo sources are in `photo-credits.md`.

## Run the sample app

From the repository root:

```powershell
docker compose -f docker-compose.yml -f data/screenshots/compose.screenshots.yml up -d
```

Open http://localhost:3000. The journal is inside each Growing Trial: choose
Growing Trials and then Show Journal on the Cherry Tomato card.

The override uses the `gardenerd_screenshot-postgres` Docker volume because
PostgreSQL cannot enforce its required permissions on this Windows bind mount.
Journal photos use the existing `data/media` mount. The local `.env` contains
development-only settings created for this capture session.
