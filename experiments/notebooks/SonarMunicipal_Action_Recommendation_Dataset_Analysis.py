#!/usr/bin/env python
# coding: utf-8

# In[1]:


# Download the Action Recommendation Dataset
get_ipython().system('gdown "1ECcRj3u6g04z-4ODNSHoJC3jRz6ba0nd"')


# In[2]:


import numpy as np

with open("/content/dataset.npy", "rb") as f:
  dataset = np.load(f, allow_pickle=True)

len(dataset)


# In[3]:


cities = list(set([row['municipio'] for row in dataset]))
len(cities)


# In[4]:


years = list(set([row['ano'] for row in dataset]))[2:]
print(f"{min(years)} até {max(years)}")


# In[5]:


embeddings = [row['embedding'] for row in dataset]
embeddings = np.concat([embeddings])

embeddings.shape


# In[6]:


from sentence_transformers import SentenceTransformer
import numpy as np

# Carrega o modelo uma única vez (fora da função, para não recarregar toda hora)
model = SentenceTransformer("embaas/sentence-transformers-multilingual-e5-base")

def top_k_similares(texto: str,
                    embeddings: np.ndarray,
                    k: int = 5) -> np.ndarray:
    """
    Retorna os índices das k embeddings mais similares semanticamente ao `texto`.

    Parâmetros
    ----------
    texto : str
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
    consulta = f"query: {texto}"
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


# In[12]:


texto = "Como diminuir a criminalidade no município?"
k = 500

indices_top_k = top_k_similares(texto, embeddings, k)
print(indices_top_k)


# In[13]:


results = dataset[indices_top_k]
[(row['municipio'], row['acao']) for row in results]


# In[16]:


import numpy as np

emb = np.concat([row['embedding'][None] for row in results])
emb.shape


# In[26]:


import umap

umodel = umap.UMAP(
    n_neighbors=3,        # aumenta => tópicos mais globais
    n_components=2,       # 10–25 geralmente é bom
    min_dist=0.0,
    metric="cosine",
    random_state=42,
    verbose=True
)

umodel


# In[27]:


embeddings_umap = umodel.fit_transform(emb)
embeddings_umap.shape


# In[28]:


import pandas as pd
import altair as alt

df = pd.DataFrame({
    "x": embeddings_umap[:, 0],
    "y": embeddings_umap[:, 1],
    "label": [row['acao'] for row in results],
})

alt.Chart(df).mark_circle().encode(
    x=alt.X("x:Q", axis=alt.Axis(title="UMAP-1")),
    y=alt.Y("y:Q", axis=alt.Axis(title="UMAP-2")),
    tooltip=[alt.Tooltip("label:N", title="Ação")]
).interactive()

