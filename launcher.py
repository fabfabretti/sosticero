"""Entry point for the packaged Windows app: serve the API and built frontend locally, then open a browser."""
import os
import socket
import sys
import threading
import webbrowser
from pathlib import Path


def base_dir() -> Path:
    # Frozen: the user's data lives beside the executable. Unfrozen: beside this file.
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def free_port(preferred: int = 8000) -> int:
    with socket.socket() as probe:
        try:
            probe.bind(('127.0.0.1', preferred))
            return preferred
        except OSError:
            probe.bind(('127.0.0.1', 0))
            return probe.getsockname()[1]


def main() -> None:
    base = base_dir()
    data = base / 'data'
    try:
        data.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        sys.exit(f"Impossibile salvare i dati in {data}: {exc}\nMetti l'app in una cartella personale, non in Program Files.")

    bundle = Path(getattr(sys, '_MEIPASS', base))
    os.environ.setdefault('DATABASE_PATH', str(data / 'supplenze.sqlite'))
    os.environ.setdefault('STATIC_PATH', str(bundle / 'frontend' / 'dist'))

    import uvicorn
    from backend.main import app  # Reads DATABASE_PATH/STATIC_PATH above at import time.

    port = free_port()
    url = f'http://127.0.0.1:{port}'

    def open_browser() -> None:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    threading.Timer(1.0, open_browser).start()
    print(f'Sosticero: {url}  —  chiudi questa finestra per uscire.', flush=True)
    uvicorn.run(app, host='127.0.0.1', port=port, log_level='warning')


if __name__ == '__main__':
    main()
