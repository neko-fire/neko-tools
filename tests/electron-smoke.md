# Electron smoke check

Run `npm run desktop` from the repository root.

1. A window titled **Toolkit** opens at the local Toolkit URL and shows the Time
   Converter and UUID Generator panels.
2. Close the Toolkit window, then verify that the `python -m uvicorn
   toolkit_api.main:app --host 127.0.0.1 --port 8765` child process is no
   longer running.
3. Run with an unavailable interpreter, for example
   `TOOLKIT_PYTHON=missing-python npm run desktop`. The window presents a
   concise “Unable to start Toolkit” page with a restart message, rather than
   remaining blank.

For a distributable artifact, run `npm run package:mac` and open the generated
DMG. The packaged app follows the same checks above.
