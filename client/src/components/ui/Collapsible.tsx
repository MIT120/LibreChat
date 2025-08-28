/**
 * Collapsible Component
 */

import React, { createContext, useContext, useState } from 'react';
import { cn } from '~/utils';

interface CollapsibleContextValue {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const CollapsibleContext = createContext<CollapsibleContextValue | undefined>(undefined);

const useCollapsible = () => {
    const context = useContext(CollapsibleContext);
    if (!context) {
        throw new Error('useCollapsible must be used within a Collapsible');
    }
    return context;
};

export interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultOpen?: boolean;
}

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
    ({ className, open: controlledOpen, onOpenChange, defaultOpen = false, children, ...props }, ref) => {
        const [internalOpen, setInternalOpen] = useState(defaultOpen);

        const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
        const handleOpenChange = onOpenChange || setInternalOpen;

        return (
            <CollapsibleContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
                <div
                    ref={ref}
                    className={cn('', className)}
                    {...props}
                >
                    {children}
                </div>
            </CollapsibleContext.Provider>
        );
    }
);

Collapsible.displayName = 'Collapsible';

export interface CollapsibleTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
}

const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
    ({ className, asChild = false, children, onClick, ...props }, ref) => {
        const { open, onOpenChange } = useCollapsible();

        const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
            onClick?.(e);
            if (!e.defaultPrevented) {
                onOpenChange(!open);
            }
        };

        if (asChild && React.isValidElement(children)) {
            return React.cloneElement(children, {
                ...children.props,
                onClick: handleClick,
                'aria-expanded': open,
                'data-state': open ? 'open' : 'closed',
            });
        }

        return (
            <button
                ref={ref}
                className={cn('', className)}
                onClick={handleClick}
                aria-expanded={open}
                data-state={open ? 'open' : 'closed'}
                {...props}
            >
                {children}
            </button>
        );
    }
);

CollapsibleTrigger.displayName = 'CollapsibleTrigger';

export interface CollapsibleContentProps extends React.HTMLAttributes<HTMLDivElement> { }

const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
    ({ className, children, ...props }, ref) => {
        const { open } = useCollapsible();

        if (!open) {
            return null;
        }

        return (
            <div
                ref={ref}
                className={cn('overflow-hidden', className)}
                data-state={open ? 'open' : 'closed'}
                {...props}
            >
                {children}
            </div>
        );
    }
);

CollapsibleContent.displayName = 'CollapsibleContent';

export { Collapsible, CollapsibleTrigger, CollapsibleContent };