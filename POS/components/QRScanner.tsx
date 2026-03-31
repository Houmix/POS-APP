import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface QRScannerProps {
  visible: boolean;
  onScanned: (data: string) => void;
  onClose: () => void;
}

/**
 * Scanner QR code utilisant l'API HTML5 MediaDevices (webcam/caméra USB).
 * Fonctionne dans Electron (Chromium) via l'export Expo web.
 * Utilise l'API BarcodeDetector si disponible, sinon un polling basique.
 */
export default function QRScanner({ visible, onScanned, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanInterval = useRef<NodeJS.Timeout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  // Pas de support sur mobile natif
  if (Platform.OS !== 'web') {
    return null;
  }

  useEffect(() => {
    if (visible) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [visible]);

  const startCamera = async () => {
    setError(null);
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;

      // Petit délai pour que le DOM soit prêt
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          startScanning();
        }
      }, 200);
    } catch (err: any) {
      console.error('Erreur caméra:', err);
      setError('Impossible d\'accéder à la caméra. Vérifiez qu\'une caméra/webcam est connectée.');
      setScanning(false);
    }
  };

  const stopCamera = () => {
    if (scanInterval.current) {
      clearInterval(scanInterval.current);
      scanInterval.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const startScanning = () => {
    // Utilise BarcodeDetector si disponible (Chrome 83+), sinon on ne peut pas scanner
    const BarcodeDetectorAPI = (window as any).BarcodeDetector;

    if (!BarcodeDetectorAPI) {
      // Fallback : on informe l'utilisateur d'utiliser un lecteur USB externe
      // qui envoie le texte comme un clavier
      setError('Scanner QR non disponible. Utilisez un lecteur de code-barres USB (type pistolet) qui envoie le texte automatiquement dans le champ de recherche.');
      setScanning(false);
      return;
    }

    const detector = new BarcodeDetectorAPI({ formats: ['qr_code'] });

    scanInterval.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          const rawValue = barcodes[0].rawValue;
          if (rawValue) {
            // Le QR contient "ORDER-{id}", on extrait l'ID
            const match = rawValue.match(/ORDER-(\d+)/);
            const scannedData = match ? match[1] : rawValue;

            stopCamera();
            onScanned(scannedData);
          }
        }
      } catch (err) {
        // Ignore les erreurs de détection silencieusement
      }
    }, 250); // Scan toutes les 250ms
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <MaterialCommunityIcons name="qrcode-scan" size={24} color="#fff" />
            <Text style={styles.title}>Scanner QR Code</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Camera View */}
          <View style={styles.cameraContainer}>
            {error ? (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="camera-off" size={48} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <>
                {/* @ts-ignore - HTML elements in web context */}
                <video
                  ref={videoRef}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }}
                  autoPlay
                  playsInline
                  muted
                />
                {/* Cadre de visée */}
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
                {/* Canvas caché pour le traitement */}
                {/* @ts-ignore */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </>
            )}
          </View>

          <Text style={styles.hint}>
            Placez le QR code du ticket devant la caméra
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: 500,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  cameraContainer: {
    width: '100%',
    height: 380,
    backgroundColor: '#000',
    position: 'relative',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  scanFrame: {
    position: 'absolute',
    top: '15%',
    left: '15%',
    width: '70%',
    height: '70%',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#10b981',
    borderWidth: 3,
  },
  topLeft: {
    top: 0, left: 0,
    borderRightWidth: 0, borderBottomWidth: 0,
  },
  topRight: {
    top: 0, right: 0,
    borderLeftWidth: 0, borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0, left: 0,
    borderRightWidth: 0, borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0, right: 0,
    borderLeftWidth: 0, borderTopWidth: 0,
  },
  hint: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },
});
