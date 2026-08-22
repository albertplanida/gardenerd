import { act, renderHook, waitFor } from "@testing-library/react";

import type { JournalEvent, JournalPhoto } from "@/graphql/journalEvents";

import { PhotoUploadError, uploadJournalPhoto } from "./journalPhotos";
import { useJournalPhotoUploads } from "./useJournalPhotoUploads";

jest.mock("./journalPhotos", () => ({
  ...jest.requireActual("./journalPhotos"),
  uploadJournalPhoto: jest.fn(),
}));

const event: JournalEvent = {
  id: "20",
  eventType: "WATERED",
  eventDate: "2026-08-20",
  note: "Leaf growth",
  photos: [],
  createdAt: "2026-08-20T12:00:00Z",
  updatedAt: "2026-08-20T12:00:00Z",
};
const photo = {
  id: "1",
  originalFilename: "first.jpg",
  contentType: "image/jpeg",
  fileSize: 5,
  width: 10,
  height: 10,
  position: 0,
  thumbnailUrl: "/thumb",
  fullSizeUrl: "/full",
  createdAt: event.createdAt,
  updatedAt: event.updatedAt,
} satisfies JournalPhoto;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("useJournalPhotoUploads", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: jest.fn(() => "blob:preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(global.crypto, "randomUUID", {
      configurable: true,
      value: jest
        .fn()
        .mockReturnValueOnce("upload-1")
        .mockReturnValueOnce("upload-2"),
    });
  });

  it("uploads one file at a time in selection order", async () => {
    const first = deferred<JournalPhoto>();
    const second = deferred<JournalPhoto>();
    jest
      .mocked(uploadJournalPhoto)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const onUploaded = jest.fn();
    const { result } = renderHook(() =>
      useJournalPhotoUploads({
        events: [event],
        onUploaded,
        onRefresh: jest.fn(),
        onLifecycleConflict: jest.fn(),
      }),
    );
    const files = [
      new File(["1"], "first.jpg", { type: "image/jpeg" }),
      new File(["2"], "second.png", { type: "image/png" }),
    ];

    act(() => expect(result.current.enqueue(event.id, files)).toEqual([]));
    await waitFor(() => expect(uploadJournalPhoto).toHaveBeenCalledTimes(1));
    expect(jest.mocked(uploadJournalPhoto).mock.calls[0].slice(1, 4)).toEqual([
      files[0],
      "upload-1",
      0,
    ]);

    await act(async () => first.resolve(photo));
    await waitFor(() => expect(uploadJournalPhoto).toHaveBeenCalledTimes(2));
    expect(jest.mocked(uploadJournalPhoto).mock.calls[1].slice(1, 4)).toEqual([
      files[1],
      "upload-2",
      1,
    ]);
    await act(async () => second.resolve({ ...photo, id: "2", position: 1 }));
    expect(onUploaded).toHaveBeenCalledTimes(2);
  });

  it("rebases a conflicted batch without reversing its selection order", async () => {
    const secondRetry = deferred<JournalPhoto>();
    const firstRetry = deferred<JournalPhoto>();
    jest
      .mocked(uploadJournalPhoto)
      .mockRejectedValueOnce(
        new PhotoUploadError(
          "Position conflict",
          "PHOTO_POSITION_CONFLICT",
          409,
        ),
      )
      .mockReturnValueOnce(secondRetry.promise)
      .mockReturnValueOnce(firstRetry.promise);
    const onRefresh = jest.fn().mockResolvedValue("applied");
    const { result } = renderHook(() =>
      useJournalPhotoUploads({
        events: [event],
        onUploaded: jest.fn(),
        onRefresh,
        onLifecycleConflict: jest.fn(),
      }),
    );
    const files = [
      new File(["1"], "first.jpg", { type: "image/jpeg" }),
      new File(["2"], "second.png", { type: "image/png" }),
    ];

    act(() => expect(result.current.enqueue(event.id, files)).toEqual([]));
    await waitFor(() =>
      expect(result.current.uploads.map(({ status }) => status)).toEqual([
        "failed",
        "failed",
      ]),
    );
    expect(uploadJournalPhoto).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    act(() => result.current.retry("upload-2"));
    await waitFor(() => expect(uploadJournalPhoto).toHaveBeenCalledTimes(2));
    expect(jest.mocked(uploadJournalPhoto).mock.calls[1].slice(2, 4)).toEqual([
      "upload-2",
      1,
    ]);
    await act(async () =>
      secondRetry.resolve({ ...photo, id: "2", position: 1 }),
    );

    act(() => result.current.retry("upload-1"));
    await waitFor(() => expect(uploadJournalPhoto).toHaveBeenCalledTimes(3));
    expect(jest.mocked(uploadJournalPhoto).mock.calls[2].slice(2, 4)).toEqual([
      "upload-1",
      0,
    ]);
    await act(async () => firstRetry.resolve(photo));
  });
});
