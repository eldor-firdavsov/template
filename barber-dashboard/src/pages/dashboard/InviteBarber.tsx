import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function InviteBarber() {
  const navigate = useNavigate();
  const [barber, setBarber] = useState<any>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const barberData = JSON.parse(localStorage.getItem("barber") || "{}");
    
    if (barberData.role !== "admin") {
      navigate("/dashboard");
      return;
    }
    
    setBarber(barberData);
    
    // Generate invite link with location_id
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/register?location_id=${barberData.location_id}`;
    setInviteLink(link);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!barber) {
    return <div className="min-h-screen bg-slate-100 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <button
              onClick={() => navigate("/dashboard/shop-settings")}
              className="text-slate-600 hover:text-slate-900 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Shop Settings
            </button>
            <h1 className="text-xl font-semibold text-slate-900">Invite Barber</h1>
            <div className="w-20" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Invite a New Barber</h2>
            <p className="text-slate-600">
              Share this link with a new barber. When they register using this link, they'll automatically join your shop.
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Invite Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg bg-white text-sm"
              />
              <button
                onClick={handleCopy}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-slate-900">How it works:</h3>
            <ol className="list-decimal list-inside space-y-2 text-slate-600">
              <li>Share the invite link with the new barber</li>
              <li>They'll register with their phone number</li>
              <li>They'll receive a verification code via Telegram</li>
              <li>They'll complete a shortened onboarding (profile + working hours)</li>
              <li>They'll appear in your shop's barber list automatically</li>
            </ol>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <button
              onClick={() => navigate("/dashboard/shop-settings")}
              className="w-full bg-slate-200 text-slate-700 py-3 rounded-lg font-medium hover:bg-slate-300 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
