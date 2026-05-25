import { NextResponse } from 'next/server';
import { getFeatureCoverage, PLATFORM_MODULES } from '../../../lib/feature-catalog';

export async function GET() {
  return NextResponse.json({
    coverage: getFeatureCoverage(),
    modules: PLATFORM_MODULES,
  });
}
