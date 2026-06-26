const headerToggle = document.querySelector('.menu-toggle');
const headerNav = document.querySelector('.header-nav');
const headerList = headerNav?.querySelector('ul');

if (headerList) {
    const allDropdownToggles = [...headerList.querySelectorAll('.dropdown-toggle')];
    const equipmentToggle = allDropdownToggles.find((btn) => btn.textContent.trim().toLowerCase() === 'produtos' || btn.textContent.trim().toLowerCase() === 'equipamentos');

    if (equipmentToggle) {
        equipmentToggle.textContent = 'Equipamentos';
        equipmentToggle.classList.add('dropdown-no-arrow');

        const equipmentDropdown = equipmentToggle.closest('.nav-item-with-dropdown')?.querySelector('.product-dropdown');
        if (equipmentDropdown) {
            equipmentDropdown.setAttribute('aria-label', 'Menu Equipamentos');
        }
    }

    const hasBrutusmaq = allDropdownToggles.some((btn) => btn.textContent.trim() === 'Brutusmaq');

    if (!hasBrutusmaq && equipmentToggle) {
        const brutusmaqItem = document.createElement('li');
        brutusmaqItem.className = 'nav-item-with-dropdown';
        brutusmaqItem.innerHTML = `
            <button class="header-nav-links dropdown-toggle" type="button" aria-haspopup="true" aria-expanded="false">Brutusmaq</button>
            <div class="product-dropdown" role="menu" aria-label="Menu Brutusmaq">
                <div class="product-dropdown-grid">
                    <a class="product-dropdown-link" role="menuitem" href="about.html#sobre-nos">
                        <strong>Sobre Nós</strong>
                        <span>A Brutusmaq, missão e visão corporativa.</span>
                    </a>
                    <a class="product-dropdown-link" role="menuitem" href="about.html#gestao-integrada">
                        <strong>Gestão Integrada</strong>
                        <span>Qualidade, meio ambiente e segurança integrados.</span>
                    </a>
                    <a class="product-dropdown-link" role="menuitem" href="select-materials.html">
                        <strong>Unidades de Valorização</strong>
                        <span>Materiais e soluções para trituração e reciclagem.</span>
                    </a>
                </div>
            </div>
        `;

        const equipmentItem = equipmentToggle.closest('.nav-item-with-dropdown');
        equipmentItem?.parentNode?.insertBefore(brutusmaqItem, equipmentItem.nextSibling);
    }
}

const dropdownItems = document.querySelectorAll('.nav-item-with-dropdown');

if (headerToggle && headerNav) {
    headerToggle.addEventListener('click', () => {
        const isOpen = headerNav.classList.toggle('open');
        headerToggle.classList.toggle('open', isOpen);
        headerToggle.setAttribute('aria-expanded', String(isOpen));
    });
}

dropdownItems.forEach((item) => {
    const dropdownToggle = item.querySelector('.dropdown-toggle');
    const productDropdown = item.querySelector('.product-dropdown');

    if (!dropdownToggle || !productDropdown) {
        return;
    }

    dropdownToggle.addEventListener('click', (event) => {
        const isOpen = productDropdown.classList.toggle('open');
        dropdownToggle.setAttribute('aria-expanded', String(isOpen));

        dropdownItems.forEach((otherItem) => {
            if (otherItem === item) {
                return;
            }
            const otherDropdown = otherItem.querySelector('.product-dropdown');
            const otherToggle = otherItem.querySelector('.dropdown-toggle');
            if (otherDropdown && otherDropdown.classList.contains('open')) {
                otherDropdown.classList.remove('open');
                otherToggle?.setAttribute('aria-expanded', 'false');
            }
        });

        event.stopPropagation();
    });
});

document.addEventListener('click', (event) => {
    dropdownItems.forEach((item) => {
        const dropdownToggle = item.querySelector('.dropdown-toggle');
        const productDropdown = item.querySelector('.product-dropdown');

        if (!dropdownToggle || !productDropdown) {
            return;
        }

        if (!productDropdown.contains(event.target) && !dropdownToggle.contains(event.target)) {
            productDropdown.classList.remove('open');
            dropdownToggle.setAttribute('aria-expanded', 'false');
        }
    });
});
