// Términos y condiciones que el cliente acepta al confirmar un pedido.
// Se muestran solo cuando toca "términos y condiciones" en el checkout.
export const TERMINOS_ACTUALIZADOS = 'Septiembre 2026';

export const TERMINOS: { titulo: string; texto: string }[] = [
  {
    titulo: '1. Pedidos',
    texto:
      'Al confirmar tu pedido nos autorizás a prepararlo con los productos y opciones que elegiste. El pedido queda confirmado cuando el local lo acepta; vas a poder seguir su estado desde la app.',
  },
  {
    titulo: '2. Precios y pagos',
    texto:
      'Los precios están expresados en pesos argentinos e incluyen IVA. Los pagos con tarjeta o Mercado Pago tienen un recargo que se informa antes de confirmar. Si pagás con Mercado Pago, el local recibe tu pedido cuando se aprueba el pago. Si pagás por transferencia, enviá el comprobante por WhatsApp.',
  },
  {
    titulo: '3. Entrega y retiro',
    texto:
      'El delivery se hace solo a las zonas disponibles y su costo se suma al total. Los tiempos de preparación y entrega son estimados y pueden variar según la demanda. Si retirás en el local, presentá tu número de pedido.',
  },
  {
    titulo: '4. Cancelaciones y reembolsos',
    texto:
      'Podés cancelar sin costo mientras el pedido no haya sido aceptado. Si el pedido ya está en preparación, escribinos por WhatsApp y vemos cómo ayudarte. Si cancelás un pedido que ya está listo, se te devuelve el 70% del total, ya que la comida fue preparada. Si el local rechaza o cancela tu pedido, se te devuelve el 100% de lo pagado.',
  },
  {
    titulo: '5. Alergias',
    texto:
      'Si tenés alguna alergia o restricción, indicala en las observaciones del pedido. En nuestra cocina se manipulan gluten, lácteos y otros alérgenos, por lo que no podemos garantizar la ausencia total de trazas.',
  },
  {
    titulo: '6. Datos personales',
    texto:
      'Usamos tu nombre, celular y dirección solo para preparar, entregar y comunicarnos por tu pedido. No los compartimos con terceros.',
  },
];
