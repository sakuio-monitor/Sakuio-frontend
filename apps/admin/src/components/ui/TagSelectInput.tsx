import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import "./TagSelectInput.css";

type TagSelectInputProps = {
  /** 已选标签（受控） */
  value: string[];
  onChange: (tags: string[]) => void;
  /** 全部候选（实时过滤展示；输入未命中时回车自动创建） */
  suggestions?: string[];
  placeholder?: string;
  inputAriaLabel?: string;
};

/**
 * 通用标签选择输入框（参考 Tsukiyo 实例模板管理的分类输入）：
 * - 输入文字回车添加；不存在的新标签自动创建
 * - 输入过程中下方实时展示匹配的候选，点击即添加
 * - Backspace 空输入删除最后一个；chip 上的 X 删除单个
 */
export function TagSelectInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  inputAriaLabel,
}: TagSelectInputProps) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = input.trim();
  const matches = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return suggestions
      .filter((s) => !value.includes(s) && s.toLowerCase().includes(q))
      .slice(0, 8);
  }, [suggestions, value, query]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function addTag(tag: string) {
    const t = tag.trim();
    if (!t || value.includes(t)) {
      setInput("");
      return;
    }
    onChange([...value, t]);
    setInput("");
    inputRef.current?.focus();
  }

  function removeTag(tag: string) {
    onChange(value.filter((v) => v !== tag));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const next = query || matches[0];
      if (next) addTag(next);
      return;
    }
    if (e.key === "Backspace" && !input && value.length > 0) {
      e.preventDefault();
      removeTag(value[value.length - 1]);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="tag-select" ref={rootRef}>
      <div className="tag-select__control" onClick={() => inputRef.current?.focus()}>
        {value.map((tag) => (
          <span key={tag} className="tag-select__chip">
            {tag}
            <button
              type="button"
              className="tag-select__chip-x"
              aria-label={`删除 ${tag}`}
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
            >
              <X size={12} aria-hidden />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="tag-select__input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          placeholder={value.length ? "" : placeholder}
          aria-label={inputAriaLabel}
        />
      </div>
      {open && matches.length > 0 ? (
        <div className="tag-select__dropdown" role="listbox">
          {matches.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={false}
              className="tag-select__option"
              onClick={() => {
                addTag(s);
                setOpen(false);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
