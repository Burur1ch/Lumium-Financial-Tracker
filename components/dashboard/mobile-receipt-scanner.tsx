"use client";

import {
  ArrowLeft,
  Camera,
  Check,
  CircleHelp,
  Clock3,
  FilePenLine,
  Flashlight,
  Image as ImageIcon,
  QrCode,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ElementType } from "react";
import type { IScannerControls } from "@zxing/browser";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";
import {
  parseReceiptQr,
  parseReceiptText,
  type ReceiptScanResult,
} from "@/utils/receipt-scanner";

type FlowScreen = "closed" | "chooser" | "scanner" | "processing" | "review";
type ScanMode = "photo" | "qr";

const reviewInputClass =
  "min-h-11 w-full rounded-xl border border-[#333] bg-[#181818] px-3.5 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#ff5964]";

function formatAmount(value: number | null, currency: string) {
  if (value === null) return "—";
  return `${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

export function MobileReceiptScanner() {
  const { t } = useI18n();
  const { currency } = usePrefs();
  const [screen, setScreen] = useState<FlowScreen>("closed");
  const [scanMode, setScanMode] = useState<ScanMode>("photo");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiptScanResult | null>(null);
  const [scannerHelpOpen, setScannerHelpOpen] = useState(false);
  const scanFailedMessage = t("scanFailed");
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const qrControlsRef = useRef<IScannerControls | null>(null);
  const workerRef = useRef<{ terminate: () => Promise<unknown> } | null>(null);
  const runIdRef = useRef(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const releaseCamera = useCallback(() => {
    qrControlsRef.current?.stop();
    qrControlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
  }, []);

  const closeFlow = useCallback(() => {
    runIdRef.current += 1;
    void workerRef.current?.terminate();
    workerRef.current = null;
    releaseCamera();
    clearPreview();
    setProgress(0);
    setResult(null);
    setScanError(null);
    setScannerHelpOpen(false);
    setScreen("closed");
  }, [clearPreview, releaseCamera]);

  const acceptQrValue = useCallback(
    (rawValue: string) => {
      runIdRef.current += 1;
      releaseCamera();
      setScanError(null);
      setResult(parseReceiptQr(rawValue));
      setProgress(1);
      setScreen("review");
    },
    [releaseCamera],
  );

  useEffect(() => {
    const open = () => setScreen("chooser");
    window.addEventListener("lumium:open-mobile-add", open);
    return () => window.removeEventListener("lumium:open-mobile-add", open);
  }, []);

  useEffect(() => {
    if (screen === "closed") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeFlow();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeFlow, screen]);

  useEffect(() => {
    if (screen !== "scanner") return;
    let cancelled = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      return;
    }

    if (scanMode === "qr") {
      void import("@zxing/browser")
        .then(async ({ BrowserQRCodeReader }) => {
          if (cancelled || !videoRef.current) return;
          const reader = new BrowserQRCodeReader(undefined, {
            delayBetweenScanAttempts: 220,
            delayBetweenScanSuccess: 800,
          });
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: { ideal: "environment" } }, audio: false },
            videoRef.current,
            (scanResult, error, activeControls) => {
              if (scanResult) {
                activeControls.stop();
                acceptQrValue(scanResult.getText());
                return;
              }
              if (
                error?.name &&
                !["NotFoundException", "ChecksumException", "FormatException"].includes(error.name)
              ) {
                setScanError(scanFailedMessage);
              }
            },
          );
          if (cancelled) controls.stop();
          else {
            qrControlsRef.current = controls;
            setCameraActive(true);
          }
        })
        .catch(() => setCameraUnavailable(true));
    } else {
      void navigator.mediaDevices
        .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
        .then(async (stream) => {
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setCameraActive(true);
          }
        })
        .catch(() => setCameraUnavailable(true));
    }

    return () => {
      cancelled = true;
      releaseCamera();
    };
  }, [acceptQrValue, releaseCamera, scanFailedMessage, scanMode, screen]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      void workerRef.current?.terminate();
      releaseCamera();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [releaseCamera]);

  const startScanner = (mode: ScanMode) => {
    setScanMode(mode);
    setCameraUnavailable(!navigator.mediaDevices?.getUserMedia);
    setCameraActive(false);
    setResult(null);
    setScanError(null);
    setScreen("scanner");
  };

  const selectScanMode = (mode: ScanMode) => {
    releaseCamera();
    setScanMode(mode);
    setCameraUnavailable(!navigator.mediaDevices?.getUserMedia);
    setCameraActive(false);
    setScanError(null);
  };

  const setFilePreview = (file: File) => {
    clearPreview();
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    return url;
  };

  const recognizeReceipt = async (file: File) => {
    const runId = ++runIdRef.current;
    setFilePreview(file);
    releaseCamera();
    setProgress(0.02);
    setScanError(null);
    setScreen("processing");

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(["rus", "eng"], undefined, {
        logger(message) {
          if (runId !== runIdRef.current) return;
          if (message.status === "recognizing text") {
            setProgress(Math.max(0.08, message.progress));
          }
        },
      });
      workerRef.current = worker;
      const recognized = await worker.recognize(file, { rotateAuto: true });
      await worker.terminate();
      workerRef.current = null;
      if (runId !== runIdRef.current) return;
      setResult(parseReceiptText(recognized.data.text, recognized.data.confidence));
      setProgress(1);
      setScreen("review");
    } catch {
      if (runId !== runIdRef.current) return;
      workerRef.current = null;
      setScanError(t("scanFailed"));
      setProgress(0);
    }
  };

  const recognizeQrImage = async (file: File) => {
    const runId = ++runIdRef.current;
    const url = setFilePreview(file);
    releaseCamera();
    setProgress(0.5);
    setScanError(null);
    setScreen("processing");
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const decoded = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      if (runId !== runIdRef.current) return;
      acceptQrValue(decoded.getText());
    } catch {
      if (runId !== runIdRef.current) return;
      setScanError(t("qrNotFound"));
      setProgress(0);
    }
  };

  const handleImage = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (scanMode === "qr") void recognizeQrImage(file);
    else void recognizeReceipt(file);
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || !cameraActive || video.videoWidth === 0) {
      cameraInputRef.current?.click();
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      handleImage(
        new File([blob], scanMode === "qr" ? "qr.jpg" : "receipt.jpg", {
          type: "image/jpeg",
        }),
      );
    }, "image/jpeg", 0.92);
  };

  const updateResult = (patch: Partial<ReceiptScanResult>) => {
    setResult((current) => (current ? { ...current, ...patch } : current));
  };

  const continueManually = () => {
    if (!result?.amount) {
      setScanError(t("receiptAmountMissing"));
      return;
    }
    const itemSummary = result.items
      .slice(0, 12)
      .map((item) => `${item.name} — ${item.price.toFixed(2)}`)
      .join("; ");
    const sourceSummary = result.source === "qr"
      ? `${t("qrCode")}: ${result.rawText}`
      : itemSummary;
    const detail = {
      amount: result.amount,
      description: result.merchant || t("scannedReceipt"),
      note: [t("receiptDraftNote"), sourceSummary].filter(Boolean).join(" ").slice(0, 1000),
      currency: result.currency || currency,
      date: result.date || undefined,
    };
    closeFlow();
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("lumium:open-add-transaction", { detail }));
    }, 240);
  };

  if (screen === "closed") return null;

  if (screen === "chooser") {
    return (
      <div className="mobile-add-layer lg:hidden" onMouseDown={closeFlow}>
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-add-title"
          className="mobile-add-sheet"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="mobile-sheet-handle" />
          <div className="flex items-center justify-between px-5 pb-3 pt-1">
            <h2 id="mobile-add-title" className="text-[1.65rem] font-extrabold tracking-[-0.025em] text-[var(--app-text)]">{t("addOperation")}</h2>
            <button type="button" className="icon-button" onClick={closeFlow} aria-label={t("close")}><X className="h-5 w-5" /></button>
          </div>
          <div className="space-y-2.5 px-4 pb-4">
            <AddChoice icon={Camera} title={t("photographReceipt")} description={t("photographReceiptHint")} onClick={() => startScanner("photo")} />
            <AddChoice icon={QrCode} title={t("scanQr")} description={t("scanQrHint")} onClick={() => startScanner("qr")} />
            <AddChoice icon={FilePenLine} title={t("enterManually")} description={t("manualEntryHint")} onClick={() => {
              closeFlow();
              window.setTimeout(() => window.dispatchEvent(new Event("lumium:open-add-transaction")), 240);
            }} />
          </div>
          <p className="flex items-center justify-center gap-2 px-6 pb-5 text-center text-xs leading-5 text-[var(--app-muted)]">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span className="max-w-[18rem]">{t("receiptDeletedAfterSave")}</span>
          </p>
        </section>
      </div>
    );
  }

  if (screen === "scanner") {
    return (
      <section className="mobile-scan-screen lg:hidden" role="dialog" aria-modal="true" aria-label={t("scanReceipt")}>
        <header className="mobile-scan-header">
          <button type="button" onClick={() => setScreen("chooser")} className="mobile-scan-icon" aria-label={t("back")}><ArrowLeft className="h-6 w-6" /></button>
          <h2>{scanMode === "qr" ? t("scanQr") : t("scanReceipt")}</h2>
          <button type="button" onClick={() => setScannerHelpOpen((value) => !value)} className="mobile-scan-icon" aria-label={t("help")} aria-expanded={scannerHelpOpen} aria-controls="scanner-help"><CircleHelp className="h-6 w-6" /></button>
        </header>
        <div className="mobile-scan-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={scanMode === "photo"} onClick={() => selectScanMode("photo")} className={scanMode === "photo" ? "is-active" : ""}><Camera className="h-5 w-5" /> {t("photo")}</button>
          <button type="button" role="tab" aria-selected={scanMode === "qr"} onClick={() => selectScanMode("qr")} className={scanMode === "qr" ? "is-active" : ""}><QrCode className="h-5 w-5" /> {t("qrCode")}</button>
        </div>
        {scannerHelpOpen && <p id="scanner-help" className="mx-4 mb-3 rounded-xl border border-[#294052] bg-[#101f2b] px-4 py-3 text-sm leading-5 text-[#b0c0cf]">{t("scannerHelpHint")}</p>}
        {scanError && <p className="mx-4 mb-3 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{scanError}</p>}
        <div className="mobile-camera-stage">
          <video ref={videoRef} muted playsInline className={cameraActive ? "is-visible" : ""} />
          {!cameraActive && <div className="mobile-camera-placeholder"><ReceiptText className="h-24 w-24" strokeWidth={1.1} />{cameraUnavailable && <p>{t("cameraUnavailable")}</p>}</div>}
          <div className={`mobile-camera-frame ${scanMode === "qr" ? "is-qr" : ""}`} aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="mobile-camera-guidance">
            <strong>{scanMode === "photo" ? t("placeReceiptInFrame") : t("qrScanning")}</strong>
            <span>{t("goodLightHint")}</span>
          </div>
        </div>
        <div className="mobile-camera-controls">
          <button type="button" onClick={() => galleryInputRef.current?.click()} className="mobile-camera-side" aria-label={t("chooseReceiptPhoto")}><ImageIcon className="h-6 w-6" /></button>
          <button type="button" onClick={captureFrame} className="mobile-camera-shutter" aria-label={scanMode === "qr" ? t("scanQr") : t("photographReceipt")}><span /></button>
          <button type="button" className="mobile-camera-side opacity-40" aria-label={t("flashUnavailable")} disabled><Flashlight className="h-6 w-6" /></button>
        </div>
        <button type="button" className="mobile-scan-manual" onClick={() => {
          closeFlow();
          window.setTimeout(() => window.dispatchEvent(new Event("lumium:open-add-transaction")), 240);
        }}>{t("enterManually")}</button>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => handleImage(event.target.files?.[0] ?? null)} />
        <input ref={galleryInputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => handleImage(event.target.files?.[0] ?? null)} />
      </section>
    );
  }

  if (screen === "processing") {
    return (
      <section className="mobile-processing-screen lg:hidden" role="dialog" aria-modal="true" aria-label={t("recognizePurchase")}>
        <header className="mobile-scan-header">
          <button type="button" onClick={() => {
            runIdRef.current += 1;
            void workerRef.current?.terminate();
            workerRef.current = null;
            setScreen("scanner");
          }} className="mobile-scan-icon" aria-label={t("back")}><ArrowLeft className="h-6 w-6" /></button>
          <h2>{scanMode === "qr" ? t("scanQr") : t("recognizePurchase")}</h2>
          <span className="h-11 w-11" />
        </header>
        <div className="mobile-processing-body">
          <div className="mobile-receipt-preview" style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}>
            {!previewUrl && <ReceiptText className="h-24 w-24 text-slate-500" />}
            {progress > 0 && <ScanLine className="mobile-scan-line" />}
          </div>
          {scanError ? (
            <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-4 text-center text-sm text-red-200">
              <p>{scanError}</p>
              <button type="button" className="mt-3 min-h-11 rounded-xl bg-white px-4 font-bold text-black" onClick={() => setScreen("scanner")}>{t("back")}</button>
            </div>
          ) : (
            <div className="mobile-process-steps" aria-live="polite">
              <ProcessStep active={progress < 0.45} complete={progress >= 0.45} icon={ReceiptText} title={scanMode === "qr" ? t("readQr") : t("readReceipt")} description={`${Math.round(progress * 100)}%`} />
              <ProcessStep active={progress >= 0.45} complete={progress === 1} icon={Check} title={t("extractReceiptData")} description={t("receiptRecognitionOnDevice")} />
            </div>
          )}
          <p className="flex items-center justify-center gap-2 text-sm text-[#8ea0b3]"><Clock3 className="h-5 w-5" />{t("recognitionTimeHint")}</p>
          <button type="button" className="mobile-secondary-button" onClick={closeFlow}>{t("cancel")}</button>
          <p className="flex items-start justify-center gap-2 text-center text-xs leading-5 text-[#8ea0b3]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />{t("receiptPrivacyHint")}</p>
        </div>
      </section>
    );
  }

  if (!result) return null;
  const reviewCurrency = result.currency || currency;
  const hasLowConfidence = result.source === "receipt" && (result.confidence < 0.55 || result.amount === null);

  return (
    <section className="mobile-review-screen lg:hidden" role="dialog" aria-modal="true" aria-label={t("checkPurchase")}>
      <header className="mobile-review-header">
        <button type="button" onClick={() => setScreen("scanner")} className="mobile-scan-icon" aria-label={t("back")}><ArrowLeft className="h-6 w-6" /></button>
        <h2>{t("checkPurchase")}</h2>
        <button type="button" onClick={closeFlow} className="mobile-scan-icon" aria-label={t("close")}><X className="h-5 w-5" /></button>
      </header>
      <div className="mobile-review-scroll">
        <div className="mobile-merchant-card">
          <span className="mobile-merchant-icon">{result.source === "qr" ? <QrCode className="h-6 w-6" /> : <ShoppingCart className="h-6 w-6" />}</span>
          <span className="min-w-0 flex-1"><strong>{result.merchant || t("merchantNotRecognized")}</strong><small>{result.date || t("dateNotRecognized")}</small></span>
          <b>{formatAmount(result.amount, reviewCurrency)}</b>
        </div>
        <div className="mobile-recognition-summary">
          <span><Check className="h-4 w-4" /> {result.source === "qr" ? t("qrRecognized") : t("receiptRecognized")}</span>
          <span>{Math.round(result.confidence * 100)}%</span>
        </div>
        <p className="mobile-prototype-note">{t("receiptPrototypeNotice")}</p>

        <section className="mx-auto mt-3 w-full max-w-xl space-y-3 rounded-2xl border border-[#2a2a2a] bg-[#181818] p-4">
          <label className="block text-xs font-bold text-[#aeb9c3]">{t("description")}
            <input className={`${reviewInputClass} mt-1.5`} value={result.merchant ?? ""} placeholder={t("merchantNotRecognized")} onChange={(event) => updateResult({ merchant: event.target.value || null })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-[#aeb9c3]">{t("amount")}
              <input className={`${reviewInputClass} mt-1.5`} type="number" min="0.01" step="0.01" value={result.amount ?? ""} onChange={(event) => updateResult({ amount: event.target.value ? Number(event.target.value) : null })} />
            </label>
            <label className="block text-xs font-bold text-[#aeb9c3]">{t("date")}
              <input className={`${reviewInputClass} mt-1.5`} type="date" value={result.date ?? ""} onChange={(event) => updateResult({ date: event.target.value || null })} />
            </label>
          </div>
        </section>

        {result.items.length > 0 && (
          <section className="mobile-receipt-group" style={{ "--category-color": "#31d49d" } as CSSProperties}>
            <header><span><ReceiptText className="h-5 w-5" />{t("detectedItems")}</span><strong>{result.items.length}</strong></header>
            {result.items.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex items-center gap-3 border-t border-[#2a2a2a] px-3 py-3">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</span>
                <b className="whitespace-nowrap text-sm">{formatAmount(item.price, reviewCurrency)}</b>
              </div>
            ))}
          </section>
        )}

        {result.source === "qr" && (
          <details className="mx-auto mt-3 w-full max-w-xl rounded-2xl border border-[#2a2a2a] bg-[#181818] p-4 text-sm">
            <summary className="cursor-pointer font-bold">{t("rawQrData")}</summary>
            <p className="mt-3 break-all text-xs leading-5 text-[#aeb9c3]">{result.rawText}</p>
          </details>
        )}

        {scanError && <div className="mobile-confidence-warning"><span>!</span>{scanError}</div>}
        {hasLowConfidence && <div className="mobile-confidence-warning"><span>!</span>{t("lowConfidenceHint")}</div>}
      </div>
      <footer className="mobile-review-footer">
        <button type="button" onClick={continueManually} disabled={!result.amount}>{t("verifyAndContinue")} · {formatAmount(result.amount, reviewCurrency)}</button>
        <p>{t("receiptDeletedAfterSave")}</p>
      </footer>
    </section>
  );
}

function AddChoice({ icon: Icon, title, description, onClick }: { icon: ElementType; title: string; description: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mobile-add-choice">
      <span><Icon className="h-6 w-6" /></span>
      <span className="min-w-0 flex-1 text-left"><strong>{title}</strong><small>{description}</small></span>
      <ArrowLeft className="h-5 w-5 rotate-180 text-[var(--app-muted)]" />
    </button>
  );
}

function ProcessStep({ icon: Icon, title, description, active = false, complete = false }: { icon: ElementType; title: string; description: string; active?: boolean; complete?: boolean }) {
  return (
    <div className={`mobile-process-step ${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`}>
      <span className="mobile-process-icon"><Icon className="h-5 w-5" /></span>
      <div><strong>{title}</strong><small>{description}</small></div>
    </div>
  );
}
