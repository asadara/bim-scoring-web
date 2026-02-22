type InfoTooltipProps = {
  id: string;
  label: string;
  lines: string[];
};

export default function InfoTooltip(props: InfoTooltipProps) {
  const { id, label, lines } = props;

  return (
    <span className="info-tooltip">
      <button type="button" className="info-tooltip-trigger" aria-describedby={id} aria-label={label}>
        ?
      </button>
      <span id={id} role="tooltip" className="info-tooltip-content">
        {lines.map((line) => (
          <span key={line} className="info-tooltip-line">
            {line}
          </span>
        ))}
      </span>
    </span>
  );
}
