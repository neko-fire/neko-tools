from fastapi import FastAPI

from toolkit_api.routes.time import router as time_router


def create_app() -> FastAPI:
    app = FastAPI()
    app.get('/api/health')(lambda: {'status': 'ok'})
    app.include_router(time_router)
    return app


app = create_app()
