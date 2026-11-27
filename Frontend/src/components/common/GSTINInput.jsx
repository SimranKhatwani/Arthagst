import React, { useState, useEffect, useId } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { validateGSTIN, formatGSTINInput, GST_STATE_CODES } from '../../utils/gstinValidator.js';

/**
 * Strict Indian GSTIN Input Component
 * Automatically transforms lowercase to uppercase, blocks non-alphanumeric chars,
 * restricts length to 15, and validates state code, PAN structure, 14th char 'Z',
 * and official Mod-36 checksum with immediate inline feedback.
 */
export const GSTINInput = ({
  value = '',
  onChange,
  onBlur,
  required = false,
  label = 'GSTIN',
  placeholder = 'e.g. 27AAPFU0939F1ZV',
  disabled = false,
  className = '',
  inputClassName = '',
  onPanDerived,
  onStateDerived,
  onErrorChange,
  id,
  name = 'gstin',
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [touched, setTouched] = useState(false);

  const rawValue = value || '';
  const validation = validateGSTIN(rawValue, { required });
  const hasValue = rawValue.trim().length > 0;

  // Inform parent of error state changes
  useEffect(() => {
    if (onErrorChange) {
      onErrorChange(validation.isValid ? null : validation.error);
    }
  }, [validation.isValid, validation.error, onErrorChange]);

  // Handle change: uppercase, strip non-alphanumeric, max 15 chars
  const handleChange = (e) => {
    const formatted = formatGSTINInput(e.target.value);
    if (onChange) {
      onChange({
        target: {
          name,
          value: formatted,
        },
      });
    }

    const res = validateGSTIN(formatted, { required });
    if (res.pan && onPanDerived) {
      onPanDerived(res.pan);
    }
    if (res.stateName && onStateDerived) {
      onStateDerived(res.stateName, res.stateCode);
    }
  };

  const handleBlur = (e) => {
    setTouched(true);
    if (onBlur) onBlur(e);
  };

  const showError = (touched || hasValue) && !validation.isValid;
  const showSuccess = hasValue && validation.isValid;

  // Detect state code from first 2 digits for helper badge
  const potentialStateCode = rawValue.slice(0, 2);
  const detectedState = GST_STATE_CODES[potentialStateCode];

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={inputId} className="block text-xs font-medium text-slate-700">
            {label}
            {required && <span className="ml-0.5 text-rose-500">*</span>}
          </label>
          <div className="flex items-center gap-2">
            {detectedState && (
              <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                State: {detectedState} ({potentialStateCode})
              </span>
            )}
            <span
              className={`text-[10px] font-mono ${
                rawValue.length === 15
                  ? validation.isValid
                    ? 'text-emerald-600 font-semibold'
                    : 'text-rose-500 font-semibold'
                  : 'text-slate-400'
              }`}
            >
              {rawValue.length}/15
            </span>
          </div>
        </div>
      )}

      <div className="relative">
        <input
          id={inputId}
          name={name}
          type="text"
          maxLength={15}
          disabled={disabled}
          placeholder={placeholder}
          value={rawValue}
          onChange={handleChange}
          onBlur={handleBlur}
          autoComplete="off"
          spellCheck="false"
          className={`w-full rounded-md border font-mono text-sm uppercase px-3 py-1.5 transition-colors placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-1 ${
            disabled ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white'
          } ${
            showError
              ? 'border-rose-400 text-rose-900 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/20'
              : showSuccess
              ? 'border-emerald-400 text-slate-900 focus:border-emerald-500 focus:ring-emerald-500 bg-emerald-50/10'
              : 'border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500'
          } ${inputClassName}`}
        />

        <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
          {showSuccess && (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Valid GSTIN" />
          )}
          {showError && (
            <AlertCircle className="h-4 w-4 text-rose-500" aria-label="Invalid GSTIN" />
          )}
        </div>
      </div>

      {showError && (
        <p className="flex items-start gap-1 text-[11px] text-rose-600 mt-1 leading-tight">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{validation.error}</span>
        </p>
      )}

      {showSuccess && (
        <p className="flex items-center gap-1 text-[11px] text-emerald-600 mt-1 font-medium">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span>Verified Indian GSTIN ({validation.stateName})</span>
        </p>
      )}
    </div>
  );
};

export default GSTINInput;
