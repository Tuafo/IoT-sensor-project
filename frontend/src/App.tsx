import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Battery,
  CloudSun,
  Database,
  Gauge,
  Globe2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Thermometer,
  Trash2,
  Wind,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001";
const DEFAULT_LOCATION: LocationResult = {
  id: 3459505,
  name: "Juiz de Fora",
  latitude: -21.7642,
  longitude: -43.3496,
  elevation: 678,
  country: "Brazil",
  admin1: "Minas Gerais",
  timezone: "America/Sao_Paulo",
};

type Sensor = {
  sensor_id: string;
  name: string;
  sensor_type: string;
  status: string;
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  model: string;
  firmware: string;
};

type ApiReading = {
  row_key: string;
  sensor_id: string;
  timestamp: string;
  temperature: number;
  humidity: number;
  pressure: number;
  battery: number;
  signal_strength: number;
  alert_level: "ok" | "warning" | "critical";
  alert_message: string;
};

type ApiStats = {
  sensor_id: string | null;
  total_readings: number;
  average_temperature: number | null;
  min_temperature: number | null;
  max_temperature: number | null;
  latest_readings: ApiReading[];
};

type MockReading = {
  time: string;
  temperature: number;
  humidity: number;
  pressure: number;
  battery: number;
  signal: number;
  alert: "ok" | "warning" | "critical";
};

type LocationResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  country?: string;
  admin1?: string;
  timezone?: string;
};

type GeocodingResponse = {
  results?: LocationResult[];
};

type WeatherResponse = {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    surface_pressure: number;
    wind_speed_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    precipitation_probability: number[];
  };
};

type AirQualityResponse = {
  current: {
    time: string;
    european_aqi: number;
    pm10: number;
    pm2_5: number;
    carbon_monoxide: number;
    nitrogen_dioxide: number;
    ozone: number;
    uv_index: number;
  };
  hourly: {
    time: string[];
    european_aqi: number[];
    pm10: number[];
    pm2_5: number[];
  };
};

type ElevationResponse = {
  elevation: number[];
};

type RealData = {
  weather: WeatherResponse;
  air: AirQualityResponse;
  elevation: ElevationResponse;
};

const initialSensor = {
  sensor_id: "sensor-ui-01",
  name: "Sensor UI Demo",
  city: "Juiz de Fora",
  latitude: "-21.7642",
  longitude: "-43.3496",
  status: "active",
  firmware: "1.0.0",
};

const initialReading = {
  sensor_id: "sensor-ui-01",
  temperature: "26.4",
  humidity: "57",
  pressure: "1012.5",
  battery: "84",
  signal_strength: "-58",
  timestamp: "",
};

function App() {
  const [mockReadings, setMockReadings] = useState<MockReading[]>(() => seedMockReadings());
  const [running, setRunning] = useState(false);

  const [locationQuery, setLocationQuery] = useState("Juiz de Fora");
  const [locations, setLocations] = useState<LocationResult[]>([DEFAULT_LOCATION]);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult>(DEFAULT_LOCATION);
  const [realData, setRealData] = useState<RealData | null>(null);
  const [realStatus, setRealStatus] = useState("Dados reais ainda não carregados.");

  const [sensorForm, setSensorForm] = useState(initialSensor);
  const [readingForm, setReadingForm] = useState(initialReading);
  const [apiSensorId, setApiSensorId] = useState("sensor-ui-01");
  const [deleteTimestamp, setDeleteTimestamp] = useState("");
  const [apiOutput, setApiOutput] = useState("Use os botões para executar operações da API.");

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setMockReadings((current) => [...current.slice(-35), createMockReading(current.at(-1))]);
    }, 1400);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    void loadRealData(DEFAULT_LOCATION);
  }, []);

  const latestMock = mockReadings.at(-1);
  const mockAlerts = mockReadings.filter((reading) => reading.alert !== "ok").length;
  const realChart = useMemo(() => buildRealChart(realData), [realData]);

  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText);
    }
    return response.json() as Promise<T>;
  }

  async function runApiOperation<T>(label: string, action: () => Promise<T>) {
    setApiOutput(`${label}: executando...`);
    try {
      const result = await action();
      setApiOutput(JSON.stringify(result, null, 2));
    } catch (error) {
      setApiOutput(error instanceof Error ? error.message : `Falha em ${label}.`);
    }
  }

  async function searchLocations() {
    setRealStatus("Buscando cidades disponíveis...");
    try {
      const data = await fetchJson<GeocodingResponse>(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationQuery)}&count=10&language=pt&format=json`,
      );
      const results = data.results ?? [];
      setLocations(results);
      setRealStatus(results.length ? `${results.length} locais encontrados.` : "Nenhum local encontrado.");
    } catch (error) {
      setRealStatus(error instanceof Error ? error.message : "Falha ao buscar locais.");
    }
  }

  async function loadRealData(location = selectedLocation) {
    setSelectedLocation(location);
    setRealStatus(`Buscando dados reais para ${formatLocation(location)}...`);
    try {
      const lat = location.latitude;
      const lon = location.longitude;
      const timezone = encodeURIComponent(location.timezone ?? "auto");
      const [weather, air, elevation] = await Promise.all([
        fetchJson<WeatherResponse>(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability&forecast_days=1&timezone=${timezone}`,
        ),
        fetchJson<AirQualityResponse>(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,uv_index&hourly=european_aqi,pm10,pm2_5&forecast_days=1&timezone=${timezone}`,
        ),
        fetchJson<ElevationResponse>(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`),
      ]);
      setRealData({ weather, air, elevation });
      setRealStatus(`Atualizado para ${formatLocation(location)}`);
    } catch (error) {
      setRealStatus(error instanceof Error ? error.message : "Falha ao buscar dados reais.");
    }
  }

  const sensorPayload = {
    sensor_id: sensorForm.sensor_id,
    name: sensorForm.name,
    sensor_type: "environmental",
    status: sensorForm.status,
    latitude: Number(sensorForm.latitude),
    longitude: Number(sensorForm.longitude),
    city: sensorForm.city,
    country: "Brazil",
    model: "ENV-100",
    firmware: sensorForm.firmware,
  };

  const readingPayload = {
    sensor_id: readingForm.sensor_id,
    temperature: Number(readingForm.temperature),
    humidity: Number(readingForm.humidity),
    pressure: Number(readingForm.pressure),
    battery: Number(readingForm.battery),
    signal_strength: Number(readingForm.signal_strength),
    timestamp: readingForm.timestamp || undefined,
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(190_95%_13%),transparent_34%),var(--color-background)]">
      <section className="border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Database className="size-4" />
              Apache HBase + React + shadcn/ui
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">Monitoramento Ambiental IoT</h1>
          </div>
          <Badge variant="outline">API local: {API_BASE}</Badge>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <Tabs defaultValue="mock">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="mock">Mock data</TabsTrigger>
            <TabsTrigger value="real">Dados reais</TabsTrigger>
            <TabsTrigger value="entry">Entrada/API</TabsTrigger>
            <TabsTrigger value="charts">Gráficos</TabsTrigger>
          </TabsList>

          <TabsContent value="mock">
            <div className="grid gap-4 lg:grid-cols-4">
              <Metric title="Temperatura" value={`${latestMock?.temperature.toFixed(1) ?? "-"} C`} icon={<Thermometer />} />
              <Metric title="Umidade" value={`${latestMock?.humidity.toFixed(0) ?? "-"}%`} icon={<CloudSun />} />
              <Metric title="Bateria" value={`${latestMock?.battery.toFixed(0) ?? "-"}%`} icon={<Battery />} />
              <Metric title="Alertas" value={mockAlerts.toString()} icon={<AlertTriangle />} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>Simulação contínua</CardTitle>
                    <CardDescription>Dados ambientais mockados, atualizados no navegador.</CardDescription>
                  </div>
                  <Button onClick={() => setRunning((value) => !value)} variant={running ? "secondary" : "default"}>
                    {running ? <Pause /> : <Play />}
                    {running ? "Pausar" : "Rodar contínuo"}
                  </Button>
                </CardHeader>
                <CardContent className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mockReadings}>
                      <CartesianGrid stroke="hsl(218 28% 22%)" strokeDasharray="3 3" />
                      <XAxis dataKey="time" stroke="hsl(215 20% 68%)" tick={{ fontSize: 12 }} />
                      <YAxis stroke="hsl(215 20% 68%)" tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="temperature" stroke="hsl(190 95% 48%)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="humidity" stroke="hsl(166 76% 58%)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="battery" stroke="hsl(43 92% 58%)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Leituras mock recentes</CardTitle>
                  <CardDescription>Últimos eventos simulados para apresentação.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {mockReadings.slice(-8).reverse().map((reading) => (
                    <div key={`${reading.time}-${reading.signal}`} className="rounded-md border bg-card/70 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{reading.time}</span>
                        <AlertBadge level={reading.alert} />
                      </div>
                      <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <span>{reading.temperature.toFixed(1)} C</span>
                        <span>{reading.humidity.toFixed(0)}%</span>
                        <span>{reading.battery.toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="real">
            <div className="grid gap-4 lg:grid-cols-4">
              <Metric title={selectedLocation.name} value={`${realData?.weather.current.temperature_2m?.toFixed(1) ?? "-"} C`} icon={<Thermometer />} />
              <Metric title="Umidade" value={`${realData?.weather.current.relative_humidity_2m ?? "-"}%`} icon={<CloudSun />} />
              <Metric title="AQI europeu" value={`${realData?.air.current.european_aqi ?? "-"}`} icon={<Wind />} />
              <Metric title="Altitude" value={`${realData?.elevation.elevation?.[0] ?? "-"} m`} icon={<Gauge />} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Buscar local</CardTitle>
                  <CardDescription>Use Open-Meteo Geocoding para acessar os locais disponíveis.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} />
                    <Button size="icon" onClick={() => void searchLocations()}>
                      <Search />
                    </Button>
                  </div>
                  <div className="max-h-[310px] space-y-2 overflow-auto pr-1">
                    {locations.map((location) => (
                      <button
                        key={`${location.id}-${location.latitude}-${location.longitude}`}
                        className="w-full rounded-md border bg-background/40 p-3 text-left transition-colors hover:bg-muted"
                        onClick={() => void loadRealData(location)}
                      >
                        <div className="text-sm font-medium">{formatLocation(location)}</div>
                        <div className="text-xs text-muted-foreground">
                          {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>Dados reais agregados</CardTitle>
                    <CardDescription>{realStatus}</CardDescription>
                  </div>
                  <Button onClick={() => void loadRealData()} variant="outline">
                    <RefreshCw />
                    Atualizar
                  </Button>
                </CardHeader>
                <CardContent className="h-[390px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={realChart}>
                      <CartesianGrid stroke="hsl(218 28% 22%)" strokeDasharray="3 3" />
                      <XAxis dataKey="time" stroke="hsl(215 20% 68%)" tick={{ fontSize: 12 }} />
                      <YAxis stroke="hsl(215 20% 68%)" tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="rain" fill="hsl(217 91% 60% / 0.35)" />
                      <Area type="monotone" dataKey="pm25" stroke="hsl(43 92% 58%)" fill="hsl(43 92% 58% / 0.14)" />
                      <Line type="monotone" dataKey="temperature" stroke="hsl(190 95% 48%)" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <InfoCard title="Pressão" value={`${realData?.weather.current.surface_pressure ?? "-"} hPa`} />
              <InfoCard title="Vento" value={`${realData?.weather.current.wind_speed_10m ?? "-"} km/h`} />
              <InfoCard title="PM2.5" value={`${realData?.air.current.pm2_5 ?? "-"} ug/m3`} />
              <InfoCard title="PM10" value={`${realData?.air.current.pm10 ?? "-"} ug/m3`} />
              <InfoCard title="Ozônio" value={`${realData?.air.current.ozone ?? "-"} ug/m3`} />
              <InfoCard title="UV" value={`${realData?.air.current.uv_index ?? "-"}`} />
            </div>
          </TabsContent>

          <TabsContent value="entry">
            <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Entrada de sensor</CardTitle>
                    <CardDescription>CRUD completo da tabela `sensors`.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Field label="Sensor ID" value={sensorForm.sensor_id} onChange={(value) => updateSensorForm("sensor_id", value)} />
                    <Field label="Nome" value={sensorForm.name} onChange={(value) => updateSensorForm("name", value)} />
                    <Field label="Cidade" value={sensorForm.city} onChange={(value) => updateSensorForm("city", value)} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Latitude" value={sensorForm.latitude} onChange={(value) => updateSensorForm("latitude", value)} />
                      <Field label="Longitude" value={sensorForm.longitude} onChange={(value) => updateSensorForm("longitude", value)} />
                      <Field label="Status" value={sensorForm.status} onChange={(value) => updateSensorForm("status", value)} />
                      <Field label="Firmware" value={sensorForm.firmware} onChange={(value) => updateSensorForm("firmware", value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button onClick={() => void runApiOperation("POST /sensors", () => request<Sensor>("/sensors", { method: "POST", body: JSON.stringify(sensorPayload) }))}>
                        <Plus />
                        Criar
                      </Button>
                      <Button variant="outline" onClick={() => void runApiOperation("PATCH /sensors/{id}", () => request<Sensor>(`/sensors/${sensorForm.sensor_id}`, { method: "PATCH", body: JSON.stringify({ status: sensorForm.status, firmware: sensorForm.firmware }) }))}>
                        <Save />
                        Atualizar
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button variant="outline" onClick={() => void runApiOperation("GET /sensors", () => request<Sensor[]>("/sensors"))}>Listar sensores</Button>
                      <Button variant="outline" onClick={() => void runApiOperation("GET /sensors/{id}", () => request<Sensor>(`/sensors/${sensorForm.sensor_id}`))}>Buscar</Button>
                      <Button variant="destructive" onClick={() => void runApiOperation("DELETE /sensors/{id}", () => request(`/sensors/${sensorForm.sensor_id}`, { method: "DELETE" }))}>
                        <Trash2 />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Entrada de leitura</CardTitle>
                    <CardDescription>Operações da tabela `sensor_readings`.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Field label="Sensor ID" value={readingForm.sensor_id} onChange={(value) => updateReadingForm("sensor_id", value)} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Temperatura" value={readingForm.temperature} onChange={(value) => updateReadingForm("temperature", value)} />
                      <Field label="Umidade" value={readingForm.humidity} onChange={(value) => updateReadingForm("humidity", value)} />
                      <Field label="Pressão" value={readingForm.pressure} onChange={(value) => updateReadingForm("pressure", value)} />
                      <Field label="Bateria" value={readingForm.battery} onChange={(value) => updateReadingForm("battery", value)} />
                    </div>
                    <Field label="Sinal" value={readingForm.signal_strength} onChange={(value) => updateReadingForm("signal_strength", value)} />
                    <Field label="Timestamp opcional" value={readingForm.timestamp} onChange={(value) => updateReadingForm("timestamp", value)} />
                    <Button className="w-full" onClick={() => void runApiOperation("POST /readings", () => request<ApiReading>("/readings", { method: "POST", body: JSON.stringify(readingPayload) }))}>
                      <Send />
                      Inserir leitura
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Operações disponíveis na API</CardTitle>
                    <CardDescription>Todos os endpoints principais podem ser executados pela interface.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Sensor para consultas" value={apiSensorId} onChange={setApiSensorId} />
                      <Field label="Timestamp para deletar leitura" value={deleteTimestamp} onChange={setDeleteTimestamp} />
                    </div>
                    <div className="grid gap-2 md:grid-cols-3">
                      <Button variant="outline" onClick={() => void runApiOperation("GET /readings/{sensor_id}", () => request<ApiReading[]>(`/readings/${apiSensorId}`))}>Listar leituras</Button>
                      <Button variant="outline" onClick={() => void runApiOperation("GET /readings/{sensor_id}/latest", () => request<ApiReading>(`/readings/${apiSensorId}/latest`))}>Última leitura</Button>
                      <Button variant="outline" onClick={() => void runApiOperation("GET /alerts", () => request<ApiReading[]>("/alerts"))}>Alertas</Button>
                      <Button variant="outline" onClick={() => void runApiOperation("GET /stats", () => request<ApiStats>("/stats"))}>Stats gerais</Button>
                      <Button variant="outline" onClick={() => void runApiOperation("GET /stats?sensor_id=", () => request<ApiStats>(`/stats?sensor_id=${apiSensorId}`))}>Stats sensor</Button>
                      <Button variant="destructive" onClick={() => void runApiOperation("DELETE /readings/{sensor_id}", () => request(`/readings/${apiSensorId}`, { method: "DELETE", body: JSON.stringify({ timestamp: deleteTimestamp }) }))}>Deletar leitura</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Resposta da API</CardTitle>
                    <CardDescription>Resultado bruto para apresentar as operações CRUD.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="max-h-[560px] overflow-auto rounded-md border bg-black/40 p-4 text-xs text-emerald-100">
                      {apiOutput}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="charts">
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartNote title="Linha temporal" body="Melhor para tendências contínuas de temperatura, umidade, pressão e bateria ao longo do tempo." />
              <ChartNote title="Composto" body="Combina barras, áreas e linhas para comparar variáveis com unidades diferentes, como chuva, PM2.5 e temperatura." />
              <ChartNote title="Dispersão" body="Ajuda a observar correlação, por exemplo temperatura contra umidade, e destacar pontos anômalos." />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Área: pressão e bateria</CardTitle>
                  <CardDescription>Útil para comparar estabilidade operacional do sensor.</CardDescription>
                </CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mockReadings}>
                      <CartesianGrid stroke="hsl(218 28% 22%)" strokeDasharray="3 3" />
                      <XAxis dataKey="time" stroke="hsl(215 20% 68%)" tick={{ fontSize: 12 }} />
                      <YAxis stroke="hsl(215 20% 68%)" tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="battery" stroke="hsl(43 92% 58%)" fill="hsl(43 92% 58% / 0.16)" />
                      <Area type="monotone" dataKey="pressure" stroke="hsl(190 95% 48%)" fill="hsl(190 95% 48% / 0.10)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Dispersão: temperatura x umidade</CardTitle>
                  <CardDescription>Ajuda a visualizar relação entre variáveis ambientais.</CardDescription>
                </CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid stroke="hsl(218 28% 22%)" strokeDasharray="3 3" />
                      <XAxis dataKey="temperature" name="Temperatura" stroke="hsl(215 20% 68%)" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="humidity" name="Umidade" stroke="hsl(215 20% 68%)" tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Scatter data={mockReadings} fill="hsl(166 76% 58%)" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );

  function updateSensorForm(key: keyof typeof initialSensor, value: string) {
    setSensorForm((current) => ({ ...current, [key]: value }));
    if (key === "sensor_id") {
      setApiSensorId(value);
      setReadingForm((current) => ({ ...current, sensor_id: value }));
    }
  }

  function updateReadingForm(key: keyof typeof initialReading, value: string) {
    setReadingForm((current) => ({ ...current, [key]: value }));
    if (key === "sensor_id") {
      setApiSensorId(value);
    }
    if (key === "timestamp") {
      setDeleteTimestamp(value);
    }
  }
}

const tooltipStyle = {
  background: "hsl(222 38% 9%)",
  border: "1px solid hsl(218 28% 22%)",
  color: "hsl(210 40% 96%)",
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao buscar ${url}`);
  return response.json() as Promise<T>;
}

function seedMockReadings() {
  return Array.from({ length: 24 }, (_, index) => createMockReading(undefined, index));
}

function createMockReading(previous?: MockReading, index?: number): MockReading {
  const baseTemp = previous?.temperature ?? 25.5;
  const baseHumidity = previous?.humidity ?? 58;
  const battery = Math.max(8, (previous?.battery ?? 96) - Math.random() * 1.6);
  const temperature = clamp(baseTemp + random(-1.1, 1.4), 18, 39);
  const humidity = clamp(baseHumidity + random(-4, 3), 20, 88);
  const alert = temperature >= 35 || humidity <= 30 || battery < 20 ? (battery < 12 ? "critical" : "warning") : "ok";
  const date = new Date(Date.now() - ((24 - (index ?? 23)) * 90_000));
  return {
    time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    temperature,
    humidity,
    pressure: 1010 + random(-5, 5),
    battery,
    signal: Math.round(random(-88, -42)),
    alert,
  };
}

function buildRealChart(realData: RealData | null) {
  if (!realData) return [];
  return realData.weather.hourly.time.slice(0, 18).map((time, index) => ({
    time: new Date(time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    temperature: realData.weather.hourly.temperature_2m[index],
    humidity: realData.weather.hourly.relative_humidity_2m[index],
    rain: realData.weather.hourly.precipitation_probability[index],
    pm25: realData.air.hourly.pm2_5[index],
    pm10: realData.air.hourly.pm10[index],
    aqi: realData.air.hourly.european_aqi[index],
  }));
}

function Metric({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className="rounded-md bg-secondary p-2 text-secondary-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ChartNote({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 font-medium">
          <BarChart3 className="size-4 text-primary" />
          {title}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function AlertBadge({ level }: { level: MockReading["alert"] }) {
  if (level === "critical") return <Badge variant="destructive">critical</Badge>;
  if (level === "warning") return <Badge variant="warning">warning</Badge>;
  return <Badge variant="ok">ok</Badge>;
}

function formatLocation(location: LocationResult) {
  return [location.name, location.admin1, location.country].filter(Boolean).join(", ");
}

function random(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default App;
