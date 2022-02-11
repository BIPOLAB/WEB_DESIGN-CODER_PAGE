var pad_btn_01 = document.getElementById('pad_01')
pad_btn_01.addEventListener('click', function () {
    pad_btn_01.style.backgroundColor = 'rgb(225, 225, 214)';
});

const drop__menu = document.querySelector(".drop__menu"),
    drop__modeBtn = drop__menu.querySelector(".drop__modeBtn");
    drop__modeBtn.addEventListener("click", () => {
    drop__menu.classList.toggle("active");
});
const channel__dropMenu = document.querySelector(".channel__dropMenu"),
    drop__channelBtn = channel__dropMenu.querySelector(".channel__dropBtn");
    drop__channelBtn.addEventListener("click", () => {
        channel__dropMenu.classList.toggle("toggle__dropChannel");
});

const note__dropMenu = document.querySelector(".note__dropMenu"),
    drop__noteBtn = note__dropMenu.querySelector(".note__dropBtn");
    drop__noteBtn.addEventListener("click", () => {
        note__dropMenu.classList.toggle("toggle__dropNote");
});