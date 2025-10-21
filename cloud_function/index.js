import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";
import { env } from 'process';

// Load environment variables from .env file for local development
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

export const extractDates = async (req, res) => {
  // Define allowed origins from environment variables
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [
        "http://localhost:5001",      // Default local development
        "https://localhost:5001",     
        "http://localhost:3000",      
        "https://localhost:3000"      
      ];
  
  const origin = req.headers.origin;
  
  // Debug logging
  console.log("Request origin:", origin);
  console.log("Allowed origins:", allowedOrigins);
  console.log("Origin allowed:", allowedOrigins.includes(origin));
  
  // Set CORS headers FIRST (before any method checks)
  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.set("Access-Control-Allow-Credentials", "true");
  res.set("Access-Control-Max-Age", "86400");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  // Security: Only allow requests from allowed origins
  if (!allowedOrigins.includes(origin)) {
    console.log("Blocked request from unauthorized origin:", origin);
    return res.status(403).json({ error: "Forbidden: Origin not allowed" });
  }

  const { spokenText } = req.body;
  const date = new Date();

  const targetTimezone = 'America/Los_Angeles'; 

  // Create a DateTimeFormat object with desired options and the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: targetTimezone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Format the date for the specified timezone
  const formattedDate = formatter.format(date);
  const formattedDayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedMonth = date.toLocaleDateString('en-US', { month: 'long' });
  const prompt = `Convert the following text into a JSON object with \"fromDate\" and \"toDate\" in YYYY-MM-DD format.\n\nRules:\n1. If the text explicitly mentions one or more dates, use them as the range boundaries in ISO format.\n2. If only one date is mentioned, assume two payroll ranges each month: 1st–15th and 16th–end of month.\n3. If the text contains relative time phrases such as 'last week', 'this week', 'this pay period', or 'last pay period', calculate the corresponding date range relative to the current date.\n4. If the text is vague (for example, contains 'timeclock' or 'payroll' without specific dates): if today is 1–15, use the previous month's second range; if today is 16–end, use the current month's first range.\n5. Assume the year is the current year.\nReturn only valid JSON with 'fromDate' and 'toDate'. Current date: ${formattedDate}, Current Day of Week: ${formattedDayOfWeek}, Current Month: ${formattedMonth}. Text: "${spokenText}". Please respond with valid JSON only.`;

  try {
    // Read OpenAI API key - try environment variable first (for local testing), then secret volume
    let openaiApiKey;
    if (process.env.OPENAI_API_KEY) {
      openaiApiKey = process.env.OPENAI_API_KEY;
    } else {
      // Production: read from mounted secret volume
      openaiApiKey = fs.readFileSync('/etc/secrets/openai-api-key', 'utf8').trim();
    }
    
    // Check if we should use mock response (for testing when quota is exceeded)
    if (process.env.USE_MOCK_RESPONSE === "true") {
      const mockResponse = {
        id: "mock-response",
        object: "chat.completion",
        created: Date.now(),
        model: "gpt-4o-mini",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              fromDate: "2024-10-01",
              toDate: "2024-10-15"
            })
          },
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 20,
          total_tokens: 70
        }
      };
      return res.status(200).json(mockResponse);
    }
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });
    
    // Make request to OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    // Parse the extracted dates from OpenAI response
    let parsedData = null;
    try {
      const content = completion.choices?.[0]?.message?.content;
      if (content) {
        parsedData = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", parseError.message);
      return res.status(500).json({ error: "Failed to parse date extraction response" });
    }

          // Step 2: Send to Google Apps Script if configured
          let secondEndpointResult = null;
          const secondEndpointUrl = process.env.SECOND_ENDPOINT_URL;
          
          if (secondEndpointUrl && secondEndpointUrl !== "undefined") {
            try {
              console.log("Calling second endpoint:", secondEndpointUrl);
              
              const payload = {
                fromDate: parsedData.fromDate,
                toDate: parsedData.toDate,
                originalText: spokenText,
                extractedAt: new Date().toISOString()
              };
              
              const secondResponse = await fetch(secondEndpointUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              });
              
              if (!secondResponse.ok) {
                throw new Error(`Second endpoint error: ${secondResponse.status} ${secondResponse.statusText}`);
              }
              
              secondEndpointResult = await secondResponse.text();
              
              // Try to parse as JSON, fallback to text
              try {
                secondEndpointResult = JSON.parse(secondEndpointResult);
              } catch (parseError) {
                console.log("Second endpoint returned non-JSON response:", secondEndpointResult);
              }
              
            } catch (secondError) {
              console.error("Failed to call second endpoint:", secondError.message);
              // Don't fail the entire request, just log the error
              secondEndpointResult = { 
                error: "Failed to call second endpoint", 
                details: secondError.message 
              };
            }
          }

          // Return extracted dates and second endpoint result
          res.status(200).json({
            success: true,
            extractedDates: parsedData,
            openaiResponse: completion,
            secondEndpointResult: secondEndpointResult
          });
  } catch (err) {
    // If quota exceeded, provide helpful error message
    if (err.message.includes("429") || err.message.includes("quota")) {
      res.status(500).json({ 
        error: "OpenAI API quota exceeded. Please check your billing details at https://platform.openai.com/",
        details: err.message,
        suggestion: "Set USE_MOCK_RESPONSE=true for testing"
      });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
};

// Default export for Cloud Functions Gen 2
export default extractDates;
