import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import React from 'react';

const buttonVariants = cva(
	'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-white',
	{
		variants: {
			variant: {
				default: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
				destructive:
          'bg-red-600 text-white hover:bg-red-700 shadow-sm',
				outline:
          'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-sm',
				secondary:
          'bg-slate-100 text-slate-900 hover:bg-slate-200/80',
				ghost: 'hover:bg-slate-100 hover:text-slate-900',
				link: 'text-blue-600 underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-10 px-4 py-2.5',
				sm: 'h-9 rounded-md px-3',
				lg: 'h-11 rounded-md px-8',
				icon: 'h-10 w-10',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	const Comp = asChild ? Slot : 'button';
	return (
		<Comp
			className={cn(buttonVariants({ variant, size, className }))}
			ref={ref}
			{...props}
		/>
	);
});
Button.displayName = 'Button';

export { Button, buttonVariants };