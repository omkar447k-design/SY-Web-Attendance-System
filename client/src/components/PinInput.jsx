import React, { useRef, useState, useEffect } from 'react';

export function PinInput({ length = 4, onComplete, disabled = false, autoFocus = true }) {
  const [digits, setDigits] = useState(Array(length).fill(''));
  const inputRefs = useRef([]);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0] && !disabled) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus, disabled]);

  const handleChange = (index, value) => {
    if (disabled) return;
    const cleanVal = value.replace(/\D/g, '').slice(-1);

    const newDigits = [...digits];
    newDigits[index] = cleanVal;
    setDigits(newDigits);

    if (navigator.vibrate) {
      navigator.vibrate(15);
    }

    if (cleanVal && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullPin = newDigits.join('');
    if (fullPin.length === length && !newDigits.includes('')) {
      onComplete(fullPin);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasteData) return;

    const newDigits = Array(length).fill('');
    for (let i = 0; i < pasteData.length; i++) {
      newDigits[i] = pasteData[i];
    }
    setDigits(newDigits);

    const focusIdx = Math.min(pasteData.length, length - 1);
    inputRefs.current[focusIdx]?.focus();

    if (pasteData.length === length) {
      onComplete(pasteData);
    }
  };

  return (
    <div className="flex justify-center items-center space-x-2 xs:space-x-3 sm:space-x-4 my-4 max-w-full" onPaste={handlePaste}>
      {Array(length).fill(0).map((_, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[i]}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          className={`w-12 h-14 xs:w-14 xs:h-16 sm:w-16 sm:h-20 text-center text-2xl xs:text-3xl sm:text-4xl font-extrabold rounded-xl sm:rounded-2xl border-2 transition-all duration-150 outline-none select-none
            ${digits[i]
              ? 'border-sky-500 bg-sky-50/80 text-sky-950 shadow-md shadow-sky-100 ring-2 ring-sky-300'
              : 'border-slate-300 bg-white text-slate-900 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text hover:border-slate-400'}
          `}
        />
      ))}
    </div>
  );
}
