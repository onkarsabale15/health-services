/** Gradient initials avatar used across the redesigned CDS screens. */
export default function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials =
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';
  return (
    <div
      className="rounded-full bg-gradient-to-br from-primary to-primary-dim flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <span className="text-white font-bold" style={{ fontSize: size * 0.34 }}>
        {initials}
      </span>
    </div>
  );
}
