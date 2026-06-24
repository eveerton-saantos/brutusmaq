const headerToggle = document.querySelector('.menu-toggle');
const headerNav = document.querySelector('.header-nav');
const dropdownToggle = document.querySelector('.dropdown-toggle');
const productDropdown = document.querySelector('.product-dropdown');

if (headerToggle && headerNav) {
    headerToggle.addEventListener('click', () => {
        const isOpen = headerNav.classList.toggle('open');
        headerToggle.classList.toggle('open', isOpen);
        headerToggle.setAttribute('aria-expanded', String(isOpen));
    });
}

if (dropdownToggle && productDropdown) {
    dropdownToggle.addEventListener('click', (event) => {
        const isOpen = productDropdown.classList.toggle('open');
        dropdownToggle.setAttribute('aria-expanded', String(isOpen));
        event.stopPropagation();
    });

    document.addEventListener('click', (event) => {
        if (!productDropdown.contains(event.target) && !dropdownToggle.contains(event.target)) {
            productDropdown.classList.remove('open');
            dropdownToggle.setAttribute('aria-expanded', 'false');
        }
    });
}
