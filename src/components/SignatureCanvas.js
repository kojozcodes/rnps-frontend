/**
 * SignatureCanvas Component
 * Touch-optimized signature pad with full freedom of movement
 * FIX #4: No scroll interference, vertical + horizontal drawing
 */

import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import SignaturePad from 'signature_pad';
import './SignatureCanvas.css';

const SignatureCanvas = forwardRef((props, ref) => {
  const canvasRef = useRef(null);
  const signaturePadRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
      minWidth: 2,
      maxWidth: 4,
    });

    signaturePadRef.current = signaturePad;

    // Resize canvas
    const resizeCanvas = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d').scale(ratio, ratio);
      signaturePad.clear(); // Clear after resize
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      signaturePad.off();
    };
  }, []);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    clear: () => {
      signaturePadRef.current?.clear();
    },
    isEmpty: () => {
      return signaturePadRef.current?.isEmpty();
    },
    getSignatureData: () => {
      if (signaturePadRef.current?.isEmpty()) {
        return null;
      }
      return signaturePadRef.current?.toDataURL('image/png');
    },
  }));

  const handleClear = () => {
    signaturePadRef.current?.clear();
  };

  return (
    <div className="signature-container">
      <canvas ref={canvasRef} className="signature-canvas" />
      <button type="button" className="clear-signature-btn" onClick={handleClear}>
        Clear Signature
      </button>
    </div>
  );
});

SignatureCanvas.displayName = 'SignatureCanvas';

export default SignatureCanvas;