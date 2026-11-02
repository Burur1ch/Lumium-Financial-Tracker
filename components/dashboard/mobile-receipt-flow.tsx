"use client";

import {
  ArrowLeft,
  Banana,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FilePenLine,
  Flashlight,
  Headphones,
  Image as ImageIcon,
  Lightbulb,
  Milk,
  QrCode,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Usb,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ElementType } from "react";
import { useI18n } from "@/hooks/useI18n";
import type { TranslationKey } from "@/store/translations";

type FlowScreen = "closed" | "chooser" | "scanner" | "processing" | "review";
type ScanMode = "photo" | "qr";
type CategoryKind = "technology" | "home" | "groceries";

interface RecognizedItem {
  id: string;
  nameKey: TranslationKey;
  price: number;
  kind: CategoryKind;
  confidence: number;
  icon: ElementType;
}

const INITIAL_ITEMS: RecognizedItem[] = [
  { id: "headphones", nameKey: "receiptItemHeadphones", price: 199.9, kind: "technology", confidence: 0.98, icon: Headphones },
  { id: "usb", nameKey: "receiptItemUsb", price: 19.9, kind: "technology", confidence: 0.72, icon: Usb },
  { id: "lamp", nameKey: "receiptItemLamp", price: 24.5, kind: "home", confidence: 0.91, icon: Lightbulb },
  { id: "milk", nameKey: "receiptItemMilk", price: 3.8, kind: "groceries", confidence: 0.99, icon: Milk },
  { id: "bananas", nameKey: "receiptItemBananas", price: 7.2, kind: "groceries", confidence: 0.97, icon: Banana },
  { id: "bread", nameKey: "receiptItemBread", price: 2.9, kind: "groceries", confidence: 0.96, icon: ShoppingCart },
];

const CATEGORY_COLORS: Record<CategoryKind, string> = {
  technology: "#4C8ACC",
  home: "#C08A45",
  groceries: "#4F9E74",
};

function formatBr(value: number) {
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} Br`;
}

export function MobileReceiptFlow() {
  const { t } = useI18n();
  const [screen, setScreen] = useState<FlowScreen>("closed");
  const [scanMode, setScanMode] = useState<ScanMode>("photo");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState(0);
  const [items, setItems] = useState<RecognizedItem[]>(INITIAL_ITEMS);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [scannerHelpOpen, setScannerHelpOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const releaseCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stopCamera = useCallback(() => {
    releaseCamera();
    setCameraActive(false);
  }, [releaseCamera]);

  const closeFlow = useCallback(() => {
    stopCamera();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setItems(INITIAL_ITEMS);
    setProcessingStage(0);
    setDetailsOpen(false);
    setScannerHelpOpen(false);
    setScreen("closed");
  }, [previewUrl, stopCamera]);

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
    if (!navigator.mediaDevices?.getUserMedia) return;

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

    return () => {
      cancelled = true;
      releaseCamera();
    };
  }, [releaseCamera, screen]);

  useEffect(() => {
    if (screen !== "processing") return;
    const itemTimer = window.setTimeout(() => setProcessingStage(1), 650);
    const categoryTimer = window.setTimeout(() => setProcessingStage(2), 1350);
    const reviewTimer = window.setTimeout(() => setScreen("review"), 2200);
    return () => {
      window.clearTimeout(itemTimer);
      window.clearTimeout(categoryTimer);
      window.clearTimeout(reviewTimer);
    };
  }, [screen]);

  useEffect(
    () => () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl, stopCamera],
  );

  const categoryLabel = useCallback(
    (kind: CategoryKind) => {
      if (kind === "technology") return t("categoryTechnology");
      if (kind === "home") return t("categoryHome");
      return t("categoryGroceries");
    },
    [t],
  );

  const groupedItems = useMemo(() => {
    return (["technology", "home", "groceries"] as const)
      .map((kind) => ({
        kind,
        items: items.filter((item) => item.kind === kind),
      }))
      .filter((group) => group.items.length > 0);
  }, [items]);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price, 0),
    [items],
  );

  const startScanner = (mode: ScanMode) => {
    setScanMode(mode);
    setCameraUnavailable(!navigator.mediaDevices?.getUserMedia);
    setScreen("scanner");
  };

  const handleImage = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setProcessingStage(0);
    setCameraActive(false);
    setScreen("processing");
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
      handleImage(new File([blob], "receipt.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  };

  const continueManually = () => {
    const splitSummary = groupedItems
      .map((group) => `${categoryLabel(group.kind)}: ${formatBr(group.items.reduce((sum, item) => sum + item.price, 0))}`)
      .join("; ");
    const detail = {
      amount: total,
      description: t("receiptDemoDescription"),
      note: `${t("receiptDraftNote")} ${splitSummary}`,
      currency: "BYN",
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
            <h2 id="mobile-add-title" className="text-[1.65rem] font-extrabold tracking-[-0.025em] text-[var(--app-text)]">
              {t("addOperation")}
            </h2>
            <button type="button" className="icon-button" onClick={closeFlow} aria-label={t("close")}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-2.5 px-4 pb-4">
            <AddChoice
              icon={Camera}
              title={t("photographReceipt")}
              description={t("photographReceiptHint")}
              onClick={() => startScanner("photo")}
            />
            <AddChoice
              icon={QrCode}
              title={t("scanQr")}
              description={t("scanQrHint")}
              onClick={() => startScanner("qr")}
            />
            <AddChoice
              icon={FilePenLine}
              title={t("enterManually")}
              description={t("manualEntryHint")}
              onClick={() => {
                closeFlow();
                window.setTimeout(() => window.dispatchEvent(new Event("lumium:open-add-transaction")), 240);
              }}
            />
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
          <button type="button" onClick={() => setScreen("chooser")} className="mobile-scan-icon" aria-label={t("back")}>
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h2>{t("scanReceipt")}</h2>
          <button type="button" onClick={() => setScannerHelpOpen((value) => !value)} className="mobile-scan-icon" aria-label={t("help")} aria-expanded={scannerHelpOpen} aria-controls="scanner-help">
            <CircleHelp className="h-6 w-6" />
          </button>
        </header>

        <div className="mobile-scan-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={scanMode === "photo"} onClick={() => setScanMode("photo")} className={scanMode === "photo" ? "is-active" : ""}>
            <Camera className="h-5 w-5" /> {t("photo")}
          </button>
          <button type="button" role="tab" aria-selected={scanMode === "qr"} onClick={() => setScanMode("qr")} className={scanMode === "qr" ? "is-active" : ""}>
            <QrCode className="h-5 w-5" /> {t("qrCode")}
          </button>
        </div>

        {scannerHelpOpen && (
          <p id="scanner-help" className="mx-4 mb-3 rounded-xl border border-[#294052] bg-[#101f2b] px-4 py-3 text-sm leading-5 text-[#b0c0cf]">
            {t("scannerHelpHint")}
          </p>
        )}

        <div className="mobile-camera-stage">
          <video ref={videoRef} muted playsInline className={cameraActive ? "is-visible" : ""} />
          {!cameraActive && (
            <div className="mobile-camera-placeholder">
              <ReceiptText className="h-24 w-24" strokeWidth={1.1} />
              {cameraUnavailable && <p>{t("cameraUnavailable")}</p>}
            </div>
          )}
          <div className={`mobile-camera-frame ${scanMode === "qr" ? "is-qr" : ""}`} aria-hidden="true">
            <i /><i /><i /><i />
          </div>
          <div className="mobile-camera-guidance">
            <strong>{scanMode === "photo" ? t("placeReceiptInFrame") : t("scanQr")}</strong>
            <span>{t("goodLightHint")}</span>
          </div>
        </div>

        <div className="mobile-camera-controls">
          <button type="button" onClick={() => galleryInputRef.current?.click()} className="mobile-camera-side" aria-label={t("chooseReceiptPhoto")}>
            <ImageIcon className="h-6 w-6" />
          </button>
          <button type="button" onClick={captureFrame} className="mobile-camera-shutter" aria-label={t("photographReceipt")}><span /></button>
          <button type="button" className="mobile-camera-side opacity-40" aria-label={t("flashUnavailable")} disabled><Flashlight className="h-6 w-6" /></button>
        </div>

        <button type="button" className="mobile-scan-manual" onClick={() => {
          closeFlow();
          window.setTimeout(() => window.dispatchEvent(new Event("lumium:open-add-transaction")), 240);
        }}>
          {t("enterManually")}
        </button>

        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => handleImage(event.target.files?.[0] ?? null)} />
        <input ref={galleryInputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => handleImage(event.target.files?.[0] ?? null)} />
      </section>
    );
  }

  if (screen === "processing") {
    return (
      <section className="mobile-processing-screen lg:hidden" role="dialog" aria-modal="true" aria-label={t("recognizePurchase")}>
        <header className="mobile-scan-header">
          <button type="button" onClick={() => setScreen("scanner")} className="mobile-scan-icon" aria-label={t("back")}>
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h2>{t("recognizePurchase")}</h2>
          <span className="h-11 w-11" />
        </header>

        <div className="mobile-processing-body">
          <div className="mobile-receipt-preview" style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}>
            {!previewUrl && <ReceiptText className="h-24 w-24 text-slate-500" />}
            <ScanLine className="mobile-scan-line" />
          </div>

          <div className="mobile-process-steps" aria-live="polite">
            <ProcessStep complete icon={Check} title={t("readReceipt")} description={t("receiptPhotoProcessed")} />
            <ProcessStep active={processingStage <= 1} complete={processingStage > 1} icon={ReceiptText} title={t("determineItems")} description={t("recognizedItemsProgress")} />
            <ProcessStep active={processingStage === 2} icon={Tag} title={t("distributeCategories")} description={t("almostDone")} />
          </div>

          <p className="mobile-prototype-note">{t("receiptPrototypeNotice")}</p>

          <p className="flex items-center justify-center gap-2 text-sm text-[#8ea0b3]"><Clock3 className="h-5 w-5" />{t("recognitionTimeHint")}</p>
          <button type="button" className="mobile-secondary-button" onClick={closeFlow}>{t("cancel")}</button>
          <p className="flex items-start justify-center gap-2 text-center text-xs leading-5 text-[#8ea0b3]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />{t("receiptPrivacyHint")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mobile-review-screen lg:hidden" role="dialog" aria-modal="true" aria-label={t("checkPurchase")}>
      <header className="mobile-review-header">
        <button type="button" onClick={() => setScreen("scanner")} className="mobile-scan-icon" aria-label={t("back")}><ArrowLeft className="h-6 w-6" /></button>
        <h2>{t("checkPurchase")}</h2>
        <button type="button" onClick={closeFlow} className="mobile-scan-icon" aria-label={t("close")}><X className="h-5 w-5" /></button>
      </header>

      <div className="mobile-review-scroll">
        <div className="mobile-merchant-card">
          <span className="mobile-merchant-icon"><ShoppingCart className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1"><strong>{t("receiptDemoMerchant")}</strong><small>{t("receiptDemoDate")}</small></span>
          <b>{formatBr(total)}</b>
        </div>

        <div className="mobile-recognition-summary">
          <span><Check className="h-4 w-4" /> {t("recognizedItems")}</span>
          <button type="button" onClick={() => setDetailsOpen((value) => !value)}>{t("moreDetails")}<ChevronDown className={`h-4 w-4 ${detailsOpen ? "rotate-180" : ""}`} /></button>
        </div>

        <p className="mobile-prototype-note">{t("receiptPrototypeNotice")}</p>

        {groupedItems.map((group) => {
          const subtotal = group.items.reduce((sum, item) => sum + item.price, 0);
          return (
            <section key={group.kind} className="mobile-receipt-group" style={{ "--category-color": CATEGORY_COLORS[group.kind] } as CSSProperties}>
              <header><span><Tag className="h-5 w-5" />{categoryLabel(group.kind)}</span><strong>{formatBr(subtotal)}</strong></header>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="mobile-receipt-item">
                    <span className="mobile-receipt-item-icon"><Icon className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1"><strong>{t(item.nameKey)}</strong><small>{t("receiptDemoMerchant")} · {t("receiptOneUnit")}</small></span>
                    <label className="mobile-category-select">
                      <span className="sr-only">{t("category")}</span>
                      <select value={item.kind} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, kind: event.target.value as CategoryKind } : entry))}>
                        <option value="technology">{t("categoryTechnology")}</option>
                        <option value="home">{t("categoryHome")}</option>
                        <option value="groceries">{t("categoryGroceries")}</option>
                      </select>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </label>
                    <b>{formatBr(item.price)}</b>
                  </div>
                );
              })}
            </section>
          );
        })}

        {detailsOpen && (
          <section className="mobile-reason-panel">
            <h3>{t("whyDistributed")}</h3>
            <div><Headphones className="h-5 w-5 text-[#4C8ACC]" /><p><strong>{t("receiptItemHeadphones")} → {t("categoryTechnology")}</strong><span>{t("productTypeReason")}</span></p></div>
            <div><Milk className="h-5 w-5 text-[#4F9E74]" /><p><strong>{t("receiptItemMilk")} → {t("categoryGroceries")}</strong><span>{t("productNameReason")}</span></p></div>
          </section>
        )}

        <div className="mobile-confidence-warning"><span>!</span>{t("lowConfidenceHint")}</div>
      </div>

      <footer className="mobile-review-footer">
        <button type="button" onClick={continueManually}>{t("verifyAndContinue")} · {formatBr(total)}</button>
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
      <ChevronDown className="h-5 w-5 -rotate-90 text-[var(--app-muted)]" />
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
