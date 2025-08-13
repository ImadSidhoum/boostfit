import { useState } from "react";
import { api } from "../api";

function Field({ label, type = "text", value, onChange, placeholder }) {
    return (
        <div>
            <label className="text-sm text-slate-600">{label}</label>
            <input
                className="mt-1 border rounded-xl px-3 py-2 w-full"
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
            />
        </div>
    )
}

export default function AddRecipeForm() {
    const [recipe, setRecipe] = useState({
        name: "",
        kcal: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        prep_min: 10,
        tags: [],
        diet: 'omnivore',
        ingredients: [{ name: "", qty: 1, unit: "pc" }],
        steps: [""]
    });
    const [show, setShow] = useState(false);

    const handleIngredientChange = (index, field, value) => {
        const newIngredients = [...recipe.ingredients];
        newIngredients[index][field] = value;
        setRecipe(p => ({ ...p, ingredients: newIngredients }));
    };

    const handleStepChange = (index, value) => {
        const newSteps = [...recipe.steps];
        newSteps[index] = value;
        setRecipe(p => ({ ...p, steps: newSteps }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post("/recipes", recipe);
            // You can replace this with a toast notification for better UX
            alert("Recette ajoutée !");
            setShow(false); // Hide form on success
            // Reset form
            setRecipe({
                name: "", kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, prep_min: 10,
                tags: [], diet: 'omnivore', ingredients: [{ name: "", qty: 1, unit: "pc" }],
                steps: [""]
            });
        } catch (err) {
            // You can replace this with a toast notification for better UX
            alert("Erreur lors de l'ajout de la recette.");
            console.error(err);
        }
    }

    if (!show) {
        return <button className="btn btn-primary" onClick={() => setShow(true)}>+ Ajouter une recette</button>
    }

    return (
        <div className="card">
            <h3 className="text-xl font-bold mb-3">Nouvelle Recette</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Basic Info */}
                <div className="grid sm:grid-cols-3 gap-3">
                    <Field label="Nom" value={recipe.name} onChange={v => setRecipe(p => ({ ...p, name: v }))} />
                    <Field label="Kcal" type="number" value={recipe.kcal} onChange={v => setRecipe(p => ({ ...p, kcal: Number(v) }))} />
                    <Field label="Protéines (g)" type="number" value={recipe.protein_g} onChange={v => setRecipe(p => ({ ...p, protein_g: Number(v) }))} />
                    <Field label="Glucides (g)" type="number" value={recipe.carbs_g} onChange={v => setRecipe(p => ({ ...p, carbs_g: Number(v) }))} />
                    <Field label="Lipides (g)" type="number" value={recipe.fat_g} onChange={v => setRecipe(p => ({ ...p, fat_g: Number(v) }))} />
                    <Field label="Préparation (min)" type="number" value={recipe.prep_min} onChange={v => setRecipe(p => ({ ...p, prep_min: Number(v) }))} />
                </div>
                {/* Ingredients */}
                <div>
                    <h4 className="font-semibold">Ingrédients</h4>
                    {recipe.ingredients.map((ing, i) => (
                        <div key={i} className="flex gap-2 items-center mt-1">
                            <input value={ing.name} onChange={e => handleIngredientChange(i, 'name', e.target.value)} placeholder="Nom" className="border rounded-lg px-2 py-1 w-full" />
                            <input type="number" value={ing.qty} onChange={e => handleIngredientChange(i, 'qty', Number(e.target.value))} className="border rounded-lg px-2 py-1 w-24" />
                            <input value={ing.unit} onChange={e => handleIngredientChange(i, 'unit', e.target.value)} placeholder="Unité" className="border rounded-lg px-2 py-1 w-24" />
                        </div>
                    ))}
                    <button type="button" onClick={() => setRecipe(p => ({ ...p, ingredients: [...p.ingredients, { name: "", qty: 1, unit: "" }] }))} className="text-sm mt-2 btn bg-white shadow">
                        + Ingrédient
                    </button>
                </div>
                {/* Steps */}
                <div>
                    <h4 className="font-semibold">Étapes</h4>
                    {recipe.steps.map((step, i) => (
                        <div key={i} className="flex gap-2 items-center mt-1">
                            <span>{i + 1}.</span>
                            <input value={step} onChange={e => handleStepChange(i, e.target.value)} placeholder="Description de l'étape" className="border rounded-lg px-2 py-1 w-full" />
                        </div>
                    ))}
                    <button type="button" onClick={() => setRecipe(p => ({ ...p, steps: [...p.steps, ""] }))} className="text-sm mt-2 btn bg-white shadow">
                        + Étape
                    </button>
                </div>
                <div className="flex gap-3">
                    <button type="submit" className="btn btn-primary">Enregistrer la recette</button>
                    <button type="button" className="btn bg-white shadow" onClick={() => setShow(false)}>Annuler</button>
                </div>
            </form>
        </div>
    )
}