import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-emerald-400 text-slate-950',
        secondary: 'border-slate-600 bg-slate-800 text-slate-100',
        live: 'border-rose-300/40 bg-rose-400/20 text-rose-200',
        upcoming: 'border-sky-300/40 bg-sky-400/20 text-sky-200',
        muted: 'border-slate-600/70 bg-slate-800/50 text-slate-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
