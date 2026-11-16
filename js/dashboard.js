const dams = [
    ["mettur", "Mettur Dam", "Salem", "Cauvery"],
    ["bhavanisagar", "Bhavanisagar Dam", "Erode", "Bhavani"],
    ["vaigai", "Vaigai Dam", "Theni", "Vaigai"],
    ["papanasam", "Papanasam Dam", "Tirunelveli", "Thamirabarani"],
    ["sathanur", "Sathanur Dam", "Tiruvannamalai", "Thenpennai"]
];

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("damList").innerHTML =
        dams.map(d => `
            <article class="dam-card">
                <h3>${d[1]}</h3>
                <p>${d[2]} District · ${d[3]} River</p>
                <a class="button" href="dam-details.html?dam=${d[0]}">
                    View details
                </a>
            </article>
        `).join("");

});