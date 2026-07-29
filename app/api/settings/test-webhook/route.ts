import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { testManifestWebhookUrl } from '@/lib/domain-profile/manifest-webhook';
import { runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type TestWebhookBody = {
  url?: string;
};

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as TestWebhookBody;
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json(
        { success: false, message: 'Webhook URL is required.' },
        { status: 400 }
      );
    }

    return await runWithAuthenticatedTenantScope(async () => {
      const result = await testManifestWebhookUrl(url);

      if (result.ok) {
        return NextResponse.json({
          success: true,
          message: `Webhook test delivered (HTTP ${result.statusCode ?? 200}).`,
          statusCode: result.statusCode,
        });
      }

      return NextResponse.json({
        success: false,
        message: result.error ?? 'Webhook test failed.',
        statusCode: result.statusCode,
      });
    });
  } catch (error) {
    console.error('[settings/test-webhook] POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Webhook test failed.' },
      { status: 500 }
    );
  }
}
