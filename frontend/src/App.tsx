import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Battery,
  CloudSun,
  Database,
  Gauge,
  Globe2,
  Pause,
  Play,
  RefreshCw,
  Thermometer,
  Wind,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001";
const JUIZ_DE_FORA = {
  name: "Juiz de Fora, Minas Gerais",
  latitude: -21.7642,
  longitude: -43.3496,
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

function App() {
  const [mockReadings, setMockReadings] = useState<MockReading[]>(() => seedMockReadings());
  const [running, setRunning] = useState(false);
  const [realData, setRealData] = useState<RealData | null>(null);
  const [realStatus, setRealStatus] = useState("Dados reais ainda não carregados.");

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setMockReadings((current) => [...current.slice(-35), createMockReading(current.at(-1))]);
    }, 1400);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    void loadRealData();
  }, []);

  const latestMock = mockReadings.at(-1);
  const mockAlerts = mockReadings.filter((reading) => reading.alert !== "ok").length;
  const realChart = useMemo(() => buildRealChart(realData), [realData]);

  async function loadRealData() {
    setRealStatus("Buscando Weather, Air Quality e Elevation APIs...");
    try {
      const lat = JUIZ_DE_FORA.latitude;
      const lon = JUIZ_DE_FORA.longitude;
      const [weather, air, elevation] = await Promise.all([
        fetchJson<WeatherResponse>(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability&forecast_days=1&timezone=America%2FSao_Paulo`,
        ),
        fetchJson<AirQualityResponse>(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,uv_index&hourly=european_aqi,pm10,pm2_5&forecast_days=1&timezone=America%2FSao_Paulo`,
        ),
        fetchJson<ElevationResponse>(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`),
      ]);
      setRealData({ weather, air, elevation });
      setRealStatus(`Atualizado para ${JUIZ_DE_FORA.name}`);
    } catch (error) {
      setRealStatus(error instanceof Error ? error.message : "Falha ao buscar dados reais.");
    }
  }

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
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">API local: {API_BASE}</Badge>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <Tabs defaultValue="mock">
          <TabsList>
            <TabsTrigger value="mock">Mock data</TabsTrigger>
            <TabsTrigger value="real">Dados reais</TabsTrigger>
          </TabsList>

          <TabsContent value="mock">
            <div className="grid gap-4 lg:grid-cols-4">
              <Metric title="Temperatura" value={`${latestMock?.temperature.toFixed(1) ?? "-"} C`} icon={<Thermometer />} />
              <Metric title="Umidade" value={`${latestMock?.humidity.toFixed(0) ?? "-"}%`} icon={<CloudSun />} />
              <Metric title="Bateria" value={`${latestMock?.battery.toFixed(0) ?? "-"}%`} icon={<Battery />} />
              <Metric title="Alertas" value={mockAlerts.toString()} icon={<AlertTriangle />} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
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
                      <Tooltip contentStyle={{ background: "hsl(222 38% 9%)", border: "1px solid hsl(218 28% 22%)" }} />
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
              <Metric
                title="Juiz de Fora"
                value={`${realData?.weather.current.temperature_2m?.toFixed(1) ?? "-"} C`}
                icon={<Thermometer />}
              />
              <Metric title="Umidade" value={`${realData?.weather.current.relative_humidity_2m ?? "-"}%`} icon={<CloudSun />} />
              <Metric title="AQI europeu" value={`${realData?.air.current.european_aqi ?? "-"}`} icon={<Wind />} />
              <Metric title="Altitude" value={`${realData?.elevation.elevation?.[0] ?? "-"} m`} icon={<Gauge />} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
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
                <CardContent className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={realChart}>
                      <CartesianGrid stroke="hsl(218 28% 22%)" strokeDasharray="3 3" />
                      <XAxis dataKey="time" stroke="hsl(215 20% 68%)" tick={{ fontSize: 12 }} />
                      <YAxis stroke="hsl(215 20% 68%)" tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: "hsl(222 38% 9%)", border: "1px solid hsl(218 28% 22%)" }} />
                      <Area type="monotone" dataKey="temperature" stroke="hsl(190 95% 48%)" fill="hsl(190 95% 48% / 0.18)" />
                      <Area type="monotone" dataKey="pm25" stroke="hsl(43 92% 58%)" fill="hsl(43 92% 58% / 0.14)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>APIs gratuitas usadas</CardTitle>
                  <CardDescription>Fontes sem chave para uso acadêmico e não comercial.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <SourceItem
                    title="Open-Meteo Forecast"
                    body="Temperatura, umidade, pressão, vento e previsão horária."
                  />
                  <SourceItem
                    title="Open-Meteo Air Quality"
                    body="AQI europeu, PM10, PM2.5, CO, NO2, O3 e índice UV."
                  />
                  <SourceItem title="Open-Meteo Elevation" body="Altitude baseada no Copernicus DEM." />
                  <SourceItem
                    title="Open-Meteo Geocoding"
                    body="Pode ser usado para buscar coordenadas por nome da cidade."
                  />
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
        </Tabs>
      </section>
    </main>
  );
}

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

function SourceItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border bg-background/40 p-3">
      <div className="flex items-center gap-2 font-medium">
        <Globe2 className="size-4 text-primary" />
        {title}
      </div>
      <p className="mt-1 text-muted-foreground">{body}</p>
    </div>
  );
}

function AlertBadge({ level }: { level: MockReading["alert"] }) {
  if (level === "critical") return <Badge variant="destructive">critical</Badge>;
  if (level === "warning") return <Badge variant="warning">warning</Badge>;
  return <Badge variant="ok">ok</Badge>;
}

function random(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default App;
