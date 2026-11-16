const dams = {

    mettur: {
        name: "Mettur Dam",
        district: "Salem",
        river: "Cauvery"
    },

    bhavanisagar: {
        name: "Bhavanisagar Dam",
        district: "Erode",
        river: "Bhavani"
    },

    vaigai: {
        name: "Vaigai Dam",
        district: "Theni",
        river: "Vaigai"
    },

    papanasam: {
        name: "Papanasam Dam",
        district: "Tirunelveli",
        river: "Thamirabarani"
    },

    sathanur: {
        name: "Sathanur Dam",
        district: "Tiruvannamalai",
        river: "Thenpennai"
    }

};

document.addEventListener("DOMContentLoaded", () => {

    const id =
        new URLSearchParams(location.search).get("dam") || "mettur";

    const d = dams[id] || dams.mettur;

    document.getElementById("damName").textContent = d.name;

    document.getElementById("damLocation").textContent =
        d.district + " District, Tamil Nadu · " + d.river + " River";

    document.getElementById("damFacts").innerHTML = [

        ["District", d.district],
        ["River", d.river],
        ["Water storage", "Not connected"],
        ["Water level", "Not connected"],
        ["Inflow", "Not connected"],
        ["Outflow", "Not connected"]

    ].map(x => `
        <div class="detail-item">
            <strong>${x[0]}</strong>
            ${x[1]}
        </div>
    `).join("");

    document.getElementById("qualityFacts").innerHTML = [

        ["pH", "Not connected"],
        ["Dissolved oxygen", "Not connected"],
        ["BOD", "Not connected"],
        ["COD", "Not connected"],
        ["Turbidity", "Not connected"],
        ["TDS", "Not connected"]

    ].map(x => `
        <div class="detail-item">
            <strong>${x[0]}</strong>
            ${x[1]}
        </div>
    `).join("");

});