import type { ElementType, ReactNode } from 'react';

interface CardProps {
  /** Optional heading rendered above the content. */
  heading?: ReactNode;
  /** Heading level — pick the one that keeps the page hierarchy unbroken. */
  headingLevel?: 'h2' | 'h3' | 'h4';
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** `section` by default; pass `article` or `div` where that reads better. */
  as?: ElementType;
}

export function Card({
  heading,
  headingLevel = 'h2',
  description,
  actions,
  children,
  className,
  as: Element = 'section',
}: CardProps) {
  const Heading = headingLevel;
  return (
    <Element
      className={['rounded-lg border border-line bg-surface p-5 sm:p-6', className]
        .filter(Boolean)
        .join(' ')}
    >
      {(heading || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {heading && <Heading className="text-lg font-semibold text-ink">{heading}</Heading>}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </Element>
  );
}
