import React from 'react';
import { cn } from '~/utils';

interface SimpleBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    size?: 'default' | 'sm' | 'lg';
    className?: string;
    children?: React.ReactNode;
}

const SimpleBadge = React.forwardRef<HTMLSpanElement, SimpleBadgeProps>(
    ({ className, variant = 'default', size = 'default', ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={cn(
                    'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    {
                        'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80':
                            variant === 'default',
                        'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80':
                            variant === 'secondary',
                        'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80':
                            variant === 'destructive',
                        'text-foreground': variant === 'outline',
                    },
                    {
                        'text-xs': size === 'default',
                        'text-xs px-1.5 py-0.5': size === 'sm',
                        'text-sm px-3 py-1': size === 'lg',
                    },
                    className,
                )}
                {...props}
            />
        );
    },
);

SimpleBadge.displayName = 'SimpleBadge';

export default SimpleBadge;
