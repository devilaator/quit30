import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Language } from './model';
import { t } from './i18n';
import { palette } from './components';

export function BrandInfo({ language }: { language: Language }) {
  const [failed, setFailed] = useState(false);
  return <View style={styles.container}>
    <Text style={styles.label}>A DEVILAATOR project</Text>
    <Pressable accessibilityRole="link" onPress={() => {
      setFailed(false);
      void Linking.openURL('https://devilaator.ee').catch(() => setFailed(true));
    }} style={styles.link}>
      <Text style={styles.address}>devilaator.ee</Text>
    </Pressable>
    {failed && <Text style={styles.label}>{t(language, 'brandLinkFailed')}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  container: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: palette.cardBorder, alignItems: 'center' },
  label: { color: palette.muted, fontSize: 12, textAlign: 'center' },
  link: { padding: 12 },
  address: { color: palette.sand, fontSize: 13, textDecorationLine: 'underline' },
});
