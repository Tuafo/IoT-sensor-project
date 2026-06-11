# Monitoramento Ambiental IoT com Apache HBase

Projeto acadêmico de NoSQL que usa o Apache HBase como banco de dados principal para um sistema de monitoramento ambiental com sensores IoT. A aplicação possui backend em FastAPI, banco HBase em Docker, simulador de leituras e uma interface React com shadcn/ui em tema escuro para demonstrar sensores, séries temporais, alertas, estatísticas, gráficos e dados reais de clima.

## Objetivo

O objetivo do projeto é demonstrar como o HBase pode ser usado em um cenário de IoT e séries temporais. Sensores ambientais enviam leituras com temperatura, umidade, pressão, bateria, intensidade do sinal e horário da medição. Cada leitura é gravada no HBase e pode gerar alertas automaticamente.

## Tecnologias

- Apache HBase como banco de dados NoSQL principal.
- HBase Thrift para comunicação com a API.
- Python FastAPI no backend.
- React, Vite, Tailwind CSS e shadcn/ui na interface.
- Docker Compose para executar todo o ambiente localmente.

## Como Executar

Com o Docker Desktop aberto, execute:

```bash
docker compose up --build
```

Depois acesse:

- Interface do sistema: `http://localhost:5174`
- Documentação da API: `http://localhost:8001/docs`
- Interface do HBase: `http://localhost:16010`

A interface web concentra a demonstração principal. Ela possui uma aba com dados mockados, botão de atualização contínua e gráficos; uma aba com dados reais agregados por cidade; uma aba para entrada de dados e execução das operações da API; e uma aba com tipos de gráficos úteis para monitoramento ambiental.

Para parar o ambiente:

```bash
docker compose down
```

Para apagar também os dados gravados no HBase:

```bash
docker compose down -v
```

## Como Usar a Interface

1. Abra `http://localhost:5174`.
2. Abra a aba “Mock data”.
3. Clique em “Rodar contínuo” para iniciar atualizações simuladas.
4. Observe os gráficos de temperatura, umidade e bateria.
5. Abra a aba “Dados reais”.
6. Busque uma cidade pelo campo de pesquisa. A busca usa a Open-Meteo Geocoding API.
7. Selecione um local retornado e clique em “Atualizar” para buscar clima, qualidade do ar e altitude.
8. Abra a aba “Entrada/API” para criar, listar, buscar, atualizar e excluir sensores, além de inserir, consultar e excluir leituras.
9. Abra a aba “Gráficos” para ver opções de visualização adequadas para dados ambientais.

Esse fluxo cobre a ideia de sensores IoT, séries temporais, alertas, estatísticas, operações CRUD e integração com fontes externas de dados. A API local continua disponível em `http://localhost:8001/docs` para inspeção técnica dos endpoints.

## O Que é o HBase?

Apache HBase é um banco de dados NoSQL distribuído, inspirado no Google Bigtable. Ele é classificado como um banco do tipo wide-column, ou seja, os dados são organizados em tabelas, chaves de linha, famílias de colunas, qualificadores de coluna, timestamps e valores.

Diferente de um banco relacional, o HBase não exige que todas as linhas tenham as mesmas colunas. Isso o torna adequado para dados esparsos e grandes volumes de informação. Ele também é otimizado para leitura e escrita rápidas por chave, desde que o modelo de chaves seja bem planejado.

## Classificação CAP

Na classificação CAP, o HBase é geralmente considerado CP: ele prioriza consistência e tolerância a partições. Em situações de falha, movimentação de regiões ou problemas de coordenação, a disponibilidade pode ser temporariamente reduzida para preservar a consistência dos dados.

## Por Que HBase Para IoT?

Sistemas de IoT costumam gerar muitas leituras ao longo do tempo. Normalmente, as consultas mais importantes são:

- Buscar um sensor pelo seu identificador.
- Listar leituras de um sensor.
- Encontrar a leitura mais recente.
- Calcular estatísticas por sensor.
- Identificar leituras com alerta.

Esses padrões combinam bem com HBase, porque a chave de linha pode ser modelada de acordo com a forma como a aplicação consulta os dados.

## Modelo de Dados

### Tabela `sensors`

Chave de linha:

```text
sensor_id
```

Exemplo:

```text
sensor-sp-01
```

Famílias de colunas:

- `info`: `name`, `sensor_type`, `status`
- `location`: `latitude`, `longitude`, `city`, `country`
- `device`: `model`, `firmware`

Essa tabela armazena os dados cadastrais dos sensores. A chave `sensor_id` permite acesso direto a um sensor específico.

### Tabela `sensor_readings`

Chave de linha:

```text
sensor_id#timestamp
```

Exemplo:

```text
sensor-sp-01#2026-06-10T20:00:00Z
```

Famílias de colunas:

- `metrics`: `temperature`, `humidity`, `pressure`
- `device`: `battery`, `signal_strength`
- `alert`: `level`, `message`
- `time`: `timestamp`

Essa modelagem agrupa as leituras pelo sensor. Com isso, a API consegue listar as leituras de um sensor usando busca por prefixo, por exemplo `sensor-sp-01#`.

## Regras de Alerta

A API calcula alertas quando uma leitura é inserida:

- Temperatura alta: `temperature >= 35`
- Umidade baixa: `humidity <= 30`
- Bateria baixa: `battery < 20`

O resultado é gravado no HBase na família `alert`:

- `alert:level`: `ok`, `warning` ou `critical`
- `alert:message`: descrição do motivo do alerta

## Endpoints da API

- `POST /sensors`: cria sensor.
- `GET /sensors`: lista sensores.
- `GET /sensors/{sensor_id}`: busca um sensor.
- `PATCH /sensors/{sensor_id}`: atualiza um sensor.
- `DELETE /sensors/{sensor_id}`: remove um sensor.
- `POST /readings`: insere uma leitura.
- `GET /readings/{sensor_id}`: lista leituras por sensor.
- `GET /readings/{sensor_id}/latest`: retorna a leitura mais recente.
- `DELETE /readings/{sensor_id}`: remove uma leitura pelo timestamp.
- `GET /alerts`: lista leituras com alerta.
- `GET /stats`: retorna estatísticas básicas.

## Simulador

Além da interface, o projeto possui o arquivo `simulator.py`, que gera leituras realistas para São Paulo, Rio de Janeiro e Brasília. Ele cria sensores automaticamente e envia leituras para a API.

Uso opcional:

```bash
python simulator.py --api http://localhost:8001 --cycles 5 --interval 1
```

A UI é o caminho recomendado para apresentação. O simulador é útil apenas para popular rapidamente o banco com mais dados.

## Dados Reais Agregados

A aba “Dados reais” usa APIs gratuitas da Open-Meteo:

- Weather Forecast API: temperatura, umidade, pressão, vento e previsão horária.
- Air Quality API: AQI europeu, PM10, PM2.5, CO, NO2, O3 e índice UV.
- Elevation API: altitude do ponto consultado.
- Geocoding API: transforma nomes de cidades em latitude, longitude, país, estado e fuso horário.

A cidade inicial é Juiz de Fora, Minas Gerais, mas a interface permite pesquisar e selecionar outros locais disponíveis na Geocoding API.

## Operações Disponíveis Pela Interface

A aba “Entrada/API” permite executar as principais operações disponíveis no backend:

- Criar sensor: `POST /sensors`
- Listar sensores: `GET /sensors`
- Buscar sensor: `GET /sensors/{sensor_id}`
- Atualizar sensor: `PATCH /sensors/{sensor_id}`
- Excluir sensor: `DELETE /sensors/{sensor_id}`
- Inserir leitura: `POST /readings`
- Listar leituras por sensor: `GET /readings/{sensor_id}`
- Buscar última leitura: `GET /readings/{sensor_id}/latest`
- Excluir leitura: `DELETE /readings/{sensor_id}`
- Listar alertas: `GET /alerts`
- Consultar estatísticas gerais ou por sensor: `GET /stats`

As respostas aparecem em formato JSON na própria interface, o que facilita a apresentação do comportamento da API e da persistência no HBase.

## Tipos de Gráficos Usados

Para dados ambientais e séries temporais de sensores, a interface usa:

- Gráfico de linhas: bom para tendências contínuas, como temperatura, umidade, bateria e pressão ao longo do tempo.
- Gráfico de área: útil para destacar volume, intensidade ou variação acumulada de uma métrica.
- Gráfico composto: combina barras, linhas e áreas, permitindo comparar variáveis diferentes, como chuva, temperatura e material particulado.
- Gráfico de dispersão: útil para observar correlação entre variáveis, por exemplo temperatura versus umidade.

Essas escolhas seguem práticas comuns de visualização de séries temporais e dados ambientais: linhas para tendências, áreas para intensidade, gráficos compostos para múltiplas grandezas e dispersão para correlação/anomalias.

## Equivalentes do HBase Para Operações Parecidas com MongoDB

- `find`: no HBase, corresponde a `get` para buscar uma linha por chave ou `scan` para percorrer várias linhas.
- `match`: pode ser feito com filtros de `scan` ou com filtragem na aplicação.
- `project`: corresponde a selecionar colunas ou famílias de colunas específicas.
- `group`: normalmente é feito na aplicação, em Spark, MapReduce ou Phoenix. Neste projeto, o endpoint `/stats` faz agregação na API.
- `lookup`: corresponde a buscar linhas relacionadas em outra tabela. Neste projeto, a API valida o `sensor_id` na tabela `sensors` antes de gravar leituras em `sensor_readings`.

## Mapeamento dos Requisitos

- HBase como banco principal: sensores e leituras são persistidos no HBase.
- Ambiente local com Docker: `docker-compose.yml` sobe HBase, API e frontend.
- Tabelas obrigatórias: `sensors` e `sensor_readings`.
- Chaves obrigatórias: `sensor_id` e `sensor_id#timestamp`.
- Famílias de colunas exigidas: `info`, `location`, `metrics`, `device`, `alert` e `time`.
- CRUD de sensores: implementado na API e disponível pela interface.
- Operações de leituras: inserir, listar por sensor, buscar a última leitura e excluir.
- Sensores simulados: disponíveis pela interface, com execução contínua, e pelo arquivo `simulator.py`.
- Dados reais: a interface agrega clima, qualidade do ar e altitude de Juiz de Fora por APIs gratuitas.
- Alertas: temperatura alta, umidade baixa e bateria baixa são avaliadas e salvas.
- Estatísticas: total de leituras, temperatura média, mínima, máxima e leituras recentes.
- Documentação: este README explica HBase, tipo NoSQL, CAP, ecossistema, modelo das tabelas, chaves, execução e equivalentes de operações do MongoDB.

## Estrutura do Projeto

```text
.
├── app/                  # Backend FastAPI
├── frontend/             # Interface React com shadcn/ui
├── scripts/              # Scripts de criação das tabelas
├── docker-compose.yml    # HBase, API e frontend
├── Dockerfile            # Imagem da API
├── requirements.txt      # Dependências Python
└── simulator.py          # Simulador opcional de sensores
```
