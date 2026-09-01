# Toolkit single-page smoke check

Run the local server with `npm run web` (or
`python3 -m uvicorn toolkit_api.main:app --port 8000`) and verify the following
browser-visible behaviour:

1. `GET /` loads the Toolkit page.
2. The display time zone selector is pre-selected to this computer's zone and
   lists the platform's IANA zones.
3. Submitting `0` in the timestamp converter displays
   `1970-01-01T00:00:00Z` as the UTC result.
4. With the pre-selected zone, the second result row is labelled `Local time`.
   Choosing a different zone relabels it `Time in <zone>` and the value shows
   that zone's offset.
5. Each result row has its own Copy button, and using one reports
   `Copied <field>.` below the converter without touching the UUID panel status.
6. Generating `3` UUIDs renders three IDs.
7. Copying an individual ID and copying all IDs each give visible status
   feedback.
8. Clearing IDs removes the rendered ID list.
9. Submitting `invalid` for a timestamp displays inline recovery guidance.

Accessibility checks: every action is reachable with Tab, focused controls
are visibly indicated, each Copy button has a distinct accessible name, the
page has no horizontal scroll at 375px, and reduced-motion preference removes
UI transitions.
