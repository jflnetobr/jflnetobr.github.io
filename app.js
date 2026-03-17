const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const form = document.querySelector("#calculatorForm");
const monthlyInput = document.querySelector("#mensalidade");
const dueDateInput = document.querySelector("#vencimento");
const paymentDateInput = document.querySelector("#pagamento");
const clearButton = document.querySelector("#btnLimpar");
const todayButton = document.querySelector("#btnHoje");
const shareButton = document.querySelector("#btnShare");
const installButton = document.querySelector("#btnInstall");
const installHint = document.querySelector("#installHint");

const resultNodes = {
  total: document.querySelector("#valorDevido"),
  daysLate: document.querySelector("#diasAtraso"),
  fine: document.querySelector("#multa"),
  interest: document.querySelector("#juros"),
  base: document.querySelector("#valorBase"),
  dates: document.querySelector("#resumoDatas"),
  paymentDate: document.querySelector("#dataConsiderada"),
  statusText: document.querySelector("#situacaoPagamento"),
  statusPill: document.querySelector("#statusPill"),
};

let deferredPrompt = null;
let currentResult = null;
const brandLogo = new Image();
brandLogo.src = "./assets/logo.png";

function formatCurrency(value) {
  return currencyFormatter.format(value || 0);
}

function parsePositiveNumber(value) {
  if (value === "" || value === null || Number.isNaN(Number(value))) {
    return null;
  }

  const amount = Number(value);
  return amount >= 0 ? amount : null;
}

function parseDateValue(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return { year, month, day };
}

function todayParts() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

function toUtcDay(parts) {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000);
}

function formatParts(parts) {
  return dateFormatter.format(new Date(parts.year, parts.month - 1, parts.day));
}

function computeResult() {
  const amount = parsePositiveNumber(monthlyInput.value);
  const due = parseDateValue(dueDateInput.value);

  if (amount === null || !due) {
    return null;
  }

  const payment = parseDateValue(paymentDateInput.value) || todayParts();
  const usingToday = !paymentDateInput.value;
  const rawDelay = toUtcDay(payment) - toUtcDay(due);
  const daysLate = Math.max(rawDelay, 0);
  const fine = daysLate > 0 ? amount * 0.02 : 0;
  const interest = daysLate > 0 ? amount * (daysLate - 1) * 0.00333 : 0;
  const total = amount + fine + interest;

  let status = "Sem atraso";
  if (rawDelay > 0) {
    status = rawDelay === 1 ? "1 dia de atraso" : `${rawDelay} dias de atraso`;
  } else if (rawDelay < 0) {
    status = "Pagamento em dia ou antecipado";
  }

  return {
    amount,
    due,
    payment,
    usingToday,
    rawDelay,
    daysLate,
    fine,
    interest,
    total,
    status,
  };
}

function renderEmptyState() {
  currentResult = null;
  shareButton.disabled = true;
  resultNodes.total.textContent = "R$ 0,00";
  resultNodes.daysLate.textContent = "0";
  resultNodes.fine.textContent = "R$ 0,00";
  resultNodes.interest.textContent = "R$ 0,00";
  resultNodes.base.textContent = "R$ 0,00";
  resultNodes.dates.textContent = "Informe valor e vencimento para calcular.";
  resultNodes.paymentDate.textContent = "-";
  resultNodes.statusText.textContent = "Aguardando dados";
  resultNodes.statusPill.textContent = "Alerta: preencha os campos";
  resultNodes.statusPill.dataset.state = "alert";
}

function renderResult(result) {
  currentResult = result;
  shareButton.disabled = false;
  resultNodes.total.textContent = formatCurrency(result.total);
  resultNodes.daysLate.textContent = String(result.daysLate);
  resultNodes.fine.textContent = formatCurrency(result.fine);
  resultNodes.interest.textContent = formatCurrency(result.interest);
  resultNodes.base.textContent = formatCurrency(result.amount);
  resultNodes.paymentDate.textContent = `${formatParts(result.payment)}${result.usingToday ? " (hoje)" : ""}`;
  resultNodes.statusText.textContent = result.status;
  resultNodes.statusPill.textContent = result.daysLate > 0 ? "Em atraso" : "Sem cobrança extra";
  resultNodes.statusPill.dataset.state = result.daysLate > 0 ? "late" : "ok";
  resultNodes.dates.textContent =
    `Vencimento em ${formatParts(result.due)} e pagamento considerado em ${formatParts(result.payment)}.`;
}

function updateUI() {
  const result = computeResult();
  if (!result) {
    renderEmptyState();
    return;
  }

  renderResult(result);
}

function resetForm() {
  form.reset();
  renderEmptyState();
  monthlyInput.focus();
}

function setTodayAsPaymentDate() {
  const now = todayParts();
  paymentDateInput.value = `${String(now.year).padStart(4, "0")}-${String(now.month).padStart(2, "0")}-${String(now.day).padStart(2, "0")}`;
  updateUI();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  words.forEach((word, index) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && index > 0) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  });

  if (line) {
    ctx.fillText(line, x, currentY);
  }

  return currentY;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawCard(ctx, x, y, width, height, label, value) {
  drawRoundedRect(ctx, x, y, width, height, 26);
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fill();

  ctx.fillStyle = "#94c7ee";
  ctx.font = "500 28px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText(label, x + 28, y + 46);

  ctx.fillStyle = "#f4fbff";
  ctx.font = "700 40px Trebuchet MS, Avenir Next Condensed, sans-serif";
  ctx.fillText(value, x + 28, y + 98);
}

async function renderShareImage(result) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, "#05101c");
  gradient.addColorStop(0.5, "#0a2036");
  gradient.addColorStop(1, "#0c3356");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(0, 112, 192, 0.22)";
  ctx.beginPath();
  ctx.arc(170, 180, 220, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(136, 210, 255, 0.12)";
  ctx.beginPath();
  ctx.arc(920, 220, 180, 0, Math.PI * 2);
  ctx.fill();

  drawRoundedRect(ctx, 72, 74, 936, 1202, 44);
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.fill();

  drawRoundedRect(ctx, 120, 120, 304, 208, 32);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  if (brandLogo.complete && brandLogo.naturalWidth > 0) {
    const maxWidth = 244;
    const maxHeight = 168;
    const ratio = Math.min(maxWidth / brandLogo.naturalWidth, maxHeight / brandLogo.naturalHeight);
    const drawWidth = brandLogo.naturalWidth * ratio;
    const drawHeight = brandLogo.naturalHeight * ratio;
    ctx.drawImage(brandLogo, 150, 140, drawWidth, drawHeight);
  } else {
    ctx.fillStyle = "#0a2036";
    ctx.font = "700 28px Avenir Next, Segoe UI, sans-serif";
    ctx.fillText("INFO MATOS", 148, 214);
  }

  ctx.fillStyle = "#9fcdf0";
  ctx.font = "600 24px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText("Calculadora de Juros", 120, 382);

  ctx.fillStyle = "#f2f8ff";
  ctx.font = "700 78px Trebuchet MS, Avenir Next Condensed, sans-serif";
  ctx.fillText("Valor devido", 120, 474);
  ctx.font = "700 118px Trebuchet MS, Avenir Next Condensed, sans-serif";
  ctx.fillText(formatCurrency(result.total), 120, 594);

  ctx.fillStyle = "#bfd6ea";
  ctx.font = "500 28px Avenir Next, Segoe UI, sans-serif";
  const subtitleY = wrapText(
    ctx,
    `Mensalidade de ${formatCurrency(result.amount)} com vencimento em ${formatParts(result.due)}.`,
    120,
    658,
    820,
    40,
  );

  drawCard(ctx, 120, subtitleY + 54, 392, 126, "Dias de atraso", String(result.daysLate));
  drawCard(ctx, 548, subtitleY + 54, 340, 126, "Multa", formatCurrency(result.fine));
  drawCard(ctx, 120, subtitleY + 206, 392, 126, "Juros", formatCurrency(result.interest));
  drawCard(
    ctx,
    548,
    subtitleY + 206,
    340,
    126,
    "Pagamento",
    formatParts(result.payment),
  );

  drawRoundedRect(ctx, 120, subtitleY + 392, 768, 188, 32);
  ctx.fillStyle = "rgba(5, 17, 30, 0.4)";
  ctx.fill();
  ctx.fillStyle = "#88d2ff";
  ctx.font = "600 26px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText("Regra aplicada", 152, subtitleY + 448);
  ctx.fillStyle = "#f2f8ff";
  ctx.font = "700 42px Trebuchet MS, Avenir Next Condensed, sans-serif";
  ctx.fillText("2% de multa", 152, subtitleY + 516);
  ctx.fillText("0,333% ao dia após o 1º dia", 152, subtitleY + 568);

  ctx.fillStyle = "#a8c8e3";
  ctx.font = "500 24px Avenir Next, Segoe UI, sans-serif";

  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
}

async function shareResult() {
  if (!currentResult) {
    return;
  }

  shareButton.disabled = true;
  shareButton.textContent = "Gerando imagem...";

  try {
    const blob = await renderShareImage(currentResult);
    if (!blob) {
      throw new Error("Falha ao gerar a imagem.");
    }

    const file = new File([blob], "calculo-juros-info-matos.png", { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "Cálculo de juros",
        text: "Resumo do cálculo de juros e multa.",
        files: [file],
      });
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "Não foi possível compartilhar agora.");
  } finally {
    shareButton.disabled = currentResult === null;
    shareButton.textContent = "Compartilhar imagem";
  }
}

function updateInstallHint() {
  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

  if (isIOS && !isStandalone) {
    installHint.hidden = false;
    installHint.textContent = "No iPhone ou iPad, use Compartilhar > Adicionar à Tela de Início.";
  }
}

function registerPWA() {
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installButton.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installButton.hidden = true;
    installHint.hidden = false;
    installHint.textContent = "Aplicativo instalado com sucesso.";
  });

  installButton.addEventListener("click", async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installButton.hidden = true;
  });

  updateInstallHint();
}

form.addEventListener("input", updateUI);
todayButton.addEventListener("click", setTodayAsPaymentDate);
clearButton.addEventListener("click", resetForm);
shareButton.addEventListener("click", shareResult);

renderEmptyState();
registerPWA();
