import {
  Car,
  ForkKnife,
  Gift,
  GraduationCap,
  Hamburger,
  Heartbeat,
  HouseLine,
  Laptop,
  Motorcycle,
  PaintBrush,
  Scissors,
  Storefront,
  TShirt,
  Wrench,
  type Icon,
} from '@phosphor-icons/react';

export interface CategoryTheme {
  icon: Icon;
  accent: string;
  gradient: string;
  tint: string;
  text: string;
  ring: string;
}

const DEFAULT_THEME: CategoryTheme = {
  icon: Storefront,
  accent: '#5B5340',
  gradient: 'from-slate-500 to-slate-700 dark:from-slate-700 dark:to-slate-900',
  tint: 'bg-slate-100 dark:bg-slate-800',
  text: 'text-slate-600 dark:text-slate-300',
  ring: 'border-slate-500 dark:border-slate-400',
};

export const categoryThemes: Record<string, CategoryTheme> = {
  'Alimentação (Mercado, Padaria...)': {
    icon: Hamburger,
    accent: '#C1602E',
    gradient: 'from-orange-500 to-red-600 dark:from-orange-700 dark:to-red-900',
    tint: 'bg-orange-100 dark:bg-orange-950/40',
    text: 'text-orange-600 dark:text-orange-400',
    ring: 'border-orange-500 dark:border-orange-400',
  },
  'Bar, Restaurante e Lanchonete': {
    icon: ForkKnife,
    accent: '#A64B32',
    gradient: 'from-red-500 to-orange-700 dark:from-red-800 dark:to-orange-950',
    tint: 'bg-red-100 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-300',
    ring: 'border-red-500 dark:border-red-400',
  },
  'Vestuário e Acessórios': {
    icon: TShirt,
    accent: '#7A3B6B',
    gradient: 'from-pink-500 to-purple-600 dark:from-pink-700 dark:to-purple-900',
    tint: 'bg-pink-100 dark:bg-pink-950/40',
    text: 'text-pink-600 dark:text-pink-400',
    ring: 'border-pink-500 dark:border-pink-400',
  },
  'Beleza e Cosméticos': {
    icon: Scissors,
    accent: '#B4476B',
    gradient: 'from-pink-400 to-rose-500 dark:from-rose-700 dark:to-rose-900',
    tint: 'bg-rose-100 dark:bg-rose-950/40',
    text: 'text-rose-600 dark:text-rose-400',
    ring: 'border-rose-500 dark:border-rose-400',
  },
  'Motorista de Aplicativo': {
    icon: Car,
    accent: '#306A61',
    gradient: 'from-emerald-600 to-teal-800 dark:from-emerald-800 dark:to-teal-950',
    tint: 'bg-emerald-100 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'border-emerald-600 dark:border-emerald-400',
  },
  'Entregas e Motofrete': {
    icon: Motorcycle,
    accent: '#9A681F',
    gradient: 'from-amber-500 to-yellow-700 dark:from-amber-800 dark:to-yellow-950',
    tint: 'bg-amber-100 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'border-amber-500 dark:border-amber-400',
  },
  'Manutenção e Reparos': {
    icon: Wrench,
    accent: '#2B6E77',
    gradient: 'from-cyan-600 to-sky-800 dark:from-cyan-800 dark:to-sky-950',
    tint: 'bg-cyan-100 dark:bg-cyan-950/40',
    text: 'text-cyan-700 dark:text-cyan-300',
    ring: 'border-cyan-600 dark:border-cyan-400',
  },
  'Saúde e Bem-estar': {
    icon: Heartbeat,
    accent: '#3E7A65',
    gradient: 'from-green-600 to-emerald-800 dark:from-green-800 dark:to-emerald-950',
    tint: 'bg-green-100 dark:bg-green-950/40',
    text: 'text-green-700 dark:text-green-300',
    ring: 'border-green-600 dark:border-green-400',
  },
  'Casa e Construção': {
    icon: HouseLine,
    accent: '#9A633B',
    gradient: 'from-stone-500 to-yellow-800 dark:from-stone-700 dark:to-yellow-950',
    tint: 'bg-stone-100 dark:bg-stone-900/50',
    text: 'text-stone-700 dark:text-stone-300',
    ring: 'border-stone-500 dark:border-stone-400',
  },
  'Tecnologia e Eletrônicos': {
    icon: Laptop,
    accent: '#416A91',
    gradient: 'from-blue-600 to-indigo-800 dark:from-blue-800 dark:to-indigo-950',
    tint: 'bg-blue-100 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'border-blue-600 dark:border-blue-400',
  },
  'Educação e Aulas': {
    icon: GraduationCap,
    accent: '#5B5E9A',
    gradient: 'from-indigo-500 to-violet-700 dark:from-indigo-800 dark:to-violet-950',
    tint: 'bg-indigo-100 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    ring: 'border-indigo-500 dark:border-indigo-400',
  },
  'Artesanato e Presentes': {
    icon: Gift,
    accent: '#A05273',
    gradient: 'from-fuchsia-500 to-pink-700 dark:from-fuchsia-800 dark:to-pink-950',
    tint: 'bg-fuchsia-100 dark:bg-fuchsia-950/40',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    ring: 'border-fuchsia-500 dark:border-fuchsia-400',
  },
  Serviços: {
    icon: Wrench,
    accent: '#2B6E77',
    gradient: 'from-blue-600 to-blue-800 dark:from-blue-800 dark:to-slate-950',
    tint: 'bg-blue-100 dark:bg-blue-950/40',
    text: 'text-blue-600 dark:text-blue-400',
    ring: 'border-blue-600 dark:border-blue-400',
  },
  Outros: { ...DEFAULT_THEME, icon: PaintBrush },
};

export function getCategoryTheme(categoria: string | undefined): CategoryTheme {
  if (!categoria) return DEFAULT_THEME;
  return categoryThemes[categoria] ?? DEFAULT_THEME;
}
