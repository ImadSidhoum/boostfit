import os
import json
from uuid import UUID
from datetime import date, timedelta
from typing import List, Optional, Tuple, Dict
from contextlib import contextmanager
from decimal import Decimal

import psycopg2
import psycopg2.extras
import psycopg2.pool
import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from utils import ewma, classify_energy

# =========================================
#   Config
# =========================================
load_dotenv('.env.local') # Load your local env file

APP_VERSION = "2.4-final-fix"
psycopg2.extras.register_uuid()
JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
JWT_ALGS = ["HS256"]

app = FastAPI(title="Motivation API", version=APP_VERSION)

# CORS
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================
#   DB Pool
# =========================================
db_pool = None

@app.on_event("startup")
def startup_event():
    """Initializes the database connection pool on app startup."""
    global db_pool
    
    # Construct the DATABASE_URL from individual parts for the pooler
    conn_str = "postgresql://{user}:{password}@{host}:{port}/{dbname}".format(
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME")
    )

    db_pool = psycopg2.pool.SimpleConnectionPool(minconn=1, maxconn=10, dsn=conn_str)


@app.on_event("shutdown")
def shutdown_event():
    """Closes the database connection pool on app shutdown."""
    if db_pool:
        db_pool.closeall()

# ... (The rest of your main.py file remains unchanged) ...
# Omitted for brevity. The only change needed is the startup_event function above.
def get_db():
    """FastAPI dependency to get a connection from the pool."""
    conn = db_pool.getconn()
    try:
        psycopg2.extras.register_uuid(conn_or_curs=conn)
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        db_pool.putconn(conn)

# =========================================
#   Auth
# =========================================
def get_current_user_id(request: Request) -> UUID:
    auth = request.headers.get("authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = auth.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=JWT_ALGS, options={"verify_aud": False})
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(401, "Invalid token: no subject")
        return UUID(sub)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

# =========================================
#   Models (No changes needed)
# =========================================
class TargetsResponse(BaseModel):
    steps: int
    sleep_hours: float
    protein_g: int
    fiber_g: int
    water_ml: int
    strength_min_week: int
    cardio_min_week_min: int
    cardio_min_week_max: int

class MetricsPayload(BaseModel):
    steps: int = 0
    sleep_hours: Optional[float] = None
    protein_g: Optional[int] = None
    fiber_g: Optional[int] = None
    water_ml: Optional[int] = None
    strength_min: int = 0
    cardio_min: int = 0
    mood: Optional[int] = None
    hunger: Optional[int] = None
    notes: Optional[str] = None

class GardenStateResponse(BaseModel):
    watered_today: bool
    perfect_streak: int
    stage: str
    droopy: bool
    hint: str

class ScheduleItem(BaseModel):
    habit_id: int
    slot: str = Field(..., pattern="^(morning|lunch|evening)$")

class ScheduleResponse(BaseModel):
    date: str
    items: List[ScheduleItem]

class MetricsDay(BaseModel):
    date: str
    steps: int = 0
    sleep_hours: Optional[float] = None
    protein_g: Optional[int] = None
    water_ml: Optional[int] = None

class WeeklyReviewResponse(BaseModel):
    start: str
    end: str
    adherence: Dict[str, float]
    plateau: bool
    trend_delta_kg: Optional[float]
    suggestions: List[str]

class CoachMessageResponse(BaseModel):
    title: str
    message: str
    actions: List[str]

class Profile(BaseModel):
    sex: Optional[str] = Field(None, pattern="^(male|female)$")
    birth_year: Optional[int] = Field(None, ge=1920, le=date.today().year)
    height_cm: Optional[float] = Field(None, gt=100, lt=230)
    weight_kg: Optional[float] = Field(None, gt=30, lt=300)
    activity_factor: Optional[float] = Field(None, ge=1.2, le=1.9)
    deficit_percent: Optional[float] = Field(None, ge=0.0, le=0.2)
    diet: Optional[str] = Field(None, pattern="^(omnivore|vegetarian)$")
    mode: Optional[str] = Field(None, pattern="^(simple|detail)$")
    units: Optional[str] = Field(None, pattern="^(metric|imperial)$")
    timezone: Optional[str] = None
    reminder_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")

class InsightsResponse(BaseModel):
    energy: str
    completion_ratio_7d: float
    streak_soft: int
    plateau: bool
    tip: str

class Habit(BaseModel):
    id: int
    name: str
    icon: str
    category: str
    difficulty: int
    done: bool = False

class HabitCreate(BaseModel):
    name: str
    icon: str
    category: str
    difficulty: int = Field(..., ge=1, le=3)

class Checkin(BaseModel):
    habit_id: int
    done: bool

class WeighIn(BaseModel):
    date: Optional[date] = None
    kg: float = Field(..., gt=0)

class TrendPoint(BaseModel):
    date: str
    weight: float
    trend: float

class PlanResponse(BaseModel):
    date: str
    energy: str
    items: List[Habit]
    message: str

class CoachEstimateRequest(BaseModel):
    sex: str = Field(..., pattern="^(male|female)$")
    age: int = Field(..., ge=14, le=100)
    height_cm: float = Field(..., gt=100, lt=230)
    weight_kg: float = Field(..., gt=30, lt=300)
    activity_factor: float = Field(1.4, ge=1.2, le=1.9)
    deficit_percent: float = Field(0.18, ge=0.0, le=0.2)

class CoachEstimateResponse(BaseModel):
    bmr: int
    tdee: int
    calorie_target: int
    protein_target_g: int
    water_target_ml: int
    fiber_target_g: int
    notes: List[str]

class MacroSplitRequest(BaseModel):
    calorie_target: int = Field(..., gt=800, lt=4000)
    protein_target_g: int = Field(..., gt=40, lt=400)
    fat_percent: float = Field(0.30, ge=0.20, le=0.40)

class MacroSplitResponse(BaseModel):
    kcal: int
    protein_g: int
    carbs_g: int
    fat_g: int
    notes: List[str] = []

class Recipe(BaseModel):
    id: int
    name: str
    kcal: int
    protein_g: int
    carbs_g: int
    fat_g: int
    prep_min: int
    tags: List[str]
    diet: str
    ingredients: List[Dict]
    steps: List[str]

class RecipeCreate(BaseModel):
    name: str
    kcal: int
    protein_g: int
    carbs_g: int
    fat_g: int
    prep_min: int
    tags: List[str]
    diet: str
    ingredients: List[Dict]
    steps: List[str]

class MealItem(BaseModel):
    meal_type: str
    recipe: Recipe

class MealPlanResponse(BaseModel):
    date: str
    total_kcal: int
    total_protein_g: int
    items: List[MealItem]

class ShoppingListRequest(BaseModel):
    recipe_ids: List[int]

class ShoppingListItem(BaseModel):
    name: str
    qty: float
    unit: str

class GamifyStatusResponse(BaseModel):
    total_xp: int
    level: int
    level_name: str
    next_level_xp: int
    progress_01: float

class ChallengeJoinResponse(BaseModel):
    code: str
    title: str
    start_date: str
    progress_days: int
    duration_days: int

class ChallengeActiveResponse(BaseModel):
    code: str
    title: str
    start_date: str
    day: int
    duration_days: int
    progress_days: int
    target_daily: int
    unit: str

class AdjustCaloriesResponse(BaseModel):
    suggestion_kcal_delta: int
    reason: str

# =========================================
#   Helpers (No changes needed)
# =========================================
def completion_ratio_last7(db, user_id: UUID) -> float:
    with db.cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) FILTER (WHERE done) * 1.0 / NULLIF(COUNT(*),0)
            FROM checkins
            WHERE user_id=%s AND checkin_date >= %s
        """, (user_id, date.today() - timedelta(days=6)))
        row = cur.fetchone()
        return float(row[0] or 0.0)

def daily_complete(db, user_id: UUID, d: date) -> bool:
    with db.cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) FILTER (WHERE done) FROM checkins
            WHERE user_id=%s AND checkin_date=%s
        """, (user_id, d))
        cnt = int(cur.fetchone()[0] or 0)
    return cnt >= 3

def perfect_streak_days(db, user_id: UUID, lookback: int = 30) -> int:
    """
    Counts consecutive 'perfect' days (>=3 habits done) up to today.
    """
    with db.cursor() as cur:
        cur.execute("""
            WITH daily_counts AS (
                SELECT checkin_date, COUNT(*) FILTER (WHERE done) AS done_count
                FROM checkins
                WHERE user_id = %s AND checkin_date BETWEEN %s AND %s
                GROUP BY checkin_date
            ),
            day_series AS (
                SELECT generate_series(%s::date, %s::date, '1 day')::date AS day
            ),
            full_days AS (
                SELECT
                    d.day,
                    CASE WHEN COALESCE(dc.done_count,0) >= 3 THEN 1 ELSE 0 END AS is_complete
                FROM day_series d
                LEFT JOIN daily_counts dc ON d.day = dc.checkin_date
            ),
            streaks AS (
                SELECT
                    day,
                    is_complete,
                    day - (ROW_NUMBER() OVER (PARTITION BY is_complete ORDER BY day))::int AS streak_group
                FROM full_days
            ),
            today_grp AS (
                SELECT streak_group FROM streaks
                WHERE day = %s AND is_complete = 1
                LIMIT 1
            )
            SELECT COUNT(*)
            FROM streaks
            WHERE is_complete = 1
              AND streak_group = (SELECT streak_group FROM today_grp)
        """, (
            user_id,
            date.today() - timedelta(days=lookback), date.today(),
            date.today() - timedelta(days=lookback), date.today(),
            date.today()
        ))
        row = cur.fetchone()
        return int(row[0] or 0)

def growth_stage(streak: int) -> str:
    if streak >= 7: return "flower"
    if streak >= 5: return "leafy"
    if streak >= 3: return "sprout"
    return "seed"

def get_profile(db, user_id: UUID) -> Profile:
    with db.cursor() as cur:
        cur.execute("""
            SELECT sex, birth_year, height_cm, weight_kg, activity_factor, deficit_percent,
                   diet, mode, units, timezone, to_char(reminder_time, 'HH24:MI')
            FROM user_profile WHERE user_id=%s
        """, (user_id,))
        row = cur.fetchone()
    if not row:
        return Profile(diet="omnivore", mode="simple", units="metric", timezone="Europe/Paris", reminder_time="18:00")
    return Profile(
        sex=row[0], birth_year=row[1],
        height_cm=float(row[2]) if row[2] is not None else None,
        weight_kg=float(row[3]) if row[3] is not None else None,
        activity_factor=float(row[4]) if row[4] is not None else None,
        deficit_percent=float(row[5]) if row[5] is not None else None,
        diet=row[6], mode=row[7], units=row[8], timezone=row[9], reminder_time=row[10]
    )

def upsert_profile(db, user_id: UUID, p: Profile) -> Profile:
    with db.cursor() as cur:
        cur.execute("""
            INSERT INTO user_profile(user_id, sex, birth_year, height_cm, weight_kg, activity_factor, deficit_percent,
                                     diet, mode, units, timezone, reminder_time)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                    CASE WHEN %s IS NULL THEN NULL ELSE %s::time END)
            ON CONFLICT (user_id) DO UPDATE SET
              sex=EXCLUDED.sex,
              birth_year=EXCLUDED.birth_year,
              height_cm=EXCLUDED.height_cm,
              weight_kg=EXCLUDED.weight_kg,
              activity_factor=EXCLUDED.activity_factor,
              deficit_percent=EXCLUDED.deficit_percent,
              diet=EXCLUDED.diet,
              mode=EXCLUDED.mode,
              units=EXCLUDED.units,
              timezone=EXCLUDED.timezone,
              reminder_time=EXCLUDED.reminder_time
        """, (
            user_id, p.sex, p.birth_year, p.height_cm, p.weight_kg, p.activity_factor, p.deficit_percent,
            p.diet or "omnivore", p.mode or "simple", p.units or "metric", p.timezone,
            p.reminder_time, p.reminder_time
        ))
    return get_profile(db, user_id)

def pick_plan_for_today(db, user_id: UUID) -> Tuple[str, List[Habit]]:
    energy = classify_energy(completion_ratio_last7(db, user_id))
    max_diff = {"low": 1, "medium": 2, "high": 3}[energy]

    with db.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("""
            SELECT id, name, icon, category, difficulty
            FROM habits
            WHERE user_id=%s AND category='nutrition' AND difficulty <= %s
            ORDER BY difficulty ASC, id ASC LIMIT 1
        """, (user_id, max_diff))
        nutrition = cur.fetchone()

        cur.execute("""
            SELECT id, name, icon, category, difficulty
            FROM habits
            WHERE user_id=%s AND category='movement' AND difficulty <= %s
            ORDER BY difficulty ASC, id ASC LIMIT 1
        """, (user_id, max_diff))
        movement = cur.fetchone()

        cur.execute("""
            SELECT id, name, icon, category, difficulty
            FROM habits
            WHERE user_id=%s AND category IN ('hydration','lifestyle') AND difficulty <= %s
            ORDER BY difficulty ASC, id ASC LIMIT 1
        """, (user_id, max_diff))
        hydra = cur.fetchone()

    items: List[Habit] = []
    for rec in (nutrition, movement, hydra):
        if rec:
            items.append(Habit(
                id=rec["id"], name=rec["name"], icon=rec["icon"],
                category=rec["category"], difficulty=int(rec["difficulty"]),
                done=False
            ))
    return energy, items

def attach_today_done(db, items: List[Habit], user_id: UUID):
    if not items:
        return items
    ids = [i.id for i in items]
    with db.cursor() as cur:
        cur.execute("""
            SELECT habit_id, done FROM checkins
            WHERE user_id=%s AND checkin_date=%s AND habit_id = ANY(%s)
        """, (user_id, date.today(), ids))
        status = {hid: d for (hid, d) in cur.fetchall()}
    for it in items:
        it.done = bool(status.get(it.id, False))
    return items

def latest_weight(db, user_id: UUID) -> Optional[float]:
    with db.cursor() as cur:
        cur.execute("SELECT (kg)::float FROM weigh_ins WHERE user_id=%s ORDER BY wi_date DESC LIMIT 1", (user_id,))
        row = cur.fetchone()
    return float(row[0]) if row else None

def compute_targets(db, user_id: UUID, sex: Optional[str] = None) -> TargetsResponse:
    w = latest_weight(db, user_id) or 80.0
    prot = int(max(round(1.6 * w), 90))
    fiber = 25 if sex == "female" else (30 if sex == "male" else 28)
    water = int(round(30 * w))
    return TargetsResponse(
        steps=9000,
        sleep_hours=7.5,
        protein_g=prot,
        fiber_g=fiber,
        water_ml=water,
        strength_min_week=80,
        cardio_min_week_min=150,
        cardio_min_week_max=300
    )

def mifflin_bmr(sex: str, age: int, height_cm: float, weight_kg: float) -> float:
    if sex == "male":
        return 10*weight_kg + 6.25*height_cm - 5*age + 5
    return 10*weight_kg + 6.25*height_cm - 5*age - 161

def streak_soft(db, user_id: UUID, threshold: int = 2, lookback: int = 30) -> int:
    with db.cursor() as cur:
        cur.execute("""
            SELECT checkin_date::date, COUNT(*) FILTER (WHERE done) AS done_count
            FROM checkins
            WHERE user_id=%s AND checkin_date >= %s
            GROUP BY 1
        """, (user_id, date.today() - timedelta(days=lookback-1)))
        rows = {r[0]: int(r[1]) for r in cur.fetchall()}

    streak = 0
    day = date.today()
    for _ in range(lookback):
        if rows.get(day, 0) >= threshold:
            streak += 1
            day -= timedelta(days=1)
        else:
            break
    return streak

def detect_plateau(db, user_id: UUID, window: int = 14) -> bool:
    with db.cursor() as cur:
        cur.execute("""
            SELECT wi_date::date, (kg)::float
            FROM weigh_ins
            WHERE user_id=%s
            ORDER BY wi_date DESC
            LIMIT %s
        """, (user_id, window))
        rows = cur.fetchall()[::-1]

    n = len(rows)
    if n < 5:
        return False

    xs = list(range(n))
    ys = [float(w) for _, w in rows]
    xbar = sum(xs)/n
    ybar = sum(ys)/n
    denom = sum((x - xbar)**2 for x in xs) or 1.0
    slope = sum((x - xbar)*(y - ybar) for x, y in zip(xs, ys)) / denom  # kg per sample (~day)
    return abs(slope) < 0.02

def pick_tip(db, energy: str, plateau: bool) -> str:
    tag = 'plateau' if plateau else ('energy_low' if energy == 'low' else 'hydration')
    with db.cursor() as cur:
        cur.execute("SELECT text FROM tips WHERE tag=%s ORDER BY RANDOM() LIMIT 1", (tag,))
        row = cur.fetchone()
    return row[0] if row else "Garde le cap — micro-pas aujourd’hui, constance demain."

def fetch_recipes(db, user_id: UUID, diet: Optional[str] = None, tag: Optional[str] = None, max_kcal: Optional[int] = None) -> List[Recipe]:
    q = """
      SELECT id, name, kcal, protein_g, carbs_g, fat_g, prep_min, tags, diet, ingredients, steps
      FROM recipes
      WHERE (user_id IS NULL OR user_id = %s)
    """
    params = [user_id]
    if diet:
        q += " AND diet = %s"
        params.append(diet)
    if tag:
        q += " AND %s = ANY(tags)"
        params.append(tag)
    if max_kcal:
        q += " AND kcal <= %s"
        params.append(max_kcal)
    q += " ORDER BY prep_min ASC, kcal ASC LIMIT 50"

    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(q, params)
        rows = cur.fetchall()

    def to_model(r):
        return Recipe(
            id=r["id"], name=r["name"], kcal=int(r["kcal"]),
            protein_g=int(r["protein_g"]), carbs_g=int(r["carbs_g"]),
            fat_g=int(r["fat_g"]), prep_min=int(r["prep_min"]),
            tags=list(r["tags"]), diet=r["diet"],
            ingredients=list(r["ingredients"]), steps=list(r["steps"])
        )
    return [to_model(r) for r in rows]

def get_metrics_for(db, user_id: UUID, d: date) -> MetricsPayload:
    with db.cursor() as cur:
        cur.execute("""
            SELECT steps, sleep_hours, protein_g, fiber_g, water_ml, strength_min, cardio_min, mood, hunger, notes
            FROM daily_metrics
            WHERE user_id=%s AND m_date=%s
        """, (user_id, d))
        row = cur.fetchone()
    if not row:
        return MetricsPayload()
    return MetricsPayload(
        steps=int(row[0] or 0),
        sleep_hours=float(row[1]) if row[1] is not None else None,
        protein_g=int(row[2]) if row[2] is not None else None,
        fiber_g=int(row[3]) if row[3] is not None else None,
        water_ml=int(row[4]) if row[4] is not None else None,
        strength_min=int(row[5] or 0),
        cardio_min=int(row[6] or 0),
        mood=int(row[7]) if row[7] is not None else None,
        hunger=int(row[8]) if row[8] is not None else None,
        notes=row[9] or None
    )

def xp_total(db, user_id: UUID) -> int:
    with db.cursor() as cur:
        cur.execute("SELECT COALESCE(SUM(amount),0) FROM xp_events WHERE user_id=%s", (user_id,))
        return int(cur.fetchone()[0] or 0)

def _xp_threshold(level: int) -> int:
    return 100 * level * (level - 1) // 2

def level_from_xp(xp: int) -> Tuple[int, int, int]:
    level = 1
    while xp >= _xp_threshold(level + 1):
        level += 1
    cur_th = _xp_threshold(level)
    next_th = _xp_threshold(level + 1)
    return level, cur_th, next_th

def award_xp(db, user_id: UUID, reason: str, amount: int, meta: Optional[Dict] = None):
    with db.cursor() as cur:
        cur.execute("""
            INSERT INTO xp_events(user_id, reason, amount, meta)
            VALUES (%s,%s,%s,%s)
        """, (user_id, reason, amount, json.dumps(meta) if meta is not None else None))

# =========================================
#   API (No changes needed)
# =========================================
@app.get("/health")
def health(db = Depends(get_db)):
    with db.cursor() as cur:
        cur.execute("SELECT 1")
        if cur.fetchone()[0] == 1:
            return {"status": "ok", "version": APP_VERSION}
    raise HTTPException(status_code=500, detail="Database connection failed")


@app.get("/api/habits", response_model=List[Habit])
def get_habits(user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    energy, items = pick_plan_for_today(db, user_id)
    items = attach_today_done(db, items, user_id)
    return items

@app.post("/api/checkins")
def create_or_update_checkin(checkin: Checkin, user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    today = date.today()
    with db.cursor() as cur:
        cur.execute("""
            SELECT done FROM checkins
            WHERE habit_id=%s AND user_id=%s AND checkin_date=%s
        """, (checkin.habit_id, user_id, today))
        prev = cur.fetchone()
        prev_done = bool(prev[0]) if prev else False

        cur.execute("""
            INSERT INTO checkins (habit_id, user_id, checkin_date, done)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, habit_id, checkin_date) DO UPDATE SET done=EXCLUDED.done
        """, (checkin.habit_id, user_id, today, checkin.done))

        if checkin.done and not prev_done:
            award_xp(db, user_id, "habit_done", 10, {"habit_id": checkin.habit_id})
            cur.execute("""
                SELECT COUNT(*) FROM checkins
                WHERE user_id=%s AND checkin_date=%s AND done
            """, (user_id, today))
            done_cnt = int(cur.fetchone()[0] or 0)
            if done_cnt >= 3:
                award_xp(db, user_id, "daily_complete", 25, None)

    return {"status": "success", "habit_id": checkin.habit_id, "done": checkin.done}

@app.get("/api/weighins", response_model=List[WeighIn])
def list_weighins(user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    with db.cursor() as cur:
        cur.execute("""
            SELECT wi_date, kg FROM weigh_ins
            WHERE user_id=%s ORDER BY wi_date ASC
        """, (user_id,))
        rows = cur.fetchall()
    return [{"date": r[0], "kg": float(r[1])} for r in rows]

@app.post("/api/weighins")
def add_weighin(w: WeighIn, user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    wi_date = w.date or date.today()
    with db.cursor() as cur:
        cur.execute("""
            INSERT INTO weigh_ins (user_id, wi_date, kg)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, wi_date) DO UPDATE SET kg=EXCLUDED.kg
        """, (user_id, wi_date, w.kg))
    return {"status": "success", "date": wi_date.isoformat(), "kg": w.kg}

@app.get("/api/trend", response_model=List[TrendPoint])
def trend(alpha: float = 0.3, user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    with db.cursor() as cur:
        cur.execute("""
            SELECT wi_date::text, (kg)::float FROM weigh_ins
            WHERE user_id=%s ORDER BY wi_date ASC
        """, (user_id,))
        rows = cur.fetchall()
    points = ewma(rows, alpha=alpha)
    return [{"date": d, "weight": float(w), "trend": float(t)} for (d, w, t) in points]

@app.get("/api/plan/today", response_model=PlanResponse)
def plan_today(user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    energy, items = pick_plan_for_today(db, user_id)
    items = attach_today_done(db, items, user_id)
    msg = {
        "low": "Énergie basse : micro-pas aujourd’hui. Chaque check compte 💪",
        "medium": "Régulier = progrès. 3 actions simples et on célèbre 🎉",
        "high": "Tu es en feu 🚀 On ose un cran au-dessus !",
    }[energy]
    return PlanResponse(date=date.today().isoformat(), energy=energy, items=items, message=msg)

# ---------- Nutrition Coach ----------
@app.post("/api/coach/estimate", response_model=CoachEstimateResponse)
def coach_estimate(req: CoachEstimateRequest):
    bmr = mifflin_bmr(req.sex, req.age, req.height_cm, req.weight_kg)
    tdee = bmr * req.activity_factor
    cal_target = max(int(round(tdee * (1 - req.deficit_percent))), 1200)
    protein_target = int(round(max(1.6 * req.weight_kg, 90)))
    water_ml = int(round(30 * req.weight_kg))
    fiber_g = 25 if req.sex == "female" else 30
    notes = [
        "Déficit modéré 15–20% recommandé.",
        "Priorise protéines & végétaux, dors 7h+ si possible.",
        "Ce n'est pas un avis médical."
    ]
    return CoachEstimateResponse(
        bmr=int(round(bmr)),
        tdee=int(round(tdee)),
        calorie_target=cal_target,
        protein_target_g=protein_target,
        water_target_ml=water_ml,
        fiber_target_g=fiber_g,
        notes=notes
    )

@app.post("/api/coach/macro-split", response_model=MacroSplitResponse)
def coach_macro_split(req: MacroSplitRequest):
    fat_kcal = int(round(req.fat_percent * req.calorie_target))
    fat_g = max(0, int(round(fat_kcal / 9)))
    protein_kcal = req.protein_target_g * 4
    carb_kcal = max(0, req.calorie_target - fat_kcal - protein_kcal)
    carbs_g = int(round(carb_kcal / 4))
    notes = []
    if carb_kcal < 0:
        notes.append("Cible protéines/lipides trop élevée pour les kcal — réduis légèrement les protéines ou la part de lipides.")
        carbs_g = 0
    return MacroSplitResponse(
        kcal=req.calorie_target,
        protein_g=req.protein_target_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
        notes=notes
    )

@app.get("/api/recipes", response_model=List[Recipe])
def list_recipes(
    diet: Optional[str] = Query(None, description="omnivore|vegetarian"),
    tag: Optional[str] = Query(None, description="breakfast|lunch|dinner|snack|high-protein|easy"),
    max_kcal: Optional[int] = Query(None),
    user_id: UUID = Depends(get_current_user_id),
    db = Depends(get_db)
):
    return fetch_recipes(db, user_id, diet=diet, tag=tag, max_kcal=max_kcal)

@app.post("/api/recipes", response_model=Recipe, status_code=201)
def create_recipe(recipe: RecipeCreate, user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    """Creates a new recipe for the user."""
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            INSERT INTO recipes (user_id, name, kcal, protein_g, carbs_g, fat_g, prep_min, tags, diet, ingredients, steps)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, name, kcal, protein_g, carbs_g, fat_g, prep_min, tags, diet, ingredients, steps
        """, (
            user_id, recipe.name, recipe.kcal, recipe.protein_g, recipe.carbs_g,
            recipe.fat_g, recipe.prep_min, recipe.tags, recipe.diet,
            json.dumps(recipe.ingredients), recipe.steps
        ))
        new_recipe = cur.fetchone()
    return Recipe(**new_recipe)


@app.get("/api/coach/snacks", response_model=List[Recipe])
def coach_snacks(
    diet: str = "omnivore",
    max_kcal: int = 240,
    min_protein: int = 12,
    limit: int = 3,
    db = Depends(get_db)
):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT id, name, kcal, protein_g, carbs_g, fat_g, prep_min, tags, diet, ingredients, steps
            FROM recipes
            WHERE diet=%s
              AND 'snack' = ANY(tags)
              AND kcal <= %s
              AND protein_g >= %s
            ORDER BY protein_g DESC, prep_min ASC, kcal ASC
            LIMIT %s
        """, (diet, max_kcal, min_protein, limit))
        rows = cur.fetchall()
    return [Recipe(
        id=r["id"], name=r["name"], kcal=int(r["kcal"]),
        protein_g=int(r["protein_g"]), carbs_g=int(r["carbs_g"]),
        fat_g=int(r["fat_g"]), prep_min=int(r["prep_min"]),
        tags=list(r["tags"]), diet=r["diet"],
        ingredients=list(r["ingredients"]), steps=list(r["steps"])
    ) for r in rows]

@app.post("/api/mealplan/today", response_model=MealPlanResponse)
def mealplan_today(
    diet: Optional[str] = "omnivore",
    calorie_target: Optional[int] = 1800,
    user_id: UUID = Depends(get_current_user_id),
    db = Depends(get_db)
):
    want = [
        ("breakfast", int(0.20 * calorie_target)),
        ("lunch",     int(0.35 * calorie_target)),
        ("dinner",    int(0.35 * calorie_target)),
        ("snack",     int(0.05 * calorie_target)),
        ("snack",     int(0.05 * calorie_target)),
    ]
    items: List[MealItem] = []
    total_kcal = 0
    total_protein = 0

    for meal_type, target_kcal in want:
        with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, name, kcal, protein_g, carbs_g, fat_g, prep_min, tags, diet, ingredients, steps
                FROM recipes
                WHERE (user_id IS NULL OR user_id = %s)
                  AND diet = %s
                  AND %s = ANY(tags)
                  AND kcal BETWEEN %s AND %s
                ORDER BY (ABS(kcal - %s)) ASC, protein_g DESC, prep_min ASC
                LIMIT 1
            """, (user_id, diet, meal_type, max(150, target_kcal-150), target_kcal+150, target_kcal))
            r = cur.fetchone()
        if not r:
            recs = fetch_recipes(db, user_id, diet=diet, tag=meal_type)
            if not recs:
                continue
            rec = recs[0]
        else:
            rec = Recipe(
                id=r["id"], name=r["name"], kcal=int(r["kcal"]),
                protein_g=int(r["protein_g"]), carbs_g=int(r["carbs_g"]),
                fat_g=int(r["fat_g"]), prep_min=int(r["prep_min"]),
                tags=list(r["tags"]), diet=r["diet"],
                ingredients=list(r["ingredients"]), steps=list(r["steps"])
            )
        items.append(MealItem(meal_type=meal_type, recipe=rec))
        total_kcal += rec.kcal
        total_protein += rec.protein_g

    return MealPlanResponse(
        date=date.today().isoformat(),
        total_kcal=total_kcal,
        total_protein_g=total_protein,
        items=items
    )

@app.get("/api/mealplan/alternatives", response_model=List[Recipe])
def mealplan_alternatives(
    meal_type: str,
    diet: str = "omnivore",
    near_kcal: int = 500,
    user_id: UUID = Depends(get_current_user_id),
    db = Depends(get_db)
):
    lo = max(150, near_kcal - 120)
    hi = near_kcal + 120
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT id, name, kcal, protein_g, carbs_g, fat_g, prep_min, tags, diet, ingredients, steps
            FROM recipes
            WHERE (user_id IS NULL OR user_id = %s)
              AND diet=%s
              AND %s = ANY(tags)
              AND kcal BETWEEN %s AND %s
            ORDER BY protein_g DESC, ABS(kcal - %s) ASC, prep_min ASC
            LIMIT 3
        """, (user_id, diet, meal_type, lo, hi, near_kcal))
        rows = cur.fetchall()
    return [Recipe(
        id=r["id"], name=r["name"], kcal=int(r["kcal"]),
        protein_g=int(r["protein_g"]), carbs_g=int(r["carbs_g"]),
        fat_g=int(r["fat_g"]), prep_min=int(r["prep_min"]),
        tags=list(r["tags"]), diet=r["diet"],
        ingredients=list(r["ingredients"]), steps=list(r["steps"])
    ) for r in rows]

@app.post("/api/shopping-list", response_model=List[ShoppingListItem])
def shopping_list(req: ShoppingListRequest, db = Depends(get_db)):
    if not req.recipe_ids:
        return []
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT ingredients
            FROM recipes
            WHERE id = ANY(%s)
        """, (req.recipe_ids,))
        rows = cur.fetchall()
    acc: Dict[Tuple[str, str], float] = {}
    for r in rows:
        for ing in r["ingredients"]:
            key = (ing["name"], ing.get("unit", ""))
            qty = float(ing.get("qty", 0))
            acc[key] = acc.get(key, 0.0) + qty
    out = [ShoppingListItem(name=k[0], unit=k[1], qty=round(v, 2)) for k, v in acc.items()]
    out.sort(key=lambda x: x.name)
    return out

# ---------- Metrics & Targets ----------
@app.get("/api/metrics/today", response_model=MetricsPayload)
def metrics_today_get(user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    return get_metrics_for(db, user_id, date.today())

@app.get("/api/metrics/week", response_model=List[MetricsDay])
def metrics_week(user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    user = user_id
    start = date.today() - timedelta(days=6)
    with db.cursor() as cur:
        cur.execute("""
            SELECT m_date::date, COALESCE(steps,0), sleep_hours, protein_g, water_ml
            FROM daily_metrics
            WHERE user_id=%s AND m_date BETWEEN %s AND %s
            ORDER BY m_date ASC
        """, (user, start, date.today()))
        rows = {r[0]: r for r in cur.fetchall()}

    out: List[MetricsDay] = []
    for i in range(7):
        d = start + timedelta(days=i)
        r = rows.get(d)
        if r:
            out.append(MetricsDay(date=d.isoformat(), steps=int(r[1] or 0),
                                  sleep_hours=float(r[2]) if r[2] is not None else None,
                                  protein_g=int(r[3]) if r[3] is not None else None,
                                  water_ml=int(r[4]) if r[4] is not None else None))
        else:
            out.append(MetricsDay(date=d.isoformat(), steps=0))
    return out

@app.post("/api/metrics/today", response_model=MetricsPayload)
def metrics_today_upsert(payload: MetricsPayload, user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    day = date.today()
    with db.cursor() as cur:
        cur.execute("""
            INSERT INTO daily_metrics (user_id, m_date, steps, sleep_hours, protein_g, fiber_g, water_ml, strength_min, cardio_min, mood, hunger, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, m_date) DO UPDATE SET
                steps=EXCLUDED.steps,
                sleep_hours=EXCLUDED.sleep_hours,
                protein_g=EXCLUDED.protein_g,
                fiber_g=EXCLUDED.fiber_g,
                water_ml=EXCLUDED.water_ml,
                strength_min=EXCLUDED.strength_min,
                cardio_min=EXCLUDED.cardio_min,
                mood=EXCLUDED.mood,
                hunger=EXCLUDED.hunger,
                notes=EXCLUDED.notes
        """, (
            user_id, day,
            payload.steps, payload.sleep_hours, payload.protein_g, payload.fiber_g,
            payload.water_ml, payload.strength_min, payload.cardio_min,
            payload.mood, payload.hunger, payload.notes
        ))
    return payload

@app.get("/api/targets", response_model=TargetsResponse)
def get_targets(sex: Optional[str] = Query(None, pattern="^(male|female)$"), user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    return compute_targets(db, user_id, sex=sex)

@app.get("/api/review/weekly", response_model=WeeklyReviewResponse)
def review_weekly(sex: Optional[str] = Query(None, pattern="^(male|female)$"), user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    targets = compute_targets(db, user_id, sex=sex)
    end = date.today()
    start = end - timedelta(days=6)

    with db.cursor() as cur:
        cur.execute("""
            SELECT m_date, steps, sleep_hours, protein_g, fiber_g, water_ml, strength_min, cardio_min
            FROM daily_metrics
            WHERE user_id=%s AND m_date BETWEEN %s AND %s
            ORDER BY m_date ASC
        """, (user_id, start, end))
        rows = cur.fetchall()

    days = max(1, (end - start).days + 1)
    steps_avg = (sum((r[1] or 0) for r in rows) / days)
    sleep_avg = (sum(float(r[2] or 0) for r in rows if r[2] is not None) / max(1, sum(1 for r in rows if r[2] is not None)))
    protein_avg = (sum((r[3] or 0) for r in rows if r[3] is not None) / max(1, sum(1 for r in rows if r[3] is not None)))
    fiber_avg = (sum((r[4] or 0) for r in rows if r[4] is not None) / max(1, sum(1 for r in rows if r[4] is not None)))
    water_avg = (sum((r[5] or 0) for r in rows if r[5] is not None) / max(1, sum(1 for r in rows if r[5] is not None)))
    strength_sum = sum((r[6] or 0) for r in rows)
    cardio_sum = sum((r[7] or 0) for r in rows)

    adherence = {
        "steps": min(1.0, steps_avg / targets.steps if targets.steps > 0 else 0),
        "sleep": min(1.0, sleep_avg / targets.sleep_hours if targets.sleep_hours > 0 else 0),
        "protein": min(1.0, protein_avg / targets.protein_g if targets.protein_g > 0 else 0),
        "fiber": min(1.0, fiber_avg / targets.fiber_g if targets.fiber_g > 0 else 0),
        "water": min(1.0, water_avg / targets.water_ml if targets.water_ml > 0 else 0),
        "strength": min(1.0, strength_sum / targets.strength_min_week if targets.strength_min_week > 0 else 0),
        "cardio": min(1.0, cardio_sum / targets.cardio_min_week_min if targets.cardio_min_week_min > 0 else 0)
    }

    with db.cursor() as cur:
        cur.execute("""
            SELECT wi_date::text, (kg)::float FROM weigh_ins
            WHERE user_id=%s AND wi_date BETWEEN %s AND %s
            ORDER BY wi_date ASC
        """, (user_id, start, end))
        wr = cur.fetchall()
    trend_delta = None
    if wr:
        pts = ewma([(d, float(w)) for d, w in wr], alpha=0.3)
        if len(pts) >= 2:
            trend_delta = round(pts[-1][2] - pts[0][2], 2)

    plateau_flag = detect_plateau(db, user_id)

    suggestions = []
    if adherence["protein"] < 0.8:
        suggestions.append("Fixer 30–40 g de protéines au petit-déjeuner.")
    if adherence["steps"] < 0.8:
        suggestions.append("Ajouter +1500 pas/j (pauses actives de 5–10 min).")
    if adherence["sleep"] < 0.8:
        suggestions.append("Couvre-feu digital 60 min avant dodo, viser 7–8 h.")
    if plateau_flag:
        suggestions.append("Semaine anti-plateau: +10% pas, +20 g protéines/j, surveiller snacks liquides.")

    return WeeklyReviewResponse(
        start=start.isoformat(),
        end=end.isoformat(),
        adherence={k: round(v,3) for k,v in adherence.items()},
        trend_delta_kg=trend_delta,
        plateau=plateau_flag,
        suggestions=suggestions or ["Super constance — on continue 👏"]
    )

@app.get("/api/insights/today", response_model=InsightsResponse)
def insights_today(user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    cr7 = completion_ratio_last7(db, user_id)
    energy = classify_energy(cr7)
    streak = streak_soft(db, user_id)
    plateau_flag = detect_plateau(db, user_id)
    tip = pick_tip(db, energy, plateau_flag)
    return InsightsResponse(
        energy=energy,
        completion_ratio_7d=round(cr7, 3),
        streak_soft=streak,
        plateau=plateau_flag,
        tip=tip
    )

@app.get("/api/coach/message", response_model=CoachMessageResponse)
def coach_message(user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    cr7 = completion_ratio_last7(db, user_id)
    energy = classify_energy(cr7)
    plateau = detect_plateau(db, user_id)
    targets = compute_targets(db, user_id, "male")  # sex fallback
    today = get_metrics_for(db, user_id, date.today())

    low_protein = (today.protein_g or 0) < 0.7 * targets.protein_g
    low_steps = (today.steps or 0) < 0.7 * targets.steps
    low_sleep = (today.sleep_hours or 0) < 0.8 * targets.sleep_hours

    if plateau:
        return CoachMessageResponse(
            title="Semaine anti-plateau 🔧",
            message="On garde le déficit mais on stimule: bouge un peu plus, priorise protéines/fibres, dors mieux.",
            actions=[
                "Augmente tes pas de +1500/j pendant 7 jours",
                "Ajoute +20 g protéines/j (ex: yaourt grec, œufs, thon)",
                "Remplace 1 snack sucré par un fruit + fromage blanc",
            ]
        )
    if energy == "low":
        return CoachMessageResponse(
            title="Micro-victoires aujourd’hui ✨",
            message="Énergie basse: vise l’élan minimal, pas la perfection.",
            actions=[
                "Marche 5 minutes après le prochain repas",
                "Bois 500 ml d’eau maintenant",
                "Prépare un petit-déj riche en protéines pour demain",
            ]
        )
    if low_protein:
        return CoachMessageResponse(
            title="Priorité protéines 🍳",
            message="Atteindre la cible protéines aide la satiété et la conservation du muscle.",
            actions=[
                "Vise 30–40 g au petit-déj",
                "Ajoute une source maigre à ton déjeuner (poulet, thon, tofu)",
                "Garde un snack protéiné prêt (fromage blanc/noix)",
            ]
        )
    if low_steps:
        return CoachMessageResponse(
            title="NEAT boost 🚶",
            message="Plus de mouvements légers = plus de calories brûlées sans te cramer.",
            actions=[
                "2 pauses actives de 10 min",
                "Appel en marchant",
                "Escaliers > ascenseur aujourd’hui",
            ]
        )
    if low_sleep:
        return CoachMessageResponse(
            title="Sommeil = super-pouvoir 😴",
            message="Mieux dormir → faim plus stable et meilleures décisions.",
            actions=[
                "Écran off 60 min avant le dodo",
                "Chambre plus fraîche",
                "Heure de coucher fixe (±15 min)",
            ]
        )
    return CoachMessageResponse(
        title="Tu es lancé·e 🚀",
        message="Progression régulière — on peut oser un cran au-dessus en gardant la simplicité.",
        actions=[
            "1 séance renfo 20 min cette semaine",
            "Légumes à chaque repas aujourd’hui",
            "Planifie ton petit-déj de demain (30–40 g prot.)",
        ]
    )

@app.get("/api/gamify/status", response_model=GamifyStatusResponse)
def gamify_status(user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    total = xp_total(db, user_id)
    level, cur_th, next_th = level_from_xp(total)
    progress = 0.0 if next_th == cur_th else (total - cur_th) / (next_th - cur_th)
    names = ["Novice", "Constant·e", "Momentum", "Transformer", "Athlète"]
    name = names[min(level-1, len(names)-1)]
    return GamifyStatusResponse(
        total_xp=total,
        level=level,
        level_name=name,
        next_level_xp=next_th,
        progress_01=round(progress, 3)
    )

@app.post("/api/challenges/join", response_model=ChallengeJoinResponse)
def challenges_join(code: str, user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    today = date.today()
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, code, title, duration_days FROM challenges WHERE code=%s", (code,))
        ch = cur.fetchone()
        if not ch:
            raise HTTPException(404, "Challenge not found")

        cur.execute("""
            INSERT INTO user_challenges(user_id, challenge_id, start_date, status)
            VALUES (%s,%s,%s,'active')
            ON CONFLICT (user_id, challenge_id, start_date) DO NOTHING
        """, (user_id, ch["id"], today))

        progress_days = 0
        end = today + timedelta(days=int(ch["duration_days"]) - 1)

        if ch["code"] == "WATER7":
            cur.execute("""
                SELECT COUNT(*) AS total FROM daily_metrics
                WHERE user_id=%s AND m_date BETWEEN %s AND %s
                  AND COALESCE(water_ml,0) >= 1500
            """, (user_id, today, end))
            row = cur.fetchone()
            if row:
                progress_days = int(row['total'] or 0)

    return ChallengeJoinResponse(
        code=ch["code"], title=ch["title"],
        start_date=today.isoformat(),
        progress_days=progress_days,
        duration_days=int(ch["duration_days"])
    )

@app.get("/api/challenges/active", response_model=ChallengeActiveResponse)
def challenges_active(user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT uc.start_date, c.code, c.title, c.duration_days
            FROM user_challenges uc
            JOIN challenges c ON c.id = uc.challenge_id
            WHERE uc.user_id=%s AND uc.status='active'
            ORDER BY uc.start_date DESC
            LIMIT 1
        """, (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "No active challenge")

        start = row["start_date"]
        day = (date.today() - start).days + 1
        day = max(1, min(day, int(row["duration_days"])))

        cur.execute("""
            SELECT COUNT(*) FROM daily_metrics
            WHERE user_id=%s AND m_date BETWEEN %s AND %s
              AND COALESCE(water_ml,0) >= 1500
        """, (user_id, start, start + timedelta(days=int(row["duration_days"]) - 1)))
        progress_days = int(cur.fetchone()[0] or 0)

    return ChallengeActiveResponse(
        code=row["code"], title=row["title"], start_date=start.isoformat(),
        day=day, duration_days=int(row["duration_days"]),
        progress_days=progress_days, target_daily=1500, unit="ml d’eau"
    )

@app.post("/api/coach/adjust-calories", response_model=AdjustCaloriesResponse)
def coach_adjust_calories(user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    profile = get_profile(db, user_id)
    tgt = compute_targets(db, user_id, sex=profile.sex)
    end_d = date.today()
    start_d = end_d - timedelta(days=6)

    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT steps, sleep_hours, protein_g FROM daily_metrics
            WHERE user_id=%s AND m_date BETWEEN %s AND %s
        """, (user_id, start_d, end_d))
        rows = cur.fetchall()

    def mean_safe(vs):
        vs = [x for x in vs if x is not None]
        return (sum(vs)/len(vs)) if vs else 0.0

    steps_avg = mean_safe([r["steps"] or 0 for r in rows])
    sleep_avg = mean_safe([r["sleep_hours"] for r in rows])
    protein_avg = mean_safe([r["protein_g"] for r in rows])

    plateau = detect_plateau(db, user_id)

    if plateau and steps_avg >= 0.8*tgt.steps and sleep_avg >= 0.8*tgt.sleep_hours and protein_avg >= 0.8*tgt.protein_g:
        return AdjustCaloriesResponse(suggestion_kcal_delta=-100, reason="Plateau + bonne adhérence : petite baisse calorique.")
    if plateau:
        return AdjustCaloriesResponse(suggestion_kcal_delta=0, reason="Plateau mais adhérence incomplète : consolider pas/sommeil/protéines d’abord.")
    return AdjustCaloriesResponse(suggestion_kcal_delta=0, reason="Pas de plateau : garde le cap.")

# ---------- Garden & Schedule ----------
@app.get("/api/garden/state", response_model=GardenStateResponse)
def get_garden_state(user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    today = date.today()
    yesterday = today - timedelta(days=1)

    streak = perfect_streak_days(db, user_id)
    watered = daily_complete(db, user_id, today)

    droopy = False
    if streak == 0:
        droopy = not daily_complete(db, user_id, yesterday)

    hints = {
        "seed": "Fais tes 3 habitudes pour faire germer la graine !",
        "sprout": "Continue comme ça pour voir de nouvelles feuilles.",
        "leafy": "Ta plante est en pleine croissance, vise la floraison !",
        "flower": "Superbe fleur ! Maintiens la série pour la garder."
    }
    stage = growth_stage(streak)

    return GardenStateResponse(
        watered_today=watered,
        perfect_streak=streak,
        stage=stage,
        droopy=droopy,
        hint=hints.get(stage, "Continue tes efforts !")
    )

@app.get("/api/schedule/today", response_model=ScheduleResponse)
def get_schedule(user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT habit_id, slot FROM habit_schedule
            WHERE user_id=%s AND s_date=%s
        """, (user_id, date.today()))
        items = cur.fetchall()
    return ScheduleResponse(date=date.today().isoformat(), items=items)

@app.post("/api/schedule/today")
def save_schedule(items: List[ScheduleItem], user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    today = date.today()
    with db.cursor() as cur:
        cur.execute("DELETE FROM habit_schedule WHERE user_id=%s AND s_date=%s", (user_id, today))
        if items:
            values = [(user_id, today, item.habit_id, item.slot) for item in items]
            psycopg2.extras.execute_values(cur, """
                INSERT INTO habit_schedule (user_id, s_date, habit_id, slot)
                VALUES %s
            """, values)
    return {"status": "success"}

# ---------- Habit Management ----------
@app.get("/api/habits/manage", response_model=List[Habit])
def list_all_habits(user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    """Lists all habits created by the user."""
    with db.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("""
            SELECT id, name, icon, category, difficulty FROM habits
            WHERE user_id = %s ORDER BY category, difficulty
        """, (user_id,))
        rows = cur.fetchall()
    return [Habit(id=r['id'], name=r['name'], icon=r['icon'], category=r['category'], difficulty=r['difficulty']) for r in rows]

@app.post("/api/habits/manage", response_model=Habit, status_code=201)
def create_habit(habit: HabitCreate, user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    """Creates a new habit for the user."""
    with db.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("""
            INSERT INTO habits (user_id, name, icon, category, difficulty)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, name, icon, category, difficulty
        """, (user_id, habit.name, habit.icon, habit.category, habit.difficulty))
        new_habit = cur.fetchone()
    return Habit(id=new_habit['id'], name=new_habit['name'], icon=new_habit['icon'], category=new_habit['category'], difficulty=new_habit['difficulty'])

@app.delete("/api/habits/manage/{habit_id}", status_code=204)
def delete_habit(habit_id: int, user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    """Deletes a user's habit."""
    with db.cursor() as cur:
        # Also delete related checkins to maintain data integrity
        cur.execute("DELETE FROM checkins WHERE habit_id = %s AND user_id = %s", (habit_id, user_id))
        cur.execute("DELETE FROM habits WHERE id = %s AND user_id = %s", (habit_id, user_id))
    return {}

# ---------- Profile ----------
@app.get("/api/profile", response_model=Profile)
def profile_get(user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    return get_profile(db, user_id)

@app.put("/api/profile", response_model=Profile)
def profile_put(p: Profile, user_id: UUID = Depends(get_current_user_id), db = Depends(get_db)):
    out = upsert_profile(db, user_id, p)
    return out

@app.get("/")
def root():
    return {"message": "Bienvenue sur l'API de motivation (Supabase) !", "version": APP_VERSION}