# Deployment Guide: School Device Status Portal

This guide explains how to deploy your serverless portal.

## Part 1: Backend (Google Apps Script)

1.  **Open your Google Sheet** (The one with `School_List` and `Device_Questions`).
2.  Go to top menu: **Extensions** > **Apps Script**.
3.  Delete any code in the editor and copy-paste the contents of `Code.gs`.
4.  **Save** the project (Ctrl+S).
5.  **Important:** Make sure your Sheet names match exactly:
    -   `School_List`
    -   `Device_Questions`
    -   `Responses` (This will be auto-created if missing, but better to create it yourself).
6.  **Deploy as Web App**:
    -   Click the blue **Deploy** button > **New deployment**.
    -   Click the gear icon (Select type) > **Web app**.
    -   **Description**: "School Portal v1".
    -   **Execute as**: **Me** (your email).
    -   **Who has access**: **Anyone** (This is crucial for public access without login).
    -   Click **Deploy**.
    -   **Authorize Access**: You will be asked to authorize. Click "Review permissions" > Choose account > Advanced > Go to (Project Name) (unsafe) > Allow.
7.  **Copy the Web App URL**. It starts with `https://script.google.com/macros/s/...`.

## Part 2: Connect Frontend

1.  Open the `script.js` file in the `school-device-portal` folder.
2.  Find line 6:
    ```javascript
    const API_URL = "YOUR_WEB_APP_URL_HERE";
    ```
3.  Replace `YOUR_WEB_APP_URL_HERE` with the Web App URL you just copied.
    -   Example: `const API_URL = "https://script.google.com/macros/s/AKfycbx.../exec";`
4.  Save the `script.js` file.

## Part 3: Deploy Frontend to Netlify

1.  **Login to Netlify**.
2.  Go to the **Sites** tab.
3.  Drag and drop the entire `school-device-portal` folder into the Netlify "upload" area.
4.  Wait for the upload to finish. Netlify will give you a random URL (e.g., `playful-panda-123456.netlify.app`).

## Part 4: Testing

1.  Open your Netlify URL.
2.  In the search box, enter a valid **UDISE Code** or **School Code** from your `School_List` sheet.
3.  Verify that school details (District, Block) appear.
4.  Check that the device questions are loaded from your `Device_Questions` sheet.
5.  Fill out the form and submit.
6.  Check your Google Sheet (`Responses` tab) to see the new data row!

## Common Errors & Fixes

-   **"School not found"**:
    -   Check if the code exists in your Sheet 1.
    -   Make sure UDISE codes in Excel don't have scientific notation (e.g., 2.01E+10). Format the column as "Plain Text" in Google Sheets.
-   **"Network Error" or Nothing happens**:
    -   Check the Console (F12 > Console) for red errors.
    -   Did you paste the correct `API_URL`?
    -   Did you set "Who has access" to "Anyone" in Apps Script? (If not, redeploy: Manage deployments > Edit > Anyone > Deploy).
-   **CORS Error**:
    -   Usually fixed by ensuring "Who has access" is "Anyone".
