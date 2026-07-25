import { headers } from 'next/headers';

export default async function JsonLd({ json }: { json: string }): Promise<React.ReactElement> {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
