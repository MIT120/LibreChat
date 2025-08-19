import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '~/utils';

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };

// Legacy TooltipAnchor for backward compatibility
import * as Ariakit from '@ariakit/react';
import { AnimatePresence, motion } from 'framer-motion';
import { forwardRef, useMemo } from 'react';

interface TooltipAnchorProps extends Ariakit.TooltipAnchorProps {
  description: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  focusable?: boolean;
  role?: string;
}

export const TooltipAnchor = forwardRef<HTMLDivElement, TooltipAnchorProps>(function TooltipAnchor(
  { description, side = 'top', className, role, ...props },
  ref,
) {
  const tooltip = Ariakit.useTooltipStore({ placement: side });
  const mounted = Ariakit.useStoreState(tooltip, (state) => state.mounted);
  const placement = Ariakit.useStoreState(tooltip, (state) => state.placement);

  const { x, y } = useMemo(() => {
    const dir = placement.split('-')[0];
    switch (dir) {
      case 'top':
        return { x: 0, y: -8 };
      case 'bottom':
        return { x: 0, y: 8 };
      case 'left':
        return { x: -8, y: 0 };
      case 'right':
        return { x: 8, y: 0 };
      default:
        return { x: 0, y: 0 };
    }
  }, [placement]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (role === 'button' && event.key === 'Enter') {
      event.preventDefault();
      (event.target as HTMLDivElement).click();
    }
  };

  return (
    <Ariakit.TooltipProvider store={tooltip} hideTimeout={0}>
      <Ariakit.TooltipAnchor
        {...props}
        ref={ref}
        role={role}
        onKeyDown={handleKeyDown}
        className={cn('cursor-pointer', className)}
      />
      <AnimatePresence>
        {mounted === true && (
          <Ariakit.Tooltip
            gutter={4}
            alwaysVisible
            className="tooltip"
            render={
              <motion.div
                initial={{ opacity: 0, x, y }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x, y }}
              />
            }
          >
            <Ariakit.TooltipArrow />
            {description}
          </Ariakit.Tooltip>
        )}
      </AnimatePresence>
    </Ariakit.TooltipProvider>
  );
});