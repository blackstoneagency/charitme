import { describe, expect, it } from 'vitest';
import { GET } from '../app/media/subject/route';

describe('subject image route', () => {
  it('renders a cacheable first-party PNG for validated campaign context', async () => {
    const response = await GET(new Request('https://www.charitme.com/media/subject?category=Education&key=school-library'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
    expect(response.headers.get('cache-control')).toContain('immutable');
  });

  it('rejects unsafe or missing image parameters with the standard error shape', async () => {
    const response = await GET(new Request('https://www.charitme.com/media/subject?category=%3Cscript%3E'));
    const body = await response.json() as { error?: string; code?: string };

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: 'Invalid subject image parameters',
      code: 'INVALID_IMAGE_PARAMETERS',
    });
  });
});
