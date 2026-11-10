import random

from checkers_engine import State, initial, legal_moves, outcome, parse_sq


def B(**kw):
    """B(w="c3", b="d4 f6", W="a1", B_="...") -> board"""
    b = {}
    for piece, sqs in kw.items():
        for s in sqs.split():
            b[parse_sq(s)] = piece.rstrip("_")
    return b


def test_start():
    m, must = legal_moves(initial(), "w")
    assert not must and len(m) == 7


def test_multi_capture_and_backward():
    m, must = legal_moves(B(w="c3", b="d4 f6"), "w")
    assert must and m == ["c3:e5:g7"]
    m, must = legal_moves(B(w="e5", b="d4"), "w")  # бьёт назад
    assert must and m == ["e5:c3"]


def test_mandatory_capture():
    m, must = legal_moves(B(w="c3 h2", b="d4"), "w")
    assert must and all(":" in x for x in m)


def test_king_flying_and_forced_landing():
    m, _ = legal_moves(B(W="a1", b_="d4"), "w")
    assert sorted(m) == ["a1:e5", "a1:f6", "a1:g7", "a1:h8"]
    m, _ = legal_moves(B(W="a1", b_="d4 g5"), "w")
    assert m == ["a1:f6:h4"]


def test_promotion_mid_capture():
    # простая d6 берёт e7, встаёт на f8, становится дамкой и бьёт g7
    m, _ = legal_moves(B(w="d6", b="e7 g7"), "w")
    assert m == ["d6:f8:h6"]


def test_no_double_jump():
    # взятую шашку нельзя перепрыгнуть дважды
    m, _ = legal_moves(B(W="a1", b_="c3 e3 e5"), "w")
    for x in m:
        pts = x.split(":")
        assert len(pts) == len(set(pts))


def test_random_games():
    rnd = random.Random(1)
    finished = 0
    for _ in range(300):
        st = State()
        for _ in range(400):
            moves, _ = legal_moves(st.board, st.turn)
            assert moves
            st.push(rnd.choice(moves))
            n_w = sum(1 for p in st.board.values() if p.lower() == "w")
            n_b = sum(1 for p in st.board.values() if p.lower() == "b")
            assert n_w <= 12 and n_b <= 12
            if outcome(st):
                finished += 1
                break
    assert finished > 250


if __name__ == "__main__":
    for k, v in list(globals().items()):
        if k.startswith("test_"):
            v()
            print("ok", k)