import hashlib, hmac, json, os, time
from urllib.parse import parse_qsl
from dotenv import load_dotenv

from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

def validate_init_data(init_data: str, max_age: int = 86400):
    """Возвращает данные юзера, если подпись верна, иначе None."""
    try:
        pairs = dict(parse_qsl(init_data, strict_parsing=True))
        received_hash = pairs.pop("hash")
        check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
        secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        calculated = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(calculated, received_hash):
            return None
        if time.time() - int(pairs["auth_date"]) > max_age:
            return None
        pairs["user"] = json.loads(pairs["user"])
        return pairs
    except Exception:
        return None