/**
 * Serverless School Device Status Portal - Backend API
 * 
 * INSTRUCTIONS:
 * 1. Open your Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Delete any existing code and paste this entire file.
 * 4. Save the project.
 * 5. Click "Deploy" > "New deployment".
 * 6. Select "Web app".
 * 7. Description: "School Device API".
 * 8. Execute as: "Me" (your email).
 * 9. Who has access: "Anyone".
 * 10. Click "Deploy" and copy the "Web App URL".
 */

// Configuration - SHEET NAMES MUST MATCH EXACTLY
const SHEET_SCHOOLS = "School_List";
const SHEET_QUESTIONS = "Device_Questions";
const SHEET_RESPONSES = "Responses";

/**
 * Handles GET requests to the Web App.
 * Acts as a router based on the 'action' parameter.
 */
function doGet(e) {
  const params = e.parameter;
  const action = params.action;

  // Enable CORS
  const output = (data) => {
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  };

  try {
    if (action === "getSchoolDetails") {
      return output(getSchoolDetails(params.code));
    } else if (action === "getDeviceQuestions") {
      return output(getDeviceQuestions());
    } else if (action === "getDashboardData") { 
      return output(getDashboardData());
    } else if (action === "getAllResponses") { 
      return output(getAllResponses());
    } else if (action === "getDeviceList") {
      return output(getDeviceList());
    } else if (action === "getSchoolList") {
      return output(getSchoolList());
    } else {
      return output({ status: "error", message: "Invalid action" });
    }
  } catch (err) {
    return output({ status: "error", message: err.toString() });
  }
}

/**
 * Handles POST requests (for data submission).
 */
function doPost(e) {
  const output = (data) => {
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  };

  try {
    const postData = JSON.parse(e.postData.contents);
    const result = submitResponse(postData);
    return output(result);
  } catch (err) {
    return output({ status: "error", message: err.toString() });
  }
}

/**
 * Fetches the master list of devices from the Questions sheet.
 * Used for the Admin Dashboard filter to ensure all devices are listed.
 */
function getDeviceList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_QUESTIONS);
  if (!sheet) return { status: "success", data: [] };

  const data = sheet.getDataRange().getValues();
  const devices = [];

  // Skip header, Col B(1) is Device Name
  for (let i = 1; i < data.length; i++) {
    const devName = data[i][1];
    if (devName) {
      devices.push(String(devName).trim());
    }
  }

  // Return unique list just in case
  return { status: "success", data: [...new Set(devices)] };
}

/**
 * Fetches the complete list of schools for pending calculation.
 * Returns school details needed to identify pending submissions.
 */
function getSchoolList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SCHOOLS);
  if (!sheet) return { status: "success", data: [] };

  const data = sheet.getDataRange().getValues();
  const schools = [];

  // Skip header row
  // Columns: A=SL.NO, B=DISTRICT, C=BLOCK, D=UDISE_CODE, E=SCHOOL_CODE, F=SCHOOL_NAME
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[3]) { // Has UDISE
      schools.push({
        udise: String(row[3]).trim(),
        school_code: String(row[4]).trim(),
        school_name: String(row[5]).trim(),
        district: String(row[1]).trim(),
        block: String(row[2]).trim()
      });
    }
  }

  return { status: "success", data: schools };
}

/**
 * Fetches ALL responses for export.
 */
function getAllResponses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RESPONSES);
  if (!sheet) return { status: "success", data: [] };
  
  const data = sheet.getDataRange().getValues();
  // Remove header row
  if (data.length > 0) data.shift(); 
  
  // Return plain array of objects for easier processing
  const formatted = data.map(row => {
    return {
      Timestamp: row[0],
      UDISE: row[1],
      School_Code: row[2],
      School_Name: row[3],
      User_Name: row[4],
      Mobile: row[5],
      Joining_Date: row[6],
      EVV: row[7],
      Info_Corner: row[8],
      Device: row[9],
      Status: row[10],
      Issue_Details: row[11],
      Remarks: row[12]
    };
  });

  return { status: "success", data: formatted };
}

/**
 * Fetches school details by UDISE Code or School Code.
 */
function getSchoolDetails(code) {
  if (!code) return { status: "error", message: "Code is required" };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SCHOOLS);
  if (!sheet) return { status: "error", message: "Sheet '" + SHEET_SCHOOLS + "' not found" };

  const data = sheet.getDataRange().getValues();
  
  // Skip header row (assuming row 1 is header)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // Check match for UDISE (Col D -> index 3) OR School Code (Col E -> index 4)
    // Convert to string for safe comparison and trim whitespace
    const udise = String(row[3]).trim();
    const sCode = String(row[4]).trim();
    const searchCode = String(code).trim();

    if (udise === searchCode || sCode === searchCode) {
      return {
        status: "success",
        data: {
          udise_code: row[3],      // Col D
          school_code: row[4],     // Col E
          school_name: row[5],     // Col F
          district: row[1],        // Col B
          block: row[2]            // Col C
        }
      };
    }
  }

  return { status: "error", message: "School not found" };
}

/**
 * Fetches device questions and options.
 */
function getDeviceQuestions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_QUESTIONS);
  if (!sheet) return { status: "error", message: "Sheet '" + SHEET_QUESTIONS + "' not found" };

  const data = sheet.getDataRange().getValues();
  
  const questions = [];
  
  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const deviceName = row[1]; // Col B
    const optionsRaw = row[2]; // Col C
    
    if (deviceName) {
      // Handle options splitting. Screenshot shows "Working/Not Working/ Issue..." 
      // We look for "/" or ",". If not found, default to standard.
      let options = ["Working", "Not Working", "Issue"];
      
      if (optionsRaw) {
        if (optionsRaw.toString().includes("/")) {
          options = optionsRaw.toString().split("/").map(opt => opt.trim());
        } else if (optionsRaw.toString().includes(",")) {
          options = optionsRaw.toString().split(",").map(opt => opt.trim());
        }
      }

      questions.push({
        device_name: deviceName,
        options: options
      });
    }
  }

  return { status: "success", data: questions };
}

/**
 * Submits the response data to Sheet 3.
 */
function submitResponse(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_RESPONSES);
  
  // Create sheet if it doesn't exist (fail-safe)
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_RESPONSES);
    sheet.appendRow([
      "Timestamp", "UDISE_CODE", "SCHOOL_CODE", "SCHOOL_NAME", 
      "User_Name", "Mobile_No", "Date_of_Joining", 
      "EVV_Registration", "Information_Corner", 
      "Device_Name", "Device_Status", "Issue_Details",
      "Overall_Remarks" // Added new column
    ]);
  }

  if (!data || !data.responses || !Array.isArray(data.responses)) {
    return { status: "error", message: "Invalid data format" };
  }

  const timestamp = new Date();
  const overallRemarks = data.overall_remarks || "";
  
  const rowsToAdd = data.responses.map(response => {
    return [
      timestamp,
      data.school_details.udise_code,
      data.school_details.school_code,
      data.school_details.school_name,
      data.user_details.user_name,
      data.user_details.mobile_no,
      data.user_details.date_of_joining,
      data.user_details.evv_registration,
      data.user_details.information_corner,
      response.device,
      response.status,
      response.issue || "",
      overallRemarks // Add remarks to every row for this submission
    ];
  });
  
  sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
  
  return { status: "success", message: "Data saved successfully" };
}

/**
 * Fetches dashboard data for the Admin Panel.
 * Returns summary stats and recent responses.
 */
function getDashboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Get Response Data
  const sheetRes = ss.getSheetByName(SHEET_RESPONSES);
  if (!sheetRes) return { status: "success", data: { total: 0, issues: 0, schools: 0, recent: [] } };
  
  const dataRes = sheetRes.getDataRange().getValues();
  // Header: Timestamp(0), UDISE(1), SCOD(2), SNAME(3), ... Device(9), Status(10), Issue(11) ...
  
  if (dataRes.length <= 1) return { status: "success", data: { total: 0, issues: 0, schools: 0, recent: [] } };
  
  let issueCount = 0;
  const uniqueSchools = new Set();
  const uniqueSubmissions = new Set(); // To track unique forms submitted
  const recentResponses = [];
  
  // Skip header
  // Limit recent items to last 50 for performance
  const startRow = Math.max(1, dataRes.length - 50); 
  
  for (let i = 1; i < dataRes.length; i++) {
    const row = dataRes[i];
    const timestamp = String(row[0]);
    const udise = String(row[1]);
    const status = String(row[10]).toLowerCase();
    
    // Count Issues
    if (status.includes("issue") || status.includes("not working")) {
      issueCount++;
    }
    
    // Track Unique Schools (by UDISE)
    if (udise) uniqueSchools.add(udise);

    // Track Unique Submissions (by Timestamp + UDISE)
    const submissionKey = timestamp + "_" + udise;
    uniqueSubmissions.add(submissionKey);
    
    // Collect recent data (limit 50)
    // We only want to show the specific device row, which is fine for the table.
    // The table shows "Recent Activity", implying device updates.
    if (i >= startRow) {
      recentResponses.unshift({ // Add to front (newest first)
        timestamp: row[0],
        school: row[3],
        device: row[9],
        status: row[10],
        issue: row[11]
      });
    }
  }

  // 2. Get Total Schools Count
  const sheetSchools = ss.getSheetByName(SHEET_SCHOOLS);
  const totalSchoolsListed = sheetSchools ? sheetSchools.getLastRow() - 1 : 0;

  return {
    status: "success",
    data: {
      total_responses: uniqueSubmissions.size, // Changed from total rows to total submissions
      total_issues: issueCount,
      schools_reported: uniqueSchools.size,
      total_schools: totalSchoolsListed,
      recent_activity: recentResponses
    }
  };
}

/**
 * Fetches ALL responses for export.
 */
function getAllResponses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RESPONSES);
  if (!sheet) return { status: "success", data: [] };
  
  const data = sheet.getDataRange().getValues();
  // Remove header row
  if (data.length > 0) data.shift(); 
  
  // Return plain array of objects for easier processing
  const formatted = data.map(row => {
    return {
      Timestamp: row[0],
      UDISE: row[1],
      School_Code: row[2],
      School_Name: row[3],
      User_Name: row[4],
      Mobile: row[5],
      Joining_Date: row[6],
      EVV: row[7],
      Info_Corner: row[8],
      Device: row[9],
      Status: row[10],
      Issue_Details: row[11],
      Remarks: row[12]
    };
  });

  return { status: "success", data: formatted };
}
