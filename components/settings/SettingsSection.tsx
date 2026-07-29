import { cn } from '@/lib/utils';

type SettingsSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export default function SettingsSection({
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-card p-6 shadow-sm',
        className
      )}
    >
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
