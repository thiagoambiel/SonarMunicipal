#!/usr/bin/env python
# coding: utf-8

# In[ ]:


get_ipython().system('pip install evaluate sacrebleu bert_score')


# In[ ]:


get_ipython().system('pip install -U bitsandbytes')


# In[1]:


import pandas as pd
import os, json, math, random, re, html
from dataclasses import dataclass
from typing import Dict, List, Optional, Union

import datasets
from datasets import load_dataset, DatasetDict
import evaluate
import numpy as np
import torch
from transformers import (
    AutoTokenizer,
    AutoConfig,
    AutoModelForSeq2SeqLM,
    DataCollatorForSeq2Seq,
    Seq2SeqTrainingArguments,
    Seq2SeqTrainer,
    set_seed,
)

# PEFT/LoRA opcionais
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

torch.cuda.is_available(), torch.cuda.device_count(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu"


# In[2]:


# ===== CONFIGURAÇÕES EDITÁVEIS =====
PROJECT_NAME    = "ptt5v2-pl-text2action"
DATA_PATH       = "/kaggle/input/pl-to-action-dataset/pl_action_recommendations_all.jsonl"
OUTPUT_DIR      = "./outputs_ptt5v2"              # onde salvar checkpoints
EVAL_SPLIT      = 0.1                              # fração para validação
MAX_INPUT_LEN   = 256
MAX_TARGET_LEN  = 32

# Escolha do modelo base (PTT5-v2). Alguns checkpoints comuns:
# - "unicamp-dl/ptt5-base-portuguese-vocab"  (mais conhecido)
# - "pierreguillou/ptt5-base-portuguese-vocab" (espelho)
# Se você já tem um "PTT5-v2" específico, coloque o ID abaixo.
MODEL_ID        = "unicamp-dl/ptt5-base-portuguese-vocab"

# Hiperparâmetros sugeridos (ajuste conforme sua GPU)
SEED            = 42
BATCH_SIZE      = 16
GRAD_ACC_STEPS  = 2
LR              = 3e-4
EPOCHS          = 30
FP16            = torch.cuda.is_available()
BF16            = False   # Ative se a sua GPU suportar (A100/A800/H100/RTX 5xxx)
WARMUP_RATIO    = 0.03
WEIGHT_DECAY    = 0.01

# QLoRA (8-bit/4-bit) opções
USE_4BIT        = True    # True = quantização 4-bit (menos VRAM); False = 8-bit
LORA_R          = 16
LORA_ALPHA      = 32
LORA_DROPOUT    = 0.05

# Template simples de instrução (pode adaptar)
INSTR_PROMPT = (
  "Converta a ementa de projeto de lei em uma recomendação de ação imperativa, curta e fiel ao texto; "
  "{texto}\nSaída:"
)


# In[ ]:


INSTR_PROMPT = (
    "Dada a ementa de um projeto de lei em linguagem jurídica, gere uma única recomendação de ação operacional em português no formato [Verbo no infinitivo] + [objeto] + [complementos essenciais], por exemplo: “Implantar estufas com hortas produzidas com garrafas PET nas escolas municipais.” Remova toda a “casca jurídica” que não muda a ação (“Dispõe sobre…”, “Institui…”, “Cria…”, “Autoriza o Poder Executivo a…”, “e dá outras providências”, referências a leis, artigos e fórmulas padrão), preservando apenas o conteúdo material da política: o que passa a existir, ser feito, fornecido ou garantido. Identifique o núcleo da ementa (substantivos de ação como criação, implantação, emissão, fornecimento, atendimento etc.) e transforme-o em verbo no infinitivo impessoal (criar, implantar, emitir, fornecer, atender etc.), seguido do objeto principal e dos complementos realmente necessários (público-alvo e/ou local, quando essenciais para entender a execução). Quando a ementa criar um equipamento, serviço, órgão ou programa (inclusive digitais), a ação deve ser “criar” ou “implantar” esse instrumento; quando houver estrutura do tipo “Programa/Projeto X para [substantivo de ação]…”, priorize o serviço final (ex.: “emissão de registro de nascimento” → “Emitir registros de nascimento dentro das maternidades públicas”) e não o programa em si. Neutralize nomes fantasia de programas (“Segurinho”, “Saúde ao Alcance” etc.), descrevendo-os de forma genérica pelo tipo de programa/serviço, a menos de datas comemorativas, prêmios, selos ou eventos culturais, em que o nome é o próprio objeto e deve ser mantido. Elimine justificativas, fundamentos legais e detalhes que não alteram a execução, produzindo sempre uma frase imperativa, curta e operacional, algo que caiba em um backlog de políticas públicas."
    "\n\nEmenta: {texto}\n\nAção: "
)

print(INSTR_PROMPT)


# In[3]:


def normalize_text(s: str) -> str:
    # Remove entidades HTML, que aparecem com frequência no seu exemplo (&#8211;, &#8220; etc.)
    s = html.unescape(s)
    # Quebras de linha e espaços
    s = s.replace("\r", " ").replace("\n", " ").strip()
    # Espacos múltiplos
    s = re.sub(r"\s+", " ", s)
    return s

data = pd.read_csv("/kaggle/input/ementa2action-dataset/ementa2action_gpt.csv")
data = data.iloc[:, 1:]
data = data.rename(columns={"ementa": "input", "acao": "output"})
raw = list(data.T.to_dict().values())

for r in raw:
    r["input"]  = normalize_text(r["input"].lower())
    r["output"] = normalize_text(r["output"])

random.seed(SEED)
random.shuffle(raw)

n = len(raw)
val_n = max(1, int(n * EVAL_SPLIT))
val_data = raw[:val_n]
train_data = raw[val_n:]

dataset = DatasetDict({
    "train": datasets.Dataset.from_list(train_data),
    "validation": datasets.Dataset.from_list(val_data)
})

dataset


# In[4]:


tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, use_fast=True)

def build_source(texto: str) -> str:
    return INSTR_PROMPT.format(texto=texto)

def preprocess_batch(batch):
    # batch["input"] é uma lista de strings
    sources = [build_source(t) for t in batch["input"]]
    targets = batch["output"]

    model_inputs = tokenizer(
        sources,
        max_length=MAX_INPUT_LEN,
        truncation=True,
        padding=False,
    )
    # use o argumento oficial para targets
    labels = tokenizer(
        text_target=targets,
        max_length=MAX_TARGET_LEN,
        truncation=True,
        padding=False,
    )
    model_inputs["labels"] = labels["input_ids"]
    return model_inputs

tokenized = dataset.map(
    preprocess_batch,
    batched=True,
    remove_columns=dataset["train"].column_names
)

tokenized


# In[5]:


bertscore = evaluate.load("bertscore")

def postprocess_text(preds, labels):
    preds = [p.strip() for p in preds]
    labels = [[l.strip()] for l in labels]
    return preds, labels

def compute_metrics(eval_pred):
    preds, labels = eval_pred

    # Substituir -100 por pad_token_id para decodificação
    preds = np.where(preds != -100, preds, tokenizer.pad_token_id)
    labels = np.where(labels != -100, labels, tokenizer.pad_token_id)

    decoded_preds = tokenizer.batch_decode(preds, skip_special_tokens=True)
    decoded_labels = tokenizer.batch_decode(labels, skip_special_tokens=True)
    decoded_preds, decoded_labels = postprocess_text(decoded_preds, decoded_labels)

    # BERTScore entre saída do modelo (predictions) e texto alvo (references)
    bert_result = bertscore.compute(
        predictions=decoded_preds,
        references=[l[0] for l in decoded_labels],
        lang="pt",          # importante para português
        rescale_with_baseline=True
    )

    precision = float(np.mean(bert_result["precision"]))
    recall    = float(np.mean(bert_result["recall"]))
    f1        = float(np.mean(bert_result["f1"]))

    return {
        "bertscore_precision": round(precision, 4),
        "bertscore_recall": round(recall, 4),
        "bertscore_f1": round(f1, 4),   # normalmente essa é a principal
    }


# In[6]:


def load_lora_model():
    # Quantização 4-bit/8-bit (QLoRA)
    kwargs = dict(
        device_map="auto",
        load_in_4bit=USE_4BIT,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16 if BF16 else torch.float16,
    ) if torch.cuda.is_available() else {}

    base = AutoModelForSeq2SeqLM.from_pretrained(MODEL_ID, **kwargs)
    base = prepare_model_for_kbit_training(base)

    lora_cfg = LoraConfig(
        r=LORA_R,
        lora_alpha=LORA_ALPHA,
        lora_dropout=LORA_DROPOUT,
        target_modules=["q", "v", "k", "o", "wi", "wo"],  # nomes comuns em T5
        bias="none",
        task_type="SEQ_2_SEQ_LM",
    )
    peft_model = get_peft_model(base, lora_cfg)
    peft_model.print_trainable_parameters()
    return peft_model

model = load_lora_model()


# In[7]:


data_collator = DataCollatorForSeq2Seq(tokenizer=tokenizer, model=model)

training_args = Seq2SeqTrainingArguments(
    output_dir=OUTPUT_DIR,
    eval_strategy="steps",
    eval_steps=50,
    logging_steps=50,
    save_steps=50,
    save_total_limit=2,
    load_best_model_at_end=True,
    metric_for_best_model="eval_bertscore_f1",
    greater_is_better=True,

    per_device_train_batch_size=BATCH_SIZE,
    per_device_eval_batch_size=BATCH_SIZE,
    gradient_accumulation_steps=GRAD_ACC_STEPS,
    learning_rate=LR,
    num_train_epochs=EPOCHS,
    weight_decay=WEIGHT_DECAY,
    warmup_ratio=WARMUP_RATIO,
    lr_scheduler_type="cosine",
    gradient_checkpointing=True,

    fp16=FP16 and not BF16,
    bf16=BF16,

    predict_with_generate=True,
    generation_max_length=MAX_TARGET_LEN,
    generation_num_beams=4,

    seed=SEED,
    report_to=["none"],  # mude para ["tensorboard"] se quiser
)
set_seed(SEED)


# In[8]:


trainer = Seq2SeqTrainer(
    model=model,
    args=training_args,
    data_collator=data_collator,
    train_dataset=tokenized["train"],
    eval_dataset=tokenized["validation"],
    tokenizer=tokenizer,
    compute_metrics=compute_metrics,
)

train_result = trainer.train()


# In[9]:


metrics = train_result.metrics
metrics["train_samples"] = len(tokenized["train"])

trainer.log_metrics("train", metrics)
trainer.save_metrics("train", metrics)
trainer.save_state()

# Avaliar no validation
eval_metrics = trainer.evaluate()
eval_metrics["eval_samples"] = len(tokenized["validation"])
trainer.log_metrics("eval", eval_metrics)
trainer.save_metrics("eval", eval_metrics)

# Salvar (se LoRA, salva adaptadores; se FT, salva modelo completo)
trainer.save_model(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)


# In[10]:


def predict(texto: str, max_new_tokens=64, num_beams=4):
    inp = INSTR_PROMPT.format(texto=normalize_text(texto.lower()))
    tokens = tokenizer(inp, return_tensors="pt", truncation=True, max_length=MAX_INPUT_LEN).to(model.device)
    
    with torch.no_grad():
        out = model.generate(
            **tokens,
            max_new_tokens=max_new_tokens,
            num_beams=num_beams,
            length_penalty=0.9,
            early_stopping=True,
        )
        
    return tokenizer.decode(out[0], skip_special_tokens=True).strip()

exemplo = 'INSTITUI O PROGRAMA “VOLTAR A ESTUDAR MUDA TUDO”, COM O OBJETIVO DE PROMOVER CAMPANHAS DE INCENTIVO À MATRÍCULA E VALORIZAÇÃO DA EDUCAÇÃO DE JOVENS E ADULTOS (EJA), NO ÂMBITO DO MUNICÍPIO DE NATAL/RN.'
# GPT Output: Promover campanhas de incentivo à matrícula e valorização da Educação de Jovens e Adultos (EJA) no município de Natal.
print(predict(exemplo))


# In[11]:


from peft import PeftModel

fused_dir = OUTPUT_DIR + "-merged"

base_model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_ID, torch_dtype=torch.float16 if FP16 else torch.float32)
peft_loaded = PeftModel.from_pretrained(base_model, OUTPUT_DIR)

merged = peft_loaded.merge_and_unload()
merged.save_pretrained(fused_dir)
tokenizer.save_pretrained(fused_dir)

print(f"Modelo fundido salvo em: {fused_dir}")


# In[12]:


from huggingface_hub import login

login()


# In[13]:


from huggingface_hub import HfApi

api = HfApi()

MODEL_REPO = "thiagoambiel/ptt5v2-pl-text2action"
api.create_repo(MODEL_REPO, repo_type="model", private=True, exist_ok=True)

MODEL_REPO


# In[14]:


from huggingface_hub import upload_folder

upload_folder(
    folder_path="/kaggle/working/outputs_ptt5v2-merged",
    repo_id=MODEL_REPO,
    repo_type="model",
    commit_message="PTT5-v2 LoRA com BERTScore 0.84"
)

