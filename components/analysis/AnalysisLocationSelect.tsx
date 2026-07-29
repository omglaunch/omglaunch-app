import { ANALYSIS_LOCATION_OPTIONS } from '@/lib/analysis-state';
import { cn } from '@/lib/utils';

type AnalysisLocationSelectProps = {
  value: number;
  onChange: (locationCode: number) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
};

export default function AnalysisLocationSelect({
  value,
  onChange,
  disabled = false,
  className,
  id,
}: AnalysisLocationSelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={event => onChange(Number(event.target.value))}
      disabled={disabled}
      className={cn('rounded border bg-card px-2 py-1 text-sm', className)}
    >
      {ANALYSIS_LOCATION_OPTIONS.map(option => (
        <option key={option.code} value={option.code}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
