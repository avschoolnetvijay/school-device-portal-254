/**
 * School Device Status Portal - Frontend Logic
 */

// ==========================================
// CONFIGURATION
// ==========================================
// ⚠️ IMPORTANT: REPLACE THIS URL with your deployed Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbxImmOH_2m_7q6z72qdZ4HFBcufj0iPOUhk7rff5iOegkUV8ozHfFm42Ze9MTENwVRvSg/exec";
// Example format: https://script.google.com/macros/s/AKfycbx.../exec

// State
let currentSchool = null;
let deviceData = [];

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Optional: Pre-load questions if you want to save time later
    // loadQuestions(); 
});

// ==========================================
// SEARCH LOGIC
// ==========================================
async function searchSchool() {
    const code = document.getElementById("school-code").value.trim();
    const errorDiv = document.getElementById("search-error");

    if (!code) {
        errorDiv.textContent = "Please enter a valid code.";
        return;
    }

    if (API_URL === "YOUR_WEB_APP_URL_HERE") {
        alert("⚠️ Please replace 'YOUR_WEB_APP_URL_HERE' in script.js with your actual Google Apps Script Web App URL.");
        return;
    }

    showLoader(true);
    errorDiv.textContent = "";

    try {
        const response = await fetch(`${API_URL}?action=getSchoolDetails&code=${encodeURIComponent(code)}`);
        const result = await response.json();

        if (result.status === "success") {
            currentSchool = result.data;
            displaySchoolDetails(result.data);
            showMainForm();
            loadQuestions(); // Load questions only after successful school search
        } else {
            errorDiv.textContent = result.message || "School not found. Please check the code.";
        }
    } catch (error) {
        console.error("Search Error:", error);
        errorDiv.textContent = "Network error. Please try again.";
    } finally {
        showLoader(false);
    }
}

function displaySchoolDetails(data) {
    document.getElementById("disp-school-name").textContent = data.school_name;
    document.getElementById("disp-district").textContent = data.district;
    document.getElementById("disp-block").textContent = data.block;
    document.getElementById("disp-udise").textContent = data.udise_code;
}

function showMainForm() {
    document.getElementById("main-form").classList.remove("hidden");
    // Scroll to details
    document.getElementById("school-details-section").scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// QUESTIONS & DYNAMIC FORM
// ==========================================
async function loadQuestions() {
    const container = document.getElementById("questions-container");
    const loader = document.getElementById("loading-questions");

    // Prevent reloading if already loaded
    if (container.children.length > 0) return;

    loader.classList.remove("hidden");

    try {
        const response = await fetch(`${API_URL}?action=getDeviceQuestions`);
        const result = await response.json();

        if (result.status === "success") {
            deviceData = result.data;
            renderQuestions(deviceData);
        } else {
            container.innerHTML = "<p class='error-msg'>Failed to load questions.</p>";
        }
    } catch (error) {
        console.error("Questions Error:", error);
        container.innerHTML = "<p class='error-msg'>Network error loading questions.</p>";
    } finally {
        loader.classList.add("hidden");
    }
}

function renderQuestions(questions) {
    const container = document.getElementById("questions-container");
    container.innerHTML = "";

    questions.forEach((q, index) => {
        const item = document.createElement("div");
        item.className = "device-item";

        // CLEANUP LOGIC:
        // Filter out options that are just instructions like 'Details if Not Available' or 'Issue in details'
        // We only want the core statuses: "Working", "Not Working", "Available", "Not Available"
        const validOptions = q.options.filter(opt => {
            const lower = opt.toLowerCase();
            return !lower.includes("details") && !lower.includes("issue in");
        });

        const optionsHtml = validOptions.map(opt => `<option value="${opt}">${opt}</option>`).join("");

        item.innerHTML = `
            <div class="device-header">
                <span class="device-name">${q.device_name}</span>
                <select class="device-select" data-index="${index}" onchange="handleStatusChange(this, ${index})">
                    <option value="" disabled selected>Select Status</option>
                    ${optionsHtml}
                </select>
            </div>
            <div id="issue-box-${index}" class="issue-box hidden">
                <label>Please describe the issue: <span class="req">*</span></label>
                <textarea class="issue-input" id="issue-text-${index}" placeholder="Detailed description..."></textarea>
            </div>
        `;
        container.appendChild(item);
    });
}

function handleStatusChange(selectElem, index) {
    const issueBox = document.getElementById(`issue-box-${index}`);
    const issueInput = document.getElementById(`issue-text-${index}`);

    // Logic: Show issue box if status implies a problem
    // "Not Working", "Not Available", "Issue"
    const value = selectElem.value.toLowerCase();

    if (value.includes("not") || value.includes("issue")) {
        issueBox.classList.remove("hidden");
        issueInput.required = true;
    } else {
        issueBox.classList.add("hidden");
        issueInput.required = false;
        issueInput.value = ""; // Clear if hidden
    }
}

// ==========================================
// SUBMISSION LOGIC
// ==========================================
async function submitForm() {
    const errorDiv = document.getElementById("submit-error");
    errorDiv.textContent = "";

    // 1. User Info Validation
    const userName = document.getElementById("user-name").value.trim();
    const mobileNo = document.getElementById("mobile-no").value.trim();

    if (!userName || !mobileNo) {
        errorDiv.textContent = "Please fill in your Name and Mobile Number.";
        return;
    }

    if (!/^\d{10}$/.test(mobileNo)) {
        errorDiv.textContent = "Please enter a valid 10-digit mobile number.";
        return;
    }

    // 2. Device Status Validation
    const selects = document.querySelectorAll(".device-select");
    const issues = document.querySelectorAll(".issue-input");

    const responses = [];
    let isValid = true;

    selects.forEach((select, index) => {
        if (!select.value) {
            isValid = false;
            select.parentElement.style.border = "1px solid red";
        } else {
            select.parentElement.style.border = "none";

            // Check issue text if visible
            let issueText = "";
            const issueBox = document.getElementById(`issue-box-${index}`);
            if (!issueBox.classList.contains("hidden")) {
                const issueInput = document.getElementById(`issue-text-${index}`);
                if (!issueInput.value.trim()) {
                    isValid = false;
                    issueInput.style.borderColor = "red";
                } else {
                    issueInput.style.borderColor = "";
                    issueText = issueInput.value.trim();
                }
            }

            responses.push({
                device: deviceData[index].device_name,
                status: select.value,
                issue: issueText
            });
        }
    });

    if (!isValid) {
        errorDiv.textContent = "Please complete all fields. Check for red highlights.";
        return;
    }

    // 3. Prepare Payload
    const payload = {
        school_details: currentSchool,
        user_details: {
            user_name: userName,
            mobile_no: mobileNo,
            date_of_joining: document.getElementById("date-joining").value,
            evv_registration: document.getElementById("evv-reg").value,
            information_corner: document.getElementById("info-corner").value
        },
        responses: responses,
        overall_remarks: document.getElementById("overall-remarks").value.trim()
    };

    // 4. Submit
    showLoader(true);

    try {
        // We use fetch with POST. 
        // Note: 'no-cors' needed? 
        // Google Apps Script Web App default CORS policy usually allows simple POST requests if set to 'Anyone'.
        // However, to get a readbale JSON response, we need to handle it carefully.
        // Using "text/plain" content type often ensures GAS `doPost` receives it without pre-flight CORS issues for simple requests.

        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === "success") {
            document.getElementById("main-form").classList.add("hidden");
            document.getElementById("search-section").classList.add("hidden");
            document.getElementById("success-view").classList.remove("hidden");
        } else {
            errorDiv.textContent = "Submission failed: " + (result.message || "Unknown error");
        }
    } catch (error) {
        console.error("Submit Error:", error);
        errorDiv.textContent = "Network error submitting data. Please try again.";
    } finally {
        showLoader(false);
    }
}

// ==========================================
// UTILS
// ==========================================
function showLoader(show) {
    const overlay = document.getElementById("full-loader");
    if (show) overlay.classList.remove("hidden");
    else overlay.classList.add("hidden");
}
