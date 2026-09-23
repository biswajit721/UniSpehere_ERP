import { useEffect, useState } from "react";
import { api } from "../services/api";
import { extractErrorMessage } from "../utils/errorMessage";

interface Card {
  universityId: string;
  fullName: string;
  rollNumber: string;
  department: string;
  program: string;
  batch: string;
  profilePhoto: string | null;
  validUntil: string;
  qrDataUrl: string;
}

export function IdCardPage() {
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/idcard/me")
      .then(({ data }) => setCard(data.card))
      .catch((err) => setError(extractErrorMessage(err, "Could not load ID card")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-text-secondary text-sm">Loading...</p>;
  if (error) return <div className="card p-6 text-center text-sm text-text-secondary">{error}</div>;
  if (!card) return null;

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Digital ID Card</h1>
          <p className="text-sm text-text-secondary mt-1">Scan the QR code to verify identity.</p>
        </div>
        <button onClick={() => window.print()} className="btn-primary self-start sm:self-auto">Print / Save as PDF</button>
      </div>

      <div className="card overflow-hidden max-w-sm">
        <div className="bg-primary p-4 text-white">
          <p className="text-sm font-semibold">UniSphere University</p>
          <p className="text-xs text-white/95">Student Identity Card</p>
        </div>

        <div className="p-5">
          <div className="flex items-start gap-4">
            {card.profilePhoto ? (
              <img src={card.profilePhoto} alt="" className="h-20 w-20 rounded-lg object-cover" />
            ) : (
              <div className="h-20 w-20 rounded-lg bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary">
                {card.fullName[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-text-primary dark:text-text-dark-primary">{card.fullName}</p>
              <p className="text-xs text-text-secondary font-mono mt-0.5">{card.universityId}</p>
              <p className="text-xs text-text-secondary mt-2">Roll: {card.rollNumber}</p>
              <p className="text-xs text-text-secondary">{card.program}</p>
            </div>
          </div>

          <dl className="mt-4 space-y-1 text-xs">
            <div className="flex justify-between">
              <dt className="text-text-secondary">Department</dt>
              <dd className="text-text-primary dark:text-text-dark-primary">{card.department}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Batch</dt>
              <dd className="text-text-primary dark:text-text-dark-primary">{card.batch}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Valid until</dt>
              <dd className="text-text-primary dark:text-text-dark-primary">{card.validUntil}</dd>
            </div>
          </dl>

          <div className="mt-4 flex justify-center border-t border-border dark:border-border-dark pt-4">
            <img src={card.qrDataUrl} alt="Verification QR code" className="h-32 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}
