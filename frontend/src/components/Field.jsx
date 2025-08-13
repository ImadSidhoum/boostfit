export default function Field({ label, type = "text", value, onChange, step, options, placeholder, name, required }) {
    const commonProps = {
      className: "form-input",
      value: value ?? "",
      onChange: e => onChange(e.target.value),
      placeholder: placeholder,
      name: name,
      id: name || label,
      required: required,
    };
  
    return (
      <div>
        <label htmlFor={name || label} className="text-sm font-medium text-brand-charcoal-light">{label}</label>
        {type === "select" ? (
          <select {...commonProps}>
            {(options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : type === "textarea" ? (
            <textarea {...commonProps} rows={3} />
        ) : (
          <input
            type={type}
            step={step}
            {...commonProps}
          />
        )}
      </div>
    );
  }