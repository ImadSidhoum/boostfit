import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import RecipeCard from "../components/RecipeCard";
import TargetBar from "../components/TargetBar";
import CoachChat from "../components/CoachChat";
import AddRecipeForm from "../components/AddRecipeForm";
import LevelBadge from "../components/LevelBadge";
import Accordion from "../components/Accordion";
import Field from "../components/Field";
import { IconArrowPath } from "../components/Icons";
import { enableDailyNudge } from "../utils/notify";

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
      // Toast: "Défi Hydratation lancé 💧"
    } catch (e) {
      // Toast: "Impossible de démarrer le défi."
      console.error(e);
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
    // Toast: "Liste de courses copiée ✅"
  };

  const exportPlan = async () => {
    if (!plan) return;
    const lines = [
      `Plan du ${plan.date} — ~${plan.total_kcal} kcal, ${plan.total_protein_g} g prot.`,
      ...plan.items.map(it => `• ${it.meal_type.toUpperCase()}: ${it.recipe.name} (${it.recipe.kcal} kcal, ${it.recipe.protein_g} g prot.)`),
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    // Toast: "Plan repas copié ✅"
  };

  const swapRecipe = async (meal_type, currentKcal, idx) => {
    const res = await api.get("/mealplan/alternatives", { params: { meal_type, diet, near_kcal: currentKcal } });
    const alt = res.data?.[0];
    if (!alt) {
        // Toast: "Pas d'alternative trouvée."
        return;
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
    const reviewText = [
        `Bilan ${r.data.start} → ${r.data.end}`,
        `Adhérence:`,
        ...Object.entries(r.data.adherence).map(([k, v]) => `• ${k}: ${(v * 100).toFixed(0)}%`),
        r.data.plateau ? "⚠ Plateau détecté" : "Pas de plateau détecté",
        r.data.trend_delta_kg != null ? `Δ poids (tendance): ${r.data.trend_delta_kg} kg` : "",
        "",
        "Suggestions:",
        ...r.data.suggestions.map(s => "• " + s),
    ].filter(Boolean).join("\n");
    // NOTE: This should be a modal for a better UX.
    alert(reviewText);
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
      ].filter(Boolean).join("\n");
      if (navigator.share) {
        await navigator.share({ title: "Mon bilan BoostFit", text: lines });
      } else {
        await navigator.clipboard.writeText(lines);
        // Toast: "Résumé copié 👍"
      }
    } catch (e) {}
  };

  const adjustCalories = async () => {
    const r = await api.post("/coach/adjust-calories", null, { params: { sex: form.sex } });
    // Toast: `${r.data.reason}\nSuggestion: ${r.data.suggestion_kcal_delta} kcal`
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
  }, []);

  useEffect(() => {
    calcMacros();
    loadSnacks();
  }, [calorieTarget, proteinTarget, fatPct, diet]);

  useEffect(() => {
    enableDailyNudge(async () => {
      try {
        const [m, t] = await Promise.all([
          api.get("/metrics/today"),
          api.get("/targets", { params: { sex: form.sex } }),
        ]);
        const M = m.data, T = t.data;
        const msgs = [];
        if ((M.protein_g || 0) < 0.7 * T.protein_g) msgs.push("Sous la cible protéines — snack yaourt grec/œufs ?");
        if ((M.steps || 0) < 0.6 * T.steps) msgs.push("Petite marche de 10 min pour booster les pas ?");
        if (msgs.length) new Notification("Coup de pouce BoostFit", { body: msgs.join(" • ") });
      } catch (e) {}
    });
  }, [form.sex]);

  return (
    <div className="space-y-5">
      {level && <LevelBadge />}

      {challenge ? (
        <div className="card flex items-center justify-between">
          <div>
            <div className="font-bold">Défi Hydratation 7 jours</div>
            <div className="text-brand-charcoal-light text-sm">
              Jour {challenge.day}/{challenge.duration_days} • {challenge.progress_days} jours ≥{" "}
              {challenge.target_daily} {challenge.unit}
            </div>
          </div>
          <button className="btn btn-subtle !p-2" onClick={loadChallenge} title="Rafraîchir">
            <IconArrowPath className="w-5 h-5"/>
          </button>
        </div>
      ) : (
        <div className="card flex items-center justify-between">
            <div>
                <div className="font-bold">Défi Hydratation 7 jours</div>
                <div className="text-brand-charcoal-light text-sm">Bois 1.5–2L/j et coche tes progrès</div>
            </div>
            <button className="btn btn-secondary" onClick={joinWater7}>Démarrer</button>
        </div>
      )}

      <CoachChat compact />

      {insights && (
        <div className="card bg-brand-sand/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="badge capitalize">Énergie: {insights.energy}</span>
                        <span className="badge">Streak souple: {insights.streak_soft}j</span>
                        {insights.plateau && <span className="badge">Plateau détecté</span>}
                    </div>
                    <p className="mt-3 text-brand-charcoal-light">{insights.tip}</p>
                </div>
            </div>
        </div>
      )}

      <Accordion title="Estimation Personnalisée">
        <form className="grid sm:grid-cols-2 gap-4" onSubmit={calc}>
          <Field label="Sexe" type="select" value={form.sex} onChange={v => onChange("sex", v)} options={[{ value: 'male', label: 'Homme' }, { value: 'female', label: 'Femme' }]} />
          <Field label="Âge" type="number" value={form.age} onChange={v => onChange("age", Number(v))} />
          <Field label="Taille (cm)" type="number" value={form.height_cm} onChange={v => onChange("height_cm", Number(v))} />
          <Field label="Poids (kg)" type="number" value={form.weight_kg} onChange={v => onChange("weight_kg", Number(v))} />
          <Field label="Activité (1.2–1.9)" type="number" step="0.1" value={form.activity_factor} onChange={v => onChange("activity_factor", Number(v))} />
          <Field label="Déficit (0–0.2)" type="number" step="0.01" value={form.deficit_percent} onChange={v => onChange("deficit_percent", Number(v))} />
          
          <div className="sm:col-span-2 flex flex-wrap gap-3">
            <button className="btn btn-primary" type="submit">Recalculer</button>
            <button className="btn btn-subtle" onClick={adjustCalories} type="button">Ajustement Auto</button>
          </div>
        </form>

        {estimate && (
          <div className="mt-4 pt-4 border-t border-slate-200/80">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Stat label="BMR" value={estimate.bmr} unit="kcal" />
              <Stat label="TDEE" value={estimate.tdee} unit="kcal" />
              <Stat label="Cible Kcal" value={estimate.calorie_target} unit="kcal" />
              <Stat label="Protéines" value={`${estimate.protein_target_g}`} unit="g/j" />
              <Stat label="Eau" value={`${estimate.water_target_ml}`} unit="ml/j" />
              <Stat label="Fibres" value={`${estimate.fiber_target_g}`} unit="g/j" />
            </div>
            <div className="sm:col-span-3 text-brand-charcoal-light text-sm mt-3 space-y-1">
                {estimate.notes.map((n, i) => <p key={i}>• {n}</p>)}
            </div>
          </div>
        )}
      </Accordion>

      {metrics && targets && (
          <Accordion title="Journal Quotidien" defaultOpen={true}>
              <div className="flex flex-wrap gap-3 mb-4">
                  <button className="btn btn-primary" onClick={runWeeklyReview} type="button">Bilan 7 jours</button>
                  <button className="btn btn-subtle" onClick={shareWeekly} type="button">Partager</button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                  <TargetBar label="Pas" unit="pas" value={metrics.steps || 0} target={targets.steps} onChange={v => saveMetrics({ ...metrics, steps: v })} />
                  <TargetBar label="Sommeil" unit="h" value={metrics.sleep_hours || 0} target={targets.sleep_hours} step={0.1} onChange={v => saveMetrics({ ...metrics, sleep_hours: v })} />
                  <TargetBar label="Protéines" unit="g" value={metrics.protein_g || 0} target={targets.protein_g} onChange={v => saveMetrics({ ...metrics, protein_g: v })} />
                  <TargetBar label="Hydratation" unit="ml" value={metrics.water_ml || 0} target={targets.water_ml} onChange={v => saveMetrics({ ...metrics, water_ml: v })} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4 pt-4 mt-4 border-t border-slate-200/80">
                  <QuickScale label="Humeur" value={metrics.mood ?? ""} onChange={v => saveMetrics({ ...metrics, mood: v })} />
                  <QuickScale label="Faim" value={metrics.hunger ?? ""} onChange={v => saveMetrics({ ...metrics, hunger: v })} />
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200/80">
                  <Field label="Notes du jour" type="textarea" value={metrics.notes ?? ""} onChange={v => saveMetrics({ ...metrics, notes: v })} placeholder="Non-scale victories, obstacles, idées..." />
              </div>
          </Accordion>
      )}

      <Accordion title="Plan Repas du Jour">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex-1 min-w-[150px]">
                  <Field label="Régime" type="select" value={diet} onChange={setDiet} options={[ {value: 'omnivore', label: 'Omnivore'}, {value: 'vegetarian', label: 'Végétarien'} ]} />
              </div>
              <div className="flex items-center gap-2">
                  <button className="btn btn-subtle" onClick={exportPlan} disabled={!plan}>Exporter</button>
                  <button className="btn btn-primary" onClick={loadPlan} disabled={loadingPlan}>
                      {loadingPlan ? "..." : "Générer"}
                  </button>
              </div>
          </div>
          {plan && (
              <div className="space-y-4">
                  <div className="bg-brand-sand/60 p-3 rounded-xl text-center text-sm">
                      Total ≈ <b>{plan.total_kcal} kcal</b> • <b>{plan.total_protein_g} g</b> de protéines
                  </div>
                  {plan.items.map((it, idx) => (
                      <div key={idx}>
                          <div className="flex items-center justify-between mb-1">
                              <div className="text-sm uppercase font-semibold text-brand-charcoal-light">{it.meal_type}</div>
                              <button className="text-sm underline text-brand-charcoal-light hover:text-brand-gold" onClick={() => swapRecipe(it.meal_type, it.recipe.kcal, idx)}>
                                  ↻ Remplacer
                              </button>
                          </div>
                          <RecipeCard recipe={it.recipe} onAdd={addToPanier} />
                      </div>
                  ))}
                  <div className="flex items-center gap-3 pt-3 border-t border-slate-200/80">
                      <button className="btn btn-secondary" onClick={genShopping}>
                          Copier Liste Courses ({panier.length})
                      </button>
                  </div>
              </div>
          )}
          {!plan && !loadingPlan && (
              <p className="text-brand-charcoal-light">Cliquez sur “Générer” pour créer un plan repas adapté à votre cible calorique.</p>
          )}
      </Accordion>

      <Accordion title="Idées de Snacks Rapides">
          <div className="flex justify-end mb-2">
              <button className="btn btn-subtle !p-2" onClick={loadSnacks} title="Rafraîchir">
                  <IconArrowPath className="w-5 h-5"/>
              </button>
          </div>
          {snacks.length === 0 && (
              <div className="text-brand-charcoal-light text-center p-4">Aucun snack trouvé pour vos critères.</div>
          )}
          <div className="grid gap-3">
              {snacks.map(r => (
                  <RecipeCard key={r.id} recipe={r} onAdd={addToPanier} />
              ))}
          </div>
      </Accordion>

      <AddRecipeForm />
    </div>
  );
}

// Helper Components
function Stat({ label, value, unit }) {
  return (
    <div className="bg-brand-sand/50 rounded-2xl p-4 text-center">
      <div className="text-sm text-brand-charcoal-light">{label}</div>
      <div className="font-bold text-2xl text-brand-charcoal-dark tracking-tight">
        {value}
        {unit && <span className="text-base font-medium ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function QuickScale({ label, value, onChange }) {
  return (
    <div>
      <div className="text-sm font-medium text-brand-charcoal-light mb-2">{label} (1–5)</div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            className={`btn !py-2 !px-4 ${value === n ? "btn-secondary" : "btn-subtle"}`}
            onClick={() => onChange(n)}
            type="button"
          >
            {n}
          </button>
        ))}
        <button className="btn btn-ghost !py-2 !px-4" onClick={() => onChange(null)} type="button">
          Effacer
        </button>
      </div>
    </div>
  );
}