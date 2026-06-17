import {
  ArrowRight,
  BookOpen,
  Braces,
  Database,
  Gauge,
  HardDrive,
  Layers3,
  Network,
  Rows3,
  Server,
  Table2,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const useCases = ["IoT", "telemetria", "logs", "séries temporais", "tabelas esparsas", "grande volume"];

const hbaseProperties = [
  ["Tipo", "wide-column"],
  ["Modelo", "row key + famílias de colunas"],
  ["CAP", "CP"],
  ["Acesso forte", "get e scan por chave"],
];

const architecture = [
  ["Next.js UI", "interface, CRUD, dados reais e stress test"],
  ["FastAPI", "endpoints e regras de alerta"],
  ["happybase", "cliente Python para HBase"],
  ["Thrift", "ponte de comunicação"],
  ["Apache HBase", "persistência NoSQL wide-column"],
];

const hbaseTables = [
  {
    title: "sensors",
    description: "cadastro dos sensores ambientais",
    rowKey: "sensor_id",
    families: [
      ["info", "name, sensor_type, status"],
      ["location", "latitude, longitude, city, country"],
      ["device", "model, firmware"],
    ],
  },
  {
    title: "sensor_readings",
    description: "leituras de temperatura, umidade, pressão, bateria, sinal e alerta",
    rowKey: "sensor_id#timestamp",
    families: [
      ["metrics", "temperature, humidity, pressure"],
      ["device", "battery, signal_strength"],
      ["alert", "level, message"],
      ["time", "timestamp"],
    ],
  },
];

const operations = [
  ["find", "get e scan para buscar sensores, leituras e última leitura por chave"],
  ["aggregate", "endpoint /stats calculando total, média, mínimo e máximo"],
  ["$match", "filtros por sensor_id, prefixo de row key e alert_level"],
  ["$project", "API retorna campos tratados em vez de expor bytes do HBase"],
  ["$lookup", "sensor é validado em sensors antes de inserir em sensor_readings"],
  ["$unwind", "leituras são retornadas como registros individuais"],
  ["$group", "estatísticas gerais ou separadas por sensor"],
  ["arrays/subdocumentos", "listas JSON e famílias de colunas representam estruturas compostas"],
];

export function WorkOverview() {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Database className="size-6 text-primary" />
                Apache HBase no monitoramento ambiental IoT
              </CardTitle>
              <CardDescription className="mt-2 max-w-4xl text-sm leading-6">
                Esta aba concentra a explicação do trabalho: conceito do banco escolhido, classificação,
                usos comuns, arquitetura da aplicação e como os dados foram modelados no HBase.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>HBase</Badge>
              <Badge variant="secondary">NoSQL</Badge>
              <Badge variant="outline">wide-column</Badge>
              <Badge variant="warning">CAP: CP</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-4">
          {hbaseProperties.map(([label, value]) => (
            <div key={label} className="rounded-md border bg-background/60 p-3">
              <p className="text-xs uppercase tracking-normal text-muted-foreground">{label}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="size-5 text-primary" />
              O que é o HBase
            </CardTitle>
            <CardDescription>Banco NoSQL distribuído inspirado no Google Bigtable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              O HBase organiza dados em linhas identificadas por uma row key, famílias de colunas,
              qualificadores e versões por timestamp. Ele não segue o modelo relacional tradicional e
              permite linhas esparsas, onde cada registro pode ter conjuntos diferentes de colunas.
            </p>
            <p>
              A leitura e a escrita são otimizadas quando a chave da linha representa bem a consulta
              principal da aplicação.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-5 text-primary" />
              Para que é usado
            </CardTitle>
            <CardDescription>Cenários com alto volume e acesso por chave.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">
              O HBase é indicado para dados grandes, históricos e esparsos, especialmente quando as
              consultas mais importantes usam uma chave ou um intervalo de chaves.
            </p>
            <div className="flex flex-wrap gap-2">
              {useCases.map((item) => (
                <Badge key={item} variant="outline">
                  {item}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="size-5 text-primary" />
              Classificação CAP
            </CardTitle>
            <CardDescription>Como o trabalho apresenta o comportamento do banco.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              O HBase é apresentado como CP: prioriza consistência e tolerância a partições. Em
              falhas, reatribuições de regiões ou problemas de coordenação, a disponibilidade pode ser
              temporariamente reduzida para preservar a consistência dos dados.
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-medium text-foreground">
              <div className="rounded-md border bg-card/70 p-2">C</div>
              <div className="rounded-md border bg-card/70 p-2">P</div>
              <div className="rounded-md border bg-muted/40 p-2 text-muted-foreground">A parcial</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="size-5 text-primary" />
            Arquitetura da aplicação
          </CardTitle>
          <CardDescription>O fluxo completo da demonstração prática.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
            {architecture.map(([title, detail], index) => (
              <ArchitectureNode key={title} title={title} detail={detail} showArrow={index < architecture.length - 1} />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table2 className="size-5 text-primary" />
              Estrutura do HBase neste trabalho
            </CardTitle>
            <CardDescription>Duas tabelas com row keys pensadas para o fluxo de IoT.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {hbaseTables.map((table) => (
              <div key={table.title} className="rounded-md border bg-card/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{table.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{table.description}</p>
                  </div>
                  <HardDrive className="size-5 text-primary" />
                </div>
                <div className="mt-4 rounded-md border bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">row key</p>
                  <code className="mt-1 block text-sm text-primary">{table.rowKey}</code>
                </div>
                <div className="mt-4 space-y-2">
                  {table.families.map(([family, columns]) => (
                    <div key={family} className="grid gap-2 rounded-md border bg-background/60 p-3 sm:grid-cols-[110px_1fr]">
                      <code className="text-sm text-primary">{family}</code>
                      <p className="text-sm text-muted-foreground">{columns}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers3 className="size-5 text-primary" />
              Como foi usado
            </CardTitle>
            <CardDescription>Modelagem feita para consulta por sensor e por tempo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              A tabela <code className="text-primary">sensors</code> guarda o cadastro do sensor e usa
              <code className="text-primary"> sensor_id</code> como row key, permitindo busca direta de
              um sensor específico.
            </p>
            <p>
              A tabela <code className="text-primary">sensor_readings</code> guarda as medições. A row
              key <code className="text-primary">sensor_id#timestamp</code> agrupa as leituras por
              sensor e facilita scans por prefixo.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <DiagramToken icon={<Rows3 />} label="linha" value="sensor-ui-01#2026..." />
              <DiagramToken icon={<Braces />} label="famílias" value="metrics, device, alert, time" />
              <DiagramToken icon={<Server />} label="API" value="FastAPI normaliza os campos" />
              <DiagramToken icon={<Database />} label="persistência" value="HBase via Thrift" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operações do enunciado dentro do projeto</CardTitle>
          <CardDescription>Equivalentes usados porque HBase não usa a mesma sintaxe do MongoDB.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {operations.map(([name, equivalent]) => (
            <div key={name} className="rounded-md border bg-card/70 px-3 py-2 text-sm">
              <code className="text-primary">{name}</code>
              <p className="mt-1 text-muted-foreground">{equivalent}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ArchitectureNode({ title, detail, showArrow }: { title: string; detail: string; showArrow: boolean }) {
  return (
    <>
      <div className="rounded-md border bg-card/70 p-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
      {showArrow ? (
        <div className="hidden items-center justify-center text-primary lg:flex">
          <ArrowRight className="size-5" />
        </div>
      ) : null}
    </>
  );
}

function DiagramToken({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card/70 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-normal text-muted-foreground">
        <span className="[&_svg]:size-4 [&_svg]:text-primary">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
