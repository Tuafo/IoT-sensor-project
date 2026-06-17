"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Play, RotateCcw, StopCircle, Trash2, Zap } from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StressConfig = {
  sensors: string;
  readingsPerSensor: string;
  concurrency: string;
};

type TimedResult = {
  label: string;
  ok: boolean;
  ms: number;
  error?: string;
};

type GeneratedReading = {
  sensor_id: string;
  timestamp: string;
};

type StressSample = {
  request: number;
  latency: number;
  progress: number;
  failures: number;
};

type StressProgress = {
  status: "idle" | "running" | "done" | "cancelled" | "failed" | "cleaning";
  stage: string;
  total: number;
  completed: number;
  success: number;
  failed: number;
  startedAt: number | null;
  finishedAt: number | null;
  durations: number[];
  samples: StressSample[];
  errors: string[];
};

const initialConfig: StressConfig = {
  sensors: "3",
  readingsPerSensor: "25",
  concurrency: "6",
};

const initialProgress: StressProgress = {
  status: "idle",
  stage: "Aguardando execução.",
  total: 0,
  completed: 0,
  success: 0,
  failed: 0,
  startedAt: null,
  finishedAt: null,
  durations: [],
  samples: [],
  errors: [],
};

export function StressTestPanel({ isActive }: { isActive: boolean }) {
  const [config, setConfig] = useState(initialConfig);
  const [progress, setProgress] = useState<StressProgress>(initialProgress);
  const [generatedSensors, setGeneratedSensors] = useState<string[]>([]);
  const [generatedReadings, setGeneratedReadings] = useState<GeneratedReading[]>([]);
  const [chartWidth, setChartWidth] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);

  const summary = useMemo(() => {
    const elapsedMs =
      progress.startedAt === null
        ? 0
        : (progress.finishedAt ?? performance.now()) - progress.startedAt;
    const seconds = elapsedMs / 1000;
    const sorted = [...progress.durations].sort((a, b) => a - b);
    const avg = sorted.length ? sorted.reduce((sum, item) => sum + item, 0) / sorted.length : 0;

    return {
      elapsedMs,
      rate: seconds > 0 ? progress.completed / seconds : 0,
      avg,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      percent: progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0,
    };
  }, [progress]);

  const chartData = progress.samples.length
    ? progress.samples
    : [{ request: 0, latency: 0, progress: 0, failures: 0 }];

  useEffect(() => {
    if (!isActive || !chartRef.current) {
      setChartWidth(0);
      return;
    }

    const element = chartRef.current;
    const updateWidth = () => setChartWidth(Math.floor(element.getBoundingClientRect().width));
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    updateWidth();

    return () => observer.disconnect();
  }, [isActive]);

  async function runStressTest() {
    const sensors = clampInt(Number(config.sensors), 1, 20);
    const readingsPerSensor = clampInt(Number(config.readingsPerSensor), 1, 200);
    const concurrency = clampInt(Number(config.concurrency), 1, 20);
    const total = sensors + sensors * readingsPerSensor + 2;
    const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const sensorIds = Array.from({ length: sensors }, (_, index) => `stress-${runId}-${pad(index + 1)}`);
    const readings: GeneratedReading[] = [];
    const controller = new AbortController();
    abortRef.current = controller;

    setGeneratedSensors(sensorIds);
    setGeneratedReadings([]);
    setProgress({
      ...initialProgress,
      status: "running",
      stage: "Criando sensores de teste.",
      total,
      startedAt: performance.now(),
    });

    const record = (result: TimedResult) => {
      setProgress((current) => ({
        ...current,
        completed: current.completed + 1,
        success: current.success + (result.ok ? 1 : 0),
        failed: current.failed + (result.ok ? 0 : 1),
        durations: [...current.durations, result.ms],
        samples: [
          ...current.samples,
          {
            request: current.completed + 1,
            latency: Math.round(result.ms),
            progress: current.total > 0 ? Math.round(((current.completed + 1) / current.total) * 100) : 0,
            failures: result.ok ? 0 : 1,
          },
        ],
        errors: result.ok ? current.errors : [...current.errors.slice(-9), `${result.label}: ${result.error}`],
      }));
    };

    try {
      await runPool(
        sensorIds.map((sensorId, index) => () =>
          timed(`POST /sensors ${sensorId}`, () =>
            apiRequest(`/sensors`, {
              method: "POST",
              signal: controller.signal,
              body: JSON.stringify({
                sensor_id: sensorId,
                name: `Stress sensor ${index + 1}`,
                sensor_type: "environmental",
                status: "active",
                latitude: -21.7642 + index * 0.001,
                longitude: -43.3496 - index * 0.001,
                city: "Juiz de Fora",
                country: "Brazil",
                model: "ENV-STRESS",
                firmware: "1.0.0",
              }),
            }),
          ),
        ),
        concurrency,
        controller.signal,
        record,
      );

      if (controller.signal.aborted) {
        finishCancelled();
        return;
      }

      setProgress((current) => ({ ...current, stage: "Inserindo leituras em paralelo." }));
      const readingTasks = sensorIds.flatMap((sensorId, sensorIndex) =>
        Array.from({ length: readingsPerSensor }, (_, readingIndex) => {
          const timestamp = new Date(Date.now() + sensorIndex * 100_000 + readingIndex).toISOString();
          readings.push({ sensor_id: sensorId, timestamp });
          return () =>
            timed(`POST /readings ${sensorId} #${readingIndex + 1}`, () =>
              apiRequest("/readings", {
                method: "POST",
                signal: controller.signal,
                body: JSON.stringify({
                  sensor_id: sensorId,
                  temperature: round(22 + Math.random() * 18),
                  humidity: round(22 + Math.random() * 65),
                  pressure: round(1007 + Math.random() * 14),
                  battery: round(8 + Math.random() * 92),
                  signal_strength: Math.round(-88 + Math.random() * 45),
                  timestamp,
                }),
              }),
            );
        }),
      );

      setGeneratedReadings(readings);
      await runPool(readingTasks, concurrency, controller.signal, record);

      if (controller.signal.aborted) {
        finishCancelled();
        return;
      }

      setProgress((current) => ({ ...current, stage: "Consultando estatísticas e alertas." }));
      const finalChecks = [
        () => timed("GET /stats", () => apiRequest("/stats", { signal: controller.signal })),
        () => timed("GET /alerts", () => apiRequest("/alerts?limit=1000", { signal: controller.signal })),
      ];
      await runPool(finalChecks, 2, controller.signal, record);

      setProgress((current) => ({
        ...current,
        status: current.failed > 0 ? "failed" : "done",
        stage: current.failed > 0 ? "Concluído com falhas." : "Concluído com sucesso.",
        finishedAt: performance.now(),
      }));
    } catch (error) {
      setProgress((current) => ({
        ...current,
        status: controller.signal.aborted ? "cancelled" : "failed",
        stage: controller.signal.aborted ? "Cancelado pelo usuário." : "Falha durante o teste.",
        failed: current.failed + 1,
        errors: [...current.errors.slice(-9), error instanceof Error ? error.message : "Erro desconhecido."],
        finishedAt: performance.now(),
      }));
    } finally {
      abortRef.current = null;
    }
  }

  function cancelStressTest() {
    abortRef.current?.abort();
  }

  function finishCancelled() {
    setProgress((current) => ({
      ...current,
      status: "cancelled",
      stage: "Cancelado pelo usuário.",
      finishedAt: performance.now(),
    }));
  }

  async function cleanupGeneratedData() {
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress((current) => ({
      ...current,
      status: "cleaning",
      stage: "Removendo leituras e sensores gerados pelo stress test.",
      startedAt: performance.now(),
      finishedAt: null,
      total: generatedReadings.length + generatedSensors.length,
      completed: 0,
      success: 0,
      failed: 0,
      durations: [],
      errors: [],
    }));

    const record = (result: TimedResult) => {
      setProgress((current) => ({
        ...current,
        completed: current.completed + 1,
        success: current.success + (result.ok ? 1 : 0),
        failed: current.failed + (result.ok ? 0 : 1),
        durations: [...current.durations, result.ms],
        samples: [
          ...current.samples,
          {
            request: current.completed + 1,
            latency: Math.round(result.ms),
            progress: current.total > 0 ? Math.round(((current.completed + 1) / current.total) * 100) : 0,
            failures: result.ok ? 0 : 1,
          },
        ],
        errors: result.ok ? current.errors : [...current.errors.slice(-9), `${result.label}: ${result.error}`],
      }));
    };

    const tasks = [
      ...generatedReadings.map((reading) => () =>
        timed(`DELETE /readings ${reading.sensor_id}`, () =>
          apiRequest(`/readings/${reading.sensor_id}`, {
            method: "DELETE",
            signal: controller.signal,
            body: JSON.stringify({ timestamp: reading.timestamp }),
          }),
        ),
      ),
      ...generatedSensors.map((sensorId) => () =>
        timed(`DELETE /sensors ${sensorId}`, () =>
          apiRequest(`/sensors/${sensorId}`, { method: "DELETE", signal: controller.signal }),
        ),
      ),
    ];

    await runPool(tasks, 10, controller.signal, record);
    setGeneratedReadings([]);
    setGeneratedSensors([]);
    setProgress((current) => ({
      ...current,
      status: current.failed > 0 ? "failed" : "done",
      stage: current.failed > 0 ? "Limpeza concluída com falhas." : "Dados gerados removidos.",
      finishedAt: performance.now(),
    }));
    abortRef.current = null;
  }

  const running = progress.status === "running" || progress.status === "cleaning";
  const canCleanup = !running && (generatedReadings.length > 0 || generatedSensors.length > 0);

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-5 text-primary" />
            Stress test
          </CardTitle>
          <CardDescription>Gera carga real de escrita e consulta contra FastAPI e HBase.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Sensores" value={config.sensors} onChange={(value) => updateConfig("sensors", value)} />
            <NumberField
              label="Leituras"
              value={config.readingsPerSensor}
              onChange={(value) => updateConfig("readingsPerSensor", value)}
            />
            <NumberField
              label="Paralelo"
              value={config.concurrency}
              onChange={(value) => updateConfig("concurrency", value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button disabled={running} onClick={() => void runStressTest()}>
              <Play />
              Rodar
            </Button>
            <Button disabled={!running} variant="secondary" onClick={cancelStressTest}>
              <StopCircle />
              Parar
            </Button>
            <Button disabled={running} variant="outline" onClick={() => setConfig(initialConfig)}>
              <RotateCcw />
              Padrão
            </Button>
            <Button disabled={!canCleanup} variant="destructive" onClick={() => void cleanupGeneratedData()}>
              <Trash2 />
              Limpar
            </Button>
          </div>

          <div className="rounded-md border bg-card/70 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={progress.status} />
            </div>
            <p className="mt-2 text-foreground">{progress.stage}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric title="Progresso" value={`${summary.percent}%`} />
          <Metric title="Sucesso" value={progress.success.toString()} />
          <Metric title="Falhas" value={progress.failed.toString()} />
          <Metric title="Req/s" value={summary.rate.toFixed(1)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5 text-primary" />
              Medições
            </CardTitle>
            <CardDescription>
              {progress.completed} de {progress.total} requisições concluídas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <Info title="Tempo total" value={`${(summary.elapsedMs / 1000).toFixed(2)} s`} />
            <Info title="Latência média" value={`${summary.avg.toFixed(1)} ms`} />
            <Info title="P50" value={`${summary.p50.toFixed(1)} ms`} />
            <Info title="P95" value={`${summary.p95.toFixed(1)} ms`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gráfico do stress test</CardTitle>
            <CardDescription>Latência por requisição, progresso acumulado e falhas durante a execução.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] min-h-[300px] min-w-0 overflow-hidden">
            <div ref={chartRef} className="h-full w-full min-w-0">
              {isActive && chartWidth > 0 ? (
                <ComposedChart data={chartData} width={Math.max(chartWidth, 320)} height={300}>
                  <CartesianGrid stroke="hsl(218 28% 22%)" strokeDasharray="3 3" />
                  <XAxis dataKey="request" stroke="hsl(215 20% 68%)" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="latency" stroke="hsl(215 20% 68%)" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="percent" orientation="right" domain={[0, 100]} stroke="hsl(215 20% 68%)" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Area
                    yAxisId="percent"
                    type="monotone"
                    dataKey="progress"
                    name="Progresso %"
                    stroke="hsl(190 95% 48%)"
                    fill="hsl(190 95% 48% / 0.14)"
                  />
                  <Bar yAxisId="percent" dataKey="failures" name="Falhas" fill="hsl(0 72% 51% / 0.75)" />
                  <Line
                    yAxisId="latency"
                    type="monotone"
                    dataKey="latency"
                    name="Latência ms"
                    stroke="hsl(43 92% 58%)"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Erros recentes</CardTitle>
            <CardDescription>Útil para perceber limite de API, HBase indisponível ou conflito de dados.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[260px] overflow-auto rounded-md border bg-black/40 p-4 text-xs text-amber-100">
              {progress.errors.length ? progress.errors.join("\n") : "Nenhum erro registrado."}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  function updateConfig(key: keyof StressConfig, value: string) {
    setConfig((current) => ({ ...current, [key]: value.replace(/\D/g, "") }));
  }
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input inputMode="numeric" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border bg-card/70 p-3">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: StressProgress["status"] }) {
  if (status === "running" || status === "cleaning") return <Badge variant="warning">executando</Badge>;
  if (status === "failed") return <Badge variant="destructive">falha</Badge>;
  if (status === "done") return <Badge variant="ok">concluído</Badge>;
  if (status === "cancelled") return <Badge variant="secondary">cancelado</Badge>;
  return <Badge variant="outline">idle</Badge>;
}

const tooltipStyle = {
  background: "hsl(222 38% 9%)",
  border: "1px solid hsl(218 28% 22%)",
  color: "hsl(210 40% 96%)",
};

async function timed(label: string, action: () => Promise<unknown>): Promise<TimedResult> {
  const start = performance.now();
  try {
    await action();
    return { label, ok: true, ms: performance.now() - start };
  } catch (error) {
    return {
      label,
      ok: false,
      ms: performance.now() - start,
      error: error instanceof Error ? error.message : "Erro desconhecido.",
    };
  }
}

async function runPool(
  tasks: Array<() => Promise<TimedResult>>,
  concurrency: number,
  signal: AbortSignal,
  onResult: (result: TimedResult) => void,
) {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (index < tasks.length && !signal.aborted) {
      const task = tasks[index];
      index += 1;
      onResult(await task());
    }
  });
  await Promise.all(workers);
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
