// Productos que muestra la landing. Los `id` son los mismos que usa la web de
// pedidos (apps/customer/services/catalogoMock.ts), así el botón "Pedir" abre
// directamente el detalle de ese producto. Cuando el menú viva en Supabase,
// este archivo se reemplaza por una consulta a la tabla `productos`.
window.SABOR_CATALOGO = [
    {
        id: 'combos',
        titulo: 'Nuestros Combos',
        descripcion: 'Para compartir: arepas y empanadas a elección, con tequeños y salsa de ajo.',
        productos: [
            { id: 'combo-zulia', nombre: 'Combo Zulia', precio: 53549, imagen: 'combo-zulia.jpg', destacado: true, descripcion: '4 arepas tradicionales a elección, ideales para compartir, con 12 tequeños y salsa de ajo.', etiquetas: ['4 arepas', '12 tequeños', 'Salsa de ajo'] },
            { id: 'combo-maracay', nombre: 'Combo Maracay', precio: 36299, imagen: 'combo-maracay.jpg', destacado: true, descripcion: 'La combinación perfecta: 2 arepas, 2 empanadas doradas, 6 tequeños y salsa de ajo.', etiquetas: ['2 arepas', '2 empanadas', '6 tequeños'] },
            { id: 'combo-caracas', nombre: 'Combo Caracas', precio: 34649, imagen: 'combo-caracas.jpg', descripcion: '2 arepas acompañadas de 12 tequeños y salsa de ajo.', etiquetas: ['2 arepas', '12 tequeños', 'Salsa de ajo'] },
            { id: 'combo-vargas', nombre: 'Combo Vargas', precio: 17399, imagen: 'combo-vargas.jpg', descripcion: 'Para un antojo rápido: 2 empanadas a elección, 6 tequeños y salsa.', etiquetas: ['2 empanadas', '6 tequeños', 'Salsa'] },
        ],
    },
    {
        id: 'arepas',
        titulo: 'Arepas',
        descripcion: 'Arepas de maíz precocido con nuestra variedad de rellenos. Asadas o fritas. Sin TACC, aptas para celíacos.',
        productos: [
            { id: 'arepa-pollo', nombre: 'Pollo', precio: 9449, imagen: 'arepa-pollo.jpg', descripcion: 'Rellena de pollo desmechado bien sazonado.', etiquetas: ['Pollo'] },
            { id: 'arepa-queso', nombre: 'Queso', precio: 9449, imagen: 'arepa-queso.jpg', descripcion: 'Rellena de queso blanco venezolano.', etiquetas: ['Queso'] },
            { id: 'arepa-carne', nombre: 'Carne Mechada', precio: 9449, imagen: 'arepa-carne.jpg', descripcion: 'Rellena de carne mechada al estilo venezolano.', etiquetas: ['Carne'] },
            { id: 'arepa-domino', nombre: 'Dominó', precio: 9449, imagen: 'arepa-domino.jpg', descripcion: 'Deliciosa combinación de porotos negros con queso blanco venezolano.', etiquetas: ['Porotos', 'Queso'] },
            { id: 'arepa-catira', nombre: 'Catira', precio: 9999, imagen: 'arepa-catira.jpg', descripcion: 'Pollo desmechado jugoso coronado con abundante queso venezolano.', etiquetas: ['Pollo', 'Queso'] },
            { id: 'arepa-pelua', nombre: 'Pelúa', precio: 9999, imagen: 'arepa-pelua.jpg', destacado: true, descripcion: 'La favorita: carne mechada bien sazonada combinada con queso venezolano.', etiquetas: ['Carne', 'Queso'] },
            { id: 'arepa-pabellon', nombre: 'Pabellón', precio: 10299, imagen: 'arepa-pabellon.jpg', descripcion: 'El plato nacional en una arepa: carne mechada, porotos negros tradicionales y queso venezolano.', etiquetas: ['Carne', 'Porotos', 'Queso'] },
        ],
    },
    {
        id: 'empanadas',
        titulo: 'Empanadas Venezolanas',
        descripcion: 'Empanadas de maíz precocido y harina de trigo con nuestra variedad de rellenos.',
        productos: [
            { id: 'empanada-pollo', nombre: 'Pollo', precio: 4799, imagen: 'empanada-pollo.jpg', descripcion: 'Rellena de pollo desmechado.', etiquetas: ['Pollo'] },
            { id: 'empanada-queso', nombre: 'Queso', precio: 4799, imagen: 'empanada-queso.jpg', descripcion: 'Rellena de queso blanco venezolano.', etiquetas: ['Queso'] },
            { id: 'empanada-carne', nombre: 'Carne Mechada', precio: 4799, imagen: 'empanada-carne.jpg', descripcion: 'Rellena de carne mechada.', etiquetas: ['Carne'] },
            { id: 'empanada-porotos', nombre: 'Porotos', precio: 4699, imagen: 'empanada-porotos.jpg', descripcion: 'Rellena de porotos negros.', etiquetas: ['Porotos'] },
            { id: 'empanada-domino', nombre: 'Dominó', precio: 4799, imagen: 'empanada-domino.jpg', descripcion: 'Porotos negros con queso blanco.', etiquetas: ['Porotos', 'Queso'] },
            { id: 'empanada-catira', nombre: 'Catira', precio: 4999, imagen: 'empanada-catira.jpg', descripcion: 'Pollo desmechado con queso.', etiquetas: ['Pollo', 'Queso'] },
            { id: 'empanada-pelua', nombre: 'Pelúa', precio: 4999, imagen: 'empanada-pelua.jpg', descripcion: 'Carne mechada con queso.', etiquetas: ['Carne', 'Queso'] },
            { id: 'empanada-pabellon', nombre: 'Pabellón', precio: 5199, imagen: 'empanada-pabellon.jpg', descripcion: 'Carne mechada, porotos negros y queso.', etiquetas: ['Carne', 'Porotos', 'Queso'] },
        ],
    },
    {
        id: 'tequenos',
        titulo: 'Tequeños',
        descripcion: 'Rellenos de queso llanero venezolano envueltos en una masa de harina de trigo.',
        productos: [
            { id: 'tequenos-promo-8', nombre: 'Tequeños Fritos Promoción', precio: 10499, imagen: 'tequenos-12.jpg', destacado: true, promo: true, descripcion: '8 unidades de tequeños fritos dorados acompañados con nuestra salsa de ajo.', etiquetas: ['8 unidades', 'Salsa de ajo'] },
            { id: 'tequenos-fritos-12', nombre: 'Tequeños Fritos x12', precio: 15299, imagen: 'tequenos-12.jpg', descripcion: 'Doce tequeños fritos, dorados y crocantes.', etiquetas: ['12 unidades'] },
            { id: 'tequenos-fritos-6', nombre: 'Tequeños Fritos x6', precio: 7899, imagen: 'tequenos-12.jpg', descripcion: 'Seis tequeños fritos, dorados y crocantes.', etiquetas: ['6 unidades'] },
            { id: 'tequenos-congelados-12', nombre: 'Tequeños Congelados x12', precio: 15199, imagen: 'tequenos-12.jpg', descripcion: 'Doce tequeños listos para freír en casa.', etiquetas: ['12 unidades', 'Congelados'] },
            { id: 'tequenos-congelados-6', nombre: 'Tequeños Congelados x6', precio: 7799, imagen: 'tequenos-12.jpg', descripcion: 'Seis tequeños listos para freír en casa.', etiquetas: ['6 unidades', 'Congelados'] },
            { id: 'tequenos-20', nombre: 'Tequeños x20', precio: 26199, imagen: 'tequenos-20.jpg', descripcion: 'Veinte tequeños para compartir.', etiquetas: ['20 unidades'] },
        ],
    },
];
