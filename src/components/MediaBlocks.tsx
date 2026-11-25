import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import { EditorBlock, EditorTheme } from '../editor/blocks';
import {
  formatFileSize,
  persistMediaFile,
  shareLocalFile,
} from '../utils/media';

interface MediaBlockProps {
  block: EditorBlock;
  isPreviewMode: boolean;
  isFocused: boolean;
  theme: EditorTheme;
  onFocus: () => void;
  onUpdateBlock: (
    blockId: string,
    patch: Partial<EditorBlock>,
    pushHistory?: boolean
  ) => void;
}

function formatSeconds(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function VideoPlayerBox({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  return (
    <VideoView
      style={styles.videoPlayer}
      player={player}
      nativeControls
      contentFit="contain"
    />
  );
}

function AudioPlayerBox({
  uri,
  theme,
}: {
  uri: string;
  theme: EditorTheme;
}) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const togglePlay = async () => {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
      if (status.playing) {
        player.pause();
      } else {
        if (
          status.didJustFinish ||
          (status.duration > 0 && status.currentTime >= status.duration - 0.1)
        ) {
          player.seekTo(0);
        }
        player.play();
      }
    } catch (err) {
      Alert.alert('Erro ao reproduzir áudio', String(err));
    }
  };

  return (
    <View
      style={[
        styles.audioBar,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <TouchableOpacity
        style={[styles.playBtn, { backgroundColor: theme.accent }]}
        onPress={togglePlay}
      >
        <Text style={styles.playBtnText}>
          {status.playing ? '⏸' : '▶'}
        </Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>
          {status.playing ? 'Reproduzindo...' : 'Áudio pronto'}
        </Text>
        <Text style={{ color: theme.textDim, fontSize: 11 }}>
          {formatSeconds(status.currentTime)} / {formatSeconds(status.duration)}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => shareLocalFile(uri)}
        style={[styles.miniBtn, { backgroundColor: theme.surfaceAlt }]}
      >
        <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: '700' }}>
          📤
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function MediaBlockView({
  block,
  isPreviewMode,
  isFocused,
  theme,
  onFocus,
  onUpdateBlock,
}: MediaBlockProps) {
  const [fullscreenUri, setFullscreenUri] = useState<string | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  const focusBorder = isFocused
    ? { borderWidth: 1.5, borderColor: theme.accent }
    : { borderWidth: 1, borderColor: theme.border };

  const pickSingleImage = async (fromCamera: boolean) => {
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permissão necessária', 'Autorize o acesso à câmera.');
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permissão necessária', 'Autorize o acesso às fotos.');
          return;
        }
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.85,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.85,
          });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const savedUri = await persistMediaFile(
          asset.uri,
          asset.fileName ?? 'foto.jpg'
        );
        onUpdateBlock(
          block.id,
          {
            mediaUri: savedUri,
            mediaName: asset.fileName ?? 'Imagem',
            mediaSize: asset.fileSize,
          },
          true
        );
      }
    } catch (err) {
      Alert.alert('Erro ao carregar imagem', String(err));
    }
  };

  const pickGalleryImages = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Autorize o acesso às fotos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        const savedList: string[] = [];
        for (const asset of result.assets) {
          const uri = await persistMediaFile(
            asset.uri,
            asset.fileName ?? 'galeria.jpg'
          );
          savedList.push(uri);
        }
        const current = block.galleryUris ?? [];
        onUpdateBlock(
          block.id,
          { galleryUris: [...current, ...savedList] },
          true
        );
      }
    } catch (err) {
      Alert.alert('Erro na galeria', String(err));
    }
  };

  const pickVideo = async (fromCamera: boolean) => {
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permissão necessária', 'Autorize o acesso à câmera.');
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permissão necessária', 'Autorize o acesso aos vídeos.');
          return;
        }
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['videos'],
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['videos'],
          });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const savedUri = await persistMediaFile(
          asset.uri,
          asset.fileName ?? 'video.mp4'
        );
        onUpdateBlock(
          block.id,
          {
            mediaUri: savedUri,
            mediaName: asset.fileName ?? 'Vídeo',
            mediaSize: asset.fileSize,
          },
          true
        );
      }
    } catch (err) {
      Alert.alert('Erro ao carregar vídeo', String(err));
    }
  };

  const pickDocument = async (typeFilter: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: typeFilter,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const savedUri = await persistMediaFile(asset.uri, asset.name);
        onUpdateBlock(
          block.id,
          {
            mediaUri: savedUri,
            mediaName: asset.name,
            mediaSize: asset.size,
            mediaMime: asset.mimeType,
          },
          true
        );
      }
    } catch (err) {
      Alert.alert('Erro ao anexar arquivo', String(err));
    }
  };

  const startVoiceRecord = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permissão necessária',
          'Autorize o acesso ao microfone para gravar áudio.'
        );
        return;
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (err) {
      Alert.alert('Erro ao gravar', String(err));
    }
  };

  const stopVoiceRecord = async () => {
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
      const recordedUri = audioRecorder.uri;
      if (recordedUri) {
        const savedUri = await persistMediaFile(recordedUri, 'nota_voz.m4a');
        onUpdateBlock(
          block.id,
          {
            mediaUri: savedUri,
            mediaName: 'Nota de Voz',
          },
          true
        );
      }
    } catch (err) {
      Alert.alert('Erro ao finalizar gravação', String(err));
    }
  };

  // 1. BLOCO DE IMAGEM
  if (block.type === 'image') {
    return (
      <View style={[styles.box, { backgroundColor: theme.bg }, focusBorder]}>
        {block.mediaUri ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setFullscreenUri(block.mediaUri ?? null)}
          >
            <Image
              source={{ uri: block.mediaUri }}
              style={styles.singleImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ) : (
          <Text style={{ color: theme.textDim, fontSize: 12, marginBottom: 8 }}>
            🖼️ Nenhuma imagem selecionada ainda.
          </Text>
        )}

        {!isPreviewMode && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => pickSingleImage(false)}
            >
              <Text style={[styles.actionText, { color: theme.text }]}>
                🖼️ Galeria
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => pickSingleImage(true)}
            >
              <Text style={[styles.actionText, { color: theme.text }]}>
                📷 Câmera
              </Text>
            </TouchableOpacity>
            {block.mediaUri && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.surfaceAlt }]}
                onPress={() => shareLocalFile(block.mediaUri!)}
              >
                <Text style={[styles.actionText, { color: '#38BDF8' }]}>
                  📤 Enviar
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {isPreviewMode ? (
          block.text ? (
            <Text style={{ color: theme.textDim, fontSize: 12, marginTop: 6, fontStyle: 'italic' }}>
              {block.text}
            </Text>
          ) : null
        ) : (
          <TextInput
            style={[styles.captionInput, { color: theme.textMuted }]}
            value={block.text}
            onFocus={onFocus}
            onChangeText={(t) => onUpdateBlock(block.id, { text: t }, false)}
            placeholder="Legenda da imagem..."
            placeholderTextColor={theme.textDim}
          />
        )}

        <Modal
          visible={!!fullscreenUri}
          transparent
          animationType="fade"
          onRequestClose={() => setFullscreenUri(null)}
        >
          <View style={styles.fullscreenBackdrop}>
            <TouchableOpacity
              style={styles.fullscreenClose}
              onPress={() => setFullscreenUri(null)}
            >
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>
                ✕ Fechar
              </Text>
            </TouchableOpacity>
            {fullscreenUri && (
              <Image
                source={{ uri: fullscreenUri }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>
      </View>
    );
  }

  // 2. BLOCO GALERIA DE IMAGENS
  if (block.type === 'gallery') {
    const uris = block.galleryUris ?? [];
    return (
      <View style={[styles.box, { backgroundColor: theme.bg }, focusBorder]}>
        <View style={styles.rowBetween}>
          <Text style={[styles.boxTitle, { color: theme.textDim }]}>
            🗂 GALERIA DE FOTOS ({uris.length})
          </Text>
          {!isPreviewMode && (
            <TouchableOpacity onPress={pickGalleryImages}>
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>
                + Adicionar Fotos
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {uris.length === 0 ? (
          <Text style={{ color: theme.textDim, fontSize: 12 }}>
            Toque em "+ Adicionar Fotos" para montar sua galeria.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {uris.map((uri, idx) => (
                <View key={`${uri}-${idx}`} style={{ position: 'relative' }}>
                  <TouchableOpacity onPress={() => setFullscreenUri(uri)}>
                    <Image
                      source={{ uri }}
                      style={styles.galleryThumb}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                  {!isPreviewMode && (
                    <TouchableOpacity
                      style={styles.removeThumbBtn}
                      onPress={() => {
                        const next = uris.filter((_, i) => i !== idx);
                        onUpdateBlock(block.id, { galleryUris: next }, true);
                      }}
                    >
                      <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>
                        ✕
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        <Modal
          visible={!!fullscreenUri}
          transparent
          animationType="fade"
          onRequestClose={() => setFullscreenUri(null)}
        >
          <View style={styles.fullscreenBackdrop}>
            <TouchableOpacity
              style={styles.fullscreenClose}
              onPress={() => setFullscreenUri(null)}
            >
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>
                ✕ Fechar
              </Text>
            </TouchableOpacity>
            {fullscreenUri && (
              <Image
                source={{ uri: fullscreenUri }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>
      </View>
    );
  }

  // 3. BLOCO DE VÍDEO
  if (block.type === 'video') {
    return (
      <View style={[styles.box, { backgroundColor: theme.bg }, focusBorder]}>
        {block.mediaUri ? (
          <VideoPlayerBox uri={block.mediaUri} />
        ) : (
          <Text style={{ color: theme.textDim, fontSize: 12, marginBottom: 8 }}>
            🎬 Nenhum vídeo selecionado ainda.
          </Text>
        )}

        {!isPreviewMode && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => pickVideo(false)}
            >
              <Text style={[styles.actionText, { color: theme.text }]}>
                🎬 Galeria
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => pickVideo(true)}
            >
              <Text style={[styles.actionText, { color: theme.text }]}>
                📹 Gravar Vídeo
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!isPreviewMode && (
          <TextInput
            style={[styles.captionInput, { color: theme.textMuted }]}
            value={block.text}
            onFocus={onFocus}
            onChangeText={(t) => onUpdateBlock(block.id, { text: t }, false)}
            placeholder="Descrição do vídeo..."
            placeholderTextColor={theme.textDim}
          />
        )}
      </View>
    );
  }

  // 4. BLOCO DE ÁUDIO / GRAVAÇÃO DE VOZ
  if (block.type === 'audio') {
    return (
      <View style={[styles.box, { backgroundColor: theme.bg }, focusBorder]}>
        <Text style={[styles.boxTitle, { color: theme.textDim }]}>
          🎙 ÁUDIO / NOTA DE VOZ
        </Text>

        {block.mediaUri ? (
          <AudioPlayerBox uri={block.mediaUri} theme={theme} />
        ) : (
          <Text style={{ color: theme.textDim, fontSize: 12, marginBottom: 8 }}>
            Grave uma nota de voz pelo microfone ou escolha um áudio do celular.
          </Text>
        )}

        {!isPreviewMode && (
          <View style={[styles.actionsRow, { marginTop: 8 }]}>
            {recorderState.isRecording ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#DC2626' }]}
                onPress={stopVoiceRecord}
              >
                <Text style={[styles.actionText, { color: '#FFF' }]}>
                  ■ Parar ({formatSeconds((recorderState.durationMillis ?? 0) / 1000)})
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.accent }]}
                onPress={startVoiceRecord}
              >
                <Text style={[styles.actionText, { color: '#FFF' }]}>
                  ● Gravar Voz
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => pickDocument('audio/*')}
            >
              <Text style={[styles.actionText, { color: theme.text }]}>
                🎵 Arquivo Áudio
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!isPreviewMode && (
          <TextInput
            style={[styles.captionInput, { color: theme.textMuted }]}
            value={block.text}
            onFocus={onFocus}
            onChangeText={(t) => onUpdateBlock(block.id, { text: t }, false)}
            placeholder="Título ou transcrição do áudio..."
            placeholderTextColor={theme.textDim}
          />
        )}
      </View>
    );
  }

  // 5. BLOCO DE ARQUIVO / PDF / DOCUMENTO
  return (
    <View style={[styles.box, { backgroundColor: theme.bg }, focusBorder]}>
      {block.mediaUri ? (
        <TouchableOpacity
          style={[
            styles.fileCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={() => shareLocalFile(block.mediaUri!, block.mediaMime)}
        >
          <Text style={{ fontSize: 22 }}>📎</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
              {block.mediaName || 'Documento anexado'}
            </Text>
            <Text style={{ color: '#38BDF8', fontSize: 11, marginTop: 2 }}>
              {formatFileSize(block.mediaSize)
                ? `${formatFileSize(block.mediaSize)} • `
                : ''}
              Toque para abrir / compartilhar
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <Text style={{ color: theme.textDim, fontSize: 12, marginBottom: 8 }}>
          📎 Nenhum PDF ou documento anexado ainda.
        </Text>
      )}

      {!isPreviewMode && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.accent }]}
            onPress={() => pickDocument('*/*')}
          >
            <Text style={[styles.actionText, { color: '#FFF' }]}>
              📂 Escolher PDF / Arquivo
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!isPreviewMode && (
        <TextInput
          style={[styles.captionInput, { color: theme.textMuted }]}
          value={block.text}
          onFocus={onFocus}
          onChangeText={(t) => onUpdateBlock(block.id, { text: t }, false)}
          placeholder="Observação sobre o arquivo..."
          placeholderTextColor={theme.textDim}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 12,
    padding: 10,
  },
  boxTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  singleImage: {
    width: '100%',
    height: 210,
    borderRadius: 10,
    marginBottom: 8,
  },
  galleryThumb: {
    width: 120,
    height: 120,
    borderRadius: 10,
  },
  removeThumbBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: '100%',
    height: 210,
    borderRadius: 10,
    backgroundColor: '#000',
    marginBottom: 8,
  },
  audioBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    gap: 10,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  miniBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 10,
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  captionInput: {
    fontSize: 12,
    marginTop: 6,
    paddingVertical: 2,
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  fullscreenClose: {
    position: 'absolute',
    top: 44,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(30,41,59,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },
});
