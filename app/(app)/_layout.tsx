import { Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/useAppStore';
import { HIT, border, color, radius, space } from '@/theme/tokens';
import { IconBag, IconCards, IconChart } from '@/ui/doodles';
import { Type } from '@/ui/Type';

/**
 * Custom navigation bar.
 *
 * Material's structural contract is honoured — a bottom bar with three
 * destinations on compact width, 48dp targets, real insets — while the surface
 * itself is drawn in this product's world. The active destination is a filled
 * colour block rather than a tinted icon, because this palette has no tint
 * scale to express selection with.
 *
 * The dashboard is a visible destination rather than a hidden route: it carries
 * the business argument, and a screen nobody can find makes no argument.
 */
export default function AppLayout() {
  return (
    <Tabs
      tabBar={(props) => <BrutalTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.ground } }}
    >
      <Tabs.Screen name="swipe" options={{ title: 'Swipe' }} />
      <Tabs.Screen name="bag" options={{ title: 'Bag' }} />
      <Tabs.Screen name="brand" options={{ title: 'Brand' }} />
    </Tabs>
  );
}

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

const ICONS: Record<string, (props: { size?: number; color?: string }) => React.ReactElement> = {
  swipe: IconCards,
  bag: IconBag,
  brand: IconChart,
};

const ACTIVE_TONE: Record<string, string> = {
  swipe: color.violet,
  bag: color.tomato,
  brand: color.forest,
};

function BrutalTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const cartCount = useAppStore((s) => s.cart.length);

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: HIT.gap,
        paddingHorizontal: space.md,
        paddingTop: space.sm,
        paddingBottom: Math.max(insets.bottom, space.sm),
        backgroundColor: color.ground,
        borderTopWidth: border.bold,
        borderTopColor: color.ink,
      }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const Icon = ICONS[route.name] ?? IconCards;
        const tone = focused ? (ACTIVE_TONE[route.name] ?? color.violet) : color.ground;
        const fg = focused ? color.paper : color.ink;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={route.name === 'bag' ? `Bag, ${cartCount} items` : route.name}
            onPress={() => navigation.navigate(route.name)}
            style={{
              flex: 1,
              minHeight: HIT.min,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.xs,
              backgroundColor: tone,
              borderWidth: border.hair,
              borderColor: color.ink,
              borderRadius: radius.pill,
            }}
          >
            <Icon size={19} color={fg} />
            <Type role="label" color={fg}>
              {route.name === 'bag' && cartCount > 0 ? `Bag ${cartCount}` : route.name}
            </Type>
          </Pressable>
        );
      })}
    </View>
  );
}
