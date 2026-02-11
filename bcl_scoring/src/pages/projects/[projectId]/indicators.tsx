import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/http";

type IndicatorDef = {
    indicator_id: string;
    code: string;
    name: string;
    perspective: string;
    max_score: number;
    evidence_policy: string;
    relevance_source: string;
    status: string;
};

export default function ProjectIndicatorsPage() {
    const router = useRouter();
    const { projectId } = router.query;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<IndicatorDef[]>([]);

    useEffect(() => {
        if (!router.isReady) return;

        let apiBase = "";
        try {
            apiBase = getApiBaseUrl();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "API environment configuration invalid.");
            setLoading(false);
            return;
        }

        if (typeof projectId !== "string") return;

        (async () => {
            try {
                setLoading(true);
                setError(null);

                // endpoint indicator definitions (project-scoped or global as per backend)
                const candidates = [
                    `${apiBase}/projects/${encodeURIComponent(projectId)}/indicator_definitions`,
                    `${apiBase}/projects/${encodeURIComponent(projectId)}/indicator-definitions`,
                    `${apiBase}/indicator_definitions?project_id=${encodeURIComponent(projectId)}`,
                    `${apiBase}/indicator-definitions?project_id=${encodeURIComponent(projectId)}`,
                ];

                let lastErr = "";

                let payload: unknown = null;
                for (const url of candidates) {
                    const r = await fetch(url);
                    if (r.ok) {
                        payload = await r.json();
                        break;
                    } else {
                        const t = await r.text().catch(() => "");
                        lastErr = `Tried ${url} -> HTTP ${r.status} ${r.statusText}${t ? ` - ${t}` : ""}`;
                    }
                }

                if (!payload) throw new Error(lastErr);

                const payloadObj =
                    payload && typeof payload === "object"
                        ? (payload as { ok?: boolean; error?: string; data?: unknown })
                        : null;

                if (payloadObj?.ok === false) throw new Error(payloadObj.error || "API returned ok=false");

                const data = payloadObj?.data ?? payload;
                setRows(Array.isArray(data) ? (data as IndicatorDef[]) : []);
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Unknown error");
                setRows([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [router.isReady, projectId]);

    return (
        <main style={{ padding: 24 }}>
            <h1>Indicators</h1>

            {loading && <p>Loading...</p>}
            {error && <p style={{ color: "crimson" }}>{error}</p>}

            {!loading && !error && (
                <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                        <tr>
                            <th align="left">Code</th>
                            <th align="left">Name</th>
                            <th align="left">Perspective</th>
                            <th align="right">Max</th>
                            <th align="left">Evidence Policy</th>
                            <th align="left">Relevance</th>
                            <th align="left">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.indicator_id} style={{ borderTop: "1px solid #ddd" }}>
                                <td>{r.code}</td>
                                <td>{r.name}</td>
                                <td>{r.perspective}</td>
                                <td align="right">{r.max_score}</td>
                                <td>{r.evidence_policy}</td>
                                <td>{r.relevance_source}</td>
                                <td>{r.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </main>
    );
}
