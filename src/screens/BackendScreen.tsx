import React, { useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SettingNote, SettingSection } from '../components/SettingControls';
import {
  BACKEND_VERB_STATUS,
  NETWORK_BACKEND_COPY,
  NETWORK_BACKEND_ID,
} from '../lib/networkBackendModel';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

/**
 * Read-only inventory of the network backend seam. AT Protocol is the only
 * registered backend and no choice control is shown: a selector would suggest
 * an implementation that does not exist. The routed/direct split is the
 * honest state of this mechanical refactor.
 */
export function BackendScreen() {
  const p = usePalette();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ title: NETWORK_BACKEND_COPY.title });
  }, [navigation]);

  const routed = BACKEND_VERB_STATUS.filter((entry) => entry.routing === 'routed');
  const direct = BACKEND_VERB_STATUS.filter((entry) => entry.routing === 'direct');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <View
        style={[
          styles.selected,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <View style={[styles.icon, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="checkmark-circle-outline" size={24} color={p.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>
            {NETWORK_BACKEND_COPY.selected}
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
            {NETWORK_BACKEND_COPY.selectedDetail}
          </Text>
          <Text
            accessibilityLabel="Backend identifier"
            style={{ color: p.secondary, fontSize: 11, marginTop: 4 }}
          >
            {NETWORK_BACKEND_ID}
          </Text>
        </View>
      </View>

      <SettingSection title={NETWORK_BACKEND_COPY.routedTitle}>
        {routed.map((entry) => (
          <StatusRow
            key={entry.verb}
            label={entry.label}
            detail={entry.detail}
            routed
          />
        ))}
      </SettingSection>

      <SettingSection title={NETWORK_BACKEND_COPY.directTitle} detail={NETWORK_BACKEND_COPY.scope}>
        {direct.map((entry) => (
          <StatusRow key={entry.verb} label={entry.label} detail={entry.detail} />
        ))}
      </SettingSection>

      <View style={{ marginHorizontal: 18 }}>
        <SettingNote>{NETWORK_BACKEND_COPY.note}</SettingNote>
      </View>
    </ScrollView>
  );
}

function StatusRow({
  label,
  detail,
  routed = false,
}: {
  label: string;
  detail: string;
  routed?: boolean;
}) {
  const p = usePalette();
  return (
    <View style={styles.row}>
      <Ionicons
        name={routed ? 'checkmark-circle-outline' : 'remove-circle-outline'}
        size={18}
        color={routed ? p.accent : p.secondary}
      />
      <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
        <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 16, marginTop: 1 }}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  selected: {
    marginHorizontal: 8,
    marginBottom: 18,
    padding: 14,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
