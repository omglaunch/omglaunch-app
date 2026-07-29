'use client';

import { useCallback, useRef, useState } from 'react';
import { Camera, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { authClient } from '@/lib/auth-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ProfileAvatarUploadProps = {
  name: string;
  email: string;
  initialImage: string | null;
};

function getInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export default function ProfileAvatarUpload({
  name,
  email,
  initialImage,
}: ProfileAvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImage);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const initials = getInitials(name, email);
  const isBusy = isUploading || isRemoving;

  const refreshSession = useCallback(async (nextImage: string | null) => {
    await authClient.updateUser({ image: nextImage });
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await fetch('/api/user/avatar', {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            typeof payload === 'object' && payload !== null && 'error' in payload
              ? String(payload.error)
              : 'Failed to upload profile photo.'
          );
        }

        const nextImage =
          typeof payload === 'object' && payload !== null && 'imageUrl' in payload
            ? String(payload.imageUrl)
            : null;

        if (!nextImage) {
          throw new Error('Upload succeeded but no image URL was returned.');
        }

        setImageUrl(nextImage);
        await refreshSession(nextImage);
        toast.success('Profile photo updated');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to upload profile photo.');
      } finally {
        setIsUploading(false);
        setIsDragOver(false);
      }
    },
    [refreshSession]
  );

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      await uploadFile(file);
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      if (isBusy) return;

      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      await uploadFile(file);
    },
    [isBusy, uploadFile]
  );

  const handleRemove = useCallback(async () => {
    setIsRemoving(true);
    try {
      const response = await fetch('/api/user/avatar', { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String(payload.error)
            : 'Failed to remove profile photo.'
        );
      }

      setImageUrl(null);
      await refreshSession(null);
      toast.success('Profile photo removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove profile photo.');
    } finally {
      setIsRemoving(false);
    }
  }, [refreshSession]);

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <button
        type="button"
        disabled={isBusy}
        onClick={() => inputRef.current?.click()}
        onDragOver={event => {
          event.preventDefault();
          if (!isBusy) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'group relative shrink-0 rounded-full outline-none transition',
          'focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2',
          isDragOver && 'ring-2 ring-emerald-400 ring-offset-2'
        )}
        aria-label="Change profile photo"
      >
        <Avatar className="h-20 w-20">
          {imageUrl ? <AvatarImage src={imageUrl} alt={name} /> : null}
          <AvatarFallback className="bg-emerald-600 text-lg font-semibold text-white">
            {initials}
          </AvatarFallback>
        </Avatar>

        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity',
            'group-hover:opacity-100 group-focus-visible:opacity-100',
            isBusy && 'opacity-100'
          )}
        >
          {isBusy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
        </span>
      </button>

      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">Profile photo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This photo appears in the sidebar and across your workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={() => inputRef.current?.click()}
            className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <Upload className="h-4 w-4" />
            Upload photo
          </Button>

          {imageUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isBusy}
              onClick={() => void handleRemove()}
              className="gap-2 text-muted-foreground hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">JPG, PNG, or WebP up to 2MB.</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={event => void handleFileChange(event)}
      />
    </div>
  );
}
