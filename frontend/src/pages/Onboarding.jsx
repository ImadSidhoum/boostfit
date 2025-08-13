import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { enableDailyNudge } from "../utils/notify";
import Field from "../components/Field";
import Accordion from "../components/Accordion";
import { AnimatePresence, motion } from "framer-motion";

function HabitManager() {
    const [habits, setHabits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newHabit, setNewHabit] = useState({ name: "", icon: "🎯", category: "lifestyle", difficulty: 1 });

    const loadHabits = async () => {
        setLoading(true);
        try {
            const res = await api.get("/habits/manage");
            setHabits(res.data || []);
        } catch (e) {
            console.error("Failed to load habits", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadHabits() }, []);

    const handleDelete = async (habitId) => {
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette habitude ?")) return;
        try {
            await api.delete(`/habits/manage/${habitId}`);
            setHabits(prev => prev.filter(h => h.id !== habitId));
            // Toast: "Habitude supprimée."
        } catch (e) {
            // Toast: "Erreur lors de la suppression."
        }
    };
    
    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newHabit.name) {
            // Toast: "Le nom est requis."
            return;
        }
        try {
            const res = await api.post("/habits/manage", newHabit);
            setHabits(prev => [...prev, res.data]);
            setShowForm(false);
            setNewHabit({ name: "", icon: "🎯", category: "lifestyle", difficulty: 1 });
            // Toast: "Habitude ajoutée !"
        } catch(e) {
            // Toast: "Erreur lors de l'ajout."
        }
    }

    return (
        <Accordion title="Mes Habitudes Personnalisées">
            <div className="flex justify-end">
                <button className="btn btn-secondary" onClick={() => setShowForm(p => !p)}>
                    {showForm ? 'Annuler' : '+ Ajouter une habitude'}
                </button>
            </div>

            <AnimatePresence>
            {showForm && (
                <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleAdd} className="grid sm:grid-cols-2 gap-4 p-4 mt-4 bg-brand-sand/50 rounded-2xl"
                >
                    <div className="sm:col-span-2">
                        <Field label="Nom de l'habitude" value={newHabit.name} onChange={v => setNewHabit(p => ({...p, name: v}))} placeholder="Ex: Lire 10 pages"/>
                    </div>
                    <Field label="Icône (Emoji)" value={newHabit.icon} onChange={v => setNewHabit(p => ({...p, icon: v}))}/>
                    <Field label="Catégorie" type="select" value={newHabit.category} onChange={v=>setNewHabit(p=>({...p, category: v}))} options={[
                        {value: 'nutrition', label: 'Nutrition'},
                        {value: 'movement', label: 'Mouvement'},
                        {value: 'hydration', label: 'Hydratation'},
                        {value: 'lifestyle', label: 'Lifestyle'},
                    ]}/>
                    <div className="sm:col-span-2">
                        <Field label="Difficulté" type="select" value={newHabit.difficulty} onChange={v=>setNewHabit(p=>({...p, difficulty: Number(v)}))} options={[
                            {value: 1, label: '1 (Facile)'},
                            {value: 2, label: '2 (Standard)'},
                            {value: 3, label: '3 (Booster)'},
                        ]}/>
                    </div>
                    <div className="sm:col-span-2">
                        <button type="submit" className="btn btn-primary">Enregistrer</button>
                    </div>
                </motion.form>
            )}
            </AnimatePresence>

            {loading && <p className="text-center mt-4">Chargement des habitudes...</p>}
            
            <div className="space-y-3 mt-4">
                {!loading && habits.length === 0 && <p className="text-brand-charcoal-light text-center p-4">Vous n'avez pas encore d'habitude personnalisée.</p>}
                {habits.map(h => (
                    <div key={h.id} className="bg-slate-50/80 rounded-2xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{h.icon}</span>
                            <div>
                                <p className="font-semibold">{h.name}</p>
                                <p className="text-xs text-brand-charcoal-light capitalize">{h.category} • difficulté {h.difficulty}</p>
                            </div>
                        </div>
                        <button onClick={() => handleDelete(h.id)} className="text-red-500 hover:text-red-700 font-semibold px-2">
                            Supprimer
                        </button>
                    </div>
                ))}
            </div>
        </Accordion>
    );
}

export default function Onboarding() {
    const [form, setForm] = useState({
        sex: "male", birth_year: 1995, height_cm: 178, weight_kg: 80,
        activity_factor: 1.5, deficit_percent: 0.18, diet: "omnivore",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",
        reminder_time: "18:00"
    });
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const setVal = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    useEffect(() => {
        const load = async () => {
            try {
                const r = await api.get("/profile");
                setForm(prev => ({ ...prev, ...r.data, timezone: r.data.timezone || prev.timezone }));
            } catch (e) {
                // Initial load, no need to show error
            } finally {
                setLoaded(true);
            }
        };
        load();
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            const payload = { ...form };
            ['height_cm', 'weight_kg', 'activity_factor', 'deficit_percent', 'birth_year'].forEach(key => {
                if (payload[key] != null) payload[key] = Number(payload[key]);
            });
            await api.put("/profile", payload);
            // Toast: "Profil enregistré ✅"
        } catch (e) {
            // Toast: "Erreur lors de l’enregistrement."
        } finally {
            setSaving(false);
        }
    };

    const testReminder = async () => {
        try {
            const [hh, mm] = (form.reminder_time || "18:00").split(":").map(Number);
            await enableDailyNudge(async () => {
                new Notification("Rappel BoostFit", { body: "Pense à tes 3 micro-habitudes 💪" });
            }, hh, mm);
            new Notification("Rappel BoostFit", { body: "Test de notification envoyé 👍" });
        } catch (e) {}
    };

    const age = useMemo(() => {
        if (!form.birth_year) return "";
        return Math.max(0, new Date().getFullYear() - Number(form.birth_year));
    }, [form.birth_year]);

    if (!loaded) return <div className="card">Chargement du profil…</div>;

    return (
        <div className="space-y-6">
            <Accordion title="Profil & Préférences" defaultOpen={true}>
                <p className="text-sm text-brand-charcoal-light -mt-2 mb-4">
                    Ces préférences alimentent les cibles du coach, les rappels, et pré-remplissent les autres écrans.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Sexe" type="select" value={form.sex} onChange={v => setVal('sex', v)} options={[{value:'male', label:'Homme'}, {value:'female', label:'Femme'}]} />
                    <Field label="Année de naissance" type="number" value={form.birth_year||""} onChange={v => setVal('birth_year', v)} />
                    <div>
                        <label className="text-sm font-medium text-brand-charcoal-light">Âge (approx.)</label>
                        <div className="form-input bg-slate-50/80 mt-1">{age ? `${age} ans` : '—'}</div>
                    </div>
                    <Field label="Heure de rappel" type="time" value={form.reminder_time || ""} onChange={v => setVal('reminder_time', v)} />
                    <Field label="Taille (cm)" type="number" step="0.5" value={form.height_cm||""} onChange={v => setVal('height_cm', v)} />
                    <Field label="Poids (kg)" type="number" step="0.1" value={form.weight_kg||""} onChange={v => setVal('weight_kg', v)} />
                    <Field label="Régime Alimentaire" type="select" value={form.diet} onChange={v => setVal('diet', v)} options={[{value:'omnivore', label:'Omnivore'}, {value:'vegetarian', label:'Végétarien'}]} />
                </div>

                <div className="flex flex-wrap gap-3 pt-4 mt-4 border-t border-slate-200/80">
                    <button className="btn btn-primary" onClick={save} disabled={saving} type="button">
                        {saving ? 'Sauvegarde...' : 'Enregistrer le Profil'}
                    </button>
                    <button className="btn btn-subtle" onClick={testReminder} type="button">Tester le rappel</button>
                </div>
            </Accordion>
            <HabitManager />
        </div>
    );
}