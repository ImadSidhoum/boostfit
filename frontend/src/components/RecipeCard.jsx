export default function RecipeCard({ recipe, onAdd }){
    return (
      <div className="card flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-lg">{recipe.name}</div>
          <div className="text-sm text-slate-600">
            {recipe.kcal} kcal • {recipe.protein_g} g protéines • {recipe.prep_min} min
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {recipe.tags?.slice(0,4).map(t => (
              <span key={t} className="badge">{t}</span>
            ))}
          </div>
        </div>
        {onAdd && (
          <button className="btn btn-primary" onClick={() => onAdd(recipe)}>
            Ajouter
          </button>
        )}
      </div>
    )
  }
  