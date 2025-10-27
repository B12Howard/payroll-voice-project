import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import VoiceToText from "./VoiceToText.jsx";
import Login from "./Login.jsx";
import "./App.css";

function App() {
  const { user, loading, logout } = useAuth();
  
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loadingApps, setLoadingApps] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  
  // Employee management state
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [actionType, setActionType] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [number, setNumber] = useState("");
  const [status, setStatus] = useState("In");
  const [employeeResult, setEmployeeResult] = useState(null);
  const [showDateTimeModal, setShowDateTimeModal] = useState(false);

  // Auto-clear result after 5 seconds
  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => {
        setResult(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  // Auto-clear employeeResult after 5 seconds
  useEffect(() => {
    if (employeeResult) {
      const timer = setTimeout(() => {
        setEmployeeResult(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [employeeResult]);

  // Check if screen is mobile size - MUST be called before any conditional returns
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Show login if not authenticated (moved after all hooks)
  if (loading) {
    return <div className="loading-spinner">Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

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

  // Parse datetime in Pacific time (returns 24-hour format)
  function parsePacificTime(dateTimeString) {
    if (!dateTimeString) return null;
    
    // Parse the datetime-local string (YYYY-MM-DDTHH:mm)
    const localDate = new Date(dateTimeString);
    
    // Get Pacific time components using toLocaleString
    // hour12: false ensures 24-hour format (0-23)
    const pstMonth = parseInt(localDate.toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "numeric" }));
    const pstDay = parseInt(localDate.toLocaleString("en-US", { timeZone: "America/Los_Angeles", day: "numeric" }));
    const pstHour = parseInt(localDate.toLocaleString("en-US", { timeZone: "America/Los_Angeles", hour: "2-digit", hour12: false }));
    const pstMinute = parseInt(localDate.toLocaleString("en-US", { timeZone: "America/Los_Angeles", minute: "2-digit" }));
    
    return {
      month: pstMonth,   // 1-12
      day: pstDay,       // 1-31
      hour: pstHour,     // 0-23 (24-hour format)
      minute: pstMinute  // 0-59
    };
  }

  // Handle employee management submit
  async function handleEmployeeSubmit(e) {
    e.preventDefault();
    
    if (!selectedEmployee || !actionType) {
      setEmployeeResult({ error: "Please select an employee and action." });
      return;
    }

    try {
      setLoadingApps(true);
      
      // Use the server-side CRUD endpoint to avoid CORS issues
      // For now, we'll call the cloud function with the same URL structure
      // In production, this would be the dedicated CRUD Cloud Function URL
      const crudFunctionUrl = import.meta.env.VITE_CRUD_URL || "http://localhost:8081";
      
      let requestBody = {
        action: actionType,
        employee: selectedEmployee
      };

      // Build options based on action type
      if (actionType === "add") {
        if (!dateTime) {
          throw new Error("Please select a date and time");
        }
        const pstTime = parsePacificTime(dateTime);
        requestBody.opts = {
          month: pstTime.month,
          day: pstTime.day,
          hour: pstTime.hour,
          minute: pstTime.minute,
          status: status
        };
      } else if (actionType === "change") {
        if (!dateTime || !number) {
          throw new Error("Please enter both date/time and row number");
        }
        const pstTime = parsePacificTime(dateTime);
        requestBody.opts = {
          rowNum: parseInt(number),
          newMonth: pstTime.month,
          newDay: pstTime.day,
          newHour: pstTime.hour,
          newMinute: pstTime.minute,
          status: status
        };
      } else if (actionType === "delete") {
        if (!number) {
          throw new Error("Please enter a row number");
        }
        requestBody.opts = {
          rowNum: parseInt(number)
        };
      }

      // Get Firebase ID token for authentication
      const idToken = user ? await user.getIdToken() : null;
      
      const res = await fetch(crudFunctionUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(idToken && { "Authorization": `Bearer ${idToken}` })
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setEmployeeResult(data);
      
      // Clear form fields if successful
      if (data.success) {
        setSelectedEmployee("");
        setActionType("");
        setDateTime("");
        setNumber("");
        setStatus("In");
      }
      
    } catch (err) {
      setEmployeeResult({ error: err.message });
    } finally {
      setLoadingApps(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoadingApps(true);
    setResult(null);
    setProcessingStep("");

    try {
      // Step 1: Extract dates from OpenAI
      setProcessingStep("Extracting dates...");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
      console.log("Making request to:", apiUrl);
      
      // Get Firebase ID token for authentication
      const idToken = user ? await user.getIdToken() : null;
      
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(idToken && { "Authorization": `Bearer ${idToken}` })
        },
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
      setLoadingApps(false);
      setProcessingStep("");
    }
  }

  return (
    <div className="app-container">
      {/* Header */}
      <div className="header">
        <h2 className={isMobile ? "header-title header-title-mobile" : "header-title"}>Payroll Voice Assistant</h2>
        <button onClick={logout} className="logout-button">
          Sign Out
        </button>
      </div>

      {/* Main Content */}
      <div className={isMobile ? "main-content main-content-mobile" : "main-content"}>
        {/* Left Panel - Input Form */}
        <div className={isMobile ? "left-panel left-panel-mobile" : "left-panel"}>
          <form onSubmit={handleSubmit} className="form">
            <label className={isMobile ? "form-label form-label-mobile" : "form-label"}>
              Enter Payroll Request:
            </label>
            <textarea
              placeholder="e.g. run payroll from Oct 1 to 15, or process last week's payroll"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={isMobile ? "textarea textarea-mobile" : "textarea"}
              required
            />
            <VoiceToText 
              onTranscript={handleVoiceTranscript}
              disabled={loadingApps}
            />
            
            <button 
              type="submit" 
              disabled={loadingApps}
              className={isMobile ? "submit-button submit-button-mobile" : "submit-button"}
            >
              {loadingApps ? "Processing..." : "Process Payroll"}
            </button>
          </form>

          {result && (
            <div className="results-container">
              {result.error ? (
                <div className="error-box">
                  <strong>Error:</strong> {result.error}
                </div>
              ) : result.success ? (
                <div className="success-box">
                  <strong>✅ Success!</strong>
                  <div className="payroll-result-section">
                    <strong>Extracted Dates:</strong>
                    <div className="success-box-details">
                      From: {result.extractedDates.fromDate}<br/>
                      To: {result.extractedDates.toDate}
                    </div>
                  </div>
                  {result.payrollResult && (
                    <div className="payroll-result-section">
                      <strong>Payroll System Response:</strong>
                      <pre className="payroll-result-pre">
                        {JSON.stringify(result.payrollResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <pre className="results-pre">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Employee Management Section */}
          <div className="employee-section">
            <h3 className={isMobile ? "section-title section-title-mobile" : "section-title"}>
              Employee Management
            </h3>
            
            <form onSubmit={handleEmployeeSubmit} className="form">
              {/* Employee Name Input */}
              <label className={isMobile ? "form-label form-label-mobile" : "form-label"}>
                Employee Name:
              </label>
              <input
                type="text"
                value={selectedEmployee}
                onChange={(e) => {
                  setSelectedEmployee(e.target.value);
                  setActionType(""); // Reset action when employee changes
                }}
                placeholder="Enter employee name"
                className={isMobile ? "text-input text-input-mobile" : "text-input"}
              />

              {/* Action Type Dropdown - only show when employee is selected */}
              {selectedEmployee && (
                <>
                  <label className={isMobile ? "form-label form-label-mobile" : "form-label"}>
                    Action:
                  </label>
                  <select
                    value={actionType}
                    onChange={(e) => {
                      setActionType(e.target.value);
                      setDateTime("");
                      setNumber("");
                    }}
                    className={isMobile ? "select-input select-input-mobile" : "select-input"}
                  >
                    <option value="">Select action...</option>
                    <option value="add">Add</option>
                    <option value="change">Change</option>
                    <option value="delete">Delete</option>
                  </select>

                  {/* Conditional inputs based on action type */}
                  {actionType === "add" && (
                    <>
                      <label className={isMobile ? "form-label form-label-mobile" : "form-label"}>
                        Date & Time:
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowDateTimeModal(true)}
                        className={isMobile ? "datetime-button datetime-button-mobile" : "datetime-button"}
                      >
                        {dateTime ? new Date(dateTime).toLocaleString() : "Select Date & Time"}
                      </button>
                      <label className={isMobile ? "form-label form-label-mobile" : "form-label"}>
                        Status:
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className={isMobile ? "select-input select-input-mobile" : "select-input"}
                      >
                        <option value="In">In</option>
                        <option value="Out">Out</option>
                      </select>
                    </>
                  )}

                  {actionType === "delete" && (
                    <>
                      <label className={isMobile ? "form-label form-label-mobile" : "form-label"}>
                        Row Number:
                      </label>
                      <input
                        type="number"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        placeholder="Enter row number to delete"
                        className={isMobile ? "number-input number-input-mobile" : "number-input"}
                        min="1"
                      />
                    </>
                  )}

                  {actionType === "change" && (
                    <>
                      <label className={isMobile ? "form-label form-label-mobile" : "form-label"}>
                        Date & Time:
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowDateTimeModal(true)}
                        className={isMobile ? "datetime-button datetime-button-mobile" : "datetime-button"}
                      >
                        {dateTime ? new Date(dateTime).toLocaleString() : "Select Date & Time"}
                      </button>
                      <label className={isMobile ? "form-label form-label-mobile" : "form-label"}>
                        Row Number:
                      </label>
                      <input
                        type="number"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        placeholder="Enter row number to change"
                        className={isMobile ? "number-input number-input-mobile" : "number-input"}
                        min="1"
                      />
                      <label className={isMobile ? "form-label form-label-mobile" : "form-label"}>
                        Status:
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className={isMobile ? "select-input select-input-mobile" : "select-input"}
                      >
                        <option value="In">In</option>
                        <option value="Out">Out</option>
                      </select>
                    </>
                  )}

                  {/* Submit Button */}
                  {actionType && (
                    <button 
                      type="submit" 
                      disabled={loadingApps}
                      className={isMobile ? "submit-button submit-button-mobile" : "submit-button"}
                    >
                      {loadingApps ? "Processing..." : `Submit ${actionType}`}
                    </button>
                  )}
                </>
              )}
            </form>

            {/* Employee Result Display */}
            {employeeResult && (
              <div className="employee-result">
                {employeeResult.error ? (
                  <div className="error-box">
                    <strong>Error:</strong> {employeeResult.error}
                  </div>
                ) : (
                  <div className="success-box">
                    <strong>✅ Success!</strong>
                    <div className="success-box-details">
                      {employeeResult.message || `Action '${employeeResult.action}' completed for ${employeeResult.employee}`}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status and Results */}
          {processingStep && (
            <div className="status-box">
              <strong>Status:</strong> {processingStep}
            </div>
          )}
        </div>

        {/* Right Panel - Google Sheet */}
        <div className={isMobile ? "right-panel right-panel-mobile" : "right-panel"}>
          <div className={isMobile ? "right-panel-header right-panel-header-mobile" : "right-panel-header"}>
            <h3 className={isMobile ? "right-panel-title right-panel-title-mobile" : "right-panel-title"}>
              Payroll Spreadsheet
            </h3>
            <p className={isMobile ? "right-panel-description right-panel-description-mobile" : "right-panel-description"}>
              View and manage payroll data
            </p>
          </div>
          <iframe
            src={import.meta.env.VITE_SHEET_URL}
            className="spreadsheet-iframe"
            title="Payroll Spreadsheet"
          />
        </div>
      </div>

      {/* DateTime Modal */}
      {showDateTimeModal && (
        <div className="modal-overlay" onClick={() => setShowDateTimeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select Date & Time</h3>
              <button 
                className="modal-close"
                onClick={() => setShowDateTimeModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="datetime-input"
                style={{ width: '100%', fontSize: '16px' }}
              />
            </div>
            <div className="modal-footer">
              <button
                className="modal-button modal-button-primary"
                onClick={() => setShowDateTimeModal(false)}
              >
                Done
              </button>
              <button
                className="modal-button modal-button-secondary"
                onClick={() => {
                  setDateTime("");
                  setShowDateTimeModal(false);
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
