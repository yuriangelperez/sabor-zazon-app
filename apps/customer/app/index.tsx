import type { ComponentProps, ReactNode } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { acentoAlpha, Button, colors, fuenteImagen, radii, spacing, Text } from '@sabor/ui';
import { formatPrice, precioConDescuento } from '@sabor/utils';

import { CartBar } from '../components/CartBar';
import { Contenedor } from '../components/Contenedor';
import { EstadoLocalBanner } from '../components/EstadoLocalBanner';
import { PedidoEnCursoBanner } from '../components/PedidoEnCursoBanner';
import { LOCAL, whatsappUrl } from '../constants/local';
import { useLocal } from '../hooks/useLocal';
import { useProductos } from '../hooks/useProductos';

const hero = require('../assets/images/branding/hero.jpg');

const ACCESOS: { label: string; href: Href; imagen: string }[] = [
  { label: 'Combos', href: '/menu?momento=combos', imagen: 'combo-maracay' },
  { label: 'Arepas', href: '/menu?base=arepa', imagen: 'arepa-pelua' },
  { label: 'Empanadas', href: '/menu?base=empanada', imagen: 'empanada-pabellon' },
  { label: 'Tequeños', href: '/menu?base=tequeño', imagen: 'tequenos-12' },
];

// Home de la app de pedidos: misma estética que la landing (hero, carta,
// promo, contacto) pero todo lleva al flujo de compra de la app.
export default function Home() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { productos } = useProductos();
  const { config } = useLocal();
  const horario = config ? { apertura: config.horarioApertura, cierre: config.horarioCierre } : LOCAL.horario;
  const esAncho = width >= 768;
  const combos = productos.filter((p) => p.esCombo);

  return (
    <View style={styles.pantalla}>
      <EstadoLocalBanner />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <PedidoEnCursoBanner style={styles.pedidoEnCurso} />
        {/* HERO */}
        <FondoImagen source={hero} style={[styles.hero, { minHeight: Math.max(420, height * 0.6) }]}>
          <LinearGradient colors={['rgba(0,0,0,0.65)', colors.background]} style={StyleSheet.absoluteFill} />
          <Contenedor style={styles.heroContenido}>
            <Text style={[styles.heroTitulo, esAncho && styles.heroTituloAncho]}>
              El auténtico sabor venezolano en tu mesa
            </Text>
            <Text style={styles.heroSubtitulo}>
              Disfrutá de las mejores arepas, empanadas y tequeños preparados como en Venezuela.
            </Text>
            <View style={styles.heroBotones}>
              <Button label="Hacer mi pedido" onPress={() => router.push('/menu')} />
              <Button
                label="Comunicarse"
                variante="contorno"
                icono={<Ionicons name="logo-whatsapp" size={18} color={colors.acento} />}
                onPress={() => Linking.openURL(whatsappUrl(LOCAL.whatsapps[0].numero))}
              />
            </View>
          </Contenedor>
        </FondoImagen>

        <Contenedor>
          {/* ENCABEZADO DE LA CARTA */}
          <View style={styles.cartaHeader}>
            <Etiqueta>Carta tradicional</Etiqueta>
            <Text style={styles.cartaTitulo}>Sabor & Sazón</Text>
            <Text style={styles.cartaSubtitulo}>El auténtico sabor venezolano hecho en casa</Text>
            <View style={styles.lineaDorada} />
          </View>

          {/* CATEGORÍAS */}
          <TituloCategoria>Explorá el menú</TituloCategoria>
          <View style={styles.accesos}>
            {ACCESOS.map((a) => (
              <Pressable
                key={a.label}
                accessibilityRole="button"
                onPress={() => router.push(a.href)}
                style={[styles.acceso, { flexBasis: esAncho ? '23%' : '47%' }]}
              >
                <FondoImagen source={fuenteImagen(a.imagen)} style={styles.accesoImagen} radio={radii.md}>
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFill} />
                  <Text style={styles.accesoTexto}>{a.label}</Text>
                </FondoImagen>
              </Pressable>
            ))}
          </View>

          {/* COMBOS */}
          {combos.length > 0 ? (
            <>
              <TituloCategoria>Nuestros combos</TituloCategoria>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.combos}>
                {combos.map((c) => (
                  <Pressable key={c.id} onPress={() => router.push(`/producto/${c.id}`)} style={styles.combo}>
                    <Image source={fuenteImagen(c.imagen)} style={styles.comboImagen} />
                    <View style={styles.comboInfo}>
                      <View style={styles.filaTitulo}>
                        <Text style={styles.comboNombre} numberOfLines={1}>
                          {c.nombre}
                        </Text>
                        <View style={styles.puntos} />
                        <Text style={styles.comboPrecio}>{formatPrice(precioConDescuento(c))}</Text>
                      </View>
                      <Text style={styles.comboDescripcion} numberOfLines={2}>
                        {c.descripcion}
                      </Text>
                      <View style={styles.comboBoton}>
                        <Text style={styles.comboBotonTexto}>Armar combo</Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          {/* PROMO */}
          <View style={styles.promo}>
            <Etiqueta>Ahorro exclusivo</Etiqueta>
            <Text style={styles.promoTitulo}>¡Pedí directo y ahorrá un 20%!</Text>
            <Text style={styles.promoTexto}>
              Evitá las comisiones excesivas de las apps de delivery. Comprando directamente por nuestros canales
              oficiales te garantizamos un precio un 20% más barato que en PedidosYa.
            </Text>
            <Button label="Armar mi pedido ahora" onPress={() => router.push('/menu')} />
          </View>

          {/* HISTORIA */}
          <View style={styles.historia}>
            <Etiqueta>Nuestra historia</Etiqueta>
            <Text style={styles.historiaTexto}>
              Nacimos con la misión de traer el auténtico calor y sabor de Venezuela directo a tu mesa. Cada arepa,
              empanada y tequeño está preparado de forma casera, utilizando recetas tradicionales y los mejores
              ingredientes para que en cada bocado te sientas como en Venezuela.
            </Text>
          </View>

          {/* CONTACTO */}
          <View style={[styles.info, esAncho && styles.infoAncho]}>
            <TarjetaInfo icono="time-outline" titulo="Nuestros horarios">
              <View style={styles.horario}>
                <Text style={styles.infoTexto}>{LOCAL.diasAtencion}</Text>
                <Text style={styles.horarioHoras}>
                  {horario.apertura} a {horario.cierre}
                </Text>
              </View>
              <Text style={styles.infoNota}>* Los horarios pueden variar en días feriados.</Text>
            </TarjetaInfo>

            <TarjetaInfo icono="location-outline" titulo="Ubicación">
              <Text style={styles.infoDestacado}>{LOCAL.calle}</Text>
              <Text style={styles.infoTexto}>{LOCAL.localidad}</Text>
              <Canal onPress={() => Linking.openURL(LOCAL.mapsUrl)}>Ver en Maps</Canal>
            </TarjetaInfo>

            <TarjetaInfo icono="call-outline" titulo="Contacto directo">
              <Text style={styles.infoTexto}>¿Tenés alguna duda con tu pedido, catering o evento?</Text>
              {LOCAL.whatsapps.map((w) => (
                <Canal key={w.numero} whatsapp onPress={() => Linking.openURL(whatsappUrl(w.numero))}>
                  WhatsApp: {w.etiqueta}
                </Canal>
              ))}
            </TarjetaInfo>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerMarca}>{LOCAL.nombre}</Text>
            <Text style={styles.footerTexto}>{LOCAL.eslogan}</Text>
            <Text style={styles.footerTexto}>
              © {new Date().getFullYear()} {LOCAL.nombre}. Todos los derechos reservados.
            </Text>
          </View>
        </Contenedor>
      </ScrollView>

      <CartBar />
    </View>
  );
}

// Imagen de fondo que cubre y recorta su contenedor (ImageBackground no
// recorta en la web).
function FondoImagen({
  source,
  style,
  radio = 0,
  children,
}: {
  source: ComponentProps<typeof Image>['source'];
  style?: ComponentProps<typeof View>['style'];
  radio?: number;
  children?: ReactNode;
}) {
  return (
    <View style={[{ overflow: 'hidden', borderRadius: radio }, style]}>
      <Image source={source} style={styles.fondo} resizeMode="cover" />
      {children}
    </View>
  );
}

function Etiqueta({ children }: { children: ReactNode }) {
  return (
    <View style={styles.etiqueta}>
      <Text style={styles.etiquetaTexto}>{children}</Text>
    </View>
  );
}

function TituloCategoria({ children }: { children: ReactNode }) {
  return (
    <View style={styles.categoria}>
      <Text style={styles.categoriaTitulo}>{children}</Text>
      <LinearGradient
        colors={[acentoAlpha(0.2), 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.categoriaDecor}
      />
    </View>
  );
}

function TarjetaInfo({
  icono,
  titulo,
  children,
}: {
  icono: ComponentProps<typeof Ionicons>['name'];
  titulo: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.tarjetaInfo}>
      <Ionicons name={icono} size={30} color={colors.acento} />
      <Text style={styles.infoTitulo}>{titulo}</Text>
      <View style={styles.infoLinea} />
      {children}
    </View>
  );
}

function Canal({ children, onPress, whatsapp = false }: { children: ReactNode; onPress: () => void; whatsapp?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.canal, whatsapp && styles.canalWhatsapp]}>
      <Text style={[styles.canalTexto, whatsapp && { color: colors.whatsapp }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  pedidoEnCurso: { paddingVertical: spacing.md },
  fondo: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },

  hero: { justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: colors.acento },
  heroContenido: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md },
  heroTitulo: { color: '#ffffff', fontSize: 32, lineHeight: 40, fontWeight: '700', textAlign: 'center', maxWidth: 800 },
  heroTituloAncho: { fontSize: 48, lineHeight: 58 },
  heroSubtitulo: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, fontWeight: '300', textAlign: 'center', maxWidth: 640 },
  heroBotones: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md, marginTop: spacing.md },

  cartaHeader: { alignItems: 'center', paddingTop: 48, paddingBottom: spacing.md },
  cartaTitulo: { color: '#ffffff', fontSize: 32, fontWeight: '700', marginTop: spacing.sm },
  cartaSubtitulo: { color: colors.textSecondary, fontSize: 15, textAlign: 'center' },
  lineaDorada: { width: 50, height: 3, borderRadius: 2, backgroundColor: colors.acento, marginTop: spacing.lg },

  etiqueta: {
    alignSelf: 'center',
    backgroundColor: acentoAlpha(0.1),
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  etiquetaTexto: { color: colors.acento, fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },

  categoria: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.lg },
  categoriaTitulo: { color: colors.acento, fontSize: 22, fontWeight: '600' },
  categoriaDecor: { flex: 1, height: 1 },

  accesos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  acceso: { flexGrow: 1 },
  accesoImagen: { height: 140, justifyContent: 'flex-end', padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  accesoTexto: { color: '#ffffff', fontSize: 20, fontWeight: '700' },

  combos: { gap: spacing.lg, paddingBottom: spacing.xs },
  combo: {
    width: 280,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.acento,
    overflow: 'hidden',
  },
  comboImagen: { width: '100%', height: 170 },
  comboInfo: { padding: spacing.md, gap: spacing.sm },
  filaTitulo: { flexDirection: 'row', alignItems: 'center' },
  comboNombre: { color: '#ffffff', fontSize: 16, fontWeight: '600', flexShrink: 1 },
  puntos: {
    flex: 1,
    minWidth: 10,
    marginHorizontal: 8,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  comboPrecio: { color: colors.acento, fontSize: 16, fontWeight: '700' },
  comboDescripcion: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  comboBoton: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  comboBotonTexto: { color: '#ffffff', fontSize: 13, fontWeight: '600' },

  promo: {
    marginTop: 48,
    padding: spacing.lg,
    paddingVertical: 36,
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: acentoAlpha(0.15),
    backgroundColor: acentoAlpha(0.05),
  },
  promoTitulo: { color: '#ffffff', fontSize: 26, lineHeight: 34, fontWeight: '700', textAlign: 'center' },
  promoTexto: { color: colors.textSecondary, fontSize: 15, lineHeight: 25, textAlign: 'center', maxWidth: 700 },

  historia: { alignItems: 'center', gap: spacing.md, marginTop: 48 },
  historiaTexto: { color: colors.textSecondary, fontSize: 15, lineHeight: 27, textAlign: 'center', maxWidth: 800 },

  info: { marginTop: 48, gap: spacing.lg },
  infoAncho: { flexDirection: 'row' },
  tarjetaInfo: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 32,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  infoTitulo: { color: '#ffffff', fontSize: 19, fontWeight: '600', marginTop: spacing.sm },
  infoLinea: { width: 40, height: 2, backgroundColor: colors.acento, marginVertical: spacing.md },
  infoTexto: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  infoDestacado: { color: colors.acento, fontSize: 21, fontWeight: '700' },
  infoNota: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic', marginTop: spacing.sm },
  horario: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', gap: spacing.sm },
  horarioHoras: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  canal: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    paddingVertical: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
  },
  canalWhatsapp: { backgroundColor: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.2)' },
  canalTexto: { color: '#ffffff', fontSize: 13, fontWeight: '500' },

  footer: {
    marginTop: 48,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
    gap: 4,
  },
  footerMarca: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  footerTexto: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
