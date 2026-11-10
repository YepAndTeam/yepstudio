"""Кто и когда последний раз открывал партию (для кнопки «Позвать соперника»).

Хранится в памяти процесса: после перезапуска сервера обнуляется (пока игрока не видели,
считаем его ушедшим). При нескольких воркерах нужен Redis, как и для GAME_RUNS в main.py.
"""
import time

IDLE_AFTER = 60       # секунд без опроса, после которых игрок считается ушедшим
CALL_COOLDOWN = 120   # секунд между двумя «позвать» в одной партии

_seen = {}    # (kind, game_id, user_id) -> monotonic
_called = {}  # (kind, game_id) -> monotonic


def touch(kind: str, game_id: int, uid: int) -> None:
    _seen[(kind, game_id, uid)] = time.monotonic()


def is_away(kind: str, game_id: int, uid: int) -> bool:
    t = _seen.get((kind, game_id, uid))
    return t is None or time.monotonic() - t >= IDLE_AFTER


def call_wait(kind: str, game_id: int) -> int:
    """Сколько секунд ещё нельзя звать (0 = можно)."""
    t = _called.get((kind, game_id))
    if t is None:
        return 0
    return max(0, int(CALL_COOLDOWN - (time.monotonic() - t)))


def mark_called(kind: str, game_id: int) -> None:
    _called[(kind, game_id)] = time.monotonic()