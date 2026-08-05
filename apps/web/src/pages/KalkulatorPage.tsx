import { useState } from 'react';
import '../components/ui/ui.css';

type PendingOp = '+' | '-' | '×' | '÷' | null;

function formatDisplay(value: number): string {
  if (!Number.isFinite(value)) return 'Error';
  const rounded = Math.round(value * 1e10) / 1e10;
  return rounded.toString();
}

function applyOp(a: number, b: number, op: PendingOp): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}

const BUTTON_ROWS: readonly (readonly string[])[] = [
  ['C', '⌫', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', '='],
];

export function KalkulatorPage() {
  const [display, setDisplay] = useState('0');
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<PendingOp>(null);
  const [overwrite, setOverwrite] = useState(true);

  function handleDigit(digit: string) {
    if (overwrite) {
      setDisplay(digit === '.' ? '0.' : digit);
      setOverwrite(false);
      return;
    }
    if (digit === '.' && display.includes('.')) return;
    setDisplay((prev) => (prev === '0' && digit !== '.' ? digit : prev + digit));
  }

  function handleOperator(op: Exclude<PendingOp, null>) {
    const current = Number(display);
    if (storedValue !== null && pendingOp && !overwrite) {
      const result = applyOp(storedValue, current, pendingOp);
      setStoredValue(result);
      setDisplay(formatDisplay(result));
    } else {
      setStoredValue(current);
    }
    setPendingOp(op);
    setOverwrite(true);
  }

  function handleEquals() {
    if (pendingOp === null || storedValue === null) return;
    const current = Number(display);
    const result = applyOp(storedValue, current, pendingOp);
    setDisplay(formatDisplay(result));
    setStoredValue(null);
    setPendingOp(null);
    setOverwrite(true);
  }

  function handleClear() {
    setDisplay('0');
    setStoredValue(null);
    setPendingOp(null);
    setOverwrite(true);
  }

  function handleBackspace() {
    if (overwrite) return;
    setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  }

  function handlePercent() {
    const current = Number(display) / 100;
    setDisplay(formatDisplay(current));
    setOverwrite(true);
  }

  function handlePress(label: string) {
    if (label === 'C') return handleClear();
    if (label === '⌫') return handleBackspace();
    if (label === '%') return handlePercent();
    if (label === '=') return handleEquals();
    if (label === '+' || label === '-' || label === '×' || label === '÷') {
      return handleOperator(label);
    }
    return handleDigit(label);
  }

  // Angka panjang mengecilkan font secara bertahap alih-alih terpotong ellipsis.
  const displayFontSize = display.length > 12 ? '1.6rem' : display.length > 9 ? '2.1rem' : display.length > 6 ? '2.7rem' : '3.4rem';

  return (
    <div>
      <div className="page-heading">
        <h2 className="page-heading__title">Kalkulator</h2>
      </div>

      <div className="kalkulator">
        <div className="kalkulator__display">
          <div className="kalkulator__display-sub">
            {storedValue !== null && pendingOp ? `${formatDisplay(storedValue)} ${pendingOp}` : ' '}
          </div>
          <div className="kalkulator__display-main" style={{ fontSize: displayFontSize }}>
            {display}
          </div>
        </div>

        <div className="kalkulator__grid">
          {BUTTON_ROWS.flatMap((row, rowIndex) =>
            row.map((label, colIndex) => {
              const isZero = label === '0';
              const isOperator = label === '+' || label === '-' || label === '×' || label === '÷';
              const isEquals = label === '=';
              const isFunction = label === 'C' || label === '⌫' || label === '%';
              const variant = isEquals ? 'equals' : isOperator ? 'operator' : isFunction ? 'function' : 'digit';
              return (
                <button
                  key={`${rowIndex}-${colIndex}-${label}`}
                  type="button"
                  onClick={() => handlePress(label)}
                  className={`kalkulator__btn kalkulator__btn--${variant}${isZero ? ' kalkulator__btn--wide' : ''}`}
                >
                  {label}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
