import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { DEFAULT_CHILD_NAME } from '@/constants/sleep';
import { colors } from '@/constants/theme';

interface ProfileAvatarProps {
  name: string;
  photoUri: string | null;
  size: number;
  style?: StyleProp<ViewStyle>;
  tone?: 'solid' | 'soft';
}

function getProfileInitial(name: string): string {
  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    return DEFAULT_CHILD_NAME.slice(0, 1).toUpperCase();
  }

  return trimmedName.slice(0, 1).toUpperCase();
}

export function ProfileAvatar({
  name,
  photoUri,
  size,
  style,
  tone = 'soft',
}: ProfileAvatarProps) {
  const borderRadius = size / 2;
  const isSolid = tone === 'solid';

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: isSolid ? colors.primary : colors.primarySoft,
        },
        style,
      ]}>
      {photoUri ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: photoUri }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius,
            },
          ]}
        />
      ) : (
        <Text
          style={[
            styles.initial,
            {
              color: isSolid ? colors.surface : colors.primary,
              fontSize: Math.round(size * 0.42),
            },
          ]}>
          {getProfileInitial(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  initial: {
    fontWeight: '900',
  },
});
