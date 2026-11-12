"""Server-authoritative themes, purchases and Jera refunds."""
import secrets
from datetime import datetime
from uuid import uuid4
from sqlalchemy import select, update
from database import User, UserTheme, ThemeBoxPurchase, Meta, JeraTx
from score_service import lock_scores
from theme_gift_service import theme_gifts,consume_theme_open

BASE_THEMES = {"dark", "light"}
LEGACY_THEMES = {"retro", "terminal", "nyan", "tetris"}
BOX_PRICE = 100
RUNES = tuple("ᚠᚢᚦᚨᚱᚲᚷᚹᚺ")
CATALOG = [
    {"key":"common","title":"Обычные","color":"var(--muted)","chance":70,"items":[
        {"id":"retro","name":"Ретро","weight":1050,"chance":35},
        {"id":"terminal","name":"Терминал","weight":1050,"chance":35}]},
    {"key":"rare","title":"Редкие","color":"var(--coin)","chance":25,"items":[
        {"id":"tetris","name":"Тетрис","weight":250,"chance":25/3},
        {"id":"nyan","name":"Nyan Cat","weight":250,"chance":25/3},
        {"id":"neon","name":"Неон Токио","weight":250,"chance":25/3}]},
    {"key":"mythic","title":"Мифические","color":"#E8BC66","chance":5,"items":[
        {"id":"poop","name":"Какашечки","weight":150,"chance":5}]},
]
RARITY = {item["id"]:group["key"] for group in CATALOG for item in group["items"]}
REFUND_PERCENT = {"common":25,"rare":50,"mythic":100}


class ShopError(Exception):
    def __init__(self,status,message):
        super().__init__(message)
        self.status=status


def owned_themes(db,user_id):
    return BASE_THEMES | set(db.scalars(select(UserTheme.theme_id).where(UserTheme.user_id==user_id)))


def initialize_shop_state(SessionLocal):
    """Grant only existing users common/rare themes, exactly once, before serving requests."""
    with SessionLocal.begin() as db:
        lock_scores(db)
        if db.get(Meta,"shop_legacy_v1"):
            return
        for user in db.scalars(select(User)).all():
            owned=owned_themes(db,user.id)
            for theme in LEGACY_THEMES-owned:
                db.add(UserTheme(user_id=user.id,theme_id=theme,source="legacy"))
            if user.theme and user.theme not in owned|LEGACY_THEMES:
                user.theme="dark"
        db.add(Meta(key="shop_legacy_v1",value="1"))


def check_available(db):
    if db.scalar(select(Meta.value).where(Meta.key=="score_maintenance"))=="1":
        raise ShopError(503,"Идёт обновление балансов. Попробуй открыть кассету немного позже.")


def choose_theme(luck_percent=0):
    if luck_percent:
        from disc_odds import boosted_chances
        chances=boosted_chances(CATALOG,luck_percent);roll=secrets.randbelow(10000)
        for group in CATALOG:
            roll-=round(chances[group["key"]]*100)
            if roll<0:
                pick=secrets.randbelow(sum(item["weight"] for item in group["items"]))
                for item in group["items"]:
                    pick-=item["weight"]
                    if pick<0:return item["id"]
        raise RuntimeError("Invalid boosted distribution")
    pool=[item for group in CATALOG for item in group["items"]]
    draw=secrets.randbelow(sum(item["weight"] for item in pool))
    for item in pool:
        draw-=item["weight"]
        if draw<0:return item["id"]
    raise RuntimeError("Invalid theme weights")


def balance(db,user_id):
    return db.scalar(select(User.jera).where(User.id==user_id)) or 0


def buy_box(db,user_id,request_id):
    lock_scores(db)
    check_available(db)
    row=db.scalar(select(ThemeBoxPurchase).where(ThemeBoxPurchase.user_id==user_id,ThemeBoxPurchase.request_id==request_id))
    if row is not None and row.status!="pending":
        raise ShopError(409,"Эта покупка уже завершена. Обнови магазин перед новой покупкой.")
    if row is None:
        row=db.scalar(select(ThemeBoxPurchase).where(ThemeBoxPurchase.user_id==user_id,ThemeBoxPurchase.status=="pending"))
    if row is None:
        price=0 if consume_theme_open(db,user_id) else BOX_PRICE
        if price:
            changed=db.execute(update(User).where(User.id==user_id,User.jera>=price).values(jera=User.jera-price))
            if changed.rowcount!=1:raise ShopError(409,"Не хватает Йеры для покупки кассеты")
        from disc_equipment import luck_for
        luck=luck_for(db,user_id)
        row=ThemeBoxPurchase(id=uuid4().hex,user_id=user_id,request_id=request_id,
            runes="".join(secrets.SystemRandom().sample(RUNES,3)),theme_id=choose_theme(luck),price=price,
            status="pending",refund=0,is_dupe=False)
        db.add(row)
        if price:db.add(JeraTx(user_id=user_id,amount=-price,reason="shop:buy:"+row.id))
        db.flush()
    return {"box_id":row.id,"runes":list(row.runes),"balance":balance(db,user_id),"price":row.price,"theme_gifts":theme_gifts(db,user_id)}


def result(db,row):
    return {"ok":row.status=="won","themeId":row.theme_id if row.status=="won" else None,
            "isDupe":row.is_dupe,"left":0,"refund":row.refund,"balance":balance(db,row.user_id)}


def unlock_box(db,user_id,box_id,runes):
    lock_scores(db)
    check_available(db)
    row=db.get(ThemeBoxPurchase,box_id)
    if row is None or row.user_id!=user_id:raise ShopError(404,"Кассета не найдена")
    if row.status!="pending":return result(db,row)
    if len(runes)!=3 or any(r not in RUNES for r in runes):raise ShopError(422,"Нужно выбрать три руны")
    row.resolved_at=datetime.utcnow()
    if "".join(runes)==row.runes:
        row.status="won"
        row.is_dupe=row.theme_id in owned_themes(db,user_id)
        if row.is_dupe:
            row.refund=row.price*REFUND_PERCENT[RARITY[row.theme_id]]//100
        else:
            db.add(UserTheme(user_id=user_id,theme_id=row.theme_id,source="box"))
    else:
        row.status="lost"
        row.refund=row.price//2
    if row.refund:
        db.execute(update(User).where(User.id==user_id).values(jera=User.jera+row.refund))
        db.add(JeraTx(user_id=user_id,amount=row.refund,reason="shop:refund:"+row.id))
    db.flush()
    return result(db,row)


def shop_state(db,user_id):
    pending=db.scalar(select(ThemeBoxPurchase).where(ThemeBoxPurchase.user_id==user_id,ThemeBoxPurchase.status=="pending"))
    rows=db.scalars(select(ThemeBoxPurchase).where(ThemeBoxPurchase.user_id==user_id,ThemeBoxPurchase.status!="pending")
        .order_by(ThemeBoxPurchase.resolved_at.desc(),ThemeBoxPurchase.id).limit(15)).all()
    from disc_equipment import luck_for
    from disc_odds import boosted_chances
    luck=luck_for(db,user_id);chances=boosted_chances(CATALOG,luck)
    groups=[{**group,"chance":chances[group["key"]],"items":[{**{k:v for k,v in item.items() if k!="weight"},"chance":chances[group["key"]]*item["weight"]/sum(i["weight"] for i in group["items"])} for item in group["items"]]} for group in CATALOG]
    return {"luck_percent":luck,"price":BOX_PRICE,"failure_refund":BOX_PRICE//2,"rarities":groups,
            "balance":balance(db,user_id),"theme_gifts":theme_gifts(db,user_id),"owned_themes":sorted(owned_themes(db,user_id)),
            "active_box":{"id":pending.id,"price":pending.price} if pending else None,
            "history":[{"id":row.id,"themeId":row.theme_id if row.status=="won" else None,
                        "success":row.status=="won","isDupe":row.is_dupe,"refund":row.refund} for row in rows]}


def grant_test_balance(db,user_id,request_id):
    """Fixed admin self-credit, serialized and retry-safe. No client-supplied amount."""
    from uuid import UUID
    try:
        token=UUID(request_id).hex
    except (ValueError,AttributeError,TypeError):
        raise ShopError(422,"Некорректный идентификатор начисления")
    lock_scores(db)
    if db.scalar(select(User.role).where(User.id==user_id))!="admin":
        raise ShopError(403,"Тестовый баланс доступен только администратору")
    check_available(db)
    reason="admin:test:"+token
    exists=db.scalar(select(JeraTx.id).where(JeraTx.user_id==user_id,JeraTx.reason==reason))
    if exists is not None:
        return {"balance":balance(db,user_id),"credited":False,"amount":10000}
    db.execute(update(User).where(User.id==user_id).values(jera=User.jera+10000))
    db.add(JeraTx(user_id=user_id,amount=10000,reason=reason))
    db.flush()
    return {"balance":balance(db,user_id),"credited":True,"amount":10000}
