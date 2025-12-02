import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    hf_model: process.env.HF_MODEL_ID ?? "embaas/sentence-transformers-multilingual-e5-base",
    has_hf_token: Boolean(process.env.HF_API_TOKEN),
    qdrant_collection: process.env.QDRANT_COLLECTION ?? "projetos-de-lei",
    has_qdrant_url: Boolean(process.env.QDRANT_URL),
  });
}
