import { useState } from "react";
import { supabase } from "../lib/supabase";

interface Props {
  bookingId: string;
  barberName: string;
  onClose: () => void;
  onRated: () => void;
}

export function RatingModal({ bookingId, barberName, onClose, onRated }: Props) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await supabase.from("reviews").insert({
        booking_id: bookingId,
        rating,
        review: review.trim() || null,
      });
      setSubmitted(true);
      onRated();
    } catch {
      // ignore
    }
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-bg w-full max-w-sm rounded-2xl p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Thank you!</h3>
          <p className="text-sm text-muted">Your feedback helps us improve.</p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-accent text-white rounded-xl font-medium active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-bg w-full max-w-sm rounded-2xl p-6 space-y-4">
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold">How was your cut?</h3>
          <p className="text-sm text-muted">Rate {barberName}</p>
        </div>

        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(star)}
              className="p-1 transition-transform active:scale-90"
            >
              <svg
                className={`w-8 h-8 transition-colors ${
                  star <= (hover || rating)
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-muted/30"
                }`}
                viewBox="0 0 24 24"
                fill={star <= (hover || rating) ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </button>
          ))}
        </div>

        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Tell us about your experience (optional)"
          className="w-full p-3 rounded-xl bg-surface text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted/50"
          rows={3}
        />

        <button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="w-full py-3 bg-accent text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
        >
          {submitting ? "Submitting..." : "Submit Review"}
        </button>

        <button
          onClick={onClose}
          className="w-full text-sm text-muted py-1"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
