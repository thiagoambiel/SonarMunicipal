import json
import logging
import os
from logging.handlers import RotatingFileHandler
from typing import Optional


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        data = {
            "level": record.levelname,
            "time": self.formatTime(record, datefmt="%Y-%m-%dT%H:%M:%S%z"),
            "logger": record.name,
            "msg": record.getMessage(),
        }
        # inclui extras comuns se existirem
        for key in ("host", "url", "sapl_url", "status", "strategy", "source", "municipio", "uf", "count"):
            if hasattr(record, key):
                data[key] = getattr(record, key)
        if record.exc_info:
            data["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(data, ensure_ascii=False)


def setup_logging(
    level: str = "INFO",
    log_file: Optional[str] = "logs/sapl_finder.log",
    json_logs: bool = False,
) -> None:
    root = logging.getLogger()
    if root.handlers:
        # evitar configurar duas vezes
        return

    # nível
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    root.setLevel(numeric_level)

    # console handler
    ch = logging.StreamHandler()
    ch.setLevel(numeric_level)
    if json_logs:
        ch.setFormatter(JsonFormatter())
    else:
        ch.setFormatter(logging.Formatter(
            fmt="%(asctime)s %(levelname)s [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        ))
    root.addHandler(ch)

    # arquivo (opcional)
    if log_file:
        try:
            dirname = os.path.dirname(log_file)
            if dirname:
                os.makedirs(dirname, exist_ok=True)
            fh = RotatingFileHandler(log_file, maxBytes=5 * 1024 * 1024, backupCount=5, encoding="utf-8")
            fh.setLevel(numeric_level)
            if json_logs:
                fh.setFormatter(JsonFormatter())
            else:
                fh.setFormatter(logging.Formatter(
                    fmt="%(asctime)s %(levelname)s [%(name)s] %(message)s",
                    datefmt="%Y-%m-%d %H:%M:%S",
                ))
            root.addHandler(fh)
        except Exception:
            # se der erro ao abrir arquivo, seguimos apenas no console
            logging.getLogger(__name__).warning("Falha ao configurar log em arquivo; usando apenas console.")
