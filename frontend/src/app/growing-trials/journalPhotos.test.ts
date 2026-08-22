import {
  PhotoUploadError,
  maxPhotoBytes,
  uploadJournalPhoto,
  validatePhotoSelection,
} from "./journalPhotos";

class EventTargetMock {
  listeners = new Map<string, ((event: ProgressEvent) => void)[]>();
  addEventListener(name: string, listener: (event: ProgressEvent) => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }
  emit(name: string, event = {} as ProgressEvent) {
    for (const listener of this.listeners.get(name) ?? []) listener(event);
  }
}

class XMLHttpRequestMock extends EventTargetMock {
  static latest: XMLHttpRequestMock;
  upload = new EventTargetMock();
  response: unknown = null;
  responseType = "";
  status = 0;
  method = "";
  url = "";
  body: FormData | null = null;
  constructor() {
    super();
    XMLHttpRequestMock.latest = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  send(body: FormData) {
    this.body = body;
  }
  abort() {
    this.emit("abort");
  }
}

const photo = {
  id: "4",
  originalFilename: "leaf.jpg",
  contentType: "image/jpeg",
  fileSize: 123,
  width: 640,
  height: 480,
  position: 2,
  thumbnailUrl: "/media/thumb.webp",
  fullSizeUrl: "/media/full.jpg",
  createdAt: "2026-08-20T12:00:00Z",
  updatedAt: "2026-08-20T12:00:00Z",
};

describe("journal photo validation", () => {
  it("validates capacity, MIME type, and the 10 MB boundary", () => {
    const errors = validatePhotoSelection(
      [
        new File(["svg"], "vector.svg", { type: "image/svg+xml" }),
        new File([new Uint8Array(maxPhotoBytes + 1)], "large.jpg", {
          type: "image/jpeg",
        }),
      ],
      4,
    );
    expect(errors.map((error) => error.message)).toEqual([
      "Select no more than 1 additional photo.",
      "Choose a JPEG, PNG, or WebP image.",
      "Photo must be 10 MB or smaller.",
    ]);
    expect(
      validatePhotoSelection(
        [new File(["image"], "leaf.webp", { type: "image/webp" })],
        4,
      ),
    ).toEqual([]);
  });
});

describe("uploadJournalPhoto", () => {
  beforeEach(() => {
    Object.defineProperty(global, "XMLHttpRequest", {
      configurable: true,
      value: XMLHttpRequestMock,
    });
  });

  it("sends the multipart contract and reports determinate progress", async () => {
    const file = new File(["image"], "leaf.jpg", { type: "image/jpeg" });
    const onProgress = jest.fn();
    const result = uploadJournalPhoto(
      "event/2",
      file,
      "upload-1",
      3,
      onProgress,
    );
    const request = XMLHttpRequestMock.latest;

    expect(request.method).toBe("POST");
    expect(request.url).toBe("/api/journal-events/event%2F2/photos/");
    expect(request.body?.get("photo")).toBe(file);
    expect(request.body?.get("clientUploadId")).toBe("upload-1");
    expect(request.body?.get("position")).toBe("3");
    request.upload.emit("progress", {
      lengthComputable: true,
      loaded: 5,
      total: 10,
    } as ProgressEvent);
    request.status = 201;
    request.response = { photo };
    request.emit("load");

    await expect(result).resolves.toEqual(photo);
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(onProgress).toHaveBeenLastCalledWith(100);
  });

  it("preserves stable API error details", async () => {
    const result = uploadJournalPhoto(
      "2",
      new File(["image"], "leaf.jpg", { type: "image/jpeg" }),
      "same-id",
      0,
      jest.fn(),
    );
    const request = XMLHttpRequestMock.latest;
    request.status = 409;
    request.response = {
      error: { code: "PHOTO_POSITION_CONFLICT", message: "Position used" },
    };
    request.emit("load");

    await expect(result).rejects.toEqual(
      expect.objectContaining<Partial<PhotoUploadError>>({
        code: "PHOTO_POSITION_CONFLICT",
        message: "Position used",
        status: 409,
      }),
    );
  });
});
