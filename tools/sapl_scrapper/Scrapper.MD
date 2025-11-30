# Tutorial: extraindo **Projetos de Lei (PL)** de um SAPL (municipal/estadual)

> Objetivo: mostrar, passo a passo, como **listar e baixar** todos os PLs de uma instância SAPL, cobrindo as **variações de tipo** que aparecem nas Câmaras/Assembleias (ex.: *Projeto de Lei Ordinária*, *Complementar*, *do Executivo*, *do Legislativo*, etc.).

---

## 0) O que é o SAPL e onde fica a API

O **SAPL** (Interlegis/Senado) informatiza o processo legislativo e expõe uma **API REST** (Django REST Framework) em `{BASE}/api/…`. Muitas instâncias trazem um **Swagger** em `{BASE}/api/schema/swagger-ui/`. ([Senado Federal][1])

**Ex.:** Swagger público (AL/PI) exibe recursos como `tipomaterialegislativa`, `materialegislativa` e o atalho `ultima_tramitacao`. ([SAPL][2])

---

## 1) Quais **tipos de PL** existem no SAPL?

Cada Casa define seus **Tipos de Matéria Legislativa**; para PLs, você verá nomes como:

* **Projeto de Lei Ordinária** (municipal/estadual) ([sapl.saovicente.sp.leg.br][3])
* **Projeto de Lei Complementar** (e variantes) ([sapl.saovicente.sp.leg.br][3])
* **Projeto de Lei – Executivo** / **Projeto de Lei Executivo** (quando a autoria é do Executivo) ([sapl.piedade.sp.leg.br][4])
* **Projeto de Lei do Legislativo** (quando a autoria é de vereador/deputado) ([sapl.boavista.rr.leg.br][5])
* **Projeto de Lei Complementar – Executivo** / **Projeto de Lei Complementar Executivo** (variante nomeada) ([sapl.sapezal.mt.leg.br][6])

Esses rótulos aparecem no filtro “**Tipo de Matéria Legislativa**” da busca e, portanto, também na API. ([sapl.saovicente.sp.leg.br][3])

> ⚠️ **Importante:** os nomes variam (“- Executivo”, “Executivo”, “do Legislativo”, “Ordinária”, etc.). Por isso, iremos **buscar os tipos via API** e filtrar todos que contenham “projeto de lei” (case-insensitive), incluindo complementares e executivos.

---

## 2) Conferir a API da sua instância

Substitua `{BASE}` pela URL do SAPL da Casa (ex.: `https://sapl.fortaleza.ce.leg.br`).

```bash
# Abrir o Swagger no navegador (se existir)
{BASE}/api/schema/swagger-ui/

# Checar se o endpoint de Tipos responde
curl -s "{BASE}/api/materia/tipomaterialegislativa/?page_size=1" | jq .
```

A API do SAPL é gerada automaticamente para os modelos, segundo o DRF (há confirmação no código do projeto e em issues do repositório oficial). ([Gitea: Git with a cup of tea][7])

---

## 3) Listar **todos os tipos** e selecionar os de **PL**

Usaremos Python para:

1. listar `tipomaterialegislativa`;
2. **filtrar** tudo que contenha “projeto de lei” (incluindo *complementar*, *executivo*, *do legislativo*, etc.).

```python
import requests, unicodedata, re

BASE = "https://sapl.fortaleza.ce.leg.br"  # <-- troque pela sua instância
s = requests.Session(); s.headers["User-Agent"] = "SAPL-PL-Tutorial/1.0"

def norm(s_):
    s_ = unicodedata.normalize("NFKD", s_ or "").encode("ascii","ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]+"," ", s_)

tipos = []
url = f"{BASE}/api/materia/tipomaterialegislativa/?page_size=500"
while url:
    r = s.get(url, timeout=30); r.raise_for_status()
    data = r.json()
    if isinstance(data, dict) and "results" in data:
        tipos.extend(data["results"]); url = data.get("next")
    else:
        tipos.extend(data if isinstance(data,list) else []); url = None

tipos_pl = []
for t in tipos:
    label = " ".join(str(t.get(k,"")) for k in ("sigla","descricao","nome"))
    lab = norm(label)
    if "projeto de lei" in lab:  # pega Ordinária, Complementar, Executivo, Legislativo, etc.
        tipos_pl.append({"id": t.get("id") or t.get("pk"), "rotulo": label})

print("Tipos de PL encontrados:")
for t in tipos_pl: print("-", t)
```

> Dica: abra a busca web da Casa (ex.: São Vicente, Fortaleza) e compare os **rótulos** com o que veio na API. ([sapl.saovicente.sp.leg.br][3])

---

## 4) Baixar **todas as matérias** de cada tipo (PL)

O recurso de matérias é exposto em `/api/materia/` nas versões mais novas, com **fallback** em `/api/materia/materialegislativa/` em instâncias legadas. O Swagger do AL/PI também mostra a **action** `…/materialegislativa/{id}/ultima_tramitacao/`. ([SAPL][2])

```python
import csv

def pick_endpoint(base):
    for path in ("/api/materia/", "/api/materia/materialegislativa/"):
        try:
            s.get(base+path, params={"page_size":1}, timeout=20).raise_for_status()
            return base+path
        except Exception:
            pass
    raise RuntimeError("Nenhum endpoint de matérias disponível.")

MATERIAS = pick_endpoint(BASE)

def pager(url, params):
    while True:
        r = s.get(url, params=params, timeout=60); r.raise_for_status()
        data = r.json()
        if isinstance(data, dict) and "results" in data:
            for it in data["results"]: yield it
            if data.get("next"): url, params = data["next"], {}
            else: break
        elif isinstance(data, list):
            for it in data: yield it
            break
        else: break

rows = []
for tp in tipos_pl:
    params = {"tipo": tp["id"], "page_size": 100, "o": "-ano"}  # ordena por ano desc (quando suportado)
    for m in pager(MATERIAS, params):
        rows.append({
            "id": m.get("id"),
            "tipo": tp["rotulo"],
            "numero": m.get("numero"),
            "ano": m.get("ano"),
            "ementa": m.get("ementa") or m.get("observacao"),
            "data_apresentacao": m.get("data_apresentacao") or m.get("data_recebimento"),
            "em_tramitacao": m.get("em_tramitacao"),
            "situacao": m.get("status") or m.get("situacao"),
            # link público estável para consulta:
            "link_publico": f"{BASE}/materia/{m.get('id')}/acompanhar-materia/" if m.get("id") else "",
        })

with open("pls.csv","w",newline="",encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)

print(f"Salvo {len(rows)} itens em pls.csv")
```

> **Por que “ultima_tramitacao” importa?** O SAPL expõe um **endpoint** que retorna a última tramitação de uma matéria (`GET …/materialegislativa/{id}/ultima_tramitacao/`), implementado no core do projeto. Use-o para enriquecer cada linha com **data/status** mais recentes. ([SAPL][2])

```python
def ultima_tramitacao(base, materia_id):
    url = f"{base}/api/materia/materialegislativa/{materia_id}/ultima_tramitacao/"
    try:
        r = s.get(url, timeout=20); r.raise_for_status()
        return r.json() or {}
    except Exception:
        return {}

# exemplo de uso:
rows[0]["ultima_tramitacao"] = ultima_tramitacao(BASE, rows[0]["id"])
```

---

## 5) **Textos** e **anexos** (opcional)

* Muitas instâncias expõem, no objeto da matéria, campos como **`texto_original`** e um conjunto de **`documentoacessorio`**; esses arquivos ficam sob `/media/sapl/public/documentoacessorio/...`. Os templates oficiais mostram esses campos, e várias Casas publicam PDFs por ali. ([Gitea: Git with a cup of tea][8])
* Também existem endpoints REST para **documentos acessórios**; consulte o Swagger da sua instância e procure por *documentoacessorio* (o caminho pode variar por app). ([SAPL][2])

> Se a API não listar anexos diretamente, o **link público** `…/materia/{id}/acompanhar-materia/` (já salvo acima) costuma reunir tudo que está relacionado à matéria.

---

## 6) Boas práticas, variações e auditoria

* **Nomes de tipos variam** (“Projeto de Lei - Executivo”, “Projeto de Lei Executivo”, etc.). O filtro “contém ‘projeto de lei’” cobre as principais formas — ver exemplos reais nas Câmaras citadas. ([sapl.piedade.sp.leg.br][4])
* **Paginação**: a API segue padrão DRF com `page/page_size` e/ou `results/next`. (Ver Swagger/AL-PI). ([SAPL][2])
* **Campos**: as chaves podem variar levemente por versão da Casa. Confira o **Swagger** da instância para o esquema exato. ([SAPL][2])
* **Performance**: respeite limites; ajuste `page_size` (100/200) e adicione *sleep* se necessário.
* **Contexto oficial**: o SAPL é mantido pelo Interlegis/Senado; referências de produto ajudam a entender a modelagem (Tipos, Matérias, Tramitações). ([Senado Federal][1])

---

## 7) Teste rápido (linhas de comando)

```bash
# Listar tipos na instância (ex.: São Vicente/SP)
curl -s "https://sapl.saovicente.sp.leg.br/api/materia/tipomaterialegislativa/?page_size=200" | jq '.results[].descricao' 
# Você deve ver rótulos como "Projeto de Lei Ordinária", "Projeto de Lei Complementar", etc. (como no filtro web). :contentReference[oaicite:18]{index=18}

# Trazer 100 matérias do tipo PL Ordinária (substitua o id do tipo)
curl -s "https://sapl.saovicente.sp.leg.br/api/materia/?tipo=<ID_DO_TIPO>&page_size=100" | jq '.results | length'
```

---

## 8) Checklist de **qualidade de dados**

1. **Cobriu todos os tipos “PL”** (ordinária, complementar, executivo, legislativo, variantes)? (confira os rótulos via API e o filtro do site). ([sapl.saovicente.sp.leg.br][3])
2. **Enriqueceu com a última tramitação**? (endpoint `…/ultima_tramitacao/`). ([SAPL][2])
3. **Guardou o link público** `…/materia/{id}/acompanhar-materia/` para auditoria? (página da matéria). ([sapl.varginha.mg.leg.br][9])
4. **Capturou anexos/texto original** quando disponíveis? (templates e PDFs indicam onde ficam). ([Gitea: Git with a cup of tea][8])

---

### Referências principais

* Interlegis/Senado — produto **SAPL** (visão geral). ([Senado Federal][1])
* Swagger de uma instância (AL/PI) — **materia**, **tipomaterialegislativa**, **ultima_tramitacao**. ([SAPL][2])
* Código do SAPL — API auto-gerada e action `ultima_tramitacao`. ([Gitea: Git with a cup of tea][7])
* Exemplos de **tipos de PL** e filtros nas Câmaras/Assembleias citadas. ([sapl.saovicente.sp.leg.br][3])

---

Se quiser, adapto o código acima para **rodar em lote** sobre várias Casas (lista de bases SAPL), gerar um **CSV único** (com origem, UF, município) e anexar **última tramitação** e **links de anexos**.

[1]: https://www12.senado.leg.br/interlegis/produtos/sapl?utm_source=chatgpt.com "Sistema de Apoio ao Processo Legislativo (SAPL)"
[2]: https://sapl.al.pi.leg.br/api/schema/swagger-ui/?utm_source=chatgpt.com "Sapl API - docs"
[3]: https://sapl.saovicente.sp.leg.br/materia/pesquisar-materia?utm_source=chatgpt.com "Câmara Municipal de São Vicente - SAPL"
[4]: https://sapl.piedade.sp.leg.br/materia/2654?utm_source=chatgpt.com "Executivo nº 19 de 2022 - SAPL - Câmara Municipal de Piedade"
[5]: https://sapl.boavista.rr.leg.br/materia/31308?utm_source=chatgpt.com "Projeto de Lei do Legislativo nº 195 de 2022 - SAPL"
[6]: https://sapl.sapezal.mt.leg.br/materia/425?utm_source=chatgpt.com "Projeto de Lei Complementar - Executivo nº 1 de 2025"
[7]: https://git.interlegis.leg.br/SPDT/sapl/src/commit/aa432330592d00c725aa290a71192459f7b724e9/sapl/api/views.py?utm_source=chatgpt.com "SPDT/sapl: Sistema de Apoio ao Processo Legislativo - sapl/api ..."
[8]: https://git.interlegis.leg.br/SPDT/sapl/blame/commit/d807f835fd0cee2d28f59ca3cc4f4b62bd718c3f/sapl/templates/materia/materialegislativa_filter.html?utm_source=chatgpt.com "SPDT/sapl - sapl - Gitea: Git with a cup of tea - Interlegis"
[9]: https://sapl.varginha.mg.leg.br/materia/4417?utm_source=chatgpt.com "CÂMARA MUNICIPAL DE VARGINHA - MG - SAPL"
