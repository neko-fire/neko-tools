# Toolkit smoke check

Build and launch with `npm run build && npm run start`, or open the page
directly in a browser with `npm run dev`. Verify the following:

## The page

1. The page loads with both panels: Timestamp converter and UUIDv7 generator.
2. Clicking a sidebar item shows that tool's panel and hides the others; the
   clicked item is visually marked active. Reloading the page reopens on the
   tool you had open, not always Timestamp.
3. The display time zone selector is pre-selected to this computer's zone and
   lists the platform's IANA zones.
4. Submitting `0` in the timestamp converter displays
   `1970-01-01T00:00:00Z` as the UTC result.
5. With the pre-selected zone, the second result row is labelled `Local time`.
   Choosing a different zone relabels it `Time in <zone>` and the value shows
   that zone's offset.
6. Each result row has its own Copy button, and using one reports
   `Copied <field>.` below the converter without touching the UUID panel status.
7. Generating `3` UUIDs renders three IDs.
8. Copying an individual ID and copying all IDs each give visible status
   feedback, and the value really is on the clipboard.
9. Clearing IDs removes the rendered ID list.
10. Submitting `invalid` for a timestamp displays inline recovery guidance.
11. The JSON tool formats `{"a":1}` into pretty-printed JSON, minifies it back
    to one line, and shows an inline error for `{invalid}` instead of a result.
12. The Encode/Decode tool converts `hello` to Base64 `aGVsbG8=` and back, and
    shows an inline error when decoding `zz` as Hex.
13. The JWT decoder splits a valid token into header and payload JSON, shows a
    human-readable date next to `iat`, and always shows "Signature not
    verified."

Accessibility checks: every action is reachable with Tab, focused controls
are visibly indicated, each Copy button has a distinct accessible name, the
page has no horizontal scroll at 375px, and reduced-motion preference removes
UI transitions.

## The app window

Only checkable in the built app, not in the browser:

1. The window opens titled **Toolkit** at a readable size, with no white flash
   before the page paints.
2. The window opens at roughly 700×820 — small enough to sit in one half of a
   13" MacBook Air screen in Split View. Resizing below roughly 480×560 is
   refused.
3. Cmd-Q quits, Cmd-C and Cmd-V work in the input fields, and the Edit menu
   lists them.
4. Resizing below the minimum window size is refused rather than clipping the
   panels.
5. Closing the window quits the app, leaving no stray process.
6. Reopening from the Dock after closing the window brings the window back.

## Packaged build

`npm run package:mac` covers the automated checks. Then confirm by hand:

1. Open `dist/Toolkit-0.1.0.dmg` and drag **Toolkit** to Applications.
2. Launch it from Applications and confirm both panels work.
3. The app icon renders correctly in the Dock and in Finder.

A DMG you built locally is not quarantined and opens normally. A DMG that
arrives over the internet or AirDrop is quarantined, and because the app is
ad-hoc signed rather than notarized Gatekeeper will refuse to launch it until
the flag is cleared with
`xattr -dr com.apple.quarantine /Applications/Toolkit.app`.
