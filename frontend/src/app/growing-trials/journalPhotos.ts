import type { JournalPhoto } from "@/graphql/journalEvents";

export const acceptedPhotoTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const acceptedPhotoTypesAttribute = acceptedPhotoTypes.join(",");
export const maxJournalPhotos = 5;
export const maxPhotoBytes = 10 * 1024 * 1024;

export type PhotoSelectionError = {
  fileName?: string;
  message: string;
};

export function validatePhotoSelection(
  files: File[],
  occupied: number,
): PhotoSelectionError[] {
  const errors: PhotoSelectionError[] = [];
  if (files.length > maxJournalPhotos - occupied) {
    errors.push({
      message: `Select no more than ${maxJournalPhotos - occupied} additional photo${maxJournalPhotos - occupied === 1 ? "" : "s"}.`,
    });
  }
  for (const file of files) {
    if (
      !acceptedPhotoTypes.includes(
        file.type as (typeof acceptedPhotoTypes)[number],
      )
    ) {
      errors.push({
        fileName: file.name,
        message: "Choose a JPEG, PNG, or WebP image.",
      });
    } else if (file.size > maxPhotoBytes) {
      errors.push({
        fileName: file.name,
        message: "Photo must be 10 MB or smaller.",
      });
    }
  }
  return errors;
}

export type PhotoUploadErrorCode =
  | "JOURNAL_EVENT_NOT_FOUND"
  | "GROWING_TRIAL_NOT_ACTIVE"
  | "PHOTO_LIMIT_REACHED"
  | "PHOTO_TOO_LARGE"
  | "UNSUPPORTED_PHOTO_TYPE"
  | "INVALID_PHOTO"
  | "PHOTO_POSITION_CONFLICT"
  | "PHOTO_STORAGE_FAILED";

export class PhotoUploadError extends Error {
  constructor(
    message: string,
    readonly code: PhotoUploadErrorCode | null = null,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "PhotoUploadError";
  }
}

export function uploadJournalPhoto(
  eventId: string,
  file: File,
  clientUploadId: string,
  position: number,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
) {
  return new Promise<JournalPhoto>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(
      "POST",
      `/api/journal-events/${encodeURIComponent(eventId)}/photos/`,
    );
    request.responseType = "json";
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      const body = request.response as {
        photo?: JournalPhoto;
        error?: { code?: string; message?: string };
      } | null;
      if ((request.status === 200 || request.status === 201) && body?.photo) {
        onProgress(100);
        resolve(body.photo);
        return;
      }
      reject(
        new PhotoUploadError(
          body?.error?.message || "Photo could not be uploaded. Try again.",
          (body?.error?.code as PhotoUploadErrorCode | undefined) ?? null,
          request.status,
        ),
      );
    });
    request.addEventListener("error", () =>
      reject(new PhotoUploadError("Check your connection and try again.")),
    );
    request.addEventListener("abort", () =>
      reject(new DOMException("Upload aborted", "AbortError")),
    );
    signal?.addEventListener("abort", () => request.abort(), { once: true });

    const form = new FormData();
    form.append("photo", file);
    form.append("clientUploadId", clientUploadId);
    form.append("position", String(position));
    request.send(form);
  });
}

export function photoUploadMessage(error: unknown) {
  if (!(error instanceof PhotoUploadError)) {
    return "Photo could not be uploaded. Check your connection and try again.";
  }
  const messages: Partial<Record<PhotoUploadErrorCode, string>> = {
    GROWING_TRIAL_NOT_ACTIVE:
      "This Growing Trial is no longer active. Photos are now read-only.",
    JOURNAL_EVENT_NOT_FOUND: "This Journal Event no longer exists.",
    PHOTO_LIMIT_REACHED: "This Journal Event already has five photos.",
    PHOTO_TOO_LARGE: "Photo must be 10 MB or smaller.",
    UNSUPPORTED_PHOTO_TYPE: "Choose a JPEG, PNG, or WebP image.",
    INVALID_PHOTO: "This file could not be read as a valid image.",
    PHOTO_POSITION_CONFLICT:
      "The photo order changed. The timeline was refreshed; retry this photo.",
    PHOTO_STORAGE_FAILED: "Photo storage is unavailable. Try again later.",
  };
  return (error.code && messages[error.code]) || error.message;
}
