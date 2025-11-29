#!/usr/bin/env python
# coding: utf-8

# In[1]:


import re
import json
import html
import numpy as np
from tqdm.auto import tqdm

def load_jsonl(file: str):
  data = open(file).read().split("\n")[:-1]
  data = [json.loads(row) for row in data]

  return data

def unique_by(lista, key_func=None):
    vistos = set()
    resultado = []

    for item in lista:
        if key_func is None:
            k = tuple(sorted(item.items()))
        else:
            k = key_func(item)

        if k not in vistos:
            vistos.add(k)
            resultado.append(item)

    return resultado

def normalize_text(s: str) -> str:
    if s is None:
        return ""
    s = html.unescape(s)
    s = s.replace("\r", " ").replace("\n", " ").strip()
    s = re.sub(r"\s+", " ", s)
    return s


# In[4]:


get_ipython().system('gdown "1Yym-ECdgWEezSlEN8yYPvv2bjZjGbcpk"')
actions = load_jsonl("/content/pl_actions.jsonl")
actions = unique_by(actions)

ementa2action = {}

for row in actions:
  ementa2action[row['ementa']] = row['acao']

len(ementa2action.keys())


# In[13]:


get_ipython().system('gdown "1rqIzHPwR37YnxuNzw6UCMNFrv65kHir8"')
metadata = load_jsonl("/content/pl.jsonl")
metadata = [row for row in metadata if row['ementa']]
metadata = unique_by(metadata, key_func=lambda x: (x['municipio'], x['uf'], x['ementa']))

for row in tqdm(metadata):
  row['acao'] = ementa2action[normalize_text(row['ementa'])]

len(metadata)


# In[14]:


from sentence_transformers import SentenceTransformer
import numpy as np

actions = [row['acao'] for row in metadata]
model = SentenceTransformer("embaas/sentence-transformers-multilingual-e5-base")

embeddings = model.encode(
    actions,
    batch_size=256,
    show_progress_bar=True,
    normalize_embeddings=True  # muito importante p/ usar distância cosseno
)

embeddings = np.asarray(embeddings, dtype=np.float16)
print(embeddings.shape)  # (250000, 768)


# In[15]:


for idx, row in enumerate(metadata):
  row['embedding'] = embeddings[idx]


# In[16]:


with open("/content/dataset.npy", "wb") as f:
  np.save(f, metadata)


# In[17]:


get_ipython().system('cp "/content/dataset.npy" "/content/drive/MyDrive/FAPESP/City Manager/dataset.npy"')

