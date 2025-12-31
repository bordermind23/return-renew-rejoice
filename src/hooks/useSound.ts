// 使用 Web Audio API 生成简单提示音
const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

type SoundType = 'success' | 'error' | 'warning';

const soundConfigs: Record<SoundType, { frequency: number; duration: number; type: OscillatorType }[]> = {
  success: [
    { frequency: 523.25, duration: 0.1, type: 'sine' }, // C5
    { frequency: 659.25, duration: 0.1, type: 'sine' }, // E5
    { frequency: 783.99, duration: 0.15, type: 'sine' }, // G5
  ],
  error: [
    { frequency: 200, duration: 0.15, type: 'square' },
    { frequency: 150, duration: 0.2, type: 'square' },
  ],
  warning: [
    { frequency: 440, duration: 0.1, type: 'triangle' },
    { frequency: 440, duration: 0.1, type: 'triangle' },
  ],
};

export const playSound = (type: SoundType = 'success') => {
  if (!audioContext) return;

  // Resume audio context if suspended (required for autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const config = soundConfigs[type];
  let startTime = audioContext.currentTime;

  config.forEach(({ frequency, duration, type: oscType }) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = oscType;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    // Envelope for smooth sound
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);

    startTime += duration;
  });
};

export const useSound = () => {
  return {
    playSuccess: () => playSound('success'),
    playError: () => playSound('error'),
    playWarning: () => playSound('warning'),
  };
};
