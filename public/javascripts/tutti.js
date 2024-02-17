//icona a hamburgher
document.addEventListener("DOMContentLoaded", function () {
    const menuIcon = document.querySelector(".menu-icon");
    const navUl = document.querySelector("nav ul");

    menuIcon.addEventListener("click", function () {
          navUl.classList.toggle("showing");
    });
});

function apriMenu(y) {
    y.classList.toggle("change");
}

function avanti() {
    const gallery_item_size = document.querySelector('.grid-item').clientWidth;
    document.getElementById("gallery_scroller").scrollBy(gallery_item_size, 0);
}
function indietro() {
    const gallery_item_size = document.querySelector('.grid-item').clientWidth;
    document.getElementById("gallery_scroller").scrollBy(-gallery_item_size, 0);
}

