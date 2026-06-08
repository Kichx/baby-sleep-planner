import { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface BottomSheetSafeAreaProps {
  children: ReactNode;
  style: StyleProp<ViewStyle>;
}

export function BottomSheetSafeArea({ children, style }: BottomSheetSafeAreaProps) {
  return (
    <SafeAreaView edges={['bottom']} style={style}>
      {children}
    </SafeAreaView>
  );
}
