import { useEffect, useRef } from "react";
import { Chart, type ChartConfiguration } from "chart.js/auto";

type PerspectiveChartRow = {
  perspectiveId: string;
  title: string;
  score: number;
  riskLabel: "High risk" | "Watch" | "Healthy";
};

type DashboardPerspectiveChartProps = {
  rows: PerspectiveChartRow[];
  activePerspectiveId: string | null;
  onSelectPerspective: (perspectiveId: string) => void;
};

function barColorByRisk(riskLabel: PerspectiveChartRow["riskLabel"]): string {
  if (riskLabel === "High risk") return "#b85a4f";
  if (riskLabel === "Watch") return "#b58c3e";
  return "#2e7f67";
}

export default function DashboardPerspectiveChart(props: DashboardPerspectiveChartProps) {
  const { rows, activePerspectiveId, onSelectPerspective } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"bar"> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const labels = rows.map((item) => item.perspectiveId);
    const chartConfig: ChartConfiguration<"bar"> = {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Perspective score",
            data: rows.map((item) => item.score),
            backgroundColor: rows.map((item) => barColorByRisk(item.riskLabel)),
            borderColor: rows.map((item) =>
              item.perspectiveId === activePerspectiveId ? "#18364d" : "#ced8e1"
            ),
            borderWidth: rows.map((item) => (item.perspectiveId === activePerspectiveId ? 3 : 1)),
            borderRadius: 8,
            maxBarThickness: 52,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        onClick: (_event, activeElements) => {
          if (!activeElements || activeElements.length === 0) return;
          const item = rows[activeElements[0].index];
          if (!item) return;
          onSelectPerspective(item.perspectiveId);
        },
        scales: {
          x: {
            ticks: {
              color: "#4f647a",
              font: {
                size: 12,
                weight: 700,
              },
            },
            grid: {
              display: false,
            },
          },
          y: {
            beginAtZero: true,
            max: 5,
            ticks: {
              stepSize: 1,
              color: "#4f647a",
            },
            grid: {
              color: "#e2e9f0",
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              title: (tooltipItems) => {
                const hit = rows[tooltipItems[0]?.dataIndex ?? -1];
                return hit ? `${hit.perspectiveId} - ${hit.title}` : "Perspective";
              },
              label: (context) => `Score ${Number(context.parsed.y).toFixed(2)} / 5.00`,
            },
          },
        },
      },
    };

    chartRef.current = new Chart(canvas, chartConfig);
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [activePerspectiveId, onSelectPerspective, rows]);

  return (
    <div className="desktop-chart-canvas-wrap">
      <div className="desktop-chart-canvas">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
