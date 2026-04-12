import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface Message {
  id: string;
  text: string;
  isOwn: boolean;
  time: string;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: '¡Hola! Soy tu Pulse de hoy.',
      isOwn: false,
      time: 'ahora',
    },
  ]);
  const [draft, setDraft] = useState('');

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      text,
      isOwn: true,
      time: 'ahora',
    }]);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={80}
>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.timer}>68h restantes</Text>
      </View>

      {/* Mensajes */}
      <FlatList
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => (
          <View style={[
            styles.bubble,
            item.isOwn ? styles.bubbleOwn : styles.bubbleOther
          ]}>
            <Text style={[
              styles.bubbleText,
              { color: item.isOwn ? '#0D0D0D' : '#F0F0EE' }
            ]}>
              {item.text}
            </Text>
          </View>
        )}
      />

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Escribe algo real..."
          placeholderTextColor="#444441"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { opacity: draft.trim() ? 1 : 0.4 }]}
          onPress={sendMessage}
          disabled={!draft.trim()}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16, paddingTop: 48,
    borderBottomWidth: 0.5, borderBottomColor: '#2E2E2C',
  },
  back: { fontSize: 15, color: '#7F77DD' },
  timer: { fontSize: 13, color: '#5F5E5A' },
  messageList: { padding: 16, gap: 12 },
  bubble: {
    maxWidth: '80%', borderRadius: 16,
    padding: 12,
  },
  bubbleOwn: {
    backgroundColor: '#7F77DD',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#1A1A18',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  inputRow: {
    flexDirection: 'row', gap: 8,
    padding: 12, borderTopWidth: 0.5,
    borderTopColor: '#2E2E2C',
  },
  input: {
    flex: 1, backgroundColor: '#1A1A18',
    borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 15,
    color: '#F0F0EE', maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#7F77DD', borderRadius: 22,
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { fontSize: 18, color: '#0D0D0D', fontWeight: '500' },
});