#!/usr/bin/env python
# coding: utf-8

# In[1]:


from huggingface_hub import login

login()


# In[2]:


import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

MODEL_ID = "thiagoambiel/ptt5v2-pl-text2action"

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForSeq2SeqLM.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
    device_map="auto" if torch.cuda.is_available() else None
)


# In[4]:


INSTR_PROMPT = (
  "Converta a ementa de projeto de lei em uma recomendação de ação imperativa, curta e fiel ao texto; "
  "{texto}\nSaída:"
)

def predict(texto, 
            max_new_tokens: int = 64,
            instr=INSTR_PROMPT):
    prompt = instr.format(texto=texto.lower())
    tokens = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=256).to(model.device)
    
    with torch.no_grad():
        out = model.generate(
            **tokens,
            max_new_tokens=max_new_tokens,
            num_beams=4,
            length_penalty=0.8,
            early_stopping=True
        )
        
    return tokenizer.decode(out[0], skip_special_tokens=True).strip()

print(predict("DISPÕE SOBRE A IMPLANTAÇÃO DE ESTUFAS COM HORTAS PRODUZIDAS COM GARRAFAS PET NAS ESCOLAS MUNICIPAIS DE MARABÁ E DA OUTRAS PROVIDÊNCIAS."))
print(predict("CONCEDE MEIA-ENTRADA EM EVENTO CULTURAL E ARTÍSTICO PARA DOADOR REGULAR DE SANGUE, NO ÂMBITO DO MUNICÍPIO DE MARABÁ E DÁ OUTRAS PROVIDÊNCIAS."))
print(predict("&#8220;DISPÕE SOBRE A IMPLANTAÇÃO DE SANITÁRIOS PÚBLICOS NAS PRAÇAS E ÁREAS DE LAZER&#8221;."))


# ### Inferência no Dataset Completo de PLs

# In[5]:


# Caminhos de entrada/saída
INPUT_JSONL  = "/kaggle/input/projetos-de-lei-de-municpios-brasileiros/pl.jsonl"
OUTPUT_JSONL = "/kaggle/working/pl_actions.jsonl"
CHECKPOINT_PATH = OUTPUT_JSONL + ".ckpt.json"  # checkpoint por flush (opcional)

# Geração
BATCH_SIZE       = 32
MAX_INPUT_LEN    = 256
MAX_NEW_TOKENS   = 64
NUM_BEAMS        = 4
LENGTH_PENALTY   = 0.8
PAD_TO_MULTIPLE  = 8

# Controle de execução
RESUME = False    # True = mantém OUTPUT_JSONL existente e continua; False = sobrescreve (apaga)

# Template de instrução
INSTR_PROMPT = (
  "Converta a ementa de projeto de lei em uma recomendação de ação imperativa, curta e fiel ao texto; "
  "{texto}\nSaída:"
)


# In[6]:


import sys, re, html
from typing import Iterable, Dict, Any, List, Optional

def normalize_text(s: Optional[str]) -> str:
    if s is None:
        return ""
    s = html.unescape(s)
    s = s.replace("\r", " ").replace("\n", " ").strip()
    s = re.sub(r"\s+", " ", s)
    return s

def read_jsonl(path: str) -> Iterable[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        for ln, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except Exception as e:
                sys.stderr.write(f"[WARN] Linha {ln} ignorada (JSON inválido): {e}\n")

def append_jsonl(path: str, records: List[Dict[str, Any]]):
    """Append seguro de um lote; força flush/fsync para garantir persistência por flush."""
    if not records:
        return
    with open(path, "a", encoding="utf-8") as f:
        for obj in records:
            f.write(json.dumps(obj, ensure_ascii=False) + "\n")
        f.flush()
        os.fsync(f.fileno())

def build_prompts(ementas: List[str], template: str) -> List[str]:
    return [template.format(texto=normalize_text(e.lower())) for e in ementas]

def load_checkpoint(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        return {"flush_idx": 0, "processed": 0}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"flush_idx": 0, "processed": 0}

def save_checkpoint(path: str, data: Dict[str, Any]):
    tmp = path + ".part"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)  # atomic rename


# In[7]:


import logging, time
from contextlib import contextmanager

# Config de logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("pl2acao")

@contextmanager
def timed(msg: str):
    t0 = time.time()
    log.info(f"⏳ {msg}...")
    try:
        yield
    finally:
        dt = time.time() - t0
        log.info(f"✅ {msg} em {dt:.2f}s")


# In[8]:


from math import ceil

@torch.inference_mode()
def generate_batch(
    model,
    tokenizer,
    prompts: List[str],
    device,
    max_input_len: int = 256,
    max_new_tokens: int = 64,
    num_beams: int = 4,
    length_penalty: float = 0.8,
    early_stopping: bool = True,
    pad_to_multiple_of: int = 8,
    batch_tag: str = "",
) -> List[str]:
    """Gera saídas para 'prompts' (uma passada), com logs básicos."""
    # Autocast automático se o modelo estiver em fp16/bf16
    amp_dtype = None
    if torch.cuda.is_available():
        if any(p.dtype == torch.bfloat16 for p in model.parameters()):
            amp_dtype = torch.bfloat16
        elif any(p.dtype == torch.float16 for p in model.parameters()):
            amp_dtype = torch.float16

    enc = tokenizer(
        prompts,
        truncation=True,
        max_length=max_input_len,
        padding=True,
        pad_to_multiple_of=pad_to_multiple_of,
        return_tensors="pt",
    ).to(device)

    ctx = torch.autocast(device_type="cuda", dtype=amp_dtype) if (amp_dtype is not None) else torch.nullcontext()
    with ctx:
        with timed(f"Geração {batch_tag} (n={enc['input_ids'].shape[0]})"):
            out = model.generate(
                **enc,
                max_new_tokens=max_new_tokens,
                num_beams=num_beams,
                length_penalty=length_penalty,
                early_stopping=early_stopping,
            )
    decoded = tokenizer.batch_decode(out, skip_special_tokens=True)
    return [d.strip() for d in decoded]


# In[ ]:


import os
import json
import numpy as np
from math import ceil
from tqdm.auto import tqdm

# Estado/estatísticas
processed = 0
skipped_no_ementa = 0
skipped_empty_ementa = 0
buffer_rows = []

# Preparar OUTPUT_JSONL (sobrescrever ou retomar)
if not RESUME and os.path.exists(OUTPUT_JSONL):
    log.info(f"🧹 RESUME=False → apagando saída anterior: {OUTPUT_JSONL}")
    os.remove(OUTPUT_JSONL)
if not RESUME and os.path.exists(CHECKPOINT_PATH):
    os.remove(CHECKPOINT_PATH)

ckpt = load_checkpoint(CHECKPOINT_PATH)
flush_idx = ckpt.get("flush_idx", 0)
processed = ckpt.get("processed", 0)
log.info(f"📌 Checkpoint carregado: flush_idx={flush_idx}, processed={processed}")

def _prompt_stats(prompts: List[str]) -> str:
    lens = list(map(len, prompts))
    return f"min={min(lens)}, p50={int(np.percentile(lens,50))}, p90={int(np.percentile(lens,90))}, max={max(lens)}"

def flush_buffer():
    """Gera, grava no disco (append) e atualiza checkpoint por flush."""
    global buffer_rows, processed, flush_idx
    if not buffer_rows:
        return

    ementas_raw = [row.get("ementa", "") for row in buffer_rows]
    prompts = build_prompts(ementas_raw, INSTR_PROMPT)

    flush_idx += 1
    log.info(f"🧪 Flush #{flush_idx}: {len(buffer_rows)} itens | prompt len {_prompt_stats(prompts)}")

    results = []
    total = len(prompts)
    n_batches = ceil(total / BATCH_SIZE)

    with tqdm(total=total, desc=f"Flush {flush_idx} (batches={n_batches})", unit="txt") as pbar:
        for i in range(0, total, BATCH_SIZE):
            sub_prompts = prompts[i:i+BATCH_SIZE]
            try:
                gen = generate_batch(
                    model, tokenizer, sub_prompts, model.device,
                    max_input_len=MAX_INPUT_LEN,
                    max_new_tokens=MAX_NEW_TOKENS,
                    num_beams=NUM_BEAMS,
                    length_penalty=LENGTH_PENALTY,
                    pad_to_multiple_of=PAD_TO_MULTIPLE,
                    batch_tag=f"flush#{flush_idx}-batch{i//BATCH_SIZE+1}",
                )
            except RuntimeError as e:
                log.error(f"❌ Erro no batch {i//BATCH_SIZE+1}: {e}. Retentativa com MAX_INPUT_LEN reduzido...")
                gen = generate_batch(
                    model, tokenizer, sub_prompts, model.device,
                    max_input_len=max(128, MAX_INPUT_LEN//2),
                    max_new_tokens=MAX_NEW_TOKENS,
                    num_beams=NUM_BEAMS,
                    length_penalty=LENGTH_PENALTY,
                    pad_to_multiple_of=PAD_TO_MULTIPLE,
                    batch_tag=f"flush#{flush_idx}-retry{i//BATCH_SIZE+1}",
                )
            results.extend(gen)
            pbar.update(len(sub_prompts))

    # monta registros deste flush e salva em append
    out_records = []
    for em, acao in zip(ementas_raw, results):
        out_records.append({"ementa": normalize_text(em), "acao": acao})

    with timed(f"Gravar {len(out_records)} linhas no disco (flush #{flush_idx})"):
        append_jsonl(OUTPUT_JSONL, out_records)

    processed += len(buffer_rows)
    buffer_rows.clear()

    # checkpoint
    save_checkpoint(CHECKPOINT_PATH, {"flush_idx": flush_idx, "processed": processed})
    size_mb = os.path.getsize(OUTPUT_JSONL) / (1024 * 1024)
    log.info(f"📦 Flush #{flush_idx} concluído | Total processado: {processed} | Arquivo: {OUTPUT_JSONL} ({size_mb:.2f} MB)")

# 1) Pré-scan opcional para estimar total
try:
    total_lines = sum(1 for _ in read_jsonl(INPUT_JSONL))
except Exception:
    total_lines = None

# 2) Leitura + processamento incremental com salvamento por flush
log.info(f"▶️ Iniciando | arquivo={INPUT_JSONL} | total_estimado={total_lines or 'desconhecido'} | RESUME={RESUME}")
with timed("Processo completo"):
    if total_lines:
        pbar_all = tqdm(total=total_lines, desc="Linhas lidas", unit="lin")
    else:
        pbar_all = None

    idx = 0
    for row in read_jsonl(INPUT_JSONL):
        idx += 1
        if "ementa" not in row:
            skipped_no_ementa += 1
            if pbar_all: pbar_all.update(1)
            continue
        em = normalize_text(row.get("ementa", ""))
        if not em:
            skipped_empty_ementa += 1
            if pbar_all: pbar_all.update(1)
            continue

        buffer_rows.append({"ementa": em})

        if len(buffer_rows) >= 2048:
            flush_buffer()

        if pbar_all: pbar_all.update(1)

    # flush final
    flush_buffer()
    if pbar_all: pbar_all.close()

log.info("📊 Resumo:")
log.info(f"- Linhas processadas       : {processed}")
log.info(f"- Ementas ausentes (skip)  : {skipped_no_ementa}")
log.info(f"- Ementas vazias (skip)    : {skipped_empty_ementa}")
log.info(f"- Arquivo de saída         : {OUTPUT_JSONL}")
log.info(f"- Checkpoint               : {CHECKPOINT_PATH}")

