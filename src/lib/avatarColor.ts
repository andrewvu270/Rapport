const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700 ring-violet-200',
  'bg-sky-100 text-sky-700 ring-sky-200',
  'bg-emerald-100 text-emerald-700 ring-emerald-200',
  'bg-rose-100 text-rose-700 ring-rose-200',
  'bg-orange-100 text-orange-700 ring-orange-200',
  'bg-indigo-100 text-indigo-700 ring-indigo-200',
  'bg-teal-100 text-teal-700 ring-teal-200',
  'bg-pink-100 text-pink-700 ring-pink-200',
];

export function avatarColor(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
