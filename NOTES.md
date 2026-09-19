# TAMA rebuild: team admin system

The homepage can pull its Events, News, and Clinic sections from a shared
Google Sheet, so non-technical team members can update the site without
touching code.

## How it works

- `assets/js/content.js` runs on the homepage. It reads three tabs
  (Events, News, Clinic) from a published Google Sheet via the public
  gviz JSON feed and renders them with the site's existing CSS classes.
- The sheet ID lives in one line at the top of `content.js`:
  `const SHEET_ID = "";`. Empty means "not configured", and the script
  does nothing.
- On any failure (no sheet ID, network error, unpublished sheet, bad
  data), the script silently leaves the built-in HTML exactly as is.
  The site never looks broken.
- Expected columns: Events -> name, date, time, venue, description,
  register_url, banner_url (optional), status ("upcoming" shows,
  "hidden" hides). News -> text, date. Clinic -> title, schedule,
  description, register_url (first row only).

## Team-facing pages

- `admin.html` (unlisted, not in the public nav): explains the workflow,
  the one-time setup steps, the column guide, and links the template.
- `admin/event-template.csv`: one file with labeled sections for the
  three tabs, plus one real example row each. The team copies each
  section into its own Sheet tab.

## Pending one-time committee setup

1. Create a Google Sheet with tabs named exactly Events, News, Clinic.
2. Fill the tabs from `admin/event-template.csv`.
3. File > Share > Publish to web (entire document).
4. Send the sheet ID (from the sheet URL) to the site maintainer, who
   pastes it into `const SHEET_ID` in `assets/js/content.js` and redeploys.
5. Share the sheet with the team members who may edit it.

Until step 4 is done, the site keeps showing its built-in content.
