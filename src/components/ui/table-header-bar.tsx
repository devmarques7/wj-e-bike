import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Reusable responsive header for table cards.
 * Row 1: title + primary controls, Row 2: scrollable filters, Row 3: controls.
 */
export interface TableHeaderBarProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode;
  primary?: React.ReactNode;
  filters?: React.ReactNode;
  controls?: React.ReactNode;
}

export const TableHeaderScroller = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "-mx-1 px-1 overflow-x-auto scrollbar-hide overscroll-x-contain",
      "[&>*]:w-max [&>*]:max-w-none",
      className
    )}
    {...props}
  >
    {children}
  </div>
));
TableHeaderScroller.displayName = "TableHeaderScroller";

export const TableHeaderBar = React.forwardRef<HTMLDivElement, TableHeaderBarProps>(
  ({ title, primary, filters, controls, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("p-3 sm:p-4 border-b border-border/30 space-y-3", className)}
      {...props}
    >
      {(title || primary) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {title && (
            <h3 className="text-sm font-medium text-foreground truncate min-w-0">{title}</h3>
          )}
          {primary && (
            <TableHeaderScroller className="sm:flex-shrink-0">
              <div className="flex items-center gap-2">{primary}</div>
            </TableHeaderScroller>
          )}
        </div>
      )}

      {filters && <TableHeaderScroller>{filters}</TableHeaderScroller>}

      {controls && (
        <div className="flex flex-wrap items-center gap-2 [&_button]:min-w-0">{controls}</div>
      )}

      {children}
    </div>
  )
);
TableHeaderBar.displayName = "TableHeaderBar";