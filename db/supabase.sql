-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Mirror Supabase Auth users for FK references.
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
--                TABLES
-- =========================================

-- ---------- Recipes ----------
CREATE TABLE IF NOT EXISTS public.recipes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  kcal INT NOT NULL,
  protein_g INT NOT NULL,
  carbs_g INT NOT NULL,
  fat_g INT NOT NULL,
  prep_min INT NOT NULL DEFAULT 10,
  tags TEXT[] NOT NULL,
  diet TEXT NOT NULL DEFAULT 'omnivore' CHECK (diet IN ('omnivore','vegetarian')),
  ingredients JSONB NOT NULL,      -- [{name, qty, unit}]
  steps TEXT[] NOT NULL
);
-- Ensure idempotent seed by name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_recipes_name'
  ) THEN
    ALTER TABLE public.recipes ADD CONSTRAINT uq_recipes_name UNIQUE(name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recipes_tags ON public.recipes USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_recipes_diet ON public.recipes (diet);

-- ---------- Tips ----------
CREATE TABLE IF NOT EXISTS public.tips (
  id SERIAL PRIMARY KEY,
  tag TEXT NOT NULL,   -- 'energy_low' | 'plateau' | 'hydration' ...
  text TEXT NOT NULL
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_tips_tag_text'
  ) THEN
    ALTER TABLE public.tips ADD CONSTRAINT uq_tips_tag_text UNIQUE(tag, text);
  END IF;
END $$;

-- ---------- Challenges ----------
CREATE TABLE IF NOT EXISTS public.challenges (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_days INT NOT NULL DEFAULT 7
);

CREATE TABLE IF NOT EXISTS public.user_challenges (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  challenge_id INT REFERENCES public.challenges(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  PRIMARY KEY(user_id, challenge_id, start_date)
);

-- ---------- Habits & Checkins ----------
CREATE TABLE IF NOT EXISTS public.habits (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(10),
  category VARCHAR(20) NOT NULL DEFAULT 'lifestyle', -- nutrition/movement/hydration/lifestyle
  difficulty SMALLINT NOT NULL DEFAULT 1,            -- 1 facile, 2 standard, 3 booster
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_habits_user_cat ON public.habits(user_id, category);

CREATE TABLE IF NOT EXISTS public.checkins (
  id SERIAL PRIMARY KEY,
  habit_id INTEGER REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, habit_id, checkin_date)
);
CREATE INDEX IF NOT EXISTS idx_checkins_user_date ON public.checkins(user_id, checkin_date);

-- ---------- Weigh-ins & Goals ----------
CREATE TABLE IF NOT EXISTS public.weigh_ins (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  wi_date DATE NOT NULL,
  kg NUMERIC(5,2) NOT NULL,
  PRIMARY KEY (user_id, wi_date)
);

CREATE TABLE IF NOT EXISTS public.goals (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  target_weight NUMERIC(5,2) NOT NULL,
  target_date DATE,
  pace_kg_per_week NUMERIC(4,2) DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Profile ----------
CREATE TABLE IF NOT EXISTS public.user_profile (
  user_id         UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  sex             TEXT CHECK (sex IN ('male','female')),
  birth_year      INT,
  height_cm       NUMERIC(5,2),
  weight_kg       NUMERIC(5,2),
  activity_factor NUMERIC(3,1),
  deficit_percent NUMERIC(3,2),
  diet            TEXT NOT NULL DEFAULT 'omnivore' CHECK (diet IN ('omnivore','vegetarian')),
  mode            TEXT NOT NULL DEFAULT 'simple'   CHECK (mode IN ('simple','detail')),
  units           TEXT NOT NULL DEFAULT 'metric'   CHECK (units IN ('metric','imperial')),
  timezone        TEXT,
  reminder_time   TIME
);

-- ---------- Daily behavior metrics ----------
CREATE TABLE IF NOT EXISTS public.daily_metrics (
  user_id      UUID REFERENCES public.users(id) ON DELETE CASCADE,
  m_date       DATE NOT NULL,
  steps        INT DEFAULT 0,
  sleep_hours  NUMERIC(3,1),
  protein_g    INT,
  fiber_g      INT,
  water_ml     INT,
  strength_min INT DEFAULT 0,
  cardio_min   INT DEFAULT 0,
  mood         SMALLINT,
  hunger       SMALLINT,
  notes        TEXT,
  PRIMARY KEY (user_id, m_date)
);
CREATE INDEX IF NOT EXISTS idx_metrics_user_date ON public.daily_metrics(user_id, m_date);

-- ---------- Gamification ----------
CREATE TABLE IF NOT EXISTS public.xp_events (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT NOT NULL,       -- e.g. 'habit_done', 'daily_complete'
  amount INT NOT NULL,        -- +XP
  meta JSONB
);
CREATE INDEX IF NOT EXISTS idx_xp_events_user_ts ON public.xp_events(user_id, ts);

-- ---------- Schedule ----------
CREATE TABLE IF NOT EXISTS public.habit_schedule (
  user_id   UUID REFERENCES public.users(id) ON DELETE CASCADE,
  s_date    DATE NOT NULL,
  habit_id  INT REFERENCES public.habits(id) ON DELETE CASCADE,
  slot      TEXT NOT NULL CHECK (slot IN ('morning','lunch','evening')),
  PRIMARY KEY(user_id, s_date, habit_id)
);
CREATE INDEX IF NOT EXISTS idx_schedule_user_date ON public.habit_schedule(user_id, s_date);

-- =========================================
--                 SEEDS
-- (Global data only; no per-user rows here)
-- =========================================

-- Tips (idempotent)
INSERT INTO public.tips(tag, text) VALUES
('energy_low','Énergie basse ? Objectif micro: 5 minutes de marche suffisent aujourd’hui.'),
('energy_low','Mini-habitude: 1 verre d’eau, 1 fruit, 1 marche.'),
('plateau','Plateau 14 jours: +500 pas/j, +10 min de sommeil ou +1 portion de protéines.'),
('hydration','Boire un verre d’eau avant chaque repas aide à la satiété.'),
('hydration','Astuce: garde une gourde visible sur le bureau.')
ON CONFLICT (tag, text) DO NOTHING;

-- Challenges (idempotent)
INSERT INTO public.challenges(code, title, description, duration_days) VALUES
('WATER7','Hydratation 7j','Boire 1.5–2L chaque jour pendant 7 jours',7)
ON CONFLICT (code) DO NOTHING;

-- Recipes (idempotent by name)
INSERT INTO public.recipes (name, kcal, protein_g, carbs_g, fat_g, prep_min, tags, diet, ingredients, steps) VALUES
('Bol yaourt grec protéiné', 350, 30, 40, 8, 5, ARRAY['breakfast','high-protein','easy'],'omnivore',
'[
 {"name":"yaourt grec 0%","qty":200,"unit":"g"},
 {"name":"flocons d''avoine","qty":40,"unit":"g"},
 {"name":"fruits rouges","qty":80,"unit":"g"},
 {"name":"miel","qty":5,"unit":"g"}
]'::jsonb,
ARRAY['Mélanger yaourt et avoine','Ajouter fruits et miel']),
('Omelette 3 œufs & épinards', 420, 28, 5, 30, 8, ARRAY['breakfast','high-protein'],'omnivore',
'[
 {"name":"œufs","qty":3,"unit":"pièce"},
 {"name":"épinards","qty":80,"unit":"g"},
 {"name":"huile d''olive","qty":5,"unit":"g"}
]'::jsonb,
ARRAY['Battre les œufs','Cuire les épinards puis ajouter les œufs']),
('Salade poulet croquante', 520, 45, 25, 24, 15, ARRAY['lunch','high-protein','easy'],'omnivore',
'[
 {"name":"blanc de poulet","qty":150,"unit":"g"},
 {"name":"salade verte","qty":80,"unit":"g"},
 {"name":"tomates","qty":120,"unit":"g"},
 {"name":"maïs","qty":60,"unit":"g"},
 {"name":"vinaigrette légère","qty":20,"unit":"g"}
]'::jsonb,
ARRAY['Cuire le poulet','Assembler avec légumes et vinaigrette']),
('Wrap thon & crudités', 480, 35, 45, 15, 10, ARRAY['lunch','easy'],'omnivore',
'[
 {"name":"tortilla blé","qty":1,"unit":"pièce"},
 {"name":"thon au naturel","qty":120,"unit":"g"},
 {"name":"yaourt nature","qty":60,"unit":"g"},
 {"name":"carottes râpées","qty":60,"unit":"g"},
 {"name":"salade","qty":40,"unit":"g"}
]'::jsonb,
ARRAY['Mélanger thon + yaourt','Garnir la tortilla et rouler']),
('Bol saumon & riz', 650, 40, 70, 20, 20, ARRAY['dinner','high-protein'],'omnivore',
'[
 {"name":"saumon","qty":150,"unit":"g"},
 {"name":"riz cuit","qty":200,"unit":"g"},
 {"name":"brocoli","qty":120,"unit":"g"},
 {"name":"sauce soja","qty":10,"unit":"g"}
]'::jsonb,
ARRAY['Cuire riz et brocoli','Snacker le saumon','Assembler le bol']),
('Curry pois chiches express', 560, 22, 70, 18, 20, ARRAY['dinner','vegetarian','easy'],'vegetarian',
'[
 {"name":"pois chiches","qty":200,"unit":"g"},
 {"name":"coulis de tomate","qty":200,"unit":"g"},
 {"name":"lait de coco","qty":80,"unit":"g"},
 {"name":"riz cuit","qty":150,"unit":"g"}
]'::jsonb,
ARRAY['Chauffer sauce tomate + coco','Ajouter pois chiches','Servir avec riz']),
('Fromage blanc + fruits', 180, 16, 18, 3, 2, ARRAY['snack','high-protein','easy'],'omnivore',
'[
 {"name":"fromage blanc 0%","qty":150,"unit":"g"},
 {"name":"pomme","qty":1,"unit":"pièce"}
]'::jsonb,
ARRAY['Mélanger et servir']),
('Noix & café', 150, 5, 5, 12, 1, ARRAY['snack','easy'],'vegetarian',
'[
 {"name":"noix","qty":25,"unit":"g"},
 {"name":"café","qty":1,"unit":"tasse"}
]'::jsonb,
ARRAY['Rien à faire 😉']),
('Skyr + miel + amandes', 230, 22, 20, 6, 2, ARRAY['snack','high-protein','easy'],'omnivore',
'[
 {"name":"skyr nature","qty":170,"unit":"g"},
 {"name":"miel","qty":5,"unit":"g"},
 {"name":"amandes","qty":10,"unit":"g"}
]'::jsonb,
ARRAY['Mélanger et servir']),
('Œufs durs (+ sel/poivre)', 160, 13, 1, 10, 10, ARRAY['snack','high-protein','easy'],'omnivore',
'[
 {"name":"œufs","qty":2,"unit":"pièce"}
]'::jsonb,
ARRAY['Cuire 9–10 min','Écaler et assaisonner']),
('Houmous + bâtonnets', 220, 7, 18, 12, 5, ARRAY['snack','vegetarian','easy'],'vegetarian',
'[
 {"name":"houmous","qty":60,"unit":"g"},
 {"name":"bâtonnets de carotte","qty":120,"unit":"g"}
]'::jsonb,
ARRAY['Tremper et croquer !'])
ON CONFLICT (name) DO NOTHING;

-- =========================================
--         (Optional) RLS toggles
-- Supabase RLS is OFF by default for SQL-created tables.
-- If you plan to query directly from the client, enable RLS
-- AND write policies. If backend-only, you can keep RLS off.
-- =========================================
-- Example (commented out):
-- ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "owner_can_select_habits"
--   ON public.habits FOR SELECT
--   USING (auth.uid() = user_id);
-- CREATE POLICY "owner_can_mutate_habits"
--   ON public.habits FOR ALL
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);

-- =========================================
-- Done.
-- =========================================
