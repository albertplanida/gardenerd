import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { JournalEvent } from "@/graphql/journalEvents";

import { JournalPhotoGallery } from "./JournalPhotoControls";

const event: JournalEvent = {
  id: "20",
  eventType: "WATERED",
  eventDate: "2026-08-20",
  note: "New leaves",
  photos: [
    {
      id: "1",
      originalFilename: "leaf.jpg",
      contentType: "image/jpeg",
      fileSize: 123,
      width: 640,
      height: 480,
      position: 0,
      thumbnailUrl: "/thumb.webp",
      fullSizeUrl: "/full.jpg",
      createdAt: "2026-08-20T12:00:00Z",
      updatedAt: "2026-08-20T12:00:00Z",
    },
  ],
  createdAt: "2026-08-20T12:00:00Z",
  updatedAt: "2026-08-20T12:00:00Z",
};

describe("JournalPhotoGallery", () => {
  it("opens one accessible photo, restores focus, and exposes active removal", async () => {
    const onDelete = jest.fn();
    render(
      <MantineProvider>
        <JournalPhotoGallery
          active
          deletingPhotoId={null}
          event={event}
          onDelete={onDelete}
          onImageError={jest.fn()}
        />
      </MantineProvider>,
    );
    const open = screen.getByRole("button", {
      name: "Open Watered on 2026-08-20: leaf.jpg",
    });
    fireEvent.click(open);
    const dialog = screen.getByRole("dialog", { name: "leaf.jpg" });
    expect(dialog).toBeVisible();
    expect(screen.queryByRole("button", { name: /previous|next/i })).toBeNull();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(open).toHaveFocus());

    fireEvent.click(
      screen.getByRole("button", { name: "Remove photo leaf.jpg" }),
    );
    expect(onDelete).toHaveBeenCalledWith(
      event.photos[0],
      expect.any(HTMLElement),
    );
  });

  it("keeps terminal galleries read-only and bounds URL refreshes", () => {
    const onImageError = jest.fn();
    render(
      <MantineProvider>
        <JournalPhotoGallery
          active={false}
          deletingPhotoId={null}
          event={event}
          onDelete={jest.fn()}
          onImageError={onImageError}
        />
      </MantineProvider>,
    );
    expect(screen.queryByRole("button", { name: /Remove photo/ })).toBeNull();
    const thumbnail = screen.getByAltText("Watered on 2026-08-20: leaf.jpg");
    fireEvent.error(thumbnail);
    fireEvent.error(thumbnail);
    expect(onImageError).toHaveBeenCalledTimes(1);
  });
});
