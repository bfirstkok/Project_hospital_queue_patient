import type { QueueData } from "@/shared/api/types";
import type { QueueProgressModel, QueueProgressState } from "./queue-progress";

const colors = {
  background: "#edf5f4",
  surface: "#ffffff",
  surfaceAlt: "#f6f9f8",
  primary: "#0d8a7d",
  primaryDark: "#086e63",
  primaryLight: "#e8f7f5",
  primaryBorder: "#b3ded8",
  ink: "#112624",
  muted: "#5f7774",
  line: "#d8e6e3",
};

function syncThemeColors() {
  const styles = getComputedStyle(document.documentElement);
  const variables = {
    background: "--background",
    surface: "--surface",
    surfaceAlt: "--surface-alt",
    primary: "--primary",
    primaryDark: "--primary-hover",
    primaryLight: "--primary-light",
    primaryBorder: "--primary-border",
    ink: "--ink",
    muted: "--muted",
    line: "--line",
  } as const;

  for (const [key, variable] of Object.entries(variables) as [keyof typeof variables, string][]) {
    const value = styles.getPropertyValue(variable).trim();
    if (value) colors[key] = value;
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const Segmenter = (Intl as unknown as {
    Segmenter?: new (locale: string, options: { granularity: "word" }) => {
      segment(value: string): Iterable<{ segment: string }>;
    };
  }).Segmenter;
  const tokens = Segmenter
    ? Array.from(new Segmenter("th", { granularity: "word" }).segment(text), ({ segment }) => segment)
    : text.split(/(\s+)/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const token of tokens) {
    const candidate = line + token;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line.trimEnd());
      line = token.trimStart();
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line.trimEnd());
  return lines.length ? lines : [""];
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  align: CanvasTextAlign = "left",
) {
  ctx.textAlign = align;
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
}

function drawProgressMarker(ctx: CanvasRenderingContext2D, x: number, y: number, state: QueueProgressState, number: number) {
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fillStyle = state === "current" ? colors.primary : state === "done" ? colors.primaryLight : colors.surface;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = state === "current" || state === "done" ? colors.primary : colors.line;
  ctx.stroke();

  ctx.fillStyle = state === "current" ? colors.surface : state === "done" ? colors.primaryDark : colors.muted;
  ctx.font = state === "current" || state === "done" ? "bold 15px Sarabun, sans-serif" : "14px Sarabun, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state === "done" ? "✓" : String(number), x, y + 1);
  ctx.textBaseline = "alphabetic";
}

function drawQueueProgress(
  ctx: CanvasRenderingContext2D,
  progress: QueueProgressModel,
  contentX: number,
  contentWidth: number,
  titleY: number,
  detailLines: string[],
) {
  ctx.textAlign = "left";
  ctx.fillStyle = colors.primaryDark;
  ctx.font = "bold 25px Sarabun, sans-serif";
  ctx.fillText(progress.heading, contentX, titleY);
  ctx.fillStyle = colors.muted;
  ctx.font = "19px Sarabun, sans-serif";
  const captionLines = wrapText(ctx, progress.caption, contentWidth);
  drawLines(ctx, captionLines, contentX, titleY + 34, 24);

  const markerY = titleY + 92;
  const startX = contentX + 18;
  const endX = contentX + contentWidth - 18;
  const stepGap = (endX - startX) / (progress.steps.length - 1);
  const trackY = markerY - 3;

  ctx.lineCap = "round";
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(startX, trackY);
  ctx.lineTo(endX, trackY);
  ctx.stroke();
  ctx.strokeStyle = colors.primary;
  ctx.beginPath();
  ctx.moveTo(startX, trackY);
  ctx.lineTo(startX + ((endX - startX) * progress.progressIndex) / (progress.steps.length - 1), trackY);
  ctx.stroke();

  progress.steps.forEach((step, index) => {
    const x = startX + stepGap * index;
    drawProgressMarker(ctx, x, markerY, step.state, index + 1);
    ctx.fillStyle = step.state === "current" || step.state === "done" ? colors.primaryDark : colors.muted;
    ctx.font = `${step.state === "current" ? "bold " : ""}15px Sarabun, sans-serif`;
    drawLines(ctx, wrapText(ctx, step.label, stepGap - 2).slice(0, 2), x, markerY + 33, 20, "center");
  });

  if (progress.needsDownstreamStatus) {
    ctx.fillStyle = colors.muted;
    ctx.font = "18px Sarabun, sans-serif";
    drawLines(ctx, detailLines, contentX, markerY + 94, 24);
  }

  return markerY + (progress.needsDownstreamStatus ? 94 + detailLines.length * 24 : 73);
}

function drawQueueDetails(ctx: CanvasRenderingContext2D, queue: Partial<QueueData>, x: number, y: number, width: number) {
  const gap = 10;
  const columnWidth = (width - gap * 2) / 3;
  const position = queue.queue_position;
  const details = [
    { label: "ลำดับของคุณ", value: Number.isInteger(position) ? `อันดับ ${position}` : "รอจัดลำดับ" },
    { label: "คิวก่อนหน้า", value: typeof position === "number" ? (position <= 1 ? "คิวถัดไป" : `อีก ${position - 1} คิว`) : "–" },
    { label: "ห้องตรวจ", value: queue.room || "กำลังจัดสรร" },
  ];

  details.forEach(({ label, value }, index) => {
    const boxX = x + index * (columnWidth + gap);
    ctx.fillStyle = colors.surfaceAlt;
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    roundedRect(ctx, boxX, y, columnWidth, 136, 18);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = colors.muted;
    ctx.font = "18px Sarabun, sans-serif";
    ctx.fillText(label, boxX + columnWidth / 2, y + 43, columnWidth - 16);
    ctx.fillStyle = colors.ink;
    ctx.font = "bold 22px Sarabun, sans-serif";
    drawLines(ctx, wrapText(ctx, value, columnWidth - 20).slice(0, 2), boxX + columnWidth / 2, y + 83, 26, "center");
  });
}

/** Save a PNG snapshot of the same live queue details shown in the queue card. */
export function generateQueueCardImage(
  queue: Partial<QueueData>,
  estimatedText: string,
  updatedAt: string,
  progress: QueueProgressModel,
): void {
  syncThemeColors();
  const canvas = document.createElement("canvas");
  const width = 900;
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = scale;

  let ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);

  const cardX = 32;
  const cardY = 32;
  const cardWidth = width - cardX * 2;
  const horizontalPadding = 54;
  const contentX = cardX + horizontalPadding;
  const contentWidth = cardWidth - horizontalPadding * 2;
  ctx.font = "18px Sarabun, sans-serif";
  const downstreamLines = progress.needsDownstreamStatus
    ? wrapText(ctx, progress.downstreamStatus, contentWidth)
    : [];
  const instruction = queue.instruction || "กรุณารอเรียกตรวจตามลำดับ";
  ctx.font = "21px Sarabun, sans-serif";
  const instructionLines = wrapText(ctx, instruction, contentWidth);
  const progressTitleY = 472;
  const timelineBottom = progressTitleY + 92 + (progress.needsDownstreamStatus ? 94 + downstreamLines.length * 24 : 73);
  const waitY = Math.max(690, timelineBottom + 24);
  const instructionTitleY = waitY + 150;
  const instructionTextY = instructionTitleY + 34;
  const detailsY = instructionTextY + instructionLines.length * 29 + 28;
  const updatedY = detailsY + 184;
  const footerY = updatedY + 42;
  const cardHeight = footerY + 48;
  const height = cardHeight + cardY * 2;

  canvas.height = height * scale;
  ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = colors.surface;
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 2;
  roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 28);
  ctx.fill();
  ctx.stroke();

  // Header and current queue number.
  ctx.beginPath();
  ctx.arc(width / 2, cardY + 74, 34, 0, Math.PI * 2);
  ctx.fillStyle = colors.primaryLight;
  ctx.fill();
  ctx.fillStyle = colors.primaryDark;
  ctx.font = "bold 38px Sarabun, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("✓", width / 2, cardY + 75);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = colors.primary;
  ctx.font = "bold 20px Sarabun, sans-serif";
  ctx.fillText("ระบบคิวผู้ป่วยนอก (OPD)", width / 2, cardY + 142);
  ctx.fillStyle = colors.ink;
  ctx.font = "bold 34px Sarabun, sans-serif";
  ctx.fillText("บัตรคิวรับบริการของคุณ", width / 2, cardY + 190);

  const numberBox = { x: width / 2 - 205, y: cardY + 214, width: 410, height: 130 };
  ctx.fillStyle = colors.primaryLight;
  ctx.strokeStyle = colors.primaryBorder;
  ctx.lineWidth = 3;
  roundedRect(ctx, numberBox.x, numberBox.y, numberBox.width, numberBox.height, 22);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colors.primaryDark;
  ctx.font = "bold 86px Sarabun, sans-serif";
  ctx.fillText(queue.queue_number || "-", width / 2, numberBox.y + 100, numberBox.width - 24);

  const statusText = queue.status_label || "กำลังโหลดสถานะ";
  ctx.font = "bold 20px Sarabun, sans-serif";
  const statusWidth = Math.min(contentWidth, Math.max(260, ctx.measureText(statusText).width + 52));
  const statusX = (width - statusWidth) / 2;
  const statusY = numberBox.y + numberBox.height + 18;
  ctx.fillStyle = colors.primaryLight;
  ctx.strokeStyle = colors.primaryBorder;
  ctx.lineWidth = 2;
  roundedRect(ctx, statusX, statusY, statusWidth, 48, 24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colors.primaryDark;
  ctx.fillText(statusText, width / 2, statusY + 31, statusWidth - 28);

  drawQueueProgress(ctx, progress, contentX, contentWidth, progressTitleY, downstreamLines);

  ctx.fillStyle = colors.primaryLight;
  ctx.strokeStyle = colors.primaryBorder;
  ctx.lineWidth = 2;
  roundedRect(ctx, contentX, waitY, contentWidth, 104, 18);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.fillStyle = colors.primaryDark;
  ctx.font = "bold 19px Sarabun, sans-serif";
  ctx.fillText("ประมาณการเวลารอตรวจ", contentX + 24, waitY + 37);
  ctx.fillStyle = colors.ink;
  ctx.font = "bold 25px Sarabun, sans-serif";
  ctx.fillText(estimatedText, contentX + 24, waitY + 73, contentWidth - 48);

  ctx.fillStyle = colors.ink;
  ctx.font = "bold 22px Sarabun, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("คำแนะนำ", contentX, instructionTitleY);
  ctx.fillStyle = colors.muted;
  ctx.font = "21px Sarabun, sans-serif";
  drawLines(ctx, instructionLines, contentX, instructionTextY, 29);

  drawQueueDetails(ctx, queue, contentX, detailsY, contentWidth);

  ctx.fillStyle = colors.muted;
  ctx.font = "18px Sarabun, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`อัปเดตล่าสุด ${updatedAt} น.`, width / 2, updatedY);
  ctx.fillStyle = "#8aa19e";
  ctx.font = "16px Sarabun, sans-serif";
  ctx.fillText("ภาพนี้แสดงข้อมูลคิว ณ เวลาที่บันทึก", width / 2, footerY);

  const link = document.createElement("a");
  link.download = `บัตรคิว-${queue.queue_number || "OPD"}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
