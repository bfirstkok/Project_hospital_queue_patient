import type { QueueData } from "@/shared/api/types";

export function generateQueueCardImage(queue: Partial<QueueData>, estimatedText: string): void {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = 800;
  const height = 1050;
  const scale = 2; // For crisp high-DPI output

  canvas.width = width * scale;
  canvas.height = height * scale;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#eff6f5";
  ctx.fillRect(0, 0, width, height);

  // Main Card
  const cardX = 40;
  const cardY = 40;
  const cardW = width - 80;
  const cardH = height - 80;
  const cardRadius = 24;

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#d8e6e3";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
  ctx.fill();
  ctx.stroke();

  // Top header banner
  ctx.fillStyle = "#0d8a7d";
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, 110, [cardRadius, cardRadius, 0, 0]);
  ctx.fill();

  // Header Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px Sarabun, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✚ โรงพยาบาล - บัตรคิวผู้ป่วย OPD", width / 2, cardY + 65);

  // Subtitle
  ctx.fillStyle = "#0d8a7d";
  ctx.font = "bold 22px Sarabun, sans-serif";
  ctx.fillText("หมายเลขคิวของคุณ", width / 2, cardY + 165);

  // Queue Number Box
  const qBoxW = 420;
  const qBoxH = 150;
  const qBoxX = (width - qBoxW) / 2;
  const qBoxY = cardY + 185;

  ctx.fillStyle = "#e6f6f4";
  ctx.strokeStyle = "#b8e5df";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(qBoxX, qBoxY, qBoxW, qBoxH, 20);
  ctx.fill();
  ctx.stroke();

  // Big Queue Number
  ctx.fillStyle = "#086e63";
  ctx.font = "bold 88px Sarabun, sans-serif";
  ctx.fillText(queue.queue_number || "-", width / 2, qBoxY + 105);

  // Status Badge
  const statusBoxW = 340;
  const statusBoxH = 48;
  const statusBoxX = (width - statusBoxW) / 2;
  const statusBoxY = qBoxY + qBoxH + 20;

  ctx.fillStyle = "#0d8a7d";
  ctx.beginPath();
  ctx.roundRect(statusBoxX, statusBoxY, statusBoxW, statusBoxH, 24);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Sarabun, sans-serif";
  ctx.fillText(`สถานะ: ${queue.status_label || "รอตรวจ"}`, width / 2, statusBoxY + 32);

  // Details Grid Section
  const gridY = statusBoxY + statusBoxH + 30;
  const colW = (cardW - 60) / 2;

  // Box 1: Position
  ctx.fillStyle = "#f7faf9";
  ctx.strokeStyle = "#d8e6e3";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cardX + 25, gridY, colW, 90, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#5f7774";
  ctx.font = "18px Sarabun, sans-serif";
  ctx.fillText("ลำดับคิวก่อนหน้า", cardX + 25 + colW / 2, gridY + 34);
  ctx.fillStyle = "#112624";
  ctx.font = "bold 26px Sarabun, sans-serif";
  const posText = Number.isInteger(queue.queue_position) ? `อันดับที่ ${queue.queue_position}` : "รอจัดลำดับ";
  ctx.fillText(posText, cardX + 25 + colW / 2, gridY + 70);

  // Box 2: Room
  ctx.fillStyle = "#f7faf9";
  ctx.strokeStyle = "#d8e6e3";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cardX + 35 + colW, gridY, colW, 90, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#5f7774";
  ctx.font = "18px Sarabun, sans-serif";
  ctx.fillText("ห้องตรวจ", cardX + 35 + colW + colW / 2, gridY + 34);
  ctx.fillStyle = "#112624";
  ctx.font = "bold 26px Sarabun, sans-serif";
  ctx.fillText(queue.room || "รอระบุห้อง", cardX + 35 + colW + colW / 2, gridY + 70);

  // Estimated Wait Time Box
  const estY = gridY + 110;
  ctx.fillStyle = "#fffbeb";
  ctx.strokeStyle = "#fde68a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cardX + 25, estY, cardW - 50, 70, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#b45309";
  ctx.font = "bold 20px Sarabun, sans-serif";
  ctx.fillText(`⏱️ ${estimatedText}`, width / 2, estY + 42);

  // Instruction Box
  const insY = estY + 90;
  ctx.fillStyle = "#112624";
  ctx.font = "500 20px Sarabun, sans-serif";
  ctx.fillText(queue.instruction || "กรุณารอเรียกคิว ณ จุดพักคอย", width / 2, insY + 20);

  // Footer Note & Date
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(now);

  ctx.fillStyle = "#5f7774";
  ctx.font = "17px Sarabun, sans-serif";
  ctx.fillText(`บันทึกเมื่อ: ${dateStr} น.`, width / 2, cardY + cardH - 50);

  ctx.font = "15px Sarabun, sans-serif";
  ctx.fillStyle = "#8aa19e";
  ctx.fillText("โปรดแสดงบัตรนี้ต่อเจ้าหน้าที่เมื่อถึงคิวของท่าน", width / 2, cardY + cardH - 22);

  // Download Trigger
  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.download = `บัตรคิว-${queue.queue_number || "OPD"}.png`;
  link.href = dataUrl;
  link.click();
}
