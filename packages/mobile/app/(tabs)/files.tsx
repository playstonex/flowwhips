import { StyleSheet } from 'react-native';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Button, Card, Chip, Spinner } from 'heroui-native';
import { useAgentStore } from '../../src/stores/agents';
import { apiFetch } from '../../src/services/api';
import { FilePreview } from '../../src/components/FilePreview';

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

const BG = '#09090b';
const CARD = '#111113';
const ELEVATED = '#1a1a1e';
const BORDER = 'rgba(255,255,255,0.06)';
const TEXT_PRIMARY = '#f4f4f5';
const TEXT_SECONDARY = '#a1a1aa';
const TEXT_MUTED = '#71717a';

export default function FilesScreen() {
  const agents = useAgentStore((s) => s.agents);
  const activeAgents = agents.filter((a) => a.status !== 'stopped');
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState<FileEntry[]>([]);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeAgents.length > 0 && currentPath === '/') fetchDir(activeAgents[0].projectPath);
  }, [activeAgents, currentPath]);

  const fetchDir = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<{ path: string; items: FileEntry[] }>(`/api/files?path=${encodeURIComponent(path)}`);
      setItems(data.items ?? []); setCurrentPath(path); setFileContent(null);
    } catch { /* offline */ } finally { setLoading(false); }
  }, []);

  async function openFile(path: string) {
    try {
      const data = await apiFetch<{ content: string; name: string }>(`/api/files/content?path=${encodeURIComponent(path)}`);
      setFileContent(data.content); setFileName(data.name);
    } catch { /* offline */ }
  }

  const pathParts = currentPath.split('/').filter(Boolean);

  if (fileContent !== null) {
    return (
      <View style={s.container}>
        <View style={s.fileHeader}>
          <Pressable onPress={() => setFileContent(null)} style={s.backButton}>
            <Text style={s.backButtonText}>{'\u{2190}'} Back</Text>
          </Pressable>
          <View style={s.fileNameContainer}>
            <Text style={s.fileNameLabel}>Preview</Text>
            <Text style={s.fileNameText} numberOfLines={1}>{fileName}</Text>
          </View>
        </View>
        <FilePreview fileName={fileName} content={fileContent} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.breadcrumb}>
        <Pressable onPress={() => fetchDir('/')} style={s.bcButton}>
          <Text style={s.bcRoot}>~</Text>
        </Pressable>
        {pathParts.map((part, i) => {
          const path = '/' + pathParts.slice(0, i + 1).join('/');
          const isLast = i === pathParts.length - 1;
          return (
            <View key={path} style={s.bcSegment}>
              <Text style={s.bcSeparator}>/</Text>
              <Pressable onPress={() => fetchDir(path)} style={s.bcButton}>
                <Text style={[s.bcPart, isLast && s.bcActive]}>{part}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {activeAgents.length > 0 && (
        <View style={s.shortcuts}>
          <Text style={s.shortcutLabel}>Projects</Text>
          <View style={s.shortcutChips}>
            {activeAgents.map((a) => {
              const active = currentPath === a.projectPath;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => fetchDir(a.projectPath)}
                  style={[s.shortcutChip, active && s.shortcutChipActive]}
                >
                  <Text style={[s.shortcutChipText, active && s.shortcutChipTextActive]}>
                    {a.projectPath.split('/').pop()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {loading ? (
        <View style={s.loading}><Spinner size="lg" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.path}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>{'\u{1F4C2}'}</Text>
              <Text style={s.emptyText}>Empty directory</Text>
              <Text style={s.emptySubtext}>No files or folders found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => (item.isDir ? fetchDir(item.path) : openFile(item.path))}
              style={({ pressed }) => [s.fileRow, pressed && s.fileRowPressed]}
            >
              <View style={[s.fileIconContainer, { backgroundColor: item.isDir ? '#3b82f618' : 'rgba(255,255,255,0.04)' }]}>
                <Text style={[s.fileIcon, { color: item.isDir ? '#60a5fa' : TEXT_MUTED }]}>
                  {item.isDir ? '\u{1F4C1}' : '\u{1F4C4}'}
                </Text>
              </View>
              <Text style={[s.fileMono, item.isDir && s.fileDirName]} numberOfLines={1}>
                {item.name}
              </Text>
              {!item.isDir && <Text style={s.fileSize}>{fmt(item.size)}</Text>}
              {item.isDir && <Text style={s.fileChevron}>{'\u{203A}'}</Text>}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function fmt(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: CARD,
    gap: 12,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: ELEVATED,
    minHeight: 36,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  fileNameContainer: {
    flex: 1,
  },
  fileNameLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_MUTED,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  fileNameText: {
    fontWeight: '600',
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  breadcrumb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 14,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: CARD,
    alignItems: 'center',
  },
  bcButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    minHeight: 28,
    justifyContent: 'center',
  },
  bcRoot: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  bcSegment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bcSeparator: {
    color: BORDER,
    fontSize: 14,
    fontWeight: '400',
    marginHorizontal: 2,
  },
  bcPart: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  bcActive: {
    color: '#60a5fa',
    fontWeight: '600',
  },
  shortcuts: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  shortcutLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_MUTED,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  shortcutChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  shortcutChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: ELEVATED,
    borderWidth: 1,
    borderColor: BORDER,
    minHeight: 32,
    justifyContent: 'center',
  },
  shortcutChipActive: {
    backgroundColor: '#3b82f618',
    borderColor: '#3b82f6',
  },
  shortcutChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    fontFamily: 'monospace',
  },
  shortcutChipTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  list: {
    padding: 14,
    paddingTop: 4,
  },
  loading: {
    padding: 60,
    alignItems: 'center',
  },
  empty: {
    padding: 48,
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 8,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  fileRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    minHeight: 44,
  },
  fileRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  fileIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIcon: {
    fontSize: 14,
  },
  fileMono: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'monospace',
    color: TEXT_SECONDARY,
    fontWeight: '400',
  },
  fileDirName: {
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  fileSize: {
    fontSize: 11,
    color: TEXT_MUTED,
    fontWeight: '500',
  },
  fileChevron: {
    fontSize: 18,
    color: TEXT_MUTED,
    fontWeight: '300',
  },
});
