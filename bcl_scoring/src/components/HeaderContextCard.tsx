import { ReactNode } from "react";

type HeaderContextItem = {
  label: string;
  value: ReactNode;
};

type HeaderContextCardProps = {
  title?: string;
  items: HeaderContextItem[];
  className?: string;
};

export default function HeaderContextCard(props: HeaderContextCardProps) {
  const { title = "Reporting Context", items, className = "" } = props;
  const classes = ["dashboard-report-context", "page-header-context", className]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={classes}>
      <h2>{title}</h2>
      <dl>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
