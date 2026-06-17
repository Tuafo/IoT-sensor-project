# Integrantes:
- Thiago Goulart
- Alexander
- Arthur Villela

# Monitoramento Ambiental IoT com Apache HBase

Este projeto é uma aplicação acadêmica de banco de dados NoSQL usando **Apache HBase** como banco principal. A ideia é simular um sistema de monitoramento ambiental com sensores IoT, onde cada sensor envia leituras de temperatura, umidade, pressão, bateria e sinal.

A aplicação possui:

- Banco Apache HBase executando em Docker.
- Backend FastAPI com operações CRUD.
- Frontend em Next.js com dashboard web.
- Interface para criar, listar, buscar, atualizar e excluir sensores.
- Interface para inserir, consultar e excluir leituras.
- Alertas automáticos para temperatura alta, umidade baixa e bateria baixa.
- Estatísticas agregadas das leituras.
- Visualização com dados reais da Open-Meteo.
- Stress test pela própria interface.

## Tecnologias Utilizadas

- **Apache HBase**: banco NoSQL principal.
- **HBase Thrift**: comunicação entre Python e HBase.
- **happybase**: cliente Python para acessar o HBase via Thrift.
- **FastAPI**: API do backend.
- **Next.js**: frontend da aplicação.
- **React**: construção da interface.
- **Tailwind CSS** e componentes estilo shadcn/ui: visual do dashboard.
- **Recharts**: visualizações de dados.
- **Docker Compose**: execução do ambiente completo.

## Como Rodar o Projeto

Com o Docker Desktop aberto, rode na raiz do projeto:

```bash
docker compose up --build
```

Depois acesse:

- Interface web: <http://localhost:5174>
- Documentação da API: <http://localhost:8001/docs>
- Interface do HBase: <http://localhost:16010>

Para parar os containers:

```bash
docker compose down
```

Para parar e apagar os volumes do HBase:

```bash
docker compose down -v
```

## Como Usar a Interface

A interface principal roda em <http://localhost:5174>.

### Aba Trabalho

Funciona como o painel principal de explicação do trabalho:

- Banco escolhido.
- Tipo NoSQL.
- Classificação CAP.
- O que é o HBase.
- Para que o HBase é usado.
- Como o HBase foi usado neste projeto.
- Modelo de dados.
- Diagrama de arquitetura.
- Estrutura das tabelas no HBase.
- Operações equivalentes aos operadores pedidos no enunciado.

### Aba Dados reais

Usa APIs gratuitas da Open-Meteo para buscar dados reais de clima, qualidade do ar e altitude.

É possível pesquisar uma cidade, selecionar um local e carregar:

- Temperatura.
- Umidade.
- Pressão.
- Vento.
- AQI europeu.
- PM2.5.
- PM10.
- Ozônio.
- Índice UV.
- Altitude.

Esses dados são usados para complementar a visualização, mas o banco principal do trabalho continua sendo o HBase local.

### Aba Entrada/API

Essa aba concentra as operações da API.

Operações de sensores:

- Criar sensor.
- Listar sensores.
- Buscar sensor por ID.
- Atualizar sensor.
- Excluir sensor.

Operações de leituras:

- Inserir leitura.
- Listar leituras de um sensor.
- Buscar última leitura.
- Excluir leitura por timestamp.
- Listar alertas.
- Consultar estatísticas gerais.
- Consultar estatísticas por sensor.
- Verificar o health check da API.

As respostas aparecem em JSON na própria interface.

### Aba Stress test

Essa aba executa um teste de carga real contra o backend e o HBase.

Ela permite configurar:

- Quantidade de sensores.
- Quantidade de leituras por sensor.
- Quantidade de requisições paralelas.

Ao rodar o teste, a interface:

1. Cria sensores de teste.
2. Insere leituras em paralelo.
3. Consulta estatísticas.
4. Consulta alertas.
5. Mede progresso, sucessos, falhas, requisições por segundo, tempo total, latência média, P50 e P95.
6. Mostra um gráfico com latência por requisição, progresso acumulado e falhas.

Também existe o botão **Limpar**, que tenta remover os sensores e leituras gerados pelo teste.

Os campos são limitados pela interface para evitar uma carga acidentalmente muito alta.

## O Que é o Apache HBase

O Apache HBase é um banco de dados NoSQL distribuído, escalável, versionado e não relacional. Ele foi inspirado no Google Bigtable e é usado para armazenar grandes volumes de dados com leitura e escrita rápidas por chave.

O HBase é indicado para cenários como:

- Telemetria.
- IoT.
- Logs.
- Séries temporais.
- Grandes tabelas esparsas.
- Dados com muitos atributos opcionais.
- Consultas por chave ou por intervalo de chaves.

Ele não é focado em `JOINs` relacionais complexos. A modelagem depende bastante da escolha da row key.

## Tipo de Banco NoSQL

O HBase é um banco NoSQL do tipo **wide-column**.

Nesse modelo, os dados ficam em tabelas com:

- Row key.
- Famílias de colunas.
- Qualificadores de coluna.
- Timestamps.
- Valores.

Uma linha não precisa ter todas as colunas preenchidas. Isso permite armazenar dados esparsos de forma eficiente.

## Classificação CAP

No contexto do teorema CAP, o HBase é geralmente explicado como **CP**:

- **C - Consistency**: prioriza consistência, principalmente no nível de linha.
- **P - Partition tolerance**: é feito para funcionar em ambiente distribuído.
- **A - Availability**: em falhas ou reatribuições de regiões, a disponibilidade pode ser temporariamente reduzida para preservar consistência.

Essa classificação é uma forma didática de explicar o comportamento do HBase em cenários de falha.

## Modelo de Dados

O projeto usa duas tabelas principais no HBase.

### Tabela `sensors`

Guarda os dados cadastrais dos sensores.

Row key:

```text
sensor_id
```

Exemplo:

```text
sensor-ui-01
```

Famílias de colunas:

- `info`
- `location`
- `device`

Colunas usadas:

- `info:name`
- `info:sensor_type`
- `info:status`
- `location:latitude`
- `location:longitude`
- `location:city`
- `location:country`
- `device:model`
- `device:firmware`

### Tabela `sensor_readings`

Guarda as leituras ambientais.

Row key:

```text
sensor_id#timestamp
```

Exemplo:

```text
sensor-ui-01#2026-06-10T20:00:00Z
```

Famílias de colunas:

- `metrics`
- `device`
- `alert`
- `time`

Colunas usadas:

- `metrics:temperature`
- `metrics:humidity`
- `metrics:pressure`
- `device:battery`
- `device:signal_strength`
- `alert:level`
- `alert:message`
- `time:timestamp`

A chave `sensor_id#timestamp` permite listar as leituras de um sensor usando busca por prefixo.

## Regras de Alerta

Quando uma leitura é inserida, a API calcula um alerta automaticamente.

Regras:

- Temperatura maior ou igual a `35`: temperatura alta.
- Umidade menor ou igual a `30`: umidade baixa.
- Bateria menor que `20`: bateria baixa.
- Duas ou mais condições de alerta, temperatura maior ou igual a `40`, ou bateria menor que `10`: alerta crítico.

O alerta é gravado no HBase nas colunas:

- `alert:level`
- `alert:message`

## Endpoints da API

| Método | Endpoint | Função |
| --- | --- | --- |
| `GET` | `/health` | Verifica se a API está funcionando. |
| `POST` | `/sensors` | Cria um sensor. |
| `GET` | `/sensors` | Lista sensores. |
| `GET` | `/sensors/{sensor_id}` | Busca sensor por ID. |
| `PATCH` | `/sensors/{sensor_id}` | Atualiza sensor. |
| `DELETE` | `/sensors/{sensor_id}` | Exclui sensor. |
| `POST` | `/readings` | Insere uma leitura. |
| `GET` | `/readings/{sensor_id}` | Lista leituras por sensor. |
| `GET` | `/readings/{sensor_id}/latest` | Retorna a última leitura do sensor. |
| `DELETE` | `/readings/{sensor_id}` | Exclui uma leitura pelo timestamp. |
| `GET` | `/alerts` | Lista leituras com alerta. |
| `GET` | `/stats` | Retorna estatísticas gerais ou por sensor. |

## Operações Similares aos Operadores do Enunciado

Como HBase não é MongoDB, os operadores não aparecem com os mesmos nomes. O projeto usa equivalentes.

| Operador pedido | Equivalente no projeto |
| --- | --- |
| `find` | `get` e `scan` no HBase, usados em buscas por sensor e listagens. |
| `aggregate` | Endpoint `/stats`, que calcula estatísticas das leituras. |
| `$match` | Filtro por `sensor_id`, prefixo de row key e alertas. |
| `$project` | Retorno apenas dos campos necessários na API. |
| `$lookup` | Validação do sensor na tabela `sensors` antes de inserir leitura em `sensor_readings`. |
| `$unwind` | Leituras retornadas como lista de registros individuais. |
| `$group` | Estatísticas gerais e por sensor no endpoint `/stats`. |
| Arrays | Listas retornadas pela API, como sensores, leituras e alertas. |
| Subdocumentos | Famílias de colunas, como `metrics`, `device`, `location` e `alert`. |

## Inspeção Direta no HBase

Com os containers rodando, é possível entrar no shell do HBase:

```bash
docker exec -it iot-hbase hbase shell
```

Comandos úteis:

```ruby
list
describe 'sensors'
describe 'sensor_readings'
scan 'sensors'
scan 'sensor_readings', { LIMIT => 5 }
get 'sensors', 'sensor-ui-01'
```

Esses comandos mostram que os dados estão sendo persistidos no HBase.

## Simulador Opcional

Além da interface, existe um simulador em Python:

```bash
python simulator.py --cycles 5 --interval 1
```

Ele cria sensores e envia leituras para a API local em `http://localhost:8001`.

## Estrutura do Projeto

```text
.
├── app/                  # Backend FastAPI
│   ├── hbase_client.py    # Conexão, tabelas, conversões e alertas
│   ├── main.py            # Endpoints da API
│   └── models.py          # Modelos Pydantic
├── frontend/              # Frontend Next.js
│   ├── src/app/            # App Router do Next.js
│   ├── src/components/     # Componentes da interface
│   └── src/lib/            # Funções auxiliares
├── scripts/               # Script de criação das tabelas
├── docker-compose.yml     # HBase, API e frontend
├── Dockerfile             # Imagem da API
├── requirements.txt       # Dependências Python
└── simulator.py           # Simulador opcional
```

## Referências

- Apache HBase: <https://hbase.apache.org/>
- Apache HBase Reference Guide: <https://hbase.apache.org/book.html>
- Apache HBase Data Model: <https://hbase.apache.org/docs/datamodel/>
- Apache HBase ACID Semantics: <https://hbase.apache.org/acid-semantics/>
- Apache HBase Shell: <https://hbase.apache.org/docs/shell/>
- Apache HBase Architecture: <https://hbase.apache.org/docs/architecture/>
- Next.js: <https://nextjs.org/docs>
