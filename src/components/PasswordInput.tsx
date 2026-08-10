import { useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * A password <input> with a show/hide toggle. Same visual language as the
 * eye/eye-slash toggle already used for the saldo visibility on Dashboard.tsx.
 * The toggle button is absolutely positioned inside a relative wrapper, so
 * callers must include right padding (e.g. `pr-10`) in their own className
 * for the typed text not to sit under the icon.
 */
export default function PasswordInput({ className, id, ...rest }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="relative">
      <input {...rest} id={inputId} type={visible ? 'text' : 'password'} className={className} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        aria-controls={inputId}
        tabIndex={0}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
      >
        {visible ? <EyeSlash size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
