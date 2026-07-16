import { redirect } from 'next/navigation';

// The full customization experience (AI Website Studio + boutique appearance
// settings) now lives at Online Store → Themes. This route survives only so
// deep links and bookmarks keep working.
export default function CustomizeMoved() {
  redirect('/dashboard/online-store/themes');
}
