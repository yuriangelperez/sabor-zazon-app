(function () {
    const { URL_PEDIDOS, HORARIO } = window.SABOR_CONFIG;
    const categorias = window.SABOR_CATALOGO;

    const formatoPrecio = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
    });

    function urlPedidos(ruta) {
        return URL_PEDIDOS.replace(/\/$/, '') + ruta;
    }

    // Escapa texto antes de insertarlo como HTML.
    function esc(texto) {
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }

    function tarjetaProducto(p) {
        const clases = ['menu-card'];
        if (p.destacado) clases.push('featured');
        const etiquetas = (p.etiquetas || [])
            .map((e) => `<li>${esc(e)}</li>`)
            .join('');

        return `
            <article class="${clases.join(' ')}">
                <div class="card-imagen">
                    <img src="assets/productos/${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy" width="600" height="600">
                    ${p.promo ? '<span class="card-badge">Promo</span>' : ''}
                </div>
                <div class="card-body">
                    <div class="item-title-row">
                        <h4>${esc(p.nombre)}</h4>
                        <span class="dots" aria-hidden="true"></span>
                        <span class="price">${formatoPrecio.format(p.precio)}</span>
                    </div>
                    <p class="description">${esc(p.descripcion)}</p>
                    ${etiquetas ? `<ul class="card-etiquetas">${etiquetas}</ul>` : ''}
                    <a class="btn-pedir" href="${urlPedidos('/producto/' + encodeURIComponent(p.id))}">
                        Pedir ahora
                    </a>
                </div>
            </article>`;
    }

    function renderCatalogo() {
        const contenedor = document.getElementById('catalogo');
        contenedor.innerHTML = categorias
            .map(
                (c) => `
                <section class="menu-category" id="${esc(c.id)}">
                    <div class="category-header">
                        <h3>${esc(c.titulo)} <span class="category-decor"></span></h3>
                        <p class="category-descripcion">${esc(c.descripcion)}</p>
                    </div>
                    <div class="menu-grid">
                        ${c.productos.map(tarjetaProducto).join('')}
                    </div>
                </section>`
            )
            .join('');
    }

    function conectarLinksPedidos() {
        document.querySelectorAll('[data-link-pedidos]').forEach((a) => {
            a.setAttribute('href', urlPedidos(a.getAttribute('data-link-pedidos')));
        });
    }

    function aMinutos(hora) {
        const [h, m] = hora.split(':').map(Number);
        return h * 60 + m;
    }

    function mostrarEstadoLocal() {
        const ahora = new Date();
        const actual = ahora.getHours() * 60 + ahora.getMinutes();
        const apertura = aMinutos(HORARIO.apertura);
        const cierre = aMinutos(HORARIO.cierre);
        const abierto =
            apertura <= cierre ? actual >= apertura && actual < cierre : actual >= apertura || actual < cierre;
        document.getElementById('estado-local').classList.toggle('hidden', abierto);
    }

    function menuHamburguesa() {
        const boton = document.getElementById('menu-toggle');
        const links = document.getElementById('nav-links');

        boton.addEventListener('click', () => {
            const abierto = links.classList.toggle('active');
            boton.setAttribute('aria-expanded', String(abierto));
        });

        links.querySelectorAll('a').forEach((a) =>
            a.addEventListener('click', () => {
                links.classList.remove('active');
                boton.setAttribute('aria-expanded', 'false');
            })
        );
    }

    renderCatalogo();
    conectarLinksPedidos();
    mostrarEstadoLocal();
    menuHamburguesa();
    document.getElementById('anio').textContent = new Date().getFullYear();
})();
