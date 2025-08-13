import { useState } from "react";
import { api } from "../api";
import Accordion from "./Accordion";
import Field from "./Field";

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

    const addIngredient = () => {
        setRecipe(p => ({ ...p, ingredients: [...p.ingredients, { name: "", qty: 1, unit: "pc" }] }));
    };

    const removeIngredient = (index) => {
        setRecipe(p => ({ ...p, ingredients: p.ingredients.filter((_, i) => i !== index) }));
    };

    const addStep = () => {
        setRecipe(p => ({ ...p, steps: [...p.steps, ""] }));
    };
    
    const removeStep = (index) => {
        setRecipe(p => ({ ...p, steps: p.steps.filter((_, i) => i !== index) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post("/recipes", recipe);
            // Toast: "Recette ajoutée !"
            // Reset form
            setRecipe({
                name: "", kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, prep_min: 10,
                tags: [], diet: 'omnivore', ingredients: [{ name: "", qty: 1, unit: "pc" }],
                steps: [""]
            });
        } catch (err) {
            // Toast: "Erreur lors de l'ajout de la recette."
            console.error(err);
        }
    }

    return (
        <Accordion title="Ajouter une Recette Manuellement">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Nom de la recette" value={recipe.name} onChange={v => setRecipe(p => ({ ...p, name: v }))} />
                    <Field label="Temps (min)" type="number" value={recipe.prep_min} onChange={v => setRecipe(p => ({ ...p, prep_min: Number(v) }))} />
                    <Field label="Kcal" type="number" value={recipe.kcal} onChange={v => setRecipe(p => ({ ...p, kcal: Number(v) }))} />
                    <Field label="Protéines (g)" type="number" value={recipe.protein_g} onChange={v => setRecipe(p => ({ ...p, protein_g: Number(v) }))} />
                    <Field label="Glucides (g)" type="number" value={recipe.carbs_g} onChange={v => setRecipe(p => ({...p, carbs_g: Number(v)}))} />
                    <Field label="Lipides (g)" type="number" value={recipe.fat_g} onChange={v => setRecipe(p => ({...p, fat_g: Number(v)}))} />
                </div>

                {/* Ingredients */}
                <div>
                    <h4 className="font-semibold mb-2">Ingrédients</h4>
                    <div className="space-y-2">
                        {recipe.ingredients.map((ing, i) => (
                             <div key={i} className="grid grid-cols-[1fr,80px,80px,auto] gap-2 items-center">
                                <input value={ing.name} onChange={e => handleIngredientChange(i, 'name', e.target.value)} placeholder="Nom" className="form-input !mt-0" />
                                <input type="number" value={ing.qty} onChange={e => handleIngredientChange(i, 'qty', Number(e.target.value))} className="form-input !mt-0" />
                                <input value={ing.unit} onChange={e => handleIngredientChange(i, 'unit', e.target.value)} placeholder="Unité" className="form-input !mt-0" />
                                <button type="button" onClick={() => removeIngredient(i)} className="text-red-500 hover:text-red-700 h-full">
                                    &times;
                                </button>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={addIngredient} className="btn btn-subtle mt-3 !py-2 !px-4 text-sm">+ Ingrédient</button>
                </div>

                {/* Steps */}
                <div>
                     <h4 className="font-semibold mb-2">Étapes</h4>
                     <div className="space-y-2">
                        {recipe.steps.map((step, i) => (
                            <div key={i} className="flex gap-2 items-center">
                                <span className="font-semibold text-brand-charcoal-light">{i + 1}.</span>
                                <input value={step} onChange={e => handleStepChange(i, e.target.value)} placeholder="Description de l'étape" className="form-input !mt-0 w-full" />
                                <button type="button" onClick={() => removeStep(i)} className="text-red-500 hover:text-red-700">
                                    &times;
                                </button>
                            </div>
                        ))}
                     </div>
                     <button type="button" onClick={addStep} className="btn btn-subtle mt-3 !py-2 !px-4 text-sm">+ Étape</button>
                </div>
                <div className="pt-4 border-t border-slate-200/80">
                    <button type="submit" className="btn btn-primary">Enregistrer la recette</button>
                </div>
            </form>
        </Accordion>
    );
}