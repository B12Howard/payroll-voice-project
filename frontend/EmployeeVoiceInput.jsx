import { useState, useEffect } from 'react';
import { parse } from 'chrono-node';
import nlp from 'compromise';

function EmployeeVoiceInput({ onParse, availableVerbs, availableEmployees, disabled = false }) {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [error, setError] = useState(null);
  const [isIOS, setIsIOS] = useState(false);

  // Initialize speech recognition
  useEffect(() => {
    const iOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsIOS(iOS);
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      
      if (iOS) {
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = false;
      }
      
      recognitionInstance.onstart = () => {
        setIsListening(true);
        setError(null);
      };
      
      recognitionInstance.onresult = (event) => {
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          setInputText(finalTranscript);
          if (iOS) {
            recognitionInstance.stop();
          }
        }
      };
      
      recognitionInstance.onerror = (event) => {
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
    }
  }, [onParse]);

  const startListening = () => {
    if (recognition && !isListening) {
      try {
        recognition.start();
      } catch (error) {
        setError('Failed to start voice recognition. Please try again.');
      }
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop();
    }
  };

  // Preprocess text to convert 24-hour time format without colon (e.g., "1420" -> "14:20")
  const preprocessTime = (text) => {
    // Match 4-digit numbers that could be times (0000-2359)
    // Pattern: HHMM where HH is 00-23 and MM is 00-59
    let processedText = text;
    const timePattern = /\b([0-1][0-9]|2[0-3])([0-5][0-9])\b/g;
    let match;
    
    while ((match = timePattern.exec(text)) !== null) {
      const matchStr = match[0];
      const hours = match[1];
      const minutes = match[2];
      const matchIndex = match.index;
      
      // Get context around the match to determine if it's likely a time
      const beforeContext = text.substring(Math.max(0, matchIndex - 20), matchIndex);
      const afterContext = text.substring(matchIndex + matchStr.length, Math.min(text.length, matchIndex + matchStr.length + 10));
      
      // Time keywords that suggest this is a time
      const timeKeywords = /\b(at|on|in|time|:|am|pm|hour|hr)\b/i;
      // Date keywords that suggest this might be near a date
      const dateKeywords = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}(?:st|nd|rd|th)?)\b/i;
      
      // Check if it's in a time context
      const hasTimeKeyword = timeKeywords.test(beforeContext + afterContext);
      const hasDateBefore = dateKeywords.test(beforeContext);
      const isStandalone = !beforeContext.match(/\d/) && !afterContext.match(/\d/);
      
      // Convert if it looks like a time
      if (hasTimeKeyword || (hasDateBefore && !afterContext.match(/\d/)) || isStandalone) {
        processedText = processedText.replace(matchStr, `${hours}:${minutes}`);
        // Break after first replacement to avoid multiple replacements
        break;
      }
    }
    
    return processedText;
  };

  // Parse the input text to extract verb, name, row number, and date/time
  const parseInput = (text) => {
    // Preprocess text to handle 24-hour time format without colon
    const preprocessedText = preprocessTime(text);
    
    const doc = nlp(preprocessedText);
    const parsed = {
      verb: null,
      name: null,
      rowNumber: null,
      dateTime: null,
      dateComponents: null, // Store components separately for accurate timezone handling
      status: null,
      rawText: text
    };

    // Extract verb (add, change, delete)
    const verbs = ['add', 'change', 'delete', 'update', 'remove', 'create', 'modify'];
    const verbMatch = verbs.find(v => 
      preprocessedText.toLowerCase().includes(v) || 
      doc.has(`#Verb`) && doc.match(`#Verb`).out('text').toLowerCase().includes(v)
    );
    
    if (verbMatch) {
      // Normalize verb
      if (verbMatch === 'update' || verbMatch === 'modify') parsed.verb = 'change';
      else if (verbMatch === 'remove') parsed.verb = 'delete';
      else if (verbMatch === 'create') parsed.verb = 'add';
      else parsed.verb = verbMatch;
    }

    // Extract row number - look for "row", "number", "row number", or just a number in context
    const rowPattern = /row\s*(?:number|#|num)?\s*(\d+)/i;
    const numberPattern = /(?:^|\s)(\d+)(?:\s|$)/;
    let rowMatch = preprocessedText.match(rowPattern);
    if (!rowMatch) {
      // Try to find standalone numbers (but exclude 4-digit time-like numbers)
      const numbers = preprocessedText.match(/\b(\d{1,3}|\d{5,})\b/g);
      if (numbers && numbers.length > 0) {
        // If we have a verb like "delete" or "change", the number is likely a row number
        if (parsed.verb === 'delete' || parsed.verb === 'change') {
          rowMatch = [null, numbers[0]];
        }
      }
    }
    if (rowMatch) {
      parsed.rowNumber = parseInt(rowMatch[1]);
    }

    // Extract date/time using chrono (on preprocessed text with colon-separated time)
    // Parse with a reference date to ensure consistent timezone handling
    const chronoResults = parse(preprocessedText);
    if (chronoResults && chronoResults.length > 0) {
      const result = chronoResults[0];
      
      // Extract components directly from chrono's parsed result
      // This gives us the values chrono parsed without timezone conversion issues
      const start = result.start;
      if (start.isCertain('hour') && start.isCertain('minute')) {
        // Get the components that chrono parsed
        const year = start.get('year');
        const month = start.get('month');
        const day = start.get('day');
        const hour = start.get('hour');
        const minute = start.get('minute');
        
        // Create a Date object with these exact values
        // We'll treat these as if they're Pacific time
        // Note: JavaScript Date constructor interprets this as local time
        // So we need to be careful about timezone
        parsed.dateTime = new Date(year, month - 1, day, hour, minute);
        
        // Also store the components for direct use
        parsed.dateComponents = {
          year,
          month,
          day,
          hour,
          minute
        };
      } else {
        // Fallback to date() method if components aren't certain
        parsed.dateTime = result.start.date();
      }
    }

    // Extract status (In/Out)
    // Try multiple patterns to catch different formats
    let statusValue = null;
    
    // Pattern 1: "status in" or "status out" (most common)
    const statusPattern1 = /status\s+(in|out)\b/i;
    const match1 = preprocessedText.match(statusPattern1);
    if (match1) {
      statusValue = match1[1];
    }
    
    // Pattern 2: "in status" or "out status" (less common but possible)
    if (!statusValue) {
      const statusPattern2 = /\b(in|out)\s+status\b/i;
      const match2 = preprocessedText.match(statusPattern2);
      if (match2) {
        statusValue = match2[1];
      }
    }
    
    // Pattern 3: "clock in", "punch in", "check in", etc.
    if (!statusValue) {
      const statusContextPattern = /(?:status|clock|punch|check)\s*(in|out)\b/i;
      const match3 = preprocessedText.match(statusContextPattern);
      if (match3) {
        statusValue = match3[1];
      }
    }
    
    // Pattern 4: Standalone "in" or "out" as whole words (not part of other words)
    // Only match if they appear as separate words, not embedded in names
    if (!statusValue) {
      // Look for whole word "in" or "out" with word boundaries
      // Must be followed by end of string, punctuation, or certain keywords
      const standalonePattern = /\b(in|out)\b(?=\s+(?:status|row|number|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|\d{1,2})|[,.\s]*$|$)/i;
      const match4 = preprocessedText.match(standalonePattern);
      if (match4) {
        const matchIndex = preprocessedText.toLowerCase().indexOf(match4[0].toLowerCase());
        // Make sure it's not part of a longer word or a date phrase
        const beforeMatch = preprocessedText.substring(Math.max(0, matchIndex - 20), matchIndex);
        const afterMatch = preprocessedText.substring(matchIndex + match4[0].length, Math.min(preprocessedText.length, matchIndex + match4[0].length + 20));
        
        // Verify it's a standalone word, not part of a name or date
        const isStandaloneWord = !beforeMatch.match(/[a-z]$/i) && !afterMatch.match(/^[a-z]/i);
        const notInDatePhrase = !beforeMatch.match(/\b(in|out)\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|\d{1,2})/i);
        
        if (isStandaloneWord && notInDatePhrase) {
          statusValue = match4[1];
        }
      }
    }
    
    // Normalize to "In" or "Out" with capital letter
    if (statusValue) {
      parsed.status = statusValue.toLowerCase() === 'in' ? 'In' : 'Out';
    }

    // Extract name - improved to handle lowercase and non-Anglo names
    // First, try direct matching against employee list if available
    let potentialNames = [];
    
    if (availableEmployees && availableEmployees.length > 0) {
      // Search for employee names directly in the text (case-insensitive)
      const textLower = preprocessedText.toLowerCase();
      for (const emp of availableEmployees) {
        const empLower = emp.toLowerCase();
        if (textLower.includes(empLower)) {
          // Find the actual occurrence in original text for better matching
          const regex = new RegExp(emp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          const match = preprocessedText.match(regex);
          if (match) {
            potentialNames.push(match[0]);
          }
        }
      }
    }
    
    // If no direct match, try NLP-based extraction
    if (potentialNames.length === 0) {
      // Try to find proper nouns or names using compromise
      const properNouns = doc.match('#Person+');
      
      if (properNouns.length > 0) {
        potentialNames = properNouns.out('array');
      } else {
        // Extract words that could be names (including lowercase)
        // Look for word patterns that aren't verbs, dates, times, or numbers
        const words = preprocessedText.split(/\s+/);
        const excludedWords = new Set([
          'add', 'change', 'delete', 'update', 'remove', 'create', 'modify',
          'row', 'number', 'num', 'the', 'and', 'or', 'at', 'on', 'to', 'for',
          'of', 'from', 'by', 'status', 'jan', 'feb', 'mar', 'apr', 'may', 'jun',
          'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'january', 'february', 'march',
          'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
          'am', 'pm', 'hour', 'hr', 'time', 'date', 'today', 'tomorrow', 'yesterday'
          // Note: 'in' and 'out' are NOT excluded as they might be status values or names
        ]);
        
        // Filter out excluded words, numbers, and very short words
        const candidateNames = words.filter(word => {
          const wordLower = word.toLowerCase().replace(/[.,!?;:]/g, '');
          return wordLower.length >= 2 && 
                 !excludedWords.has(wordLower) &&
                 !/^\d+$/.test(wordLower) &&
                 !wordLower.match(/^\d{1,2}:\d{2}/); // Not a time
        });
        
        // Try to find name-like patterns (words that aren't common function words)
        // Prioritize words that appear after verbs or in name-like positions
        const verbIndex = preprocessedText.toLowerCase().search(/\b(add|change|delete|update|remove|create|modify)\b/);
        
        for (let i = 0; i < candidateNames.length; i++) {
          const word = candidateNames[i];
          const wordIndex = preprocessedText.toLowerCase().indexOf(word.toLowerCase());
          
          // Skip if it's part of a date pattern we already extracted
          if (parsed.dateTime) {
            const dateStr = new Date(parsed.dateTime).toLocaleDateString();
            if (dateStr.includes(word)) continue;
          }
          
          // Check if word looks like a name (starts with letter, reasonable length)
          if (/^[a-zA-Z]/.test(word) && word.length >= 2 && word.length <= 25) {
            // Prioritize words that appear shortly after verbs (likely names)
            const isAfterVerb = verbIndex !== -1 && wordIndex > verbIndex && wordIndex < verbIndex + 50;
            
            if (isAfterVerb) {
              // Insert at beginning to prioritize
              potentialNames.unshift(word);
            } else {
              potentialNames.push(word);
            }
          }
        }
        
        // Remove duplicates while preserving order
        potentialNames = [...new Set(potentialNames)];
      }
    }
    
    // Match against available employees if list is provided
    if (potentialNames.length > 0) {
      if (availableEmployees && availableEmployees.length > 0) {
        // Try exact match first, then partial match (case-insensitive)
        for (const name of potentialNames) {
          const nameClean = name.replace(/[.,!?;:]/g, '').trim();
          const matched = availableEmployees.find(emp => {
            const empLower = emp.toLowerCase().trim();
            const nameLower = nameClean.toLowerCase().trim();
            return empLower === nameLower ||
                   empLower.includes(nameLower) ||
                   nameLower.includes(empLower);
          });
          if (matched) {
            parsed.name = matched;
            break;
          }
        }
      }
      
      // If no match found but we have potential names, use the first one as fallback
      // This allows the system to work even without a predefined employee list
      if (!parsed.name && potentialNames.length > 0) {
        // Clean up the name (remove punctuation)
        parsed.name = potentialNames[0].replace(/[.,!?;:]/g, '').trim();
      }
    }

    return parsed;
  };

  const handleSubmit = () => {
    if (!inputText.trim()) {
      setError('Please enter or speak the command');
      return;
    }

    const parsed = parseInput(inputText);
    
    // Validate parsed data
    const validation = validateParsedData(parsed);
    
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    // Call the onParse callback with the parsed and validated data
    onParse(parsed);
    // Clear input text after successful parsing
    setInputText('');
  };

  const validateParsedData = (parsed) => {
    // Validate verb
    if (!parsed.verb) {
      return { valid: false, error: 'Could not identify action verb. Please say "add", "change", or "delete".' };
    }
    if (availableVerbs && !availableVerbs.includes(parsed.verb)) {
      return { valid: false, error: `Invalid verb. Must be one of: ${availableVerbs.join(', ')}` };
    }

    // Validate name
    if (!parsed.name) {
      return { valid: false, error: 'Could not identify employee name.' };
    }
    // If employee list is provided and populated, validate against it
    if (availableEmployees && availableEmployees.length > 0) {
      const matched = availableEmployees.find(emp => 
        emp.toLowerCase() === parsed.name.toLowerCase() ||
        emp.toLowerCase().includes(parsed.name.toLowerCase()) ||
        parsed.name.toLowerCase().includes(emp.toLowerCase())
      );
      if (!matched) {
        return { valid: false, error: `Employee "${parsed.name}" not found in employee list. Available: ${availableEmployees.join(', ')}` };
      }
      // Update parsed.name to use the matched name from the list (for consistency)
      parsed.name = matched;
    }

    // Validate row number (required for change and delete)
    if ((parsed.verb === 'change' || parsed.verb === 'delete') && !parsed.rowNumber) {
      return { valid: false, error: 'Row number is required for change and delete actions.' };
    }
    if (parsed.rowNumber && (isNaN(parsed.rowNumber) || parsed.rowNumber < 1)) {
      return { valid: false, error: 'Row number must be a positive number.' };
    }

    // Validate date/time (required for add and change)
    if ((parsed.verb === 'add' || parsed.verb === 'change') && !parsed.dateTime) {
      return { valid: false, error: 'Date and time are required for add and change actions.' };
    }
    if (parsed.dateTime && isNaN(new Date(parsed.dateTime).getTime())) {
      return { valid: false, error: 'Invalid date/time format.' };
    }

    return { valid: true };
  };

  const isSupported = recognition !== null;

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ 
        display: 'block', 
        marginBottom: '8px',
        fontWeight: '600'
      }}>
        Voice or Text Input:
      </label>
      
      <textarea
        value={inputText}
        onChange={(e) => {
          setInputText(e.target.value);
          setError(null); // Clear error when user types
        }}
        placeholder="e.g., Add sara on December 15 at 9 AM status In, or Change row 5 for ling to January 20 at 2 PM status Out, or Delete row 3 carmen status In"
        style={{
          width: '100%',
          minHeight: '80px',
          padding: '8px',
          fontSize: '14px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontFamily: 'inherit'
        }}
        disabled={disabled}
      />

      {isSupported && (
        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
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
              opacity: disabled ? 0.6 : 1
            }}
          >
            {isListening ? "🛑 Stop" : "🎤 Voice Input"}
          </button>
          
          {isListening && (
            <span style={{ color: "#dc3545", fontWeight: "600" }}>
              <span style={{
                width: "12px",
                height: "12px",
                backgroundColor: "#dc3545",
                borderRadius: "50%",
                display: "inline-block",
                marginRight: "8px",
                animation: "pulse 1s infinite"
              }} />
              Listening...
            </span>
          )}
        </div>
      )}

      {error && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          color: '#721c24',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {inputText && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled}
          style={{
            marginTop: '8px',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            opacity: disabled ? 0.6 : 1
          }}
        >
          Preview
        </button>
      )}

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

export default EmployeeVoiceInput;
