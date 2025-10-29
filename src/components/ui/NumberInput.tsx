import React from 'react';
import { PlusIcon, MinusIcon } from './icons';

interface NumberInputProps {
  value: number;
  onChange: (newValue: number) => void;
  step?: number;
  min?: number;
  max?: number;
  precision?: number;
}

const NumberInput: React.FC<NumberInputProps> = ({
    value,
    onChange,
    step = 0.1,
    min = 0,
    max = 99,
    precision = 1,
}) => {
    
    const formatValue = (num: number) => {
        return parseFloat(num.toFixed(precision));
    };

    const handleIncrement = () => {
        const newValue = formatValue(Math.min(max, value + step));
        onChange(newValue);
    };

    const handleDecrement = () => {
        const newValue = formatValue(Math.max(min, value - step));
        onChange(newValue);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const num = parseFloat(e.target.value);
        if (!isNaN(num)) {
            onChange(formatValue(Math.max(min, Math.min(max, num))));
        }
    };
    
    const handleInputBlur = (e: React.ChangeEvent<HTMLInputElement>) => {
        const num = parseFloat(e.target.value);
        if (isNaN(num)) {
             onChange(formatValue(value));
        }
    };

    return (
        <div className="flex items-center bg-slate-900 border border-slate-600 rounded-md overflow-hidden h-8">
            <button
                onClick={handleDecrement}
                className="px-2 h-full bg-slate-700 hover:bg-slate-600 text-slate-300"
                aria-label="减少"
            >
                <MinusIcon className="w-3 h-3" />
            </button>
            <input
                type="number"
                value={value.toFixed(precision)}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                step={step}
                min={min}
                max={max}
                className="w-12 text-center bg-transparent text-slate-100 outline-none appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
                onClick={handleIncrement}
                className="px-2 h-full bg-slate-700 hover:bg-slate-600 text-slate-300"
                aria-label="增加"
            >
                <PlusIcon className="w-3 h-3" />
            </button>
        </div>
    );
};

export default NumberInput;
