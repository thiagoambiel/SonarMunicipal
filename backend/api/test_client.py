"""
Script simples para exercitar os endpoints da API.

Uso:
    python -m api.test_client --base-url http://localhost:8000 --query "Como reduzir a criminalidade?"
"""

import argparse
import json
from typing import Any, Dict, List

import httpx


def pretty_print(title: str, payload: Any) -> None:
    print(f"\n== {title}")
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Cliente simples para testar a API FastAPI.")
    parser.add_argument("--base-url", default="http://localhost:8000", help="URL base do servidor FastAPI.")
    parser.add_argument("--query", default="Como reduzir a criminalidade no município?", help="Consulta semântica.")
    parser.add_argument("--top-k", type=int, default=500, help="Número de resultados na busca.")
    parser.add_argument("--max-indexes", type=int, default=500, help="Máximo de índices para efeitos/políticas.")
    args = parser.parse_args()

    with httpx.Client(base_url=args.base_url, timeout=30.0) as client:
        health = client.get("/health")
        health.raise_for_status()
        health_data = health.json()
        pretty_print("HEALTH", health_data)

        indicators: List[str] = health_data.get("indicators", [])
        if not indicators:
            print("Nenhum indicador registrado no servidor.")
            return

        indicator = indicators[0]

        search = client.post("/search", json={"query": args.query, "top_k": args.top_k})
        search.raise_for_status()
        search_data = search.json()
        pretty_print("SEARCH", search_data)

        results: List[Dict[str, Any]] = search_data.get("results") or []
        indexes = [r.get("index") for r in results if r.get("index") is not None][: args.max_indexes]
        if not indexes:
            print("Busca não retornou índices válidos para testar indicadores.")
            return

        effects = client.post(
            "/indicator-effects",
            json={"indicator": indicator, "bill_indexes": indexes},
        )
        effects.raise_for_status()
        effects_data = effects.json()
        pretty_print("INDICATOR EFFECTS", effects_data)

        if not effects_data.get("effects"):
            print("Nenhum efeito calculado; não há dados suficientes para gerar políticas.")
            return

        policies = client.post(
            "/policies",
            json={
                "indicator": indicator,
                "bill_indexes": indexes,
                "min_group_members": 2,
                "similarity_threshold": 0.75,
            },
        )
        policies.raise_for_status()
        policies_data = policies.json()
        top_policies = (policies_data.get("policies") or [])[:10]
        truncated = {**policies_data, "policies": top_policies}
        pretty_print("POLICIES (top 10)", truncated)


if __name__ == "__main__":
    main()
