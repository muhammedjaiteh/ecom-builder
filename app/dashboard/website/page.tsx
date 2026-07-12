import { redirect } from 'next/navigation';

// The AI Website Studio now lives inside the Customization tab as its
// flagship section. This route survives only so deep links and bookmarks
// keep working.
export default function WebsiteGeneratorMoved() {
  redirect('/dashboard/customize');
}
