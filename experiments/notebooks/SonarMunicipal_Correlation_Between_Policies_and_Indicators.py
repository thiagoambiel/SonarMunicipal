#!/usr/bin/env python
# coding: utf-8

# In[2]:


# Download the Custom Criminal Indicator Data
get_ipython().system('gdown "1VgzwriksHMj5uiX2pYk7cv8hOavA1fku"')


# In[3]:


# Download the Action Recommendation Dataset
get_ipython().system('gdown "1ECcRj3u6g04z-4ODNSHoJC3jRz6ba0nd"')


# In[4]:


import numpy as np

with open("/content/dataset.npy", "rb") as f:
  dataset = np.load(f, allow_pickle=True)

len(dataset)


# In[9]:


cities = list(set([row['municipio'].upper() for row in dataset]))
len(cities)


# In[16]:


import pandas as pd

df = pd.read_csv("/content/criminal_indicator.csv")
df = df[df['municipio_norm'].isin(cities)]
len(df['municipio_norm'].unique())


# In[17]:


df


# In[19]:


from sentence_transformers import SentenceTransformer
import numpy as np

# Carrega o modelo uma única vez (fora da função, para não recarregar toda hora)
model = SentenceTransformer("embaas/sentence-transformers-multilingual-e5-base")

def top_k(text: str,
          embeddings: np.ndarray,
          k: int = 5) -> np.ndarray:
    """
    Retorna os índices das k embeddings mais similares semanticamente ao `texto`.

    Parâmetros
    ----------
    text : str
        Texto de entrada.
    embeddings : np.ndarray
        Matriz de embeddings com shape (N, 768), por exemplo (250000, 768).
        Idealmente pré-computadas com o mesmo modelo.
    k : int
        Número de vizinhos mais próximos a retornar.

    Retorno
    -------
    np.ndarray
        Array 1D com os índices das k embeddings mais similares.
    """

    # 1) Codificar o texto de entrada em um embedding
    # Para modelos E5, é comum prefixar com "query: "
    consulta = f"query: {text}"
    embedding_texto = model.encode(
        consulta,
        normalize_embeddings=True  # já normaliza o vetor (norma L2 = 1)
    )  # shape (768,)

    # 2) Garantir que a matriz de embeddings também está normalizada
    #    (se você já salvou normalizada, pode pular esse passo)
    normas = np.linalg.norm(embeddings, axis=1, keepdims=True)
    # Evitar divisão por zero
    normas[normas == 0] = 1e-12
    embeddings_norm = embeddings / normas

    # 3) Similaridade por produto interno (equivale a cosseno se tudo está normalizado)
    #    resultado: vetor de similaridades shape (N,)
    scores = embeddings_norm @ embedding_texto

    # 4) Pegar os índices das k maiores similaridades
    # argpartition é mais eficiente que sort para top-k
    if k >= len(scores):
        # Se k >= N, só ordena tudo
        return np.argsort(-scores)

    idx_part = np.argpartition(-scores, k)[:k]  # k maiores (desordenados)
    # Ordenar esses k pelo score decrescente
    idx_ordenados = idx_part[np.argsort(-scores[idx_part])]

    return idx_ordenados


# In[25]:


dataset[10]


# In[20]:


embeddings = [row['embedding'] for row in dataset]
embeddings = np.concat([embeddings])

embeddings.shape


# In[79]:


text = "Como diminuir a criminalidade no município?"
k = 1000

indexes_top_k = top_k(text, embeddings, k)


# In[80]:


results = dataset[indexes_top_k]
results = [(row['municipio'], row['data_apresentacao'], row['acao']) for row in results]

pd.DataFrame(
    results,
    columns=['nome', 'data', 'acao']
)


# In[81]:


uf2score = {}

for idx, row in df.iterrows():
  key = (row['municipio_norm'], row['ano'], row['semestre'])
  uf2score[key] = row['taxa_homicidios_100k']

uf2score


# In[82]:


from datetime import datetime

def encode_date(date_str: str):
    date = datetime.strptime(date_str, "%Y-%m-%d")
    year = date.year
    semester = 1 if date.month <= 6 else 2
    return year, semester


# In[83]:


filter = []

for name, date, action in results:
  year, semester = encode_date(date)
  key = (name.upper(), year, semester)

  if semester == 1:
    next_key = (name.upper(), year, 2)
  else:
    next_key = (name.upper(), year + 1, 1)

  if next_key not in uf2score:
    continue

  if key in uf2score:
    delta = uf2score[next_key] - uf2score[key]
    filter.append((name, action, delta))


# In[84]:


import unicodedata
import re
from statistics import mean, stdev
from typing import List, Tuple, Dict, Any, Optional


# ---------- 1. Pré-processamento de texto ----------

STOPWORDS = {
    "a", "as", "o", "os", "um", "uma", "uns", "umas",
    "de", "do", "da", "dos", "das",
    "em", "no", "na", "nos", "nas",
    "para", "pra", "pro", "por",
    "ao", "aos", "à", "às",
    "e"
}


def normalize_and_tokenize(text: str) -> List[str]:
    """
    Normaliza o texto e retorna tokens de conteúdo:
    - minúsculas
    - remove acentos
    - remove pontuação
    - quebra em tokens
    - remove stopwords
    """
    text = text.lower()

    # remove acentos
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))

    # remove pontuação
    text = re.sub(r"[^\w\s]", " ", text)

    # colapsa espaços
    text = re.sub(r"\s+", " ", text).strip()

    tokens = text.split()
    tokens = [t for t in tokens if t not in STOPWORDS]

    return tokens


# ---------- 2. Similaridade e agrupamento ----------

def jaccard_similarity(tokens_a: List[str], tokens_b: List[str]) -> float:
    """
    Similaridade de Jaccard entre conjuntos de tokens.
    """
    set_a = set(tokens_a)
    set_b = set(tokens_b)
    if not set_a and not set_b:
        return 1.0
    inter = len(set_a & set_b)
    uni = len(set_a | set_b)
    return inter / uni


def group_bills_by_structure(
    bills: List[Tuple[str, str, float]],
    threshold: float = 0.75,
) -> List[Dict[str, Any]]:
    """
    Agrupa projetos de lei (municipio, frase, score) em grupos
    estruturalmente similares, usando Jaccard sobre tokens normalizados.

    Retorna uma lista de grupos, cada grupo é um dict com:
      - "rep_tokens": tokens do representante
      - "rep_phrase": frase representante (primeira do grupo)
      - "members": lista de (municipio, frase, score, similarity)
    """
    if not bills:
        return []

    groups: List[Dict[str, Any]] = []

    for municipio, frase, score in bills:
        tokens = normalize_and_tokenize(frase)

        if not groups:
            groups.append({
                "rep_tokens": tokens,
                "rep_phrase": frase,
                "members": [(municipio, frase, score, 1.0)],
            })
            continue

        best_idx: Optional[int] = None
        best_sim = 0.0

        for i, g in enumerate(groups):
            sim = jaccard_similarity(tokens, g["rep_tokens"])
            if sim > best_sim:
                best_sim = sim
                best_idx = i

        if best_idx is not None and best_sim >= threshold:
            groups[best_idx]["members"].append(
                (municipio, frase, score, best_sim)
            )
        else:
            groups.append({
                "rep_tokens": tokens,
                "rep_phrase": frase,
                "members": [(municipio, frase, score, 1.0)],
            })

    return groups


# ---------- 3. Estatística básica ----------

def compute_mean_and_std(values: List[float]) -> Tuple[float, float]:
    """
    Calcula média e desvio padrão amostral.
    Se houver apenas um valor, desvio padrão = 0.0.
    """
    if not values:
        return 0.0, 0.0
    if len(values) == 1:
        return values[0], 0.0
    return mean(values), stdev(values)


# ---------- 4. Teste não paramétrico (Wilcoxon) ----------

def wilcoxon_less_than_zero(values: List[float], alpha: float = 0.05) -> Dict[str, Any]:
    """
    Aplica o teste de Wilcoxon signed-rank (não paramétrico)
    para verificar se a mediana dos valores é menor que zero.

    Retorna um dict:
      - "test": nome do teste
      - "p_value": p-valor (ou None se não foi possível calcular)
      - "reject_h0": True se rejeita H0 (mediana >= 0) em favor de mediana < 0
    """
    # Remove zeros (não contribuem para Wilcoxon)
    filtered = [v for v in values if v != 0.0]

    # Se poucos dados, o teste não faz muito sentido.
    if len(filtered) < 1:
        return {
            "test": "wilcoxon_signed_rank",
            "p_value": None,
            "reject_h0": False,
        }

    try:
        from scipy.stats import wilcoxon

        # H0: mediana = 0 ; H1: mediana < 0
        stat, p_value = wilcoxon(filtered, alternative="less", zero_method="wilcox")
        reject = (p_value is not None) and (p_value < alpha)
        return {
            "test": "wilcoxon_signed_rank",
            "p_value": float(p_value),
            "reject_h0": bool(reject),
        }
    except Exception:
        # Fallback simples: sem scipy, usa só o sinal da média
        m = mean(values)
        return {
            "test": "simple_mean_sign",
            "p_value": None,
            "reject_h0": bool(m < 0),
        }


# ---------- 5. Métrica de qualidade da política ----------

def compute_policy_quality(scores: List[float]) -> float:
    """
    Métrica de qualidade da política.

    Objetivo: políticas que reduzem o indicador (scores negativos)
    devem receber pontuação maior.

    A métrica considera:
      1) A proporção de municípios com score negativo (fraction_neg).
      2) A magnitude do efeito médio (mais negativa = melhor).

    Definição:
        fraction_neg = (# scores < 0) / n
        effect_mean  = mean(scores)

        quality = max(0, fraction_neg * (-effect_mean))

    Intuição:
      - Se poucos municípios melhoram (fraction_neg baixo), qualidade cai.
      - Se a média é pouco negativa (melhora fraca) ou positiva (piorou),
        a qualidade se aproxima de 0.
      - Positive outliers puxam a média pra cima e reduzem fraction_neg,
        penalizando políticas que causam piora em muitos lugares.
    """
    if not scores:
        return 0.0

    n = len(scores)
    neg_count = sum(1 for s in scores if s < 0)
    fraction_neg = neg_count / n if n > 0 else 0.0
    effect_mean = mean(scores)
    quality = fraction_neg * (-effect_mean)

    return max(0.0, quality)


# ---------- 6. Função principal: gerar políticas ----------

def generate_policies_from_bills(
    bills: List[Tuple[str, str, float]],
    similarity_threshold: float = 0.75,
    alpha: float = 0.05,
) -> List[Dict[str, Any]]:
    """
    Recebe uma lista de projetos de lei no formato:
      (municipio, descricao_PL, effect_score)

    Agrupa projetos estruturalmente similares e retorna uma lista de objetos:

      {
          "policy": Frase representativa do grupo,
          "actions": [(NomeMunicipio, Descricao, score), ...],
          "effect_mean": média dos scores,
          "effect_std": desvio padrão dos scores,
          "effective": resultado do teste não paramétrico
                       (dict com test, p_value, reject_h0),
          "quality_score": métrica que combina
                           (proporção de efeitos negativos) x
                           (magnitude média da melhoria)
      }
    """
    groups = group_bills_by_structure(bills, threshold=similarity_threshold)
    policies: List[Dict[str, Any]] = []

    for g in groups:
        members = g["members"]
        scores = [s for (_, _, s, _) in members]

        effect_mean, effect_std = compute_mean_and_std(scores)
        test_result = wilcoxon_less_than_zero(scores, alpha=alpha)
        quality_score = compute_policy_quality(scores)

        # agora actions inclui o score também
        actions = [(mun, frase, score) for (mun, frase, score, _) in members]

        policy_obj = {
            "policy": g["rep_phrase"],
            "actions": actions,
            "effect_mean": effect_mean,
            "effect_std": effect_std,
            "effective": test_result,
            "quality_score": quality_score,
        }
        policies.append(policy_obj)

    return policies


# In[85]:


policies = generate_policies_from_bills(filter)
policies = sorted(policies, key=lambda x: x['quality_score'], reverse=True)

for p in policies:

    if len(p['actions']) <= 1:
      continue

    print("Policy:", p["policy"])
    print("  effect_mean:", p["effect_mean"])
    print("  effect_std:", p["effect_std"])
    print("  quality:", p["quality_score"])
    print("  effective:", p["effective"])
    print("  actions:")
    for mun, desc, score in p["actions"]:
        print(f"    - {mun}: {score:.3f} | {desc}")
    print()

