import "./ChoiceGroup.css";

export type ChoiceOption<T extends string> = {
  value: T;
  title: string;
  hint?: string;
};

export type ChoiceGroupProps<T extends string> = {
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
};

export function ChoiceGroup<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: ChoiceGroupProps<T>) {
  return (
    <div className="ui-choice-group" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={`ui-choice${active ? " ui-choice--active" : ""}`}
            onClick={() => onChange(opt.value)}
          >
            <span className="ui-choice__title">{opt.title}</span>
            {opt.hint ? <span className="ui-choice__hint">{opt.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
