/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{js,jsx}',
		'./components/**/*.{js,jsx}',
		'./app/**/*.{js,jsx}',
		'./src/**/*.{js,jsx}',
	],
	theme: {
    	container: {
    		center: true,
    		padding: '2rem',
    		screens: {
    			'2xl': '1400px'
    		}
    	},
    	extend: {
    		colors: {
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			kaffah: {
    				navy: '#1e3a5f',
    				blue: '#5ba3d0',
    				gray: '#6b7280',
    				light: '#e5e7eb'
    			},
    			clinara: {
    				navy: '#0f2a4a',
    				blue: '#2b6cb0',
    				sky: '#3b9fe0',
    				teal: '#2dd4bf',
    				mint: '#5eead4',
    				bg: '#f4f9fc',
    				// Clinara color & visual system (light, premium healthcare SaaS)
    				background: '#F5F9FC',
    				surface: '#FFFFFF',
    				primary: '#1677D2',
    				bright: '#2F8CFF',
    				soft: '#EAF4FF',
    				turquoise: '#35C8C1',
    				textPrimary: '#102F52',
    				textSecondary: '#5B6B7D',
    				border: '#DCE8F2',
    				success: '#3FBF80',
    				warning: '#F5A623',
    				danger: '#F16063',
    				purple: '#9B8CF2'
    			},
    			chart: {
    				'1': 'hsl(var(--chart-1))',
    				'2': 'hsl(var(--chart-2))',
    				'3': 'hsl(var(--chart-3))',
    				'4': 'hsl(var(--chart-4))',
    				'5': 'hsl(var(--chart-5))'
    			}
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
    		keyframes: {
    			'accordion-down': {
    				from: {
    					height: 0
    				},
    				to: {
    					height: 'var(--radix-accordion-content-height)'
    				}
    			},
    			'accordion-up': {
    				from: {
    					height: 'var(--radix-accordion-content-height)'
    				},
    				to: {
    					height: 0
    				}
    			},
    			shimmer: {
    				'0%': { transform: 'translateX(-150%) skewX(-12deg)' },
    				'100%': { transform: 'translateX(250%) skewX(-12deg)' }
    			},
    			'bg-zoom': {
    				'0%': { transform: 'scale(1)' },
    				'100%': { transform: 'scale(1.08)' }
    			}
    		},
    		animation: {
    			'accordion-down': 'accordion-down 0.2s ease-out',
    			'accordion-up': 'accordion-up 0.2s ease-out',
    			shimmer: 'shimmer 2.8s ease-in-out infinite',
    			'bg-zoom': 'bg-zoom 20s ease-in-out infinite alternate'
    		}
    	}
    },
	plugins: [require('tailwindcss-animate')],
};