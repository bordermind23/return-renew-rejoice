import { useState, useCallback, useRef, useEffect } from 'react';

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface UseSpeechToTextOptions {
  onResult?: (text: string) => void;
  onError?: (error: string) => void;
  language?: string;
  continuous?: boolean;
}

export const useSpeechToText = (options: UseSpeechToTextOptions = {}) => {
  const {
    onResult,
    onError,
    language = 'zh-CN',
    continuous = true,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isListeningRef = useRef(false);
  
  // 使用 ref 保存回调，避免 useEffect 重复执行
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  
  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognitionAPI);

    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptText = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptText;
          } else {
            interimTranscript += transcriptText;
          }
        }

        const currentTranscript = finalTranscript || interimTranscript;
        setTranscript(currentTranscript);
        
        if (finalTranscript && onResultRef.current) {
          console.log('Speech recognized:', finalTranscript);
          onResultRef.current(finalTranscript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        // 忽略 aborted 和 no-speech 错误，这些是正常的
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          let errorMessage = '语音识别错误';
          switch (event.error) {
            case 'audio-capture':
              errorMessage = '无法访问麦克风';
              break;
            case 'not-allowed':
              errorMessage = '麦克风权限被拒绝';
              break;
            case 'network':
              errorMessage = '网络错误，请检查网络连接';
              break;
          }
          if (onErrorRef.current) {
            onErrorRef.current(errorMessage);
          }
          setIsListening(false);
          isListeningRef.current = false;
        }
      };

      recognition.onend = () => {
        console.log('Speech recognition ended, isListeningRef:', isListeningRef.current);
        // 如果用户没有手动停止，自动重新开始
        if (isListeningRef.current) {
          setTimeout(() => {
            if (isListeningRef.current && recognitionRef.current) {
              try {
                console.log('Restarting speech recognition...');
                recognitionRef.current.start();
              } catch (e) {
                console.log('Could not restart:', e);
              }
            }
          }, 100);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [language, continuous]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListeningRef.current) {
      setTranscript('');
      isListeningRef.current = true;
      try {
        console.log('Starting speech recognition...');
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setIsListening(false);
        isListeningRef.current = false;
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    console.log('Stopping speech recognition...');
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  };
};
