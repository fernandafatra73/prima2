import { useState } from 'react';

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

  return (
    <div>
      <div className="page-heading">
        <h2 className="page-heading__title">Kalkulator</h2>
      </div>

      <div style={{ maxWidth: '320px' }}>
        <div
          style={{
            background: '#0f172a',
            color: '#ffffff',
            borderRadius: '12px 12px 0 0',
            padding: '1.25rem 1rem',
            textAlign: 'right',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', minHeight: '1.1rem' }}>
            {storedValue !== null && pendingOp ? `${formatDisplay(storedValue)} ${pendingOp}` : ' '}
          </div>
          <div
            style={{
              fontSize: '2.2rem',
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {display}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '2px',
            background: '#e2e8f0',
            borderRadius: '0 0 12px 12px',
            overflow: 'hidden',
          }}
        >
          {BUTTON_ROWS.flatMap((row, rowIndex) =>
            row.map((label, colIndex) => {
              const isZero = label === '0';
              const isOperator = label === '+' || label === '-' || label === '×' || label === '÷';
              const isEquals = label === '=';
              const isFunction = label === 'C' || label === '⌫' || label === '%';
              return (
                <button
                  key={`${rowIndex}-${colIndex}-${label}`}
                  type="button"
                  onClick={() => handlePress(label)}
                  style={{
                    gridColumn: isZero ? 'span 2' : undefined,
                    border: 'none',
                    padding: '1.1rem 0',
                    fontSize: '1.15rem',
                    fontWeight: isOperator || isEquals ? 700 : 500,
                    cursor: 'pointer',
                    background: isEquals ? '#2563eb' : isOperator ? '#dbeafe' : isFunction ? '#f1f5f9' : '#ffffff',
                    color: isEquals ? '#ffffff' : isOperator ? '#2563eb' : '#0f172a',
                  }}
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
