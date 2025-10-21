import { useState, useEffect } from "react";
import VoiceToText from "./VoiceToText.jsx";

function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  // Check if screen is mobile size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Function to validate date format (YYYY-MM-DD)
  function isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  // Function to validate date range
  function validateDateRange(data) {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      
      if (!parsed.fromDate || !parsed.toDate) {
        return { valid: false, error: "Missing fromDate or toDate" };
      }
      
      if (!isValidDate(parsed.fromDate)) {
        return { valid: false, error: "Invalid fromDate format" };
      }
      
      if (!isValidDate(parsed.toDate)) {
        return { valid: false, error: "Invalid toDate format" };
      }
      
      const fromDate = new Date(parsed.fromDate);
      const toDate = new Date(parsed.toDate);
      
      if (fromDate > toDate) {
        return { valid: false, error: "fromDate cannot be after toDate" };
      }
      
      return { valid: true, data: parsed };
    } catch (error) {
      return { valid: false, error: "Invalid JSON format" };
    }
  }

  // Handle voice input
  function handleVoiceTranscript(transcript) {
    setText(transcript);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setProcessingStep("");

    try {
      // Step 1: Extract dates from OpenAI
      setProcessingStep("Extracting dates...");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
      console.log("Making request to:", apiUrl);
      
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spokenText: text }),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      
            // Step 2: Validate dates
            setProcessingStep("Validating dates...");
            const validation = validateDateRange(data.extractedDates);
            
            if (!validation.valid) {
              setResult({ 
                error: `Date validation failed: ${validation.error}`,
                rawResponse: data 
              });
              return;
            }
            
            // Server already handled the second endpoint call
            setResult({
              success: true,
              extractedDates: validation.data,
              payrollResult: data.secondEndpointResult,
              openaiResponse: data.openaiResponse
            });
      
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
      setProcessingStep("");
    }
  }

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      // height: "100vh", 
      fontFamily: "sans-serif",
      backgroundColor: "#f5f5f5",
    }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: "#fff", 
        padding: "1rem", 
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        zIndex: 1
      }}>
        <h2 style={{ margin: 0, color: "#333", fontSize: isMobile ? "1.2rem" : "1.5rem" }}>Payroll Voice Assistant</h2>
      </div>

      {/* Main Content */}
      <div style={{ 
        display: "flex", 
        flex: 1, 
        gap: isMobile ? "0.75rem" : "1rem", 
        padding: isMobile ? "0.75rem" : "1rem",
        flexDirection: isMobile ? "column" : "row"
      }}>
        {/* Left Panel - Input Form */}
        <div style={{ 
          flex: isMobile ? "0 0 auto" : "0 0 400px", 
          backgroundColor: "#fff", 
          borderRadius: "8px", 
          padding: isMobile ? "1rem" : "1.5rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
          maxWidth: isMobile ? "100%" : "400px",
          minHeight: isMobile ? "auto" : "0",
        }}>
          <form onSubmit={handleSubmit} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <label style={{ 
              fontSize: isMobile ? "1rem" : "1.1rem", 
              fontWeight: "600", 
              marginBottom: "0.5rem",
              color: "#333"
            }}>
              Enter Payroll Request:
            </label>
            <textarea
              placeholder="e.g. run payroll from Oct 1 to 15, or process last week's payroll"
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ 
                width: "100%", 
                padding: isMobile ? "10px" : "12px", 
                border: "2px solid #ddd",
                borderRadius: "6px",
                fontSize: "16px",
                minHeight: isMobile ? "80px" : "100px",
                resize: "vertical",
                fontFamily: "inherit",
                boxSizing: "border-box"
              }}
              required
            />
                   <VoiceToText 
                     onTranscript={handleVoiceTranscript}
                     disabled={loading}
                   />
                   
                   <button 
                     type="submit" 
                     disabled={loading}
                     style={{ 
                       marginTop: "1rem", 
                       padding: isMobile ? "14px 20px" : "12px 24px", 
                       backgroundColor: loading ? "#6c757d" : "#007bff",
                       color: "white", 
                       border: "none", 
                       borderRadius: "6px", 
                       fontSize: "16px",
                       fontWeight: "600",
                       cursor: loading ? "not-allowed" : "pointer",
                       transition: "background-color 0.2s",
                       minHeight: isMobile ? "48px" : "auto"
                     }}
                   >
                     {loading ? "Processing..." : "Process Payroll"}
                   </button>
          </form>

          {/* Status and Results */}
          {processingStep && (
            <div style={{ 
              marginTop: "1rem", 
              padding: "12px", 
              backgroundColor: "#e3f2fd", 
              borderRadius: "6px",
              border: "1px solid #2196f3"
            }}>
              <strong>Status:</strong> {processingStep}
            </div>
          )}

          {result && (
            <div style={{ 
              marginTop: "1rem", 
              maxHeight: "300px", 
              overflow: "auto"
            }}>
              {result.error ? (
                <div style={{ 
                  padding: "12px", 
                  backgroundColor: "#ffebee", 
                  borderRadius: "6px",
                  border: "1px solid #f44336",
                  color: "#c62828"
                }}>
                  <strong>Error:</strong> {result.error}
                </div>
              ) : result.success ? (
                <div style={{ 
                  padding: "12px", 
                  backgroundColor: "#e8f5e8", 
                  borderRadius: "6px",
                  border: "1px solid #4caf50"
                }}>
                  <strong>✅ Success!</strong>
                  <div style={{ marginTop: "8px" }}>
                    <strong>Extracted Dates:</strong>
                    <div style={{ fontSize: "14px", marginTop: "4px" }}>
                      From: {result.extractedDates.fromDate}<br/>
                      To: {result.extractedDates.toDate}
                    </div>
                  </div>
                  {result.payrollResult && (
                    <div style={{ marginTop: "8px" }}>
                      <strong>Payroll System Response:</strong>
                      <pre style={{ 
                        fontSize: "12px", 
                        marginTop: "4px", 
                        backgroundColor: "#f8f9fa", 
                        padding: "8px", 
                        borderRadius: "4px",
                        overflow: "auto"
                      }}>
                        {JSON.stringify(result.payrollResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <pre style={{ 
                  background: "#f8f9fa", 
                  padding: "12px", 
                  borderRadius: "6px",
                  fontSize: "12px",
                  overflow: "auto"
                }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Google Sheet */}
        <div style={{ 
          flex: 1, 
          backgroundColor: "#fff", 
          borderRadius: "8px", 
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          overflow: "hidden",
          minHeight: isMobile ? "400px" : "0"
        }}>
          <div style={{ 
            padding: isMobile ? "0.75rem" : "1rem", 
            borderBottom: "1px solid #eee",
            backgroundColor: "#f8f9fa"
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: isMobile ? "1rem" : "1.1rem", 
              color: "#333" 
            }}>
              Payroll Spreadsheet
            </h3>
            <p style={{ 
              margin: "0.5rem 0 0 0", 
              fontSize: isMobile ? "12px" : "14px", 
              color: "#666" 
            }}>
              View and manage payroll data
            </p>
          </div>
          <iframe
            src={import.meta.env.VITE_SHEET_URL}
            style={{
              width: "100%",
              height: "100%",
              minHeight: "800px",
              border: "none",
              borderRadius: "0 0 8px 8px"
            }}
            title="Payroll Spreadsheet"
          />
        </div>
      </div>
    </div>
  );
}

export default App;
