from typing import List

IBGE_MUN_ENDPOINT: str = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
# Nota: crt.sh não aceita uso de '%' no meio do termo como em 'sapl.%25.leg.br'.
# Usamos 'sapl.%25' e filtramos localmente por '.leg.br'.
CRT_SH_QUERY: str = "https://crt.sh/?q=sapl.%25&exclude=expired&output=json"
# Base para montar consultas particionadas e evitar 503.
CRT_SH_QUERY_BASE: str = "https://crt.sh/?exclude=expired&output=json&q="
# Partições por primeiro caractere após 'sapl.'
CRT_SH_PART_CHARS: str = "abcdefghijklmnopqrstuvwxyz"

USER_AGENT: str = "SAPL-Discovery/1.0 (+research use; contact: example@example.com)"

# Endpoints típicos do SAPL 3.x
CHECK_PATHS: List[str] = [
    "/materia/pesquisar-materia",
    "/sapl/materia/pesquisar-materia",
]

# Pistas textuais para identificar SAPL nas páginas
SAPL_MARKERS: List[str] = [
    "SAPL - Interlegis",
    "Pesquisar Matéria Legislativa",
    "Matérias Legislativas",
    "> SAPL <",
]

# Pistas em links para varredura leve
LINK_HINTS: List[str] = [
    "materia/pesquisar-materia",
    "/sapl",
    "sapl.",
]
