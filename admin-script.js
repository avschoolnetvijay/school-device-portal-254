/**
 * Admin Dashboard Logic - Interactive Reports
 */

let allData = [];
let filteredData = []; // Data currently visible in report tab
let allSchoolsList = []; // Master list of all schools (for pending calculation)
let submittedUDISE = new Set(); // Schools that have submitted
let currentViewMode = "all"; // "all", "submitted", "pending"

document.addEventListener("DOMContentLoaded", () => {
    loadDashboard();
});

// ==========================================
// DATA LOADING
// ==========================================
async function loadDashboard() {
    const loader = document.getElementById("full-loader");

    if (typeof API_URL === 'undefined' || API_URL.includes("YOUR_WEB_APP_URL")) {
        alert("Please configure the API URL in script.js first!");
        return;
    }

    loader.classList.remove("hidden");

    try {
        console.log("Step 1: Fetching main dashboard data...");
        // 1. Fetch MAIN DATA first (Critical)
        const response = await fetch(`${API_URL}?action=getAllResponses`);
        const resultData = await response.json();

        if (resultData.status === "success") {
            allData = resultData.data;
            console.log("Main data loaded:", allData.length);

            // Track which schools have submitted (use string keys consistently)
            submittedUDISE = new Set(allData.map(d => String(d.UDISE).trim()));

            // Render basic dashboard immediately with default fallback for filter
            processData([]);

            // 2. Fetch DEVICE LIST (Secondary) - Don't let this block the dashboard
            fetchDeviceList();

            // 3. Fetch SCHOOL LIST (For pending calculation)
            fetchSchoolList();
        } else {
            console.error("Data Error:", resultData.message);
            alert("Error loading data: " + resultData.message);
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        alert("Network Error: " + error.message + "\n\nPlease ensure you have re-deployed the script as a NEW version (e.g. Version 10) in Apps Script.");
    } finally {
        loader.classList.add("hidden");
    }
}

async function fetchDeviceList() {
    try {
        console.log("Step 2: Fetching master device list...");
        const response = await fetch(`${API_URL}?action=getDeviceList`);
        const result = await response.json();

        if (result.status === "success" && result.data && result.data.length > 0) {
            console.log("Master list loaded:", result.data.length);
            // Re-populate filter with master list
            populateDeviceFilter(result.data);
            updateDeviceBtn();
        } else {
            console.warn("Device list endpoint returned empty or error.");
        }
    } catch (e) {
        console.warn("Could not fetch master device list (probably not deployed yet):", e);
    }
}

async function fetchSchoolList() {
    try {
        console.log("Step 3: Fetching school list for pending calculation...");
        const response = await fetch(`${API_URL}?action=getSchoolList`);
        const result = await response.json();

        if (result.status === "success" && result.data && result.data.length > 0) {
            allSchoolsList = result.data;
            console.log("School list loaded:", allSchoolsList.length);

            // Calculate pending
            const pendingCount = allSchoolsList.filter(s => !submittedUDISE.has(String(s.udise))).length;
            document.getElementById("stat-pending").textContent = pendingCount;

            // Update coverage
            const coverage = allSchoolsList.length > 0
                ? Math.round((submittedUDISE.size / allSchoolsList.length) * 100)
                : 0;
            document.getElementById("stat-coverage").textContent = coverage + "%";
        } else {
            console.warn("School list endpoint returned empty or error.");
            document.getElementById("stat-pending").textContent = "?";
        }
    } catch (e) {
        console.warn("Could not fetch school list:", e);
        document.getElementById("stat-pending").textContent = "?";
    }
}

// ==========================================
// CARD CLICK HANDLERS
// ==========================================
function showSubmittedSchools() {
    currentViewMode = "submitted";

    // Get unique submitted school details (deduplicate by UDISE)
    const uniqueSchools = {};

    // Create a lookup map for school details (District, Block) from allSchoolsList
    const schoolDetailsMap = {};
    allSchoolsList.forEach(s => {
        schoolDetailsMap[String(s.udise).trim()] = s;
    });

    allData.forEach(d => {
        // Strict normalization: trim whitespace
        let udiseKey = String(d.UDISE).trim();
        if (!udiseKey) return; // Skip empty UDISE

        if (!uniqueSchools[udiseKey]) {
            // Try to find extra details from master list
            const masterInfo = schoolDetailsMap[udiseKey] || {};

            uniqueSchools[udiseKey] = {
                District: masterInfo.district || "-",
                Block: masterInfo.block || "-",
                UDISE: udiseKey,
                School_Code: d.School_Code || masterInfo.school_code || "",
                School_Name: d.School_Name || masterInfo.school_name || "",
                LastSubmission: d.Timestamp || ""
            };
        }
    });

    filteredData = Object.values(uniqueSchools);

    // Switch to reports tab BUT SKIP applying default filters
    switchTab('reports', true);
    renderSchoolListView("Submitted Schools", filteredData, "submitted");
}

function showPendingSchools() {
    currentViewMode = "pending";

    if (allSchoolsList.length === 0) {
        switchTab('reports', true); // Skip filter
        const headerRow = document.querySelector("#tab-reports table thead tr");
        headerRow.innerHTML = `<th>Status</th><th colspan="5">Message</th>`;
        document.querySelector("#tab-reports .table-header h2").textContent = "Pending Schools";
        document.getElementById("report-count").textContent = "0";
        document.getElementById("report-table-body").innerHTML = `
            <tr><td colspan="6" class="text-center" style="padding:30px; color:#F59E0B;">
                <strong>⚠ School list not loaded.</strong><br>
                Please ensure you have redeployed Code.gs.
            </td></tr>`;
        filteredData = [];
        return;
    }

    // Find schools that haven't submitted (compare as strings)
    // Use a Set for faster lookup
    const pendingSchools = [];
    const processedUDISE = new Set();

    allSchoolsList.forEach(s => {
        const udise = String(s.udise).trim();
        // Check if not submitted AND not already added to pending list (avoid dupes in master list if any)
        if (!submittedUDISE.has(udise) && !processedUDISE.has(udise)) {
            pendingSchools.push(s);
            processedUDISE.add(udise);
        }
    });

    filteredData = pendingSchools.map(s => ({
        District: s.district || "-",
        Block: s.block || "-",
        UDISE: String(s.udise).trim(),
        School_Code: s.school_code || "",
        School_Name: s.school_name || ""
    }));

    switchTab('reports', true); // Skip filter
    renderSchoolListView("Pending Schools - Not Yet Submitted", filteredData, "pending");
}

function renderSchoolListView(title, data, type) {
    const container = document.getElementById("report-table-body");
    const headerRow = document.querySelector("#tab-reports table thead tr");

    // Unified Header Structure for both Submitted and Pending
    headerRow.innerHTML = `
        <th>District</th>
        <th>Block</th>
        <th>UDISE Code</th>
        <th>School Code</th>
        <th>School Name</th>
        <th>${type === "submitted" ? "Submission Date" : "Status"}</th>
    `;

    // Update table title
    document.querySelector("#tab-reports .table-header h2").textContent = title;
    document.getElementById("report-count").textContent = data.length;

    container.innerHTML = "";

    if (data.length === 0) {
        container.innerHTML = `<tr><td colspan="6" class="text-center">No records found.</td></tr>`;
        return;
    }

    // Render all, but limit DOM operations in chunks if needed
    // For 265 schools, simple loop is fine.
    data.forEach(item => {
        const lastCol = type === "submitted"
            ? formatDate(item.LastSubmission)
            : `<span style="color:#F59E0B; font-weight:bold">⚠ Pending</span>`;

        container.innerHTML += `
            <tr>
                <td>${item.District || "-"}</td>
                <td>${item.Block || "-"}</td>
                <td>${item.UDISE}</td>
                <td>${item.School_Code}</td>
                <td><strong>${item.School_Name}</strong></td>
                <td>${lastCol}</td>
            </tr>
        `;
    });
}

function resetToAllDevices() {
    currentViewMode = "all";
    // Reset header
    const headerRow = document.querySelector("#tab-reports table thead tr");
    headerRow.innerHTML = `
        <th>Time</th>
        <th>School Details</th>
        <th>Device</th>
        <th>Status</th>
        <th>Issue Details</th>
        <th>Overall Remarks</th>
    `;
    document.querySelector("#tab-reports .table-header h2").textContent = "Detailed Data Report";
    applyFilters();
}

function processData(masterDeviceList) {
    // 1. Calculate Stats

    // Unique submissions based on Timestamp + UDISE (approximate raw submissions)
    const totalSubmissions = allData.length;

    // Count Issues: "Not Working", "Issue", "Not Available"
    const issues = allData.filter(d => {
        const s = String(d.Status).toLowerCase();
        return s.includes("issue") || s.includes("not");
    }).length;

    // Unique Schools (Strict Normalization)
    const uniqueSchoolsSet = new Set(allData.map(d => String(d.UDISE).trim()));
    const uniqueSchoolsCount = uniqueSchoolsSet.size;

    document.getElementById("stat-total").textContent = uniqueSchoolsCount; // Label is "Schools Submitted"
    document.getElementById("stat-issues").textContent = issues;
    document.getElementById("stat-schools").textContent = uniqueSchoolsCount; // "Schools Reported" (Duplicate of above, keeping for UI consistency)

    // 2. Populate Filters (Using Master List)
    populateDeviceFilter(masterDeviceList);
    updateDeviceBtn(); // Initialize button text

    // 3. Update Tables
    updateRecentTable(); // Dashboard Tab (Top 10)
    applyFilters(); // Reports Tab (Full Data)
}

function updateRecentTable() {
    const tbody = document.getElementById("recent-table-body");
    tbody.innerHTML = "";
    // Show last 10
    const recent = allData.slice(0, 10);
    recent.forEach(item => {
        tbody.innerHTML += `
            <tr>
                <td>${formatDate(item.Timestamp)}</td>
                <td>${item.School_Name}</td>
                <td>${item.Device}</td>
                <td>${getStatusBadge(item.Status)}</td>
            </tr>
        `;
    });
}

function createRow(item) {
    return `
        <tr>
            <td>
                <strong>${formatDate(item.Timestamp)}</strong>
            </td>
            <td>
                <div style="font-weight:600">${item.School_Name}</div>
                <div style="font-size:0.85rem; color:#666">${item.UDISE} | ${item.School_Code}</div>
                <div style="font-size:0.8rem; color:#888">${item.User_Name || "-"}</div>
            </td>
            <td>${item.Device}</td>
            <td>${getStatusBadge(item.Status)}</td>
            <td>
                ${item.Issue_Details ? `<div style="color:#d32f2f; font-size:0.9rem">${item.Issue_Details}</div>` : "-"}
            </td>
            <td>
                ${item.Remarks ? `<div style="font-style:italic; font-size:0.85rem;">${item.Remarks}</div>` : "-"}
            </td>
        </tr>
    `;
}

// ==========================================
// DEVICE FILTER
// ==========================================
function populateDeviceFilter(devices) {
    const container = document.getElementById("device-dropdown-content");
    container.innerHTML = "";

    // Use master list directly to preserve Sheet order
    // Fallback if empty (shouldn't happen with new backend)
    if (!devices || devices.length === 0) {
        devices = [...new Set(allData.map(d => d.Device))]; // No sort
    }

    // "Select All" Option
    const allDiv = document.createElement("div");
    allDiv.className = "dropdown-item";
    allDiv.innerHTML = `<label style="cursor:pointer; width:100%"><input type="checkbox" id="dev-all" checked onchange="toggleAllDevices(this)"> <strong>Select All</strong></label>`;
    container.appendChild(allDiv);

    // Separator
    const hr = document.createElement("hr");
    hr.style.margin = "4px 0";
    hr.style.border = "none";
    hr.style.borderTop = "1px solid #eee";
    container.appendChild(hr);

    devices.forEach(dev => {
        const div = document.createElement("div");
        div.className = "dropdown-item";
        div.innerHTML = `<label style="cursor:pointer; width:100%"><input type="checkbox" class="dev-checkbox" value="${dev}" checked onchange="updateDeviceBtn()"> ${dev}</label>`;
        container.appendChild(div);
    });
}

// Multi-Select Interaction
function toggleDeviceDropdown() {
    const content = document.getElementById("device-dropdown-content");
    content.classList.toggle("hidden");

    // Close when clicking outside (simple implementation)
    if (!content.classList.contains("hidden")) {
        document.addEventListener('click', closeDropdownOnClickOutside);
    }
}

function closeDropdownOnClickOutside(e) {
    const container = document.querySelector(".multi-select-container");
    if (!container.contains(e.target)) {
        document.getElementById("device-dropdown-content").classList.add("hidden");
        document.removeEventListener('click', closeDropdownOnClickOutside);
        applyFilters(); // Apply on close
    }
}

function toggleAllDevices(source) {
    const checkboxes = document.querySelectorAll(".dev-checkbox");
    checkboxes.forEach(cb => cb.checked = source.checked);
    updateDeviceBtn();
    applyFilters();
}

function updateDeviceBtn() {
    const checkboxes = document.querySelectorAll(".dev-checkbox");
    const checked = document.querySelectorAll(".dev-checkbox:checked");
    const btn = document.getElementById("device-dropdown-btn");

    if (checked.length === checkboxes.length) {
        btn.innerHTML = "All Devices Selected";
        document.getElementById("dev-all").checked = true;
    } else if (checked.length === 0) {
        btn.innerHTML = "None Selected";
        document.getElementById("dev-all").checked = false;
    } else {
        btn.innerHTML = `${checked.length} Devices Selected`;
        document.getElementById("dev-all").checked = false;
    }
}

// ==========================================
// TAB LOGIC
// ==========================================
function switchTab(tabName, skipFilter = false) {
    // Buttons
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));

    // Only set active if event exists (manual click) OR if manual
    if (event && event.currentTarget) {
        event.currentTarget.classList.add("active");
    } else {
        // Try to activate the corresponding button if programmatic
        const btn = document.querySelector(`.tab-btn[onclick*="'${tabName}'"]`);
        if (btn) btn.classList.add("active");
    }

    // Content
    document.getElementById("tab-dashboard").classList.add("hidden");
    document.getElementById("tab-reports").classList.add("hidden");

    document.getElementById(`tab-${tabName}`).classList.remove("hidden");

    // Force redraw filter if switching to reports AND not skipping
    // This prevents overwriting our custom "Submitted" or "Pending" lists
    if (tabName === 'reports' && !skipFilter) {
        currentViewMode = "all"; // Reset mode to default if user manually clicks
        applyFilters();
    }
}

function switchToIssues() {
    // Manually trigger the tab switch, allowing default filters
    const btn = document.querySelector(".tab-btn:nth-child(2)");
    if (btn) btn.click();

    document.getElementById("filter-status").value = "issue";
    applyFilters();
}

// ==========================================
// TABLE RENDERING & FILTERS
// ==========================================
function applyFilters() {
    // Get Checked Devices
    const checkedBoxes = document.querySelectorAll(".dev-checkbox:checked");
    const selectedDevices = Array.from(checkedBoxes).map(cb => cb.value);

    const statFilter = document.getElementById("filter-status").value;
    const searchVal = document.getElementById("filter-search").value.toLowerCase();

    filteredData = allData.filter(item => {
        // Device Filter (If none selected, show none)
        if (selectedDevices.length === 0) return false;
        if (!selectedDevices.includes(item.Device)) return false;

        // Status Filter
        const status = String(item.Status).toLowerCase();
        if (statFilter === "issue" && !(status.includes("issue") || status.includes("not"))) return false;
        if (statFilter === "working" && (!status.includes("working") || status.includes("not"))) return false;

        // Search Text
        // Safe access to properties
        const searchStr = `${item.School_Name || ""} ${item.UDISE || ""} ${item.Issue_Details || ""}`.toLowerCase();
        if (searchVal && !searchStr.includes(searchVal)) return false;

        return true;
    });

    // Update Count
    const countEl = document.getElementById("report-count");
    if (countEl) countEl.textContent = filteredData.length;

    // Render Table
    const tbody = document.getElementById("report-table-body");
    if (tbody) {
        tbody.innerHTML = "";

        if (filteredData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center">No matching records found.</td></tr>`;
        } else {
            // Limit for performance
            filteredData.slice(0, 500).forEach(item => {
                tbody.innerHTML += createRow(item);
            });
        }
    }
}

// Helpers
function formatDate(isoStr) {
    if (!isoStr || isoStr === "Invalid Date") return "-";
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr; // Return raw string if parsing fails
        return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    catch (e) { return isoStr; }
}

function getStatusBadge(status) {
    const s = String(status).toLowerCase();
    let cls = "status-neutral";
    let style = "border: 1px solid #D1D5DB; background:#F3F4F6; padding:4px 8px; border-radius:12px; font-size:0.75rem"; // Default

    if (s.includes("working") && !s.includes("not")) {
        // Working / Available / Activated
        style = "border: 1px solid #34D399; background:#ECFDF5; color:#065F46; padding:4px 8px; border-radius:12px; font-weight:bold; font-size:0.75rem";
    }

    if (s.includes("issue") || s.includes("not working")) {
        // Critical Issues
        style = "border: 1px solid #EF4444; background:#FEF2F2; color:#B91C1C; padding:4px 8px; border-radius:12px; font-weight:bold; font-size:0.75rem";
    }

    if (s.includes("not available")) {
        // Missing items - Distinct but serious
        style = "border: 1px solid #F59E0B; background:#FFFBEB; color:#B45309; padding:4px 8px; border-radius:12px; font-weight:bold; font-size:0.75rem";
    }

    return `<span style="${style}">${status}</span>`;
}

// ==========================================
// EXCEL EXPORT - Styled with Colors & Borders
// ==========================================
function exportFilteredData() {
    if (!filteredData || filteredData.length === 0) {
        alert("No data to export!");
        return;
    }

    // Determine export type based on current view
    let title = "Device_Report";
    let exportSet = [];

    if (currentViewMode === "submitted") {
        title = "Submitted_Schools";
        exportSet = filteredData.map(d => ({
            "District": d.District || "-",
            "Block": d.Block || "-",
            "UDISE": d.UDISE || "",
            "School Code": d.School_Code || "",
            "School Name": d.School_Name || "",
            "Submission Date": formatDate(d.LastSubmission) || ""
        }));
    } else if (currentViewMode === "pending") {
        title = "Pending_Schools";
        exportSet = filteredData.map(d => ({
            "District": d.District || "-",
            "Block": d.Block || "-",
            "UDISE": d.UDISE || "",
            "School Code": d.School_Code || "",
            "School Name": d.School_Name || "",
            "Status": "Pending"
        }));
    } else {
        title = "Device_Report";
        exportSet = filteredData.map(d => ({
            "Date": formatDate(d.Timestamp),
            "School Name": d.School_Name || "",
            "UDISE": d.UDISE || "",
            "School Code": d.School_Code || "",
            "Device": d.Device || "",
            "Status": d.Status || "",
            "Issue Details": d.Issue_Details || "",
            "Overall Remarks": d.Remarks || "",
            "Submitted By": d.User_Name || "",
            "Mobile": d.Mobile || ""
        }));
    }

    downloadStyledExcel(exportSet, title);
}

function downloadStyledExcel(jsonData, title) {
    if (!jsonData || jsonData.length === 0) return;

    const headers = Object.keys(jsonData[0]);
    const ws = XLSX.utils.json_to_sheet(jsonData);

    // Define styles
    const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
        fill: { fgColor: { rgb: "4F46E5" } }, // Indigo
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
        }
    };

    const cellStyleEven = {
        fill: { fgColor: { rgb: "F3F4F6" } }, // Light gray
        border: {
            top: { style: "thin", color: { rgb: "D1D5DB" } },
            bottom: { style: "thin", color: { rgb: "D1D5DB" } },
            left: { style: "thin", color: { rgb: "D1D5DB" } },
            right: { style: "thin", color: { rgb: "D1D5DB" } }
        }
    };

    const cellStyleOdd = {
        fill: { fgColor: { rgb: "FFFFFF" } }, // White
        border: {
            top: { style: "thin", color: { rgb: "D1D5DB" } },
            bottom: { style: "thin", color: { rgb: "D1D5DB" } },
            left: { style: "thin", color: { rgb: "D1D5DB" } },
            right: { style: "thin", color: { rgb: "D1D5DB" } }
        }
    };

    const issueStyle = {
        font: { bold: true, color: { rgb: "B91C1C" } },
        fill: { fgColor: { rgb: "FEE2E2" } },
        border: {
            top: { style: "thin", color: { rgb: "D1D5DB" } },
            bottom: { style: "thin", color: { rgb: "D1D5DB" } },
            left: { style: "thin", color: { rgb: "D1D5DB" } },
            right: { style: "thin", color: { rgb: "D1D5DB" } }
        }
    };

    const pendingStyle = {
        font: { bold: true, color: { rgb: "B45309" } },
        fill: { fgColor: { rgb: "FEF3C7" } },
        border: {
            top: { style: "thin", color: { rgb: "D1D5DB" } },
            bottom: { style: "thin", color: { rgb: "D1D5DB" } },
            left: { style: "thin", color: { rgb: "D1D5DB" } },
            right: { style: "thin", color: { rgb: "D1D5DB" } }
        }
    };

    // Apply header styles
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
        if (ws[cellAddress]) {
            ws[cellAddress].s = headerStyle;
        }
    }

    // Apply row styles with alternating colors
    for (let R = 1; R <= range.e.r; R++) {
        const isEven = R % 2 === 0;
        for (let C = range.s.c; C <= range.e.c; C++) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            if (ws[cellAddress]) {
                const val = String(ws[cellAddress].v || "").toLowerCase();

                // Special styling for status columns
                if (val.includes("issue") || val.includes("not working") || val.includes("not available")) {
                    ws[cellAddress].s = issueStyle;
                } else if (val === "pending") {
                    ws[cellAddress].s = pendingStyle;
                } else {
                    ws[cellAddress].s = isEven ? cellStyleEven : cellStyleOdd;
                }
            }
        }
    }

    // Set column widths
    const wscols = headers.map((h, i) => {
        if (h.toLowerCase().includes("name")) return { wch: 35 };
        if (h.toLowerCase().includes("detail") || h.toLowerCase().includes("remark")) return { wch: 40 };
        if (h.toLowerCase().includes("udise")) return { wch: 15 };
        return { wch: 18 };
    });
    ws['!cols'] = wscols;

    // Create workbook and export
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.substring(0, 31)); // Sheet name max 31 chars

    const fileName = `${title}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
}
