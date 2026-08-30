"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Modal } from "@/components/Modal";
import { getCroppedImageBlob, type PixelCrop } from "@/lib/cropImage";
import { useLang } from "@/lib/i18n";

export function CropImageModal({
  imageSrc,
  onClose,
  onDone,
}: {
  imageSrc: string;
  onClose: () => void;
  onDone: (blob: Blob) => void;
}) {
  const { t } = useLang();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_croppedArea: unknown, pixels: PixelCrop) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function confirm() {
    if (!croppedAreaPixels) return;
    setBusy(true);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      onDone(blob);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t("cropPhotoTitle")} onClose={onClose}>
      <div className="relative h-72 w-full overflow-hidden rounded-xl bg-ink/90">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs font-medium text-muted">{t("zoomLabel")}</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1"
        />
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
        <button type="button" onClick={confirm} disabled={busy || !croppedAreaPixels} className="btn-primary">
          {busy ? t("saving") : t("useThisPhotoCta")}
        </button>
      </div>
    </Modal>
  );
}
