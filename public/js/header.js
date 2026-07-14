const headerToggle = document.querySelector('.menu-toggle');
const headerNav = document.querySelector('.header-nav');
const headerList = headerNav?.querySelector('ul');
const HOME_MEGA_PRODUCT_LIMIT = 4;

const headerCategoryConfig = {
    trituradores: {
        title: 'Trituradores',
        description: 'Redução de volume',
        icon: 'assets/icones-brancos/icone-triturador-branco.svg',
        mediaHref: 'equipamentos.html#trituradores',
    },
    moinhos: {
        title: 'Moinhos',
        description: 'Moagem eficiente',
        icon: 'assets/icones-brancos/icone-moinho-branco.svg',
        mediaHref: 'equipamentos.html#moinhos',
    },
    picadores: {
        title: 'Picadores',
        description: 'Corte e fragmentação',
        icon: 'assets/icones-brancos/icone-picador-branco.svg',
        mediaHref: 'equipamentos.html#picadores',
    },
    esteiras: {
        title: 'Esteiras',
        description: 'Transporte contínuo',
        icon: 'assets/icones-brancos/icone-esteira-branco.svg',
        mediaHref: 'equipamentos.html#esteiras',
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

const getHeaderModelNumber = (product) => {
    const match = String(product.modelo || product.id || '').match(/\d+/);

    return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
};

const getUniqueSortedHeaderProducts = (products) => {
    const uniqueProducts = new Map();

    products.forEach((product) => {
        const key = String(product.id || product.modelo || '').trim().toLowerCase();

        if (key && !uniqueProducts.has(key)) {
            uniqueProducts.set(key, product);
        }
    });

    return [...uniqueProducts.values()].sort((productA, productB) => {
        const numberDifference = getHeaderModelNumber(productA) - getHeaderModelNumber(productB);

        if (numberDifference !== 0) {
            return numberDifference;
        }

        return String(productA.modelo || productA.id || '').localeCompare(
            String(productB.modelo || productB.id || ''),
            'pt-BR',
            { numeric: true }
        );
    });
};

const renderCompactEquipmentMegaMenu = (equipmentDropdownGrid, products) => {
    const categoryColumns = Object.entries(headerCategoryConfig).map(([slug, config]) => {
        const categoryProducts = getUniqueSortedHeaderProducts(
            products.filter((product) => product.categoriaSlug === slug)
        );
        const productLinks = categoryProducts.slice(0, HOME_MEGA_PRODUCT_LIMIT).map((product) => {
            const label = product.modelo || product.nome || product.id || 'Equipamento';

            return `<a role="menuitem" href="${getHeaderProductUrl(product)}">${escapeHeaderHtml(label)}</a>`;
        }).join('');
        const totalLabel = `${categoryProducts.length} ${categoryProducts.length === 1 ? 'modelo' : 'modelos'}`;
        const allLabel = categoryProducts.length > HOME_MEGA_PRODUCT_LIMIT
            ? `Ver todos (${categoryProducts.length})`
            : 'Conhecer a linha';

        return `
                            <section class="home-mega-column home-mega-category-column">
                                <a class="home-mega-category-head" role="menuitem" href="${config.mediaHref}">
                                    <span class="home-mega-category-icon" aria-hidden="true"><img src="${config.icon}" alt=""></span>
                                    <span>
                                        <strong class="home-mega-category-name">${escapeHeaderHtml(config.title)}</strong>
                                        <small>${escapeHeaderHtml(config.description)}</small>
                                    </span>
                                    <span class="home-mega-category-count">${escapeHeaderHtml(totalLabel)}</span>
                                </a>
                                <div class="home-mega-product-links">
                                    ${productLinks || '<span class="home-mega-empty">Modelos sob consulta</span>'}
                                </div>
                                <a class="home-mega-all" role="menuitem" href="${config.mediaHref}">${allLabel}</a>
                            </section>`;
    }).join('');

    equipmentDropdownGrid.classList.add('home-mega-grid-compact');
    equipmentDropdownGrid.innerHTML = `${categoryColumns}

                            <section class="home-mega-column home-mega-category-column home-mega-highlight">
                                <a class="home-mega-category-head" role="menuitem" href="usadas.html">
                                    <span class="home-mega-category-icon" aria-hidden="true"><img src="assets/icones-brancos/icone-usadas-branco.svg" alt=""></span>
                                    <span>
                                        <strong class="home-mega-category-name">Equipamentos usados</strong>
                                        <small>Revisados e testados</small>
                                    </span>
                                </a>
                                <div class="home-mega-product-links">
                                    <a role="menuitem" href="usadas.html">Disponíveis para venda</a>
                                    <a role="menuitem" href="contato.html#proposta-tecnica">Solicitar indicação técnica</a>
                                </div>
                                <a class="home-mega-all" role="menuitem" href="usadas.html">Ver equipamentos usados</a>
                            </section>`;
};

const renderEquipmentMegaMenu = () => {
    const equipmentDropdownGrid = document.querySelector('.home-mega-grid');
    const products = Array.isArray(window.brutusmaqProdutosNovos) ? window.brutusmaqProdutosNovos : [];

    if (!equipmentDropdownGrid) {
        return;
    }

    renderCompactEquipmentMegaMenu(equipmentDropdownGrid, products);
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
