import argparse

import uvicorn

from toolkit_api.main import create_app


def main() -> None:
    parser = argparse.ArgumentParser(description='Run the Toolkit local server.')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', default=8765, type=int)
    arguments = parser.parse_args()
    uvicorn.run(create_app(), host=arguments.host, port=arguments.port)


if __name__ == '__main__':
    main()
