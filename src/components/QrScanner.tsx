"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";

export default function QrScanner({
  onScan,
  onClose,
}: {
  onScan(value: string): void;
  onClose(): void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onScanRef = useRef(onScan);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("");

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let disposed = false;
    let controls: { stop(): void } | undefined;
    const reader = new BrowserQRCodeReader();

    async function start() {
      if (!videoRef.current) return;

      try {
        controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, _error, scannerControls) => {
            if (!result || disposed) return;
            scannerControls.stop();
            onScanRef.current(result.getText());
          },
        );
      } catch (error) {
        if (disposed) return;
        setCameraError(
          error instanceof Error
            ? error.message
            : "Camera scanning is unavailable on this device.",
        );
      }
    }

    void start();

    return () => {
      disposed = true;
      controls?.stop();
    };
  }, []);

  function useManualValue(event: React.FormEvent) {
    event.preventDefault();
    const value = manualValue.trim();
    if (!value) return;
    onScan(value);
  }

  return (
    <section className="qrScanner">
      <div className="qrScannerHeader">
        <div>
          <p className="eyebrow">Scan to pay</p>
          <h3>Scan payment QR</h3>
        </div>
        <button className="textButton" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="qrVideoFrame">
        <video ref={videoRef} autoPlay muted playsInline />
      </div>

      {cameraError ? (
        <p className="errorText">
          Camera unavailable. You can still paste a Krypto121 payment link or wallet address below.
        </p>
      ) : (
        <p className="hint">Point the camera at a Krypto121 payment QR or compatible wallet QR.</p>
      )}

      <form className="qrPasteForm" onSubmit={useManualValue}>
        <label className="field">
          <span>Or paste payment link / wallet address</span>
          <input
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
            placeholder="https://www.krypto121.app/pay?... or 0x…"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <button className="secondaryButton" type="submit" disabled={!manualValue.trim()}>
          Use payment details
        </button>
      </form>
    </section>
  );
}
