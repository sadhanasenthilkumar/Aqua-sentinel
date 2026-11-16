
const damData = [
    {
        id: "mettur",
        name: "Mettur Dam",
        district: "Salem",
        river: "Cauvery",
        description: "Reservoir on the Cauvery River."
    },
    {
        id: "bhavanisagar",
        name: "Bhavanisagar Dam",
        district: "Erode",
        river: "Bhavani",
        description: "Reservoir on the Bhavani River."
    },
    {
        id: "vaigai",
        name: "Vaigai Dam",
        district: "Theni",
        river: "Vaigai",
        description: "Reservoir on the Vaigai River."
    },
    {
        id: "papanasam",
        name: "Papanasam Dam",
        district: "Tirunelveli",
        river: "Thamirabarani",
        description: "Reservoir associated with the Thamirabarani River."
    },
    {
        id: "sathanur",
        name: "Sathanur Dam",
        district: "Tiruvannamalai",
        river: "Thenpennai",
        description: "Reservoir on the Thenpennai River."
    }
];

const demoIndex = {
    mettur: 65,
    bhavanisagar: 72,
    vaigai: 55,
    papanasam: 80,
    sathanur: 60
};

const byId = id => document.getElementById(id);

function fillDamSelect(id) {
    const el = byId(id);

    if (!el) return;

    el.innerHTML = damData.map(d =>
        `<option value="${d.id}">${d.name}</option>`
    ).join("");
}

function showDamInfo(id) {
    const d = damData.find(x => x.id === id) || damData[0];

    byId("damInformation").innerHTML = `
        <h3>${d.name}</h3>

        <div class="detail-list">
            <div class="detail-item">
                <strong>District</strong>
                ${d.district}
            </div>

            <div class="detail-item">
                <strong>River</strong>
                ${d.river}
            </div>

            <div class="detail-item">
                <strong>Profile</strong>
                ${d.description}
            </div>

            <div class="detail-item">
                <strong>Water level / storage</strong>
                Not connected
            </div>

            <div class="detail-item">
                <strong>Inflow / outflow</strong>
                Not connected
            </div>

            <div class="detail-item">
                <strong>Water quality</strong>
                Awaiting verified sample data
            </div>
        </div>

        <p class="note">
            Live reservoir measurements are not connected.
            No operational status is being claimed.
        </p>

        <a class="button" href="dam-details.html?dam=${d.id}">
            Open full dam profile
        </a>
    `;
}

function initCharts() {

    if (!window.Chart) return;

    const overview = byId("overviewChart");

    if (overview) {
        new Chart(overview, {
            type: "bar",

            data: {
                labels: damData.map(d => d.name),

                datasets: [{
                    label: "Illustrative demo index",
                    data: damData.map(d => demoIndex[d.id]),
                    backgroundColor: "#18a9c8",
                    borderRadius: 7
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    const cmp = byId("comparisonChart");

    if (cmp) {

        const chart = new Chart(cmp, {
            type: "bar",

            data: {
                labels: ["Mettur", "Bhavanisagar"],

                datasets: [{
                    label: "Illustrative demo index",
                    data: [65, 72],
                    backgroundColor: ["#18a9c8", "#087eaa"],
                    borderRadius: 7
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });

        byId("compareButton").addEventListener("click", () => {

            const a = byId("compareDam1").value;
            const b = byId("compareDam2").value;

            if (a === b) {
                alert("Please select two different dams.");
                return;
            }

            chart.data.labels = [
                damData.find(d => d.id === a).name,
                damData.find(d => d.id === b).name
            ];

            chart.data.datasets[0].data = [
                demoIndex[a],
                demoIndex[b]
            ];

            chart.update();
        });
    }
}

// WATER QUALITY ANALYSIS

function initQuality() {

    byId("analyzeButton").addEventListener("click", () => {

        const fields = [
            ["pH", "phInput"],
            ["DO", "doInput"],
            ["BOD", "bodInput"],
            ["COD", "codInput"],
            ["Turbidity", "turbidityInput"],
            ["TDS", "tdsInput"]
        ];

        const vals = {};
        let missing = [];

        fields.forEach(([n, id]) => {

            const v = byId(id).value;

            if (v === "") {
                missing.push(n);
            } else {
                vals[n] = Number(v);
            }
        });

        const box = byId("analysisResult");

        if (missing.length) {
            box.className = "result-box result-warn";
            box.textContent =
                "Please enter all values: " + missing.join(", ") + ".";
            return;
        }

        if (Object.values(vals).some(v =>
            !Number.isFinite(v) || v < 0
        )) {
            box.className = "result-box result-bad";
            box.textContent = "Enter valid non-negative numeric values.";
            return;
        }

        let notes = [];

        if (vals.pH < 6.5 || vals.pH > 8.5) {
            notes.push("pH is outside the illustrative 6.5–8.5 screening band.");
        }

        if (vals.DO < 5) {
            notes.push("Dissolved oxygen is below the illustrative 5 mg/L screening value.");
        }

        if (vals.BOD > 3) {
            notes.push("BOD is above the illustrative 3 mg/L screening value.");
        }

        if (vals.COD > 10) {
            notes.push("COD is above the illustrative 10 mg/L screening value.");
        }

        if (vals.Turbidity > 5) {
            notes.push("Turbidity is above the illustrative 5 NTU screening value.");
        }

        if (vals.TDS > 500) {
            notes.push("TDS is above the illustrative 500 mg/L screening value.");
        }

        box.className =
            "result-box " + (notes.length ? "result-warn" : "result-good");

        box.innerHTML = `
            <strong>
                Demonstration screening result —
                ${notes.length ? "Review suggested" : "No entered value crossed the demo thresholds"}
            </strong>

            <p>
                ${
                    notes.length
                    ? notes.map(n => "• " + n).join("<br>")
                    : "The entered values did not cross the simple demo thresholds."
                }
            </p>

            <p class="note">
                This is a basic educational rule demonstration,
                not a certified water-quality assessment.
                Standards depend on intended water use and applicable regulations.
                Confirm with an accredited laboratory.
            </p>
        `;
    });

    byId("qualityFile").addEventListener("change", e => {

        byId("fileMessage").textContent =
            e.target.files.length
            ? "Selected: " + e.target.files[0].name +
              " (file is not uploaded or analyzed)."
            : "No file selected.";
    });

    // NEW: CSV UPLOAD AND ANALYSIS

    const csvInput = byId("csvUpload");
    const csvButton = byId("analyzeCSV");
    const csvResults = byId("csvResults");

    let csvFile = null;

    csvInput.addEventListener("change", e => {

        csvFile = e.target.files[0] || null;

        csvResults.className = "result-box";

        csvResults.textContent = csvFile
            ? "Selected CSV: " + csvFile.name + ". Click Analyze CSV File."
            : "Upload a CSV file to view its water-quality analysis.";
    });

    csvButton.addEventListener("click", () => {

        if (!csvFile) {
            csvResults.className = "result-box result-warn";
            csvResults.textContent = "Please select a CSV file first.";
            return;
        }

        const reader = new FileReader();

        reader.onload = function(event) {

            try {

                analyzeCSVData(event.target.result);

            } catch (error) {

                csvResults.className = "result-box result-bad";
                csvResults.textContent =
                    "Unable to analyze this CSV. Please check its format.";

            }
        };

        reader.onerror = function() {
            csvResults.className = "result-box result-bad";
            csvResults.textContent = "Error reading the selected file.";
        };

        reader.readAsText(csvFile);
    });

    function parseCSVLine(line) {

        const values = [];
        let current = "";
        let insideQuotes = false;

        for (let i = 0; i < line.length; i++) {

            const char = line[i];

            if (char === '"') {

                if (insideQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    insideQuotes = !insideQuotes;
                }

            } else if (char === "," && !insideQuotes) {

                values.push(current.trim());
                current = "";

            } else {

                current += char;
            }
        }

        values.push(current.trim());

        return values;
    }

    function analyzeCSVData(csvText) {

        const lines = csvText
            .replace(/^\uFEFF/, "")
            .split(/\r?\n/)
            .filter(line => line.trim() !== "");

        if (lines.length < 2) {
            throw new Error("CSV has no data.");
        }

        const headers = parseCSVLine(lines[0]).map(h =>
            h.toLowerCase().replace(/[^a-z0-9]/g, "")
        );

        const aliases = {
            ph: ["ph"],
            DO: ["do", "dissolvedoxygen"],
            BOD: ["bod", "biologicaloxygendemand"],
            COD: ["cod", "chemicaloxygendemand"],
            Turbidity: ["turbidity", "ntu"],
            TDS: ["tds", "totaldissolvedsolids"]
        };

        const positions = {};

        Object.keys(aliases).forEach(parameter => {

            positions[parameter] = headers.findIndex(header =>
                aliases[parameter].includes(header)
            );

        });

        const missing = Object.keys(positions).filter(key =>
            positions[key] === -1
        );

        if (missing.length) {

            csvResults.className = "result-box result-warn";

            csvResults.innerHTML = `
                <strong>Missing CSV columns</strong>
                <p>Please include these columns: ${missing.map(escapeHTML).join(", ")}</p>
                <p>Required columns: pH, DO, BOD, COD, Turbidity, TDS</p>
            `;

            return;
        }

        const data = [];
        let invalidRows = 0;

        for (let i = 1; i < lines.length; i++) {

            const values = parseCSVLine(lines[i]);

            const row = {};

            Object.keys(positions).forEach(parameter => {

                row[parameter] = Number(
                    values[positions[parameter]]
                );

            });

            const valid = Object.values(row).every(value =>
                Number.isFinite(value) && value >= 0
            );

            if (valid) {
                data.push(row);
            } else {
                invalidRows++;
            }
        }

        if (!data.length) {

            csvResults.className = "result-box result-bad";
            csvResults.textContent =
                "No valid measurement rows found. Check your CSV values.";

            return;
        }

        const averages = {};

        Object.keys(positions).forEach(parameter => {

            averages[parameter] = data.reduce((sum, row) =>
                sum + row[parameter], 0
            ) / data.length;

        });

        let tableRows = data.map((row, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${row.ph.toFixed(2)}</td>
                <td>${row.DO.toFixed(2)}</td>
                <td>${row.BOD.toFixed(2)}</td>
                <td>${row.COD.toFixed(2)}</td>
                <td>${row.Turbidity.toFixed(2)}</td>
                <td>${row.TDS.toFixed(2)}</td>
            </tr>
        `).join("");

        const averageRows = Object.entries(averages).map(
            ([parameter, value]) => `
                <tr>
                    <td>${escapeHTML(parameter)}</td>
                    <td>${value.toFixed(2)}</td>
                </tr>
            `
        ).join("");

        const warnings = [];

        data.forEach((row, index) => {

            let notes = [];

            if (row.ph < 6.5 || row.ph > 8.5)
                notes.push("pH");

            if (row.DO < 5)
                notes.push("DO");

            if (row.BOD > 3)
                notes.push("BOD");

            if (row.COD > 10)
                notes.push("COD");

            if (row.Turbidity > 5)
                notes.push("Turbidity");

            if (row.TDS > 500)
                notes.push("TDS");

            if (notes.length) {
                warnings.push(
                    `Row ${index + 1}: Review ${notes.join(", ")}`
                );
            }

        });

        csvResults.className = "result-box";

        csvResults.innerHTML = `
            <h3>CSV Analysis Results</h3>

            <p><strong>Total valid records:</strong> ${data.length}</p>

            <p><strong>Invalid records skipped:</strong> ${invalidRows}</p>

            <h4>Uploaded Water Quality Data</h4>

            <div style="overflow-x:auto;">
                <table border="1" cellpadding="8" cellspacing="0">
                    <thead>
                        <tr>
                            <th>No.</th>
                            <th>pH</th>
                            <th>DO</th>
                            <th>BOD</th>
                            <th>COD</th>
                            <th>Turbidity</th>
                            <th>TDS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>

            <h4>Average Water Quality Values</h4>

            <table border="1" cellpadding="8" cellspacing="0">
                <thead>
                    <tr>
                        <th>Parameter</th>
                        <th>Average</th>
                    </tr>
                </thead>
                <tbody>
                    ${averageRows}
                </tbody>
            </table>

            <h4>Screening Observations</h4>

            ${
                warnings.length
                ? warnings.map(w => `<p>• ${escapeHTML(w)}</p>`).join("")
                : "<p>No values crossed the illustrative screening thresholds.</p>"
            }

            <p class="note">
                This is an educational CSV screening demonstration.
                It does not confirm that water is safe or polluted.
                Verify results using laboratory testing and applicable standards.
            </p>
        `;
    }

    // NEW: WATER SAMPLE IMAGE UPLOAD AND PREVIEW

    const imageInput = byId("imageUpload");
    const imagePreview = byId("imagePreview");
    const imageResults = byId("imageResults");

    let currentImageURL = null;

    imageInput.addEventListener("change", e => {

        const file = e.target.files[0];

        imagePreview.innerHTML = "";
        imageResults.className = "result-box";

        if (currentImageURL) {
            URL.revokeObjectURL(currentImageURL);
            currentImageURL = null;
        }

        if (!file) {
            imageResults.textContent = "Upload an image to view its preview.";
            return;
        }

        if (!file.type.startsWith("image/")) {

            imageResults.className = "result-box result-bad";
            imageResults.textContent = "Please select a valid image file.";

            imageInput.value = "";
            return;
        }

        currentImageURL = URL.createObjectURL(file);

        const image = document.createElement("img");

        image.src = currentImageURL;
        image.alt = "Uploaded water sample preview";

        image.style.maxWidth = "100%";
        image.style.maxHeight = "350px";
        image.style.marginTop = "15px";
        image.style.borderRadius = "10px";
        image.style.objectFit = "contain";

        imagePreview.appendChild(image);

        imageResults.innerHTML = `
            <strong>Water Sample Image Selected</strong>
            <p>File name: ${escapeHTML(file.name)}</p>
            <p>File size: ${(file.size / 1024).toFixed(2)} KB</p>
            <p>Image type: ${escapeHTML(file.type)}</p>
            <p>
                Image preview loaded successfully.
                Automated AI image analysis is not connected yet.
            </p>
        `;
    });
}

// PUBLIC REPORTS

const STORE_KEY = "aquaSentinelPublicReports";

function getReports() {

    try {
        return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    } catch (e) {
        return [];
    }
}

function renderReports() {

    const reports = getReports();

    byId("reportCount").textContent = reports.length;

    const target = byId("reportsList");

    if (!reports.length) {
        target.textContent = "No reports submitted yet.";
        return;
    }

    target.innerHTML = reports.slice().reverse().map(r => `
        <article class="report-item">

            <strong>${escapeHTML(r.type)}</strong>

            <p>
                <b>Location:</b> ${escapeHTML(r.location)}
                ·
                <b>Date:</b> ${escapeHTML(r.date || "Not provided")}
            </p>

            <p>${escapeHTML(r.description)}</p>

            <p>
                Submitted locally
                ${r.name ? " by " + escapeHTML(r.name) : ""}
            </p>

        </article>
    `).join("");
}

function escapeHTML(s) {

    return String(s).replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
}

function initReports() {

    byId("submitReport").addEventListener("click", () => {

        const location = byId("reportLocation").value.trim();
        const type = byId("reportType").value;
        const description = byId("reportDescription").value.trim();

        const msg = byId("reportMessage");

        if (!location || !type || !description) {
            msg.textContent =
                "Please enter the location, concern type and description.";
            return;
        }

        const reports = getReports();

        reports.push({
            name: byId("reportName").value.trim(),
            location,
            type,
            description,
            date: byId("reportDate").value,
            created: new Date().toISOString()
        });

        localStorage.setItem(STORE_KEY, JSON.stringify(reports));

        [
            "reportName",
            "reportLocation",
            "reportType",
            "reportDate",
            "reportDescription"
        ].forEach(id => byId(id).value = "");

        msg.textContent =
            "Report saved in this browser for demonstration. It has not been sent to an authority.";

        renderReports();
    });

    byId("clearReports").addEventListener("click", () => {

        if (confirm("Clear all reports saved in this browser?")) {

            localStorage.removeItem(STORE_KEY);

            renderReports();

            byId("reportMessage").textContent = "Local reports cleared.";
        }
    });

    renderReports();
}

// PAGE INITIALIZATION

document.addEventListener("DOMContentLoaded", () => {

    fillDamSelect("damSelect");
    fillDamSelect("compareDam1");
    fillDamSelect("compareDam2");
    fillDamSelect("sampleDam");

    byId("compareDam2").value = "bhavanisagar";

    byId("damSelect").addEventListener("change", e => {
        showDamInfo(e.target.value);
    });

    showDamInfo("mettur");

    byId("damCards").innerHTML = damData.map(d => `
        <article class="dam-card">
            <h3>${d.name}</h3>
            <p>${d.district} District · ${d.river} River</p>
            <a class="button" href="dam-details.html?dam=${d.id}">
                View details
            </a>
        </article>
    `).join("");

    initCharts();
    initQuality();
    initReports();
});
