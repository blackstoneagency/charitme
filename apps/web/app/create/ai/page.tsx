import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Create a Campaign with AI',
  description: 'Build a complete fundraising campaign from one prompt, then review every detail before publishing.',
  alternates: { canonical: 'https://www.charitme.com/ai-campaign' },
};

export default async function LegacyCreateWithAiPage({
  searchParams,
}: {
  searchParams: Promise<{ cause?: string; ai?: string }>;
}) {
  const params = await searchParams;
  const prompt = (params.cause ?? params.ai ?? '').trim().slice(0, 4000);
  redirect(prompt
    ? `/create?path=ai&ai=${encodeURIComponent(prompt)}`
    : '/ai-campaign');
}
