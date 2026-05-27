import { Directory, File, Paths } from 'expo-file-system';

const PROFILE_PHOTOS_DIRECTORY_NAME = 'profile-photos';
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);

interface SaveProfilePhotoCopyInput {
  fileName?: string | null;
  mimeType?: string | null;
  sourceUri: string;
}

function getExtensionFromFileName(fileName: string | null | undefined): string {
  const match = fileName?.match(/\.[A-Za-z0-9]+$/);

  return match ? match[0].toLowerCase() : '';
}

function getExtensionFromMimeType(mimeType: string | null | undefined): string {
  switch (mimeType) {
    case 'image/heic':
      return '.heic';
    case 'image/heif':
      return '.heif';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '.jpg';
  }
}

function getSourceExtension(sourceFile: File): string {
  try {
    return sourceFile.extension.toLowerCase();
  } catch {
    return '';
  }
}

function normalizeImageExtension(
  sourceFile: File,
  fileName: string | null | undefined,
  mimeType: string | null | undefined,
): string {
  const candidates = [
    getSourceExtension(sourceFile),
    getExtensionFromFileName(fileName),
    getExtensionFromMimeType(mimeType),
  ];

  return candidates.find((extension) => SUPPORTED_IMAGE_EXTENSIONS.has(extension)) ?? '.jpg';
}

function createProfilePhotoFileName(extension: string): string {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).slice(2, 8);

  return `child-profile-${timestamp}-${randomPart}${extension}`;
}

function isManagedProfilePhotoUri(photoUri: string): boolean {
  return photoUri.includes(`/${PROFILE_PHOTOS_DIRECTORY_NAME}/`);
}

export async function saveProfilePhotoCopy({
  fileName,
  mimeType,
  sourceUri,
}: SaveProfilePhotoCopyInput): Promise<string> {
  const directory = new Directory(Paths.document, PROFILE_PHOTOS_DIRECTORY_NAME);

  directory.create({ idempotent: true, intermediates: true });

  const sourceFile = new File(sourceUri);
  const extension = normalizeImageExtension(sourceFile, fileName, mimeType);
  const destinationFile = new File(directory, createProfilePhotoFileName(extension));

  await sourceFile.copy(destinationFile);

  return destinationFile.uri;
}

export function deleteProfilePhotoCopy(photoUri: string | null): void {
  if (!photoUri || !isManagedProfilePhotoUri(photoUri)) {
    return;
  }

  try {
    const photoFile = new File(photoUri);

    if (photoFile.exists) {
      photoFile.delete();
    }
  } catch {
    // A stale local photo should not block profile updates.
  }
}
