import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Language } from './model';
import { t } from './i18n';
import { palette, ui } from './components';

export function DevReset({ language, onReset }: { language: Language; onReset: (confirmation: string) => Promise<void> }) {
  const insets=useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const locked = useRef(false);
  if (!__DEV__) return null;

  function close() {
    if (locked.current) return;
    setConfirmation('');
    setFailed(false);
    setOpen(false);
  }
  async function confirm() {
    if (!__DEV__ || !open || confirmation !== 'RESET' || locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await onReset(confirmation);
      setOpen(false);
      setConfirmation('');
    } catch { setFailed(true); }
    finally { locked.current = false; setBusy(false); }
  }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={t(language, 'devResetLabel')}
      accessibilityHint={t(language, 'devResetHint')} delayLongPress={1000}
      onLongPress={() => { setConfirmation(''); setFailed(false); setOpen(true); }} style={styles.trigger}>
      <Text style={styles.triggerText}>{t(language, 'devResetLabel')}</Text>
      <Text style={styles.hint}>{t(language, 'devResetHint')}</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View style={[styles.backdrop,{paddingTop:insets.top+16,paddingBottom:insets.bottom+16}]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
            <View style={ui.card}>
              <Text style={ui.title}>{t(language, 'devResetLabel')}</Text>
              <Text style={styles.warning}>{t(language, 'devResetWarning')}</Text>
              <Text style={ui.body}>{t(language, 'devResetType')}</Text>
              <TextInput value={confirmation} onChangeText={setConfirmation} editable={!busy}
                autoCorrect={false} autoCapitalize="none" spellCheck={false}
                accessibilityLabel={t(language, 'devResetType')} style={ui.input} />
              {failed && <Text style={styles.warning}>{t(language, 'devResetFailed')}</Text>}
              <Pressable accessibilityRole="button" disabled={confirmation !== 'RESET' || busy}
                onPress={() => void confirm()} style={[styles.destructive, (confirmation !== 'RESET' || busy) && styles.disabled]}>
                <Text style={styles.destructiveText}>{t(language, 'devResetConfirm')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={close} style={ui.button}>
                <Text style={ui.buttonText}>{t(language, 'cancel')}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  trigger: { alignItems: 'center', marginTop: 24, padding: 12 },
  triggerText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  hint: { color: palette.muted, fontSize: 11, marginTop: 5 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 },
  keyboard: { maxHeight: '100%' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  warning: { color: palette.danger, fontSize: 16, lineHeight: 24, marginBottom: 14 },
  destructive: { backgroundColor: '#A62F35', borderRadius: 14, padding: 16, alignItems: 'center', marginVertical: 8 },
  destructiveText: { color: '#FFFFFF', fontWeight: '700' },
  disabled: { opacity: 0.35 },
});
