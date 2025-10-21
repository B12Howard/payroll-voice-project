import { useState, useEffect } from 'react';

function VoiceToText({ onTranscript, disabled = false }) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState(null);
  const [recognition, setRecognition] = useState(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const iOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsIOS(iOS);
    
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      
      // iOS Chrome specific settings
      if (iOS) {
        recognitionInstance.continuous = true; // iOS requires continuous mode
        recognitionInstance.interimResults = false; // iOS works better without interim results
      }
      
      recognitionInstance.onstart = () => {
        setIsListening(true);
        setError(null);
      };
      
      recognitionInstance.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Call the callback with the transcript
        if (finalTranscript) {
          onTranscript(finalTranscript);
          // On iOS, stop recognition after getting a result
          if (iOS) {
            recognitionInstance.stop();
          }
        }
      };
      
      recognitionInstance.onerror = (event) => {
        console.log('Speech recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
    } else {
      setIsSupported(false);
      setError('Speech recognition not supported in this browser');
    }
  }, [onTranscript]);

  const startListening = () => {
    if (recognition && !isListening) {
      try {
        recognition.start();
      } catch (error) {
        console.log('Error starting recognition:', error);
        setError('Failed to start voice recognition. Please try again.');
      }
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      try {
        recognition.stop();
      } catch (error) {
        console.log('Error stopping recognition:', error);
      }
    }
  };

  if (!isSupported) {
    return (
      <div style={{ 
        padding: "12px", 
        backgroundColor: "#fff3cd", 
        border: "1px solid #ffeaa7",
        borderRadius: "6px",
        color: "#856404"
      }}>
        ⚠️ Voice input not supported in this browser. Please use Chrome or Edge.
      </div>
    );
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <div style={{ 
        display: "flex", 
        gap: "8px", 
        alignItems: "center",
        marginBottom: "8px"
      }}>
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          disabled={disabled}
          style={{
            padding: isIOS ? "12px 20px" : "8px 16px",
            backgroundColor: isListening ? "#dc3545" : "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: isIOS ? "16px" : "14px",
            fontWeight: "600",
            opacity: disabled ? 0.6 : 1,
            transition: "background-color 0.2s",
            minHeight: isIOS ? "48px" : "auto"
          }}
        >
          {isListening ? "🛑 Stop Recording" : "🎤 Start Voice Input"}
        </button>
        
        {isListening && (
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            color: "#dc3545",
            fontSize: "14px",
            fontWeight: "600"
          }}>
            <div style={{
              width: "12px",
              height: "12px",
              backgroundColor: "#dc3545",
              borderRadius: "50%",
              marginRight: "8px",
              animation: "pulse 1s infinite"
            }} />
            Listening...
          </div>
        )}
      </div>
      
      {error && (
        <div style={{ 
          padding: "8px", 
          backgroundColor: "#f8d7da", 
          border: "1px solid #f5c6cb",
          borderRadius: "4px",
          color: "#721c24",
          fontSize: "14px"
        }}>
          {error}
        </div>
      )}
      
      <div style={{ 
        fontSize: "12px", 
        color: "#666", 
        marginTop: "4px" 
      }}>
        {isIOS ? (
          <>💡 Tap the microphone button and speak your payroll request. On iOS, you may need to allow microphone access.</>
        ) : (
          <>💡 Click the microphone button and speak your payroll request</>
        )}
      </div>
      
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default VoiceToText;
