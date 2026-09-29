import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, Card, Screen, TextField } from '@/components/ui';
import { useSession } from '@/lib/store/session';
import { C, R, S, T } from '@/lib/theme';
import { AVATARS } from '@/lib/format';


export default function Onboarding() {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🦁');
  const setProfile = useSession((s) => s.setProfile);
  const valid = name.trim().length >= 2;

  return (
    <Screen>
      <Animated.View entering={FadeInDown.duration(600)} style={{ alignItems: 'center', marginTop: S.xxl }}>
        <Text style={{ fontSize: 64 }}>🏆</Text>
        <Text style={[T.tiny, { color: C.gold, marginTop: S.md }]}>Benvenuto in</Text>
        <Text style={[T.hero, { textAlign: 'center' }]}>ASTA{'\n'}LEGENDS</Text>
        <Text style={[T.small, { textAlign: 'center', marginTop: S.md, maxWidth: 320 }]}>
          L'asta tra amici con le leggende del calcio nel loro prime. Costruisci la squadra, sfida gli amici, scrivi la storia.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(600)}>
        <Card style={{ marginTop: S.xxl }}>
          <TextField label="Il tuo nome" placeholder="Es. Francesco" value={name} onChangeText={setName} maxLength={20} autoFocus />
          <Text style={[T.tiny, { marginBottom: S.sm }]}>Scegli il tuo avatar</Text>
          <View style={styles.grid}>
            {AVATARS.map((a) => (
              <Pressable key={a} onPress={() => setAvatar(a)} style={[styles.avatar, avatar === a && styles.avatarActive]}>
                <Text style={{ fontSize: 26 }}>{a}</Text>
              </Pressable>
            ))}
          </View>
          <Button
            label="ENTRA IN CAMPO"
            variant="gold"
            disabled={!valid}
            style={{ marginTop: S.lg }}
            onPress={async () => {
              await setProfile(name.trim(), avatar);
              router.replace('/');
            }}
          />
        </Card>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  avatar: { width: 52, height: 52, borderRadius: R.md, backgroundColor: C.bgElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarActive: { borderColor: C.gold, backgroundColor: `${C.gold}22` },
});
