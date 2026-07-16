import { redirect } from 'next/navigation';

// The AI Website Studio lives at Online Store → Themes (its flagship
// section). This route survives only so deep links and bookmarks keep
// working — it targets the themes page directly to avoid a double hop
// through the retired /dashboard/customize route.
export default function WebsiteGeneratorMoved() {
  redirect('/dashboard/online-store/themes');
}
