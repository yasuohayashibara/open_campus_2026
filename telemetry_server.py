import json
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

LOG_PATH = Path(__file__).with_name("toio-telemetry.jsonl")
EXPERIMENT_LOG_PATH = Path(__file__).with_name("experiment-results.jsonl")
POST_LOG_PATHS = {
    "/telemetry": LOG_PATH,
    "/experiment-log": EXPERIMENT_LOG_PATH,
}
LOG_LOCK = threading.Lock()

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        log_path = POST_LOG_PATHS.get(self.path)
        if log_path is None:
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"[]")
            rows = payload if isinstance(payload, list) else [payload]
            received = datetime.now(timezone.utc).isoformat()
            with LOG_LOCK, log_path.open("a", encoding="utf-8") as log:
                for row in rows:
                    if isinstance(row, dict):
                        row["receivedAt"] = received
                        log.write(json.dumps(row, ensure_ascii=False) + "\n")
            self.send_response(204)
            self.end_headers()
        except (ValueError, json.JSONDecodeError) as error:
            self.send_error(400, str(error))

if __name__ == "__main__":
    print(f"Serving http://localhost:8080 (telemetry: {LOG_PATH}, experiments: {EXPERIMENT_LOG_PATH})")
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
