import React, { useRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { C, R, S, T } from '@/lib/theme';
import { Button, Card } from '@/components/ui';
import { parseInviteCode } from './labels';

/** Inline QR scanner that reports the first valid invite code it sees. */
export function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  if (Platform.OS === 'web') {
    return (
      <Card style={{ alignItems: 'center', gap: S.sm }}>
        <Text style={{ fontSize: 32 }}>📱</Text>
        <Text style={T.h3}>Scanner disponibile su mobile</Text>
        <Text style={[T.small, { textAlign: 'center' }]}>Dal browser inserisci il codice a mano: sono 6 caratteri.</Text>
        <Button small variant="ghost" label="Chiudi" onPress={onClose} />
      </Card>
    );
  }
  return <NativeScanner onCode={onCode} onClose={onClose} />;
}

function NativeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);

  if (!permission) {
    return (
      <Card style={{ alignItems: 'center' }}>
        <ActivityIndicator color={C.gold} />
      </Card>
    );
  }

  if (!permission.granted) {
    return (
      <Card style={{ alignItems: 'center', gap: S.sm }}>
        <Text style={{ fontSize: 32 }}>📷</Text>
        <Text style={T.h3}>Serve la fotocamera</Text>
        <Text style={[T.small, { textAlign: 'center' }]}>Consenti l'accesso per scansionare il QR di invito.</Text>
        <Button small variant="gold" label="Consenti fotocamera" onPress={() => void requestPermission()} disabled={!permission.canAskAgain} />
        {!permission.canAskAgain ? <Text style={T.small}>Abilitala dalle impostazioni del telefono.</Text> : null}
        <Button small variant="ghost" label="Annulla" onPress={onClose} />
      </Card>
    );
  }

  return (
    <View style={styles.wrap}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (done.current) return;
          const code = parseInviteCode(data);
          if (!code) return;
          done.current = true;
          onCode(code);
        }}
      />
      <View style={styles.frame} pointerEvents="none" />
      <View style={styles.bottom}>
        <Text style={[T.small, { color: C.text, textAlign: 'center', marginBottom: S.sm }]}>Inquadra il QR code della lega</Text>
        <Button small variant="dark" label="Chiudi scanner" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 340, borderRadius: R.lg, overflow: 'hidden', backgroundColor: '#000', borderWidth: 1, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 200, height: 200, borderRadius: R.md, borderWidth: 3, borderColor: C.gold },
  bottom: { position: 'absolute', left: S.lg, right: S.lg, bottom: S.lg },
});
