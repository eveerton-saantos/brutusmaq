const materialCards = document.querySelectorAll('.material-card');
        const splitTitle = document.querySelector('.split-title');
        const splitCopy = document.querySelector('.split-copy');

        if (materialCards.length && splitTitle && splitCopy) {
            materialCards.forEach((card) => {
                card.addEventListener('click', () => {
                    materialCards.forEach((item) => {
                        item.classList.remove('active');
                    });

                    card.classList.add('active');

                    const title = card.querySelector('.material-card-title');
                    const description = card.dataset.description;

                    if (title) {
                        splitTitle.textContent = title.textContent;
                    }
                    if (description) {
                        splitCopy.textContent = description;
                    }
                });
            });
        }