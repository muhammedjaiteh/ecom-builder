// components/TrustUrgencyBlock.tsx

import { ShieldCheck, Flame, Truck, Smartphone } from "lucide-react";

export default function TrustUrgencyBlock() {
  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      
      {/* Urgency Signal */}
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-800">
        <Flame className="h-4 w-4 text-orange-500" />
        <span>High Demand — Selling fast</span>
      </div>

      {/* Divider */}
      <div className="my-3 h-px w-full bg-neutral-100" />

      {/* Trust Shield */}
      <div className="flex items-center gap-2 text-sm text-neutral-700">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        <span>
          Verified Seller • Orders secured via{" "}
          <span className="font-semibold text-black">Sanndikaa</span>
        </span>
      </div>

      {/* Payment + Delivery */}
      <div className="mt-2 flex flex-col gap-1 text-sm text-neutral-700">
        
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-neutral-600" />
          <span>Pay on Delivery Available</span>
        </div>

        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-neutral-600" />
          <span>Mobile Money Accepted</span>
        </div>

      </div>
    </div>
  );
}