import BanjulNoirStorefront from '@/components/generator/matrix/BanjulNoirStorefront';
import { banjulNoirMerchant, banjulNoirProducts } from '@/components/generator/matrix/banjulNoir.fixture';

export default function TestPage() {
  return (
    <main className="min-h-screen bg-mall-forest">
      <BanjulNoirStorefront merchant={banjulNoirMerchant} products={banjulNoirProducts} />
    </main>
  );
}
