import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import RecipeCard from "../components/RecipeCard";
import TargetBar from "../components/TargetBar";
import CoachChat from "../components/CoachChat";
import AddRecipeForm from "../components/AddRecipeForm"; // Import the extracted component
import { enableDailyNudge } from "../utils/notify"; // Import the notification utility

export default function Coach() {
  const [form, setForm] = useState({
    sex: "male",
    age: 30,
    height_cm: 178,
    weight_kg: 80,
    activity_factor: 1.5,
    deficit_percent: 0.18,
  });
  const [estimate, setEstimate] = useState(null);
  const [fatPct, setFatPct] = useState(0.30);
  const [macros, setMacros] = useState(null);
  const [insights, setInsights] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [targets, setTargets] = useState(null);
  const [review, setReview] = useState(null);
  const [level, setLevel] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [diet, setDiet] = useState("omnivore");
  const [plan, setPlan] = useState(null);
  const [panier, setPanier] = useState([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [snacks, setSnacks] = useState([]);

  const calorieTarget = useMemo(() => estimate?.calorie_target ?? 1800, [estimate]);
  const proteinTarget = useMemo(() => estimate?.protein_target_g ?? 120, [estimate]);
  const onChange = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const loadChallenge = async () => {
    try {
      const r = await api.get("/challenges/active");
      setChallenge(r.data);
    } catch (e) {
      setChallenge(null);
    }
  };

  const joinWater7 = async () => {
    try {
      await api.post("/challenges/join", null, { params: { code: "WATER7" } });
      await loadChallenge();
      // TODO: Replace with a toast notification for better UX
      console.log("Défi Hydratation lancé 💧");
    } catch (e) {
      // TODO: Replace with a toast notification
      console.error("Impossible de démarrer le défi.");
    }
  };

  const calc = async (e) => {
    e?.preventDefault();
    const res = await api.post("/coach/estimate", form);
    setEstimate(res.data);
  };

  const calcMacros = async () => {
    if (!calorieTarget || !proteinTarget) return;
    try {
      const r = await api.post("/coach/macro-split", {
        calorie_target: calorieTarget,
        protein_target_g: proteinTarget,
        fat_percent: fatPct,
      });
      setMacros(r.data);
    } catch (e) {}
  };

  const loadSnacks = async () => {
    if (!calorieTarget) return;
    try {
      const maxKcal = Math.max(150, Math.round(0.08 * calorieTarget));
      const r = await api.get("/coach/snacks", {
        params: { diet, max_kcal: maxKcal, min_protein: 12, limit: 3 },
      });
      setSnacks(r.data || []);
    } catch (e) {}
  };

  const loadPlan = async () => {
    setLoadingPlan(true);
    try {
      const res = await api.post("/mealplan/today", null, {
        params: { diet, calorie_target: calorieTarget },
      });
      setPlan(res.data);
    } finally {
      setLoadingPlan(false);
    }
  };

  const addToPanier = (recipe) => {
    setPanier(prev => (prev.includes(recipe.id) ? prev : [...prev, recipe.id]));
  };

  const genShopping = async () => {
    if (panier.length === 0) return;
    const res = await api.post("/shopping-list", { recipe_ids: panier });
    const lines = res.data.map(i => `• ${i.name}: ${i.qty} ${i.unit}`.trim()).join("\n");
    await navigator.clipboard.writeText(lines);
    // TODO: Replace with a toast notification
    alert("Liste de courses copiée dans le presse-papiers ✅");
  };

  const exportPlan = async () => {
    if (!plan) return;
    const lines = [
      `Plan du ${plan.date} — ~${plan.total_kcal} kcal, ${plan.total_protein_g} g prot.`,
      ...plan.items.map(
        it =>
          `• ${it.meal_type.toUpperCase()}: ${it.recipe.name} (${it.recipe.kcal} kcal, ${
            it.recipe.protein_g
          } g prot.)`
      ),
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    // TODO: Replace with a toast notification
    alert("Plan repas copié ✅");
  };

  const swapRecipe = async (meal_type, currentKcal, idx) => {
    const res = await api.get("/mealplan/alternatives", {
      params: { meal_type, diet, near_kcal: currentKcal },
    });
    const alt = res.data?.[0];
    if (!alt) {
        // TODO: Replace with a toast notification
        return alert("Pas d'alternative trouvée proche en kcal.");
    }
    setPlan(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], recipe: alt };
      return {
        ...prev,
        items,
        total_kcal: items.reduce((s, it) => s + it.recipe.kcal, 0),
        total_protein_g: items.reduce((s, it) => s + it.recipe.protein_g, 0),
      };
    });
  };

  const loadMetricsTargets = async (userSex) => {
    const [m, t] = await Promise.all([
      api.get("/metrics/today"),
      api.get("/targets", { params: { sex: userSex } }),
    ]);
    setMetrics(m.data);
    setTargets(t.data);
  };

  const saveMetrics = async (next) => {
    setMetrics(next);
    await api.post("/metrics/today", next);
  };

  const runWeeklyReview = async () => {
    const r = await api.get("/review/weekly", { params: { sex: form.sex } });
    setReview(r.data);
     // TODO: Replace with a toast notification or a modal for better UX
    alert(
      [
        `Bilan ${r.data.start} → ${r.data.end}`,
        `Adhérence:`,
        ...Object.entries(r.data.adherence).map(([k, v]) => `• ${k}: ${(v * 100).toFixed(0)}%`),
        r.data.plateau ? "⚠ Plateau détecté" : "Pas de plateau détecté",
        r.data.trend_delta_kg != null ? `Δ poids (tendance): ${r.data.trend_delta_kg} kg` : "",
        "",
        "Suggestions:",
        ...r.data.suggestions.map(s => "• " + s),
      ]
        .filter(Boolean)
        .join("\n")
    );
  };

  const shareWeekly = async () => {
    try {
      const r = review || (await api.get("/review/weekly", { params: { sex: form.sex } })).data;
      const lines = [
        `Mon bilan BoostFit ${r.start} → ${r.end}`,
        ...Object.entries(r.adherence).map(([k, v]) => `• ${k}: ${(v * 100).toFixed(0)}%`),
        r.trend_delta_kg != null ? `Δ poids (tendance): ${r.trend_delta_kg} kg` : "",
        "",
        "Objectif semaine:",
        r.suggestions[0] || "",
      ]
        .filter(Boolean)
        .join("\n");
      if (navigator.share) {
        await navigator.share({ title: "Mon bilan BoostFit", text: lines });
      } else {
        await navigator.clipboard.writeText(lines);
        // TODO: Replace with a toast notification
        alert("Résumé copié 👍");
      }
    } catch (e) {}
  };

  const adjustCalories = async () => {
    const r = await api.post("/coach/adjust-calories", null, { params: { sex: form.sex } });
     // TODO: Replace with a toast notification or modal
    alert(`${r.data.reason}\nSuggestion: ${r.data.suggestion_kcal_delta} kcal`);
  };

  const loadLevel = async () => {
    try {
      const r = await api.get("/gamify/status");
      setLevel(r.data);
    } catch (e) {}
  };

  useEffect(() => {
    const loadInitialData = async () => {
      const profileRes = await api.get("/profile");
      const profileData = profileRes.data;

      const currentYear = new Date().getFullYear();
      const calculatedAge = profileData.birth_year ? currentYear - profileData.birth_year : 30;

      const initialForm = {
        sex: profileData.sex || "male",
        age: calculatedAge,
        height_cm: profileData.height_cm || 178,
        weight_kg: profileData.weight_kg || 80,
        activity_factor: profileData.activity_factor || 1.5,
        deficit_percent: profileData.deficit_percent || 0.18,
      };
      setForm(initialForm);
      setDiet(profileData.diet || "omnivore");

      const estimateRes = await api.post("/coach/estimate", initialForm);
      setEstimate(estimateRes.data);

      await Promise.all([
        api.get("/insights/today").then(r => setInsights(r.data)),
        loadMetricsTargets(initialForm.sex),
        loadLevel(),
        loadChallenge(),
      ]).catch(err => console.error("Error loading initial page data:", err));
    };

    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    calcMacros();
    loadSnacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calorieTarget, proteinTarget, fatPct, diet]);

  useEffect(() => {
    enableDailyNudge(async () => {
      try {
        const [m, t] = await Promise.all([
          api.get("/metrics/today"),
          api.get("/targets", { params: { sex: form.sex } }),
        ]);
        const M = m.data,
          T = t.data;
        const msgs = [];
        if ((M.protein_g || 0) < 0.7 * T.protein_g)
          msgs.push("Sous la cible protéines — snack yaourt grec/œufs ?");
        if ((M.steps || 0) < 0.6 * T.steps)
          msgs.push("Petite marche de 10 min pour booster les pas ?");
        if (msgs.length) new Notification("Coup de pouce BoostFit", { body: msgs.join(" • ") });
      } catch (e) {}
    });
  }, [form.sex]);

  return (
    <div className="space-y-6">
      {/* Level / XP badge + water challenge */}
      <div className="grid sm:grid-cols-2 gap-3">
        {level && (
          <div className="card flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">Niveau</div>
              <div className="font-bold text-lg">
                {level.level} — {level.level_name}
              </div>
              <div className="text-sm text-slate-600">
                {level.total_xp} XP (→ {level.next_level_xp} XP)
              </div>
            </div>
            <div className="w-40">
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.round((level.progress_01 || 0) * 100)}%`,
                    background: "linear-gradient(90deg,#f97316,#fb923c)",
                  }}
                />
              </div>
              <div className="text-right text-xs text-slate-500 mt-1">
                {Math.round((level.progress_01 || 0) * 100)}%
              </div>
            </div>
          </div>
        )}

        <div className="card flex items-center justify-between">
          <div>
            <div className="font-bold">Défi Hydratation 7 jours</div>
            {challenge ? (
              <div className="text-slate-600 text-sm">
                Jour {challenge.day}/{challenge.duration_days} • {challenge.progress_days} jours ≥{" "}
                {challenge.target_daily} {challenge.unit}
              </div>
            ) : (
              <div className="text-slate-600 text-sm">Bois 1.5–2L/j et coche tes progrès</div>
            )}
          </div>
          {challenge ? (
            <button className="btn bg-white shadow" onClick={loadChallenge} title="Rafraîchir">
              ↻
            </button>
          ) : (
            <button className="btn btn-primary" onClick={joinWater7}>
              Démarrer
            </button>
          )}
        </div>
      </div>

      <CoachChat />

      {insights && (
        <div className="card bg-gradient-to-br from-orange-50 to-amber-50/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="badge capitalize">Énergie: {insights.energy}</span>
                <span className="badge">Streak souple: {insights.streak_soft}j</span>
                {insights.plateau && <span className="badge">Plateau détecté</span>}
              </div>
              <p className="mt-2 text-slate-700">{insights.tip}</p>
            </div>
            <div className="text-sm text-slate-500">
              7j done: {(insights.completion_ratio_7d * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">Estimation personnalisée</h2>
          <div className="flex gap-2">
            <button className="btn bg-white shadow" onClick={adjustCalories} type="button">
              Ajuster calories
            </button>
          </div>
        </div>
        <form className="grid sm:grid-cols-3 gap-3" onSubmit={calc}>
          <div>
            <label className="text-sm text-slate-600">Sexe</label>
            <select
              className="mt-1 border rounded-xl px-3 py-2 w-full"
              value={form.sex}
              onChange={e => onChange("sex", e.target.value)}
            >
              <option value="male">Homme</option>
              <option value="female">Femme</option>
            </select>
          </div>
          <Field label="Âge" type="number" value={form.age} onChange={v => onChange("age", Number(v))} />
          <Field
            label="Taille (cm)"
            type="number"
            value={form.height_cm}
            onChange={v => onChange("height_cm", Number(v))}
          />
          <Field
            label="Poids (kg)"
            type="number"
            value={form.weight_kg}
            onChange={v => onChange("weight_kg", Number(v))}
          />
          <Field
            label="Activité (1.2–1.9)"
            type="number"
            step="0.1"
            value={form.activity_factor}
            onChange={v => onChange("activity_factor", Number(v))}
          />
          <Field
            label="Déficit (0–0.2)"
            type="number"
            step="0.01"
            value={form.deficit_percent}
            onChange={v => onChange("deficit_percent", Number(v))}
          />
          <div className="sm:col-span-3">
            <button className="btn btn-primary" type="submit">
              Calculer
            </button>
          </div>
        </form>

        {estimate && (
          <div className="mt-4 grid sm:grid-cols-3 gap-3">
            <Stat label="BMR" value={`${estimate.bmr} kcal`} />
            <Stat label="TDEE" value={`${estimate.tdee} kcal`} />
            <Stat label="Cible kcal" value={`${estimate.calorie_target} kcal`} />
            <Stat label="Protéines" value={`${estimate.protein_target_g} g/j`} />
            <Stat label="Eau" value={`${estimate.water_target_ml} ml/j`} />
            <Stat label="Fibres" value={`${estimate.fiber_target_g} g/j`} />
            <div className="sm:col-span-3 text-slate-600 text-sm mt-2">
              {estimate.notes.map((n, i) => (
                <div key={i}>• {n}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {estimate && (
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Répartition des macros</h2>
            <div className="text-sm text-slate-600">Cible: {calorieTarget} kcal</div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mt-3">
            <div>
              <label className="text-sm text-slate-600">Part de lipides (% des kcal)</label>
              <input
                type="range"
                min="20"
                max="40"
                step="1"
                className="w-full"
                value={Math.round(fatPct * 100)}
                onChange={e => setFatPct(Number(e.target.value) / 100)}
              />
              <div className="text-slate-600 text-sm mt-1">{Math.round(fatPct * 100)}%</div>
            </div>
            {macros && (
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Protéines" value={`${macros.protein_g} g`} />
                <Stat label="Glucides" value={`${macros.carbs_g} g`} />
                <Stat label="Lipides" value={`${macros.fat_g} g`} />
                {macros.notes?.length ? (
                  <div className="col-span-3 text-sm text-slate-600">{macros.notes[0]}</div>
                ) : null}
                <div className="col-span-3">
                  <button
                    className="btn bg-white shadow"
                    onClick={async () => {
                      const t = `Macros ${calorieTarget} kcal — P${macros.protein_g} / G${macros.carbs_g} / L${macros.fat_g}`;
                      await navigator.clipboard.writeText(t);
                      alert("Macros copiées ✅");
                    }}
                  >
                    Copier
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {metrics && targets && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Cibles du jour & journal</h2>
            <div className="flex gap-2">
              <button className="btn bg-white shadow" onClick={shareWeekly} type="button">
                Partager
              </button>
              <button
                className="btn bg-white shadow"
                onClick={() => loadMetricsTargets(form.sex)}
                title="Rafraîchir"
                type="button"
              >
                ↻
              </button>
              <button className="btn btn-primary" onClick={runWeeklyReview} type="button">
                Bilan 7 jours
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <TargetBar
              label="Pas"
              unit="pas"
              value={metrics.steps || 0}
              target={targets.steps}
              onChange={v => saveMetrics({ ...metrics, steps: v })}
            />
            <TargetBar
              label="Sommeil"
              unit="h"
              value={metrics.sleep_hours || 0}
              target={targets.sleep_hours}
              step={0.1}
              onChange={v => saveMetrics({ ...metrics, sleep_hours: v })}
            />
            <TargetBar
              label="Protéines"
              unit="g"
              value={metrics.protein_g || 0}
              target={targets.protein_g}
              onChange={v => saveMetrics({ ...metrics, protein_g: v })}
            />
            <TargetBar
              label="Fibres"
              unit="g"
              value={metrics.fiber_g || 0}
              target={targets.fiber_g}
              onChange={v => saveMetrics({ ...metrics, fiber_g: v })}
            />
            <TargetBar
              label="Hydratation"
              unit="ml"
              value={metrics.water_ml || 0}
              target={targets.water_ml}
              onChange={v => saveMetrics({ ...metrics, water_ml: v })}
            />
            <TargetBar
              label="Renfo (hebdo)"
              unit="min"
              value={metrics.strength_min || 0}
              target={targets.strength_min_week}
              onChange={v => saveMetrics({ ...metrics, strength_min: v })}
            />
            <TargetBar
              label="Cardio (hebdo)"
              unit="min"
              value={metrics.cardio_min || 0}
              target={targets.cardio_min_week_min}
              onChange={v => saveMetrics({ ...metrics, cardio_min: v })}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <QuickScale
              label="Humeur"
              value={metrics.mood ?? ""}
              onChange={v => saveMetrics({ ...metrics, mood: v })}
            />
            <QuickScale
              label="Faim"
              value={metrics.hunger ?? ""}
              onChange={v => saveMetrics({ ...metrics, hunger: v })}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Notes</label>
            <textarea
              className="mt-1 border rounded-xl px-3 py-2 w-full"
              rows={3}
              value={metrics.notes ?? ""}
              onChange={e => saveMetrics({ ...metrics, notes: e.target.value })}
              placeholder="Non-scale victories, obstacles, idées pour demain…"
            />
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Plan repas du jour</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Régime</label>
            <select
              className="border rounded-xl px-3 py-2"
              value={diet}
              onChange={e => setDiet(e.target.value)}
            >
              <option value="omnivore">Omnivore</option>
              <option value="vegetarian">Végétarien</option>
            </select>
            <button className="btn bg-white shadow" onClick={exportPlan} disabled={!plan}>
              Exporter
            </button>
            <button className="btn btn-primary" onClick={loadPlan} disabled={loadingPlan}>
              {loadingPlan ? "..." : "Générer"}
            </button>
          </div>
        </div>

        {plan && (
          <div className="space-y-3">
            <div className="text-slate-600 text-sm">
              Total ≈ <b>{plan.total_kcal} kcal</b> • <b>{plan.total_protein_g} g</b> de protéines
              {estimate?.protein_target_g ? (
                <>
                  {" "}
                  (cible: <b>{estimate.protein_target_g} g</b>)
                </>
              ) : null}
            </div>
            {plan.items.map((it, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm uppercase text-slate-500">{it.meal_type}</div>
                  <button
                    className="text-sm underline"
                    onClick={() => swapRecipe(it.meal_type, it.recipe.kcal, idx)}
                  >
                    ↻ Remplacer
                  </button>
                </div>
                <RecipeCard recipe={it.recipe} onAdd={addToPanier} />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <button className="btn btn-primary" onClick={genShopping}>
                Copier liste de courses
              </button>
              <span className="text-slate-600 text-sm">
                Recettes sélectionnées: {panier.length}
              </span>
            </div>
          </div>
        )}
        {!plan && (
          <p className="text-slate-600">
            Clique sur “Générer” pour proposer un PDJ/Déj/Dîner + 2 snacks adaptés à ta cible.
          </p>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">Snacks rapides</h2>
          <button className="btn bg-white shadow" onClick={loadSnacks} title="Rafraîchir">
            ↻
          </button>
        </div>
        {snacks.length === 0 && (
          <div className="text-slate-600">
            Aucun snack trouvé — essaye un autre régime ou génère le plan repas.
          </div>
        )}
        <div className="grid gap-3">
          {snacks.map(r => (
            <RecipeCard key={r.id} recipe={r} onAdd={addToPanier} />
          ))}
        </div>
      </div>

      <AddRecipeForm />
    </div>
  );
}

function Field({ label, type = "text", value, onChange, step }) {
  return (
    <div>
      <label className="text-sm text-slate-600">{label}</label>
      <input
        className="mt-1 border rounded-xl px-3 py-2 w-full"
        type={type}
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-orange-50 rounded-xl p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold text-lg">{value}</div>
    </div>
  );
}

function QuickScale({ label, value, onChange }) {
  return (
    <div>
      <div className="text-sm text-slate-600 mb-1">{label} (1–5)</div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            className={`btn ${value === n ? "btn-primary" : "bg-white shadow"}`}
            onClick={() => onChange(n)}
            type="button"
          >
            {n}
          </button>
        ))}
        <button className="btn bg-white shadow" onClick={() => onChange(null)} type="button">
          Effacer
        </button>
      </div>
    </div>
  );
}