import { NextResponse } from "next/server";

import { listIndicatorSpecs } from "@/lib/indicators";

export async function GET() {
  return NextResponse.json(listIndicatorSpecs());
}
