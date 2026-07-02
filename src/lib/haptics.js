// Native haptic feedback via Despia. No-op in the browser (guarded by isNative).
// Match the pattern to intent, not intensity — iOS users read these as signals.
import despia from 'despia-native';
import { isNative } from '@/lib/deviceAuth';

function fire(scheme) {
  if (isNative()) despia(scheme);
}

export const haptics = {
  light: () => fire('lighthaptic://'),     // toggles, minor selections, list presses
  heavy: () => fire('heavyhaptic://'),     // primary CTA taps, important commits
  success: () => fire('successhaptic://'), // saved state, finished workflows
  warning: () => fire('warninghaptic://'), // destructive prompts, cautionary states
  error: () => fire('errorhaptic://'),     // failed validation, rejected actions
};