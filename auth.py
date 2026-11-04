import hashlib
import hmac
import json
import os
import time
from pathlib import Path
from urllib.parse import parse_qsl

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()


def validate_init_data(init_data: str, max_age: int = 86400):
    """Возвращает данные юзера, если подпись верна, иначе None."""
    if not init_data:
        print("initData: пусто (апп открыт не из Telegram?)")
        return None
    if not BOT_TOKEN:
        print("initData: BOT_TOKEN на сервере пустой")
        return None
    try:
        pairs = dict(parse_qsl(init_data, strict_parsing=True))
        received_hash = pairs.pop("hash")
        check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
        secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        calculated = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(calculated, received_hash):
            print("initData: подпись не совпала. id бота на сервере:", BOT_TOKEN.split(":")[0])
            return None
        age = time.time() - int(pairs["auth_date"])
        if age > max_age:
            print(f"initData: устарели, возраст {int(age)} сек")
            return None
        pairs["user"] = json.loads(pairs["user"])
        return pairs
    except Exception as e:
        print("initData: ошибка разбора:", repr(e))
        return None