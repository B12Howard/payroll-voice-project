import { setCorsHeaders, handlePreflight, isOriginAllowed } from './utils.js';

export const crud = async (req, res) => {
  const origin = req.headers.origin;
  
  // Set CORS headers FIRST (before any method checks)
  setCorsHeaders(req, res);

  // Handle preflight OPTIONS request
  const preflight = handlePreflight(req, res);
  if (preflight === false) {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    // Security: Only allow requests from allowed origins
    if (!isOriginAllowed(req)) {
      console.log("Blocked request from unauthorized origin:", origin);
      return res.status(403).json({ error: "Forbidden: Origin not allowed" });
    }
  } else {
    return preflight;
  }

  const { action, employee, opts } = req.body;

  // Validate required parameters
  if (!action || !employee) {
    return res.status(400).json({ 
      success: false, 
      error: "Missing required parameters: 'action' or 'employee'." 
    });
  }

  try {
    // Get the CRUD endpoint URL from environment variables
    const crudEndpointUrl = process.env.CRUD_ENDPOINT_URL;
    
    if (!crudEndpointUrl || crudEndpointUrl === "undefined") {
      return res.status(500).json({ 
        success: false, 
        error: "CRUD endpoint not configured" 
      });
    }

    console.log("Calling CRUD endpoint:", crudEndpointUrl);
    console.log("Request data:", { action, employee, opts });
    
    // Make request to the actual CRUD API
    const crudResponse = await fetch(crudEndpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, employee, opts, route: "updateEmployee" }),
    });
    
    if (!crudResponse.ok) {
      const errorText = await crudResponse.text();
      throw new Error(`CRUD endpoint error: ${crudResponse.status} ${crudResponse.statusText} - ${errorText}`);
    }
    
    const result = await crudResponse.json();
    
    console.log("CRUD result:", result);
    
    // Return the result
    res.status(200).json(result);
    
  } catch (err) {
    console.error("CRUD error:", err.message);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};
