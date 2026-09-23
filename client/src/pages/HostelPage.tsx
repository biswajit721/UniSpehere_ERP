import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { extractErrorMessage } from "../utils/errorMessage";

interface Room {
  id: string;
  roomNumber: string;
  capacity: number;
  occupied: number;
}
interface Hostel {
  id: string;
  name: string;
  warden: string | null;
  rooms: Room[];
}

export function HostelPage() {
  const role = useAuthStore((s) => s.user?.role);
  return role === "STUDENT" ? <StudentHostelView /> : <WardenHostelView />;
}

function WardenHostelView() {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [loading, setLoading] = useState(true);
  const [newHostel, setNewHostel] = useState("");
  const [roomFor, setRoomFor] = useState<Hostel | null>(null);
  const [allocateFor, setAllocateFor] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/hostel");
      setHostels(data.hostels);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const createHostel = async () => {
    if (!newHostel.trim()) return;
    await api.post("/hostel", { name: newHostel });
    setNewHostel("");
    load();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Hostel</h1>
        <p className="text-sm text-text-secondary mt-1">Manage hostels, rooms, and student allocations.</p>
      </div>

      {error && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}

      <div className="card p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <input value={newHostel} onChange={(e) => setNewHostel(e.target.value)} placeholder="New hostel name" className="input-field flex-1" />
        <button onClick={createHostel} className="btn-primary sm:w-auto">Add hostel</button>
      </div>

      {loading ? (
        <p className="text-text-secondary text-sm">Loading...</p>
      ) : hostels.length === 0 ? (
        <div className="card p-6 text-center text-sm text-text-secondary">No hostels yet.</div>
      ) : (
        <div className="space-y-4">
          {hostels.map((h) => (
            <div key={h.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-text-primary dark:text-text-dark-primary">{h.name}</h3>
                <button onClick={() => setRoomFor(h)} className="text-primary text-xs font-medium">Add room</button>
              </div>
              {h.rooms.length === 0 ? (
                <p className="text-xs text-text-secondary">No rooms yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {h.rooms.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setAllocateFor(r)}
                      disabled={r.occupied >= r.capacity}
                      className={`rounded-lg border p-3 text-left text-sm disabled:opacity-50 ${
                        r.occupied >= r.capacity ? "border-danger/40" : "border-border dark:border-border-dark"
                      }`}
                    >
                      <p className="font-medium text-text-primary dark:text-text-dark-primary">Room {r.roomNumber}</p>
                      <p className="text-xs text-text-secondary">{r.occupied}/{r.capacity} occupied</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {roomFor && <AddRoomModal hostel={roomFor} onClose={() => setRoomFor(null)} onDone={() => { setRoomFor(null); load(); }} />}
      {allocateFor && <AllocateModal room={allocateFor} onClose={() => setAllocateFor(null)} onDone={() => { setAllocateFor(null); load(); }} onError={setError} />}
    </div>
  );
}

function AddRoomModal({ hostel, onClose, onDone }: { hostel: Hostel; onClose: () => void; onDone: () => void }) {
  const [roomNumber, setRoomNumber] = useState("");
  const [capacity, setCapacity] = useState(2);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/hostel/${hostel.id}/rooms`, { roomNumber, capacity });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0 -z-10" onClick={onClose} />
      <div className="w-full max-w-sm card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4">Add room to {hostel.name}</h3>
        <form onSubmit={submit} className="space-y-4">
          <input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="Room number" className="input-field" required />
          <input type="number" min={1} max={10} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="input-field" required />
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? "Adding..." : "Add room"}</button>
        </form>
      </div>
    </div>
  );
}

function AllocateModal({ room, onClose, onDone, onError }: { room: Room; onClose: () => void; onDone: () => void; onError: (s: string) => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; fullName: string; rollNumber: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (search.length < 2) return setResults([]);
    const t = setTimeout(() => {
      api.get("/students", { params: { search, pageSize: 8 } }).then(({ data }) => setResults(data.data));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const allocate = async (studentId: string) => {
    setSaving(true);
    try {
      await api.post("/hostel/allocate", { roomId: room.id, studentId });
      onDone();
    } catch (err: any) {
      onError(extractErrorMessage(err, "Could not allocate"));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0 -z-10" onClick={onClose} />
      <div className="w-full max-w-sm card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-1">Allocate Room {room.roomNumber}</h3>
        <p className="text-sm text-text-secondary mb-4">{room.occupied}/{room.capacity} occupied</p>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student" className="input-field" />
        {results.length > 0 && (
          <div className="mt-2 border border-border dark:border-border-dark rounded-lg overflow-hidden">
            {results.map((r) => (
              <button key={r.id} onClick={() => allocate(r.id)} disabled={saving} className="w-full text-left px-3 py-2 text-sm hover:bg-surface dark:hover:bg-surface-dark">
                {r.fullName} <span className="text-text-secondary text-xs">{r.rollNumber}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StudentHostelView() {
  const [allocation, setAllocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/hostel/me").then(({ data }) => {
      setAllocation(data.allocation);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">My Hostel</h1>
        <p className="text-sm text-text-secondary mt-1">Your current room allocation.</p>
      </div>
      {loading ? (
        <p className="text-text-secondary text-sm">Loading...</p>
      ) : allocation ? (
        <div className="card p-6 max-w-sm">
          <p className="text-sm text-text-secondary">Hostel</p>
          <p className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-3">{allocation.hostel}</p>
          <p className="text-sm text-text-secondary">Room</p>
          <p className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-3">{allocation.roomNumber}</p>
          <p className="text-xs text-text-secondary">Allocated {new Date(allocation.allocatedAt).toLocaleDateString()}</p>
        </div>
      ) : (
        <div className="card p-6 text-center text-sm text-text-secondary">
          You don't have a hostel room allocated yet.
        </div>
      )}
    </div>
  );
}
