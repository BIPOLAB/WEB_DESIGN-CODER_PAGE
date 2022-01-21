    const ham = document.querySelector('.btn_menu')
    const links = document.querySelector('.menu-items')

    ham.addEventListener('click',() => {
        links.classList.toggle('show');
    });


/*var header = document.getElementById('menu')

window.addEventListener('scroll', () => {
    var scroll = window.scrollY
    if (scrollY > 10) {
        header.style.backgroundColor = 'rgb(15, 14, 14)';

    }
    else {
        header.style.backgroundColor = 'rgb(15, 14,14)';


    }
})*/