from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from toolkit_api.features.manifest import FEATURE_MANIFEST
from toolkit_api.routes.time import router as time_router
from toolkit_api.routes.uuids import router as uuid_router

STATIC_DIRECTORY = (
    Path(sys._MEIPASS) / 'static'
    if getattr(sys, 'frozen', False)
    else Path(__file__).resolve().parents[1] / 'static'
)


def create_app() -> FastAPI:
    app = FastAPI()
    app.get('/api/health')(lambda: {'status': 'ok'})
    app.include_router(time_router)
    app.include_router(uuid_router)
    app.get('/api/features')(lambda: {'features': FEATURE_MANIFEST})
    app.get('/')(lambda: FileResponse(STATIC_DIRECTORY / 'index.html'))
    app.mount('/static', StaticFiles(directory=STATIC_DIRECTORY), name='static')
    return app


app = create_app()
