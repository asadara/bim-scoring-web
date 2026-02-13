import Link from "next/link";

export type QuickAccessItem = {
  label: string;
  href?: string | null;
  hint?: string | null;
};

type QuickAccessNavProps = {
  title?: string;
  ariaLabel?: string;
  items: QuickAccessItem[];
};

export default function QuickAccessNav(props: QuickAccessNavProps) {
  const { title = "Quick Access", ariaLabel = "Quick access", items } = props;
  if (!items.length) return null;

  return (
    <nav className="task-subnav role-subnav" aria-label={ariaLabel}>
      <div className="role-subnav-title">{title}</div>
      <div className="role-subnav-links">
        {items.map((item) => {
          if (!item.href) {
            return (
              <span
                key={item.label}
                className="role-subnav-disabled"
                title={item.hint || "Not available"}
              >
                {item.label}
              </span>
            );
          }
          return (
            <Link key={item.label} href={item.href} title={item.hint || undefined}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

