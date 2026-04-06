'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { 
  MessageCircle, 
  Lock, 
  Send, 
  Copy, 
  CheckCircle2, 
  AlertCircle,
  Phone,
  ShoppingBag,
  DollarSign,
  Calendar,
  Loader2,
  ArrowRight,
  Users,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';

interface Customer {
  id: string;
  name: string;
  phone_number: string | null;
  total_spent: number;
  order_count: number;
  last_order_date: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface ShopData {
  subscription_tier: string;
  shop_name: string;
  shop_slug?: string;
}

function sanitizePhoneNumber(rawNumber?: string | null) {
  if (!rawNumber) return null;
  let cleanNumber = rawNumber.replace(/\D/g, '');
  if (!cleanNumber) return null;
  if (cleanNumber.length === 7) cleanNumber = `220${cleanNumber}`;
  return cleanNumber;
}

function generateWhatsAppLink(phone: string | null, message: string) {
  const cleanPhone = sanitizePhoneNumber(phone);
  if (!cleanPhone) return null;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export default function BroadcastPage() {
  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingCampaign, setIsGeneratingCampaign] = useState(false);
  const [campaignError, setCampaignError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch shop tier and slug
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('subscription_tier, shop_name, shop_slug')
        .eq('id', user.id)
        .single();

      if (shopError || !shop) {
        setError('Failed to fetch shop data');
        return;
      }

      setShopData(shop);

      // Fetch products
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!productError && productData) {
        setProducts(productData);
        // Pre-select first 3 products (or fewer if not available)
        setSelectedProducts(productData.slice(0, 3).map(p => p.id));
      }

      // Fetch orders with customer details
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          created_at,
          customers (id, name, phone_number)
        `)
        .eq('shop_id', user.id)
        .not('customers', 'is', null);

      if (ordersError) {
        setError('Failed to fetch customers');
        return;
      }

      // Aggregate unique customers with their metrics
      const customerMap = new Map<string, Customer>();

      if (orders && Array.isArray(orders)) {
        orders.forEach((order: any) => {
          if (order.customers && order.customers.phone_number) {
            const phone = order.customers.phone_number;
            const existing = customerMap.get(phone) || {
              id: order.customers.id,
              name: order.customers.name,
              phone_number: phone,
              total_spent: 0,
              order_count: 0,
              last_order_date: order.created_at,
            };

            existing.total_spent += order.total_amount || 0;
            existing.order_count += 1;
            existing.last_order_date = order.created_at;

            customerMap.set(phone, existing);
          }
        });
      }

      const customerList = Array.from(customerMap.values()).sort(
        (a, b) => b.total_spent - a.total_spent
      );

      setCustomers(customerList);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('An error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (customer: Customer) => {
    if (!message.trim()) {
      setError('Please type a message before sending');
      return;
    }

    const whatsappLink = generateWhatsAppLink(customer.phone_number, message);
    if (!whatsappLink) {
      setError(`Invalid phone number for ${customer.name}`);
      return;
    }

    setIsSending(customer.id);
    setTimeout(() => setIsSending(null), 1000);
    window.open(whatsappLink, '_blank');
  };

  const handleCopyMessage = () => {
    if (!message.trim()) {
      setError('Nothing to copy');
      return;
    }

    navigator.clipboard.writeText(message);
    setCopiedId('message');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerateCampaign = async () => {
    if (selectedProducts.length === 0) {
      setCampaignError('Please select at least one product');
      return;
    }

    try {
      setIsGeneratingCampaign(true);
      setCampaignError(null);

      // Get selected product names
      const selectedProductNames = products
        .filter(p => selectedProducts.includes(p.id))
        .map(p => p.name);

      // Call the AI campaign API (uses session cookies for auth)
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode: 'campaign',
          productNames: selectedProductNames,
          shopSlug: shopData?.shop_slug || 'store'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Show the actual error from the API
        setCampaignError(data.error || 'Failed to generate campaign message');
        return;
      }

      // Insert the generated message into the composer
      setMessage(data.message);
      setCampaignError(null);

    } catch (err) {
      console.error('Campaign generation error:', err);
      setCampaignError('Failed to generate campaign message. Please try again.');
    } finally {
      setIsGeneratingCampaign(false);
    }
  };

  const messageCharCount = message.length;
  const maxChars = 1024;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={40} className="text-green-600 animate-spin" />
      </div>
    );
  }

  // Not found state
  if (!shopData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <p className="text-gray-900 font-bold text-lg mb-2">Unable to Load</p>
          <p className="text-gray-600 mb-6">We couldn't load your shop data. Please try again.</p>
          <Link
            href="/dashboard"
            className="w-full block bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const hasAccess = shopData.subscription_tier === 'advanced' || shopData.subscription_tier === 'flagship';

  // Tier gate - lock screen
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8 font-semibold transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </Link>

          {/* Lock Screen */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-2xl mx-auto border border-gray-200">
            {/* Lock Icon Section */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-12 text-center border-b border-gray-200">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white border-4 border-red-500 mb-6">
                <Lock size={48} className="text-red-500" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 mb-2">Premium Feature Locked</h2>
              <p className="text-gray-600 text-lg">WhatsApp Broadcast Engine</p>
            </div>

            {/* Content Section */}
            <div className="p-12 text-center">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
                <p className="text-blue-900 text-sm font-semibold">
                  ✨ Reach all your customers with one powerful message
                </p>
              </div>

              <div className="space-y-4 mb-10 text-left max-w-sm mx-auto">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Broadcast to All Customers</p>
                    <p className="text-gray-600 text-sm">Automatically fetch all unique customers from your orders</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Bulk Messaging</p>
                    <p className="text-gray-600 text-sm">Send promotional messages instantly via WhatsApp</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Customer Analytics</p>
                    <p className="text-gray-600 text-sm">View spending, order history & engagement metrics</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-6 mb-8 border border-gray-200">
                <p className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Your Current Plan</p>
                <p className="text-2xl font-black text-gray-900 capitalize mb-2">
                  {shopData.subscription_tier === 'starter' ? 'Starter' : shopData.subscription_tier}
                </p>
                <p className="text-gray-600 text-sm">Upgrade to <span className="font-bold">Advanced</span> or <span className="font-bold">Flagship</span> to unlock this feature</p>
              </div>

              <Link
                href="/dashboard/settings"
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl mb-4"
              >
                Upgrade to Advanced
                <ArrowRight size={20} />
              </Link>

              <p className="text-sm text-gray-600">
                Advanced Plan: <span className="font-bold text-gray-900">D2,500</span> per month
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-900">
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard"
            className="p-2 bg-white rounded-full border hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-full">
                <MessageCircle size={24} className="text-green-700" />
              </div>
              <div>
                <h1 className="text-3xl font-black">WhatsApp Broadcast Engine</h1>
                <p className="text-gray-600 text-sm">Send personalized messages to all your customers instantly</p>
              </div>
              <div className="ml-auto flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 bg-amber-600 rounded-full"></span>
                Advanced Feature
              </div>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  fetchData();
                }}
                className="text-xs font-bold mt-2 underline hover:no-underline"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Composer Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Send size={24} className="text-green-600" />
                Compose Message
              </h2>

              {/* Campaign Error Banner */}
              {campaignError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
                  <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{campaignError}</p>
                  </div>
                </div>
              )}

              {/* Product Selector Section */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-700 mb-4">
                  📦 Select Products (Max 5)
                </label>
                
                {products.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm">
                    <p className="font-semibold">No products yet</p>
                    <p className="text-xs mt-1">Add products to your store to use AI campaign generation</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {products.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => {
                          if (selectedProducts.includes(product.id)) {
                            setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                          } else if (selectedProducts.length < 5) {
                            setSelectedProducts([...selectedProducts, product.id]);
                          }
                        }}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          selectedProducts.includes(product.id)
                            ? 'bg-green-50 border-green-500'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            selectedProducts.includes(product.id)
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300'
                          }`}>
                            {selectedProducts.includes(product.id) && (
                              <CheckCircle2 size={16} className="text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-900 truncate">{product.name}</p>
                            <p className="text-xs text-gray-600 mt-0.5">D{product.price.toLocaleString()}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Generate Campaign Button */}
                {products.length > 0 && (
                  <button
                    onClick={handleGenerateCampaign}
                    disabled={selectedProducts.length === 0 || isGeneratingCampaign}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all"
                  >
                    {isGeneratingCampaign ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Generating Campaign...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        ✨ Generate Campaign Message
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Message Textarea */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  Your Broadcast Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => {
                    if (e.target.value.length <= maxChars) {
                      setMessage(e.target.value);
                    }
                  }}
                  placeholder="Type your broadcast message here... (e.g., 'Hi! We have a new collection. Check it out! 🎉 Visit us at https://sanndikaa.com')"
                  className="w-full h-40 p-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none resize-none text-base"
                />

                {/* Character Counter */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-gray-600">
                    <span className={messageCharCount > maxChars * 0.9 ? 'text-orange-600 font-bold' : ''}>
                      {messageCharCount}
                    </span>
                    <span className="text-gray-400"> / {maxChars} characters</span>
                  </div>
                  <button
                    onClick={handleCopyMessage}
                    className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {copiedId === 'message' ? (
                      <>
                        <CheckCircle2 size={16} className="text-green-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={16} /> Copy Message
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Preview Section */}
              {message && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Message Preview</p>
                  <div className="bg-white p-4 rounded-lg border-l-4 border-green-500 max-h-32 overflow-y-auto">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{message}</p>
                  </div>
                </div>
              )}

              {/* Quick Tips */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-900 uppercase tracking-wide mb-3">💡 Pro Tips</p>
                <ul className="text-xs text-blue-800 space-y-2">
                  <li>✨ Use emojis to make your message stand out and more engaging</li>
                  <li>🔗 Include links to your shop, specific products, or website</li>
                  <li>⏰ Keep messages concise, friendly, and action-oriented</li>
                  <li>📱 Test the message with one customer before sending to all</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Stats Sidebar */}
          <div className="space-y-6">
            {/* Stats Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users size={20} className="text-green-600" />
                Campaign Stats
              </h3>

              <div className="space-y-4">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-green-700 font-bold uppercase tracking-wide">Recipients</p>
                      <p className="text-3xl font-black text-green-900">{customers.length}</p>
                    </div>
                    <Users size={32} className="text-green-200" />
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-2">
                      <ShoppingBag size={16} /> Total Orders
                    </span>
                    <span className="font-bold text-gray-900">
                      {customers.reduce((sum, c) => sum + c.order_count, 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-2">
                      <DollarSign size={16} /> Total Revenue
                    </span>
                    <span className="font-bold text-green-600">
                      D{customers
                        .reduce((sum, c) => sum + c.total_spent, 0)
                        .toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Empty State */}
            {customers.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                <AlertCircle size={24} className="mx-auto text-yellow-600 mb-2" />
                <p className="text-sm font-semibold text-yellow-900">No Customers Yet</p>
                <p className="text-xs text-yellow-700 mt-1">Start taking orders to build your customer list</p>
              </div>
            )}
          </div>
        </div>

        {/* Customer List */}
        {customers.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Users size={24} className="text-green-600" />
              Your Customers ({customers.length})
            </h2>

            <div className="grid gap-4">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-center">
                    {/* Customer Info */}
                    <div>
                      <h3 className="font-bold text-gray-900 truncate">{customer.name}</h3>
                      <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                        <Phone size={14} />
                        <a
                          href={`tel:${customer.phone_number}`}
                          className="hover:text-green-600 transition-colors truncate"
                        >
                          {customer.phone_number}
                        </a>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 justify-start sm:justify-center">
                      <div>
                        <p className="text-xs text-gray-600 font-bold uppercase tracking-wide">Orders</p>
                        <p className="text-2xl font-black text-gray-900">{customer.order_count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-bold uppercase tracking-wide">Spent</p>
                        <p className="text-xl font-black text-green-600">D{customer.total_spent.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Last Order Date */}
                    <div className="hidden md:block">
                      <p className="text-xs text-gray-600 font-bold uppercase tracking-wide mb-1">Last Order</p>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar size={14} />
                        {new Date(customer.last_order_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="md:col-span-1 sm:col-span-2">
                      <button
                        onClick={() => handleSendMessage(customer)}
                        disabled={!message.trim() || isSending === customer.id}
                        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-xl transition-all"
                      >
                        {isSending === customer.id ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                          </>
                        ) : (
                          <>
                            <MessageCircle size={16} />
                            <span className="hidden sm:inline">Send</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Note */}
        {customers.length > 0 && (
          <div className="mt-12 bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
            <p className="text-sm text-blue-900 font-semibold mb-2">
              🌍 <span className="font-bold">How It Works:</span> Messages are sent via WhatsApp Web
            </p>
            <p className="text-xs text-blue-700 max-w-2xl mx-auto">
              Each customer will open WhatsApp on your device with the pre-filled message ready to send. This ensures 100% compliance with WhatsApp's business messaging policies. You maintain full control over what gets sent.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
