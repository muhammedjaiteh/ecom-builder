'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, ChevronRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Message = {
  role: 'bot' | 'user';
  text: React.ReactNode;
};

export default function SellerHelpBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: "Hello! 👋 I am your Sanndikaa Co-Pilot. I can help you increase sales, improve your photos, or manage your shop. What's on your mind?" }
  ]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isOpen]);

  // 🤖 THE BRAIN: Handles user questions
  const handleQuestion = (topic: string) => {
    // 1. Add User Message
    const userText = topic === 'sales' ? "How do I get more sales?" 
                   : topic === 'share' ? "How do I share my shop?" 
                   : topic === 'photos' ? "Tips for better photos?" 
                   : "Contact Support";
                   
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsTyping(true);

    // 2. Simulate AI "Thinking" (1.5s delay)
    setTimeout(() => {
      let botResponse: React.ReactNode = "";

      switch(topic) {
        case 'sales':
          botResponse = (
            <div className="space-y-2">
              <p>To get more sales quickly, try these 3 steps:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Share Links, Not Photos:</strong> Post your specific <u>Product Link</u> on WhatsApp Status. It creates a professional preview card.</li>
                <li><strong>Use AI Descriptions:</strong> Go to 'Add Product' and use the <em>Magic Write</em> button. Better descriptions = More trust.</li>
              </ul>
              <button onClick={() => { setIsOpen(false); router.push('/dashboard/add-product'); }} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-bold mt-2 hover:bg-green-200">
                 Try Adding a Product
              </button>
            </div>
          );
          break;
        case 'share':
          botResponse = (
            <div>
              <p>Sharing is easy! Just click the white <strong>"View Shop"</strong> button at the top of your dashboard. Copy that link and send it to your customers.</p>
              <p className="mt-2 text-xs text-gray-500">Pro Tip: Add the link to your Instagram Bio too!</p>
            </div>
          );
          break;
        case 'photos':
          botResponse = (
            <div className="space-y-2">
              <p>Great photos build trust. Here is the formula:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li><strong>Natural Light:</strong> Always take photos near a window.</li>
                <li><strong>Clean Background:</strong> Use a white sheet or plain table.</li>
                <li><strong>Square Mode:</strong> Use your phone's "1:1" camera setting.</li>
              </ol>
            </div>
          );
          break;
        case 'support':
          botResponse = (
            <div>
              <p>I am connecting you to a human agent. Click below to open WhatsApp with Admin Support.</p>
              <a href="https://wa.me/2207470187" target="_blank" className="block w-full text-center bg-[#2C3E2C] text-white py-2 rounded-lg font-bold mt-3 text-xs">
                Chat with Admin
              </a>
            </div>
          );
          break;
      }

      setMessages(prev => [...prev, { role: 'bot', text: botResponse }]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans">
      
      {/* 🤖 CHAT WINDOW */}
      {isOpen && (
        <div className="bg-white w-[85vw] md:w-96 h-[500px] rounded-3xl shadow-2xl border border-gray-200 mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          
          {/* Header */}
          <div className="bg-[#2C3E2C] p-4 text-white flex justify-between items-center shadow-md z-10">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                  <Sparkles size={20} className="text-yellow-300" />
               </div>
               <div>
                  <h3 className="font-bold text-base font-serif">Sanndikaa Co-Pilot</h3>
                  <div className="flex items-center gap-1.5 opacity-80">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    <p className="text-[10px] uppercase tracking-wider">Online</p>
                  </div>
               </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors">
               <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 bg-[#F9F8F6] p-4 overflow-y-auto space-y-4" ref={scrollRef}>
             {messages.map((msg, idx) => (
               <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'bot' && (
                    <div className="w-6 h-6 bg-[#2C3E2C] rounded-full flex items-center justify-center text-white mr-2 mt-1 shrink-0">
                      <Sparkles size={12} />
                    </div>
                  )}
                  <div className={`
                    max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm
                    ${msg.role === 'user' 
                      ? 'bg-[#2C3E2C] text-white rounded-tr-none' 
                      : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'}
                  `}>
                    {msg.text}
                  </div>
               </div>
             ))}

             {/* Typing Indicator */}
             {isTyping && (
               <div className="flex justify-start">
                  <div className="w-6 h-6 bg-[#2C3E2C] rounded-full flex items-center justify-center text-white mr-2 mt-1 shrink-0">
                      <Sparkles size={12} />
                  </div>
                  <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-gray-200 shadow-sm flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                  </div>
               </div>
             )}
          </div>

          {/* Quick Actions Footer */}
          <div className="p-3 bg-white border-t border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-2 pl-1">Suggested Actions</p>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
               <button onClick={() => handleQuestion('sales')} className="whitespace-nowrap px-4 py-2 bg-green-50 text-green-800 text-xs font-bold rounded-full border border-green-100 hover:bg-green-100 transition-colors">
                 📈 Increase Sales
               </button>
               <button onClick={() => handleQuestion('photos')} className="whitespace-nowrap px-4 py-2 bg-blue-50 text-blue-800 text-xs font-bold rounded-full border border-blue-100 hover:bg-blue-100 transition-colors">
                 📷 Photo Tips
               </button>
               <button onClick={() => handleQuestion('share')} className="whitespace-nowrap px-4 py-2 bg-purple-50 text-purple-800 text-xs font-bold rounded-full border border-purple-100 hover:bg-purple-100 transition-colors">
                 📲 How to Share
               </button>
               <button onClick={() => handleQuestion('support')} className="whitespace-nowrap px-4 py-2 bg-gray-50 text-gray-800 text-xs font-bold rounded-full border border-gray-200 hover:bg-gray-100 transition-colors">
                 🆘 Human Support
               </button>
            </div>
          </div>

        </div>
      )}

      {/* 🔘 TRIGGER BUTTON (Animated) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="group relative h-16 w-16 bg-[#2C3E2C] hover:bg-black text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-50"
      >
        {isOpen ? <X size={28} /> : <Sparkles size={28} className={!isOpen ? "animate-pulse" : ""} />}
        
        {/* Notification Badge */}
        {!isOpen && (
           <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full border-2 border-[#F9F8F6]"></span>
        )}
      </button>

    </div>
  );
}