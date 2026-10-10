import { toPng } from "html-to-image";

export async function downloadQueueStatusImage(element: HTMLElement, queueNumber: string): Promise<void> {
  const bounds = element.getBoundingClientRect();
  const queueHistory = element.querySelector<HTMLElement>(".queue-history");
  const width = Math.ceil(bounds.width);
  const height = queueHistory
    ? Math.ceil(queueHistory.getBoundingClientRect().bottom - bounds.top + 24)
    : element.scrollHeight;
  const rootStyles = getComputedStyle(document.documentElement);
  const pageBackground = getComputedStyle(document.body).backgroundColor;
  const backgroundColor = pageBackground === "rgba(0, 0, 0, 0)"
    ? rootStyles.getPropertyValue("--background").trim() || "#ffffff"
    : pageBackground;
  const dataUrl = await toPng(element, {
    width,
    height,
    backgroundColor,
    pixelRatio: 2,
    skipFonts: true,
    style: { margin: "0", width: `${width}px`, maxWidth: `${width}px`, boxSizing: "border-box" },
    filter: (node) =>
      !(node instanceof Element && node.matches(".queue-action-buttons, .last-updated, .modal-overlay")),
  });

  const safeQueueNumber = queueNumber.replace(/[^a-zA-Z0-9-]/g, "") || "OPD";
  const link = document.createElement("a");
  link.download = `บัตรคิว-${safeQueueNumber}.png`;
  link.href = dataUrl;
  link.click();
}
