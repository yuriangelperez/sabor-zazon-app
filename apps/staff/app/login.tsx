import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { supabaseConfigurado } from '@sabor/api-client';
import { Button, colors, EncabezadoBandera, radii, spacing, Text, TextInput } from '@sabor/ui';

import { useSesionStore } from '../stores/useSesionStore';

const logo = require('../assets/images/logo.png');

// RF-14: ingreso de recepción y de la dueña (Supabase Auth).
export default function Login() {
  const { entrar, error } = useSesionStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);

  const onEntrar = async () => {
    if (!email.trim() || !password) return;
    setEnviando(true);
    await entrar(email, password);
    setEnviando(false);
  };

  return (
    <View style={styles.pantalla}>
      <EncabezadoBandera titulo="Sabor y Sazón · Recepción" />
      <KeyboardAvoidingView style={styles.centro} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.tarjeta}>
          <Image source={logo} style={styles.logo} />
          <Text style={styles.titulo}>Portal de recepción</Text>
          <Text style={styles.subtitulo}>Ingresá con el usuario que te dio la dueña.</Text>

          {!supabaseConfigurado ? (
            <Text style={styles.error}>
              Falta configurar Supabase: completá EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en
              apps/staff/.env y reiniciá la app.
            </Text>
          ) : null}

          <View style={styles.campo}>
            <Text style={styles.etiqueta}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="recepcion@saborysazon.com"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </View>
          <View style={styles.campo}>
            <Text style={styles.etiqueta}>Contraseña</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              onSubmitEditing={onEntrar}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={enviando ? 'Ingresando…' : 'Ingresar'}
            onPress={onEntrar}
            disabled={enviando || !email.trim() || !password}
            icono={enviando ? <ActivityIndicator color={colors.sobreAcento} /> : undefined}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, justifyContent: 'center', padding: spacing.md },
  tarjeta: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 3,
    borderTopColor: colors.acento,
    padding: spacing.lg,
  },
  logo: { width: 72, height: 72, borderRadius: 36, alignSelf: 'center' },
  titulo: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitulo: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  campo: { gap: 6 },
  etiqueta: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  input: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontSize: 15,
  },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
});
