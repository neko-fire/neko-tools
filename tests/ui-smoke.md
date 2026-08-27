# Toolkit single-page smoke check

Run the local server with `python -m uvicorn toolkit_api.main:app --port 8000`
and verify the following browser-visible behaviour:

1. `GET /` loads the Toolkit page.
2. Submitting `0` in the timestamp converter displays
   `1970-01-01T00:00:00Z` as the UTC result.
3. Generating `3` UUIDs renders three IDs.
4. Copying an individual ID and copying all IDs each give visible status
   feedback.
5. Clearing IDs removes the rendered ID list.
6. Submitting `invalid` for a timestamp displays inline recovery guidance.

Accessibility checks: every action is reachable with Tab, focused controls
are visibly indicated, the page has no horizontal scroll at 375px, and
reduced-motion preference removes UI transitions.
