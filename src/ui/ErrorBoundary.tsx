import { Component, type ReactNode } from 'react';
import { View } from 'react-native';

import { useAppStore } from '@/store/useAppStore';
import { color, space } from '@/theme/tokens';
import { Starburst } from './doodles';
import { PillButton } from './PillButton';
import { Screen } from './Screen';
import { Type } from './Type';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Last line of defence.
 *
 * Without this, an unhandled render error drops a release build to a blank
 * white screen with no way out — the worst possible outcome in front of a
 * judge, and indistinguishable from the app having died.
 *
 * The recovery offered is deliberate: "start over" wipes the local session and
 * returns to onboarding, because almost every plausible crash here comes from
 * malformed persisted state (a stale profile shape, a half-written swipe log),
 * and that is exactly what clearing it fixes.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Keeps the stack reachable in a dev build without a debugger attached.
    console.error('[swipefit] unhandled render error', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: space.md }}>
          <Starburst size={84} fill={color.tomato} rotate={-14} />
          <Type role="display">That broke</Type>
          <Type role="body">
            Something in the app threw and it could not carry on. Starting over clears the saved
            session, which is usually what fixes it.
          </Type>

          <View
            style={{
              padding: space.sm,
              backgroundColor: color.paper,
              borderWidth: 1,
              borderColor: color.ink,
              borderRadius: 13,
            }}
          >
            <Type role="micro" color={color.inkSoft}>
              {error.message || 'Unknown error'}
            </Type>
          </View>

          <PillButton
            label="Start over"
            onPress={() => {
              useAppStore.getState().resetAll();
              this.setState({ error: null });
            }}
            tone={color.violet}
            fullWidth
          />
          <PillButton
            label="Try again"
            onPress={() => this.setState({ error: null })}
            variant="outline"
            fullWidth
          />
        </View>
      </Screen>
    );
  }
}
