import { afterEach, describe, expect, it } from "vitest";
import { createMetricsServer, renderMetrics } from "./metrics.js";

describe("Prometheus metrics endpoint", () => {
    let server: ReturnType<typeof createMetricsServer> | undefined;

    afterEach(async () => {
        if (!server?.listening) return;
        await new Promise<void>((resolve, reject) => {
            server?.close((error) => error ? reject(error) : resolve());
        });
        server = undefined;
    });

    it("serves bounded aggregate metrics in Prometheus text format", async () => {
        const metrics = renderMetrics(3, 2);

        expect(metrics).toContain("rexial_ws_connections_open 3");
        expect(metrics).toContain("rexial_ws_sessions_in_progress 2");
        expect(metrics).toContain("# TYPE rexial_ws_answers_submitted_total counter");
        expect(metrics).toContain('rexial_ws_question_close_latency_seconds_bucket{le="+Inf"}');
        expect(metrics).not.toContain("sessionId");
        expect(metrics.endsWith("\n")).toBe(true);
    });

    it("only serves GET /metrics", async () => {
        server = createMetricsServer(() => ({ openConnections: 0, sessionsInProgress: 0 }));
        await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Metrics listener has no TCP address");
        const baseUrl = `http://127.0.0.1:${address.port}`;

        const metricsResponse = await fetch(`${baseUrl}/metrics`);
        expect(metricsResponse.status).toBe(200);
        expect(metricsResponse.headers.get("content-type")).toContain("text/plain");
        expect(await metricsResponse.text()).toContain("rexial_ws_answers_persisted_total");

        expect((await fetch(`${baseUrl}/`)).status).toBe(404);
        expect((await fetch(`${baseUrl}/metrics`, { method: "POST" })).status).toBe(405);
    });
});
