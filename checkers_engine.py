"""Русские шашки: правила. Чистая логика, без БД и FastAPI.

Нотация хода (один ход = один токен):
  тихий ход  "c3-d4"
  взятие     "c3:e5:g7"  (все клетки, на которых шашка приземлялась)

Правила:
  - белые ходят первыми, a1 тёмная клетка, играем по тёмным;
  - простая бьёт вперёд и назад, бить обязательно (не обязательно максимум);
  - серию взятий нужно доиграть до конца;
  - дамка летающая; простая, дошедшая до последней линии посреди взятия, становится дамкой и продолжает бить;
  - взятые шашки снимаются после хода (нельзя перепрыгнуть одну шашку дважды);
  - проигрывает тот, у кого нет шашек или нет ходов;
  - ничья: тройное повторение позиции или 30 полуходов подряд только дамками без взятий.
"""
from collections import Counter

FILES = "abcdefgh"
DIRS = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
QUIET_LIMIT = 30


def name(p):
    return FILES[p[0]] + str(p[1] + 1)


def parse_sq(s):
    return FILES.index(s[0]), int(s[1]) - 1


def inb(f, r):
    return 0 <= f < 8 and 0 <= r < 8


def promo_row(color):
    return 7 if color == "w" else 0


def initial():
    board = {}
    for r in range(8):
        for f in range(8):
            if (f + r) % 2:
                continue
            if r < 3:
                board[(f, r)] = "w"
            elif r > 4:
                board[(f, r)] = "b"
    return board


def chains(board, cur, piece, captured, path):
    """Полные цепочки взятий, продолжающие path. Пустой список = бить больше нечего.
    board: доска БЕЗ ходящей шашки; взятые в этом ходу шашки остаются на ней и мешают."""
    color = piece.lower()
    res = []
    for df, dr in DIRS:
        if piece.isupper():
            f, r = cur[0] + df, cur[1] + dr
            while inb(f, r) and (f, r) not in board:
                f += df
                r += dr
            if not inb(f, r):
                continue
            e = (f, r)
            lands = []
            f += df
            r += dr
            while inb(f, r) and (f, r) not in board:
                lands.append((f, r))
                f += df
                r += dr
        else:
            e = (cur[0] + df, cur[1] + dr)
            l = (cur[0] + 2 * df, cur[1] + 2 * dr)
            if e not in board or not inb(*l) or l in board:
                continue
            lands = [l]
        if board[e].lower() == color or e in captured or not lands:
            continue
        ncap = captured | {e}
        branch, terminal = [], []
        for l in lands:
            p = piece.upper() if (piece.islower() and l[1] == promo_row(color)) else piece
            sub = chains(board, l, p, ncap, path + [l])
            if sub:
                branch += sub
            else:
                terminal.append(path + [l])
        # дамка обязана выбрать поле, с которого можно бить дальше
        res += branch if branch else terminal
    return res


def legal_moves(board, color):
    """-> (список ходов-строк, обязательное ли взятие)"""
    caps = []
    for sq, p in board.items():
        if p.lower() != color:
            continue
        b = dict(board)
        del b[sq]
        caps += chains(b, sq, p, frozenset(), [sq])
    if caps:
        return [":".join(name(x) for x in c) for c in caps], True

    quiet = []
    fwd = 1 if color == "w" else -1
    for (f, r), p in board.items():
        if p.lower() != color:
            continue
        for df, dr in DIRS:
            nf, nr = f + df, r + dr
            if p.isupper():
                while inb(nf, nr) and (nf, nr) not in board:
                    quiet.append(f"{name((f, r))}-{name((nf, nr))}")
                    nf += df
                    nr += dr
            elif dr == fwd and inb(nf, nr) and (nf, nr) not in board:
                quiet.append(f"{name((f, r))}-{name((nf, nr))}")
    return quiet, False


def apply_move(board, token):
    """Применяет ход к board. -> (было ли взятие, ходила ли простая)"""
    cap = ":" in token
    pts = [parse_sq(s) for s in token.split(":" if cap else "-")]
    p = board.pop(pts[0])
    was_man = p.islower()
    for a, b in zip(pts, pts[1:]):
        if cap:
            df = (b[0] > a[0]) - (b[0] < a[0])
            dr = (b[1] > a[1]) - (b[1] < a[1])
            f, r = a[0] + df, a[1] + dr
            while (f, r) not in board:
                f += df
                r += dr
            del board[(f, r)]
        if p.islower() and b[1] == promo_row(p):
            p = p.upper()
    board[pts[-1]] = p
    return cap, was_man


class State:
    def __init__(self):
        self.board = initial()
        self.turn = "w"
        self.quiet = 0
        self.seen = Counter({self.key(): 1})

    def key(self):
        return (self.turn, tuple(sorted(self.board.items())))

    def push(self, token):
        cap, was_man = apply_move(self.board, token)
        self.quiet = 0 if (cap or was_man) else self.quiet + 1
        self.turn = "b" if self.turn == "w" else "w"
        self.seen[self.key()] += 1


def replay(moves_str):
    st = State()
    for t in moves_str.split():
        st.push(t)
    return st


def outcome(st):
    """-> None или (result, reason). Вызывать после хода: st.turn - тот, кто ходит теперь."""
    moves, _ = legal_moves(st.board, st.turn)
    if not moves:
        has = any(p.lower() == st.turn for p in st.board.values())
        return ("0-1" if st.turn == "w" else "1-0"), ("no_moves" if has else "no_pieces")
    if st.seen[st.key()] >= 3:
        return "1/2-1/2", "repetition"
    if st.quiet >= QUIET_LIMIT:
        return "1/2-1/2", "king_moves"
    return None