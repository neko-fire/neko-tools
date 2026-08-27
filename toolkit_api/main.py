from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI()
    app.get('/api/health')(lambda: {'status': 'ok'})
    return app


app = create_app()
