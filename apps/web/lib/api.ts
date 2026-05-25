import { NextResponse } from 'next/server';

export function apiError(error: string, code: string, status: number, details?: unknown) {
  return NextResponse.json({ error, code, details }, { status });
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
