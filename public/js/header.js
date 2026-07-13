const headerToggle = document.querySelector('.menu-toggle');
const headerNav = document.querySelector('.header-nav');
const headerList = headerNav?.querySelector('ul');

const headerCategoryConfig = {
    trituradores: {
        title: 'Trituradores',
        fallbackImage: 'assets/main/tr-700.png',
        mediaHref: 'equipamentos.html#trituradores',
        mediaLabel: 'Ver trituradores'
    },
    moinhos: {
        title: 'Moinhos',
        fallbackImage: 'assets/main/robustez.svg',
        mediaHref: 'equipamentos.html#moinhos',
        mediaLabel: 'Ver moinhos'
    },
    picadores: {
        title: 'Picadores',
        fallbackImage: 'assets/main/tecnologia.svg',
        mediaHref: 'equipamentos.html#picadores',
        mediaLabel: 'Ver picadores'
    },
    esteiras: {
        title: 'Esteiras',
        fallbackImage: 'assets/main/manutencao.svg',
        mediaHref: 'equipamentos.html#esteiras',
        mediaLabel: 'Ver esteiras transportadoras'
    }
};

const escapeHeaderHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[char]));

const getHeaderProductUrl = (product) => {
    const id = product.id || String(product.modelo || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `produto.html?produto=${encodeURIComponent(id)}`;
};

const renderEquipmentMegaMenu = () => {
    const equipmentDropdownGrid = document.querySelector('.home-mega-grid');
    const products = Array.isArray(window.brutusmaqProdutosNovos) ? window.brutusmaqProdutosNovos : [];

    if (!equipmentDropdownGrid || !products.length) {
        return;
    }

    const categoryColumns = Object.entries(headerCategoryConfig).map(([slug, config]) => {
        const productsByCategory = products.filter((product) => product.categoriaSlug === slug);

        if (!productsByCategory.length) {
            return '';
        }

        const firstProduct = productsByCategory[0];
        const image = firstProduct.imagem || config.fallbackImage;
        const alt = firstProduct.alt || `${config.title} Brutusmaq`;
        const links = productsByCategory.map((product) => {
            const label = product.modelo || product.nome || product.id || 'Equipamento';

            return `<a role="menuitem" href="${getHeaderProductUrl(product)}">${escapeHeaderHtml(label)}</a>`;
        }).join('');

        return `
                            <section class="home-mega-column" aria-labelledby="mega-${slug}">
                                <a class="home-mega-media" href="${config.mediaHref}" aria-label="${config.mediaLabel}">
                                    <img src="${escapeHeaderHtml(image)}" alt="${escapeHeaderHtml(alt)}">
                                </a>
                                <div>
                                    <h2 id="mega-${slug}">${config.title}</h2>
                                    ${links}
                                </div>
                            </section>`;
    }).join('');

    equipmentDropdownGrid.innerHTML = `${categoryColumns}

                            <section class="home-mega-column home-mega-highlight" aria-labelledby="mega-usados">
                                <a class="home-mega-media" href="usadas.html" aria-label="Ver equipamentos usados">
                                    <img src="assets/main/tr-800-disp-mobile.png" alt="">
                                </a>
                                <div>
                                    <h2 id="mega-usados">Equipamentos usados</h2>
                                    <a role="menuitem" href="usadas.html">Disponíveis para venda</a>
                                    <a role="menuitem" href="usadas.html">Máquinas revisadas</a>
                                    <a role="menuitem" href="contato.html#proposta-tecnica">Solicitar indicação técnica</a>
                                </div>
                            </section>`;
};

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
                    <a class="product-dropdown-link" role="menuitem" href="equipamentos.html">
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

renderEquipmentMegaMenu();

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
        const wasOpen = productDropdown.classList.contains('open');
        const isOpen = !wasOpen;

        productDropdown.classList.toggle('open', isOpen);
        item.classList.toggle('dropdown-click-closed', wasOpen);
        dropdownToggle.setAttribute('aria-expanded', String(isOpen));

        dropdownItems.forEach((otherItem) => {
            if (otherItem === item) {
                return;
            }
            const otherDropdown = otherItem.querySelector('.product-dropdown');
            const otherToggle = otherItem.querySelector('.dropdown-toggle');
            if (otherDropdown && otherDropdown.classList.contains('open')) {
                otherDropdown.classList.remove('open');
                otherItem.classList.remove('dropdown-click-closed');
                otherToggle?.setAttribute('aria-expanded', 'false');
            }
        });

        event.stopPropagation();
    });

    item.addEventListener('mouseleave', () => {
        item.classList.remove('dropdown-click-closed');
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
            item.classList.remove('dropdown-click-closed');
            dropdownToggle.setAttribute('aria-expanded', 'false');
        }
    });
});
