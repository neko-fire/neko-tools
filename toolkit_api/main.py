from fastapi import FastAPI

from toolkit_api.routes.time import router as time_router
from toolkit_api.routes.uuids import router as uuid_router


def create_app() -> FastAPI:
    app = FastAPI()
    app.get('/api/health')(lambda: {'status': 'ok'})
    app.include_router(time_router)
    app.include_router(uuid_router)
    return app


app = create_app()
