import { redirect } from 'next/navigation';

// The buyer mall lives at the root domain (Law 1). This route exists only so
// links minted while the mall temporarily lived at /marketplace never 404.
export default function MarketplaceRedirect() {
  redirect('/');
}
