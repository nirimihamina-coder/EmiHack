import { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, AlertCircle, RefreshCw, Trash2, ScanFace, Loader2 } from 'lucide-react';
import { useFaceLogin } from '../../hooks/useFaceLogin';
import * as faceapi from '@vladmandic/face-api';
import face from '../../assets/img/facial-features.png';

type Step = 'idle' | 'loading_models' | 'camera' | 'success' | 'error';

export default function SettingsFaceScan() {
  const [step, setStep] = useState<Step>('idle');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<'none' | 'detected' | 'scanning'>('none');
  const [hasFaceRegistered, setHasFaceRegistered] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionLoopRef = useRef<number | null>(null);
  const lastDescriptorRef = useRef<Float32Array | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  const { registerFace, updateFace, deleteFace, isScanning, faceError } = useFaceLogin();

  useEffect(() => {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      const user = parsed?.state?.user;
      setHasFaceRegistered(!!user?.faceDescriptor);
    }
  }, []);

  const loadModels = async () => {
    setStep('loading_models');
    try {
      const fa = await import('@vladmandic/face-api');
      await Promise.all([
        fa.nets.tinyFaceDetector.loadFromUri('/models'),
        fa.nets.faceLandmark68Net.loadFromUri('/models'),
        fa.nets.faceRecognitionNet.loadFromUri('/models')
      ]);
      setModelsLoaded(true);
      await startCamera();
    } catch {
      setErrorMsg('Impossible de charger les modèles de reconnaissance.');
      setStep('error');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setStep('camera');
    } catch {
      setErrorMsg('Accès à la caméra refusé.');
      setStep('error');
    }
  };

  // Attache le stream une fois que <video> est dans le DOM
  useEffect(() => {
    if (step === 'camera' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [step]);

  const stopCamera = () => {
    if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setDetectionStatus('none');
  };

  // Boucle de détection visuelle
  useEffect(() => {
    if (step !== 'camera' || !modelsLoaded) return;

    const detect = async (timestamp: number) => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;

      if (video.videoWidth === 0) {
        detectionLoopRef.current = requestAnimationFrame(detect);
        return;
      }

      // Throttle à ~5 fps pour ne pas surcharger
      if (timestamp - lastFrameTimeRef.current < 200) {
        detectionLoopRef.current = requestAnimationFrame(detect);
        return;
      }
      lastFrameTimeRef.current = timestamp;

      // Landmarks seulement — léger et suffisant pour l'affichage
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 }))
        .withFaceLandmarks();

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      faceapi.matchDimensions(canvas, { width: video.videoWidth, height: video.videoHeight });
      ctx?.clearRect(0, 0, canvas.width, canvas.height);

      if (detection) {
        const resized = faceapi.resizeResults(detection, { width: video.videoWidth, height: video.videoHeight });
        const box = resized.detection.box;
        if (ctx) {
          ctx.strokeStyle = '#0d9488';
          ctx.lineWidth = 2;
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          ctx.fillStyle = 'rgba(13,148,136,0.7)';
          resized.landmarks.positions.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          });
        }
        setDetectionStatus('detected');
      } else {
        lastDescriptorRef.current = null;
        setDetectionStatus('none');
      }

      detectionLoopRef.current = requestAnimationFrame(detect);
    };

    detectionLoopRef.current = requestAnimationFrame(detect);
    return () => {
      if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);
    };
  }, [step, modelsLoaded]);

  // Au clic : une seule analyse avec descriptor
  const handleRegister = async () => {
    if (!videoRef.current) return;
    setDetectionStatus('scanning');

    console.log('🔍 Début détection...');

    let detection;
    try {
      detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
        .withFaceLandmarks()
        .withFaceDescriptor(); // ← essaie .withFaceDescriptors() si ça retourne undefined

      console.log('✅ Detection result:', detection);
    } catch (err) {
      console.error('❌ Erreur faceapi:', err);
      setErrorMsg('Erreur lors de la détection.');
      setDetectionStatus('detected');
      return;
    }

    if (!detection) {
      console.warn('⚠️ Aucun visage détecté');
      setDetectionStatus('detected');
      setErrorMsg('Aucun visage détecté. Réessayez.');
      return;
    }

    console.log('📐 Descriptor:', detection.descriptor);

    const descriptor = detection.descriptor;
    let success = false;

    try {
      if (!hasFaceRegistered) {
        success = await registerFace(descriptor);
      } else {
        success = await updateFace(descriptor);
      }
      console.log('📡 API response success:', success);
    } catch (err) {
      console.error('❌ Erreur API:', err);
    }

    if (success) {
      stopCamera();
      setHasFaceRegistered(true);
      setStep('success');
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        localStorage.setItem('user', JSON.stringify({ ...u, hasFaceDescriptor: true }));
      }
    } else {
      setErrorMsg(faceError ?? "Échec de l'enregistrement.");
      setDetectionStatus('detected');
    }
  };

  const handleDelete = async () => {
    const success = await deleteFace();
    if (success) {
      setHasFaceRegistered(false);
    } else {
      setErrorMsg(faceError ?? 'Impossible de supprimer le visage.');
    }
  };

  const handleStart = () => (modelsLoaded ? startCamera() : loadModels());
  const handleCancel = () => {
    stopCamera();
    setStep('idle');
    setErrorMsg(null);
  };
  const handleRetry = () => {
    setErrorMsg(null);
    setStep('idle');
  };

  const isReady = detectionStatus === 'detected' && !isScanning;

  return (
    <div className="relative overflow-hidden mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <ScanFace size={34} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 m-0">Scan facial</h1>
          <p className="text-sm text-gray-500 m-0">Connectez-vous sans mot de passe avec votre visage</p>
        </div>
      </div>

      {/* Statut enregistrement */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`w-2 h-2 rounded-full shrink-0 transition-all ${
              hasFaceRegistered ? 'bg-green-500 ring-2 ring-green-100' : 'bg-red-500'
            }`}
          />
          <div>
            <p className="text-sm font-medium text-gray-900 m-0">
              {hasFaceRegistered ? 'Visage enregistré' : 'Aucun visage enregistré'}
            </p>
            <p className="text-xs text-gray-500 m-0">
              {hasFaceRegistered
                ? 'Vous pouvez vous connecter par reconnaissance faciale'
                : 'Enregistrez votre visage pour activer la connexion rapide'}
            </p>
          </div>
        </div>
        {hasFaceRegistered && step === 'idle' && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 text-red-500 border border-red-200 rounded-lg px-3 py-1.5 text-xs font-medium bg-transparent hover:bg-red-50 transition-colors cursor-pointer shrink-0"
          >
            <Trash2 size={12} />
            Supprimer
          </button>
        )}
      </div>

      {/* Card principale */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* IDLE */}
        {step === 'idle' && (
          <div className="px-6 py-8 text-center">
            <div className="w-40 h-40 rounded-lg bg-neutral-200 border border-gray-300 flex items-center justify-center mx-auto mb-4">
              <img src={face} className="h-full" alt="" />
            </div>
            <p className="text-sm font-medium text-gray-900 mb-2">
              {hasFaceRegistered ? 'Mettre à jour votre visage' : 'Enregistrer votre visage'}
            </p>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              Placez-vous dans un endroit bien éclairé.
              <br />
              Regardez directement la caméra.
            </p>
            <button
              onClick={handleStart}
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-all cursor-pointer border-0"
            >
              <Camera size={15} />
              Ouvrir la caméra
            </button>
          </div>
        )}

        {/* LOADING MODELS */}
        {step === 'loading_models' && (
          <div className="px-6 py-12 text-center">
            <Loader2 size={32} className="text-teal-600 animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500 m-0">Chargement des modèles IA…</p>
          </div>
        )}

        {/* CAMERA */}
        {step === 'camera' && (
          <div>
            {/* Flux vidéo */}
            <div className="relative bg-slate-900 max-w-125 mt-4 mx-auto aspect-4/3">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

              {/* Guide ovale — style inline uniquement pour le border dynamique */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="w-44 h-56 transition-all duration-300"
                  style={{
                    border: `2px dashed ${detectionStatus !== 'none' ? '#0d9488' : 'rgba(255,255,255,0.2)'}`,
                    borderRadius: '50% 50% 45% 45%'
                  }}
                />
              </div>

              {/* Badge statut */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-1.5 flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    detectionStatus !== 'none' ? 'bg-teal-400 animate-pulse' : 'bg-gray-500'
                  }`}
                />
                <span className="text-xs text-white font-medium whitespace-nowrap">
                  {detectionStatus === 'none' && 'Aucun visage détecté'}
                  {detectionStatus === 'detected' && 'Visage détecté — prêt'}
                  {detectionStatus === 'scanning' && 'Analyse en cours…'}
                </span>
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-2.5 p-4">
              <button
                onClick={handleCancel}
                className="flex-1 h-10 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleRegister}
                disabled={!isReady}
                className={`flex-2 h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all border-0 ${
                  isReady
                    ? 'bg-teal-600 hover:bg-teal-700 active:scale-95 text-white cursor-pointer'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isScanning ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Analyse…
                  </>
                ) : (
                  <>
                    <ScanFace size={15} /> Enregistrer ce visage
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {step === 'success' && (
          <div className="px-6 py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-teal-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Visage enregistré avec succès !</p>
            <p className="text-xs text-gray-500 mb-6">
              Vous pouvez maintenant vous connecter par reconnaissance faciale.
            </p>
            <button
              onClick={() => setStep('idle')}
              className="inline-flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg px-5 py-2 text-xs font-medium transition-colors cursor-pointer"
            >
              <RefreshCw size={12} />
              Mettre à jour
            </button>
          </div>
        )}

        {/* ERROR */}
        {step === 'error' && (
          <div className="px-6 py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-red-500" />
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Une erreur est survenue</p>
            <p className="text-xs text-gray-500 mb-6">{errorMsg}</p>
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-5 py-2 text-xs font-medium transition-colors cursor-pointer border-0"
            >
              <RefreshCw size={12} />
              Réessayer
            </button>
          </div>
        )}
      </div>

      {/* Note sécurité */}
      {step === 'idle' && (
        <p className="text-xs text-gray-400 text-center mt-3 leading-relaxed">
          🔒 Votre descripteur facial est chiffré et stocké de façon sécurisée. Il n'est jamais partagé ni utilisé à
          d'autres fins.
        </p>
      )}
    </div>
  );
}
