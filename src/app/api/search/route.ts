import { NextRequest, NextResponse } from "next/server";

import { searchProjects } from "@/lib/semantic-search";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let query = "";
  let topK: number | undefined;

  try {
    const body = await request.json();
    if (typeof body?.query === "string") {
      query = body.query;
    }
    if (typeof body?.top_k === "number") {
      topK = body.top_k;
    } else if (typeof body?.topK === "number") {
      topK = body.topK;
    }
  } catch {
    // corpo inválido -> tratado abaixo
  }

  if (!query.trim()) {
    return NextResponse.json({ detail: "Informe a query para buscar." }, { status: 400 });
  }

  const limit = Math.max(1, Math.min(topK ?? 50, 500));

  try {
    const results = await searchProjects({ query, limit });
    return NextResponse.json({
      query,
      top_k: limit,
      returned: results.length,
      results,
    });
  } catch (error) {
    console.error("Erro ao buscar no Qdrant:", error);
    return NextResponse.json(
      { detail: "Falha ao buscar no Qdrant ou gerar embeddings. Revise as variáveis de ambiente." },
      { status: 500 },
    );
  }
}
