import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import {
  deleteUserAvatar,
  isManagedAvatarUrl,
  saveUserAvatar,
} from '@/lib/profile/avatar';

async function getSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return null;
  }

  return session.user;
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('avatar');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    }

    const imageUrl = await saveUserAvatar(user.id, file);

    await getPrisma().user.update({
      where: { id: user.id },
      data: { image: imageUrl },
    });

    return NextResponse.json({ imageUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload profile photo.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    if (isManagedAvatarUrl(user.image)) {
      await deleteUserAvatar(user.id);
    }

    await getPrisma().user.update({
      where: { id: user.id },
      data: { image: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove profile photo.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
